> **M4 优先规范（2026-11-04）：** 应用现在只接受 `<视频主名>.evr-transcript.json`，原始 WhisperX `.json` 不再直接加载。段落由 `docs/english-transcript-paragraphs/SKILL.md` 标准化；详见 [`M4_FORMAT_MIGRATION.md`](M4_FORMAT_MIGRATION.md)。下文涉及“同名 WhisperX JSON”旧描述视为历史设计，不得覆盖此规则。

# Architecture

- .NET 10 WPF hosts the bundled React/TypeScript interface in WebView2. The host owns source pairing, atomic project writes and backups, and the Node subprocess. The source file selected in WebView2 is played as a local object URL and its path is passed to WPF through the file message API.
- `src/core` owns transcript parsing, project overrides, geometry, highlighting and scrolling. The preview measures line layout at the logical canvas size. The WPF export job snapshots the current project and that measured layout together.
- `src/ui/ReaderCanvas.tsx` displays both preview and render. Preview time comes from the video element. Remotion time comes from frame divided by FPS. The shared component builds its scroll plan from the same measured rows. Standalone CLI export without a desktop snapshot measures within its render browser.
- Remotion's OffthreadVideo decodes the local video and carries its audio. The exporter encodes H.264/AAC and WPF moves the completed file into the per-video exports directory under an unused name.
- External tool paths belong in global configuration. Dependency managers are npm and NuGet. The broader directory and settings workflows remain specified in the product document.

The original prototype proposed Tauri. The WPF evaluation and M1 report document the selected host and verification.
