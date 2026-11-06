# M6.15.6 — Unified dialogs and reliable unsaved-state indicator

## Intent

Improve the reliability and visual consistency of Transcript Studio's confirmation dialogs, and make unsaved project changes visible in both the React toolbar and the native WPF window title. The work builds on the user's tested M6.15.5 source archive.

## Confirmed current behavior and code findings

- `ReaderWindow` sets `Title = "Transcript Studio"` once in its constructor. The WPF title never reacts to the `dirty-state` messages it already receives.
- The React toolbar's dot is conditional on `dirty || hasUnsavedWordDraft(words, edit)`. The user's observation that it remains unchanged is not covered by the M6.15.5 tests; those tests check source patterns and isolated predicates rather than the full revision/draft state transitions.
- Project dirty state is split across a boolean, a ref, an edit revision ref, an edit draft, and WebView2 messages. Save acknowledgements can only clear the boolean when the revision matches, but there is no first-class `savedRevision` state.
- Importing another subtitle still uses `window.confirm()`, which exposes the WebView2 origin (`reader.transcript-studio.local`) in the browser-owned confirmation.
- WPF close confirmation still uses `MessageBox`; export-exit confirmation is a hand-built WPF window with default focus on the destructive action.
- Dependency dialogs already use React/CSS, but have a separate visual implementation.
- WPF also has two informational/error `MessageBox` calls (startup failure and invalid settings recovery).
- `ReaderWindow.cs` line 791 intentionally defers a second `Close()` through `Dispatcher.BeginInvoke`; its returned awaitable is ignored and produces CS4014 in the user's Windows build log.

## Goals

1. Use one small revision-based project-edit state model to represent current revision, saved revision, and whether the active inline draft differs from the stored word.
2. Make the right-side React label and WPF window title show the same unsaved marker, and clear it only after the current revision is saved or a clean project is loaded.
3. Prevent stale save acknowledgements from clearing newer edits or a newly loaded project.
4. Replace browser-owned import confirmation with a Chinese React dialog.
5. Use one shared React dialog shell for import confirmation and dependency dialogs.
6. Use one reusable WPF Fluent dialog helper for close/export confirmations and informational/error notices.
7. Apply the same design tokens to the draggable Settings panel without rewriting its drag/size behavior.
8. Make the safe action the default keyboard action; closing a dialog or pressing Escape must not discard edits or cancel an export.
9. Clarify the intentional deferred Dispatcher operation so the Release build does not report CS4014.

## Non-goals and anti-goals

- Do not migrate to WinUI 3, Avalonia, or another UI framework.
- Do not add Win32 API calls or new runtime packages.
- Do not change the tray implementation, export task lifecycle, media processing, project JSON schema, or save destination.
- Do not replace the existing settings panel's draggable/resizable behavior.
- Do not introduce a global dialog service, DI container, MVVM layer, or event bus.
- Do not redesign unrelated application screens.

## Approaches considered

1. **Chosen: shared design tokens with platform-native dialog components.** React uses a reusable `Dialog` shell for React-owned modals; WPF uses a small `FluentDialog` helper for native confirmations. Both follow the same colors, typography, spacing, corner radius, and button rules. This preserves the current WPF + WebView2 + React architecture and avoids dependencies.
2. **Use browser `confirm()` and WPF `MessageBox` with superficial styling.** Rejected because browser-owned confirmation exposes the internal origin and neither native MessageBox is sufficiently customizable.
3. **Migrate all dialogs to WinUI 3 or a single web-only modal layer.** Rejected because it adds migration/runtime complexity or weakens native close behavior and tray lifecycle integration.

## Approved design values

- Light surface: `#FFFFFF`; dialog/backdrop page tint: `#F9F9F9` / translucent dark overlay.
- Border: `#E1E5E9`; primary text: `#242424`; secondary text: `#616161`.
- Primary action: `#0F6CBD` with white text.
- Destructive action: `#C42B1C` text/border on a light surface.
- Typeface: `Segoe UI`, with `Microsoft YaHei UI` / `Microsoft YaHei` fallback.
- Dialog corner radius: 10 DIP; soft shadow; button height: 36 DIP; consistent 8 DIP action gap.
- Dialog title: 16–18 px/DIP semibold; body: 14 px/DIP with comfortable line height.
- Native WPF title bar remains OS-owned; dialog content is custom WPF. No custom Win32 chrome.

