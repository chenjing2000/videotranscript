# Transcript Studio M5 — Data model and persistence

## Input
WhisperX raw JSON is only a source for the Skill; the app accepts `<video-stem>.transcript-studio.json` with `transcript_studio: {format:"transcript-studio", schemaVersion:2}`. Paragraphs are marked solely with optional `segments[].words[].breakParagraph:true`; final word never marked. `word_segments` stays original and untagged.

The parser assigns internal stable IDs `s<segmentIndex>w<wordIndex>` (indices zero-based). Each word has immutable `original`, `start`, `end`, `score`, with editable `display`, `hidden`, `breakParagraph`. `sourceBreakParagraph` and `sourceDisplay` are runtime baselines; they are not input fields.

## Project
Persist under `<video-dir>/.transcript-studio/projects/<stem>.project.json`. Strict project schema:

```json
{
  "format": "transcript-studio-project",
  "schemaVersion": 2,
  "source": {"videoName":"lesson.mp4","subtitleName":"lesson.transcript-studio.json","subtitleSha256":"HEX_HASH"},
  "overrides": {"s10w38":{"breakParagraph":false}},
  "style": {},
  "export": {"fps":30,"quality":"high"}
}
```

`style` in the example is abbreviated: actual saved projects contain the ReadingStyle properties. An override's `breakParagraph:true` adds a boundary, `false` removes it, omitted means inherit source. The source file is immutable. Projects are saved atomically with a backup and validated against the source hash. Old project schema is not supported; there is no migration tool.

## Export
Export jobs receive a snapshot of edited project and page geometry. Save under `<video-dir>/exports/<stem>_reading.mp4` (append numeric suffix on collision). Keep input MP4/JSON and project immutable during the export. The CLI can also derive its layout when no desktop plan is supplied.

## Global runtime
WPF WebView2 profile uses `%LOCALAPPDATA%/TranscriptStudio/WebView2`. A later application Settings feature may use `%APPDATA%/TranscriptStudio/settings.json`; it is not part of the current M5 prototype.
