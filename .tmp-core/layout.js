"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLayout = buildLayout;
exports.measureWithCanvas = measureWithCanvas;
function buildLayout(words, style, viewportWidth, viewportHeight, measure) {
    const visible = words.filter(w => !w.hidden);
    const maxWidth = viewportWidth - 2 * style.paddingX;
    if (maxWidth <= 0)
        throw new Error('文字左右内边距超过阅读区域宽度');
    const lineHeight = style.fontSize * style.lineHeight;
    const rows = [];
    const wordRows = [];
    let top = style.paddingY, start = 0, currentWidth = 0;
    const push = (end) => {
        if (end < start)
            return;
        const rowWords = visible.slice(start, end + 1);
        rows.push({ index: rows.length, startWord: start, endWord: end, top, bottom: top + lineHeight, firstStart: rowWords[0].start, lastEnd: rowWords[rowWords.length - 1].end });
        for (let k = start; k <= end; k++)
            wordRows[k] = rows.length - 1;
        top += lineHeight;
        start = end + 1;
        currentWidth = 0;
    };
    visible.forEach((w, i) => {
        const hasSpace = currentWidth > 0;
        const width = measure(w.display) + (hasSpace ? measure(' ') : 0);
        if (hasSpace && currentWidth + width > maxWidth) {
            push(i - 1);
        }
        currentWidth += measure(w.display) + (currentWidth > 0 ? measure(' ') : 0);
        if (w.paragraphAfter) {
            push(i);
            top += style.paragraphGap;
        }
    });
    if (start < visible.length)
        push(visible.length - 1);
    return { rows, wordRows, totalHeight: rows.length ? rows[rows.length - 1].bottom : 0, viewportHeight, viewportWidth };
}
function measureWithCanvas(fontFamily, fontSize, fontWeight = 400) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('Canvas 2D 不可用');
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    return (s) => ctx.measureText(s).width;
}
