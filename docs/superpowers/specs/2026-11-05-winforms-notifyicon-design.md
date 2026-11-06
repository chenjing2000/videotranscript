# M6.15.4 — WinForms NotifyIcon and WPF tray menu

## Intent

Replace the hand-written Shell tray icon implementation with the .NET WinForms `NotifyIcon` component, while retaining the existing WPF main window and custom WPF tray menu. The goal is to remove application-owned Shell P/Invoke, `HwndSource` callback handling, icon-handle ownership and Explorer-restart re-registration code without changing the visible tray menu or single-instance behavior.

## Goals

- Enable the Windows Forms desktop framework in the existing `net10.0-windows` WPF project.
- Use `System.Windows.Forms.NotifyIcon` only for the notification-area icon and mouse events.
- Keep the existing custom WPF menu: fixed 70 DIP width, `打开` and `退出`, hover color `#FFFBC7`, current placement behavior and deferred menu actions.
- Use WinForms `Cursor` and `Screen` for cursor/monitor information so `TrayIconManager` no longer declares Win32 P/Invokes.
- Keep single-instance Mutex/Named Pipe, WPF shutdown flow, export cancellation and project data unchanged.
- Correct the minimize-to-tray ordering and keep main-window restoration in WPF. Do not keep the main window permanently Topmost.

## Non-goals

- Do not replace the WPF main window, WPF tray menu, WebView2, React or Remotion.
- Do not use WinForms `ContextMenuStrip` or create a WinForms main window.
- Do not add third-party packages.
- Do not change project JSON, export naming, cache layout or export process management.
- Do not introduce permanent Topmost behavior or a general window-management framework.

## Approaches

1. Keep direct Shell P/Invoke. Rejected because the existing implementation is comparatively large and requires maintaining message registration, icon handles and Explorer-restart behavior.
2. Use WinForms `NotifyIcon` with the existing WPF menu. Selected because it delegates standard tray registration, notification messages, icon lifetime and Explorer restart recovery to the framework while preserving the agreed WPF UI.
3. Use a third-party tray library. Rejected because it adds a dependency for a function already supplied by the .NET Windows Desktop framework.

## Design decisions

- Add `<UseWindowsForms>true</UseWindowsForms>` alongside `<UseWPF>true</UseWPF>`. This uses the existing .NET Desktop Runtime and adds no NuGet package.
- Create and dispose `NotifyIcon` on the WPF UI thread. Use its `MouseDoubleClick` event for activation and `MouseUp` with the right mouse button to show the WPF menu.
- Load the application icon from the published executable with `System.Drawing.Icon.ExtractAssociatedIcon`, falling back to a cloned `SystemIcons.Application` icon.
- Use `System.Windows.Forms.Cursor.Position` and `Screen.FromPoint` to position the WPF menu. Convert pixel coordinates using the WPF visual DPI; do not declare application-owned P/Invoke in the tray manager.
- On minimize, restore `WindowState` to `Normal` before hiding the WPF window and removing its taskbar entry. On tray activation, show the existing window, restore its taskbar entry and normal state, then use WPF activation. A brief WPF Topmost toggle may be used only as an activation aid and must always be reset to the previous value; the window must not remain Topmost.
- Preserve the existing named-pipe activation path and close-confirmation/export shutdown behavior.

## Constraints

- Target framework remains `net10.0-windows`, `SelfContained=false`, `PublishSingleFile=true`.
- No new NuGet dependencies.
- Keep the project’s existing 70 DIP WPF tray menu and user-facing Chinese labels.
- No Git commit or push; deliver a source ZIP and a Markdown report.
