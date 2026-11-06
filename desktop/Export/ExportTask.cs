namespace TranscriptStudio.Export;

internal enum ExportStatus
{
    Preparing, Rendering, Validating, Committing, Cancelling,
    Completed, Failed, Cancelled
}

internal sealed class ExportTask : IDisposable
{
    public string Id { get; init; } = Guid.NewGuid().ToString("N");
    public string ProjectPath { get; init; } = "";
    public string MediaPath { get; init; } = "";
    public string TranscriptPath { get; init; } = "";
    public string OutputPath { get; init; } = "";
    public string TemporaryOutputPath { get; init; } = "";
    public string CacheDirectory { get; init; } = "";
    public CancellationTokenSource Cancellation { get; } = new();
    public ExportStatus Status { get; set; } = ExportStatus.Preparing;
    public bool IsTerminal => Status is ExportStatus.Completed or ExportStatus.Failed or ExportStatus.Cancelled;
    public void Dispose() => Cancellation.Dispose();
}
