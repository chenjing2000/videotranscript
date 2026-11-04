# M3 Windows 合并与验收

本压缩包是在之前交付的 `EnglishVideoReader_M2_WPF_Updated_Source.zip` 基础上增量改写的完整源码。请在 Git 分支中合并，不要删除已有视频和个人工程数据。

## 新增功能

1. Word 标准两端对齐（默认），段落末行仍左对齐；「样式 → 页面排版」可切换「左对齐」。
2. 自然段跨页允许使用剩余页面高度，降低大面积留白。
3. `npm test` 自行编译核心临时产物，修复 `.tmp-core/index.js` 不存在的问题。

## Windows 命令

```powershell
cd C:\Projects\EnglishVideoMaker
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
dotnet publish desktop/EnglishVideoReader.csproj -c Release -o dist/wpf-m3
.\dist\wpf-m3\EnglishVideoReader.exe
```

用约 80 秒测试 MP4 + 同名 WhisperX JSON 验证：页内无移动、普通行两端对齐、自然段末行左对齐、段落可跨页、首行 `4ch` 缩进、原有逐词着色、MP4 导出音视频正常。

## 重要说明

当前包中的 WPF 代码仍来自你此前提供的 M2 基线。如你在 Windows 上又自行修改过 WPF 代码，请按 Git diff 选择性合并，不要整个覆盖。
