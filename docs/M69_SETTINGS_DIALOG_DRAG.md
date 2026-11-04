# Transcript Studio M6.9 — Settings dialog drag and timeline alignment

## Changes

- Settings dialog outer frame: 384 x 500 CSS px (DIP at 100% WebView scale).
- Dynamically limit the outer frame to viewport minus 16 px on each side; no 360 px minimum height.
- Center the dialog each time it opens. Closing resets its position; reopening does not restore the last drag location.
- Allow dragging only on the header; the close button never starts dragging.
- Keep all four panel edges inside the 16 px viewport inset while dragging; clamp position after viewport resize.
- Clicking the backdrop closes the dialog; releasing a title-bar drag outside the panel does not.
- Keep settings controls and grid sizing unchanged; the body alone scrolls on overflow.
- Video time label: 11 to 12 px, moved visually downward 3 px without changing the 48 px transport grid and slider hit area.

## Windows acceptance checklist

1. Open Settings. It should be centered and approximately 384 x 500 DIP.
2. Drag the header in each direction; verify a minimum 16 DIP margin and no title selection.
3. Click the close icon, then reopen: the dialog returns to the center.
4. Drag controls, select text inside inputs, use the dropdown, and change colors; these must not move the dialog.
5. Click the main window outside the dialog to close it.
6. Resize the main window to less than 532 DIP client height. The settings outer height should shrink while keeping 16 DIP top/bottom gaps; enlarge it again and confirm 500 DIP returns.
7. Drag the dialog against an edge, resize the main window, verify the dialog remains within the available bounds.
8. Scroll through Settings to the bottom. All grid column origins, fonts, and vertical control spacing must remain unchanged.
9. Play, pause, and seek a video. The time should appear 1 DIP larger and ~3 DIP lower; the progress slider and button positions should be unchanged.

## Commands

```bat
npm.cmd run verify
dotnet publish desktop/TranscriptStudio.csproj -c Release -r win-x64 --self-contained false -o dist/wpf
```

## Validation limitations

In the packaging environment, core tests, Subtitle Skill tests, and TSX syntactic parsing were run successfully. `npm run typecheck` cannot complete here because the full npm packages and Node type declarations are absent. .NET/WPF compilation and GUI validation require Windows.
