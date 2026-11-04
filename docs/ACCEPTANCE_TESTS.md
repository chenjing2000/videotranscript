# Video Transcript M5 Acceptance Checklist

## Automated, cross-platform
```powershell
npm.cmd ci
npm.cmd run verify
```
`verify` runs TS typecheck, Vite build, 41+ core tests and Python Skill tests. Source validation, word IDs, breaks, time invariance, line geometry, justify and greedy fill are covered. Review each reported failure; do not proceed to publish if Vite did not generate `dist/index.html`.

## Windows-specific
```powershell
dotnet publish desktop/VideoTranscript.csproj -c Release -o dist/wpf-m5
.\dist\wpf-m5\VideoTranscript.exe
```
Confirm video/source file pair `6 Minute English 01-seg1.mp4` / `6 Minute English 01-seg1.video-transcript.json`. `animal lovers.` must not end a paragraph; `In the UK...` continues without first-line indentation. Test multiple page sizes, justify and left alignment, backward seek, editable word break, save/reopen, export MP4 with audio once, preview/export page consistency.

## Negative tests
Refuse original `*.json`, deprecated `*.evr-transcript.json`, missing or wrongly named v2, wrong `video_transcript` schema, `breakParagraph:false` in subtitle, marker on terminal word or `word_segments`, changed/mismatched SHA, and old project schemas.

## Observability
Every non-final page must use maximal whole lines. When a page appears short, inspect `usedHeight`, `availableHeight`, height of next line and paragraph gap. Do not assume a semantic or widow/orphan constraint: M5 intentionally has none.
