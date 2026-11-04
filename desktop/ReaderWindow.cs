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

namespace VideoTranscript;

internal sealed class ReaderWindow : Window
{
    private const string AppHost = "reader.video-transcript.local";
    private const string AppUrl = "https://" + AppHost + "/index.html";
    private readonly WebView2 view = new();
    private Source? source;
    private bool exporting;
    private string? selectedFolder;

    private sealed record Source(string Video, string Transcript, string Fingerprint, string Project);

    [STAThread]
    private static void Main() => new Application().Run(new ReaderWindow());

    private ReaderWindow()
    {
        Title = "Video Transcript · WPF 验证";
        Width = 1200;
        Height = 820;
        MinWidth = 820;
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
                "VideoTranscript", "WebView2");
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
                case "open-folder":
                    OpenFolder();
                    break;
                case "open-path":
                    OpenFromFolder(request.GetProperty("path").GetString());
                    break;
                case "open":
                    if (args.AdditionalObjects.FirstOrDefault() is not CoreWebView2File file)
                        throw new InvalidOperationException("无法取得所选视频的本地路径。");
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
            Send(new { kind = "status", message = error.Message, busy = false });
        }
    }

    private void OpenFolder()
    {
        var picker = new OpenFolderDialog { Title = "选择包含 MP4 和标准字幕的文件夹" };
        if (picker.ShowDialog(this) != true) return;
        selectedFolder = Path.GetFullPath(picker.FolderName);
        var videos = Directory.EnumerateFiles(selectedFolder, "*", SearchOption.TopDirectoryOnly)
            .Where(path => string.Equals(Path.GetExtension(path), ".mp4", StringComparison.OrdinalIgnoreCase))
            .OrderBy(path => Path.GetFileName(path), StringComparer.CurrentCultureIgnoreCase)
            .Select(path => new { name = Path.GetFileName(path), path })
            .ToArray();
        Send(new { kind = "folder", folder = selectedFolder, videos });
    }

    private void OpenFromFolder(string? candidate)
    {
        if (selectedFolder == null || string.IsNullOrWhiteSpace(candidate))
            throw new InvalidOperationException("请先选择文件夹。");
        var full = Path.GetFullPath(candidate);
        if (!string.Equals(Path.GetDirectoryName(full), selectedFolder, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("只能打开已选择文件夹中的 MP4 文件。");
        OpenPair(full, useMappedMedia: true);
    }

    private void OpenPair(string video, bool useMappedMedia = false)
    {
        if (!string.Equals(Path.GetExtension(video), ".mp4", StringComparison.OrdinalIgnoreCase) || !File.Exists(video))
            throw new FileNotFoundException("请选择本地 MP4 文件。");
        var subtitle = Path.Combine(Path.GetDirectoryName(video)!, Path.GetFileNameWithoutExtension(video) + ".video-transcript.json");
        if (!File.Exists(subtitle))
            throw new FileNotFoundException("找不到同目录的 Video Transcript 标准字幕文件（<视频文件名>.video-transcript.json）。请先使用 docs/skills/video-transcript-paragraphs Skill 处理 WhisperX JSON。");

        var bytes = File.ReadAllBytes(subtitle);
        var transcript = Encoding.UTF8.GetString(bytes).TrimStart('\uFEFF');
        // Reject raw WhisperX before opening media; this check complements the
        // full strict word-boundary validation in TypeScript and the CLI.
        using (var parsed = JsonDocument.Parse(transcript))
        {
            var root = parsed.RootElement;
            if (!root.TryGetProperty("language", out var language) || language.GetString() != "en" ||
                !root.TryGetProperty("video_transcript", out var meta) || meta.ValueKind != JsonValueKind.Object ||
                !meta.TryGetProperty("format", out var format) || format.GetString() != "video-transcript" ||
                !meta.TryGetProperty("schemaVersion", out var version) || version.GetInt32() != 2 ||
                root.TryGetProperty("evr", out _) || root.TryGetProperty("paragraphs", out _) || root.TryGetProperty("paragraphBreaksAfter", out _))
                throw new InvalidOperationException("字幕不是 Video Transcript v2 标准格式。请先运行 docs/skills/video-transcript-paragraphs Skill。");
        }
        var fingerprint = Convert.ToHexString(SHA256.HashData(bytes));
        var folder = Path.GetDirectoryName(video)!;
        var projectPath = Path.Combine(folder, ".video-transcript", "projects",
            Path.GetFileNameWithoutExtension(video) + ".project.json");
        source = new Source(video, subtitle, fingerprint, projectPath);
        string? videoUrl = null;
        if (useMappedMedia)
        {
            const string mediaHost = "media.video-transcript.local";
            view.CoreWebView2.SetVirtualHostNameToFolderMapping(mediaHost, folder, CoreWebView2HostResourceAccessKind.AllowCors);
            videoUrl = $"https://{mediaHost}/{Uri.EscapeDataString(Path.GetFileName(video))}";
        }
        Send(new
        {
            kind = "pair",
            videoName = Path.GetFileName(video),
            subtitleName = Path.GetFileName(subtitle),
            videoUrl,
            transcript,
            fingerprint,
            project = File.Exists(projectPath) ? File.ReadAllText(projectPath) : null
        });
    }

    private Source CheckSource(JsonElement project)
    {
        var current = source ?? throw new InvalidOperationException("请先打开素材。");
        if (!project.TryGetProperty("format", out var projectFormat) || projectFormat.GetString() != "video-transcript-project" ||
            !project.TryGetProperty("schemaVersion", out var schema) || schema.ValueKind != JsonValueKind.Number || schema.GetInt32() != 2)
            throw new InvalidOperationException("不支持的工程版本：必须为 Video Transcript Project v2。");
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

        var folder = Path.Combine(Path.GetDirectoryName(current.Video)!, "exports");
        Directory.CreateDirectory(folder);
        var stem = Path.GetFileNameWithoutExtension(current.Video) + "_reading";
        var output = Path.Combine(folder, stem + ".mp4");
        for (var version = 2; File.Exists(output); version++)
            output = Path.Combine(folder, $"{stem}_{version}.mp4");

        exporting = true;
        string? snapshot = null;
        string? pagePlanSnapshot = null;
        var pending = Path.Combine(folder, $".video-transcript-{Guid.NewGuid():N}.mp4");
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
                "--video", current.Video, "--json", current.Transcript, "--project", snapshot,
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

            var evidence = Environment.GetEnvironmentVariable("VIDEO_TRANSCRIPT_M1_EVIDENCE");
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
