# EVR Transcript v1 — important M4 update

**Reader now accepts only `<video-stem>.evr-transcript.json` produced and validated by the Skill at [`docs/english-transcript-paragraphs/SKILL.md`](docs/english-transcript-paragraphs/SKILL.md). Raw `<video-stem>.json` is deliberately rejected by the UI, WPF pairing, and the MP4 export CLI.** This is a breaking input format change. Original MP4 and original WhisperX JSON are preserved.

To prepare an input, see [`docs/M4_FORMAT_MIGRATION.md`](docs/M4_FORMAT_MIGRATION.md). The included standardized fixture is an example, not an assertion that the semantic paragraphs have undergone final editorial approval.

> M3 更新：默认 Word 式两端对齐、减少分页留白、`npm test` 自动编译。详见 `docs/M3_JUSTIFICATION_AND_PAGE_FILL.md` 和 `M3_APPLY.md`。

# English Video Reader — WPF + React + Remotion (M2 静态分页源码版)

这是基于 Windows WPF PoC 更新的 **M2 静态分页**源码，不是已在 Windows 上运行验证完成的安装包。完整开发/验证要求见 [`HANDOFF.md`](HANDOFF.md)。

- 原生桌面：.NET 10 WPF + WebView2。
- 阅读及样式：React + TypeScript；静态页面、瞬时切换、按时间逐词线性着色。
- 导出：Remotion 4.0.539，1200×1600、默认 30 fps，保留源视频原声。
- 输入：WhisperX JSON（支持语义段落标记），工程保存到 `.evr/projects/`，导出到 `exports/`。

## 在 Windows 构建

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
dotnet publish desktop/EnglishVideoReader.csproj -c Release -o dist/wpf-m2
```

双击 `dist/wpf-m2/EnglishVideoReader.exe`。需已有 Node.js、Chrome/Remotion 依赖及 .NET WebView2。现阶段请从项目工作树内运行，Remotion 导出脚本路径会向上搜索项目目录。

## 本轮已运行测试

在本环境 `bash scripts/test-core.sh`：24/24 通过；因当前环境 npm 依赖不全，没有完成 `npm run build` 或 WPF / Remotion 端到端验收。请勿将核心测试通过理解为桌面导出已被本次验证。

## 分段 JSON

`fixtures/6 Minute English 01-seg1_semantic.evr-transcript.json` 是从用户提供的 80 秒 WhisperX 样本生成的 **8 段语义分组草稿**，保留全部单词时间戳。请在独立测试目录使用，避免覆盖原字幕。`fixtures/6 Minute English 01-seg1.json` 是原始测试字幕副本，仅供 Skill 转换/负面测试。
