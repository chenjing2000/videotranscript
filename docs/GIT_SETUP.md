# Git setup — Video Transcript M5

This package contains source for the existing local project; do **not** assume a new public repository exists or change your Git remote as part of installation.

On your existing Windows checkout, use a feature branch before replacing M4 source:

```powershell
cd C:\Projects\EnglishVideoMaker
git switch -c feature/video-transcript-m5
# Copy the contents of VideoTranscript/ from this ZIP into this existing working directory.
# Remove obsolete M4 files only after comparing your working tree.
npm.cmd ci
npm.cmd run verify
dotnet publish desktop/VideoTranscript.csproj -c Release -o dist/wpf-m5
git status
```

`.tmp-core/`, `dist/`, `node_modules/` and personal source `video/` are ignored. Run Windows UI and MP4 export acceptance tests before merging or pushing to main. Renaming the GitHub repository is a separate user-controlled operation, not required for the new executable name.
