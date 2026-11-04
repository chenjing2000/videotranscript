# M6.8 — Cancel dependency preparation

## Scope

This revision keeps Remotion's dedicated Chrome Headless Shell and the existing Node.js system installation policy. It changes only application-managed preparation for `runtime/node_modules` and Remotion's browser.

- The progress dialog now shows **取消安装** and supports Escape to request cancellation.
- The dialog becomes **正在取消…** while the host terminates the child process tree. The button becomes disabled, preventing duplicate requests.
- WPF accepts `dependency-cancel` messages even during export preparation. Only the current dependency-preparation cancellation source is affected; full MP4 render cancellation is **not** included.
- The npm installation remains staged under `runtime/.npm-install-*`; on cancellation the staged directory is removed. Existing `runtime/node_modules` is not replaced until verification completes.
- Browser preparation exits without writing `.browser-ready` on cancellation, so the next attempt retries. Chrome Headless Shell's own downloader may leave its internal temporary cache on interruption; the application deliberately avoids deleting shared or previously installed browser data without verified ownership.
- Windows task cancellation kills the specific launched `npm.cmd`/`node.exe` process tree and waits for termination before signaling that the installation has ended. Normal completion continues the originally requested export.

## Manual Windows acceptance

1. With `runtime/node_modules` missing, click MP4 export, accept module installation, then press **取消安装**. Ensure the progress dialog changes to **正在取消…** and closes only once the operation ends.
2. Check the old working `runtime/node_modules` (if it existed) remains usable; verify `runtime/.npm-install-*` temporary directories are removed.
3. Retry installation and allow it to finish. Confirm that installation resumes normal MP4 export without reimporting the transcript.
4. Trigger Remotion browser preparation with its marker absent, press **取消安装**, then retry. Verify `.browser-ready` is never written on cancellation.
5. Verify that the dialogue cannot be canceled a second time while **正在取消…** and that the app still plays videos and edits subtitles.
6. Verify that the procedure does not terminate unrelated user Node.js processes.

## Build

```cmd
npm.cmd run verify
dotnet publish desktop/TranscriptStudio.csproj -c Release -r win-x64 --self-contained false -o dist/wpf
```

Tests that only inspect source and core TypeScript cannot prove process-tree cancellation or that a browser download is fully cleaned on the user's Windows machine. Those need the above Windows tests.
