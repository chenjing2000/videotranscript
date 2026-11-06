using System.Diagnostics;
using System.IO;
using System.Text;

namespace TranscriptStudio.AppLifecycle;

/// <summary>
/// Small best-effort diagnostic log for startup, tray and shutdown lifecycle events.
/// Logging must never prevent the application from continuing or exiting.
/// </summary>
internal static class AppLog
{
    private static readonly object Sync = new();

    public static void Write(string category, string message)
    {
        try
        {
            var directory = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "TranscriptStudio", "logs");
            Directory.CreateDirectory(directory);
            var path = Path.Combine(directory, $"{DateTime.Now:yyyy-MM-dd}.log");
            var line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} " +
                $"[T{Environment.CurrentManagedThreadId}] [{category}] {message}{Environment.NewLine}";

            lock (Sync)
                File.AppendAllText(path, line, new UTF8Encoding(false));
        }
        catch (Exception error)
        {
            Trace.WriteLine($"Transcript Studio log write failed: {error.Message}");
        }
    }

    public static void WriteException(string category, Exception error) =>
        Write(category, error.ToString());
}
