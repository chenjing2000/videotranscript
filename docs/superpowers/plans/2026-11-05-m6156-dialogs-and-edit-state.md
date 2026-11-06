# M6.15.6 Dialogs and Unsaved-State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make unsaved project state reliable and visible in both application titles, and unify React/WPF dialogs under the approved Windows 11 Fluent visual and interaction rules.

**Architecture:** Use a pure revision-state helper in TypeScript, a reusable React dialog shell, and a small WPF dialog factory. Keep the existing WPF + WebView2 + React architecture and existing export/tray behavior.

**Tech Stack:** TypeScript, React 19, CSS, C#/.NET 10 WPF, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-05-m6156-dialogs-and-edit-state-design.md`

## Global Constraints

- No WinUI 3 migration, no Win32 API calls, no new runtime packages.
- Preserve current WPF + WinForms NotifyIcon tray behavior and WebView2 host messaging.
- Preserve export lifecycle, cancellation ordering, project JSON schema, and save destinations.
- Safe actions are default; Escape/title-bar close must never trigger destructive actions.
- Settings panel remains draggable and viewport-clamped.
- Do not commit, push, switch branches, or alter the user's Git history.
- Work in the isolated extracted M6.15.5 source copy; preserve the original archive.

## Review Focus

- A changed draft is cancelled or reverted to its original text; both indicators must clear without incrementing the saved revision.
- A stale save acknowledgement arrives after a newer edit; it must not clear the unsaved marker.
- A stale save acknowledgement arrives after another project is loaded; it must not mark the new project dirty or clean incorrectly.
- The user closes the main window while it is hidden in the tray; the WPF dialog must still be visible, modal, and safe by default.
- The export is in its non-cancellable commit phase; Escape/X must not cancel or falsely report that cancellation occurred.

---

### Task 1: Revision-based project edit state and title synchronization

**Files:**
- Create: `src/core/project-edit-state.ts`
- Modify: `src/main.tsx`
- Modify: `desktop/ReaderWindow.cs`
- Test: `tests/m6156-project-edit-state.test.mjs`
- Test: `tests/m6156-dialogs.test.mjs`

**Interfaces:**
- Produces `ProjectEditState` and pure helpers:
  - `createProjectEditState(): ProjectEditState`
  - `markProjectEdited(state: ProjectEditState): ProjectEditState`
  - `setProjectDraftChanged(state: ProjectEditState, changed: boolean): ProjectEditState`
  - `acknowledgeProjectSave(state: ProjectEditState, revision: number): ProjectEditState`
  - `resetProjectEditState(state: ProjectEditState): ProjectEditState`
  - `hasUnsavedProjectChanges(state: ProjectEditState): boolean`

- [x] **Step 1: Write failing revision-state tests**
  - Test clean initial state.
  - Test draft change, draft cancel, commit, matching save acknowledgement.
  - Test stale acknowledgement after a later edit.
  - Test out-of-order acknowledgements do not move `savedRevision` backwards.
  - Test project reset invalidates an earlier acknowledgement.

- [x] **Step 2: Run `node scripts/test-core.mjs` and verify RED**
  - Expected: only the new M6.15.6 state tests fail because the module/API does not yet exist; existing tests remain green.

- [x] **Step 3: Implement the pure helper**
  - Use a single immutable state object and monotonically increasing `currentRevision`.
  - Ignore acknowledgements older than `savedRevision` or newer than `currentRevision`.

- [x] **Step 4: Wire React state**
  - Replace `dirty`, `dirtyRef`, and `editRevision` with `ProjectEditState` plus a synchronous ref.
  - Make the React toolbar dot derive only from `hasUnsavedProjectChanges`.
  - Update the draft state from `setEditing`; update the revision from `refresh` and project-level settings edits.
  - Capture the state revision in the save request and acknowledge it on `saved`.
  - Reset the state when a new project is loaded.

- [x] **Step 5: Synchronize the WPF title**
  - On `dirty-state`, set `hasUnsavedChanges` and update the title to `Transcript Studio ●` or `Transcript Studio`.
  - Keep close behavior based on the same boolean.

- [x] **Step 6: Run focused and full core tests**
  - Run `node scripts/test-core.mjs`.
  - Expected: all tests pass, including revision transition and WPF/React source-contract checks.

### Task 2: Shared React dialog shell and Chinese import confirmation

**Files:**
- Create: `src/ui/Dialog.tsx`
- Modify: `src/main.tsx`
- Modify: `src/style.css`
- Test: `tests/m6156-dialogs.test.mjs`

**Interfaces:**
- `DialogAction`: `{ label: string; onClick: () => void; variant: 'primary' | 'secondary' | 'danger'; autoFocus?: boolean; disabled?: boolean }`.
- `Dialog` props: `title`, optional `subtitle`, `icon`, `children`, `actions`, optional `onClose`, optional `onEscape`, optional `dismissOnBackdrop`, and optional `className`.

- [x] **Step 1: Add failing dialog contract tests**
  - Assert the shared React Dialog component exists and owns the common modal surface, header, body, footer, safe-action focus, and Escape handling.
  - Assert `window.confirm` is absent and import confirmation uses Chinese title/body/action labels.
  - Assert dependency confirmation/progress/error render through the shared shell and the subtitle is Chinese.

- [x] **Step 2: Run the focused test and verify RED**
  - Expected: fail because the shared component does not exist and import still calls `window.confirm`.

