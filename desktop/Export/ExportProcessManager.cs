using System.Diagnostics;
using System.Text;

namespace TranscriptStudio.Export;

internal sealed class ExportProcessManager
{
    public async Task<(int ExitCode, string Stdout, string Stderr)> RunAsync(
        ProcessStartInfo start, CancellationToken cancellationToken,
        Action<string>? onOutput = null)
    {
        using var process = Process.Start(start) ?? throw new InvalidOperationException("无法启动导出进程。");
        var stdout = new StringBuilder();

        async Task ReadOutputAsync()
        {
            while (await process.StandardOutput.ReadLineAsync() is { } line)
            {
                stdout.AppendLine(line);
                onOutput?.Invoke(line);
            }
        }

        var outputTask = ReadOutputAsync();
        var errorTask = process.StandardError.ReadToEndAsync();

        try
        {
            await process.WaitForExitAsync(cancellationToken);
        }
        catch (OperationCanceledException)
        {
            try { if (!process.HasExited) process.Kill(entireProcessTree: true); }
            catch (InvalidOperationException) { }
            catch (System.ComponentModel.Win32Exception) { }

            await process.WaitForExitAsync();
            await Task.WhenAll(outputTask, errorTask);
            throw;
        }

        await Task.WhenAll(outputTask, errorTask);
        return (process.ExitCode, stdout.ToString(), await errorTask);
    }
}
