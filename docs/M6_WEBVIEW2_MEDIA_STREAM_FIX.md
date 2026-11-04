# M6 WebView2 media-loading regression fix

## Symptom

The subtitle JSON matched `6 Minute English - Dancing For The Brain - Seg01.mp4`, but the desktop preview stayed at `00:00 / 00:00`, and WebView2 raised a media-source error. The same MP4 was playable in Microsoft Edge. This strongly suggests a desktop resource-loading regression, but does not by itself prove a particular failure mode.

## Change

- Frontend application resources still use the mapped virtual host `reader.transcript-studio.local`.
- Local media no longer uses dynamically modified `SetVirtualHostNameToFolderMapping` for `media.transcript-studio.local`.
- A dedicated `LocalMediaServer`, registered *before* the first page navigation, handles `https://media.transcript-studio.test/media/<random-token>/<url-encoded-file-name>` with `WebResourceRequested`.
- The handler exposes **only the currently selected media file**, not the containing folder. A new random token is created on each JSON import; stale URLs are rejected.
- The handler supports GET and HEAD, including single HTTP byte-range reads (`206 Partial Content`, `Content-Range`, `Accept-Ranges`, correct `Content-Length`). Invalid ranges return 416. No whole-file buffering is used.
- Response content types are explicit for MP4, MKV, MP3 and WAV. Requests are logged via `System.Diagnostics.Trace`.
- Switching the JSON to another folder does not require remapping or reloading the React application.
- The source file is never modified; Remotion export still reads the original local file path.

## Windows commands

```bat
npm.cmd ci
npm.cmd run verify
dotnet run --project tests/dotnet-media-range/MediaRangeTests.csproj
dotnet publish desktop/TranscriptStudio.csproj -c Release -o dist/wpf
dist\wpf\TranscriptStudio.exe
```

## Manual checks

1. Open the previously failing `.transcript-studio.json`. Confirm that the matched MP4 appears and the total duration becomes nonzero.
2. Play, pause, drag to the middle of the progress bar, and seek to the end. Confirm that playback resumes at the requested point.
3. Open a different JSON with matching media in another directory, then reopen the first. No restart should be necessary.
4. Check MP3/WAV (full-height transcript mode) and MP4 export. Existing subtitle data and page layout must remain unchanged.
5. If an MP4 still fails, capture the error toast and inspect WebView2 DevTools Network for the `media.transcript-studio.test` request: HTTP status, `Range` and `Content-Range` headers, MIME type, and any console error. A 200/206 response followed by a decode error suggests codec issues; a missing request or failed response suggests a resource-handler problem.

## Remaining validation limitation

The source here was developed outside Windows, without the .NET SDK or complete npm dependencies. The WPF build, WebView2 integration and actual MP4 seek behavior require a Windows run. The standalone range parser tests can be executed by the command above.

## Git

Commit messages must be in English, e.g. `fix: stream local media with HTTP range support in WebView2`.
