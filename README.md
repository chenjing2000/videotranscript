# English Video Reader — Core Prototype

> **Status: architecture/reference implementation, not a finished Windows desktop app.**
> The TypeScript core test suite passed locally. The React/Vite and Remotion packages could not be installed in the authoring environment (npm registry inaccessible), therefore **the browser UI build and a real Remotion render have not been executed here**. They are implementation candidates requiring validation by Codex on Windows. The synthetic demo MP4 and matching WhisperX-compatible JSON are included in the downloadable archive.

## Intent

A **local-first**, personal Windows English video reader and automatic MP4 maker. A pre-edited MP4 and word-aligned WhisperX JSON are inputs. No speech recognition, clipping, recording, cloud service, database, credits, or title card.

Final product: **Tauri 2.x + React + TypeScript + Remotion**, left 1200×1600 reader, right four tabs (**样式 / 字幕 / 素材 / 导出**), word-level edit only on right.

## Prototype quick start

Requires Node.js 22+, npm, FFmpeg/ffprobe (for sample generation and duration probing), and internet access to install exact Remotion dependencies. Browser-based prototype uses local File API; **it does not yet have the Tauri directory tree, disk autosave, 6-second toast stack, or GUI-triggered export**.

```powershell
npm install
npm run fixture:json
npm run fixture:video
npm run dev
```

Open the address displayed by Vite. In the **素材** tab import `fixtures/demo.mp4` then `fixtures/demo.json`. Explore preview, subtitle word editing, style and seeking.

### Render automatically via Remotion

```powershell
npm run export -- --video fixtures/demo.mp4 --json fixtures/demo.json --out exports/demo_reading.mp4
```

Remotion must bundle successfully and obtain its rendering browser/compositor. The CLI stages one input MP4 in `public/__export_input.mp4` and cleans it up afterwards. **Exports are serialized in this prototype**; simultaneous exports are not supported. Do not use this export implementation for untrusted media; add project input validation and staging isolation first.

To apply a browser-exported project JSON, add `--project path/to/demo.evr.json`.

### Run core tests (no npm install needed)

```bash
bash scripts/test-core.sh
```

8 test cases verify parsing, stable word IDs, editing/timing, linear highlight, layout, short text, bottom clamp, minimum 0.15s scroll, event ordering and project overrides.

## Next action

Open `HANDOFF.md`; it specifies Codex milestones, user-approved requirements, acceptance conditions, blockers, and test evidence. Do **not** assume the prototype is production-ready or run the complete app before npm dependency installation.

## Repository

Target GitHub remote: <https://github.com/chenjing2000/englishvideomaker.git>. No remote push performed by this artifact creation session. See `docs/GIT_SETUP.md`.

For Windows PowerShell core tests, use `powershell -ExecutionPolicy Bypass -File scripts/test-core.ps1` (requires `tsc` on PATH; a successful `npm install` also provides a local TypeScript compiler via `npx tsc`). Alternatively run the Bash script using Git Bash.
