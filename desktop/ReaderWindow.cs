using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Security.Cryptography;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
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
    private LocalMediaServer? mediaServer;
    private TaskCompletionSource<bool>? pendingDependencyDecision;
    private long pendingDependencyDecisionId;
    // Active only during application-owned dependency preparation; never cancel arbitrary Node processes.
    private CancellationTokenSource? dependencyInstallCancellation;
    private readonly string settingsFile = Path.Combine(AppContext.BaseDirectory, "voicetranscript.settings.json");
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
    private static readonly object DefaultSettings = new
    {
        format = "voicetranscript-settings", schemaVersion = 1,
        leftFont = new { family = "Arial", size = 40, color = "#293847", highlightColor = "#B81A35" },
        rightFont = new { family = "Arial", size = 16, color = "#293847", backgroundColor = "#F7F4EC" },
        paragraph = new { firstLineIndentEm = 2, lineHeight = 1.4, gap = 20, alignment = "justify" },
        page = new { paddingY = 30, paddingX = 36, backgroundColor = "#F7F4EC" },
        output = new { width = 1200, height = 1600 }
    };


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
        Closing += (_, args) => { args.Cancel = exporting; if (!args.Cancel) pendingDependencyDecision?.TrySetResult(false); };
        Closed += (_, _) => view.Dispose();
    }

    private async void Initialize(object? sender, EventArgs args)
    {
        ContentRendered -= Initialize;
        try
        {
            var ui = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "TranscriptStudio", "ui", typeof(ReaderWindow).Assembly.GetName().Version?.ToString() ?? "1");
            ExtractResources("TSUI/", ui);
            // Configuration is intentionally portable: it always lives next to the EXE.
            LoadOrCreateSettings();
            if (!File.Exists(Path.Combine(ui, "index.html")))
                throw new FileNotFoundException("缺少打包后的界面。请先运行前端构建。");

            var profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "TranscriptStudio", "WebView2");
            try { _ = CoreWebView2Environment.GetAvailableBrowserVersionString(); }
            catch (Exception e) { throw new InvalidOperationException(
                "缺少 Microsoft Edge WebView2 Runtime。请自行安装：https://developer.microsoft.com/microsoft-edge/webview2/ 。安装后重新启动。", e); }
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: profile);
            await view.EnsureCoreWebView2Async(environment);
            var browser = view.CoreWebView2;
            browser.SetVirtualHostNameToFolderMapping(AppHost, ui, CoreWebView2HostResourceAccessKind.DenyCors);
            browser.NavigationStarting += (_, e) => e.Cancel = e.Uri != AppUrl;
            browser.NewWindowRequested += (_, e) => e.Handled = true;
            browser.WebMessageReceived += Receive;
            // Register the media request handler before the page is first loaded.
            mediaServer = new LocalMediaServer(browser);
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
        if (args.Source != AppUrl)
            return;

        try
        {
            using var message = JsonDocument.Parse(args.WebMessageAsJson);
            var request = message.RootElement;
            var kind = request.GetProperty("kind").GetString();
            // Replies must be accepted while exporting; other commands stay blocked.
            if (kind == "dependency-decision")
            {
                var id = request.GetProperty("id").GetInt64();
                if (pendingDependencyDecision != null && id == pendingDependencyDecisionId)
                    pendingDependencyDecision.TrySetResult(request.GetProperty("accepted").GetBoolean());
                return;
            }
            if (kind == "dependency-cancel")
            {
                // Cancellation must remain routable while ExportAsync is awaiting the installer.
                if (exporting && dependencyInstallCancellation is { IsCancellationRequested: false } active)
                {
                    active.Cancel();
                    Send(new { kind = "dependency-cancelling" });
                }
                return;
            }
            if (exporting) return;
            switch (kind)
            {
                case "ready":
                    Send(new { kind = "settings", settings = JsonDocument.Parse(LoadOrCreateSettings()).RootElement });
                    break;
                case "settings-save":
                    SaveSettings(request.GetProperty("settings"));
                    break;
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
        catch (OperationCanceledException)
        {
            Send(new { kind = "dependency-end" });
            Send(new { kind = "status", message = "已取消导出环境准备。", busy = false });
        }
        catch (Exception error)
        {
            Send(new { kind = "dependency-failed", message = error.Message });
            Send(new { kind = "status", message = error.Message, busy = false, error = true });
        }
    }

    private async Task<bool> ConfirmDependencyAsync(string title, string heading, string details, string action)
    {
        if (pendingDependencyDecision != null) throw new InvalidOperationException("已有待处理的安装确认。");
        var pending = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        pendingDependencyDecision = pending;
        var id = ++pendingDependencyDecisionId;
        try
        {
            Send(new { kind = "dependency-confirm", id, title, heading, details, action });
            return await pending.Task;
        }
        finally { if (ReferenceEquals(pendingDependencyDecision, pending)) pendingDependencyDecision = null; }
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

    private static void ExtractResources(string prefix, string destination)
    {
        var assembly = typeof(ReaderWindow).Assembly;
        var resources = assembly.GetManifestResourceNames().Where(n => n.StartsWith(prefix, StringComparison.Ordinal)).ToArray();
        if (resources.Length == 0) throw new FileNotFoundException($"发布包缺少嵌入资源：{prefix}。请先构建前端并重新发布。");
        foreach (var name in resources)
        {
            var relative = name[prefix.Length..].Replace('/', Path.DirectorySeparatorChar);
            var target = Path.GetFullPath(Path.Combine(destination, relative));
            var safeRoot = Path.GetFullPath(destination) + Path.DirectorySeparatorChar;
            if (!target.StartsWith(safeRoot, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("非法内嵌资源路径。");
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            // Embedded UI files are immutable for a given application version.
            using var input = assembly.GetManifestResourceStream(name) ?? throw new FileNotFoundException(name);
            using var output = new FileStream(target, FileMode.Create, FileAccess.Write, FileShare.None);
            input.CopyTo(output);
        }
    }

    private string LoadOrCreateSettings()
    {
        if (File.Exists(settingsFile))
        {
            var content = File.ReadAllText(settingsFile);
            try
            {
                using var json = JsonDocument.Parse(content);
                if (ValidSettings(json.RootElement)) return content;
                // Partial settings files are forward-filled from the current defaults.
                if (JsonNode.Parse(content) is JsonObject candidate &&
                    JsonNode.Parse(JsonSerializer.Serialize(DefaultSettings)) is JsonObject fallback)
                {
                    FillMissing(candidate, fallback);
                    var merged = candidate.ToJsonString(JsonOptions);
                    using var mergedDoc = JsonDocument.Parse(merged);
                    if (ValidSettings(mergedDoc.RootElement))
                    {
                        AtomicWrite(settingsFile, merged);
                        return merged;
                    }
                }
            }
            catch (JsonException) { /* preserve invalid file for inspection */ }
            var backup = settingsFile + ".invalid-" + DateTime.Now.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture);
            File.Move(settingsFile, backup, overwrite: true);
            MessageBox.Show(this, $"配置格式无效，已备份至：{backup}。将重新生成默认设置。", "配置已重置");
        }
        var defaults = JsonSerializer.Serialize(DefaultSettings, JsonOptions);
        AtomicWrite(settingsFile, defaults);
        return defaults;
    }
    private static void FillMissing(JsonObject target, JsonObject defaults)
    {
        foreach(var entry in defaults)
        {
            if(!target.ContainsKey(entry.Key)) target[entry.Key]=entry.Value?.DeepClone();
            else if(target[entry.Key] is JsonObject child && entry.Value is JsonObject defaultChild)
                FillMissing(child,defaultChild);
        }
    }
    private static bool ValidSettings(JsonElement root)
    {
        try
        {
            if (root.GetProperty("format").GetString() != "voicetranscript-settings" || root.GetProperty("schemaVersion").GetInt32() != 1) return false;
            var lf = root.GetProperty("leftFont"); var rf = root.GetProperty("rightFont");
            static bool Color(string? s) => s is not null && System.Text.RegularExpressions.Regex.IsMatch(s, "^#[a-fA-F0-9]{6}$");
            static bool Font(JsonElement e) => new[] { "Arial", "Nunito Sans", "Segoe UI" }.Contains(e.GetString());
            static bool Range(JsonElement e, int lo, int hi) => e.ValueKind == JsonValueKind.Number && e.TryGetInt32(out int x) && x >= lo && x <= hi;
            if (!Font(lf.GetProperty("family")) || !Range(lf.GetProperty("size"), 1, 99) || !Color(lf.GetProperty("color").GetString()) || !Color(lf.GetProperty("highlightColor").GetString()) ||
                !Font(rf.GetProperty("family")) || !Range(rf.GetProperty("size"), 1, 99) || !Color(rf.GetProperty("color").GetString()) || !Color(rf.GetProperty("backgroundColor").GetString())) return false;
            var paragraph = root.GetProperty("paragraph"); var page = root.GetProperty("page"); var output = root.GetProperty("output");
            if (!Range(paragraph.GetProperty("firstLineIndentEm"),0,9) || !new[] { 1.2, 1.3, 1.4, 1.5 }.Any(n => Math.Abs(n-paragraph.GetProperty("lineHeight").GetDouble())<0.000001) ||
                !Range(paragraph.GetProperty("gap"),0,99) || !new[]{"justify","left"}.Contains(paragraph.GetProperty("alignment").GetString()) ||
                !Range(page.GetProperty("paddingX"),0,99) || !Range(page.GetProperty("paddingY"),0,99) || !Color(page.GetProperty("backgroundColor").GetString())) return false;
            var w = output.GetProperty("width"); var h = output.GetProperty("height");
            return Range(w,320,3840) && Range(h,320,3840) && w.GetInt32()%2==0 && h.GetInt32()%2==0;
        }
        catch (Exception e) when (e is KeyNotFoundException or InvalidOperationException or FormatException) { return false; }
    }
    private static void AtomicWrite(string file, string content)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        var temp = file + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            File.WriteAllText(temp, content, new UTF8Encoding(false));
            if (File.Exists(file)) File.Move(temp, file, overwrite: true);
            else File.Move(temp, file);
        }
        finally { if (File.Exists(temp)) File.Delete(temp); }
    }
    private void SaveSettings(JsonElement settings)
    {
        if (!ValidSettings(settings)) throw new InvalidDataException("全局设置验证失败，未保存。");
        AtomicWrite(settingsFile, JsonSerializer.Serialize(settings, JsonOptions));
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
            throw new FileNotFoundException($"未找到同名媒体。字幕：{filename}；所在目录：{folder}；尝试查找：{string.Join("、", new[] { ".mp4", ".mkv", ".mp3", ".wav" }.Select(ext => stem + ext))}。请核对文件名。");

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
        var projectPath = Path.Combine(folder, ".transcript-studio", "projects", stem, "project.settings.json");
        // A per-file URL with HTTP Range support replaces the late folder mapping.
        var mediaUrl = (mediaServer ?? throw new InvalidOperationException("媒体服务未初始化。")).Select(media);
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
        if (!project.TryGetProperty("source", out var projectSource) ||
            projectSource.ValueKind != JsonValueKind.Object ||
            !projectSource.TryGetProperty("videoName", out var mediaName) ||
            mediaName.ValueKind != JsonValueKind.String ||
            !string.Equals(mediaName.GetString(), Path.GetFileName(current.Media), StringComparison.OrdinalIgnoreCase) ||
            !projectSource.TryGetProperty("subtitleName", out var subtitleName) ||
            subtitleName.ValueKind != JsonValueKind.String ||
            !string.Equals(subtitleName.GetString(), Path.GetFileName(current.Transcript), StringComparison.OrdinalIgnoreCase) ||
            !projectSource.TryGetProperty("subtitleSha256", out var sha) ||
            sha.ValueKind != JsonValueKind.String ||
            !string.Equals(sha.GetString(), current.Fingerprint, StringComparison.OrdinalIgnoreCase) ||
            Fingerprint(current.Transcript) != current.Fingerprint)
            throw new InvalidOperationException("工程来源与当前媒体或字幕不匹配，请重新打开素材。");
        if (project.TryGetProperty("mediaKind", out var mediaKind) &&
            (mediaKind.ValueKind != JsonValueKind.String || mediaKind.GetString() != current.MediaKind))
            throw new InvalidOperationException("工程媒体类型与当前文件不匹配。");
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

    private async Task<string> PrepareExportRuntimeAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var runtime = Path.Combine(AppContext.BaseDirectory, "runtime");
        // The application does not install system-wide .NET, WebView2 or Node.js.
        var node = await ProbeExecutableAsync("node.exe", "--version");
        var npm = await ProbeExecutableAsync("npm.cmd", "--version");
        if (node is null || npm is null)
            throw new InvalidOperationException("视频导出需要 Node.js（含 npm）。请自行前往 https://nodejs.org/en/download 安装兼容版本，安装后重试导出。");
        if (!node.StartsWith("v", StringComparison.OrdinalIgnoreCase) ||
            !int.TryParse(node[1..].Split('.')[0],out var major) || major<22)
            throw new InvalidOperationException($"Node.js 版本不符合要求（检测到 {node}）。请自行安装 Node.js 22 或更高的受支持版本。");

        var packageLock = Path.Combine(runtime, "package-lock.json");
        ExtractResources("TSRUNTIME/", runtime);
        var checksum = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(packageLock)));
        var marker = Path.Combine(runtime,".modules-lock-sha256");
        var moduleReady = File.Exists(marker) && File.ReadAllText(marker) == checksum &&
            File.Exists(Path.Combine(runtime,"node_modules","@remotion","renderer","package.json")) &&
            File.Exists(Path.Combine(runtime,"node_modules","@remotion","bundler","package.json"));
        if (!moduleReady)
        {
            if (!await ConfirmDependencyAsync(
                "安装视频导出模块", "视频导出组件尚未安装",
                "Transcript Studio 将通过 npm 官方软件包仓库安装所需的视频导出模块。此操作需要网络连接，可能持续一段时间。",
                "安装模块"))
                throw new OperationCanceledException();
            cancellationToken.ThrowIfCancellationRequested();
            Send(new { kind="dependency-progress", title="正在安装视频导出模块", message="正在通过 npm 安装 Transcript Studio 的视频导出依赖……" });
            Send(new { kind="status",message="正在准备视频导出依赖（npm ci）…",busy=true });
            var staging = Path.Combine(runtime,".npm-install-"+Guid.NewGuid().ToString("N"));
            var activeModules = Path.Combine(runtime,"node_modules");
            var backupModules = Path.Combine(runtime,".node_modules-backup-"+Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(staging);
            try
            {
                File.Copy(Path.Combine(runtime,"package.json"),Path.Combine(staging,"package.json"));
                File.Copy(packageLock,Path.Combine(staging,"package-lock.json"));
                var install = await RunDependencyCommandAsync("npm.cmd", staging, ["ci", "--no-audit", "--no-fund", "--registry=https://registry.npmjs.org/"],timeoutMs:900000,cancellationToken:cancellationToken);
                cancellationToken.ThrowIfCancellationRequested();
                if (install.ExitCode != 0)
                    throw new InvalidOperationException("npm 模块安装失败：" + install.Output[^Math.Min(2000,install.Output.Length)..]);
                if (!File.Exists(Path.Combine(staging,"node_modules","@remotion","renderer","package.json")) ||
                    !File.Exists(Path.Combine(staging,"node_modules","@remotion","bundler","package.json")))
                    throw new InvalidDataException("npm 安装结果缺少必须的 Remotion 模块。");
                cancellationToken.ThrowIfCancellationRequested();
                var hadModules=Directory.Exists(activeModules);
                if(hadModules) Directory.Move(activeModules,backupModules);
                try { Directory.Move(Path.Combine(staging,"node_modules"),activeModules); }
                catch
                {
                    if(hadModules&&Directory.Exists(backupModules)&&!Directory.Exists(activeModules))
                        Directory.Move(backupModules,activeModules);
                    throw;
                }
                AtomicWrite(marker,checksum);
                File.Delete(Path.Combine(runtime,".browser-ready"));
                if(Directory.Exists(backupModules))Directory.Delete(backupModules,recursive:true);
            }
            finally
            {
                if(Directory.Exists(staging))Directory.Delete(staging,recursive:true);
            }
        }
        var browserMarker = Path.Combine(runtime,".browser-ready");
        if (!File.Exists(browserMarker) || File.ReadAllText(browserMarker) != checksum)
        {
            if (!await ConfirmDependencyAsync(
                "准备导出浏览器", "需要准备专用渲染浏览器",
                "Remotion 将下载视频导出专用的 Chrome Headless Shell。不会安装或替换系统浏览器。此操作需要网络连接。",
                "准备浏览器"))
                throw new OperationCanceledException();
            cancellationToken.ThrowIfCancellationRequested();
            Send(new { kind="dependency-progress", title="正在准备导出浏览器", message="正在检查并下载 Remotion 专用浏览器……" });
            Send(new { kind="status",message="正在检查并准备 Remotion 专用浏览器…",busy=true });
            var browser = await RunDependencyCommandAsync("node.exe",runtime,["scripts/ensure-browser.mjs"],timeoutMs:900000,cancellationToken:cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            if(browser.ExitCode!=0) throw new InvalidOperationException("Remotion 浏览器准备失败：" + browser.Output[^Math.Min(2000,browser.Output.Length)..]);
            AtomicWrite(browserMarker,checksum);
        }
        return runtime;
    }

    private static async Task<string?> ProbeExecutableAsync(string name,string arg)
    {
        try
        {
            var result=await RunDependencyCommandAsync(name,AppContext.BaseDirectory,[arg],timeoutMs:12000);
            return result.ExitCode==0?result.Output.Trim().Split('\n').FirstOrDefault()?.Trim():null;
        }
        catch {return null;}
    }
    private static async Task<(int ExitCode,string Output)> RunDependencyCommandAsync(string exe,string folder,string[] args,int timeoutMs=300000,CancellationToken cancellationToken=default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var isBatch = exe.EndsWith(".cmd",StringComparison.OrdinalIgnoreCase);
        var info=new ProcessStartInfo(isBatch?"cmd.exe":exe){WorkingDirectory=folder,UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true};
        if(isBatch){info.ArgumentList.Add("/d");info.ArgumentList.Add("/c");info.ArgumentList.Add(exe);}
        foreach(var arg in args)info.ArgumentList.Add(arg);
        using var process=Process.Start(info)??throw new IOException("无法启动进程："+exe);
        var standard=process.StandardOutput.ReadToEndAsync();
        var errors=process.StandardError.ReadToEndAsync();
        using var timeout = new CancellationTokenSource(timeoutMs);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(timeout.Token,cancellationToken);
        try { await process.WaitForExitAsync(linked.Token); }
        catch (OperationCanceledException)
        {
            // Kill only this installation process tree, including npm.cmd's child node processes.
            try { if (!process.HasExited) process.Kill(entireProcessTree:true); } catch (InvalidOperationException) { }
            try { await process.WaitForExitAsync(); } catch (InvalidOperationException) { }
            // Always drain redirected streams after termination so pipes and handles are released.
            try { await Task.WhenAll(standard,errors); } catch (IOException) { }
            if (cancellationToken.IsCancellationRequested) throw new OperationCanceledException(cancellationToken);
            throw new TimeoutException("依赖准备操作超时，请检查网络或安装状态。");
        }
        cancellationToken.ThrowIfCancellationRequested();
        var combined=(await standard)+"\n"+(await errors);
        return (process.ExitCode,combined);
    }

    private async Task ExportAsync(JsonElement request)
    {
        var project = request.GetProperty("project");
        var current = CheckSource(project);
        var folder = Path.Combine(Path.GetDirectoryName(current.Media)!, "exports");
        Directory.CreateDirectory(folder);
        var stem = Path.GetFileNameWithoutExtension(current.Media) + "_reading";
        var output = Path.Combine(folder, stem + ".mp4");
        for (var version = 2; File.Exists(output); version++)
            output = Path.Combine(folder, $"{stem}_{version}.mp4");

        exporting = true;
        using var installCancellation = new CancellationTokenSource();
        dependencyInstallCancellation = installCancellation;
        string? snapshot = null;
        string? pagePlanSnapshot = null;
        var pending = Path.Combine(folder, $".transcript-studio-{Guid.NewGuid():N}.mp4");
        try
        {
            Send(new { kind = "status", message = "正在准备导出…", busy = true });
            var runtime = await PrepareExportRuntimeAsync(installCancellation.Token);
            dependencyInstallCancellation = null;
            Send(new { kind = "dependency-end" });
            snapshot = Path.GetTempFileName();
            await File.WriteAllTextAsync(snapshot, project.GetRawText());
            if (request.TryGetProperty("pagePlan", out var pagePlan))
            {
                pagePlanSnapshot = Path.GetTempFileName();
                await File.WriteAllTextAsync(pagePlanSnapshot, pagePlan.GetRawText());
            }

            var start = new ProcessStartInfo("node.exe")
            {
                WorkingDirectory = runtime,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardErrorEncoding = Encoding.UTF8
            };
            string[] arguments = [
                Path.Combine(runtime, "scripts", "export.mjs"),
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
            dependencyInstallCancellation = null;
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
