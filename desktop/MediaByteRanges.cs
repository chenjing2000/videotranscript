using System.Globalization;

namespace TranscriptStudio;

/// <summary>Pure HTTP single-byte-range parser. Multiple ranges are intentionally rejected.</summary>
internal static class MediaByteRanges
{
    internal static bool TryResolve(string? header, long length, out long start, out long end)
    {
        start = 0;
        end = length - 1;
        if (header == null) return length >= 0;
        if (length <= 0 || !header.StartsWith("bytes=", StringComparison.OrdinalIgnoreCase)) return false;
        var value = header[6..].Trim();
        if (value.Contains(',') || value.Count(c => c == '-') != 1) return false;
        var dash = value.IndexOf('-');
        if (dash == 0)
        {
            if (!long.TryParse(value[1..], NumberStyles.None, CultureInfo.InvariantCulture, out var suffix) || suffix <= 0) return false;
            start = Math.Max(0, length - suffix);
        }
        else
        {
            if (!long.TryParse(value[..dash], NumberStyles.None, CultureInfo.InvariantCulture, out start) || start >= length || start < 0) return false;
            if (dash < value.Length - 1)
            {
                if (!long.TryParse(value[(dash + 1)..], NumberStyles.None, CultureInfo.InvariantCulture, out end) || end < start) return false;
                end = Math.Min(end, length - 1);
            }
        }
        return true;
    }
}
