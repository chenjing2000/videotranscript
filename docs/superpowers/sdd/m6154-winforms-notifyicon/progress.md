# SDD ledger — plan: docs/superpowers/plans/2026-11-05-m6154-winforms-notifyicon.md

- Baseline: `TranscriptStudio_M6153_AppLog_Build_Fix.zip`; source was extracted to an isolated working copy. The archive has no `.git` directory.
- Pre-flight: Task 1 produces the unchanged `TrayIconManager` constructor used by Task 2; Task 2 consumes that constructor only through `ReaderWindow`. No signature change is needed.
- Ruling: Keep the WPF custom menu and replace only the tray icon backend — this preserves the user's existing visual design and limits the change to the requested integration; if wrong, only menu placement and tray event handling would need revisiting.
- Ruling: Remove the explicit `SetForegroundWindow` P/Invoke and use WPF activation only, with a temporary Topmost toggle restored immediately if needed — the user prefers minimizing direct Win32 usage; Windows foreground restrictions still apply and must be checked on Windows.

- Task 1: complete — `node --test tests/m6154-winforms-tray.test.mjs tests/m614-tray-lifecycle.test.mjs` → 12/12 passed; `TrayIconManager` now uses `NotifyIcon`, WinForms cursor/screen wrappers, and retains the WPF menu.
- Task 2: complete — `node --test tests/m6153-tray-lifecycle.test.mjs tests/m6154-winforms-tray.test.mjs` → 21/21 passed; minimize order corrected, WPF restore uses a temporary Topmost toggle, direct `SetForegroundWindow` P/Invoke removed.
- Task 3: complete — docs and release notes updated; `node scripts/test-core.mjs` → 172/172 passed; Python Skill suite → 10/10 passed; `node --check` → 32/32 passed.
- Final review: self-review (no subagent tool). Reviewed changed C# and tests for ownership, event ordering, namespace collisions and lifecycle. Windows compilation and runtime behavior remain unverified here because .NET SDK/Windows are unavailable.

- User-side Windows publish then reported two CS0120/CS0176 errors caused by unqualified WPF `HorizontalAlignment` enum references after WinForms implicit usings were enabled. Both references now explicitly use `System.Windows.HorizontalAlignment`; regression coverage added in M6.15.4.1.
