# M6.15.4 — WinForms NotifyIcon tray backend

## What changed

Transcript Studio now uses the in-box .NET Windows Forms `NotifyIcon` component only for the notification-area icon. The main window, the compact tray menu, and all application UI remain WPF.

The tray manager no longer contains application-owned `Shell_NotifyIcon`, `HwndSource`, `TaskbarCreated`, cursor-position or monitor-information P/Invoke code. Explorer-restart recovery and the tray icon's native message window are delegated to `NotifyIcon`.

## User-visible behavior retained

- One tray icon with tooltip `Transcript Studio`.
- Left-button double-click activates the existing WPF main window.
- Right-button release opens the custom WPF tray menu.
- The menu remains 70 DIP wide and contains only `打开` and `退出`.
- Menu hover remains `#FFFBC7`.
- Menu actions run after its `Closed` event.
- The main WPF window remains the application's `MainWindow`; closing the temporary menu does not shut down the app.

## Window restore behavior

Minimizing now restores `WindowState` to `Normal` before removing the taskbar entry and hiding the window. Tray activation restores taskbar visibility and normal state, shows the existing window if hidden, temporarily toggles WPF `Topmost` to raise it in the Z-order, restores the previous Topmost value, then calls `Activate()`.

The main window is not left permanently Topmost. No explicit `SetForegroundWindow` P/Invoke remains in `ReaderWindow`.

Windows still controls foreground activation policy. Actual foreground behavior, Explorer restart recovery, and mixed-DPI multi-monitor menu placement must be verified on Windows.

## Build configuration and size

`UseWindowsForms` is enabled alongside `UseWPF`. This is a framework reference, not a NuGet package. The project remains `net10.0-windows`, framework-dependent and single-file published. The runtime already required by this app is the .NET Desktop Runtime; the exact EXE size change should be measured on Windows rather than assumed.


## M6.15.4.1 compile hotfix

When WinForms was enabled, its implicit global usings introduced a `HorizontalAlignment` name collision with WPF. Both affected assignments now explicitly qualify the WPF enum:

- `System.Windows.HorizontalAlignment.Stretch` in `TrayIconManager.cs`.
- `System.Windows.HorizontalAlignment.Right` in `ReaderWindow.cs`.

A regression test checks both fully qualified assignments. This change does not alter layout or runtime behavior.

## Windows acceptance checklist

1. Build and publish Release.
2. Confirm a single tray icon appears and the tooltip is correct.
3. Double-click the icon; confirm the existing main window appears, is active and is in the taskbar.
4. Right-click; confirm the WPF menu appears at the cursor, remains 70 DIP wide, and has the two requested items.
5. Choose `打开`; confirm it behaves the same as double-click.
6. Choose `退出`; confirm the existing export-aware close flow runs and the process exits.
7. Minimize the main window; confirm it disappears from the taskbar but the tray icon remains.
8. Restore repeatedly; confirm no duplicate window or WebView2 instance is created.
9. Restart Windows Explorer; confirm `NotifyIcon` restores the tray icon.
10. Test on a secondary monitor with a different scaling factor; confirm menu placement remains within that monitor's work area.