## Dialog behavior and copy

### Unsaved project on application close (WPF)

- Title: `未保存的修改`
- Message: `当前工程存在尚未保存的修改。退出程序将丢失这些修改，是否仍要退出？`
- Safe/default/cancel action: `继续编辑`
- Destructive action: `放弃修改并退出`
- Escape and title-bar close equal `继续编辑`.

### Unsaved project before importing another subtitle (React)

- Title: `打开其他字幕`
- Message: `当前字幕存在尚未保存的修改。继续打开其他字幕将丢失这些修改，是否继续？`
- Safe/default action: `取消`
- Destructive action: `放弃修改并打开`
- Escape and backdrop/title close equal `取消`.
- The browser-origin confirmation must disappear completely.

### Export running while closing (WPF)

- Title: `正在导出视频` (or `正在保存视频` in the commit phase).
- Preserve the existing message explaining cancellation/commit behavior.
- Safe/default action: `继续导出` (or `继续等待` while committing).
- Other action: `取消导出并退出` (or `保存完成后退出` while committing).
- Escape and title-bar close equal the safe action.

### Dependency preparation (React)

- Keep existing confirmation/progress/cancelling/error behavior and cancellation message ordering.
- Render through the shared React Dialog shell.
- Use Chinese subtitle `视频导出环境准备`; do not display an internal host/domain.
- Default focus is the safe action; Escape retains the existing safe cancellation behavior.

### Other WPF notices

- Replace startup-failure and invalid-settings-recovery MessageBox calls with the same WPF Fluent dialog helper's single-action notice.

### Settings panel

- Keep its draggable and viewport-clamped behavior.
- Reuse the shared React dialog CSS tokens and matching surface/header typography.

## Unsaved-state model

Use a small immutable state object:

```ts
type ProjectEditState = {
  currentRevision: number;
  savedRevision: number;
  draftChanged: boolean;
};
```

Rules:
- Initial state is clean: both revisions are zero and `draftChanged` is false.
- Every committed project edit increments `currentRevision`.
- An active inline draft sets `draftChanged` only when its text differs from the current word.
- Cancelling or closing an unchanged draft clears `draftChanged` without incrementing the revision.
- Committing a changed draft increments `currentRevision`, then clears `draftChanged`.
- A save request carries the snapshot's `currentRevision`.
- An acknowledgement advances `savedRevision` only when its revision is not older than `savedRevision` and does not exceed `currentRevision`.
- Acknowledging an older revision preserves the unsaved state if `currentRevision` is newer.
- Loading/replacing a project advances the global revision and sets `savedRevision` to that new revision. This invalidates acknowledgements from the previous project.
- Unsaved is `currentRevision !== savedRevision || draftChanged`.
- React sends this combined boolean to WPF whenever it changes. WPF updates both `hasUnsavedChanges` and `Title` (`Transcript Studio ●` / `Transcript Studio`).

## Implementation boundaries

- New pure state helpers belong in `src/core/project-edit-state.ts`.
- React's generic dialog shell belongs in `src/ui/Dialog.tsx`.
- React dialog design tokens and variants belong in `src/style.css`.
- WPF dialog factory belongs in `desktop/UI/FluentDialog.cs`.
- `ReaderWindow` remains responsible for application lifecycle and calls the WPF helper; it does not build each dialog's controls inline.
- The existing `dirty-state` WebView2 message remains the only bridge needed for the WPF title.

## Verification

- Add behavior tests for all revision/draft transitions, stale and out-of-order acknowledgements, and project replacement.
- Add source-contract tests for React indicator, Chinese import dialog, shared dependency dialog, WPF title synchronization, WPF confirmation default actions, and absence of MessageBox/window.confirm.
- Run `node scripts/test-core.mjs`, Python Skill tests, `npm.cmd run typecheck`, `npm.cmd run build`, and `dotnet publish` where available.
- Windows manual checks: clean launch, draft change/cancel/commit, save and immediate edit, stale acknowledgement, project switch, all dialog buttons/Escape/X behavior, hidden-to-tray close prompt, and export cancellation confirmation.
- No Git commit or push; the user will handle Git.
