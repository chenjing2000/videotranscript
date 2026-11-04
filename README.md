# Transcript Studio — M6

Windows reading-video editor based on **WPF (.NET 10) + WebView2 + React/TypeScript + Remotion**. Import a Transcript Studio v2 JSON file, automatically locate same-stem media, edit timestamped words, and export an MP4 in a configurable resolution.

## Import and media priority

1. Select `Lesson.transcript-studio.json` (the **only** import file type).
2. Search **the JSON file's directory only** for `Lesson.mp4`, then `Lesson.mkv`, then `Lesson.mp3`, then `Lesson.wav` (case-insensitive filenames).
3. Use video + subtitles if a video exists; otherwise display full-canvas subtitles with audio playback. If no media matches, display an error requiring user dismissal.
4. MKV containers may have video codecs unsupported by WebView2. No automatic remux/transcode exists in M6.

## Transcript contract

`transcript_studio: {"format":"transcript-studio","schemaVersion":2}`, English `segments[].words[]` and word-local `breakParagraph: true` for paragraphs. `word_segments` and source word timings are not modified. M5 formats are intentionally unsupported. Prepare/validate using `docs/skills/transcript-studio-paragraphs/SKILL.md`.

## Build (Windows PowerShell)

```powershell
npm.cmd ci
npm.cmd run verify
dotnet publish desktop/TranscriptStudio.csproj -c Release -o dist/wpf
.\dist\wpf\TranscriptStudio.exe
```

## CLI export

```powershell
npm.cmd run export -- --media "video/Lesson.mp3" --json "video/Lesson.transcript-studio.json" --out "video/exports/Lesson.mp4"
```

Use `--project path/to/Lesson.project.json` for customized canvas size, editing overrides and typography. Requires FFmpeg/ffprobe for media inspection (or explicitly supplied media duration in the desktop path). Default canvas is 1200×1600. Output supports any even width/height in the configured range 320–3840.

## Architecture and review

- Shared word-x layout and deterministic pagination: `src/core/`.
- Single React view for WebView2 and Remotion: `src/ui/ReaderCanvas.tsx`.
- Windows file permissions, native media discovery, snapshots and Node export process: `desktop/`.
- Remotion compositions and renderer: `src/remotion/` and `scripts/export.mjs`.
- Skills: `docs/skills/transcript-studio-paragraphs/` and `docs/skills/transcript-studio-code-review/`.
- Complete M6 changes, acceptance checks and known limitations: `docs/M6_IMPLEMENTATION_AND_VALIDATION.md`.

All Git commit messages must be in **English**; prefer Conventional Commits such as `feat: add JSON-driven audio and video reading modes`.

## Responsive preview (M6 update)

The left canvas preview keeps the project output aspect ratio and is never less than 360 DIP wide. A 3-DIP inset frames both sides and the top; the progress controls touch the bottom of the preview, with 3 DIP below. The right transcript editor takes the remaining window width (minimum 240 DIP). The volume slider has been removed from the transport. Change the final exported MP4 width and height in **Settings → 输出视频尺寸**; resizing the app window changes preview scale only. See `docs/M6_IMPLEMENTATION_AND_VALIDATION.md` for the exact geometry and Windows acceptance tests.
