# English Video Reader — M4 Source Handoff

## Status & scope

Windows desktop prototype uses **.NET 10 WPF + Microsoft WebView2**, **React + TypeScript**, and **Remotion** for offline MP4. User confirmed M3 static pages, progressive word highlight, Word-style justification, and offline export work. M4 integrates the strict subtitle format and a reusable Skill; **no Tauri**. A full Windows build/render could not be executed here; see `docs/M4_AUDIT.md`.

## Hard requirements

1. **Only `<video-stem>.evr-transcript.json`** as application subtitle; plain WhisperX `<video-stem>.json` must be rejected even when it has valid `segments[].words`.
2. Source and converted standard files are distinct; never overwrite source MP4 or raw WhisperX. Converter refuses overwrite unless explicit `--force` is provided.
3. Required schema: `language:"en"`; `segments[].words[]` with valid aligned word start/end; `evr:{"format":"evr-transcript","schemaVersion":1,"paragraphBreaksAfter":[...],"displayOverrides":{...optional}}`.
4. Word IDs are `s<segment-index>w<word-index>`; boundaries point **after** the named word, strictly ordered and excluding final token. No legacy `paragraphs`, `paragraph_start`, or `paragraph_id` in a normalized subtitle.
5. The Skill's language model interprets full document meaning, but the script performs all original-data preservation and integrity validation. See `docs/english-transcript-paragraphs/SKILL.md`.
6. Project files at `.evr/projects/<stem>.evr.json` remain separate, source SHA-256 protected; do not silently load old project data after normalization changes the source fingerprint.
7. Reader renders page-stationary text and instant transitions, full Word-like justified lines with final paragraph lines left-aligned, default first-line indent 4ch, and time-based progressive word highlighting. Remotion and preview share the page plan.
8. UI style settings remain aligned two-column equal-width dropdowns, with at most four options visible at a time; no slider for layout parameters.

## Modules

- `src/core/transcript.ts`: strict EVR schema validation, transcript mapping, source word and paragraph identity, edits and project overrides.
- `src/core/types.ts`: TS input data model (`WhisperXInput` now means **normalized EVR v1**) and state.
- `desktop/ReaderWindow.cs`: strict auto-match filename and early schema check, source hash, atomic project save, command-line export.
- `src/main.tsx`: desktop and standalone browser import checks, project integrity, preview, word editor, export.
- `scripts/evr-contract.mjs`: independent strict CLI preflight for standalone exporter.
- `scripts/export.mjs`: filename match, JSON and project source validation, Remotion render.
- `docs/english-transcript-paragraphs/`: reusable Skill, reference rules, deterministic Python `inspect`/`build`/`validate`, unit tests.
- `fixtures/6 Minute English 01-seg1.evr-transcript.json`: 200-word standardized example with 8 editorial paragraph units (review further if needed); raw fixture remains test-only.

## Validation commands (Windows PowerShell)

```powershell
cd C:\Projects\EnglishVideoMaker
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
python -m unittest discover docs/english-transcript-paragraphs/tests -v
dotnet publish desktop/EnglishVideoReader.csproj -c Release -o dist/wpf-m4
```

Run `dist/wpf-m4/EnglishVideoReader.exe`. Pair `video/lesson.mp4` with `video/lesson.evr-transcript.json`. The raw `lesson.json` may remain in the same folder but will not be read by the program. For manual command-line rendering, use `npm run export -- --video ... --json ... --out ...`. All input checks must apply there as well.

## Tests & unverified

The **existing M3 tests** plus M4 strict format negative/positive cases are run from `npm test`; Skill tests separately from Python unittest. CI/build here was limited to global `tsc` (core) and Node/Python tests. Windows WPF, npm production bundle and full real Remotion render require the user's Windows environment. Document those results honestly, do not infer pass from TypeScript tests.

## Further engineering recommendations

- Keep a standard schema single-source-of-truth if moving to cross-language schema generation (currently the TypeScript importer, Node CLI preflight and Python converter independently validate the same documented format).
- On format future change, introduce new `schemaVersion` rather than interpreting legacy formats; require explicit migration tool.
- Use the audited raw-to-normalized converter, not ad hoc renaming or model-emitted full JSON.
- Never let the document's semantic paragraph boundaries be recreated by the page-fit algorithm. Pages and paragraphs remain independent.
