namespace TranscriptStudio.Export;

/// <summary>Owns the application's single active export task.</summary>
internal sealed class ExportTaskManager : IDisposable
{
    private ExportTask? active;
    private bool shuttingDown;

    public ExportTask? Active => active;
    public bool IsBusy => active is not null && !active.IsTerminal;

    public ExportTask Start(Func<ExportTask> create)
    {
        if (shuttingDown) throw new InvalidOperationException("程序正在退出，不能启动新的导出任务。");
        if (IsBusy) throw new InvalidOperationException("当前已有视频导出任务。");
        active = create();
        return active;
    }

    public void RequestCancel(bool shutdown)
    {
        if (shutdown) shuttingDown = true;
        if (active is not { IsTerminal: false } task) return;

        // Do not interrupt the short file-commit operation once it has begun.
        if (task.Status == ExportStatus.Committing) return;

        task.Status = ExportStatus.Cancelling;
        task.Cancellation.Cancel();
    }

    public void Complete(ExportTask task, ExportStatus status)
    {
        task.Status = status;
        if (ReferenceEquals(active, task)) active = null;
    }

    public void Dispose()
    {
        active?.Dispose();
        active = null;
    }
}
