"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clamp = clamp;
exports.wordProgress = wordProgress;
exports.wordGradient = wordGradient;
function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }
function wordProgress(time, start, end) {
    if (!Number.isFinite(time) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        return 0;
    return clamp((time - start) / (end - start));
}
function wordGradient(progress, textColor, highlightColor) {
    const p = clamp(progress) * 100;
    return `linear-gradient(90deg, ${highlightColor} 0%, ${highlightColor} ${p}%, ${textColor} ${p}%, ${textColor} 100%)`;
}
