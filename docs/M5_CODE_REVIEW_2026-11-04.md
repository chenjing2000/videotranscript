# Video Transcript M5 — 代码审查报告（2026-11-04）

## 范围与依据

按照 `docs/skills/video-transcript-code-review/SKILL.md`，审查 WPF/WebView2、React UI、TypeScript 核心、Video Transcript v2 字幕契约、分页/两端对齐、Remotion 导出、测试与项目资源。审查基线为此前交付的 `VideoTranscript_M5_Player_Skills_Icon_Update.zip`，不是用户本地未上传的最新 Git 工作树。本次修改坚持最小必要原则。

## 已修复：确定性问题

| 等级 | 位置 | 问题 | 处理 |
| --- | --- | --- | --- |
| 功能要求 | `src/core/player-shortcuts.ts` / `src/main.tsx` | `Ctrl+F` 绑定打开文件夹，与本次需求冲突 | 完全移除键盘映射，保留“素材 → 打开文件夹”按钮及 WPF 原生选目录功能；调整提示文案及回归测试 |
| 正确性 | `src/core/pagination.ts` | 对隐藏单词直接 `filter` 会丢弃该单词附带的 `breakParagraph`，使两个自然段意外合并 | 在生成可见单词副本时将隐藏词的段落边界继承给前一个可见单词；不改动原始数据与用户覆盖记录 |
| 正确性/鲁棒性 | `src/core/pagination.ts` | `isPagePlan()` 对外部分页快照仅作浅层验证，不能有效拒绝损坏的内部词位置和开关时间 | 检查结构、行/词字段、数值有效性、索引以及时间顺序；加入非法快照测试。此校验不代替工程源数据的 SHA-256 校验 |
| 文档与清理 | `docs/PLAYBACK_SHORTCUTS.md`、更新说明、Code Review Skill、`.gitignore` | 快捷键说明过期；Python 缓存未忽略 | 同步更新文档，并排除 `__pycache__/`、`*.pyc` |

**保留行为**：Space 播放/暂停、X 停止、F/D 单帧移动、方向键前后跳转、音量/静音、Ctrl+O 打开文件、Ctrl+S 保存；打开文件夹按钮、Video Transcript v2 数据标准、单词绝对横坐标、Word 两端对齐、严格逐行分页和 Remotion 导出架构均未删除或替换。

## 已检查但不做高风险重构

- **架构**：WPF 控制本地文件、进程、窗口，React 负责用户界面；核心段落/分页逻辑位于 `src/core`。当前结构可用，未强行引入 MVVM 框架、DI 或消息总线。
- **数据契约**：前端和 CLI 的 v2 校验器均验证 `video_transcript.format`、版本和 `breakParagraph`；只在单词级设置段落标记；原始 `word_segments` 不加标记。Skill 提供原始源数据一致性校验。
- **排版**：保留 1200×1600 固定画布、横坐标定位、自然段末行左对齐与逐行最大填充。新增覆盖“隐藏分段词”的回归测试。
- **播放**：快捷键在输入框、下拉框和进度条聚焦时被屏蔽，删除 `Ctrl+F` 不影响 F 单帧前进。
- **导出**：导出路径带碰撞后缀且不覆盖原始视频；C# 使用临时工程与分页快照，导出完成后清理；已有源指纹校验保留。
- **资源**：`desktop/assets/app.ico` 与 `public/app.ico` 均保留。无确认无用的用户文件被删除。

## 尚存风险 / 建议后续处理

1. **Windows 实测未完成（验收必需）**：此环境无 .NET SDK/Windows GUI，无法启动 WPF、检验快捷键焦点与窗口图标，也无法运行真实 MP4 导出。请在 Windows 上执行发布及播放/导出验收。
2. **前端完整构建未完成（验收必需）**：离线 npm 缓存缺少依赖（`zod`），`npm ci --offline` 失败；`npm run typecheck` 和 `npm run build` 因缺少 `@types/node` 未通过。不是发现 TypeScript 源码语义错误，而是依赖不完整；不可宣称它们通过。
3. **导出中止/窗口关闭（维护性）**：C# 目前用 `exporting` 阻止关闭窗口，但尚无明确取消导出/杀掉渲染进程的完整交互。涉及产品行为，建议另开任务设计并验收，不在本次代码审查中擅自改变。
4. **键盘事件重订阅（维护性）**：React 的 `keydown` effect 在渲染后重新注册；功能正常，但高频进度刷新可能使其频繁更新。可在后续单独重构为稳定监听器及最新 handler ref，并做 UI 实测。
5. **导出快照一致性（维护性）**：`isPagePlan()` 现在能拒绝损坏结构，但未提供完整的字幕/字体/样式内容哈希证明。Remotion CLI 接收可选 `--page-plan` 时应继续确保快照与同一源字幕及样式对应；建议后续建立跨端集成测试。

## 实际验证

- `tsc --target ES2022 --module commonjs --strict --skipLibCheck --outDir .tmp-core src/core/*.ts`（环境全局 TypeScript 5.8.3）：**通过**。
- `node --test tests/*.test.mjs`：**58/58 通过**，包括删除 Ctrl+F 和新增分页数据防护测试。
- `python -m unittest discover docs/skills/video-transcript-paragraphs/tests -v`：**6/6 通过**。
- `npm ci --offline --ignore-scripts --no-audit --no-fund`：**未通过**（npm 离线缓存缺少依赖）。
- `npm run typecheck` / `npm run build`：**未通过**（`@types/node` 等完整依赖缺失）。
- `dotnet publish` / Windows GUI / Remotion MP4：**未执行**（平台和依赖不具备）。

## Windows 验收命令

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test:skill
dotnet publish desktop/VideoTranscript.csproj -c Release -o dist/wpf
.\dist\wpf\VideoTranscript.exe
```

手工验证：`Ctrl+F` 不应打开文件夹，点击“打开文件夹”仍打开选择窗口；`F` 仍可单帧前进；其余快捷键在视频播放和字幕编辑场景下不冲突；按 v2 字幕可预览、保存工程并导出有声音的 MP4。

## Git 状态

此交付是独立源码 ZIP，没有用户仓库的 `.git` 历史与当前工作树。**未运行 `git commit` 或 `git push`**。提交时必须使用英文 message，并先确认本地状态：

```powershell
git status
git add -A
git commit -m "fix: remove folder shortcut and harden transcript page validation"
git push origin <current-branch>
```

`<current-branch>` 为示意占位，应替换成 `git branch --show-current` 的实际结果，禁止盲目推送到 main 或使用强制推送。
