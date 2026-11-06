# M6.15 export lifecycle

## Task ownership

`ExportTask` captures all file paths at task start. Runtime code must not use mutable `current.Project` or `current.Media` to derive paths after the task begins. `ExportTaskManager` allows one active export and rejects new work during shutdown.

## Cancellation

The UI sends `export-cancel`. The host cancels the active task token. Dependency preparation and rendering observe the same task cancellation token. `ExportProcessManager` kills only the process tree created for the current export and waits for exit and stream drainage before returning.

During `Committing`, cancellation is deferred: file replacement is allowed to finish to avoid an ambiguous half-commit. A shutdown request waits for that commit before closing the application.

## Output transaction

- Final path: sibling of `.project.json`, `<stem>.exported.mp4`.
- Render task path: `cache/render/job-<guid>/`.
- Final temporary path: `<stem>.exported-<guid>.mp4.tmp`.
- Remotion first writes `render-output.mp4` so the renderer can infer MP4 correctly, then renames it to `.mp4.tmp` after the render process closes.
- The WPF host checks the MP4 top-level `ftyp`, `moov`, and `mdat` boxes before commit; no external executable is used for this step.
- Existing output is replaced using `File.Replace` with a backup path; first-time output uses `File.Move`. If either commit operation fails, the old output is not deliberately removed and the new `.mp4.tmp` is retained when it still exists. The error notice includes the recovery path.

## Cache cleanup

At the start of an export, only `job-*` directories and `*.tmp` files older than seven days under this project's cache are considered for cleanup. Both per-entry deletion failures and directory-enumeration failures are best-effort and do not prevent export. Active task directories are newly created and are never selected by the age cutoff.

## UI

The active export toast includes a right-aligned horizontal `取消` button (13px, vertically centered), which cancels without closing the app. The button is disabled after cancellation is requested and during the non-cancellable `Committing` phase. The WPF close confirmation uses `继续导出` and `取消导出并退出` while rendering can still be cancelled. Once the task reaches `Committing`, the dialog explains that the save cannot be interrupted and offers `继续等待` / `保存完成后退出`. Shutdown waits for task completion before disposing WPF/WebView2/tray resources.


## M6.15.1 simplification

No external `ffprobe.exe` is required by the desktop host. It checks the MP4 top-level `ftyp`, `moov`, and `mdat` boxes directly before replacing the previous output. NuGet vulnerability-feed auditing is disabled in the WPF project because this personal application does not need the extra advisory-feed network request. The task manager uses synchronous methods on the WPF dispatcher rather than a semaphore around operations that do not perform asynchronous work.


## Keep the implementation deliberately small

- One export at a time; no queue or parallel render scheduler.
- One cancellation source per task; dependency preparation and rendering share it.
- The task manager uses direct synchronous methods on the WPF UI dispatcher; no semaphore is needed for these short state updates.
- No external FFprobe dependency for desktop validation.
- No cache-management UI or generic cache framework; only this app's `job-*` folders and `.tmp` snapshots are considered.
- No extra process-management package; .NET `Process.Kill(entireProcessTree: true)` is used for the child process tree.


## M6.15.3 progress notice behavior

The host includes `canCancel: false` in status messages during the final file-commit phase. The React notice disables its cancel button in that phase; clicking Cancel after the host has entered `Committing` is not presented as an available operation. The notice uses a dedicated button class so the global 22px close-button rule cannot force its label to wrap.
