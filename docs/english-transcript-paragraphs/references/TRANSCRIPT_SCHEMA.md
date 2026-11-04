# EVR Transcript v1 Data Contract

Only a valid `*.evr-transcript.json` may be used as a subtitle input by the desktop reader or Remotion CLI. Plain WhisperX `*.json` cannot be loaded, even if it contains `segments` and correct timestamps. The converter is the sole route for raw WhisperX.

```json
{
  "language": "en",
  "segments": [{"start":1,"end":2,"text":"Hello.","words":[{"word":"Hello.","start":1,"end":2,"score":0.9}]}],
  "evr": {
    "format": "evr-transcript",
    "schemaVersion": 1,
    "paragraphBreaksAfter": [],
    "displayOverrides": {}
  }
}
```

`segments`, `word_segments`, and any original WhisperX metadata are source data and remain unchanged. `evr.paragraphBreaksAfter` is an ordered list of stable word IDs `s0w0`, etc., corresponding to segment index and word index (0-based). Boundaries point **after** tokens. Do not include the last token. For a one-paragraph transcript use `[]`. Optional `displayOverrides` is a map from IDs to single-token displayed alternatives, often punctuation adjustments. The original `word` and timings are untouched.

Source-specific `segments[].paragraph_start`, `segments[].paragraph_id`, and root `paragraphs` are legacy semantic metadata; `build` removes them from the *output copy* so there is one authoritative segmentation source. These three fields are never interpreted by EVR v1. All other source fields, including `word_segments`, are preserved byte-for-byte in meaning (JSON formatting may change).

`<video-stem>.evr-transcript.json` is required next to `<video-stem>.mp4`. Project files under `.evr/projects/` have a different schema and are not valid subtitles. The application refuses an invalid or absent standard subtitle with a helpful message. A changed standard subtitle invalidates the source SHA-256 saved with the old project; the user must review/rebuild the project rather than silently reuse stale edits.

Model handles decisions on paragraph placement; `scripts/transcript_tool.py` owns IDs, conversion, validation, preview. Never transform timestamps in LLM free text.
