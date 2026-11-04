# Semantic English Paragraph Policy

1. **Meaning first.** Paragraph should be a connected idea or discourse unit, not a WhisperX segment or screen-sized block. Retain argument + immediate evidence, concept + its definition, cause + effect, tightly related statistics, or speaker's uninterrupted elaboration together.
2. **Turns.** When a new speaker clearly begins, begin a new paragraph. A question/response boundary is typically a strong split. Never assign fictional speaker identity when diarization is absent.
3. **Topic changes.** Intro → exposition → example → contrast → conclusion usually permit breaks; do not split inside a dependent phrase or subordinate clause.
4. **Continuity.** Don't mechanically break after every `.`, `?`, `!`, ellipsis or speech pause. Several short sentences can make one paragraph.
5. **Time is supporting evidence only.** A pause may help place an ambiguous boundary but never supersedes meaning. Extremely short or overlapping intervals do not prevent a logical semantic boundary.
6. **No layout coupling.** Do not target 50 words/3 sentences/per screen. Natural paragraphs are independent of line wrapping and pages; Video Transcript paginates across paragraphs.
7. **Punctuation.** Conservative punctuation corrections via `video_transcript.displayOverrides` only. Preserve all original timestamps, word order, original fields. Don't replace a spoken phrase with several different words under one anchor.
8. **Uncertain content.** Leave unchanged, note uncertainty in report. Avoid editorial rewriting of English accent, colloquial grammar, quotations, numbers, facts or named entities.

Quality review: read the whole transcript with inserted blank lines. Paragraphs should connect logically, avoid unnecessary single-sentence fragmentation, retain speaker turns, and not erase punctuation by token transforms.
