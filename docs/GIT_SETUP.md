# Publishing this prototype to your empty GitHub repository

```powershell
git clone https://github.com/chenjing2000/englishvideomaker.git
# Unzip the delivered prototype and copy its contents into the cloned directory
git add .
git commit -m "feat: bootstrap English Video Reader core prototype" -m "Add WhisperX parser, highlight/scroll engine, preview, Remotion export draft, tests, and Codex handoff."
git push origin main
```

Adapt the default branch name if different. **Do not commit private/TED video or JSON without permission**. `fixtures/demo.mp4` is synthetic and can be regenerated locally; `.gitignore` currently ignores MP4, so source repo stays lightweight. Use `git switch -c feature/tauri-integration` for Codex next milestone.
