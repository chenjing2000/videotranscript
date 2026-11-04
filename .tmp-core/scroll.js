"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.smooth = void 0;
exports.buildScrollPlan = buildScrollPlan;
exports.scrollOffset = scrollOffset;
const highlight_1 = require("./highlight");
const smooth = (u) => (1 - Math.cos(Math.PI * (0, highlight_1.clamp)(u))) / 2;
exports.smooth = smooth;
// Anchor: once the spoken row would fall below center, schedule advances after prior row finishes.
// End requirement: the final visible row reaches bottom alignment (when totalHeight > viewport).
function buildScrollPlan(layout, minDuration = .15) {
    const { rows, totalHeight, viewportHeight } = layout;
    const maxOffset = Math.max(0, totalHeight - viewportHeight);
    if (!rows.length || maxOffset <= 0)
        return { events: [], maxOffset };
    const events = [];
    let offset = 0;
    let previousEnd = -Infinity;
    for (let next = 1; next < rows.length; next++) {
        const nextRow = rows[next];
        const prior = rows[next - 1];
        const goal = (0, highlight_1.clamp)(nextRow.bottom - viewportHeight / 2, 0, maxOffset);
        // Target bottom alignment at the final row, subject to the minimum duration.
        const desired = next === rows.length - 1 ? maxOffset : goal;
        if (desired <= offset + 1e-7)
            continue;
        const nominalStart = prior.lastEnd;
        const nominalEnd = nextRow.firstStart;
        // No teleports: if a previous animation overlaps, start the next at previous end.
        const start = Math.max(nominalStart, previousEnd);
        // A queued transition uses the remaining silence instead of replaying elapsed time.
        const end = Math.max(start + minDuration, nominalEnd);
        events.push({ start, end, from: offset, to: desired, rowIndex: next });
        offset = desired;
        previousEnd = end;
        if (offset >= maxOffset - 1e-7)
            break;
    }
    // If a one-line document extends beyond viewport: pathological styling. No event possible.
    return { events, maxOffset };
}
function scrollOffset(plan, time) {
    if (plan.maxOffset <= 0 || !Number.isFinite(time))
        return 0;
    let y = 0;
    for (const e of plan.events) {
        if (time < e.start)
            break;
        if (time >= e.end) {
            y = e.to;
            continue;
        }
        return (0, highlight_1.clamp)(e.from + (e.to - e.from) * (0, exports.smooth)((time - e.start) / (e.end - e.start)), 0, plan.maxOffset);
    }
    return (0, highlight_1.clamp)(y, 0, plan.maxOffset);
}
