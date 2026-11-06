# Transcript Studio M6.15.1 → M6.15.2 Repair and Second-Pass Review

**Review basis:** `TranscriptStudio_M6151_Source.zip` plus the prior `TranscriptStudio_M6151_Code_Review.md` report and the project requirements in `README.md`, `docs/M615_EXPORT_LIFECYCLE.md`, `docs/M614_SINGLE_INSTANCE_AND_TRAY.md`, and `M6.15_RELEASE_NOTES.md`.

**Working method:** Isolated extraction of the supplied archive; fixes made in that copy only. Each behavior change received a regression test before implementation and a focused red/green run. The final review was performed as a separate self-review because no subagent-dispatch capability was available in this environment.

## Executive verdict

**Source-level repair status: Critical and Important code findings from the previous review have been addressed or reclassified with evidence.**

**Release status: Not yet verified for Windows.** This environment has no .NET SDK, WPF runtime, WebView2 runtime, or Windows Explorer shell. A Windows build and manual lifecycle/export acceptance pass are still required before treating the repaired package as production-ready.

## Strengths retained

- The application remains WPF + WebView2 + React/TypeScript + Remotion.
- The tray implementation remains direct Win32 Shell API; no WinForms or third-party tray package was added.
- Export remains single-task, uses one cancellation source, and owns only its launched process tree.
- The desktop cache remains project-local and task-specific.
- Existing output is replaced only after render success and the lightweight MP4 top-level box check.
- No task queue, generic cache framework, external process supervisor, FFprobe desktop dependency, or event-bus layer was introduced.

## Repairs made

### 1. Critical — WPF close handler was not registered

**File:** `desktop/ReaderWindow.cs`

- Replaced the constructor's anonymous `Closing` handler with the existing `Closing += OnClosing` subscription.
- The previous anonymous handler had prevented the asynchronous close-confirmation logic from running.
- Added a regression test that requires exactly the named handler registration and rejects the stale anonymous handler.
- Added a further check for the commit-phase dialog wording (see below).

**Result:** Fixed at source level. The WPF runtime interaction still needs Windows acceptance testing.

### 2. Important — CLI export rejected the documented command

**Files:** `scripts/export.mjs`, `README.md`, `tests/m615-cli-cache.test.mjs`

- `--cache-dir` is now optional.
- If omitted, the script resolves `.transcript-studio-cache/` beside the absolute output path.
- If explicitly supplied, the value is resolved to an absolute path and retained.
- The desktop host continues to pass its own task-specific cache directory, so desktop behavior is unchanged.
- Updated usage text and README documentation.
- Removed the unused `createHash` import.
- Added subprocess tests for omitted and explicit cache paths, plus a check of the default-path rule.

**Result:** Fixed and covered by executable Node tests. A full Remotion render was not run because npm dependencies could not be restored in this environment.

### 3. Important — tray icon did not recover after Explorer restart

**Files:** `desktop/AppLifecycle/TrayIconManager.cs`, `docs/M614_SINGLE_INSTANCE_AND_TRAY.md`, `tests/m614-tray-lifecycle.test.mjs`

- Registered the Windows `TaskbarCreated` message with `RegisterWindowMessage`.
- Added a small `RegisterTrayIcon` method shared by initial registration and recovery.
- When Explorer broadcasts `TaskbarCreated`, the existing icon handle is registered again using `NIM_ADD`.
- Registration failure is written to `Trace`; it does not introduce a new dependency or crash the message handler.
- Added a Windows manual acceptance step for restarting Explorer.

**Result:** Implemented and source-contract tested. Actual Explorer restart behavior must be verified on Windows.

### 4. Additional lifecycle correctness — commit cannot be cancelled

**File:** `desktop/ReaderWindow.cs`, `docs/M615_EXPORT_LIFECYCLE.md`

The previous close dialog always said the export would be cancelled. That is inaccurate once the task enters `Committing`, because the manager deliberately lets the short file-replacement operation finish.

- The close handler now detects `ExportStatus.Committing`.
- During render/preparation, the existing actions remain `继续导出` / `取消导出并退出`.
- During commit, the dialog explains that saving cannot be interrupted and offers `继续等待` / `保存完成后退出`.
- The export lifecycle documentation now records this distinction.

**Result:** Fixed at source level and covered by a regression assertion.

## Prior review findings re-evaluated

### Seven-day failed-cache retention — not a defect

