# Transcript Studio — current architecture (M6.15.6.2)

## Runtime boundaries

- **Desktop host (`desktop/`)**: WPF owns the native window, trusted local file paths, WebView2 hosting, settings persistence, project persistence, dependency preparation, and the Remotion process lifetime.
- **Frontend (`src/main.tsx`, `src/ui/`)**: React owns visible state, word editing, toolbar commands, keyboard focus, floating notices and the settings dialog. Reusable calculations and validation stay in `src/core/`.
- **Core (`src/core/`)**: Transcript v2 parsing, word overrides, deterministic pagination, page-plan validation, plain-text conversion, media discovery rules, settings validation and workspace geometry.
- **Media bridge (`desktop/LocalMediaServer.cs`)**: exposes only the currently selected media file through a tokenized WebView2 resource URL with HTTP byte-range support. It does not map or expose the containing folder.
- **Rendering (`src/ui/ReaderCanvas.tsx`, `src/remotion/`)**: the preview and Remotion composition use the same reader component. Export receives an immutable project and page-plan snapshot; invalid or source-mismatched page plans are rejected by the reader and recomputed.
- **Export (`scripts/export.mjs`)**: independently validates Transcript Studio v2 and any supplied project, verifies subtitle SHA-256 and media kind, bundles the Remotion composition, and cleans temporary media/bundle directories in `finally`.
- **Skills**: `docs/skills/transcript-studio-paragraphs/` prepares and validates subtitle v2; `docs/skills/transcript-studio-code-review/` defines the end-to-end review and verification workflow.

## Persistence

- Global preferences: `voicetranscript.settings.json` beside `TranscriptStudio.exe`.
- For `lesson01.transcript-studio.json`, the only current project path is `lesson01/lesson01.project.json` beside the source JSON.
- Plain text export is written directly to `lesson01/lesson01.article.txt` in the same work directory, UTF-8 without BOM and CRLF line endings.
- M6.12 is a breaking storage-layout change. The old `.transcript-studio/projects/.../project.settings.json` path is not searched or migrated. The project JSON contract remains v2.
- The work directory is created on project save, plain-text export or MP4 export, not on import.

## Export status and notices

The MP4 preparation/render status is represented by one persistent task notice in the right-pane floating notice stack. Host progress updates replace the same notice. Completion/cancellation removes it and sends the result through the ordinary notice rules. The notice overlay is outside transcript layout and scrolling.

## Known verification boundary

Core tests and the subtitle Skill tests are portable. Full TSX/Vite typecheck/build, WPF compilation, WebView2 media streaming, dependency installation and actual MP4 rendering require the Windows development environment and must be verified there.


## Application lifecycle (M6.14)

- `desktop/AppLifecycle/SingleInstanceManager.cs` owns a per-Windows-user named Mutex and activation named pipe. A secondary launch sends `ACTIVATE` and exits; it never creates another WPF window.
- `desktop/AppLifecycle/TrayIconManager.cs` owns a WinForms `NotifyIcon` for the notification-area icon and a compact 70-DIP WPF context window. NotifyIcon mouse events defer window work through the WPF Dispatcher; menu actions run only after the menu's `Closed` event. The menu contains only Open and Exit; hover uses `#FFFBC7`.
- The application explicitly uses `ShutdownMode.OnMainWindowClose` and identifies the reader as `Application.MainWindow`. Minimizing hides it from the taskbar and restores its normal window state without closing WebView2 or reloading React. Tray activation restores taskbar visibility, shows the existing window, restores its state and requests foreground activation.
- The tray icon is disposed when the main window closes. The single-instance listener is cancelled and joined before the mutex is released after the WPF message loop exits. A small best-effort log under `%LOCALAPPDATA%/TranscriptStudio/logs/` records lifecycle and unhandled-exception diagnostics.
- The tray icon uses the .NET Windows Forms `NotifyIcon` component; the main window and custom tray menu remain WPF. WinForms is limited to tray icon events and cursor/screen lookup. No application-owned Shell/user32 P/Invoke or third-party tray package is used.

