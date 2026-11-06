import {DEFAULT_STYLE} from './types';import type {Project,Word} from './types';import {buildOverrides} from './transcript';
import {WIDTH,HEIGHT} from './types';
export function createProject(videoName:string,subtitleName:string,words:Word[]):Project{return {format:'transcript-studio-project',schemaVersion:2,source:{videoName,subtitleName},overrides:buildOverrides(words),canvas:{width:WIDTH,height:HEIGHT},style:{...DEFAULT_STYLE},export:{fps:30,quality:'standard'}}}
export function saveProjectView(project:Project,words:Word[]):Project{return {...project,overrides:buildOverrides(words),savedAt:new Date().toISOString()}}
export function normalizeProjectStyle(project:Project):Project {return {...project,canvas:project.canvas??{width:WIDTH,height:HEIGHT},style:{...DEFAULT_STYLE,...project.style,...(project.style.firstLineIndentCh===undefined&&project.style.firstLineIndentEm===undefined?{firstLineIndentEm:2}:{})}};}
/** Reject malformed saved projects before they reach layout, editing or export. */
export function validateProject(value:unknown,words?:readonly Word[]):value is Project{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const p=value as Partial<Project>;
 if(p.format!=='transcript-studio-project'||p.schemaVersion!==2)return false;
 if(!p.source||typeof p.source.videoName!=='string'||!p.source.videoName.trim()||
    typeof p.source.subtitleName!=='string'||!p.source.subtitleName.toLowerCase().endsWith('.transcript-studio.json')||
    (p.source.subtitleSha256!==undefined&&
     (typeof p.source.subtitleSha256!=='string'||!/^[a-f0-9]{64}$/i.test(p.source.subtitleSha256))))return false;
 if(p.mediaKind!==undefined&&p.mediaKind!=='video'&&p.mediaKind!=='audio')return false;
 if(!p.canvas||!Number.isInteger(p.canvas.width)||!Number.isInteger(p.canvas.height)||
    p.canvas.width%2!==0||p.canvas.height%2!==0||
    p.canvas.width<320||p.canvas.height<320||p.canvas.width>3840||p.canvas.height>3840)return false;
 if(!p.export||(p.export.fps!==30&&p.export.fps!==60)||
    (p.export.quality!=='standard'&&p.export.quality!=='high'))return false;
 if(!p.style||typeof p.style!=='object')return false;
 const s=p.style;
 if(s.textAlign!=='left'&&s.textAlign!=='justify')return false;
 if(typeof s.fontFamily!=='string'||!s.fontFamily.trim())return false;
 for(const key of ['fontSize','fontWeight','lineHeight','paragraphGap','paddingX','paddingY'] as const){
  if(typeof s[key]!=='number'||!Number.isFinite(s[key]))return false;
 }
 if(s.fontSize<=0||s.fontWeight<=0||s.lineHeight<=0||s.paragraphGap<0||
    (s.firstLineIndentEm??s.firstLineIndentCh??0)<0||s.paddingX<0||s.paddingY<0)return false;
 for(const key of ['textColor','highlightColor','backgroundColor'] as const){
  if(typeof s[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(s[key]))return false;
 }
 if(s.firstLineIndentEm!==undefined&&(!Number.isInteger(s.firstLineIndentEm)||s.firstLineIndentEm<0||s.firstLineIndentEm>9))return false;
 if(s.firstLineIndentCh!==undefined&&(!Number.isFinite(s.firstLineIndentCh)||s.firstLineIndentCh<0))return false;
 if(s.minScrollDuration!==undefined&&(!Number.isFinite(s.minScrollDuration)||s.minScrollDuration<0))return false;
 if(!p.overrides||typeof p.overrides!=='object'||Array.isArray(p.overrides))return false;
 const validWordIds=words?new Set(words.map(word=>word.id)):null;
 for(const [id,override] of Object.entries(p.overrides)){
  if(validWordIds&&!validWordIds.has(id))return false;
  if(!/^s\d+w\d+$/.test(id)||!override||typeof override!=='object'||Array.isArray(override))return false;
  if(override.display!==undefined&&(typeof override.display!=='string'||!override.display.trim()||/\s/u.test(override.display.trim())))return false;
  if(override.hidden!==undefined&&typeof override.hidden!=='boolean')return false;
  if(override.breakParagraph!==undefined&&typeof override.breakParagraph!=='boolean')return false;
 }
 return true;
}
