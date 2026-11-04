using System.IO;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;

// Opt-in evidence for the M1 acceptance run, activated only by Transcript Studio_M1_EVIDENCE.
internal static class M1Capture
{
    public static async Task SaveAsync(CoreWebView2 view, string directory, JsonElement snapshot)
    {
        Directory.CreateDirectory(directory);
        await File.WriteAllTextAsync(Path.Combine(directory, "snapshot.json"), snapshot.GetRawText());

        const string media = "document.querySelector('video')";
        var original = JsonSerializer.Deserialize<double>(await view.ExecuteScriptAsync(media + ".currentTime"));
        var wasPaused = await view.ExecuteScriptAsync(media + ".paused") == "true";
        await view.ExecuteScriptAsync(media + ".pause()");
        try
        {
            var fps = snapshot.GetProperty("project").GetProperty("export").GetProperty("fps").GetInt32();
            var duration = snapshot.GetProperty("duration").GetDouble();
            double[] times = [0, 7.5, 14.4, 14.428, 19.181, 24, 24.0645, 27.6875, 35, 50, 65, 75, duration];
            var frames = times.Select(time => Math.Min((int)Math.Round(time * fps), (int)Math.Ceiling(duration * fps) - 1)).Distinct();
            foreach (var frame in frames)
            {
                var time = JsonSerializer.Serialize((double)frame / fps);
                await view.ExecuteScriptAsync($"{media}.currentTime = {time}");
                string state = "null";
                for (var attempt = 0; attempt < 100 && state == "null"; attempt++)
                {
                    await Task.Delay(35);
                    state = await view.ExecuteScriptAsync($$"""
                        (() => {
                          const video = {{media}};
                          const reader = document.querySelector('[data-reader-time]');
                          if (video.seeking || video.readyState < 2 ||
                              Math.abs(Number(reader.dataset.readerTime) - {{time}}) > .001) return null;
                          const rect = reader.getBoundingClientRect();
                          return {
                            time: Number(reader.dataset.readerTime),
                            duration: video.duration,
                            pageIndex: Number(reader.dataset.pageIndex),
                            pageCount: Number(reader.dataset.pageCount),
                            clip: {x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1},
                            rows: Array.from(reader.querySelectorAll('[data-reader-row]'), row => ({
                              top: parseFloat(row.style.top),
                              font: getComputedStyle(row).fontFamily,
                              size: getComputedStyle(row).fontSize,
                              lineHeight: getComputedStyle(row).lineHeight,
                              words: Array.from(row.querySelectorAll('[data-word]'), word =>
                                [word.dataset.word, Number(word.dataset.progress)])
                            }))
                          };
                        })()
                        """);
                }
                if (state == "null")
                    throw new InvalidOperationException($"无法在预览中取得第 {frame} 帧。");
                using var data = JsonDocument.Parse(state);
                var clip = data.RootElement.GetProperty("clip");
                var png = await view.CallDevToolsProtocolMethodAsync("Page.captureScreenshot",
                    JsonSerializer.Serialize(new { format = "png", clip, captureBeyondViewport = true }));
                using var result = JsonDocument.Parse(png);
                await File.WriteAllBytesAsync(Path.Combine(directory, $"preview-{frame:D4}.png"),
                    Convert.FromBase64String(result.RootElement.GetProperty("data").GetString()!));
                await File.WriteAllTextAsync(Path.Combine(directory, $"preview-{frame:D4}.json"), state);
            }
        }
        finally
        {
            await view.ExecuteScriptAsync($"{media}.currentTime = {JsonSerializer.Serialize(original)}");
            if (!wasPaused)
                await view.ExecuteScriptAsync(media + ".play()");
        }
    }
}
