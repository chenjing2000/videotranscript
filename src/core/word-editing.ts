/** Width including both 3-DIP side paddings, fixed 1-DIP border and 4-DIP glyph safety. */
export function calculateWordEditorWidth(textWidth:number,availableWidth:number):number{
 const raw=Math.ceil(Math.max(0,Number.isFinite(textWidth)?textWidth:0)+2*3+2*1+4);
 return Math.min(Math.max(24,Math.floor(availableWidth)),Math.max(24,raw));
}
/** Reflect the effective project word state (including explicit false overrides). */
export function paragraphActionLabel(hasBreak:boolean):'插入分段'|'取消分段'{
 return hasBreak?'取消分段':'插入分段';
}
