"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginate = paginate;
exports.pageAtTime = pageAtTime;
exports.isPagePlan = isPagePlan;
const EPS = 1e-6;
const isSentenceEnd = (s) => /[.!?][)'"”’]*$/u.test(s.trim());
// Semantic boundaries matter, but an almost-empty page must not be preferred
// to a safe line-level split. These are SOFT penalties rather than constraints.
function breakPenalty(row) { return row.paragraphEnd ? 0 : row.endsSentence ? 1.5 : 4; }
function orphanPenalty(rows, first, last) {
    const end = rows[last];
    if (end.paragraphEnd || end.endsSentence)
        return 0;
    // Avoid leaving a single line of a continuing paragraph on either side
    // when alternatives fit. The safety/space constraint remains primary.
    let trailing = 1;
    for (let k = last - 1; k >= first && !rows[k].paragraphEnd; k--)
        trailing++;
    let leading = 0;
    for (let k = last + 1; k < rows.length && !rows[k].paragraphEnd; k++) {
        leading++;
        if (leading >= 2)
            break;
    }
    if (last + 1 < rows.length)
        leading = Math.max(leading, 1);
    return (trailing === 1 ? 5 : 0) + (leading === 1 ? 5 : 0);
}
function paginate(words, style, viewportWidth, viewportHeight, measure) {
    const numeric = [style.fontSize, style.lineHeight, style.paragraphGap, style.paddingX, style.paddingY, style.firstLineIndentCh, viewportWidth, viewportHeight];
    if (numeric.some(x => !Number.isFinite(x)))
        throw new Error('排版参数必须为有限数值');
    if (style.fontSize <= 0 || style.lineHeight <= 0 || style.paddingX < 0 || style.paddingY < 0 || style.paragraphGap < 0 || style.firstLineIndentCh < 0)
        throw new Error('无效的排版参数');
    const availableWidth = viewportWidth - 2 * style.paddingX, availableHeight = viewportHeight - 2 * style.paddingY;
    const height = style.fontSize * style.lineHeight;
    if (availableWidth <= 0 || availableHeight + EPS < height)
        throw new Error('阅读区域不足以容纳一行文字');
    const visible = words.filter(w => !w.hidden), warnings = [];
    if (!visible.length)
        return { pages: [], switches: [], warnings, availableHeight, availableWidth, viewportHeight, viewportWidth };
    for (let i = 0; i < visible.length; i++) {
        const w = visible[i];
        if (!Number.isFinite(w.start) || !Number.isFinite(w.end) || w.end <= w.start)
            throw new Error(`无效时间戳：${w.id}`);
        if (i > 0 && w.start < visible[i - 1].start)
            warnings.push(`单词时间倒序：${w.id}`);
    }
    const indent = style.firstLineIndentCh * measure('0'), spaceWidth = measure(' ');
    const raw = [];
    let start = 0, width = 0, atParagraphStart = true, positions = [];
    function flush(end, para) {
        if (end < start)
            return;
        // Word-like justification: expand INTER-WORD spaces, never the glyphs.
        // The final line of a true paragraph stays left aligned; a page break
        // does not change a line's paragraphEnd flag.
        if ((style.textAlign ?? 'justify') === 'justify' && !para && positions.length > 1) {
            const lineLeft = atParagraphStart ? indent : 0;
            const contentWidth = availableWidth - lineLeft;
            const glyphWidth = positions.reduce((sum, item) => sum + item.width, 0);
            const justifiedSpace = (contentWidth - glyphWidth) / (positions.length - 1);
            // A line can contain an overwide unbreakable word. Never create
            // negative spacing in that case; overflow is separately warned.
            if (justifiedSpace >= spaceWidth - EPS) {
                let x = lineLeft;
                positions = positions.map(item => { const result = { ...item, x }; x += item.width + justifiedSpace; return result; });
            }
        }
        raw.push({ startWord: start, endWord: end, height, paragraphStart: atParagraphStart, paragraphEnd: para, endsSentence: isSentenceEnd(visible[end].display), words: positions });
        start = end + 1;
        width = 0;
        positions = [];
        atParagraphStart = para;
    }
    visible.forEach((w, i) => {
        let lead = i === start ? (atParagraphStart ? indent : 0) : spaceWidth;
        const measured = measure(w.display);
        if (i > start && width + lead + measured > availableWidth + EPS) {
            flush(i - 1, false);
            lead = 0;
        }
        positions.push({ index: i, id: w.id, x: width + lead, width: measured });
        width += lead + measured;
        if (width > availableWidth + EPS)
            warnings.push(`单词或首行缩进超过行宽：${w.id}`);
        if (w.paragraphAfter)
            flush(i, true);
    });
    if (start < visible.length)
        flush(visible.length - 1, true);
    if (raw.length)
        raw[raw.length - 1].paragraphEnd = true;
    const n = raw.length, best = Array(n + 1).fill(Infinity), next = Array(n).fill(-1);
    best[n] = 0;
    for (let i = n - 1; i >= 0; i--) {
        let used = 0;
        for (let j = i; j < n; j++) {
            if (j > i && raw[j].paragraphStart)
                used += style.paragraphGap;
            used += height;
            if (used > availableHeight + EPS)
                break;
            const remaining = (availableHeight - used) / availableHeight, last = j === n - 1;
            // Favor fuller pages without requiring complete paragraphs. A fixed
            // per-page cost avoids producing extra pages just for nicer boundaries.
            const score = 15 + (last ? 0 : 120 * remaining * remaining + breakPenalty(raw[j]) + orphanPenalty(raw, i, j)) + best[j + 1];
            if (score < best[i]) {
                best[i] = score;
                next[i] = j + 1;
            }
        }
        if (next[i] < 0)
            throw new Error('自动分页失败：一行文字无法容纳');
    }
    const pages = [];
    for (let i = 0; i < n;) {
        const stop = next[i], rows = [];
        let y = style.paddingY;
        for (let j = i; j < stop; j++) {
            if (j > i && raw[j].paragraphStart)
                y += style.paragraphGap;
            rows.push({ ...raw[j], top: y });
            y += height;
        }
        const a = visible[rows[0].startWord], b = visible[rows[rows.length - 1].endWord];
        pages.push({ index: pages.length, rows, firstWordId: a.id, lastWordId: b.id, firstStart: a.start, lastEnd: b.end, usedHeight: y - style.paddingY });
        i = stop;
    }
    const switches = [0];
    for (let i = 1; i < pages.length; i++) {
        const prev = pages[i - 1], cur = pages[i], t = cur.firstStart > prev.lastEnd ? (cur.firstStart + prev.lastEnd) / 2 : cur.firstStart;
        if (cur.firstStart < prev.lastEnd)
            warnings.push(`跨页单词时间重叠：${i - 1} → ${i}`);
        if (t < switches[i - 1])
            warnings.push(`翻页时间倒序：第 ${i + 1} 页，已钳位`);
        switches.push(Math.max(t, switches[i - 1]));
    }
    return { pages, switches, warnings, availableHeight, availableWidth, viewportHeight, viewportWidth };
}
function pageAtTime(plan, time) {
    if (!plan.pages.length)
        return -1;
    if (!Number.isFinite(time))
        return 0;
    let lo = 0, hi = plan.switches.length;
    while (lo < hi) {
        const m = (lo + hi) >>> 1;
        if (plan.switches[m] <= time)
            lo = m + 1;
        else
            hi = m;
    }
    return Math.max(0, lo - 1);
}
/** Basic snapshot validation; protects WPF/Remotion from old scrolling layouts. */
function isPagePlan(v) {
    if (!v || typeof v !== 'object')
        return false;
    const p = v;
    return Array.isArray(p.pages) && Array.isArray(p.switches) && p.pages.length === p.switches.length &&
        p.pages.every((page, i) => page.index === i && Array.isArray(page.rows) && page.rows.every(row => Array.isArray(row.words) && Number.isFinite(row.top) && Number.isFinite(row.height)));
}
