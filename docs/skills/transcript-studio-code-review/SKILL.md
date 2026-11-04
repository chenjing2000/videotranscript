---
name: transcript-studio-code-review
description: Review, minimally repair, and verify the Transcript Studio WPF/WebView2/React/Remotion app, subtitle Skill, and its documentation. Require English Conventional Commit messages. Do not automatically push without access and appropriate user authorization.
---

# Transcript Studio — full project code review

Use this Skill for end-to-end code inspection and targeted fixes. **Never interpret reviewing a Skill as authorization to modify the Skill itself** unless the user asks. Scope changes to the user's request and preserve existing local edits.

## 1. Architecture and responsibility boundaries

- WPF (`desktop/`) owns native windows, trusted local paths, WebView2 hosting, project persistence, export process lifetime, and native file/folder dialogs; do not put transcript layout rules into C#.
- React (`src/main.tsx`, `src/ui/`) owns view state, commands and keyboard focus; business logic belongs in `src/core/`, not nested JSX callbacks when it can be independently tested.
- Remotion (`src/remotion/`, `scripts/export.mjs`) renders **the same immutable transcript/style/page plan** as the preview, preserving audio exactly once.
- For WPF, apply MVVM pragmatically: view-specific focus/animation may stay in code-behind; reusable state, data and validation should not depend on a Window or control. Do not introduce frameworks, DI, event buses or additional layers unless there is a demonstrated need.
- Inspect WebView2 disposal, stale async callbacks, event-handler registration, race conditions, window closure and export process cleanup.

## 2. Data contract and correctness (non-negotiable)

- Only `*.transcript-studio.json` Transcript Studio v2 is accepted: `transcript_studio.format === "transcript-studio"`, `schemaVersion === 2`, `language === "en"`.
- Paragraphs are marked **only** by `segments[].words[].breakParagraph: true`; omitted means no break. Never infer paragraph breaks from punctuation, WhisperX segments, timestamps or page boundaries. Reject `false`/invalid types and legacy `evr`/`paragraphBreaksAfter` input.
- Keep original WhisperX `word`, `start`, `end`, `score`, `segments[].text`, and `word_segments` unchanged. The latter must not receive break markers.
- Internal word IDs (e.g. `s11w2`) exist for editing and project overrides, not for defining paragraph boundaries in subtitle JSON. User edits are stored in a separate project and merged into an effective transcript.
- Compare generated subtitles with raw input using `docs/skills/transcript-studio-paragraphs/scripts/transcript_tool.py validate ... --source ...` when sources are available.
- Enforce file/source fingerprint and project version checks in desktop, UI and export paths. No implicit migration of old formats.

## 3. Layout, playback, export

- Default 1200×1600 logical canvas, with per-project configurable even dimensions (320–3840); Remotion MP4 width/height must match. Video mode fills canvas width proportionally and uses remaining height for reading; audio-only mode gives the entire canvas to reading. Scaling the preview must not alter line/page plan.
- Word-style justification: measure actual glyph widths; assign explicit **word x coordinates**, not flex wrapping or independently computed CSS gaps. True paragraph last line stays left aligned; paragraph continuation at a page break is not paragraph end. First-line indent defaults to 4ch, exactly once per paragraph.
- Fill each page with the maximum number of complete measured lines. No widow/orphan or sentence-boundary scores; paragraph gap is counted only when actually displayed. Keep text inside bounds.
- Page switching is deterministic from timestamps, preview seeking and export frame times. Ensure no replay-dependent state and no premature reveal of the next page.
- Validate play/pause/stop, frame steps, seek ±10/±30s, volume, mute, normal speed and the open-file keyboard command. JSON is the only import entry: search exact-stem same-directory MP4 → MKV → MP3 → WAV. Ctrl+F remains unbound. Ignore shortcuts while typing/editing; do not override operating-system shortcuts unnecessarily.
- Guard against missing/invalid MP4/MKV/MP3/WAV/JSON, export failures, process hangs, duplicate sound tracks, cancellation, resource leaks and overwrites. Snapshot export inputs so subsequent edits do not affect a running render.

## 4. Maintainability and minimal repairs

- Evaluate cohesion, dependencies, naming, error handling, complex duplication, dead code, temporary files and `.gitignore`.
- Favor small, clear functions, direct control flow and tested behavior over abstractions, clever syntax or fewer lines. Do not change already-correct behavior for style alone.
- Classify findings as (a) correctness/security issues, (b) maintainability opportunities, (c) optional style. Implement necessary low-risk corrections; discuss functionality-changing or major architecture proposals before applying.
- Never delete user media, project data, source subtitles, assets or unrelated uncommitted changes. Update docs when behavior changes.

## 5. Verification gates

Run as applicable from the repository root:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test:skill
dotnet publish desktop/TranscriptStudio.csproj -c Release -o dist/wpf
```

- `npm test` alone is **not** full TSX/Vite validation. Do not report the application as tested when only core tests passed.
- In Windows UI verify icon, button order, seeking, frame stepping, JSON picker, media priority, audio-only rendering, configurable canvas dimensions, and key conflicts; test actual MP4 output (video/audio duration, quality, page boundaries and sync).
- If a command cannot run in the environment, explicitly state it as **not verified** rather than implying success.
- Include negative tests for malformed v2, bad word timestamps, duplicated marks, mismatched project fingerprints and paths outside selected folders.

## 6. GitHub commit discipline — English only

- Inspect `git status`, current branch, upstream and `.gitignore`. Never discard or stage unrelated user changes.
- All new Git **commit messages must be in English**, including subject and optional body. Prefer Conventional Commits: `fix: ...`, `feat: ...`, `refactor: ...`, `test: ...`, `docs: ...`, `chore: ...`.
- Example: `fix: correct playback shortcut handling and improve transcript validation`.
- Run applicable checks before committing. If authorized and a remote is configured, push **the current branch to its upstream**, never force push; do not switch or merge branches without approval.
- If unable to access Git or remote, provide the precise commands and explicitly say no commit/push happened.

## Deliverable

Summarize checked areas, critical findings, minimal changes, files removed (if any), tests actually run, UI/export checks not run, remaining issues, and Git commit/push status.
