# Transcript Studio — player shortcuts

Shortcuts apply when focus is **not** inside a text field, select, content-editable area or seek slider. `Ctrl+S` saves the editing project (existing behavior). Frame stepping pauses playback; the frame duration is based on the project export fps (default 30). Stop pauses and seeks to 0. Seek commands clamp to the media duration. Volume step is 5 percentage points.

| 功能 | 快捷键 |
| --- | --- |
| 播放/暂停 | 空格 |
| 停止并回到开头 | X |
| 下一帧 | F |
| 上一帧 | D |
| 快进 10 秒 | → |
| 快退 10 秒 | ← |
| 快进 30 秒 | Ctrl + → |
| 快退 30 秒 | Ctrl + ← |
| 恢复正常速度 | Z |
| 增加音量 | ↑ |
| 减少音量 | ↓ |
| 静音/取消静音 | M |
| 打开 MP4 文件 | Ctrl + O |
| 保存工程 | Ctrl + S |

The transport is ordered **progress bar → elapsed/total time → play/pause icon → stop icon**. The folder picker remains available via the visible button, without a keyboard shortcut. WPF uses a native folder dialog and lists MP4 files in the chosen directory. Browser development mode uses folder upload where supported; these modes are not identical for file system security reasons.

Windows app icon source: `desktop/assets/app.ico`. Web favicon source: `public/app.ico` (copied from the identical uploaded ICO).

M6 layout revision: the on-screen volume slider has been removed. The volume and mute keyboard shortcuts remain available. The transport time label is displayed above the progress track.
