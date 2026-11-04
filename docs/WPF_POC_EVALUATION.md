# English Video Reader · WPF 桌面 PoC 技术评估

日期：2026-11-04

本文件保留选型阶段的历史验证。后续已确定使用 WPF，真实素材验证见 [M1 报告](M1_READING_RENDER_VALIDATION.md)。

## 环境与验证范围

本机已有 .NET SDK 8.0.424 和 10.0.403、Windows Desktop Runtime 10.0.14、WebView2 Evergreen Runtime、Node.js 24.19.0 和 Chrome。PoC 使用 .NET 10 的 WPF SDK 与现有 NuGet 缓存中的 Microsoft.Web.WebView2 1.0.4258.31。按项目清单恢复 React、TypeScript、Vite 和 Remotion 4.0.539。Rust、Tauri CLI 和 Microsoft C++ Build Tools 未安装。

本轮沿用原型的 React 阅读画布、WhisperX 解析、逐词高亮、排版和滚动算法。WPF 负责窗口、读取配对文件、写入工程 JSON 和启动 Node 导出进程。打开素材采用单个文件选择器。递归素材树、全局设置、导出取消和长视频压力测试属于后续产品验证。

## 实际观察

- 前端生产构建和 WPF Release 发布通过。原有 TypeScript 核心测试 8 项通过。
- 真实素材识别出 904 个词项、0 条字幕提示，WebView2 取得 377.51 秒媒体时长。10 秒合成素材在窗口内播放，播放计时从 0 推进至 3.28 秒。
- 第一次试用动态 WebView2 文件夹映射时，字幕可读，MP4 未取得媒体时长。微软文档说明页面加载后新增映射可能需要重新加载页面。修正版让 WebView2 把用户选中的 DOM File 交给 React，用对象 URL 播放，同一个 File 通过 WebView2 消息交给 WPF 取得路径。这样预览无需把整份视频复制进 C# 或启动本地 HTTP 服务。
- 在含中文和空格的测试素材上，从字幕页插入分段并保存。工程 JSON 实际包含首词的 paragraphAfter 设置及源字幕 SHA-256。重开同一素材时界面确认恢复工程。测试源 MP4 和 JSON 在保存及导出前后哈希一致。
- 从 WPF 的「导出 MP4」按钮运行 Remotion，界面显示进度及最终路径。FFmpeg 完整解码 300 帧，容器时长约 10.01 秒，视频为 1200×1600、30 fps、H.264，包含一条非静音 AAC 音轨。检查第 2 秒的成片帧，确认上方是合成视频背景，下方保留保存的分段和当时的逐词上色。
- 稳定性结论限于单机启动、两组素材读取、一次工程保存与恢复及一次短片导出。真实长片完整导出、跨机器安装、长文滚动与预览逐帧一致性仍待验证。

微软参考：[WebView2 文件夹映射](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.setvirtualhostnametofoldermapping)。

## 架构判断

WPF 与 WebView2 足以承载这套 Windows 工作台。桌面层的新增工作主要是 WebView2 消息契约、文件生命周期和子进程状态。React 继续负责界面、排版和字幕效果。Remotion 继续负责离线编码，两边沿用同一阅读画布。WPF PoC 依赖本机 .NET Desktop Runtime 与 WebView2，导出还依赖 Node.js、已还原的项目依赖和 Remotion 所用的 Chrome。此次复用了本机 Chrome，桌面导出使用 WebView2 已读取的媒体时长和画面尺寸，原 CLI 的 ffprobe 路径仍可用。

Tauri 在 Windows 也使用 WebView2。其结构允许沿用 React、TypeScript 和 Remotion，桌面文件和进程接口需改接 Rust 命令，同时新增 Rust MSVC 工具链、Microsoft C++ Build Tools、Tauri CLI 和相关配置的维护。对 Windows 单平台目标，本轮未发现足以抵消这些新增工作的优势。若将来明确要求跨平台桌面交付，或 WPF 在长片测试中出现可复现且难以解决的限制，再确定第二套 PoC 要验证的问题与安装范围。

Tauri 参考：[Windows 前置要求](https://v2.tauri.app/zh-cn/start/prerequisites/) · [项目接入](https://v2.tauri.app/start/create-project/)。

## 复现

```powershell
npm.cmd ci
npm.cmd run build
dotnet publish desktop/EnglishVideoReader.csproj -c Release -o dist/wpf-poc
```

双击发布目录下的 EnglishVideoReader.exe。在「素材」页选中 MP4，同目录需有同名 WhisperX JSON。编辑后点击「保存工程 JSON」，重新打开同一素材可恢复工程。点击「导出 MP4」，成片写入素材所在目录的 exports 子目录。此 PoC 的发布目录需保留在项目内，以便找到 Remotion 脚本和依赖。
