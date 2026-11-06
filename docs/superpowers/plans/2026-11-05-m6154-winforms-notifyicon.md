# M6.15.4 WinForms NotifyIcon Implementation Plan

> **For agentic workers:** Execute this plan inline. Keep the existing source ZIP baseline and do not commit or push.

**Goal:** Replace application-owned Shell tray P/Invoke with WinForms `NotifyIcon` while preserving the WPF main window and custom tray menu.

**Architecture:** `TrayIconManager` owns a WinForms `NotifyIcon` and routes its mouse events onto the WPF Dispatcher. The existing WPF menu remains a WPF `Window`; cursor and monitor lookup use WinForms `Cursor` and `Screen`. `ReaderWindow` retains window lifecycle ownership and fixes minimize/restore ordering using WPF APIs.

**Tech Stack:** .NET 10 WPF + Windows Forms `NotifyIcon`, C#, Node.js `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-05-winforms-notifyicon-design.md`

## Global Constraints

- Keep `net10.0-windows`, WPF, WebView2 and the existing application architecture.
- Add no NuGet dependencies.
- Keep the tray menu 70 DIP wide with `打开` / `退出` and hover `#FFFBC7`.
- Do not use WinForms `ContextMenuStrip`.
- Remove application-owned tray P/Invoke and `HwndSource` hook code.
- Preserve single-instance, export, project storage and shutdown behavior.
- Do not commit, push, switch branches or modify user data.

## Review Focus

- Right-click and double-click events must not both trigger conflicting actions.
- Disposing the tray manager must remove the icon and release its owned `Icon`.
- Repeated right-clicks and menu deactivation must not execute a pending menu action twice.
- Explorer restart must restore the icon through `NotifyIcon` behavior without application-owned `TaskbarCreated` handling.
- Mixed WPF/WinForms implicit global usings must not introduce ambiguous WPF types.

---

### Task 1: Replace native tray plumbing with NotifyIcon

**Files:**
- Modify: `desktop/TranscriptStudio.csproj`
- Modify: `desktop/AppLifecycle/TrayIconManager.cs`
- Modify: `tests/m614-tray-lifecycle.test.mjs`
- Modify: `tests/m6153-tray-lifecycle.test.mjs`
- Create: `tests/m6154-winforms-tray.test.mjs`

**Interfaces:**
- Consumes: `TrayIconManager(Window owner, Action activate, Action exit)` constructor used by `ReaderWindow`.
- Produces: same constructor and `IDisposable` contract; event handlers use WinForms `NotifyIcon`.

- [x] Write tests asserting `UseWindowsForms`, `NotifyIcon`, mouse events, no `Shell_NotifyIcon`/`HwndSource`/tray P/Invoke, and retained WPF menu.
- [x] Run tests and confirm they fail against the current native implementation.
- [x] Replace the tray registration and callback implementation with `Forms.NotifyIcon`; keep WPF menu class and 70 DIP styling.
- [x] Replace cursor/monitor P/Invoke with `Forms.Cursor.Position` and `Forms.Screen.FromPoint`.
- [x] Run focused tests and the complete Node test suite.

### Task 2: Correct WPF minimize and restore lifecycle

**Files:**
- Modify: `desktop/ReaderWindow.cs`
- Modify: `tests/m6153-tray-lifecycle.test.mjs`
- Modify: `tests/m6154-winforms-tray.test.mjs`

**Interfaces:**
- Consumes: existing `ActivateFromTray()` callback and `StateChanged` handler.
- Produces: same activation callback with WPF-only restore/activation behavior.

- [x] Add failing source-contract tests for restoring `WindowState` before hiding and for restoring/showing before activation.
- [x] Run tests and confirm they fail.
- [x] Change minimize order to normalize state before `ShowInTaskbar=false` and `Hide()`.
- [x] Restore the existing window with `ShowInTaskbar=true`, `Show()`, `WindowState=Normal`, and WPF `Activate()`. If using a temporary `Topmost` toggle, restore the previous value immediately.
- [x] Remove `SetForegroundWindow` P/Invoke and unused interop imports from `ReaderWindow`.
- [x] Run focused tests and the complete Node suite.

### Task 3: Update current documentation and verify

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `M6.15_RELEASE_NOTES.md`
- Modify: `docs/M614_SINGLE_INSTANCE_AND_TRAY.md`
- Create: `docs/M6154_WINFORMS_TRAY.md`

- [x] Update current architecture documentation to identify WinForms `NotifyIcon` plus the WPF menu.
- [x] Preserve historical M6.14 notes, adding a clear M6.15.4 superseding note rather than rewriting history.
- [x] Run `npm run test`, `npm run test:skill`, and JavaScript syntax checks.
- [x] Check whether .NET SDK is available; if not, state that WPF publish must be verified on Windows.
- [x] Package a clean source ZIP and a Markdown implementation report. Do not commit or push.
