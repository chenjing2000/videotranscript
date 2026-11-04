# Video Transcript M5 — 修改与验收说明

## 已实施

- **完整更名**：项目包 `video-transcript`、WPF `VideoTranscript.csproj`、程序集 `VideoTranscript.exe`、C# 命名空间 `VideoTranscript`、WebView2 配置目录 `VideoTranscript/WebView2`，界面和 Remotion Composition 同步更名。GitHub 远程仓库不在程序中自动重命名。
- **严格 v2 输入**：必须使用 `<视频同名>.video-transcript.json`，以及根节点 `video_transcript: {"format":"video-transcript", "schemaVersion":2}`。原始 WhisperX、EVR v1、错误字段和旧工程均拒绝；不提供迁移工具。
- **逐词分段**：`segments[].words[].breakParagraph: true` 为唯一自然段标记，未标记的词不断段；`false` 在源字幕中非法。最终词无需添加标记。`word_segments` 不加标记、不参与分段。
- **统一接口**：TypeScript 解析后 `Word.breakParagraph`、工程 `overrides[id].breakParagraph`、布局引擎全部统一；编辑工程允许 `false` 明确取消源标记。内部单词 ID `s<w>` 风格保持 `s{segment}w{word}`，用于编辑，不用于源字幕分段。
- **分页**：删除句末评分和孤/寡行惩罚，严格按行高与当前页剩余空间顺序装入。保留 `PageWord.x` 横坐标计算和 Word 式两端对齐。自然段跨页不重复首行缩进，段前间距只有在同页有上一行时计算。
- **Skill**：`docs/skills/video-transcript-paragraphs/`，`inspect`、`build`、`edit`、`validate`；保护源 JSON、可生成 Markdown 分段预览、可重划已有 v2 字幕而不覆盖原件。
- **样本**：`samples/` 下两套视频同名 v2 字幕与 Markdown 预览，可直接复制到你本地对应 MP4 的目录。

## 已运行的检查

- `node scripts/test-core.mjs`：**41 / 41 PASS**。
- `python -m unittest discover docs/skills/video-transcript-paragraphs/tests -v`：**6 / 6 PASS**。
- 样本一致性：`6 Minute English 01-seg1` 200 词 / 8 段；完整版 904 词 / 31 段。移除新加入的 `video_transcript` 和单词级 `breakParagraph` 后，均与此前上传的原始 WhisperX JSON 对象 **完全一致**。
- 重要用例：`animal lovers.` 后不得断段，后续 `In the UK` 仍属于该段；在 `without.` 后断段。

## 尚未在当前容器验证

当前容器缺少完整 npm 安装缓存（`npm ci --offline` 在 `zod-4.5.4.tgz` 报 `ENOTCACHED`），而且没有 .NET SDK / Windows 图形运行环境。因而 **完整 `npm run typecheck`、Vite `build`、`dotnet publish`、WPF 实测和 MP4 渲染均尚未通过实机验证**。这些不能因核心测试通过而视为已通过。

## Windows PowerShell 验收

```powershell
cd C:\Projects\EnglishVideoMaker
# 在备份和功能分支中，将 ZIP 内 VideoTranscript/ 的内容复制到这个仓库根目录
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test:skill

dotnet publish desktop/VideoTranscript.csproj -c Release -o dist/wpf-m5
.\dist\wpf-m5\VideoTranscript.exe
```

如你在已有仓库原位解压，请删除无用的 `desktop/EnglishVideoReader.csproj` 及旧 `docs/english-transcript-paragraphs/` 源码目录（先确认其中没有个人修改），否则会在工作树保留历史文件。旧版 `.evr` 项目数据请自行备份，不会被 M5 自动加载或迁移。

启动后，将 `samples/6 Minute English 01-seg1.video-transcript.json` 复制到与 `6 Minute English 01-seg1.mp4` 同目录；完整版同理。检查字体、逐词高亮、拖动进度条、页面连续性、页底空间、Word 式左右对齐、音轨以及实际完整 MP4 导出。

## 源码与文档

- `docs/skills/video-transcript-paragraphs/SKILL.md`：Skill 正式使用规范
- `docs/skills/video-transcript-paragraphs/references/TRANSCRIPT_SCHEMA.md`：v2 字幕标准
- `docs/M5_DESIGN_AND_VALIDATION.md`：算法规则与交付验收
- `docs/ARCHITECTURE.md`：前后端/渲染链路说明
- `docs/DATA_MODEL.md`：内部和工程持久化数据

