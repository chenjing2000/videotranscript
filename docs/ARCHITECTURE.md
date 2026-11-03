# Architecture

- `src/core` pure data + geometry/highlight/scroll; no Tauri/Remotion-specific imports. `buildLayout` accepts injected measure function; `scrollOffset(plan,t)` and `wordProgress(t,...)` pure.
- `src/ui/ReaderCanvas.tsx` shared presentation; time and video supplied as props. Preview time from HTML `<video>.currentTime` (prototype rAF polling), renderer time from Remotion frame/fps.
- `src/remotion`: Remotion composition with source video + audio already included; don't add duplicated `<Audio>`. `scripts/export.mjs` bundles composition, inspects media with ffprobe, stages local video, renders H.264, and cleans up.
- Final Tauri host should handle directory tree, secure file I/O, atomic persistent JSON, subprocess management, filesystem output path, global settings and toast history; prototype UI currently has browser File API and download-based save only.
- Preview/render parity is an acceptance criterion; canvas text measurement can differ across WebView2/Headless Chrome. Consider a layout manifest precomputed under controlled rendering context and applied to BOTH output paths. Use one code path, fixed font files/metrics, no incidental browser text wrapping.
- External program locations are global configuration, not embedded inside saved projects. `3rdparty/` is for genuinely needed vendored binaries/resources; npm and Cargo use regular dependency managers.
