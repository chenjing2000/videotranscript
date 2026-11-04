> **M4 优先规范（2026-11-04）：** 应用现在只接受 `<视频主名>.evr-transcript.json`，原始 WhisperX `.json` 不再直接加载。段落由 `docs/english-transcript-paragraphs/SKILL.md` 标准化；详见 [`M4_FORMAT_MIGRATION.md`](M4_FORMAT_MIGRATION.md)。下文涉及“同名 WhisperX JSON”旧描述视为历史设计，不得覆盖此规则。

# Product and UI specification

Personal Windows app built with .NET 10 WPF, WebView2, React and TypeScript for English listening/reading and automated Remotion output, not a recorder. Left fixed logical 3:4 canvas, right configuration pane. Resizable 65:35 split by default, four top tabs. Reading canvas itself contains ONLY video followed immediately by English text; controls beneath it are outside exported area. Video height equals 1200*sourceH/sourceW, no mandatory cap (but validation/warning if no meaningful reading area). Left panel preview scales *entire canvas* without changing logical layout metrics. No frame border/divider inside video and text.

Right tabs: **样式** (font family, font size, line height, paragraph gap, margins, normal/highlight/background colors, optional minimum scroll setting), **字幕** (continuous paragraph appearance, editable one word at a time, no visible boxes except active word, original/time info, paragraph toggle, word hide/restore, seek button), **素材** (tree of all nested directories, explicit source choice, same-name MP4/JSON, source check and project restore), **导出** (fps 30/60, standard/high quality, output location defaults to per-video exports, progress/cancel).

Top menu includes File/Open Folder/Save Project and application-level Settings dialog for external tool executable paths, stored in user `settings.json` (not in per-video `.evr.json`). Status window: up to 3 independent toasts pinned bottom-right editing pane, 6s life, last 1s linear fade, new messages added at top, upward cards move down on removal; expandable persistent message history. No full-width bottom status bar.

Keyboard: Ctrl+S save; word selection single click; word edit double click pauses media; Enter accept; Esc cancel; Tab/Shift+Tab navigate; Ctrl+Z undo; no media auto jump except explicit seek. Editing possible only in right transcript tab. Source video and original subtitles never overwritten.
