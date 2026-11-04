---
name: english-transcript-paragraphs
description: Convert English WhisperX word-aligned JSON into strictly validated EVR Transcript v1, with human-reviewed semantic paragraph boundaries and optional punctuation display corrections, preserving the original transcript verbatim.
---

# English Transcript Paragraphs — EVR Skill

## When to use

Use whenever the user supplies English WhisperX JSON and requests normalized paragraphs for English Video Reader. **Never silently treat WhisperX `segments` as paragraphs.** Do not decide page breaks: EVR is responsible for pages and line wrapping.

## Inputs and outputs

Input: unmodified Subtitle Edit / WhisperX JSON with `language:"en"`, `segments[].words[]`, valid per-word start/end. Treat the uploaded JSON as read-only. Output next to the corresponding MP4:

- `<video-stem>.evr-transcript.json` — ONLY subtitle format accepted by EVR.
- `<video-stem>.paragraphs.md` — human-readable review (not an input to EVR).
- Optional boundaries JSON for reproducibility and audit.

For video `lesson.mp4`, **exact** filename is `lesson.evr-transcript.json`. Do not overwrite `lesson.json` or the MP4. Project override files remain `.evr/projects/lesson.evr.json` and are distinct.

## Mandatory workflow

1. Inspect entire source, not just the first segment. Confirm all word anchors and times valid. If invalid, report and stop; do not fabricate times.
2. Run `python scripts/transcript_tool.py inspect SOURCE.json --out indexed.md`. This makes every token's immutable ID (`s<segment-index>w<word-index>`) auditable.
3. Read the *complete* indexed transcript in semantic context. Choose a sequence of boundary IDs after the **last word** of each paragraph except the final one. Apply the policy in `references/PARAGRAPH_RULES.md`. Speaker identity is not mandatory; never invent it.
4. Write `{ "paragraphBreaksAfter": ["s...w...", ...] }` in document order. Optional `displayOverrides` may modify punctuation or obvious transcription errors **within one timestamped word only**. Do not edit source `word`, `start`, `end`, `score`, `segments` or `word_segments`. If uncertain, preserve text and flag for review.
5. Run `python scripts/transcript_tool.py build SOURCE.json --boundaries boundaries.json --output VIDEO_STEM.evr-transcript.json --preview VIDEO_STEM.paragraphs.md`.
6. Run `python scripts/transcript_tool.py validate VIDEO_STEM.evr-transcript.json --source SOURCE.json`. If validation fails, **do not deliver as usable**.
7. Read the generated Markdown *from beginning to end*, ensure no skipped or repeated words, appropriate speaker turns, and acceptable paragraph lengths. If a semantic adjustment is needed, change the boundary list and rebuild. Deliver files and a short counts/uncertainties summary.

## Semantic policy

- Center paragraphs on a coherent idea. Favor merge of claim + immediate explanation, cause + consequence, tightly coupled example/data, or continuing comments by the same speaker.
- Start a new paragraph on genuine topic shift, new argument, new speaker turn that can be determined reliably, clear question/answer separation, or self-contained contrast.
- Pauses and punctuation are supportive, **not sufficient** reasons to split. Never split merely because WhisperX created a new segment, or because the program's page is full.
- No forced paragraph word/character count; avoid mechanical one-sentence paragraphs unless discourse warrants them.
- One segment may contain multiple paragraphs; one paragraph may span many segments. Word-level IDs permit both.
- A boundary always follows a full word. Never invent a word anchor, split/move existing tokens, or change the time axis.

## Nonnegotiable integrity checks

- Exact original `segments` (except stripping any legacy segmentation metadata on the output copy), words, timestamps, confidence scores, metadata and `word_segments` preserved.
- Valid `language: "en"`; `evr.format:"evr-transcript"`, `evr.schemaVersion:1`.
- `paragraphBreaksAfter` complete authoritative set (empty array is valid for one paragraph), strictly ordered, no duplication and excluding final token.
- `displayOverrides`, when present, is a map from existing token IDs to a *single* non-whitespace token; punctuation can be attached to that token. No multword rewriting.
- Filename exact: `<video-stem>.evr-transcript.json` (case insensitive on Windows).
- Fail closed when uncertain about timestamp integrity, schema validity or data loss; never make up missing timestamps.

See `references/TRANSCRIPT_SCHEMA.md`, `references/PARAGRAPH_RULES.md`, and `references/EXAMPLES.md`.
