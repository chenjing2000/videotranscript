using System.Diagnostics;
using System.IO;
using Microsoft.Web.WebView2.Core;

namespace TranscriptStudio;

/// <summary>
/// Serves only the currently selected media file over a dedicated WebView2 request
/// endpoint. Unlike dynamic folder mappings, this endpoint supports HTTP byte ranges
/// and cannot expose other files from the user's media directory.
/// </summary>
internal sealed class LocalMediaServer
{
    private const string MediaHost = "media.transcript-studio.test";
    private const string Prefix = "https://" + MediaHost + "/media/";
    private const string AllowedOrigin = "https://reader.transcript-studio.local";
    private readonly CoreWebView2 browser;
    private string? selectedPath;
    private string? selectedToken;

    internal LocalMediaServer(CoreWebView2 browser)
    {
        this.browser = browser;
        browser.AddWebResourceRequestedFilter(Prefix + "*", CoreWebView2WebResourceContext.All);
        browser.WebResourceRequested += Respond;
    }

    internal string Select(string absoluteFilePath)
    {
        var path = Path.GetFullPath(absoluteFilePath);
        if (!File.Exists(path)) throw new FileNotFoundException("媒体文件不存在。", path);
        selectedPath = path;
        selectedToken = Guid.NewGuid().ToString("N");
        return Prefix + selectedToken + "/" + Uri.EscapeDataString(Path.GetFileName(path));
    }

    private void Respond(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        var request = e.Request;
        if (!Uri.TryCreate(request.Uri, UriKind.Absolute, out var uri) ||
            uri.Host != MediaHost || !uri.AbsolutePath.StartsWith("/media/", StringComparison.Ordinal)) return;

        try
        {
            var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length != 3 || segments[0] != "media" ||
                !string.Equals(segments[1], selectedToken, StringComparison.Ordinal) ||
                selectedPath == null || !string.Equals(Uri.UnescapeDataString(segments[2]), Path.GetFileName(selectedPath), StringComparison.Ordinal))
            {
                Reply(e, Stream.Null, 404, "Not Found", "Content-Length: 0");
                return;
            }
            if (request.Method == "OPTIONS")
            {
                Reply(e, Stream.Null, 204, "No Content", "Content-Length: 0\r\nAccess-Control-Allow-Methods: GET, HEAD, OPTIONS\r\nAccess-Control-Allow-Headers: Range");
                return;
            }
            if (request.Method is not ("GET" or "HEAD"))
            {
                Reply(e, Stream.Null, 405, "Method Not Allowed", "Content-Length: 0\r\nAllow: GET, HEAD, OPTIONS");
                return;
            }
            var file = new FileStream(selectedPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            var size = file.Length;
            var rangeHeader = request.Headers.Contains("Range") ? request.Headers.GetHeader("Range") : null;
            if (!MediaByteRanges.TryResolve(rangeHeader, size, out var start, out var end))
            {
                file.Dispose();
                Reply(e, Stream.Null, 416, "Range Not Satisfiable", $"Content-Range: bytes */{size}\r\nContent-Length: 0");
                return;
            }
            var partial = rangeHeader != null;
            var length = size == 0 ? 0 : end - start + 1;
            var mime = Path.GetExtension(selectedPath).ToLowerInvariant() switch
            {
                ".mp4" => "video/mp4", ".mkv" => "video/x-matroska",
                ".mp3" => "audio/mpeg", ".wav" => "audio/wav", _ => "application/octet-stream"
            };
            var headers = $"Content-Type: {mime}\r\nAccept-Ranges: bytes\r\nContent-Length: {length}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff";
            if (partial) headers += $"\r\nContent-Range: bytes {start}-{end}/{size}";
            Stream body;
            if (request.Method == "HEAD" || length == 0)
            {
                file.Dispose();
                body = Stream.Null;
            }
            else
            {
                file.Position = start;
                body = new LimitedReadStream(file, start, length);
            }
            Reply(e, body, partial ? 206 : 200, partial ? "Partial Content" : "OK", headers);
            Trace.WriteLine($"Transcript Studio media: {request.Method} {(partial ? "206" : "200")} {Path.GetFileName(selectedPath)} range={rangeHeader ?? "all"}");
        }
        catch (Exception error)
        {
            Trace.WriteLine("Transcript Studio media read failed: " + error);
            Reply(e, Stream.Null, 500, "Media Read Error", "Content-Length: 0");
        }
    }

    private void Reply(CoreWebView2WebResourceRequestedEventArgs request, Stream body, int status, string reason, string headers)
    {
        headers += "\r\nAccess-Control-Allow-Origin: " + AllowedOrigin + "\r\nCross-Origin-Resource-Policy: cross-origin";
        request.Response = browser.Environment.CreateWebResourceResponse(body, status, reason, headers);
    }

    private sealed class LimitedReadStream : Stream
    {
        private readonly FileStream file;
        private readonly long start;
        private readonly long count;
        private long position;

        internal LimitedReadStream(FileStream file, long start, long count)
        { this.file = file; this.start = start; this.count = count; }
        public override bool CanRead => true;
        public override bool CanSeek => true;
        public override bool CanWrite => false;
        public override long Length => count;
        public override long Position
        {
            get => position;
            set => Seek(value, SeekOrigin.Begin);
        }
        public override int Read(byte[] buffer, int offset, int length)
        {
            var n = file.Read(buffer, offset, (int)Math.Min(length, count - position));
            position += n;
            return n;
        }
        public override int Read(Span<byte> buffer)
        {
            var n = file.Read(buffer[..(int)Math.Min(buffer.Length, count - position)]);
            position += n;
            return n;
        }
        public override long Seek(long offset, SeekOrigin origin)
        {
            var candidate = origin switch
            {
                SeekOrigin.Begin => offset,
                SeekOrigin.Current => checked(position + offset),
                SeekOrigin.End => checked(count + offset),
                _ => throw new ArgumentOutOfRangeException(nameof(origin))
            };
            if (candidate < 0 || candidate > count) throw new IOException("Seek outside media response range.");
            file.Seek(checked(start + candidate), SeekOrigin.Begin);
            position = candidate;
            return position;
        }
        public override void Flush() { }
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        protected override void Dispose(bool disposing)
        { if (disposing) file.Dispose(); base.Dispose(disposing); }
    }
}
