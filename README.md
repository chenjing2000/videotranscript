# Transcript Studio — M6.15.6.2

> Current source includes the WPF single-instance/tray lifecycle, project-local export cache, cancellable rendering, validated MP4 commit, revision-based unsaved-state tracking and unified Fluent dialogs with viewport-safe layout. See `M6.15_RELEASE_NOTES.md`, `docs/M615_EXPORT_LIFECYCLE.md`, and `docs/M614_SINGLE_INSTANCE_AND_TRAY.md`.

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

Use `--project path/to/Lesson.project.json` for customized canvas size, editing overrides and typography. `--cache-dir path/to/cache` is optional; when omitted, the CLI creates `.transcript-studio-cache/` beside the output file. The desktop app supplies its own project-local task cache and media metadata. CLI export uses `ffprobe` to inspect media when duration or video dimensions are not supplied. Default canvas is 1200×1600. Output supports any even width/height in the configured range 320–3840.

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


## Framework-dependent deployment

Portable application preferences: `voicetranscript.settings.json` next to `TranscriptStudio.exe` (created on first launch). For `Lesson.transcript-studio.json`, the current work directory is `Lesson/`, containing `Lesson.project.json`, `Lesson.exported.mp4` (after MP4 export), `Lesson.article.txt` (after text export), and a `cache/` directory for temporary render data. This is the M6.12 breaking storage layout; the legacy `.transcript-studio/projects/.../project.settings.json` path is not read or migrated.
The right editor font family/size/colors are independent of video typography; standard left-font and output defaults are stored globally but existing projects retain their own layouts.
Windows deployment: `npm.cmd run verify` then `dotnet publish desktop/TranscriptStudio.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist/wpf`. Distribute the resulting EXE after verifying the single-file output. The user installs .NET Desktop Runtime 10 and WebView2; Node.js 22+ is required only to export MP4. No system prerequisites are automatically installed by the app. On the first export, the program can prepare locked npm packages and Remotion's rendering browser with consent. See `docs/M65_SETTINGS_AND_DEPLOYMENT.md`.
