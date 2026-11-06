> **Historical M6.5 note:** The project path described below was replaced by the M6.12 breaking storage layout. Current project and article paths are documented in `M612_BREAKING_STORAGE_LAYOUT.md` and `DATA_MODEL.md`.

# Transcript Studio M6.5 — Settings and framework-dependent deployment

## Decisions

- The original M6.5 settings file was `voicetranscript.settings.json`. Since M6.15.8, the current file is `transcriptstudio.settings.json` **next to TranscriptStudio.exe**; it is created automatically on first launch and atomically replaced on every valid settings change. When only a valid legacy file exists, the app migrates its values to the new filename and `transcriptstudio-settings` marker, while retaining the original file unchanged.
- Editing and exporting continue to use a per-media project snapshot at `<media-folder>/.transcript-studio/projects/<media-stem>/project.settings.json`. Distinct videos in the same directory cannot overwrite each other.
- Existing M6 `.project.json` files are not automatically migrated. Back them up before upgrading; the source subtitle JSON is not modified.
- The right editor font (family, DIP size, text color, background color) is independent of the left video font. Video styles and output dimensions are defaults for new projects, but projects retain their own saved snapshots.
- New paragraph indentation is measured in em. Existing projects using `firstLineIndentCh` remain readable by the pagination engine.
- The app is **framework-dependent**; .NET Desktop Runtime 10 and Microsoft Edge WebView2 Runtime are not bundled. Missing .NET is reported by the OS/.NET host; missing WebView2 is reported by the app without downloading anything.
- Node.js 22+ and npm must be installed by the user; the app never downloads them. On export it may, with consent, run `npm ci` with the locked package list in `runtime/node_modules`, and Remotion's `ensureBrowser()` to prepare the rendering browser.
- The app extracts embedded web UI files into `%LOCALAPPDATA%/TranscriptStudio/ui/<assembly-version>/`; the source media streaming bridge remains unchanged. Extracted Node/Remotion runtime *source* and modules stay in `<exe-folder>/runtime/`.

## Windows build (CMD)

```bat
cd /d E:\Projects\TranscriptStudio
npm.cmd ci
npm.cmd run verify
dotnet publish desktop/TranscriptStudio.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist/wpf
```

Publish `dist\wpf\TranscriptStudio.exe` only, after verifying the publish output contains no additional mandatory files. The configuration file will be created on first launch. This build does **not** embed .NET or Node.js.

## Windows end-to-end acceptance checklist

1. Launch with .NET Desktop Runtime 10 and WebView2 installed; first launch creates `transcriptstudio.settings.json` beside the EXE. When upgrading, verify that a valid `voicetranscript.settings.json` is migrated and retained unchanged.
2. Close, reopen, confirm retained settings; test invalid configuration backup and read-only folder error.
3. Settings labels and controls share a row; right editor text is 16 DIP independent of left preview zoom; right color and background apply only to the editor.
4. Open same-name MP4 + standard subtitle JSON; play, seek, save `project.settings.json`, reopen and recover edits.
5. Keep two video/subtitle pairs in the same folder; confirm distinct project directories.
6. With Node.js absent, verify the editor works and export tells the user to manually install Node.js.
7. With compatible Node.js installed, test first export's npm and browser prompts; decline and retry, then accept and export valid H.264/AAC MP4.
8. Test an unwritable EXE directory and incomplete network downloads. Neither failure should destroy media or subtitle files.
9. Test publishing on a clean Windows machine with no previously generated `ui/` folder. Check the official single-file output is a **single EXE**.

## Current test coverage / limitations

Pure TypeScript core and subtitle Skill tests can run on non-Windows hosts. The provided build environment cannot execute WPF, .NET publishing or a complete Remotion export; these require the Windows acceptance steps above. A successful TypeScript unit test run does not certify WPF compilation or runtime installation.
