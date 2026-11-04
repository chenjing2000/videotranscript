---
name: video-transcript-paragraphs
description: Segment WhisperX English word-timestamped transcripts semantically and generate strictly validated Video Transcript v2 JSON, preserving all original recognition fields.
---

# Video Transcript Paragraph Skill — M5 / v2

## Goal
Convert a raw WhisperX English JSON into `<video-stem>.video-transcript.json`, with **word-level** `segments[].words[].breakParagraph: true` at the end of each semantic paragraph. Produce `<video-stem>.paragraphs.md` for human review.

## Required workflow
1. Read the **entire** WhisperX transcript and this Skill's `references/PARAGRAPH_RULES.md`, `TRANSCRIPT_SCHEMA.md` and `EXAMPLES.md`.
2. Inspect a word-indexed transcript via `python scripts/transcript_tool.py inspect SOURCE.json --out indexed.md` (paths relative to this Skill folder).
3. Decide natural paragraphs using **meaning and speaker turns**, not sentence punctuation, WhisperX segment boundaries, pauses, or video page size. Do not infer speakers when uncertain. Review complete paragraphs for cohesion.
4. Write a temporary decision file such as `{"breakAfterWordIds": ["s3w2", "s10w38"]}` with valid ordered anchors. These IDs belong **only to the Skill's processing decisions and application editing**; never add IDs to the actual JSON words or emit an `paragraphBreaksAfter` subtitle property.
5. Build: `python scripts/transcript_tool.py build SOURCE.json --boundaries decisions.json --output VIDEO.video-transcript.json --preview VIDEO.paragraphs.md`.
6. Validate: `python scripts/transcript_tool.py validate VIDEO.video-transcript.json --source SOURCE.json`. Resolve every error before delivery.
7. Review Markdown paragraphs manually. Preserve original `.json` separately; do not overwrite source or media.

## Revise an existing v2 subtitle
Use `python scripts/transcript_tool.py edit EXISTING.video-transcript.json --boundaries revised_decisions.json --output NEW.video-transcript.json --preview NEW.paragraphs.md`. The decisions file is a **complete replacement** list `breakAfterWordIds`, not a patch. All original words, fields, time stamps and display corrections are preserved. The original file is never overwritten. Validate the new file against the raw WhisperX source before delivery.

## Strict rules
- Only `video_transcript: {"format":"video-transcript", "schemaVersion":2}` is accepted by the app. Optional `video_transcript.displayOverrides` permits conservative single-token display corrections; raw words stay intact.
- For every paragraph boundary (except the end of the file), add `breakParagraph: true` to the **last word of that paragraph** inside `segments[].words[]`. An absent marker means continue. Explicit `false`, `null`, string, number are invalid.
- Never put `breakParagraph` on `segments[]`, `word_segments[]`, or the final word. `word_segments` remains an unchanged original WhisperX copy.
- Never change original `word`, `start`, `end`, `score`, `segments[].text` or any other raw source field.
- One natural paragraph may cross several source segments and may contain several sentences. Only markers define paragraph ends.
- The Skill does not do screen pagination, line wrapping, font/layout decisions, word synchronization or video export.
- No v1/EVR input or project migration. Use fresh raw WhisperX to build v2.

## Deliverables
- `<stem>.video-transcript.json` (program input)
- `<stem>.paragraphs.md` (human-readable review, not program input)
- A clear result indicating word count, paragraph count, and validation with original source.
