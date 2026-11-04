# Transcript Studio M6 — comprehensive code review

Date: 2026-11-04
Baseline: `TranscriptStudio_M6_WebView2_Media_Streaming_Fix_Source.zip` (the media-streaming build confirmed by the user to play MP4).
Method: `docs/skills/transcript-studio-code-review/SKILL.md`.

## Scope

Reviewed WPF/WebView2 startup, message handling, local-media streaming, HTTP byte ranges, source verification and export-process lifecycle; React playback, keyboard shortcuts, project saving and editing, preview scaling and messages; TypeScript transcript schema, parsing, overrides, pagination and word coordinates; Remotion composition and CLI export; the paragraph Skill, tests, documentation and ignore rules.

## Confirmed issues corrected (low-risk)

1. **Project identity was insufficiently checked on the WPF save/export boundary** (`desktop/ReaderWindow.cs::CheckSource`). Previously the desktop required only project version and subtitle hash, and did not check that the project explicitly names the media and subtitle opened in this window. It now checks `source.videoName`, `source.subtitleName`, `source.subtitleSha256`, and an optional `mediaKind` against the current source before saving or exporting. This reduces cross-media project confusion. It does not change the source files.
2. **React project validation admitted malformed values that could crash or corrupt rendering** (`src/core/project.ts::validateProject`). Previously, existence checks allowed invalid font size, negative padding, malformed color, unsupported fps, invalid media kind and non-boolean word overrides. The validator now checks the actual numerical, color, source, media, override and export constraints, including case-insensitive v2 subtitle suffix. Existing correctly shaped M6 projects remain accepted.
3. **Regression coverage** (`tests/m5-contract.test.mjs`). Added negative tests for malformed saved projects. No production layout or media streaming code was rewritten.

## Findings not automatically modified

### Correctness / reliability

- **Export cancellation and process lifetime:** `ReaderWindow.ExportAsync` waits on the Node render process without a user cancellation token or maximum elapsed time. `Closing` blocks window close during export. If the renderer stalls, the window can become difficult to exit. Add an explicit cancel command, cancellation-aware stream reading, bounded termination and subprocess tree cleanup in a separate change, with Windows integration tests.
- **Save acknowledgement race:** React marks the project clean on any `saved` message. If edits occur after issuing a save but before the acknowledgement, these changes may be incorrectly marked as saved. Recommended: send a monotonically increasing edit/save revision or request ID and acknowledge only that revision.
- **Export page-plan trust:** `scripts/export.mjs` checks `pagePlan` viewport dimensions but not full row/word consistency against current transcript and style. The UI supplies a previously calculated plan, normally trusted; explicit structural and source-binding verification would give safer direct CLI use.
- **Native/CLI parser parity:** WPF checks a subset of the v2 metadata before sending JSON to React, while TypeScript and the standalone CLI perform deeper checks. This is safe for the current app flow, but malformed input may yield less specific errors and duplicated validation logic must stay aligned.
- **Media lifetime:** `LocalMediaServer` uses a single active token/path. Switching files invalidates in-flight requests on the previous token (appropriate for one active player). Explicit integration tests should cover mid-stream switching, file deletion and seek requests; unit tests of the range parser alone do not cover WebView2 HTTP behavior.

### Maintainability

- `src/main.tsx` centralizes UI presentation, loading, editing, project state, keyboard commands, notices and export coordination. This works but merits targeted extraction of distinct use cases when those parts next change; do not introduce an MVVM framework just for structure.
- `src/style.css` contains historical rules overridden by later M6 blocks, including obsolete navigation/volume-control definitions. Remove confirmed-dead rules only alongside a visual regression check on Windows (especially resize and high DPI).
- `src/core/layout.ts` retains the earlier layout/scroll helper alongside M5/M6 pagination; confirm usage before cleanup. Do not remove simply because it is old.

### Optional presentation

- Improve visibility of loading/error status and disabled toolbar commands. Keep focus rings for keyboard accessibility despite icon-only buttons.

## Verification performed

- `npm test`: **68 / 68 passed** (67 baseline + one new case).
- `python -m unittest discover docs/skills/transcript-studio-paragraphs/tests -q`: **6 / 6 passed**.
- `npm run typecheck`: **not verified**; the provided runtime does not have a complete installed `@types/node` package. Error `TS2688 Cannot find type definition file for 'node'` is a missing dependency, not proof that TypeScript sources are error-free.
- `npm run build`: **not verified**, blocked by the same missing dependency.
- `dotnet publish` and .NET byte-range integration tests: **not run**; no .NET SDK in this runtime.
- Real WebView2 video playback, seek, audio-only mode and exported MP4: **not run in this runtime**. The user reported that the unmodified baseline MP4 playback now works; this review does not claim independent verification of the changes.
- No Git metadata was included in the ZIP. No Git commit or push was performed.

## Windows acceptance commands

```bat
cd /d E:\Projects\TranscriptStudio
npm.cmd ci
npm.cmd run verify
dotnet run --project tests/dotnet-media-range/MediaRangeTests.csproj
dotnet publish desktop/TranscriptStudio.csproj -c Release -o dist/wpf
dist\wpf\TranscriptStudio.exe
```

Check the known-working MP4, seek and pause/stop, switching between JSON/media pairs, save and reopen the project, audio-only preview, non-default canvas resolution, and an actual MP4 export. Test corrupted project JSON (e.g. fontSize 0 or invalid mediaKind) and verify that it is rejected without harming the source transcript.

## Change inventory

Modified `desktop/ReaderWindow.cs`, `src/core/project.ts`, `tests/m5-contract.test.mjs`, and this report. No files deleted. No format migration. No changes to streaming handler, playback controls, transcript source, pagination or Remotion output.

Suggested English Git message once Windows verification passes: `fix: validate project identity and saved project settings`.
