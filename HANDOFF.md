# CODEX HANDOFF — English Video Reader V1

## Assignment

Continue from this **core reference prototype**. Goal is a real Windows personal desktop English video reader that imports a nested folder of MP4/WhisperX JSON pairs, saves editing work, previews word highlight/scroll, and **automatically exports 1200×1600 H.264/AAC MP4 via Remotion** without manual screen recording.

**Target repo:** https://github.com/chenjing2000/englishvideomaker.git. In current authoring environment repo was empty; this source bundle has **not** been pushed. Preserve history and commit milestones on feature branches. Avoid replacing tested algorithms without corresponding tests.

## Status / integrity

- Completed: `src/core` WhisperX parser, stable IDs, word edits/overrides, highlight ratio, word-linear gradient, measured line wrapping, scroll plan and pure time->offset, simple React browser preview, draft Remotion composition + Node export CLI, synthetic MP4/JSON fixture, 8 passing unit tests.
- Locally verified: `bash scripts/test-core.sh` (8/8), synthetic `fixtures/demo.mp4` generated with FFmpeg and inspected by ffprobe. The **real user TED JSON (176 segments, many more words)** was used for input inspection but NOT included because it is user media and not meant for repository redistribution.
- **Not verified**: `npm install`, `vite build`, browser preview end-to-end, Remotion video output, Windows/Tauri integration. npm registry network was inaccessible here; do not assert those steps passed. Fix any TypeScript/API regressions against the selected Remotion version before GUI integration.
- Partial/prototype-only: no filesystem tree, persistent project files, full toast stack, global settings dialog, synchronized render preflight, adaptive export isolation. Current browser save downloads JSON; final Tauri should save to disk, never download as substitute.

## V1 nonnegotiable behavior

1. **Desktop Windows**: Tauri 2 stable + React/TS/Vite baseline. Switch to Electron only if prototype evidence demonstrates necessary integration failure. No cloud infrastructure, WhisperX execution, video cutting, camera recording, subtitle cards or outro.
2. **Layout**: fixed logical 1200x1600 canvas on LEFT; right tabs **样式｜字幕｜素材｜导出**; bottom-right only stacked toast notifications. Preview is scaled visually but text line wrapping must use logical 1200px metrics. Video fills width preserving source aspect, no separator. If video consumes available height, warn; do not dictate source video's height.
3. **Subtitles**: WhisperX `segments[].words` with original start/end; per-word original/display, immutable time IDs; only RIGHT subtitle tab can edit. Single-click selects, double-click edits and pauses, Enter commits, Escape cancels, Tab next/previous, Ctrl+Z; no auto seek on selection; explicit seek action. One displayed word per timestamp; preserve punctuation; paragraph breaks between time words; hidden word retains time anchor but not rendering. No re-alignment or fictional timestamps. Warn on invalid words and mismatched media timings.
4. **Word highlight**: from word `start` to `end`, color grows **left to right LINEARLY**, p(t)=clamp((t-start)/(end-start)); after end stays colored, seek backward deterministic. Does not interpolate RGB across entire word (use clipped fill/gradient). Punctuation follows its associated word.
5. **Scroll**: initial top aligned, no scroll until row descends below reading center. Trigger after current row's *last displayed word ends*. Prefer full gap until next row first word starts, with **minimum 0.15s**, may overlap start of following speech. Cosine easing. Continuous event merging/queuing without position jumps. Respect Y in [0,max(0,D-H)] for all t. If document height <= viewport -> Y=0, top aligns, bottom blank acceptable. Long document must have final row flush with bottom and not overscroll; stop after bottom reached. Actual line-position differences include paragraph gaps. Last-row alignment before/during its first utterance is desired, subject to min-duration constraints. No CSS free-running animation; time-based pure function for Remotion and seeks.
6. **Folders/projects**: root folder selection; recursive explorer UI but **lazy directory reads**. Initial folders collapsed except chosen root; click `+` expands one level; `−` collapses entire subtree (reset descendant expansion). Explicit double-click MP4 to open; NO automatic first pair. Same-folder basename MP4/JSON match (Windows case-insensitive); detect missing/invalid. Priority load `[video folder]/.evr/projects/[stem].evr.json` if valid, else start from original WhisperX JSON. Source MP4/JSON are **immutable**. `Ctrl+S` writes project atomically with backup; title `*` dirty indicator. Import root can move across disks; prefer relative paths and source hashes. Save project under `.evr/projects/`, output MP4 under sibling `exports/`, never overwrite source or existing export (suffix version).
7. **Global config**: `%APPDATA%/EnglishVideoReader/settings.json` with optional explicit external tool paths, last root folder, UI preferences. Programs may reside externally and be referenced by path or placed in `3rdparty/` when actually required. npm/Cargo-managed packages remain managed by lockfiles. If path explicitly configured but invalid, report error rather than silently falling back. No requirement to bundle node/chrome/ffmpeg unnecessarily for personal use.
8. **Toasts**: each independent float aligned to bottom of RIGHT panel, max 3 visible, new arrives at TOP of stack; each lasts **6 s**, opacity fades linearly from 5s to 6s; remaining cards slide DOWN to fill gap. Fourth new card evicts oldest visible, archive remains in detail log. Detailed info in separate panel. Never rely on ephemeral toast as sole indicator of dirty state/export progress.
9. **Export**: Remotion standard offline render, default 1200x1600/30fps/H264/AAC, optional 60fps/quality; input video's ONE original audio track, no duplicated Audio; duration derives from video (frame-rounded). Export snapshot immutable even if user edits during render. CLI first, then Tauri launch via process. Validate file/metadata/time before render. No shell-string interpolation of paths. Preview/remotion must share time/word/scroll/layout implementation; compare screenshots at matching timestamps.
10. **Individual/private use**: no public distribution workflow demanded.

