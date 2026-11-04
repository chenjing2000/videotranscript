# M4 · EVR Transcript v1 strict input migration

**BREAKING CHANGE:** The reader accepts **only** the Skill-produced `<video-stem>.evr-transcript.json`. Raw WhisperX `<video-stem>.json` is no longer a valid application input. Do not rename an unconverted raw JSON: an `evr` extension and verified word-level boundaries are required.

## Example directory

```text
video/
  6 Minute English 01-seg1.mp4
  6 Minute English 01-seg1.json                # original WhisperX: preserve, not loaded by EVR
  6 Minute English 01-seg1.evr-transcript.json # standard: the only subtitle auto-loaded
  6 Minute English 01-seg1.paragraphs.md      # review only
  .evr/projects/6 Minute English 01-seg1.evr.json  # project edits, not a subtitle
  exports/
```

## How to create a valid standard subtitle

The paragraph Skill resides at `docs/english-transcript-paragraphs/SKILL.md`. Follow its semantic decision protocol and use the scripts in that folder. The model chooses a list of word IDs to break **after**; the Python script does not infer meaning by time, segment or punctuation.

```powershell
cd C:\Projects\EnglishVideoMaker
python docs/english-transcript-paragraphs/scripts/transcript_tool.py inspect "video/6 Minute English 01-seg1.json" --out "video/indexed.md"
# Review indexed.md, choose boundaries and write boundaries.json
python docs/english-transcript-paragraphs/scripts/transcript_tool.py build "video/6 Minute English 01-seg1.json" --boundaries "video/boundaries.json" --output "video/6 Minute English 01-seg1.evr-transcript.json" --preview "video/6 Minute English 01-seg1.paragraphs.md"
python docs/english-transcript-paragraphs/scripts/transcript_tool.py validate "video/6 Minute English 01-seg1.evr-transcript.json" --source "video/6 Minute English 01-seg1.json"
```

The repository includes `fixtures/6 Minute English 01-seg1.boundaries.json` and an example standardized 200-word sample. **The sample's boundaries are editorial examples** and should be reviewed for desired paragraph grouping; do not assume it is a fully automated language analysis.

## Existing projects and compatibility

- Source subtitle path changes from `lesson.json` to `lesson.evr-transcript.json` and its SHA-256 changes; existing `.evr/projects/lesson.evr.json` must not be silently reused. The UI reports mismatch, keeps the old project file unchanged, and starts from the normalized transcript.
- To migrate old edits, manually review the original project override IDs against the new EVR source and update `source.subtitleName` / hash only after confirming each word ID and time remains identical. Never silently overwrite the original saved project.
- The app still supports **legacy project schema v1** when its source identifiers/fingerprint match the standardized input; old **subtitle format** is intentionally unsupported.
- WPF looks exclusively for the EVR filename. Browser manual import also requires exact matching basename. Export CLI requires the same filename and validates content and project source identifiers.

## Quick run

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
python -m unittest discover docs/english-transcript-paragraphs/tests -v
dotnet publish desktop/EnglishVideoReader.csproj -c Release -o dist/wpf-m4
```

To export by CLI, pass `--json "video/lesson.evr-transcript.json"` (not raw `lesson.json`). The MP4, original JSON, and standard input are never overwritten by the app.
