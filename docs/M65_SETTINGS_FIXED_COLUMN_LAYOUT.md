# M6.5 Settings Window – Fixed Column Layout

## Scope

- All settings group rows use one four-column grid (CSS DIPs).
- Column origins relative to the left content edge: **0, 64, 190, 254 DIP**.
- Dialog outer width: **384 DIP**; settings body horizontal padding: **17 DIP**, with approximately **18 DIP** of free space on the right after the widest color control.
- Grid track widths: `64px 126px 64px 96px`; no inter-track gap. Row gap: 10 DIP.
- All inputs and selects are **70 DIP** wide, excluding unit labels, except the **paragraph alignment** select, which is **90 DIP** wide.
- Every hexadecimal color input is **70 DIP** wide, followed by a fixed **20 DIP diameter circle**.
- The text field and its color circle are separated by **5 DIP**.
- Labels remain on the same row as controls; labels are left aligned, controls center their text.
- The right editor font-size label is **大小**, not **正文字体大小**.
- Section titles remain 16 DIP bold and labels/controls 14 DIP regular.
- No changes to settings schema, playback, layout calculations, paragraph logic, or export logic.

## Deployment note

This archive also incorporates the previously delivered NETSDK1176 patch: `EnableCompressionInSingleFile=false` with `SelfContained=false`. The prior M6.5 full source did not include that independently delivered build fix.

## Validate on Windows

```bat
npm.cmd ci
npm.cmd run verify
dotnet publish desktop/TranscriptStudio.csproj -c Release -r win-x64 --self-contained false -o dist/wpf
dist\wpf\TranscriptStudio.exe
```

Check all five groups, especially third-column alignment, long font names, centered input text, round color swatches, and window scrolling on smaller screens.
