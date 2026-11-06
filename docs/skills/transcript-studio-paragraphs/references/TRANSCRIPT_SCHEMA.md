# Transcript Studio v2 JSON Contract

The only accepted subtitle filename is `<video-stem>.transcript-studio.json` next to the MP4. The original same-stem `.json` is never loaded by the program. M4/EVR v1 is unsupported.

```json
{
  "language": "en",
  "segments": [
    {
      "start": 0.1,
      "end": 0.9,
      "text": " Hello. Next sentence.",
      "words": [
        {"word": "Hello.", "start": 0.1, "end": 0.4, "score": 0.95},
        {"word": "Next", "start": 0.5, "end": 0.7, "score": 0.94},
        {"word": "sentence.", "start": 0.72, "end": 0.9, "score": 0.93, "breakParagraph": true}
      ]
    },
    {
      "start": 1.0,
      "end": 1.3,
      "text": " Continue.",
      "words": [{"word": "Continue.", "start": 1.0, "end": 1.3, "score": 0.9}]
    }
  ],
  "transcript_studio": {"format": "transcript-studio", "schemaVersion": 2}
}
```

The example illustrates format, not speech recognition. The final word must not have a marker. **No other paragraph-break representation is permitted** in standard input. The *absence* of a word marker means no break, regardless of punctuation. `word_segments`, if provided, must be an untouched raw copy without markers.

`transcript_studio.displayOverrides` is an optional mapping keyed by generated word IDs such as `s0w1`, mapping to a single-token displayed alternative. It must not modify source timing or word text. Those IDs are generated from zero-based `segments` and `words` indices, and are not added to the JSON source words.

Internal program words and project override files use `breakParagraph: boolean`. A project override of `false` explicitly removes a source mark; absence means inherit. The project format is `transcript-studio-project` v2, stored at `<subtitle-directory>/<stem>/<stem>.project.json`. The old `.transcript-studio/projects/.../project.settings.json` path is not loaded or migrated.

Time checks: each word must have finite nonnegative `start` and `end > start`; word starts must be nondecreasing; overlapping word end/start intervals can exist, but may produce page-switch warnings. Every segment must have at least one word. No final-word break. Unknown `transcript_studio` keys are rejected.
