# Transcript Studio M6.12 — Breaking storage-layout change

M6.12 intentionally does **not** discover, import, or migrate the old `.transcript-studio/projects/<media-name>/project.settings.json` layout. The internal project schema remains `transcript-studio-project` version 2: the breaking change concerns file discovery and persistence paths, not the JSON shape. Existing legacy files are not deleted.

## Required file layout

For `D:\EnglishVideos\lesson01.transcript-studio.json` (with corresponding `lesson01.mp4`, `.mkv`, `.mp3`, or `.wav`):

```text
D:\EnglishVideos\
├── lesson01.transcript-studio.json
├── lesson01.mp4
└── lesson01\
    ├── lesson01.project.json
    └── lesson01.article.txt
```

Only `*.transcript-studio.json` is accepted. The directory stem is derived by stripping that **entire suffix**, case-insensitively. Work directories are created on first save/export, never during import. Both files use the same work directory even if the user currently has a video loaded.

## Later MP4 storage update (M6.15)

M6.12 left the then-current MP4 output behavior unchanged. M6.15 subsequently moved the **desktop app's default MP4 output** beside the project JSON: `<stem>/<stem>.exported.mp4`. The same work directory contains `cache/render/` and `cache/temp/` for task-scoped temporary data. See `M615_EXPORT_LIFECYCLE.md` for commit, cancellation and recovery behavior. This later update does not change the v2 project JSON schema.

## Commands and behaviors

- Toolbar left to right: **Settings → Import JSON → Save project → Export plain text → Export MP4**.
- Save project: writes `<stem>.project.json` via temporary-file write and replacement. Its source media name, transcript name, hash, and project format/version must match the imported pair.
- Open JSON: loads the project **only** from the new work-directory path. If no project file exists, start a blank project.
- If the new project file exists but cannot be parsed, validated, or applied, display an error and **block overwriting it** until the source is reopened with a valid project. The WPF layer enforces the lock independently of the frontend disabled state.
- Export plain text: **no SaveFileDialog**. Overwrite `<stem>.article.txt` directly via temporary-file write and replacement. Data is the current visible transcript, without timestamps, formatting, spellcheck, or punctuation changes; paragraph boundaries are separated by a blank CRLF line. UTF-8 without BOM.
- If a word editor is active, project save, plain-text export and MP4 export validate and commit its contents before creating the output snapshot. MP4 export recalculates the page plan from that exact word snapshot.
- A paragraph boundary attached to a hidden word is retained in layout and plain-text export, while the hidden token itself is omitted.
- MP4 export path and Remotion / Chrome Headless Shell behavior remain unchanged.
- Web-only development mode cannot silently write into the local subtitle directory; it retains browser downloads but uses the new `.project.json` and `.article.txt` filenames.

## Windows acceptance checklist

1. Import `lesson01.transcript-studio.json` with a companion media file. No work directory should be created merely by importing.
2. Save project: confirm `<stem>/<stem>.project.json` is written and can be reloaded on reopening the JSON.
3. Edit words and paragraph breaks, export plain text: confirm `<stem>/<stem>.article.txt` is written without a file picker, in UTF-8 without BOM, with CRLF and an empty line between paragraphs.
4. Export plain text twice and verify the fixed target file is replaced with current text.
5. Place a malformed `<stem>.project.json` in the new directory and reopen the source: verify an explicit error and disabled project save; confirm the damaged file stays unchanged.
6. Place an old `.transcript-studio/projects/.../project.settings.json` only, reopen source: verify that it is not loaded or altered.
7. Test a JSON location without write permissions and confirm a clear failure instead of falling back to another directory.
8. Check the five right-toolbar button positions and verify MP4 export still works.

## Verification limits

Core TypeScript and Skill tests were run in the authoring environment. A complete Vite build and WPF publish require the Windows development environment with full npm dependencies and .NET SDK. Do not treat source-pattern assertions as a substitute for GUI/OS acceptance testing.