The previous report classified this as Important. That classification was incorrect: `docs/M615_EXPORT_LIFECYCLE.md` and `M6.15_RELEASE_NOTES.md` already state that task directories and temporary snapshots older than seven days are eligible for cleanup. The retention policy is explicit. No code change was made.

### MP4 structure check — intentional limitation, not a defect

The implementation checks top-level `ftyp`, `moov`, and `mdat` boxes. The project documentation already calls this a lightweight structure check and deliberately avoids a desktop FFprobe dependency. This is not a full decode/integrity check, but the limitation is accurately described. No FFprobe dependency or larger validator was added.

### WPF lifecycle test coverage — improved but still environment-gated

New source-contract and CLI subprocess tests cover the previously missed event registration and CLI argument behavior. They do not substitute for running WPF event dispatch, process cancellation, file replacement while locked, or actual Explorer restart. These remain mandatory Windows acceptance tests, not claims of automated integration coverage.

## Second-pass review

Reviewed the affected lifecycle and export boundaries, including:

- `desktop/ReaderWindow.cs` close, export, cancellation, validation, commit, and cleanup flow.
- `desktop/Export/ExportTask.cs`, `ExportTaskManager.cs`, and `ExportProcessManager.cs` ownership and cancellation behavior.
- `desktop/AppLifecycle/TrayIconManager.cs` and `SingleInstanceManager.cs` tray/single-instance lifecycle.
- `desktop/LocalMediaServer.cs` and `MediaByteRanges.cs` request scoping and range handling.
- `scripts/export.mjs` argument validation, output/input collision guard, cache selection, and process invocation.
- Existing Node regression suite and relevant lifecycle documentation.

### Issues remaining from this review

No additional source-level Critical or Important defect was confirmed in the inspected paths. The following are explicitly not considered verified until Windows acceptance:

1. WPF compiles with the current Windows .NET 10 SDK.
2. Closing during preparation/rendering presents the confirmation, cancels the child process tree, waits for cleanup, then exits.
3. Closing during `Committing` waits for the replacement to finish and then exits.
4. Explorer restart restores the tray icon and its callbacks.
5. Replacing an MP4 that is locked by another process preserves the old output and the new recovery temp file.
6. A real Remotion export produces the expected MP4 and the desktop task cache is cleaned or retained according to the documented policy.

### Overengineering assessment

No new architecture layer was introduced. The existing task manager, process manager, task record, local media server, and WPF tray manager remain proportionate to the application. A task queue, cache service, third-party tray library, FFprobe desktop dependency, or generic process framework would be unnecessary for the current requirements.

## Verification evidence

| Check | Result |
|---|---|
| `node --check` for all `scripts/*.mjs` and `tests/*.test.mjs` | Passed |
| Focused close/export/tray/CLI tests | Passed after red/green cycles |
| `npm test` | **142/142 passed** |
| `npm run test:skill` | **6/6 passed** |
| `git diff --check` | Passed |
| `npm ci --ignore-scripts --no-audit --no-fund` | Timed out; dependency install incomplete |
| `npm run verify` | Blocked at TypeScript typecheck: missing `@types/node` due incomplete dependency installation |
| `dotnet publish` / WPF compile | Not run: `dotnet` SDK is not installed in this environment |
| Windows/WebView2/Explorer/real Remotion acceptance | Not run: Windows runtime unavailable |

## Files changed

- `desktop/ReaderWindow.cs`
- `desktop/AppLifecycle/TrayIconManager.cs`
- `scripts/export.mjs`
- `README.md`
- `M6.15_RELEASE_NOTES.md`
- `docs/M614_SINGLE_INSTANCE_AND_TRAY.md`
- `docs/M615_EXPORT_LIFECYCLE.md`
- `tests/m614-tray-lifecycle.test.mjs`
- `tests/m615-export-lifecycle.test.mjs`
- `tests/m615-cli-cache.test.mjs` (new)

## Declined to judge / environment limitations

- Actual WPF dialog appearance, focus, and button interaction: cannot be judged without Windows runtime.
- Actual Explorer `TaskbarCreated` delivery and shell icon re-registration: cannot be judged without Windows Explorer.
- Actual child-process tree termination and locked-file replacement: cannot be judged without Windows process and file-lock behavior.
- Actual Remotion rendering and MP4 playback: cannot be judged while dependencies are incomplete and no Windows render environment is available.

These are not silently treated as passed; they are listed as required acceptance checks.

## Final assessment

**Ready for Windows acceptance testing: Yes.**

**Ready for release/merge: Not yet.** The source-level fixes and portable tests are in place, but the Windows build and manual acceptance checklist above must pass before release.
