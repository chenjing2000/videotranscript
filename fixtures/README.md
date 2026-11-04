# Fixtures and format policy

Only `*.evr-transcript.json` are valid inputs for the application. The included `demo.evr-transcript.json` and `6 Minute English 01-seg1.evr-transcript.json` are standardized fixtures. `6 Minute English 01-seg1_semantic.evr-transcript.json` demonstrates source semantic metadata converted to the EVR extension; for editorial-quality paragraphs follow the Skill and review manually.

`*.json` without `.evr-transcript` in this fixture folder are **raw WhisperX samples for converter/negative tests only** and the application must reject them. `demo.mp4` can be generated with `npm run fixture:video` (requires FFmpeg). The user-provided MP4 is not redistributed.
