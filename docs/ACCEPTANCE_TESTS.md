> **M4 优先规范（2026-11-04）：** 应用现在只接受 `<视频主名>.evr-transcript.json`，原始 WhisperX `.json` 不再直接加载。段落由 `docs/english-transcript-paragraphs/SKILL.md` 标准化；详见 [`M4_FORMAT_MIGRATION.md`](M4_FORMAT_MIGRATION.md)。下文涉及“同名 WhisperX JSON”旧描述视为历史设计，不得覆盖此规则。

# V1 acceptance test matrix

| ID | Scenario | Expected |
|---|---|---|
| C01 | Valid WhisperX with `segments[].words` | stable original time anchors; no edits to source |
| C02 | User changes spelling, case or punctuation | only display changes, times unchanged |
| C03 | User tries two words in one edit | reject, display right-side toast |
| C04 | Hide final word in a line | visible rows/timing recomputed, no hidden extra line |
| C05 | First word start/middle/end time | highlight 0%/50%/100% linear horizontal |
| C06 | Seek backward after playback | p(t), scroll Y(t) deterministic |
| C07 | Text total height <= viewport | initial top align, Y=0, bottom blank acceptable |
| C08 | Text total height > viewport | final row flush bottom and never overscroll |
| C09 | Interline gap 0.01 s | >=.15s animation, no teleport |
| C10 | Dense consecutive lines | no event overlap-induced discontinuity; no tail drift beyond max |
| C11 | Paragraph gap 24px | actual line geometry used for scroll shift |
| C12 | Very tall source video | warning, never silently distort source |
| C13 | Folder multiple MP4/JSON pairs | no automatic first video, explicit select |
| C14 | Expand/collapse nested folder | + only one level, - collapses all descendants |
| C15 | Missing/malformed same-basename JSON | right toast with detailed error, no accidental pairing |
| C16 | Save, exit, reopen video | exact word overrides/paragraph/style restore |
| C17 | Source file edited outside app | detect fingerprint mismatch; safe recovery |
| C18 | Output already exists | next filename increment; never overwrite MP4/JSON |
| C19 | Toast 4 arrivals <6s | max 3; newest at top; bottom alignment after timeout |
| C20 | Toast age 5s to 6s | 100% to 0% alpha, removal exactly 6s |
| C21 | Export snapshot while editing | output reflects snapshot, not subsequent changes |
| C22 | 30fps output H264/AAC | 1200x1600, duration ~ source, one original audio track |
| C23 | Side-by-side frames at the M1 checkpoints and final frame | matching line breaks/word progress/Y across preview/render |
| C24 | User-specified bad external path | informative validation error, no silent other executable |
| C25 | Real supplied ~2k-word JSON | acceptable preview performance, no source data changed |

Current implemented tests: C01/C02/C03/C05/C06(partial)/C07/C08/C09/C16 (core-only). Others are milestones for Codex, **not yet passing**.

M1 evidence and the distinction between unit-only and actual desktop verification are recorded in [the M1 validation report](M1_READING_RENDER_VALIDATION.md).
