# Transcript Studio — M5 current implementation and future scope

The app combines source MP4 with a paginated English reading surface on a fixed logical 1200×1600 canvas; Word-like line justification, natural semantic paragraphs, word-progress color filling (#b81a35), time-driven still page switches, H264/AAC MP4 output retaining source sound. Settings use an aligned four-column grid for independent left/right fonts, paragraph, page and output parameters; font weight is fixed rather than user-selectable. Video files and standard subtitle files are immutable. Editing is stored in `.transcript-studio/projects/<stem>/project.settings.json`.

The strict M5 subtitle is `<stem>.transcript-studio.json`, marked with word-local `breakParagraph:true`. Raw JSON and retired v1/EVR are refused, including through the CLI. The user-facing executable and C# namespace are `TranscriptStudio`.

**Current prototype limitations:** direct MP4 file selection (not yet the full lazy folder tree), simplistic toast status (not yet the proposed toast stack/history), limited external-tool path customization (no full Settings dialog), and basic editor tools (some advanced keyboard editing features remain planned). Do not mistake planned future UX for implemented functionality.
