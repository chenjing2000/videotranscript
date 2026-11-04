# M6.6 — Inline word editor and contextual toolbar

## Changes

- Double-click any visible transcript word to edit it. The input gets focus and selects its full text.
- Input width measures actual word glyph width with the chosen right-panel font, plus 3 DIP padding on either side, 1 DIP border on each side, and 4 DIP safety. The minimum width is 24 DIP; width is capped at available transcript width. Text scrolls horizontally in a constrained editor.
- Editor has 4 DIP corners, fixed 1 DIP border and #AB1D22 focus border. It suppresses the native context menu.
- Enter commits, Escape cancels; double-click outside commits; double-click another word commits the first and opens the next. A single click outside does not submit.
- Floating toolbar is centered at the foot of the right panel and shows only while editing and for four seconds after editing ends, followed by a 250ms slide-down fade. Its buttons are disabled during the post-edit linger.
- The two buttons are **定位** and **插入分段 / 取消分段**. The second label reflects the effective paragraph break, including false overrides of source breaks. Neither button closes the editor; they preserve focus.
- The source WhisperX JSON and project schema remain unchanged. A single word timestamp anchor can still carry only one nonempty word (whitespace rejected by existing validation). `hidden` source words retain their existing project state; their removal from the toolbar does not change saved data.

## Regression verification

- `npm run test` — 81/81 passing in the provided execution environment, including 5 new M6.6 tests.
- `npm run test:skill` — 6/6 passing.
- `src/main.tsx` syntax/transpilation check — passed using TypeScript `transpileModule`.
- Full `npm run verify`, WPF build, and interactive Windows UI testing — **not run** in this environment; missing `@types/node` and complete npm dependencies prevent full typecheck.

### Windows manual acceptance

1. `npm.cmd ci` then `npm.cmd run verify`.
2. `dotnet publish desktop/TranscriptStudio.csproj -c Release -r win-x64 --self-contained false -o dist/wpf`.
3. Open transcript and double-click a short and a long word. Check the editor width changes as text is typed and no letters are clipped; use both Arial and Nunito Sans.
4. Check right-click suppression and the #AB1D22 focus border without thickness change.
5. Check Enter, Escape, double-click blank area, double-click another word, and single-click-away semantics.
6. Click 定位 and 插入分段 / 取消分段 while editing. Confirm editor remains open and the label toggles immediately. Save and reload a source paragraph break after canceling it.
7. After Enter verify buttons are disabled, linger about four seconds, then animate down and fade. Double-click a new word during the linger to reset it.
8. Regression-check MP4 play/seek, source JSON, project save/reopen, and MP4 export.
