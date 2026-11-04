/** Geometry of the draggable settings panel in CSS pixels (DIP at WebView scale 100%). */
export const SETTINGS_WIDTH = 384; // initial fallback before the content is measured
/** Strict next multiple of ten: a width of 400 DIP becomes 410 DIP. */
export function nextSettingsWidth(requiredWidth:number):number {
 if(!Number.isFinite(requiredWidth)||requiredWidth<0)throw new RangeError('Invalid settings content width');
 return (Math.floor(requiredWidth/10)+1)*10;
}
/** Measure the full outer panel: widest content + body padding + vertical scrollbar.
 * The scrollbar must be included or the last column can trigger horizontal scrolling.
 */
export function requiredSettingsOuterWidth(contentWidth:number,paddingLeft:number,paddingRight:number,verticalScrollbarWidth:number):number {
 return Math.max(0,contentWidth)+Math.max(0,paddingLeft)+Math.max(0,paddingRight)+Math.max(0,verticalScrollbarWidth);
}
export const SETTINGS_HEIGHT = 500;
export const SETTINGS_INSET = 16;
export type SettingsRect = {x:number;y:number;width:number;height:number};
export type SettingsPoint = {x:number;y:number};

export function settingsDialogRect(viewportWidth:number,viewportHeight:number,position:SettingsPoint|null=null,preferredWidth:number=SETTINGS_WIDTH):SettingsRect {
 const viewWidth=Math.max(0,viewportWidth),viewHeight=Math.max(0,viewportHeight);
 const width=Math.max(0,Math.min(preferredWidth,viewWidth-2*SETTINGS_INSET));
 const height=Math.max(0,Math.min(SETTINGS_HEIGHT,viewHeight-2*SETTINGS_INSET));
 const minX=Math.min(SETTINGS_INSET,(viewWidth-width)/2);
 const minY=Math.min(SETTINGS_INSET,(viewHeight-height)/2);
 const maxX=Math.max(minX,viewWidth-width-SETTINGS_INSET);
 const maxY=Math.max(minY,viewHeight-height-SETTINGS_INSET);
 const x=position===null?(viewWidth-width)/2:Math.max(minX,Math.min(maxX,position.x));
 const y=position===null?(viewHeight-height)/2:Math.max(minY,Math.min(maxY,position.y));
 return {x,y,width,height};
}
