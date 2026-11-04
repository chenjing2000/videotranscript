import {DEFAULT_STYLE, WIDTH, HEIGHT} from './types';
import type {ReadingStyle} from './types';
export const SETTINGS_FILENAME = 'voicetranscript.settings.json';
export type RightFont = {family:string;size:number;color:string;backgroundColor:string};
export type AppSettings = {format:'voicetranscript-settings';schemaVersion:1;leftFont:{family:string;size:number;color:string;highlightColor:string};rightFont:RightFont;paragraph:{firstLineIndentEm:number;lineHeight:1.2|1.3|1.4|1.5;gap:number;alignment:'justify'|'left'};page:{paddingY:number;paddingX:number;backgroundColor:string};output:{width:number;height:number}};
export const DEFAULT_SETTINGS:AppSettings={format:'voicetranscript-settings',schemaVersion:1,leftFont:{family:'Arial',size:40,color:'#293847',highlightColor:'#B81A35'},rightFont:{family:'Arial',size:16,color:'#293847',backgroundColor:'#F7F4EC'},paragraph:{firstLineIndentEm:2,lineHeight:1.4,gap:20,alignment:'justify'},page:{paddingY:30,paddingX:36,backgroundColor:'#F7F4EC'},output:{width:WIDTH,height:HEIGHT}};
export const FONT_OPTIONS=['Arial','Nunito Sans','Segoe UI'] as const;
const color=(v:unknown):v is string=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
const integer=(v:unknown,min:number,max:number):v is number=>Number.isInteger(v)&&Number(v)>=min&&Number(v)<=max;
export function validateSettings(v:unknown):v is AppSettings {
 if(!v||typeof v!=='object')return false;const s=v as AppSettings;
 return s.format==='voicetranscript-settings'&&s.schemaVersion===1&&!!s.leftFont&&!!s.rightFont&&!!s.paragraph&&!!s.page&&!!s.output&&
  FONT_OPTIONS.some(x=>x===s.leftFont.family)&&integer(s.leftFont.size,1,99)&&color(s.leftFont.color)&&color(s.leftFont.highlightColor)&&
  FONT_OPTIONS.some(x=>x===s.rightFont.family)&&integer(s.rightFont.size,1,99)&&color(s.rightFont.color)&&color(s.rightFont.backgroundColor)&&
  integer(s.paragraph.firstLineIndentEm,0,9)&&[1.2,1.3,1.4,1.5].includes(s.paragraph.lineHeight)&&integer(s.paragraph.gap,0,99)&&['justify','left'].includes(s.paragraph.alignment)&&
  integer(s.page.paddingY,0,99)&&integer(s.page.paddingX,0,99)&&color(s.page.backgroundColor)&&
  integer(s.output.width,320,3840)&&integer(s.output.height,320,3840)&&s.output.width%2===0&&s.output.height%2===0;
}
export function settingsToStyle(s:AppSettings):ReadingStyle{return {...DEFAULT_STYLE,fontFamily:s.leftFont.family,fontSize:s.leftFont.size,fontWeight:400,textColor:s.leftFont.color,highlightColor:s.leftFont.highlightColor,firstLineIndentEm:s.paragraph.firstLineIndentEm,firstLineIndentCh:undefined,lineHeight:s.paragraph.lineHeight,paragraphGap:s.paragraph.gap,textAlign:s.paragraph.alignment,paddingX:s.page.paddingX,paddingY:s.page.paddingY,backgroundColor:s.page.backgroundColor};}
export function projectStyleToSettings(style:ReadingStyle,canvas:{width:number;height:number},old:AppSettings):AppSettings{return {...old,leftFont:{family:style.fontFamily,size:style.fontSize,color:style.textColor,highlightColor:style.highlightColor},paragraph:{firstLineIndentEm:style.firstLineIndentEm??2,lineHeight:style.lineHeight as AppSettings['paragraph']['lineHeight'],gap:style.paragraphGap,alignment:style.textAlign},page:{paddingY:style.paddingY,paddingX:style.paddingX,backgroundColor:style.backgroundColor},output:canvas};}