## M6.14 milestone

M6.14 introduced single-instance startup, tray behavior and hide/restore lifecycle. The current M6.15 export lifecycle is documented below; the M6.14 scope statement is historical, not a description of current capabilities.


## Export lifecycle (M6.15)

- `desktop/Export/ExportTask.cs` captures the task ID, project/media/transcript paths, final output path, temporary output path, task cache directory and cancellation source.
- `ExportTaskManager` enforces one active export and coordinates cancellation/shutdown. `ExportProcessManager` owns the Node.js process, terminates its process tree on cancellation and waits for process/output completion.
- MP4 output is saved beside the `.project.json` file as `<stem>.exported.mp4`. Task data lives in the project `cache` directory.
- Remotion renders to an intermediate `.mp4` inside the task cache, then renames it to the requested `.mp4.tmp` path after successful completion. A lightweight in-process MP4 box check occurs before replacing the final output.
- The active export notice exposes a right-aligned `取消` button and disables it after cancellation is requested or while the MP4 commit is non-cancellable. Closing while exporting shows `继续导出` / `取消导出并退出`; shutdown waits for task cleanup before closing the WPF application.

## Unsaved project state and export-time settings (M6.15.5)

- React owns the current project dirty state and changed inline word draft. It reports the combined unsaved state to WPF through the `dirty-state` WebView2 message.
- Importing a replacement subtitle checks committed project edits and a changed inline draft before switching projects.
- WPF checks the reported state before closing and asks for confirmation before discarding changes. During an active export, this prompt follows the existing export-exit confirmation and appears before cancellation is requested.
- Project save requests carry a monotonically increasing edit revision. The `saved` acknowledgement clears dirty state only when the saved revision still matches the current revision and no changed inline draft is active.
- Global settings persistence and native window-layout updates are independent of the export snapshot and remain accepted while rendering. Project save, import and other state-changing host commands remain blocked while an export task is active.


## Project edit state and dialogs (M6.15.6)

- `src/core/project-edit-state.ts` owns the immutable edit-state transitions: current revision, saved revision and changed inline draft. A project replacement advances the global revision and marks that new revision saved, so acknowledgements from the previous project cannot change the new project's state.
- React derives the right-pane marker and import guard from `hasUnsavedProjectChanges`. It sends the same combined state to the WPF host through the existing `dirty-state` message.
- WPF uses that message both for close protection and to update the native window title (`Transcript Studio ●` when unsaved).
- `src/ui/Dialog.tsx` is the shared React modal shell for subtitle-import confirmation and dependency preparation. The draggable Settings panel remains a separate component but uses the same Fluent design tokens.
- `desktop/UI/FluentDialog.cs` provides the WPF confirmation and notice window. Its native title bar remains OS-owned; the custom content surface uses the same font, colors, button hierarchy and spacing as React.
- Confirmations always default to the safe action. Escape/title-bar close never performs a destructive action; subtitle import additionally treats backdrop dismissal as Cancel.
- No WinUI 3 migration, Win32 API, third-party dialog package or additional runtime dependency was introduced.


### Fluent dialog layout isolation (M6.15.6.2)

- The React dialog header and action footer use semantic `header` and `footer` elements, so their component classes explicitly reset the app-wide fixed `header` (54px) and `footer` (28px) heights. This prevents title clipping and button-row clipping.
- The dialog backdrop has a 24-DIP safe inset and safe vertical centering. On short viewports it can scroll instead of positioning the dialog partly outside the visible area.
- Dialog height is capped to the viewport's available height (`100dvh` with a `100vh` fallback). Only the body scrolls; the header and action footer remain fixed.
- The action footer has a 70-DIP minimum height and 20-DIP bottom padding. The header has a 64-DIP minimum height.
- No dialog event handling, dependency preparation, browser download, installation or cancellation logic changed.
