# SDD ledger — plan: docs/superpowers/plans/2026-11-05-m6151-repair.md

Pre-flight: Tasks 1, 2, and 3 touch independent code boundaries; Task 4 reviews their combined result. No shared implementation interfaces beyond the existing app shell.

Baseline: `npm test` passed 136/136. `dotnet` SDK is unavailable in this Linux environment. `npm ci --ignore-scripts --no-audit --no-fund` timed out; dependency installation is incomplete.

Task 4 ruling: The previous review called seven-day failed-cache retention an Important issue. This is not a defect: `docs/M615_EXPORT_LIFECYCLE.md` and `M6.15_RELEASE_NOTES.md` explicitly define seven-day cleanup. Preserve the documented policy; do not change code.

Task 4 ruling: The previous review described the MP4 parser's limited scope. The implementation and documentation already describe a lightweight ftyp/moov/mdat check; no FFprobe or broader decoder validation will be added.

Task 1: complete — `Closing += OnClosing` registered; focused lifecycle tests 11/11 after the regression test failed on baseline.
Task 2: complete — CLI cache path optional/defaulted; focused CLI tests 3/3 after baseline missing-cache test failed.
Task 3: complete — `TaskbarCreated` registration and tray re-add path implemented; tray contract test failed on baseline and passed after fix.
Additional review finding: commit-phase close dialog previously implied cancellation although `RequestCancel` intentionally defers cancellation during `Committing`. Added state-specific explanation and actions; regression test observed RED then GREEN.
Task 4: complete — second-pass self-review performed; seven-day cache retention reclassified as already documented behavior; lightweight MP4 parser retained by design. No additional source-level Critical/Important issue confirmed in inspected paths.
Verification: `npm test` 142/142; `npm run test:skill` 6/6; all script/test `.mjs` files pass `node --check`; `git diff --check` passed. `npm run verify` blocked by missing `@types/node` after `npm ci` timed out. No .NET SDK/Windows runtime available.
Final review: self-review (no subagent tool).
