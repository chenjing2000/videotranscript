> **M4 优先规范（2026-11-04）：** 应用现在只接受 `<视频主名>.evr-transcript.json`，原始 WhisperX `.json` 不再直接加载。段落由 `docs/english-transcript-paragraphs/SKILL.md` 标准化；详见 [`M4_FORMAT_MIGRATION.md`](M4_FORMAT_MIGRATION.md)。下文涉及“同名 WhisperX JSON”旧描述视为历史设计，不得覆盖此规则。

# Data and persistence

## Source parser

WhisperX `segments[i].words[j]` -> stable ID `s{i}w{j}`; immutable `original`, `start`, `end`, `score` and `segmentId`. Mutable `display`, `hidden`, `paragraphAfter` copied into current edit model. Skip malformed timings with clear warnings; block production export if serious integrity errors. Record transcript source hash before editing. Do not synthesize time for unknown/injected words.

## Per-video edit project

Save `<video_dir>/.evr/projects/<stem>.evr.json`. `schemaVersion=1`, video/subtitle reference and fingerprint, sparse word overrides keyed by source IDs, style, fps/quality, save timestamp. Use atomic temp-write+rename, backup last good version. On open validate same-basename JSON and project schema/source fingerprints; if matching project exists restore, else start from WhisperX. If fingerprints differ show explicit warning + recovery options, do not silently apply mismatched word edits. On import multiple candidate videos user chooses explicitly.

## Output

Default `<video_dir>/exports/<stem>_reading.mp4`; add suffix `_002`, `_003`, ... on collisions; never overwrite source MP4 or JSON. Temporary render snapshot immutable. No per-export editing of source file. Intermediate stage isolated to avoid concurrent jobs; current draft `public/__export_input.mp4` is prototype-only and not concurrent-safe.

## Global settings

`%APPDATA%/EnglishVideoReader/settings.json` e.g. `{ "version":1, "paths":{"node":"C:\\Program Files\\nodejs\\node.exe","ffmpeg":null,"browser":null}, "recentRoot":null, "ui":{"splitRatio":0.65}}`. User explicit paths take precedence; invalid path -> report; auto-detect only in auto mode. External binaries need not be copied into `3rdparty/`.
