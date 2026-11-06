# SDD ledger — plan: docs/superpowers/plans/2026-11-05-m6155-review-remediation.md

- Baseline: `TranscriptStudio_M6154_1_WinForms_Tray_Hotfix.zip`, extracted to an isolated copy. Original archive remains unchanged; archive contains no `.git`.
- Pre-flight: Tasks 1–4 touch `ReaderWindow.cs` and `main.tsx`; implement in order to avoid overlapping state/message edits. Task 3 depends on the unsaved-state helpers introduced in Task 2. Task 4 is independent of save revision semantics but shares message dispatch.
- Ruling: Use a compact `dirty-state` WebView message rather than adding a host-to-JS close query or a new state framework; React owns edit truth and WPF only needs the current boolean to guard close.
- Ruling: Treat only a draft whose text differs from the current word as unsaved; an opened editor with unchanged text does not trigger a discard warning.
- Ruling: The WPF close warning is a Yes/No discard confirmation with default No. If declined after the export-exit prompt, export continues.

- Task 1: complete — `ExportAsync` cancellation now sends `dependency-end` before the final non-busy status; regression test verifies the terminal message and React close handler.
- Task 2: complete — changed inline drafts are detected without marking unchanged drafts dirty; React reports dirty-state to WPF, import checks the combined state, and WPF confirms before discarding on close. The export-exit prompt runs first; declining the discard prompt leaves the export running.
- Task 3: complete — project save requests/acknowledgements carry an edit revision; the UI clears dirty state only when the acknowledged revision still matches and no changed draft is active. Opening another project increments the revision to invalidate old acknowledgements.
- Task 4: complete — `settings-save`, `dirty-state`, and the related native `layout` update are accepted before the export busy guard. Project save is blocked with an explicit UI message during export. Host errors report the actual export busy state.
- Ruling: Allow `layout` alongside `settings-save` during export — the layout message updates only native minimum window constraints and is emitted by the same settings change; ignoring it could leave WPF constraints stale while the React preview has changed. If wrong, it could adjust window minimum dimensions during rendering, but does not mutate the export snapshot.
- Verification: `node scripts/test-core.mjs` → 179/179 passed; Python Skill tests → 10/10 passed; `node --check` across 33 `.mjs` files passed; Python AST parse passed.
- Verification limits: `npm ci --offline --no-audit --no-fund` failed with ENOTCACHED; online `npm ci --no-audit --no-fund` timed out. Global `tsc --noEmit` cannot run because `@types/node` is unavailable. No .NET SDK is installed, so `dotnet publish` could not be run. The partial `node_modules` directory and `.tmp-core` were removed before packaging.
- Final review: self-review (no subagent tool); inspected the four changed flows and the full regression suite. The ZIP baseline has no `.git`; no commit or push.
