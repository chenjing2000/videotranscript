# Video Transcript — M5

Windows application for readable English video transcripts: WPF/.NET 10 + WebView2 + React/TypeScript + Remotion. Source MP4/audio are preserved. Logical 1200×1600 portrait output with still pages, explicit word positioning and progressive word highlights.

## Breaking changes
- Only `<video-stem>.video-transcript.json` with `video_transcript.format = "video-transcript"`, `schemaVersion = 2` is accepted.
- The only paragraph marker is `segments[].words[].breakParagraph: true` (omit when not breaking). `word_segments` remains unchanged.
- Original WhisperX JSON, v1/EVR subtitles and previous project schemas are unsupported; no migration utility.
- Project files live at `.video-transcript/projects/<stem>.project.json` and use `video-transcript-project` schema v2.
- All internal paragraph flag names use `breakParagraph`. Automatically assigned word IDs remain `s<segment>w<word>`.

## Build (Windows PowerShell)
```powershell
npm.cmd ci
npm.cmd run verify
dotnet publish desktop/VideoTranscript.csproj -c Release -o dist/wpf-m5
.\dist\wpf-m5\VideoTranscript.exe
```
`verify` checks full TypeScript, Vite, core tests and Skill tests. Requires Python 3.10+ for Skill tests and .NET 10 SDK for Windows publish. The warning about `esbuild` install script may require npm script approval in your environment.

## Standardize subtitle
See `docs/skills/video-transcript-paragraphs/SKILL.md`. The Skill uses AI-reviewed word ID decisions during processing, but writes word-local `breakParagraph` marks into the final video subtitle. Preview paragraphs in `.paragraphs.md` before publishing.

## Export CLI
```powershell
npm.cmd run export -- --video "video/lesson.mp4" --json "video/lesson.video-transcript.json" --out "video/exports/lesson.mp4"
```
WPF drives the export directly and snapshots the project/page plan for determinism.

## Layout invariants
- `breakParagraph` alone decides natural paragraphs; punctuation alone never causes a paragraph break.
- Word positions use deterministic computed `x` coordinates; the renderer does not reflow into another line.
- Word-style justification applies to all but the true last line of a natural paragraph.
- Each page takes every full line that fits, with no widow/orphan/semantic break penalties; paragraph gap is charged only between actual paragraphs **on the same page**.
- For every non-last page, the next line (+ any on-page paragraph gap) is too tall to fit.
- Preview and Remotion share the same page plan. Source word timing is immutable.

See `docs/M5_DESIGN_AND_VALIDATION.md` for acceptance and caveats.

## Playback, shortcuts and review skills

See [player shortcuts](docs/PLAYBACK_SHORTCUTS.md). The code review Skill is in `docs/skills/video-transcript-code-review/SKILL.md`; the transcript paragraphing Skill is in `docs/skills/video-transcript-paragraphs/SKILL.md`. All GitHub commit messages for this project must be written in **English**.
