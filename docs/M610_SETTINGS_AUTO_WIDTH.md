# M6.10 — Settings dialog measured width

## Scope

Only the width selection of the draggable settings dialog has changed. All controls, fixed four-column spacing, 500-DIP default height, 16-DIP viewport insets, header-only dragging, outside-click closure, and transport controls remain as in M6.9.

## Behavior

1. On opening, render the settings panel at its 384-DIP initial measurement width.
2. Before paint, measure the `.m65-settings` element's intrinsic or scroll width, plus the settings body's horizontal padding and the vertical scrollbar width.
3. Round strictly upward to the next multiple of 10 DIP (`394 -> 400`, `400 -> 410`, `409 -> 410`).
4. Use this number as the preferred outer width and recalculate the centered dialog geometry. As in M6.9, width is limited to the viewport minus 32 DIP (16 DIP on each side).
5. Measure once per opening. Ordinary setting edits do not resize the popup. Closing and reopening clears the position and measurement and recenters the popup.
6. When the main window is narrower than the intrinsic required width, leave the controls unchanged and permit scrolling as a last resort rather than clipping them.

The full calculation is in `src/core/settings-dialog-geometry.ts`; the DOM measurement happens in a React `useLayoutEffect` in `src/main.tsx`. The vertical scrollbar is accounted for explicitly so that a bottom horizontal scrollbar is not introduced by a too-narrow body.

## Validation

Run on Windows from the source directory:

```bat
npm.cmd ci
npm.cmd run verify
dotnet publish desktop/TranscriptStudio.csproj -c Release -r win-x64 --self-contained false -o dist/wpf
```

Manually check the *real Windows WebView2* window: open Settings at typical and narrow sizes; ensure there is no horizontal scroll at normal window sizes, especially for the right-hand color swatches and the paragraph-alignment dropdown. Verify the dialog is centered, can be dragged only by the header, stays within the 16-DIP boundary, closes by clicking outside, and recovers its measured width after maximizing/restoring and reopening. Verify that the original 500-DIP default height and playback controls are unchanged.

The offline Node core tests and Python skill tests can be run in this packaging environment; actual WPF/WebView2 layout and complete TypeScript/Vite builds require the target environment and dependencies.
