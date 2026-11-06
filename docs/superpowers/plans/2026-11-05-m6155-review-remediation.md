# M6.15.5 — Fix four important code-review findings

## Goal
Fix four confirmed important issues from `TranscriptStudio_M6154_1_Code_Review.md` with minimal changes:
1. Dependency-install cancellation leaves the React dialog in `cancelling`.
2. Uncommitted word drafts and dirty projects can be lost on import or application close.
3. An older save acknowledgement can clear dirty state for newer edits.
4. Settings persistence messages are ignored during video export.

## Constraints
- Baseline: `TranscriptStudio_M6154_1_WinForms_Tray_Hotfix.zip`.
- Preserve the WPF + WinForms NotifyIcon tray implementation.
- No architecture rewrite, no new runtime dependencies, no changes to export file format or task lifecycle.
- Keep existing user data and source files; work in a separate extracted copy.
- No Git commit, push, or branch operations.
- TDD: add focused regression tests, observe expected failures, then implement the smallest fix.
- Do not alter the paragraph/transcript Skill.

## Task 1 — Dependency cancellation finalization
- Add regression test for dependency-end emitted in ExportAsync's OperationCanceledException path.
- Ensure the React cancelling dialog is cleared on that terminal event.
- Verify cancellation does not leave dependency dialog visible.

## Task 2 — Unsaved edits protection
- Treat a changed inline word draft as unsaved even before Enter/commit.
- Send a compact dirty-state message to WPF whenever committed dirty state or draft state changes.
- Protect import with `dirty || changedDraft`.
- On WPF close, ask before discarding dirty project changes; apply this after export confirmation too, before cancellation/shutdown begins.
- Default the close confirmation to No; keep export running if the user declines discard.

## Task 3 — Save acknowledgement revision guard
- Maintain a monotonically increasing edit revision.
- Increment on committed project changes and when switching to a newly loaded project (to invalidate older acknowledgements).
- Include revision in save request and `saved` acknowledgement.
- Clear dirty only when the acknowledged revision equals the current revision and no changed inline draft exists.
- Preserve dirty state when an older snapshot is acknowledged.
- Browser-only save remains synchronous and may clear dirty immediately for its captured revision.

## Task 4 — Settings persistence during export
- Allow `settings-save` and `dirty-state` host messages before the general export busy guard.
- Keep other mutating commands blocked while exporting.
- Prevent Ctrl+S from silently issuing a project save request that the host will ignore during export; report that project save is unavailable until export ends.
- Add regression tests for message ordering and shortcut guard.

## Verification
- `node scripts/test-core.mjs`
- `npm.cmd run typecheck` and `npm.cmd run build` if dependencies are available.
- `npm.cmd run test:skill`
- `dotnet publish desktop/TranscriptStudio.csproj -c Release -o dist/wpf` if .NET SDK is available.
- Inspect final diff and archive integrity.


## Execution status

- [x] Task 1 — dependency cancellation finalization.
- [x] Task 2 — unsaved edits protection.
- [x] Task 3 — save acknowledgement revision guard.
- [x] Task 4 — settings persistence and layout updates during export.
- [x] Core regression suite and Python Skill suite.
- [ ] Full React/Vite typecheck/build — blocked because `npm ci` could not complete in this environment.
- [ ] .NET Release publish — blocked because the .NET SDK is not installed in this environment.
