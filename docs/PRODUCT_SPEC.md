# Transcript Studio — product specification (M6.13)

Transcript Studio combines a same-stem MP4/MKV/MP3/WAV source with a paginated English reading surface on a configurable even-pixel canvas (default 1200×1600). Word-level progress highlighting, semantic paragraphs, explicit word x coordinates, deterministic page switching, inline word editing and H.264/AAC MP4 export are shared between preview and Remotion rendering.

## Source contract

Only `<stem>.transcript-studio.json` (Transcript Studio v2, English) is accepted. Natural paragraphs are represented only by `segments[].words[].breakParagraph: true`; no punctuation, source-segment or pause-based inference is performed. Source timestamps and WhisperX fields remain unchanged.

## Editing and persistence

Word display changes, hidden state and paragraph-boundary overrides are stored separately from source subtitle JSON. For a source file `<stem>.transcript-studio.json`, the work directory is `<subtitle-directory>/<stem>/`, containing `<stem>.project.json` and, after plain-text export, `<stem>.article.txt`. This is the M6.12 breaking storage layout; the former `.transcript-studio/projects/.../project.settings.json` location is not read or migrated. The project schema itself remains v2.

Plain-text export writes the current visible right-pane content directly to `<stem>.article.txt` as UTF-8 without BOM with CRLF line endings. It contains no timestamps or styling and does not repair spelling or punctuation.

## Interface

The right-pane toolbar order is Settings → Import JSON → Save Project → Export Plain Text → Export MP4. Floating notices, including the active MP4 preparation/render status, are anchored at the bottom of the right pane outside the transcript flow. The settings dialog is draggable by its title bar and constrained to the WebView client area.

## Platform

The desktop app is WPF/.NET 10 + WebView2 + React/TypeScript + Remotion. The application does not install .NET Desktop Runtime, WebView2 Runtime or Node.js for the user. MP4 export may prepare locked npm dependencies and Remotion's dedicated Chrome Headless Shell after explicit confirmation.
