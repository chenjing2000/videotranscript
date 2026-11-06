# Transcript Studio — current data model (M6.15.8)

## Subtitle input

The app accepts only `<stem>.transcript-studio.json` with:

- `language: "en"`;
- `transcript_studio.format: "transcript-studio"`;
- `transcript_studio.schemaVersion: 2`;
- word-local `segments[].words[].breakParagraph: true` markers.

An omitted `breakParagraph` means no boundary. `false`, `null`, strings and numbers are invalid in subtitle input. The final word cannot carry a marker. `word_segments` remains an unchanged WhisperX copy without paragraph markers. The parser generates internal IDs `s<segmentIndex>w<wordIndex>`; IDs are not written into source words.

## Runtime word model

Each parsed word contains its stable ID, segment ID, original text, display text, source/display baselines, start/end times, optional score, hidden state and effective paragraph-break state. Editing display text never changes source timestamps. Hiding a word does not erase a paragraph boundary attached to that word; layout and plain-text export preserve the visible boundary without emitting the hidden token.

## Project model

Project files remain `format: "transcript-studio-project"`, `schemaVersion: 2`. They contain source media/subtitle names, subtitle SHA-256, sparse word overrides, canvas dimensions, reading style and export settings.

For `lesson01.transcript-studio.json`, the current path is:

```text
<subtitle-directory>/
├── lesson01.transcript-studio.json
├── lesson01.mp4                 # or .mkv / .mp3 / .wav
└── lesson01/
    ├── lesson01.project.json
    ├── lesson01.exported.mp4       # created after successful MP4 export
    ├── lesson01.article.txt        # created after plain-text export
    └── cache/                      # temporary task data; failed renders may be retained for recovery
```

M6.12 intentionally removed legacy project discovery and migration. The old `.transcript-studio/projects/<stem>/project.settings.json` path is not read, moved or deleted. The new work directory is created on first project save, plain-text export or MP4 export, not on import. Existing project files at the new path are validated before the host unlocks overwrite; a corrupt or mismatched project is not silently replaced.

An override can contain `display`, `hidden` and/or `breakParagraph`. `breakParagraph: true` adds a boundary, `false` removes a source boundary, and omission inherits the source value. Source subtitle bytes remain unchanged.

## Plain-text article export

The current right-pane visible text is written to `<subtitle-directory>/<stem>/<stem>.article.txt` without a file picker. Output is UTF-8 without BOM, Windows CRLF, one blank line between paragraphs, no trailing blank line, no timestamps or styling, and no automatic spelling/punctuation correction. Hidden tokens are omitted while their paragraph boundary is retained. Exporting text does not save the project or clear its dirty state.

## MP4 export

The WPF host passes an immutable project and page-plan snapshot to Remotion. The renderer uses the selected media once (video audio remains part of `OffthreadVideo`; audio-only sources use one `Audio` component). The default desktop MP4 output is `<subtitle-directory>/<stem>/<stem>.exported.mp4`, in the same directory as `<stem>.project.json`. Temporary render data is isolated under that work directory's `cache/render/job-<guid>/` and `cache/temp/` folders. A failed final commit retains the rendered `<stem>.exported-<guid>.mp4.tmp` for manual recovery. The project and source subtitle are not modified by rendering.

## Global settings

`transcriptstudio.settings.json` lives beside `TranscriptStudio.exe`, is created with defaults on first launch and is atomically replaced after valid setting changes. Its JSON marker is `transcriptstudio-settings` (schema version 1). When upgrading from an installation that has only `voicetranscript.settings.json`, the host validates the legacy file, fills missing fields from defaults, changes the format marker, and atomically writes the new file. The original legacy file is retained unchanged after successful migration. Global settings are separate from per-subtitle project files.
