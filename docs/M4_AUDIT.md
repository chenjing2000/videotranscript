# M4 multi-dimensional source review & validation report

## Reviewed dimensions

| Dimension | Change / check | Status |
| --- | --- | --- |
| Semantic segmentation | Word-ID breaks, can be inside one WhisperX segment; no segment-as-paragraph fallback | implemented and TS-tested |
| Strict JSON schema | `evr.format`, version, English language, ordered unique breaks, valid single-word overrides | implemented and TS/Python-tested |
| Source preservation | Conversion performs deep copy, protects source path, compares original segments, `word_segments` and all other fields | Python test passes |
| Bad timestamps | Missing/non-finite/non-positive/out-of-order word times fail closed, no fabricated alignments | TS/Python tests pass |
| WPF input | Strict `<stem>.evr-transcript.json` lookup, basic preflight before sending to React | reviewed source; Windows execution pending |
| Browser input | Strict extension, matching video stem, full TypeScript validation | reviewed source; WebView2 execution pending |
| Standalone export | strict name + schema and word-level checks, verify project video/subtitle names | reviewed source; actual Remotion render pending |
| Project overrides | source paragraph breaks preserved; user removal persists; source punctuation display can be overridden back | TS-tested |
| Pagination, justification, highlight | existing deterministic M2/M3 engines retained; full legacy suite remains passing | TS tests pass |
| E2E media | 80-second MP4 and WebView2 are not present/runnable in this Linux build container | **not verified** |
| Full WPF publish / .NET | requires Windows + .NET 10 + WebView2 and NuGet restore | **not verified** |
| npm production build | requires npm dependency install; local environment only had global TypeScript | **not verified** |

## Security / robustness observations

- The WPF app does not execute untrusted text; JSON is parsed by .NET / React; Node export receives filenames as arguments, not a shell command line.
- The raw source still exists as `*.json` and is not loaded by the reader. The direct converter explicitly avoids overwriting its input and refuses overwriting an existing standard output unless `--force` is requested.
- The Skill cannot infer whether a given transcript is linguistically accurate or whether the selected boundaries reflect an audio-only speaker turn; the human/editor must review the Markdown. It never fabricates a new timestamp.
- In this PoC, packaging does not include Node/Chrome/.NET runtime; export remains dependent on user environment as prior versions did.
- The older scrolling implementation remains in `src/core/scroll.ts` for regression history but is not used by the M2/M3 static page view.

## Next Windows acceptance

1. Copy a standard `<stem>.evr-transcript.json` next to a real `<stem>.mp4` and retain raw `<stem>.json` alongside it.
2. Verify WPF opens only standard EVR; delete/rename it and confirm WPF rejects the raw JSON.
3. Confirm paragraph breaks inside a single segment and missing/duplicate IDs are handled or rejected with a visible message.
4. Confirm old project hash mismatch does not apply stale edits, and the original project remains intact.
5. Produce an 80-second MP4 and visually check page switching, Word-style justified lines, last line left-aligned, 4ch indentation, original audio exactly once, and uninterrupted highlight.
6. Check original media and both original & standard transcript SHA-256 remain unchanged after playback, save, and export.
