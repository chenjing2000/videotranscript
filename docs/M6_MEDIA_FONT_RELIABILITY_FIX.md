# Transcript Studio M6: preview typography and media diagnostics

## Fixed

- The right transcript editor now uses the same visual **font family, weight, size, color and line-height** as the scaled left reader preview. The exported MP4 continues using the **original logical font size** (e.g. 40 px in a 1200px-wide logical canvas). Only the editor's on-screen font size is multiplied by `previewDisplayWidth / outputCanvasWidth`.
- In *video* mode a provisional video slot remains visible before metadata arrives. Failure to read the video is no longer visually identical to an audio-only transcript. Actual metadata dimensions replace the provisional ratio. Audio-only mode still uses the full output canvas.
- Import notifications show the actual matched media filename. Once metadata is ready, a second notification shows name, kind and duration. The import toolbar tooltip shows the current filename even after the toast expires.
- Media errors include actual filename and browser media error category (aborted/network/decode/unsupported). The persistent error notice must be manually dismissed.
- If no matching media exists, the native loader shows the JSON filename, exact directory and expected names with the priority `mp4 → mkv → mp3 → wav`.
- Export is disabled while a selected media item is still loading or has an error. No silent audio-mode fallback occurs for an unplayable video.

## Windows acceptance checklist

1. Place `Example.transcript-studio.json` next to `Example.mp4`; open JSON. The notice must identify `Example.mp4`, the preview must show a loading slot and then video, and the right editor text should be visually the same size/weight/family as the left text after scaling.
2. Drag the window horizontally, vertically and diagonally. The left preview should scale to the available space; the editor's **on-screen text** should scale with it without changing the MP4 canvas size or pagination.
3. Open a JSON file with no matching companion. The persistent error must list the four expected exact filenames and source directory.
4. Open a JSON matched to a corrupted video file. A video loading/error region should remain; the persistent notice should name the actual file and contain the media error reason. It must **not** enter audio mode.
5. Open a JSON with only matching MP3 or WAV. The transcript should use the full canvas and audio playback should work.
6. Test MP4 and MKV separately; MKV recognition does **not** guarantee WebView2 codec support. Test actual codecs in the installed Windows WebView2 runtime.
7. With a valid video test play/seek/stop and MP4 export; compare visual text and colors in preview against output.

## Verification completed here

- `npm test`: core tests, including three new font/media diagnostics tests.
- `npm run test:skill`: Python subtitle tests.
- TypeScript syntax parsing using the installed TypeScript compiler module.

**Not verified here:** `npm run verify`, Vite production build, .NET WPF publish, and Windows media/MP4 playback. The offline npm cache does not include all project dependencies.

To validate in Windows CMD:

```bat
cd /d E:\Projects\TranscriptStudio
npm.cmd ci
npm.cmd run verify
dotnet publish desktop/TranscriptStudio.csproj -c Release -o dist/wpf
dist\wpf\TranscriptStudio.exe
```

Git commit messages must be in English. No Git commit/push was performed in this delivery.