## Critical architectural risks to resolve FIRST

A. Current `buildLayout()` relies on browser `CanvasRenderingContext2D.measureText`, which can vary subtly between WebView2 and Remotion's headless Chrome. **Make layout precomputed and shared** using a controlled font and measurement engine, or test parity at word/line level with render screenshots. Do not claim exact preview/render equality without verification.
B. Current `buildScrollPlan()` serializes events to avoid overlap. With very dense speech, last-row bottom alignment may occur *after* its first word; assess and implement an optimal schedule/fusion that preserves exact boundaries, min interval, no teleport, and clarity. Include tests showing unavoidable conflicting constraints; be explicit rather than inventing data.
C. Current React prototype lacks actual folder tree/autosave/stacked toasts/Tauri; add as separate milestones with tests.
D. Review Remotion `@remotion/media` API versions, rendering browser, media source support, and whether `calculateMetadata` uses inputProps exactly as written. Align all `remotion`/@remotion/* versions and lock with package-lock.
E. Performance: 2,000-word reference JSON should not cause avoidable full DOM rebuild at every animation frame. Precompute layout/plan per project/style change and optimize word highlight updates; target 600 words typical, test large cases.

## Development order with acceptance gates

### M0 — Bootstrap and render correctness
- `npm install`, `npm run typecheck`, `npm run build`, `bash scripts/test-core.sh` must pass on Windows.
- Generate fixture video, run `npm run export -- --video fixtures/demo.mp4 --json fixtures/demo.json --out exports/demo_reading.mp4`; inspect with ffprobe and view samples; output has audio and expected duration/frame size.
- Verify `src/remotion/Root.tsx` calculation works for 30/60 fps and does not duplicate audio. Document actual versions used.
- **Do not proceed if M0 fails.** Fix build/render first.

### M1 — Precise shared reading engine
- Same word layout, color fill, and scroll offset in preview vs Remotion at 0s, 1.2s, 4.8s, middle, end; screenshot or metadata assertions.
- Add tests for paragraph boundaries, hidden words, invalid/tied timestamps, lengthy article, minimal interline gaps, last-line flush, seek backward.
- Document unavoidable constraints (e.g., short video or no gap near last row).

### M2 — Tauri UI/folders and persistence
- Tauri 2 + Vite; fixed left canvas, right tabs. Lazy directory tree, collapse-all descendants; explicit selection, pair validation.
- Global settings + project JSON under agreed directories; source fingerprint; backup and atomic write; no original changes. Test save/restart/restore.

### M3 — Word editor and statuses
- Word edit interactions, paragraph toggle, hide/restore, undo, selected info and explicit seek; invalidate layout on edit.
- 6-second 3-card toast system with overlapping arrivals, fade, downward reposition and details, fake-timer tests.

### M4 — GUI export
- Export tab full options and progress; immutable job snapshot, cancel, one job per source path, avoid output overwrite, detailed errors, optional external tool paths. Verify re-open after app restart and export does not modify source.

## Required acceptance cases

See `docs/ACCEPTANCE_TESTS.md`. Each milestone requires recorded automated tests plus short manual capture; do not mark unsupported platform-specific behavior as tested.

## Security and engineering

- No arbitrary commands from JSON. Validate configured tool executables; call via argument arrays. Sanitize filenames.
- Do not traverse ignored `.evr`/`exports` as source folders unless user opts in.
- No direct code change to original WhisperX JSON; preserve source content hash.
- Keep `3rdparty` minimal; do not commit downloaded browser binaries or licensed fonts by default.
- Use stable dependency pinning/lockfile and Git feature branches.
