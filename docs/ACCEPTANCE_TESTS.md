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
| C23 | Side-by-side frames at 0, 1, 4, middle, end | matching line breaks/word progress/Y across preview/render |
| C24 | User-specified bad external path | informative validation error, no silent other executable |
| C25 | Real supplied ~2k-word JSON | acceptable preview performance, no source data changed |

Current implemented tests: C01/C02/C03/C05/C06(partial)/C07/C08/C09/C16 (core-only). Others are milestones for Codex, **not yet passing**.
