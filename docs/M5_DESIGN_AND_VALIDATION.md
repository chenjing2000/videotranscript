# M5 architecture, audit and acceptance

## Contracts
Video Transcript v2: `video_transcript:{format:'video-transcript',schemaVersion:2}`; source word marker `breakParagraph:true` only. Project edits: same key can be `true`, `false`, or omitted (inherit). Word IDs generated only for application edit indexing. No v1/EVR fallback. `word_segments` has no markers. No application-driven semantic paragraph inference.

## Pagination
Full visible words -> rows with deterministic word `x` coordinates, physical widths and first-line indentation -> greedy pages. A paragraph starts only after an effective `breakParagraph` mark, not at `.` or WhisperX segment boundaries. End of file is a paragraph end, without a final explicit marker. Page boundaries do not change paragraph flags. Page starts at top padding; paragraph gaps are charged only if paragraph starts after at least one row in that same page. No widow/orphan logic. Sentences still supply metadata for diagnostics only and may not affect page choice.

Justification: compute total glyph widths, then distribute extra space across inter-word gaps; no glyph stretching. Last line of the actual paragraph stays left aligned. Single-word rows are not stretched. Preserve floating point precision. Do not permit browser wrapping. Measure only after font has loaded when possible; for full fidelity both rendering engines must load identical font resources.

## Desktop/CLI
WPF pairs exact MP4 stem with `.video-transcript.json`, SHA-256 fingerprints subtitle bytes, saves projects atomically under `.video-transcript/projects`. CLI checks identical naming, contract, optional project schema + hash and produces an isolated export snapshot. Obsolete input formats and project schema are rejected. Browser-only preview also validates subtitle schema and filename.

## Test layers
1. `npm run typecheck` — entire React/TSX/Remotion type checks.
2. `npm run build` — Vite build and HTML output.
3. `npm test` — deterministic TypeScript unit/contract tests.
4. `npm run test:skill` — Python generation/strict source integrity tests.
5. Windows: `dotnet publish desktop/VideoTranscript.csproj -c Release -o dist/wpf-m5`.
6. Human: 80s BBC fixture, preview, first-page line utilization, paragraph marked `without.` not `lovers.`, normal last-line left alignment, seek/rewind, render MP4 with original audio and no clipping.

## Known constraints
When source `word_segments` exists, it is preserved exactly. The program uses `segments[].words[]` only. Long indivisible words wider than the content region produce a warning; no auto-hyphenation. A successfully built TS project alone cannot prove Windows WebView2 or browser export correctness. Old local app data and older project files are intentionally not imported; do not delete them before backing up if desired.
