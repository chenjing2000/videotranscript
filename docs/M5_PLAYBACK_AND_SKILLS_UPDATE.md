# Video Transcript — player controls, skills and icon update

## Implementation

- Transport controls have been reordered to progress slider, time, play/pause icon, and stop icon. Stop calls `pause()` and seeks to 0; play/pause icon follows actual media events.
- Keyboard bindings are implemented by `src/core/player-shortcuts.ts` and wired in `src/main.tsx`; see `docs/PLAYBACK_SHORTCUTS.md`. While an edit box, select, text area, content-editable region or seek slider has focus, the shortcuts are ignored to avoid disrupting edits. Modifier/shift combinations that are not specified are ignored. Frame stepping is approximate seeking by `1 / project.export.fps`, not a decoder-exact frame advance; variable frame-rate MP4 may require a more sophisticated decoder approach.
- `Ctrl+O` opens an MP4 picker; the folder picker is opened only by the visible button (no keyboard shortcut). WPF uses a native `OpenFolderDialog` and displays MP4 files in the chosen folder. When opening by folder selection it serves the video to WebView2 through a mapped media host; the C# host ensures the selected MP4 belongs to the chosen folder. The standard `.video-transcript.json` must still exist next to the MP4. In browser dev mode, directory upload is used where supported.
- `desktop/assets/app.ico` is embedded into `VideoTranscript.exe`; `public/app.ico` is the same icon used as the website favicon. Both are copied from the user-supplied ICO, not redrawn or altered.
- Both reusable Skills are under `docs/skills/`: `video-transcript-code-review` and `video-transcript-paragraphs`. Their scripts, tests and references remain together. The `test:skill` script and all project docs were updated to match the new folder path.
- The code-review Skill requires **English-only GitHub commit subjects and bodies**, recommends Conventional Commits, and forbids forced pushes.

## Verified in this environment

- `npm test`: 57/57 pass (41 existing and 16 additional shortcut tests).
- `npm run test:skill`: 6/6 pass.
- ICO checked for 16, 32, 48, 128 and 256 pixel sizes.

## Not verified in this environment

- `npm run typecheck` / `npm run build`: dependency install unavailable due incomplete offline npm cache (`zod-4.5.4.tgz` missing).
- `dotnet publish`: Windows/.NET SDK unavailable here.
- Actual WebView2 MP4 playback, native folder picker, keyboard focus, media mapping, full Remotion export: requires Windows validation.

## Windows verification

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test:skill
dotnet publish desktop/VideoTranscript.csproj -c Release -o dist/wpf
.\dist\wpf\VideoTranscript.exe
```

### Manual checks

1. Verify window/taskbar icons use uploaded ICO; confirm progress/time/play/pause/stop order.
2. Click play then pause, stop at nonzero time, confirm paused at 0 and icon updates.
3. Try each shortcut in `docs/PLAYBACK_SHORTCUTS.md`; verify text editing and progress-slider focus suppress key commands.
4. Open single MP4 via Ctrl+O and a folder via the visible button; choose MP4 in the folder list; verify companion v2 JSON loads automatically and Windows path check prevents wrong-folder path.
5. Seek, adjust volume, mute/unmute, step frame, return to 1x and verify normal playback.
6. Save/reopen v2 project, export MP4, confirm timestamps, visual page changes and original audio retained once.
7. Check `git status` and `.gitignore`, stage only intended changes. Use English Conventional Commit messages.

## Suggested English commit message

`feat: add player shortcuts, native folder browsing and review skills`
