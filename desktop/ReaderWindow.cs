using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Security.Cryptography;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Web.WebView2.Core;
using TranscriptStudio.AppLifecycle;
using TranscriptStudio.Export;
using TranscriptStudio.UI;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Wpf;
using Button = System.Windows.Controls.Button;
using Orientation = System.Windows.Controls.Orientation;

namespace TranscriptStudio;

internal sealed class ReaderWindow : Window
{
    private const string AppHost = "reader.transcript-studio.local";
    private const string AppUrl = "https://" + AppHost + "/index.html";
    private readonly WebView2 view = new();
    private readonly TrayIconManager trayIcon;
    private Source? source;
    private readonly ExportTaskManager exportTasks = new();
    private readonly ExportProcessManager exportProcesses = new();
    private bool isShuttingDown;
    private bool isMinimizingToTray;
    private bool isCloseConfirmationOpen;
    private bool exporting => exportTasks.IsBusy;
    // A discovered project cannot be overwritten until the front end validates it.
    private bool projectSaveLocked;
    private bool hasUnsavedChanges;
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
    private static void Main()
    {
        using var singleInstance = new SingleInstanceManager();
        if (!singleInstance.TryBecomePrimaryOrActivate()) return;

        var application = new System.Windows.Application
        {
            // The tray menu is a temporary auxiliary window. Only closing the
            // designated reader window is allowed to end the WPF message loop.
            ShutdownMode = ShutdownMode.OnMainWindowClose
        };

        application.DispatcherUnhandledException += (_, e) =>
            AppLog.WriteException("DispatcherUnhandledException", e.Exception);
        AppDomain.CurrentDomain.UnhandledException += (_, e) =>
        {
            if (e.ExceptionObject is Exception error)
                AppLog.WriteException("UnhandledException", error);
            else
                AppLog.Write("UnhandledException", Convert.ToString(e.ExceptionObject) ?? "Unknown exception.");
        };
        TaskScheduler.UnobservedTaskException += (_, e) =>
            AppLog.WriteException("UnobservedTaskException", e.Exception);

        var window = new ReaderWindow();
        application.MainWindow = window;
        singleInstance.StartListening(() =>
        {
            var dispatcher = application.Dispatcher;
            if (dispatcher.HasShutdownStarted || dispatcher.HasShutdownFinished) return;
            try
            {
                dispatcher.BeginInvoke(new Action(window.ActivateFromTray), DispatcherPriority.Normal);
            }
            catch (InvalidOperationException error)
            {
                AppLog.WriteException("SingleInstance.DispatchActivation", error);
            }
        });

        AppLog.Write("Application", "Primary instance started.");
        application.Exit += (_, _) => AppLog.Write("Application", "WPF application exited.");
        application.Run(window);
        AppLog.Write("Application", "WPF message loop returned.");
    }

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
        trayIcon = new TrayIconManager(this, ActivateFromTray, Close);
        AppLog.Write("Window", "Main reader window constructed.");
        StateChanged += (_, _) =>
        {
            if (isShuttingDown || isMinimizingToTray || WindowState != WindowState.Minimized)
                return;

            isMinimizingToTray = true;
            try
            {
                AppLog.Write("Window", "Main window minimized to tray.");
                WindowState = WindowState.Normal;
                ShowInTaskbar = false;
                Hide();
            }
            finally
            {
                isMinimizingToTray = false;
            }
        };
        Closing += OnClosing;
        Closed += (_, _) =>
        {
            AppLog.Write("Window", "Main window closed; disposing application resources.");
            DisposeSafely("TrayIconManager", trayIcon.Dispose);
            DisposeSafely("ExportTaskManager", exportTasks.Dispose);
            if (mediaServer is not null)
                DisposeSafely("LocalMediaServer", mediaServer.Dispose);
            DisposeSafely("WebView2", view.Dispose);
        };
    }

    internal void ActivateFromTray()
    {
        if (!Dispatcher.CheckAccess())
        {
            if (!Dispatcher.HasShutdownStarted && !Dispatcher.HasShutdownFinished)
                Dispatcher.BeginInvoke(new Action(ActivateFromTray), DispatcherPriority.Normal);
            return;
        }

        if (isShuttingDown || Dispatcher.HasShutdownStarted || Dispatcher.HasShutdownFinished)
            return;

        try
        {
            AppLog.Write("Window", $"Restoring main window from tray. Visible={IsVisible}; State={WindowState}; Active={IsActive}.");
            ShowInTaskbar = true;

            if (WindowState != WindowState.Normal)
                WindowState = WindowState.Normal;

            if (!IsVisible)
                Show();

            // A temporary WPF Topmost toggle raises the existing window in the
            // z-order without leaving it permanently above other applications.
            var wasTopmost = Topmost;
            Topmost = true;
            Topmost = wasTopmost;

            var activated = Activate();
            AppLog.Write("Window", $"Tray restore completed. Visible={IsVisible}; State={WindowState}; Active={IsActive}; Activate={activated}; Topmost={Topmost}.");
        }
        catch (InvalidOperationException error)
        {
            AppLog.WriteException("Window.ActivateFromTray", error);
        }
    }

    private static void DisposeSafely(string resourceName, Action dispose)
    {
        try { dispose(); }
        catch (Exception error) { AppLog.WriteException($"Dispose.{resourceName}", error); }
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
            FluentDialog.ShowMessage(this, "启动失败", error.Message, icon: FluentDialogIcon.Error);
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
            // Cancellation and independent UI-state updates remain available while exporting.
            if (kind == "dependency-decision")
            {
                var id = request.GetProperty("id").GetInt64();
                if (pendingDependencyDecision != null && id == pendingDependencyDecisionId)
                    pendingDependencyDecision.TrySetResult(request.GetProperty("accepted").GetBoolean());
                return;
            }
            if (kind == "export-cancel")
            {
                if (exportTasks.Active?.Status == ExportStatus.Committing)
                {
                    Send(new { kind = "status", message = "视频正在保存，当前提交完成后即可结束任务。", busy = true, canCancel = false });
                    return;
                }
                if (exportTasks.IsBusy)
                {
                    exportTasks.RequestCancel(shutdown: false);
                    pendingDependencyDecision?.TrySetResult(false);
                    Send(new { kind = "export-cancelling" });
                }
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
            if (kind == "dirty-state")
            {
                hasUnsavedChanges = request.GetProperty("dirty").GetBoolean();
                UpdateWindowTitle();
                return;
            }
            if (kind == "settings-save")
            {
                // Global settings are independent of the immutable export snapshot.
                SaveSettings(request.GetProperty("settings"));
                return;
            }
            if (kind == "layout")
            {
                // Native window constraints may follow settings changes while rendering.
                UpdateWindowLayout(request);
                return;
            }
            if (exporting) return;
            switch (kind)
            {
                case "ready":
                    Send(new { kind = "settings", settings = JsonDocument.Parse(LoadOrCreateSettings()).RootElement });
                    break;
                case "open":
                    if (args.AdditionalObjects.FirstOrDefault() is not CoreWebView2File file)
                        throw new InvalidOperationException("无法获取 JSON 文件的本地路径。");
                    OpenPair(file.Path);
                    break;
                case "project-validated":
                    if (source != null && projectSaveLocked &&
                        request.GetProperty("fingerprint").GetString() == source.Fingerprint &&
                        string.Equals(request.GetProperty("subtitleName").GetString(), Path.GetFileName(source.Transcript), StringComparison.OrdinalIgnoreCase))
                        projectSaveLocked = false;
                    break;
                case "save":
                    SaveProject(request.GetProperty("project"), request.GetProperty("revision").GetInt64());
                    break;
                case "export-text":
                    ExportPlainText(request.GetProperty("text"));
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
            // A rejected settings-save message can arrive during an active export.
            // Preserve the real task state so a settings error cannot hide its progress UI.
            Send(new { kind = "status", message = error.Message, busy = exportTasks.IsBusy, error = true });
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
            var backup = settingsFile + ".invalid-" + DateTime.Now.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture) + "-" + Guid.NewGuid().ToString("N")[..8];
            File.Move(settingsFile, backup);
            FluentDialog.ShowMessage(this, "配置已重置", $"配置格式无效，已备份至：{backup}。将重新生成默认设置。", icon: FluentDialogIcon.Warning);
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
        if (string.IsNullOrWhiteSpace(stem) || stem is "." or "..")
            throw new InvalidDataException("标准字幕文件缺少有效名称。");
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
        // M6.12 is a breaking storage-layout change: do not search or migrate legacy projects.
        var workFolder = Path.Combine(folder, stem);
        var projectPath = Path.Combine(workFolder, stem + ".project.json");
        if (File.Exists(workFolder))
            throw new IOException($"工程工作目录被同名文件占用：{workFolder}");
        if (Directory.Exists(projectPath))
            throw new IOException($"工程文件路径被同名文件夹占用：{projectPath}");
        // Read the project before switching the active media token/source. If the
        // project is inaccessible, the previously loaded pair remains usable.
        var projectContent = File.Exists(projectPath) ? File.ReadAllText(projectPath) : null;
        var mediaUrl = (mediaServer ?? throw new InvalidOperationException("媒体服务未初始化。")).Select(media);
        source = new Source(media, subtitle, fingerprint, projectPath, mediaKind);
        projectSaveLocked = projectContent != null;
        Send(new
        {
            kind = "pair", mediaName = Path.GetFileName(media), mediaKind, subtitleName = filename,
            mediaUrl, transcript, fingerprint, project = projectContent
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

    private void UpdateWindowTitle()
    {
        Title = hasUnsavedChanges ? "Transcript Studio ●" : "Transcript Studio";
    }

    private void SaveProject(JsonElement project, long revision)
    {
        if (projectSaveLocked)
            throw new InvalidOperationException("现有工程文件未能通过验证，已禁止覆盖。请检查工程文件后重新打开素材。");
        var current = CheckSource(project);
        AtomicWrite(current.Project, project.GetRawText());
        Send(new { kind = "saved", revision, message = $"工程已保存至 {current.Project}" });
    }

    private void ExportPlainText(JsonElement content)
    {
        try
        {
            var current = source ?? throw new InvalidOperationException("请先打开字幕和媒体文件。");
            if (content.ValueKind != JsonValueKind.String)
                throw new InvalidOperationException("导出的正文内容无效。");
            var text = content.GetString() ?? string.Empty;
            if (string.IsNullOrEmpty(text))
                throw new InvalidOperationException("没有可导出的正文文本。");

            // Same source-derived work directory as the project; no SaveFileDialog.
            var workFolder = Path.GetDirectoryName(current.Project)!;
            // The project filename is <stem>.project.json: remove the entire suffix.
            var stem = Path.GetFileName(current.Project)[..^".project.json".Length];
            var articlePath = Path.Combine(workFolder, stem + ".article.txt");
            // Preserve punctuation, casing and spaces; normalize line endings to Windows CRLF.
            var windowsText = text.Replace("\r\n", "\n").Replace('\r', '\n').Replace("\n", "\r\n");
            AtomicWrite(articlePath, windowsText); // UTF-8 without BOM, staged replacement.
            Send(new { kind = "text-exported", message = $"正文已导出至 {articlePath}" });
        }
        catch (Exception error)
        {
            Send(new { kind = "text-export-error", message = $"正文导出失败：{error.Message}" });
        }
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

    private async void OnClosing(object? sender, System.ComponentModel.CancelEventArgs args)
    {
        AppLog.Write("Window", $"Closing requested. IsShuttingDown={isShuttingDown}; ExportBusy={exportTasks.IsBusy}.");
        if (isShuttingDown)
        {
            // A second close request must not bypass the first request's asynchronous
            // export cancellation/commit wait.
            if (exportTasks.IsBusy) args.Cancel = true;
            return;
        }

        if (isCloseConfirmationOpen)
        {
            args.Cancel = true;
            return;
        }

        if (exportTasks.IsBusy)
        {
            args.Cancel = true;
            var wasVisible = IsVisible;
            var isCommitting = exportTasks.Active?.Status == ExportStatus.Committing;
            bool shouldExit;
            isCloseConfirmationOpen = true;
            try { shouldExit = ConfirmCancelExportAndExit(isCommitting, wasVisible); }
            finally { isCloseConfirmationOpen = false; }

            if (!shouldExit)
            {
                AppLog.Write("Window", "Close cancelled; export continues.");
                return;
            }

            if (hasUnsavedChanges)
            {
                bool discardChanges;
                isCloseConfirmationOpen = true;
                try { discardChanges = ConfirmDiscardUnsavedChanges(); }
                finally { isCloseConfirmationOpen = false; }
                if (!discardChanges)
                {
                    AppLog.Write("Window", "Close cancelled; unsaved project changes are retained and export continues.");
                    return;
                }
            }

            isShuttingDown = true;
            AppLog.Write("Window", "Shutdown accepted; requesting export cancellation or commit completion.");
            exportTasks.RequestCancel(shutdown: true);
            pendingDependencyDecision?.TrySetResult(false);

            // The export handler owns process termination and cache cleanup. Wait for it
            // to finish before closing WPF resources and ending the message loop.
            while (exportTasks.IsBusy)
                await Task.Delay(100);

            AppLog.Write("Window", "Export task finished; closing main window.");
            Close();
            return;
        }

        if (hasUnsavedChanges)
        {
            args.Cancel = true;
            bool discardChanges;
            isCloseConfirmationOpen = true;
            try { discardChanges = ConfirmDiscardUnsavedChanges(); }
            finally { isCloseConfirmationOpen = false; }
            if (!discardChanges)
            {
                AppLog.Write("Window", "Close cancelled; unsaved project changes are retained.");
                return;
            }

            isShuttingDown = true;
            pendingDependencyDecision?.TrySetResult(false);
            _ = Dispatcher.BeginInvoke(new Action(Close), DispatcherPriority.Normal);
            return;
        }

        isShuttingDown = true;
        AppLog.Write("Window", "Shutdown accepted; no export task or unsaved project changes are active.");
        pendingDependencyDecision?.TrySetResult(false);
    }

    private bool ConfirmDiscardUnsavedChanges()
    {
        const string message = "当前工程存在尚未保存的修改。退出程序将丢失这些修改，是否仍要退出？";
        return FluentDialog.ShowConfirmation(
            IsVisible ? this : null,
            "未保存的修改",
            message,
            "继续编辑",
            "放弃修改并退出",
            otherActionIsDangerous: true,
            icon: FluentDialogIcon.Warning);
    }

    private bool ConfirmCancelExportAndExit(bool isCommitting, bool mainWindowVisible)
    {
        var message = isCommitting
            ? "当前视频正在保存，无法中断。确认后程序将在保存完成后退出。"
            : "当前视频尚未导出完成。如果关闭程序，本次导出任务将被取消。请确认是否继续。";

        return FluentDialog.ShowConfirmation(
            mainWindowVisible ? this : null,
            isCommitting ? "正在保存视频" : "正在导出视频",
            message,
            isCommitting ? "继续等待" : "继续导出",
            isCommitting ? "保存完成后退出" : "取消导出并退出",
            otherActionIsDangerous: !isCommitting,
            icon: FluentDialogIcon.Info);
    }

    private async Task ExportAsync(JsonElement request)
    {
        if (isShuttingDown) return;
        var projectElement = request.GetProperty("project");
        var current = CheckSource(projectElement);
        if (string.IsNullOrWhiteSpace(current.Project) || !File.Exists(current.Project))
        {
            Send(new { kind = "status", message = "请先保存项目，再导出视频。", busy = false, error = true });
            return;
        }

        var projectPath = Path.GetFullPath(current.Project);
        var projectDirectory = Path.GetDirectoryName(projectPath)!;
        var projectFile = Path.GetFileName(projectPath);
        const string projectSuffix = ".project.json";
        if (!projectFile.EndsWith(projectSuffix, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("项目文件名必须以 .project.json 结尾。");
        var stem = projectFile[..^projectSuffix.Length];
        var output = Path.Combine(projectDirectory, stem + ".exported.mp4");
        var cacheRoot = Path.Combine(projectDirectory, "cache");
        var tempRoot = Path.Combine(cacheRoot, "temp");
        var task = exportTasks.Start(() =>
        {
            var id = Guid.NewGuid().ToString("N");
            var taskCache = Path.Combine(cacheRoot, "render", "job-" + id);
            return new ExportTask
            {
                Id = id,
                ProjectPath = projectPath,
                MediaPath = Path.GetFullPath(current.Media),
                TranscriptPath = Path.GetFullPath(current.Transcript),
                OutputPath = output,
                TemporaryOutputPath = Path.Combine(taskCache, $"{stem}.exported-{id}.mp4.tmp"),
                CacheDirectory = taskCache
            };
        });

        dependencyInstallCancellation = task.Cancellation;
        string? snapshot = null;
        string? pagePlanSnapshot = null;
        var committed = false;
        var preserveFailedOutput = false;
        try
        {
            Directory.CreateDirectory(tempRoot);
            CleanupStaleProjectCache(cacheRoot, TimeSpan.FromDays(7));
            Directory.CreateDirectory(task.CacheDirectory);
            var token = task.Cancellation.Token;
            Send(new { kind = "status", message = "正在准备导出…", busy = true, taskId = task.Id });
            string runtime;
            try { runtime = await PrepareExportRuntimeAsync(token); }
            catch (OperationCanceledException) { throw; }
            catch (Exception error)
            {
                Send(new { kind = "dependency-failed", message = error.Message });
                throw;
            }
            dependencyInstallCancellation = null;
            Send(new { kind = "dependency-end" });

            snapshot = Path.Combine(tempRoot, $"project-snapshot-{task.Id}.json.tmp");
            await File.WriteAllTextAsync(snapshot, projectElement.GetRawText(), token);
            if (request.TryGetProperty("pagePlan", out var pagePlan))
            {
                pagePlanSnapshot = Path.Combine(tempRoot, $"page-plan-{task.Id}.json.tmp");
                await File.WriteAllTextAsync(pagePlanSnapshot, pagePlan.GetRawText(), token);
            }

            var start = new ProcessStartInfo("node.exe")
            {
                WorkingDirectory = runtime,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };
            string[] arguments = [
                Path.Combine(runtime, "scripts", "export.mjs"),
                "--media", task.MediaPath, "--json", task.TranscriptPath, "--project", snapshot,
                "--out", task.TemporaryOutputPath,
                "--cache-dir", task.CacheDirectory,
                "--duration", request.GetProperty("duration").GetDouble().ToString("R", CultureInfo.InvariantCulture),
                "--video-height", request.GetProperty("videoHeight").GetInt32().ToString(CultureInfo.InvariantCulture)
            ];
            foreach (var argument in arguments) start.ArgumentList.Add(argument);
            if (pagePlanSnapshot != null)
            {
                start.ArgumentList.Add("--page-plan");
                start.ArgumentList.Add(pagePlanSnapshot);
            }

            var evidence = Environment.GetEnvironmentVariable("TRANSCRIPT_STUDIO_M1_EVIDENCE");
            if (!string.IsNullOrEmpty(evidence))
                await M1Capture.SaveAsync(view.CoreWebView2, evidence, request);

            task.Status = ExportStatus.Rendering;
            var watch = Stopwatch.StartNew();
            var result = await exportProcesses.RunAsync(start, token, line =>
            {
                if (line.StartsWith("render ", StringComparison.Ordinal))
                    Dispatcher.BeginInvoke(new Action(() =>
                        Send(new
                        {
                            kind = "status",
                            message = $"正在导出 {line[7..]}",
                            busy = true,
                            canCancel = task.Status != ExportStatus.Cancelling && task.Status != ExportStatus.Committing,
                            taskId = task.Id
                        })));
            });
            if (!string.IsNullOrEmpty(evidence))
                File.WriteAllText(Path.Combine(evidence, "render.log"),
                    $"Task: {task.Id}\nElapsed seconds: {watch.Elapsed.TotalSeconds:F2}\nExit code: {result.ExitCode}\n{result.Stdout}\n{result.Stderr}");
            token.ThrowIfCancellationRequested();
            if (result.ExitCode != 0)
                throw new InvalidOperationException($"导出失败（{result.ExitCode}）。{result.Stderr}");

            task.Status = ExportStatus.Validating;
            Send(new { kind = "status", message = "正在验证导出视频…", busy = true, taskId = task.Id });
            if (!File.Exists(task.TemporaryOutputPath) || new FileInfo(task.TemporaryOutputPath).Length <= 0)
                throw new InvalidDataException("渲染未生成有效的临时 MP4 文件。");

            // Lightweight MP4 structure check; no external FFprobe dependency is required.
            token.ThrowIfCancellationRequested();
            if (!IsStructurallyValidMp4(task.TemporaryOutputPath))
                throw new InvalidDataException("导出文件不是有效的 MP4，或缺少必要的视频数据结构。");

            task.Status = ExportStatus.Committing;
            Send(new { kind = "status", message = "视频验证完成，正在保存正式文件…", busy = true, canCancel = false, taskId = task.Id });
            var hadExistingOutput = File.Exists(task.OutputPath);
            try
            {
                if (hadExistingOutput)
                {
                    var backup = task.OutputPath + ".replace-backup-" + task.Id;
                    File.Replace(task.TemporaryOutputPath, task.OutputPath, backup, ignoreMetadataErrors: true);
                    TryDeleteFile(backup);
                }
                else
                {
                    File.Move(task.TemporaryOutputPath, task.OutputPath);
                }
            }
            catch (Exception error)
            {
                // Keep a completed render available for manual recovery if the final move fails.
                preserveFailedOutput = File.Exists(task.TemporaryOutputPath);
                var detail = hadExistingOutput ? "原有正式视频已保留。" : "正式视频尚未生成。";
                if (preserveFailedOutput)
                    detail += $"新视频暂存于：{task.TemporaryOutputPath}";
                throw new IOException($"无法保存正式视频：{error.Message}。{detail}", error);
            }
            committed = true;
            task.Status = ExportStatus.Completed;
            Send(new { kind = "status", message = $"已导出至 {task.OutputPath}", busy = false, taskId = task.Id });
        }
        catch (OperationCanceledException)
        {
            task.Status = ExportStatus.Cancelled;
            // Dependency preparation may have been cancelled while its dialog was
            // in the "cancelling" state. Always close that dialog on task completion.
            Send(new { kind = "dependency-end" });
            Send(new { kind = "status", message = "导出已取消，原有正式视频未受影响。", busy = false, taskId = task.Id });
        }
        catch (Exception error)
        {
            task.Status = ExportStatus.Failed;
            Send(new { kind = "status", message = $"视频导出失败：{error.Message}", busy = false, error = true, taskId = task.Id });
        }
        finally
        {
            dependencyInstallCancellation = null;
            if (snapshot != null) TryDeleteFile(snapshot);
            if (pagePlanSnapshot != null) TryDeleteFile(pagePlanSnapshot);
            // Retain failed commit output for recovery; otherwise clean this task directory.
            if (committed || task.Status == ExportStatus.Cancelled || (task.Status == ExportStatus.Failed && !preserveFailedOutput))
                TryDeleteDirectory(task.CacheDirectory);
            exportTasks.Complete(task, task.Status);
            task.Dispose();
        }
    }

    private static bool IsStructurallyValidMp4(string path)
    {
        try
        {
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            if (stream.Length < 24) return false;

            var reader = new BinaryReader(stream);
            var hasFileType = false;
            var hasMovie = false;
            var hasMediaData = false;

            while (stream.Position + 8 <= stream.Length)
            {
                var boxStart = stream.Position;
                var size32 = ReadUInt32BigEndian(reader);
                var typeBytes = reader.ReadBytes(4);
                if (typeBytes.Length != 4) return false;
                var type = Encoding.ASCII.GetString(typeBytes);

                long boxSize;
                var headerSize = 8L;
                if (size32 == 1)
                {
                    if (stream.Position + 8 > stream.Length) return false;
                    var extendedSize = ReadUInt64BigEndian(reader);
                    if (extendedSize > long.MaxValue) return false;
                    boxSize = (long)extendedSize;
                    headerSize = 16;
                }
                else if (size32 == 0)
                {
                    boxSize = stream.Length - boxStart;
                }
                else
                {
                    boxSize = size32;
                }

                if (boxSize < headerSize || boxStart + boxSize > stream.Length)
                    return false;

                if (type == "ftyp") hasFileType = true;
                else if (type == "moov") hasMovie = true;
                else if (type == "mdat") hasMediaData = true;

                stream.Position = boxStart + boxSize;
            }

            return hasFileType && hasMovie && hasMediaData;
        }
        catch (IOException) { return false; }
        catch (UnauthorizedAccessException) { return false; }
    }

    private static uint ReadUInt32BigEndian(BinaryReader reader)
    {
        var bytes = reader.ReadBytes(4);
        if (bytes.Length != 4) throw new EndOfStreamException();
        return System.Buffers.Binary.BinaryPrimitives.ReadUInt32BigEndian(bytes);
    }

    private static ulong ReadUInt64BigEndian(BinaryReader reader)
    {
        var bytes = reader.ReadBytes(8);
        if (bytes.Length != 8) throw new EndOfStreamException();
        return System.Buffers.Binary.BinaryPrimitives.ReadUInt64BigEndian(bytes);
    }

    private static void CleanupStaleProjectCache(string cacheRoot, TimeSpan maxAge)
    {
        var renderRoot = Path.Combine(cacheRoot, "render");
        if (!Directory.Exists(renderRoot)) return;
        var cutoff = DateTime.UtcNow - maxAge;
        try
        {
            foreach (var directory in Directory.EnumerateDirectories(renderRoot, "job-*", SearchOption.TopDirectoryOnly))
            {
                try
                {
                    var info = new DirectoryInfo(directory);
                    if (info.LastWriteTimeUtc < cutoff)
                        Directory.Delete(directory, recursive: true);
                }
                catch { /* A single stale directory must not stop cleanup. */ }
            }
        }
        catch { /* Enumeration is best-effort; cache cleanup must never prevent export. */ }

        var tempRoot = Path.Combine(cacheRoot, "temp");
        if (!Directory.Exists(tempRoot)) return;
        try
        {
            foreach (var file in Directory.EnumerateFiles(tempRoot, "*.tmp", SearchOption.TopDirectoryOnly))
            {
                try
                {
                    if (File.GetLastWriteTimeUtc(file) < cutoff) File.Delete(file);
                }
                catch { /* A single stale file must not stop cleanup. */ }
            }
        }
        catch { /* Enumeration is best-effort; cache cleanup must never prevent export. */ }
    }

    private static void TryDeleteFile(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { }
    }

    private static void TryDeleteDirectory(string path)
    {
        try { if (Directory.Exists(path)) Directory.Delete(path, recursive: true); } catch { }
    }

    private static string Fingerprint(string file) => Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(file)));

    private void Send(object message) => view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(message));
}
