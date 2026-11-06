# M6.14 — single instance and system tray (historical milestone)

## M6.14 milestone implementation

- A per-user named Mutex establishes the primary process.
- Secondary launches retry a per-user named-pipe activation request briefly, then exit without creating a second window.
- The primary process listens for `ACTIVATE` and dispatches window restoration onto the WPF UI thread.
- The notification-area icon appears when the main window is created. The app listens for Windows `TaskbarCreated` and re-registers the existing icon handle after Explorer restarts.
- Double-clicking the icon restores and foregrounds the existing window.
- Right-click opens a custom WPF menu with exactly two items: `打开` and `退出`.
- Menu hover background is `#FFFBC7`.
- Minimizing hides the window and removes its taskbar entry while keeping the same WPF window, WebView2 instance, React state and media server alive.
- Closing the main window disposes the tray icon and media server. The application message loop then ends, releasing the single-instance mutex and pipe listener.

## Historical M6.14 scope notes

- Close-confirmation and termination of an active render are M6.15 work. M6.14 retains the existing behavior that prevents closing while `exporting` is true.
- Render-process cancellation and process-tree shutdown are M6.15 work.
- Moving Node/npm/Remotion runtime and cache data under `%LOCALAPPDATA%` is M6.16 work.
- The temporary MP4 suffix convention `<name>.mp4.tmp` is M6.15 work.

## Windows acceptance checklist

1. Launch the EXE, then launch it again. Confirm only one process/window exists.
2. Minimize the main window. Confirm it disappears from the taskbar but the tray icon remains.
3. Double-click the tray icon. Confirm the original window returns with its existing project and playback/editing state.
4. Right-click the tray icon. Confirm only `打开` and `退出` appear.
5. Hover each menu item. Confirm its background becomes `#FFFBC7`.
6. Choose `打开`; confirm the existing window is restored.
7. Choose `退出`; confirm the process ends and the tray icon disappears.
8. Repeat while a project and media are loaded; verify minimizing/restoring does not recreate WebView2 or reset the current UI state.
9. Start two launches close together during initial startup; verify the second launch exits and the first instance is eventually activated.
10. Restart Windows Explorer from Task Manager while the app is running; verify the tray icon reappears without restarting Transcript Studio, and its double-click/right-click actions still work.


## M6.14.1 compiler-diagnostic corrections

The follow-up source package includes explicit `System.IO` and WPF type qualifications to resolve the missing-type and WPF/WinForms ambiguity diagnostics from the initial Windows publish attempt.


## M6.14.2 — WPF-only tray implementation

- Replaced `System.Windows.Forms.NotifyIcon` with direct P/Invoke calls to Windows Shell `Shell_NotifyIcon`.
- Tray callbacks are received through an `HwndSource` hook on the existing WPF main-window handle.
- The tray menu remains a WPF `Window` with the agreed two entries and hover color.
- Removed `<UseWindowsForms>true</UseWindowsForms>` from the project.
- No `System.Windows.Forms` or `System.Drawing` references remain in desktop source/project files.


## M6.15.3 behavior (historical; superseded by M6.15.4)

- The WPF application explicitly sets `ShutdownMode.OnMainWindowClose` and assigns the reader window to `Application.MainWindow`. Closing a temporary tray menu cannot shut down the application.
- The native `HwndSource` hook only identifies shell notifications and posts the corresponding action to the WPF Dispatcher. It does not directly create, close or activate WPF windows while the native callback is on the stack.
- The tray context window has a fixed width of 70 DIP and an automatically measured height.
- Open and Exit actions are dispatched only after the tray menu's `Closed` event has completed. Losing menu activation closes the menu without selecting an action.
- Double-click and the Open menu item share the same reader-window activation method.
- A tray-originated Exit request during an active export displays the existing close-confirmation dialog on screen even though the reader window is hidden. Choosing Continue leaves the application in the tray.
- The named-pipe listener is cancelled and joined before the per-user mutex is released. There is no fixed two-second wait.
- Lifecycle and unhandled-exception diagnostics are written best-effort to `%LOCALAPPDATA%/TranscriptStudio/logs/`.

## M6.15.3 Windows acceptance checklist

1. Double-click the tray icon repeatedly; the existing main window must return and appear in the taskbar.
2. Right-click and choose Open; it must produce the same result as double-click.
3. Right-click and choose Exit with no export running; the process must exit promptly.
4. Start an export, minimize the reader to the tray, choose Exit and confirm that the close-confirmation dialog is visible. Choosing Continue must leave the app running in the tray; choosing Cancel Export and Exit must cancel the render and then exit.
5. Open and close the tray menu repeatedly, including clicking outside it; no menu-close action may accidentally exit the application.
6. Confirm the tray menu width is 70 DIP and its two items remain fully visible.
7. Restart Windows Explorer and confirm the icon and both actions are restored.
8. Inspect the daily log under `%LOCALAPPDATA%/TranscriptStudio/logs/` if any lifecycle test fails.

## Current tray implementation (M6.15.4)

M6.15.4 supersedes the historical M6.14.2 WPF-only tray backend:

- `System.Windows.Forms.NotifyIcon` owns tray icon registration, notification callbacks, icon lifetime and Explorer-restart recovery.
- The application retains its custom WPF tray menu (70 DIP wide; `打开` / `退出`; hover `#FFFBC7`). WinForms `ContextMenuStrip` is not used.
- `Forms.Cursor.Position` and `Forms.Screen.FromPoint` provide cursor and working-area information for WPF menu placement.
- `TrayIconManager` no longer declares Shell/user32 P/Invoke, `HwndSource` hooks, or its own `TaskbarCreated` registration.
- The WPF reader remains the only main application window. Minimizing restores `WindowState.Normal` before hiding the window; tray activation restores taskbar visibility, shows the existing window and activates it through WPF.
