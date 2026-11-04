using TranscriptStudio;

static void Check(string? header, long length, bool expectedOk, long expectedStart = 0, long expectedEnd = 0)
{
    var ok = MediaByteRanges.TryResolve(header, length, out var start, out var end);
    if (ok != expectedOk || (ok && (start != expectedStart || end != expectedEnd)))
        throw new Exception($"Range {header ?? "<none>"} length={length}: got ({ok}, {start}, {end})");
}

Check(null, 100, true, 0, 99);
Check("bytes=0-", 100, true, 0, 99);
Check("bytes=5-", 100, true, 5, 99);
Check("bytes=10-19", 100, true, 10, 19);
Check("bytes=10-999", 100, true, 10, 99);
Check("bytes=-10", 100, true, 90, 99);
Check("bytes=-999", 100, true, 0, 99);
Check("bytes=99-", 100, true, 99, 99);
Check("bytes=100-", 100, false);
Check("bytes=10-9", 100, false);
Check("bytes=0-1,4-5", 100, false);
Check("bytes=-0", 100, false);
Check("bytes=abc-def", 100, false);
Check("bytes=0-", 0, false);
Check(null, 0, true, 0, -1);
Console.WriteLine("15 media byte-range tests passed.");
