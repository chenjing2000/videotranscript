# Video Transcript — M5 current implementation and future scope

The app combines source MP4 with a paginated English reading surface on a fixed logical 1200×1600 canvas; Word-like line justification, natural semantic paragraphs, word-progress color filling (#b81a35), time-driven still page switches, H264/AAC MP4 output retaining source sound. Style controls are dropdowns for font, size, weight, line height, paragraph gap, indentation, padding and colors. Video files and standard subtitle files are immutable. Editing is stored in `.video-transcript/projects/<stem>.project.json`.

The strict M5 subtitle is `<stem>.video-transcript.json`, marked with word-local `breakParagraph:true`. Raw JSON and retired v1/EVR are refused, including through the CLI. The user-facing executable and C# namespace are `VideoTranscript`.

**Current prototype limitations:** direct MP4 file selection (not yet the full lazy folder tree), simplistic toast status (not yet the proposed toast stack/history), limited external-tool path customization (no full Settings dialog), and basic editor tools (some advanced keyboard editing features remain planned). Do not mistake planned future UX for implemented functionality.
