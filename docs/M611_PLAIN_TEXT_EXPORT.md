# M6.11 — Export right-panel text as plain TXT

## Change scope

The `file-text` icon button is in the current toolbar order: Settings → Import JSON → Save Project → Export Plain Text → Export MP4. The order was finalized in M6.12.

## Output contract

- Exports the **current edited, visible right-panel text**, not the source transcript JSON or rendered HTML.
- Word spelling, case and punctuation are preserved verbatim. Words are separated by the existing right-panel word spacing (one space); there is **no punctuation repair, auto-correction, typography or formatting**.
- Hidden words are not emitted. If a hidden word carries `breakParagraph: true`, the boundary is still preserved because the right pane renders that boundary after the hidden token.
- `breakParagraph` inserts one blank line (two line endings) between paragraphs. No trailing blank line is added.
- Output is a `.txt` file encoded in **UTF-8 without BOM**, with **Windows CRLF (`\r\n`)** line endings.
- Does **not** write to the subtitle JSON or project settings, clear the unsaved-project flag, or invoke Remotion/Node.js.
- If a word is being edited, attempt to commit it before snapshotting the exported text. If its input is invalid (empty or contains whitespace), export is rejected and the editor remains available for correction.
- If all words are hidden or no subtitle has been opened, export is rejected with a message.

## Windows desktop behavior

React sends `{kind:'export-text',text}` to the existing WebView2 bridge. Since M6.12, WPF does not show a `SaveFileDialog`: it writes directly to `<subtitle-directory>/<stem>/<stem>.article.txt`, creating the work directory if needed and atomically replacing only that fixed target. It normalizes CRLF and writes with `new UTF8Encoding(false)`. It returns distinct `text-exported` / `text-export-error` messages, so successful TXT export **never** marks a dirty project as saved.

Browser-only fallback downloads a TXT Blob instead of showing a native Windows dialog.

## Changed files

- `src/main.tsx` — toolbar button, icon, active-editor handling and message bridge.
- `src/core/plain-text.ts` — pure and independently testable conversion.
- `src/core/index.ts` — public export.
- `desktop/ReaderWindow.cs` — fixed-path atomic write and byte encoding.
- `tests/m611-plain-text-export.test.mjs` — six regression checks.
- `docs/M611_PLAIN_TEXT_EXPORT.md` — this note.

## Validation

```bat
cd /d C:\Projects\TranscriptStudio
npm.cmd ci
npm.cmd run verify
dotnet publish desktop/TranscriptStudio.csproj -c Release -r win-x64 --self-contained false -o dist/wpf
dist\wpf\TranscriptStudio.exe
```

Manually verify: current icon order; hover title; export ordinary text and edited words; export while a word edit is active (valid/invalid); punctuation and paragraph breaks including a hidden word carrying a boundary; UTF-8 without BOM and CRLF bytes; direct fixed-path overwrite; preserve unsaved-project indicator; existing MP4 export still works.

In the Linux packaging environment: 103/103 Node core tests and 6/6 paragraph Skill tests passed; TSX syntax check passed. Full typecheck/build were blocked by missing npm type dependencies (e.g. `@types/node`). Native Windows WPF compile and SaveFileDialog behavior were not run here.


> **Superseded behavior:** M6.11 originally used a Windows SaveFileDialog and the earlier toolbar order. M6.12 replaced that with the fixed `.article.txt` work-directory path and finalized the current toolbar order.
