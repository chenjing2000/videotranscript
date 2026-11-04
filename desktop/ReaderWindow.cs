using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using Microsoft.Web.WebView2.Wpf;

namespace TranscriptStudio;

internal sealed class ReaderWindow : Window
{
    private const string AppHost = "reader.transcript-studio.local";
    private const string AppUrl = "https://" + AppHost + "/index.html";
    private readonly WebView2 view = new();
    private Source? source;
    private bool exporting;
    private bool initialLayoutApplied;

    private sealed record Source(string Media, string Transcript, string Fingerprint, string Project, string MediaKind);

    [STAThread]
    private static void Main() => new Application().Run(new ReaderWindow());

    private ReaderWindow()
    {
        Title = "Transcript Studio";
        Width = 1100;
        Height = 820;
        // Updated from the responsive preview constraints after WebView2 loads.
        MinWidth = 638;
        MinHeight = 560;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        Content = view;
        ContentRendered += Initialize;
        Closing += (_, args) => args.Cancel = exporting;
        Closed += (_, _) => view.Dispose();
    }

    private async void Initialize(object? sender, EventArgs args)
    {
        ContentRendered -= Initialize;
        try
        {
            var ui = Path.Combine(AppContext.BaseDirectory, "ui");
            if (!File.Exists(Path.Combine(ui, "index.html")))
                throw new FileNotFoundException("缺少打包后的界面。请先运行前端构建。");

            var profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "TranscriptStudio", "WebView2");
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: profile);
            await view.EnsureCoreWebView2Async(environment);
            var browser = view.CoreWebView2;
            browser.SetVirtualHostNameToFolderMapping(AppHost, ui, CoreWebView2HostResourceAccessKind.DenyCors);
            browser.NavigationStarting += (_, e) => e.Cancel = e.Uri != AppUrl;
            browser.NewWindowRequested += (_, e) => e.Handled = true;
            browser.WebMessageReceived += Receive;
            browser.Navigate(AppUrl);
        }
        catch (Exception error)
        {
            MessageBox.Show(this, error.Message, "启动失败");
            Close();
        }
    }

    private async void Receive(object? sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        if (args.Source != AppUrl || exporting)
            return;

        try
        {
            using var message = JsonDocument.Parse(args.WebMessageAsJson);
            var request = message.RootElement;
            switch (request.GetProperty("kind").GetString())
            {
                case "layout":
                    UpdateWindowLayout(request);
                    break;
                case "open":
                    if (args.AdditionalObjects.FirstOrDefault() is not CoreWebView2File file)
                        throw new InvalidOperationException("无法获取 JSON 文件的本地路径。");
                    OpenPair(file.Path);
                    break;
                case "save":
                    SaveProject(request.GetProperty("project"));
                    break;
                case "export":
                    await ExportAsync(request);
                    break;
            }
        }
        catch (Exception error)
        {
            Send(new { kind = "status", message = error.Message, busy = false, error = true });
        }
    }

    private void UpdateWindowLayout(JsonElement request)
    {
        // React reports the minimum client area in CSS pixels; WebView2 at the
        // standard zoom has one CSS pixel per WPF device-independent pixel.
        // Account for the native title bar and window chrome exactly once.
        var clientW = request.GetProperty("minimumClientWidth").GetDouble();
        var clientH = request.GetProperty("minimumClientHeight").GetDouble();
        var outputW = request.GetProperty("outputWidth").GetDouble();
        var outputH = request.GetProperty("outputHeight").GetDouble();
        if (!double.IsFinite(clientW) || !double.IsFinite(clientH) ||
            !double.IsFinite(outputW) || !double.IsFinite(outputH) ||
            clientW < 638 || clientW > 10000 || clientH <= 0 || clientH > 10000 ||
            outputW <= 0 || outputH <= 0)
            return;

        var chromeW = Math.Max(0, ActualWidth - view.ActualWidth);
        var chromeH = Math.Max(0, ActualHeight - view.ActualHeight);
        MinWidth = Math.Ceiling(clientW + chromeW);
        MinHeight = Math.Ceiling(clientH + chromeH);
        if (!initialLayoutApplied)
        {
            initialLayoutApplied = true;
            var screen = SystemParameters.WorkArea;
            var ratio = outputH / outputW;
            // Keep a comfortable preview on first launch, fitting the screen.
            var desiredW = Math.Max(clientW, 1060);
            var desiredH = Math.Max(clientH, 480 * ratio + 58);
            Width = Math.Max(MinWidth, Math.Min(screen.Width * 0.9, desiredW + chromeW));
            Height = Math.Max(MinHeight, Math.Min(screen.Height * 0.9, desiredH + chromeH));
        }
        else
        {
            // Never force the window's aspect ratio during manual edge/corner dragging.
            // WPF's min dimensions enforce the 360 / 240 DIP column constraints.
            if (Width < MinWidth) Width = MinWidth;
            if (Height < MinHeight) Height = MinHeight;
        }
    }

    private void OpenPair(string subtitle)
    {
        if (!subtitle.EndsWith(".transcript-studio.json", StringComparison.OrdinalIgnoreCase) || !File.Exists(subtitle))
            throw new FileNotFoundException("请选择 .transcript-studio.json 格式的标准字幕。");
        var folder = Path.GetDirectoryName(Path.GetFullPath(subtitle))!;
        var filename = Path.GetFileName(subtitle);
        var stem = filename[..^".transcript-studio.json".Length];
        var names = Directory.EnumerateFiles(folder, "*", SearchOption.TopDirectoryOnly).ToArray();
        string? media = null;
        string? mediaKind = null;
        foreach (var ext in new[] { ".mp4", ".mkv", ".mp3", ".wav" })
        {
            media = names.FirstOrDefault(candidate => string.Equals(Path.GetFileName(candidate), stem + ext,
                StringComparison.OrdinalIgnoreCase));
            if (media != null) { mediaKind = ext is ".mp3" or ".wav" ? "audio" : "video"; break; }
        }
        if (media == null || mediaKind == null)
            throw new FileNotFoundException($"未找到与 {filename} 同名的媒体文件（已查找 MP4、MKV、MP3、WAV）。");

        var bytes = File.ReadAllBytes(subtitle);
        var transcript = Encoding.UTF8.GetString(bytes).TrimStart('\uFEFF');
        using (var parsed = JsonDocument.Parse(transcript))
        {
            var root = parsed.RootElement;
            if (!root.TryGetProperty("language", out var language) || language.GetString() != "en" ||
                !root.TryGetProperty("transcript_studio", out var meta) || meta.ValueKind != JsonValueKind.Object ||
                !meta.TryGetProperty("format", out var format) || format.GetString() != "transcript-studio" ||
                !meta.TryGetProperty("schemaVersion", out var version) || version.GetInt32() != 2 ||
                root.TryGetProperty("video_transcript", out _) || root.TryGetProperty("evr", out _))
                throw new InvalidOperationException("字幕不是 Transcript Studio v2 标准格式。");
        }
        var fingerprint = Convert.ToHexString(SHA256.HashData(bytes));
        var projectPath = Path.Combine(folder, ".transcript-studio", "projects", stem + ".project.json");
        const string mediaHost = "media.transcript-studio.local";
        view.CoreWebView2.SetVirtualHostNameToFolderMapping(mediaHost, folder, CoreWebView2HostResourceAccessKind.Allow);
        var mediaUrl = $"https://{mediaHost}/{Uri.EscapeDataString(Path.GetFileName(media))}";
        source = new Source(media, subtitle, fingerprint, projectPath, mediaKind);
        Send(new
        {
            kind = "pair", mediaName = Path.GetFileName(media), mediaKind, subtitleName = filename,
            mediaUrl, transcript, fingerprint,
            project = File.Exists(projectPath) ? File.ReadAllText(projectPath) : null
        });
    }

    private Source CheckSource(JsonElement project)
    {
        var current = source ?? throw new InvalidOperationException("请先打开素材。");
        if (!project.TryGetProperty("format", out var projectFormat) || projectFormat.GetString() != "transcript-studio-project" ||
            !project.TryGetProperty("schemaVersion", out var schema) || schema.ValueKind != JsonValueKind.Number || schema.GetInt32() != 2)
            throw new InvalidOperationException("不支持的工程版本：必须为 Transcript Studio Project v2。");
        if (project.GetProperty("source").GetProperty("subtitleSha256").GetString() != current.Fingerprint ||
            Fingerprint(current.Transcript) != current.Fingerprint)
            throw new InvalidOperationException("源字幕已变化，请重新打开素材。");
        return current;
    }

    private void SaveProject(JsonElement project)
    {
        var current = CheckSource(project);
        Directory.CreateDirectory(Path.GetDirectoryName(current.Project)!);
        var temporary = current.Project + $".{Guid.NewGuid():N}.tmp";
        try
        {
            File.WriteAllText(temporary, project.GetRawText());
            if (File.Exists(current.Project))
                File.Replace(temporary, current.Project, current.Project + ".bak");
            else
                File.Move(temporary, current.Project);
        }
        finally
        {
            File.Delete(temporary);
        }

        Send(new { kind = "saved", message = $"工程已保存至 {current.Project}" });
    }

    private async Task ExportAsync(JsonElement request)
    {
        var project = request.GetProperty("project");
        var current = CheckSource(project);
        DirectoryInfo? root = new(AppContext.BaseDirectory);
        while (root != null && !File.Exists(Path.Combine(root.FullName, "scripts", "export.mjs")))
            root = root.Parent;
        if (root == null)
            throw new DirectoryNotFoundException("找不到项目的 Remotion 导出脚本。");

        var folder = Path.Combine(Path.GetDirectoryName(current.Media)!, "exports");
        Directory.CreateDirectory(folder);
        var stem = Path.GetFileNameWithoutExtension(current.Media) + "_reading";
        var output = Path.Combine(folder, stem + ".mp4");
        for (var version = 2; File.Exists(output); version++)
            output = Path.Combine(folder, $"{stem}_{version}.mp4");

        exporting = true;
        string? snapshot = null;
        string? pagePlanSnapshot = null;
        var pending = Path.Combine(folder, $".transcript-studio-{Guid.NewGuid():N}.mp4");
        try
        {
            Send(new { kind = "status", message = "正在准备导出…", busy = true });
            snapshot = Path.GetTempFileName();
            await File.WriteAllTextAsync(snapshot, project.GetRawText());
            if (request.TryGetProperty("pagePlan", out var pagePlan))
            {
                pagePlanSnapshot = Path.GetTempFileName();
                await File.WriteAllTextAsync(pagePlanSnapshot, pagePlan.GetRawText());
            }

            var start = new ProcessStartInfo("node.exe")
            {
                WorkingDirectory = root.FullName,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardErrorEncoding = Encoding.UTF8
            };
            string[] arguments = [
                Path.Combine(root.FullName, "scripts", "export.mjs"),
                "--media", current.Media, "--json", current.Transcript, "--project", snapshot,
                "--out", pending,
                "--duration", request.GetProperty("duration").GetDouble().ToString("R", CultureInfo.InvariantCulture),
                "--video-height", request.GetProperty("videoHeight").GetInt32().ToString(CultureInfo.InvariantCulture)
            ];
            foreach (var argument in arguments)
                start.ArgumentList.Add(argument);
            if (pagePlanSnapshot != null)
            {
                start.ArgumentList.Add("--page-plan");
                start.ArgumentList.Add(pagePlanSnapshot);
            }
            var chrome = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                "Google", "Chrome", "Application", "chrome.exe");
            if (File.Exists(chrome))
            {
                start.ArgumentList.Add("--browser");
                start.ArgumentList.Add(chrome);
            }

            var evidence = Environment.GetEnvironmentVariable("TRANSCRIPT_STUDIO_M1_EVIDENCE");
            if (!string.IsNullOrEmpty(evidence))
                await M1Capture.SaveAsync(view.CoreWebView2, evidence, request);
            var watch = Stopwatch.StartNew();
            using var process = Process.Start(start) ?? throw new InvalidOperationException("无法启动导出进程。");
            var errors = process.StandardError.ReadToEndAsync();
            var progressLog = new StringBuilder();
            long peakNodeBytes = 0;
            while (await process.StandardOutput.ReadLineAsync() is { } line)
            {
                progressLog.AppendLine(line);
                process.Refresh();
                if (!process.HasExited)
                    peakNodeBytes = Math.Max(peakNodeBytes, process.WorkingSet64);
                if (line.StartsWith("render ", StringComparison.Ordinal))
                    Send(new { kind = "status", message = $"正在导出 {line[7..]}", busy = true });
            }
            await process.WaitForExitAsync();
            var details = (await errors).Trim();
            if (!string.IsNullOrEmpty(evidence))
                File.WriteAllText(Path.Combine(evidence, "render.log"),
                    $"Elapsed seconds: {watch.Elapsed.TotalSeconds:F2}\nSampled Node peak bytes: {peakNodeBytes}\nExit code: {process.ExitCode}\n{progressLog}\n{details}");
            if (process.ExitCode != 0)
                throw new InvalidOperationException($"导出失败（{process.ExitCode}）。{details}");

            File.Move(pending, output);
            Send(new { kind = "status", message = $"已导出至 {output}", busy = false });
        }
        finally
        {
            exporting = false;
            if (snapshot != null)
                File.Delete(snapshot);
            if (pagePlanSnapshot != null)
                File.Delete(pagePlanSnapshot);
            File.Delete(pending);
        }
    }

    private static string Fingerprint(string file) => Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(file)));

    private void Send(object message) => view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(message));
}