- [x] **Step 3: Implement the reusable React Dialog**
  - Keep focus trapping small and local to the dialog component.
  - Make `onClose`/Escape resolve to the safe action.
  - Do not close by clicking the backdrop unless the caller explicitly opts in.

- [x] **Step 4: Replace browser import confirmation**
  - Store the selected `File` while the confirmation is open.
  - On cancel, discard only the pending file; on confirm, continue the existing desktop/browser open path.

- [x] **Step 5: Move dependency dialogs into the shared shell**
  - Preserve dependency decision IDs and existing cancellation message flow.
  - Use the Chinese subtitle `视频导出环境准备`.

- [x] **Step 6: Apply shared CSS tokens**
  - Use the specified colors, typography, 10px surface radius, soft shadow, 36px buttons, and consistent gaps.
  - Apply matching surface/header tokens to the draggable Settings panel without changing its positioning logic.

- [x] **Step 7: Run `node scripts/test-core.mjs`**
  - Expected: all tests pass and no `window.confirm` remains.

### Task 3: Reusable WPF Fluent dialog and migration of native notices

**Files:**
- Create: `desktop/UI/FluentDialog.cs`
- Modify: `desktop/ReaderWindow.cs`
- Test: `tests/m6156-dialogs.test.mjs`

**Interfaces:**
- `FluentDialog.ShowConfirmation(Window? owner, string title, string message, string safeAction, string otherAction, bool otherActionIsDangerous = true, FluentDialogIcon icon = Warning): bool`
- `FluentDialog.ShowMessage(Window? owner, string title, string message, string closeAction = "确定", FluentDialogIcon icon = Info): void`

- [x] **Step 1: Add failing WPF dialog contract tests**
  - Assert close and export confirmations call `FluentDialog.ShowConfirmation`.
  - Assert startup/configuration notices call `FluentDialog.ShowMessage`.
  - Assert `MessageBox` is no longer used.
  - Assert safe action is default/cancel and the destructive action is not default.

- [x] **Step 2: Run focused test and verify RED**
  - Expected: fail because ReaderWindow still uses MessageBox and builds the export dialog inline.

- [x] **Step 3: Implement `FluentDialog`**
  - Build a standard WPF modal window with OS-owned title bar, custom content surface, simple icon, styled buttons, and safe default behavior.
  - Do not use Win32 APIs, custom chrome, or additional packages.

- [x] **Step 4: Migrate WPF dialogs**
  - Replace `ConfirmDiscardUnsavedChanges`.
  - Replace `ConfirmCancelExportAndExit`.
  - Replace startup failure and invalid-settings-recovery MessageBox calls.
  - Preserve owner-null behavior when the main window is hidden in the tray.

- [x] **Step 5: Run `node scripts/test-core.mjs`**
  - Expected: all dialog contract and existing tests pass.

### Task 4: Resolve intentional Dispatcher warning and update documentation

**Files:**
- Modify: `desktop/ReaderWindow.cs`
- Modify: `M6.15_RELEASE_NOTES.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: this plan's execution status
- Modify: `docs/superpowers/sdd/m6156-dialogs-and-edit-state/progress.md`

- [x] **Step 1: Add a failing assertion for explicit deferred-dispatch intent**
  - Assert the close deferral explicitly discards the `DispatcherOperation` return value.

- [x] **Step 2: Run focused test and verify RED**
  - Expected: assertion fails on the current bare `Dispatcher.BeginInvoke` call.

- [x] **Step 3: Make the intent explicit**
  - Change to `_ = Dispatcher.BeginInvoke(new Action(Close), DispatcherPriority.Normal);`.
  - Do not await it: the close must occur on a later dispatcher turn after the current `Closing` event is cancelled.

- [x] **Step 4: Update release notes and architecture documentation**
  - Document the state model, dialog ownership, safe defaults, and intentional fire-and-forget dispatch.

- [x] **Step 5: Run verification**
  - `node scripts/test-core.mjs`
  - Python Skill test command from `package.json`
  - `npm.cmd run typecheck`
  - `npm.cmd run build`
  - `dotnet publish desktop/TranscriptStudio.csproj -c Release -o dist/wpf`
  - Record any unavailable toolchain/network limitation; do not claim an unrun check passed.

## Completion

- Re-read all changed files and compare against the spec.
- Run a final full test/build pass.
- Produce a source ZIP and a concise implementation report.
- Do not include `node_modules`, `.tmp-core`, build output, `.git`, or user data in the source ZIP.
- Do not commit or push.


## Execution status

- Task 1: complete.
- Task 2: complete.
- Task 3: complete.
- Task 4: implementation/documentation complete; environment-dependent checks were attempted but blocked.
- `node scripts/test-core.mjs`: 188/188 passed.
- Python Skill tests: 10/10 passed.
- `node --check`: 35 `.mjs` files passed.
- TypeScript `transpileModule` syntax pass: 24 `.ts`/`.tsx` files, 0 diagnostics.
- Full `npm run typecheck` and `npm run build`: blocked by incomplete npm dependency installation (`@types/node` is absent/incomplete); `npm ci` timed out in this environment.
- `dotnet publish`: not run successfully because `dotnet` is not installed in this environment.
- Windows UI behavior and actual WPF compilation still require verification on the user's Windows machine.
