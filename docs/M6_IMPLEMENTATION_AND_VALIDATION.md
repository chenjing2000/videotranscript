# Transcript Studio M6 — implementation notes

## Product contract

- Product: **Transcript Studio** (EXE `TranscriptStudio.exe`, namespace `TranscriptStudio`).
- Only `*.transcript-studio.json` (Transcript Studio v2, `transcript_studio.format: transcript-studio`) is an import entry. Older M5 `.video-transcript.json` is intentionally rejected. **No migration tool or fallback path**.
- Desktop media auto-discovery is case-insensitive, exact stem, same directory only: `.mp4` → `.mkv` → `.mp3` → `.wav`. No recursive search, no silent fallback after a selected media file fails decoding.
- Video mode: source occupies canvas width proportionally, transcript uses the remaining canvas. Audio mode: transcript fills the logical canvas and the original audio is used for playback and MP4 export.
- Canvas `width`/`height` are per-project even integer pixel values in [320, 3840], default 1200×1600. Output MP4 matches project dimensions. Aspect ratio is not locked.
- Responsive geometry (M6 revision): the output canvas is only the rendered reading/video frame. Its desktop preview maintains the configured output aspect ratio; the surrounding frame is **6 DIP wider** (3 DIP at each side). There is **3 DIP above the preview**, and **3 DIP below the transport**. A 48-DIP-high transport attaches directly to the canvas bottom, matches preview width, and stays outside the MP4 export. Workspace client top/bottom inset is 2 DIP each. Minimum preview width: 360 DIP; minimum subtitle-editor width: 240 DIP. The editor takes all otherwise unused width, rather than a 3:2 ratio. Main window native minimum height varies with output aspect ratio.
- Right panel always shows word-level subtitle editing (no tabs). Current toolbar order (M6.12+): Settings, Import JSON, Save Project, Export Plain Text, Export MP4. Buttons use circular `#D3E5EB` fill with no visible border.
- Left-canvas font settings and right-editor font settings are independent. The left font controls the rendered reading canvas; the right font controls the editable transcript pane. The settings dialog opens centered in the WebView client area and can be dragged by its title bar.
- The on-screen volume bar and its filename tooltip are removed. Volume keyboard shortcuts remain available. Transport time is centred **above the progress track**, and play/pause and stop buttons are placed to its right. Normal notices disappear after 5 seconds; errors require manual dismissal. Export progress has a separate persistent status while rendering; ordinary completion messages still expire in 5 seconds.
- Window and HTML document title: `Transcript Studio`. `AllowCors` replaced by WebView2 `Allow` for local media host only; the UI host remains `DenyCors`.
- All Git commit messages (subject and body) **must be in English**. No Git commit or push is performed by this archive.

## Contract preservation

- `segments[].words[].breakParagraph: true` defines paragraph boundaries; no automatic inference from punctuation or WhisperX segments.
- Word IDs, source timestamps, display overrides, hidden words, absolute x coordinates, true paragraph-last-line alignment and sequential page filling are preserved.
- Source JSON bytes fingerprint stored in the project and verified by WPF/CLI.
- Saved projects and prior subtitles from M5 are not compatible with the M6 product prefix by design.

## Windows verification

```powershell
npm.cmd ci
npm.cmd run verify
dotnet publish desktop/TranscriptStudio.csproj -c Release -o dist/wpf
.\dist\wpf\TranscriptStudio.exe
```

Test with four same-stem variants and ensure priority is as specified; then test audio-only MP3 and WAV files; verify audio output exists in exported MP4 using `ffprobe`. Check `.mkv` in WebView2 with known codecs: `.mkv` container support is codec/platform dependent and may fail to decode in preview; **no transparent transcode fallback is implemented**.

Test 1200×1600, 1080×1920, 1920×1080 and 1080×1080 project canvases; after changing width, video height must be recomputed from the source aspect ratio, and subtitle pagination must update. Verify output dimensions with `ffprobe` and compare representative frames with the WPF preview.

Test multi-minute export, error notices, invalid/mismatched JSON, malformed words, no media, and cases where the last subtitle ends beyond media duration. Verify input changes during exporting cannot change the export snapshot.

## Known limitations / follow-ups

- The portable browser fallback cannot infer a file's sibling directory from a picked JSON without an additional folder permission. WPF is the reference import workflow.
- MKV may require separate local transcoding support for WebView2 previews; currently unsupported codecs report an error instead of silently switching to audio.
- Frame stepping on variable-frame-rate material seeks by the configured project FPS; it is not exact decoded-frame stepping.
- Export status remains visible while rendering. The active notice can cancel the current task; the host terminates only the task's child-process tree and waits for cleanup. Closing during rendering offers `继续导出` / `取消导出并退出`; during the non-cancellable commit phase it waits for the save to finish.
- Full Windows WPF build, actual WebView2 preview and actual MP4 export must be verified on a Windows machine; unavailable in this environment.

**Important aspect-ratio case:** a 1920×1080 canvas paired with 16:9 source video will use all 1080 canvas pixels for video, leaving no text area. The layout correctly rejects that configuration; choose a taller canvas or a video with a different aspect ratio. M6 does not auto-crop or auto-shrink the video to create room for subtitles.

## Responsive window layout regression (M6 revision)

- `src/core/workspace-layout.ts` holds the numeric geometry rules. `tests/m6-workspace-layout.test.mjs` tests the equations (including portrait, landscape, diagonally resized space, and width-only expansion). No viewport resize alters the logical canvas dimensions or recomputes the page plan.
- Let output aspect `r = outputHeight/outputWidth`. With `C=48` DIP transport and 3 DIP on each framed side, the displayed preview is `(W, rW)` and its framed group is `(W+6, rW+48+6)`.
- Workspace uses `2 DIP` on both vertical ends, `10 DIP` horizontal padding and `12 DIP` column gap. Required client width `638 DIP` (360+6+12+240+20). Required client height `ceil(360*r+48+6+4)`.
- Preview width is `max(360, floor(min((availableHeight-48-6)/r, availableWidth-6-12-240)))`. The editor takes the remaining width and is at least 240 DIP. The window's nonclient frame/title bar dimensions are added to minimum **client** dimensions by WPF.
- The displayed canvas is uniformly scaled using `W/outputWidth`. The video+subtitle renderer and export remain at project output pixels. Moving the app window or dragging its borders must not repaginate.
- The time label is in the row above the progress track and horizontally centered over the **track**, not the full transport including its buttons.
- `ReaderWindow.cs` handles a `layout` message from WebView2 to update native minimum dimensions. On first initialization it chooses a comfortable window size for the output aspect ratio; subsequent border/corner dragging is not forcibly overridden.
- For very extreme output aspect ratios, a strict minimum 360-DIP preview might exceed the monitor's usable height. This version preserves the mandated minimum, which can cause the Windows window to extend off-screen; such ratios should be avoided or handled in a later screen-aware layout policy.

Windows acceptance: resize rightwards, downwards, and diagonally, including maximization and restoring. Confirm the preview does not distort or recalculate pages; the transport remains flush with the preview and never wider, while the right panel consumes horizontal slack. Test both audio-only and video content, and compare MP4 pixel dimensions against project settings.


## M6.12+ persistence update

The M6.5 `.transcript-studio/projects/.../project.settings.json` location described in older notes is superseded. Current projects are stored at `<subtitle-directory>/<stem>/<stem>.project.json`; plain text exports are stored beside them as `<stem>.article.txt`. See `docs/M612_BREAKING_STORAGE_LAYOUT.md`.
