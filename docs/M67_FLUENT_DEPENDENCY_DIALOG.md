# M6.7 — Fluent-style dependency dialogs

## Scope

- Replace the legacy WPF `Yes/No` messages shown when preparing `node_modules` and the Remotion export browser with a Win11-inspired, keyboard-accessible React modal dialog.
- Preserve the application requirement that **.NET, WebView2 and Node.js must be installed by the user**. The app does not download or install these system-level runtimes.
- Use the existing WebView2 bridge for `dependency-confirm` → `dependency-decision`, accepting the reply **even while export is busy**.
- Show genuine indeterminate progress during npm installation and browser preparation. Do not display a guessed percentage.
- Offer retry on dependency preparation errors, and do not re-import or lose the current subtitle.
- Keep the existing npm staging/rollback and export code.
- Missing WebView2 or startup failures still use a native WPF notification, because React cannot load until WebView2 is available.

## Dialog details

- Width: approximately 460 DIP; 12 DIP corner radius; 24 DIP side padding.
- Semibold 16 DIP heading; 14 DIP body and buttons; 13 DIP helper text.
- Primary button uses the established `#D3E5EB` background.
- Confirmation: Enter confirms; Escape or close rejects; keyboard tab stays within available dialog buttons.
- Progress: noncancelable once a package install has started; close is not offered until operation ends. This retains the preexisting noncancelable export policy.
- Errors: show the error text and an explicit **Retry** button.

## Windows acceptance

1. On a machine with .NET Desktop Runtime, WebView2 and Node.js installed, delete only the application's `runtime/node_modules` and its module marker, then click **Export MP4**.
2. Check the new 460-DIP confirmation, cancel once and verify there is no install.
3. Retry, approve and check the indeterminate progress and successful export.
4. With the application browser marker removed, verify the second confirmation and progress for Remotion Chrome Headless Shell.
5. Test a network failure, error dialog, retry, Escape, Enter and keyboard focus.
6. Verify unchanged media playback, project editing, and source validation.

## Tests

`npm run verify` and `dotnet publish desktop/TranscriptStudio.csproj -c Release -r win-x64 --self-contained false -o dist/wpf`.

Windows WPF compilation and actual export still require verification on a Windows machine with the requisite dependencies.
