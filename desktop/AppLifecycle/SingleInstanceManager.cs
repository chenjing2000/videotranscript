using System.IO;
using System.IO.Pipes;
using System.Security.Cryptography;
using System.Text;

namespace TranscriptStudio.AppLifecycle;

/// <summary>
/// Enforces one application process per Windows user and forwards later launches
/// to the primary process through a per-user named pipe.
/// </summary>
internal sealed class SingleInstanceManager : IDisposable
{
    private const string PipeSuffix = "TranscriptStudio.Activate";
    private readonly Mutex mutex;
    private readonly string pipeName;
    private readonly CancellationTokenSource stop = new();
    private Task? listener;
    private bool ownsMutex;
    private bool disposed;

    public SingleInstanceManager()
    {
        var identity = $"{Environment.UserDomainName}\\{Environment.UserName}";
        var userKey = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(identity)))[..16];
        var name = $"TranscriptStudio-{userKey}";
        mutex = new Mutex(initiallyOwned: true, name: $@"Local\{name}", createdNew: out ownsMutex);
        pipeName = $"{name}-{PipeSuffix}";
        AppLog.Write("SingleInstance", $"Instance mutex acquired: {ownsMutex}.");
    }

    /// <summary>Returns true for the primary instance. A secondary instance forwards activation and exits.</summary>
    public bool TryBecomePrimaryOrActivate()
    {
        if (ownsMutex) return true;

        AppLog.Write("SingleInstance", "Secondary launch is forwarding activation to the primary instance.");

        // The primary may still be starting its pipe listener. Retry briefly rather
        // than allowing a second application window to be created.
        for (var attempt = 0; attempt < 20; attempt++)
        {
            try
            {
                using var client = new NamedPipeClientStream(".", pipeName, PipeDirection.Out);
                client.Connect(250);
                using var writer = new StreamWriter(client, new UTF8Encoding(false), 1024, leaveOpen: true);
                writer.WriteLine("ACTIVATE");
                writer.Flush();
                return false;
            }
            catch (TimeoutException) { Thread.Sleep(75); }
            catch (IOException) { Thread.Sleep(75); }
        }

        // Do not start a second copy if the primary owns the mutex but is temporarily
        // unable to accept activation. A subsequent launch can retry.
        AppLog.Write("SingleInstance", "Primary instance did not accept activation; secondary launch will exit without opening another window.");
        return false;
    }

    public void StartListening(Action onActivate)
    {
        if (!ownsMutex) throw new InvalidOperationException("Only the primary instance can listen.");
        AppLog.Write("SingleInstance", $"Named-pipe listener started: {pipeName}.");
        listener = Task.Run(async () =>
        {
            while (!stop.IsCancellationRequested)
            {
                try
                {
                    await using var server = new NamedPipeServerStream(
                        pipeName, PipeDirection.In, 1, PipeTransmissionMode.Byte,
                        PipeOptions.Asynchronous);
                    await server.WaitForConnectionAsync(stop.Token);
                    using var reader = new StreamReader(server, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, bufferSize: 1024, leaveOpen: true);
                    var command = await reader.ReadLineAsync().WaitAsync(TimeSpan.FromSeconds(2), stop.Token);
                    if (string.Equals(command, "ACTIVATE", StringComparison.Ordinal))
                    {
                        AppLog.Write("SingleInstance", "Received activation request from a secondary launch.");
                        try { onActivate(); }
                        catch (Exception error) { AppLog.WriteException("SingleInstance.Activate", error); }
                    }
                }
                catch (OperationCanceledException) when (stop.IsCancellationRequested) { break; }
                catch (TimeoutException) { }
                catch (IOException) when (stop.IsCancellationRequested) { break; }
                catch (IOException) { }
                catch (ObjectDisposedException) when (stop.IsCancellationRequested) { break; }
                catch (Exception error)
                {
                    AppLog.WriteException("SingleInstance.Listener", error);
                    break;
                }
            }
        });
    }

    public void Dispose()
    {
        if (disposed) return;
        disposed = true;

        AppLog.Write("SingleInstance", "Stopping named-pipe listener.");
        stop.Cancel();
        try
        {
            // WaitForConnectionAsync and ReadLineAsync both use the cancellation token.
            // Waiting for this owned task avoids leaving a listener alive after the
            // mutex is released, without an arbitrary two-second UI-exit delay.
            listener?.GetAwaiter().GetResult();
        }
        catch (OperationCanceledException) { }
        catch (IOException) when (stop.IsCancellationRequested) { }
        catch (Exception error) { AppLog.WriteException("SingleInstance.Stop", error); }

        if (ownsMutex)
        {
            try { mutex.ReleaseMutex(); } catch (ApplicationException error)
            {
                AppLog.WriteException("SingleInstance.ReleaseMutex", error);
            }
        }

        mutex.Dispose();
        stop.Dispose();
        AppLog.Write("SingleInstance", "Named-pipe listener stopped; mutex released.");
    }
}
