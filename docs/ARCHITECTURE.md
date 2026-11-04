# Video Transcript — M5 Architecture

- **Desktop:** .NET 10 WPF host, `desktop/VideoTranscript.csproj` -> `VideoTranscript.exe`. Its WebView2 profile is under local app data `VideoTranscript/WebView2`.
- **Frontend:** React + TypeScript + Vite, `src/main.tsx`. Desktop host opens same-stem `.video-transcript.json`, verifies v2 header and supplies source fingerprint; React applies full strict validation.
- **Core:** `src/core/transcript.ts` validates, parses and merges sparse project word overrides into the effective transcript. The only boundary flag is `breakParagraph`. `src/core/pagination.ts` computes row word `x` coordinates for Word-style justification and fills pages greedily to height capacity. Sentence punctuation does not trigger paragraph changes or influence page end selection.
- **Rendering:** `src/ui/ReaderCanvas.tsx` draws words at fixed coordinates for both preview and Remotion export. No browser line reflow; the same immutable page plan can be supplied for export.
- **Export:** `scripts/export.mjs` provides independent strict v2 gate and checks project source. Remotion uses `src/remotion/Root.tsx` (composition ID `VideoTranscript`) and `src/remotion/Composition.tsx` for MP4 H264/AAC with source audio. WPF provides an isolated project/page snapshot.
- **Skill:** `docs/skills/video-transcript-paragraphs/SKILL.md` and `scripts/transcript_tool.py` normalize raw WhisperX using AI-approved paragraph boundaries. The Skill never uses video page size to decide paragraphs.

See `M5_DESIGN_AND_VALIDATION.md` for test gates, limits and manual Windows acceptance.
