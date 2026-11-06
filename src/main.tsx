import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ReaderCanvas} from './ui/ReaderCanvas';
import {StyleSettings} from './ui/StyleSettings';
import {Dialog} from './ui/Dialog';
import type {DialogAction} from './ui/Dialog';
import {parseTranscriptStudio,applyOverrides,createProject,updateWord,exportPlainText,saveProjectView,validateProject,paginate,measureWithCanvas,DEFAULT_STYLE,normalizeProjectStyle,WIDTH,HEIGHT,validCanvas,transcriptStem,selectCompanion,provisionalVideoHeight,describeMediaError,missingCompanionMessage} from './core';
import type {Word,Project} from './core';
import {resolvePlayerShortcut} from './core/player-shortcuts';
import './style.css';
import {getWorkspaceLayout} from './core/workspace-layout';
import {DEFAULT_SETTINGS,settingsToStyle,projectStyleToSettings,validateSettings} from './core/app-settings';
import {calculateWordEditorWidth,paragraphActionLabel,hasUnsavedWordDraft} from './core/word-editing';
import {createProjectEditState,markProjectEdited,setProjectDraftChanged,acknowledgeProjectSave,resetProjectEditState,hasUnsavedProjectChanges} from './core/project-edit-state';
import {settingsDialogRect,nextSettingsWidth,requiredSettingsOuterWidth} from './core/settings-dialog-geometry';
import type {AppSettings} from './core/app-settings';
type DesktopMessage =
 | {kind:'pair';mediaName:string;mediaKind:'video'|'audio';subtitleName:string;transcript:string;fingerprint:string;project:string|null;mediaUrl:string}
 | {kind:'settings';settings:unknown}
 | {kind:'saved';message:string;revision:number}
 | {kind:'text-exported';message:string}
 | {kind:'text-export-error';message:string}
 | {kind:'status';message:string;busy:boolean;error?:boolean;canCancel?:boolean}
 | {kind:'dependency-confirm';id:number;title:string;heading:string;details:string;action:string}
 | {kind:'dependency-progress';title:string;message:string}
 | {kind:'dependency-failed';message:string}
 | {kind:'dependency-end'}
 | {kind:'dependency-cancelling'}
  | {kind:'export-cancelling'};
const desktop=(window as Window & {chrome?:{webview?:{postMessage(m:unknown):void;postMessageWithAdditionalObjects(m:unknown,files:File[]):void;addEventListener(t:'message',l:(e:MessageEvent<DesktopMessage>)=>void):void;removeEventListener(t:'message',l:(e:MessageEvent<DesktopMessage>)=>void):void}}}).chrome?.webview;
type Notice={id:number;text:string;error:boolean;task?:boolean;cancelable?:boolean};
type DependencyDialog=
 | {mode:'confirm';id:number;title:string;heading:string;details:string;action:string}
 | {mode:'progress';title:string;message:string}
 | {mode:'cancelling';title:string;message:string}
 | {mode:'error';message:string};
function Icon({name}:{name:'settings'|'text-export'|'save'|'import'|'export'|'play'|'pause'|'stop'|'close'}){
 const paths:Record<typeof name,React.ReactNode>={
 settings:<><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="#fff"/><circle cx="16" cy="12" r="2" fill="#fff"/><circle cx="10" cy="18" r="2" fill="#fff"/></>,
 'text-export':<><path d="M5 3h9l5 5v13H5z"/><path d="M14 3v5h5M8 12h8M8 16h8"/></>,
 save:<><path d="M4 3h13l3 3v15H4z"/><path d="M7 3v7h10V3M7 21v-8h10v8"/></>,
 import:<><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/></>,
 export:<><path d="M12 21V9m-4 4 4-4 4 4M4 7V3h16v4"/></>,
 play:<path d="M7 4 20 12 7 20z"/>, pause:<><path d="M7 4v16M17 4v16"/></>,
 stop:<rect x="5" y="5" width="14" height="14" rx="1"/>,
 close:<path d="M5 5 19 19M19 5 5 19"/>};
 return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
type EditorProps={text:string;fontFamily:string;fontSize:number;color:string;availableWidth:number;onText:(text:string)=>void;onCommit:()=>void;onCancel:()=>void};
/** Measure the actual glyphs rather than relying on HTML input's default `size` property. */
function InlineWordEditor({text,fontFamily,fontSize,color,availableWidth,onText,onCommit,onCancel}:EditorProps){
 const input=useRef<HTMLInputElement>(null);
 const width=useMemo(()=>{
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  if(!ctx)return 24;
  ctx.font=`400 ${fontSize}px "${fontFamily.replaceAll('"','')}"`;
  return calculateWordEditorWidth(ctx.measureText(text||' ').width,availableWidth);
 },[text,fontFamily,fontSize,availableWidth]);
 useLayoutEffect(()=>{input.current?.focus();input.current?.select()},[]);
 return <input ref={input} className="word-edit" aria-label="编辑单词" value={text} spellCheck={false}
  style={{width,fontFamily,fontSize,color,fontWeight:400}}
  onChange={e=>onText(e.currentTarget.value)} onKeyDown={e=>{
   if(e.key==='Enter'){e.preventDefault();onCommit()}
   else if(e.key==='Escape'){e.preventDefault();onCancel()}
  }} onContextMenu={e=>e.preventDefault()} onDoubleClick={e=>e.stopPropagation()}/>;
}
type WordToolSnapshot={id:string;text:string;start:number;end:number;breakParagraph:boolean};
function App(){
 const [mediaUrl,setMediaUrl]=useState('');const [mediaName,setMediaName]=useState('');const [kind,setKind]=useState<'video'|'audio'>('video');
 const [videoRatio,setVideoRatio]=useState<number|null>(null);const [mediaState,setMediaState]=useState<'idle'|'loading'|'ready'|'error'>('idle');const [words,setWords]=useState<Word[]>([]);const [project,setProject]=useState<Project|null>(null);
 const [time,setTime]=useState(0);const [duration,setDuration]=useState(0);
 const [edit,setEdit]=useState<{id:string;text:string}|null>(null);
 const editRef=useRef<{id:string;text:string}|null>(null);
 const [wordTool,setWordTool]=useState<WordToolSnapshot|null>(null);
 const [toolLeaving,setToolLeaving]=useState(false);
 const transcriptRef=useRef<HTMLDivElement|null>(null);
 const [editorAvailableWidth,setEditorAvailableWidth]=useState(240);
 const [projectLoadBlocked,setProjectLoadBlocked]=useState(false);
 const [projectEditState,setProjectEditState]=useState(createProjectEditState());
 const projectEditStateRef=useRef(projectEditState);
 const wordsRef=useRef<Word[]>([]);wordsRef.current=words;
 const [playing,setPlaying]=useState(false);const [exporting,setExporting]=useState(false);
 const [appSettings,setAppSettings]=useState<AppSettings>(DEFAULT_SETTINGS);const appSettingsRef=useRef<AppSettings>(DEFAULT_SETTINGS);const loadedSettingsRef=useRef(false);
 const [dependencyDialog,setDependencyDialog]=useState<DependencyDialog|null>(null);
 const [pendingImportFile,setPendingImportFile]=useState<File|null>(null);
 const dependencyDialogRef=useRef<DependencyDialog|null>(null);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [settingsPosition,setSettingsPosition]=useState<{x:number;y:number}|null>(null);
 const [settingsPreferredWidth,setSettingsPreferredWidth]=useState<number|null>(null);
 const settingsBodyRef=useRef<HTMLDivElement|null>(null);
 const settingsDrag=useRef<{pointerId:number;startX:number;startY:number;originX:number;originY:number}|null>(null);
 const [viewport,setViewport]=useState({width:window.innerWidth,height:window.innerHeight});const [notices,setNotices]=useState<Notice[]>([]);
 const shortcutRef=useRef<(e:KeyboardEvent)=>void>(()=>{});
 const mediaRef=useRef<HTMLMediaElement|null>(null);const inputRef=useRef<HTMLInputElement>(null);
 const nextNoticeId=useRef(1);const exportNoticeId=useRef<number|null>(null);
 const canvasWidth=project?.canvas.width??appSettings.output.width,canvasHeight=project?.canvas.height??appSettings.output.height;
 useEffect(()=>{const update=()=>setViewport({width:window.innerWidth,height:window.innerHeight});window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update)},[]);
 const settingsRect=settingsDialogRect(viewport.width,viewport.height,settingsPosition,settingsPreferredWidth??undefined);
 const hasUnsavedChanges=()=>hasUnsavedProjectChanges(projectEditStateRef.current);
 const updateProjectEditState=(next:ReturnType<typeof createProjectEditState>)=>{
  projectEditStateRef.current=next;setProjectEditState(next);
  desktop?.postMessage({kind:'dirty-state',dirty:hasUnsavedProjectChanges(next)});
 };
 const markDirty=()=>updateProjectEditState(markProjectEdited(projectEditStateRef.current));
 const resetProjectDirtyState=()=>updateProjectEditState(resetProjectEditState(projectEditStateRef.current));
 const closeSettings=()=>{settingsDrag.current=null;setSettingsPosition(null);setSettingsOpen(false)};
 const openSettings=()=>{settingsDrag.current=null;setSettingsPosition(null);setSettingsPreferredWidth(null);setSettingsOpen(true)};
 // Measure after mounting, before first paint; do not resize during ordinary editing.
 // The inner settings grid has a fixed intrinsic width, which must not be compressed.
 useLayoutEffect(()=>{
  if(!settingsOpen||settingsPreferredWidth!==null)return;
  const body=settingsBodyRef.current;
  const content=body?.querySelector<HTMLElement>('.m65-settings');
  if(!body||!content)return;
  const style=window.getComputedStyle(body);
  const intrinsicWidth=Math.max(content.scrollWidth,content.getBoundingClientRect().width);
  const scrollbarWidth=Math.max(0,body.offsetWidth-body.clientWidth);
  const required=requiredSettingsOuterWidth(intrinsicWidth,
   parseFloat(style.paddingLeft)||0,parseFloat(style.paddingRight)||0,scrollbarWidth);
  setSettingsPreferredWidth(nextSettingsWidth(required));
 },[settingsOpen,settingsPreferredWidth]);
 const onSettingsPointerDown=(event:React.PointerEvent<HTMLDivElement>)=>{
  if(event.button!==0 || (event.target as HTMLElement).closest('button'))return;
  settingsDrag.current={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,originX:settingsRect.x,originY:settingsRect.y};
  event.currentTarget.setPointerCapture(event.pointerId);
  event.preventDefault();
 };
 const onSettingsPointerMove=(event:React.PointerEvent<HTMLDivElement>)=>{
  const drag=settingsDrag.current;if(!drag||event.pointerId!==drag.pointerId)return;
  const next=settingsDialogRect(viewport.width,viewport.height,{x:drag.originX+event.clientX-drag.startX,y:drag.originY+event.clientY-drag.startY},settingsPreferredWidth??undefined);
  setSettingsPosition({x:next.x,y:next.y});
 };
 const onSettingsPointerEnd=(event:React.PointerEvent<HTMLDivElement>)=>{
  if(settingsDrag.current?.pointerId!==event.pointerId)return;
  settingsDrag.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 };
 useEffect(()=>{if(!settingsOpen)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!dependencyDialogRef.current){e.preventDefault();closeSettings()}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[settingsOpen]);
 const geometry=getWorkspaceLayout(viewport.width,viewport.height,canvasWidth,canvasHeight);
 const scale=geometry.previewWidth/canvasWidth;
 useEffect(()=>{desktop?.postMessage({kind:'layout',minimumClientWidth:geometry.minimumClientWidth,minimumClientHeight:Math.ceil(geometry.minimumClientHeight),outputWidth:canvasWidth,outputHeight:canvasHeight})},[canvasWidth,canvasHeight,geometry.minimumClientWidth,geometry.minimumClientHeight]);
 const mediaHeight=kind==='video'&&mediaUrl?provisionalVideoHeight(canvasWidth,canvasHeight,videoRatio):0;
 useLayoutEffect(()=>{
  const el=transcriptRef.current;if(!el)return;
  const update=()=>setEditorAvailableWidth(Math.max(24,el.clientWidth-16));
  update();const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect();
 },[]);
 const editorFontSize=appSettings.rightFont.size;
 const style=project?.style??settingsToStyle(appSettings);
 const displayedSettings=useMemo(()=>project?projectStyleToSettings(style,project.canvas,appSettings):appSettings,[project,style,appSettings]);
 const setDependency=(value:DependencyDialog|null)=>{dependencyDialogRef.current=value;setDependencyDialog(value)};
 const cancelDependencyInstall=()=>{const d=dependencyDialogRef.current;if(d?.mode!=='progress')return;setDependency({mode:'cancelling',title:d.title,message:'正在停止安装任务并清理临时文件……'});desktop?.postMessage({kind:'dependency-cancel'})};
 const replyDependency=(accepted:boolean)=>{const d=dependencyDialogRef.current;if(d?.mode!=='confirm')return;desktop?.postMessage({kind:'dependency-decision',id:d.id,accepted});setDependency(accepted?{mode:'progress',title:d.title,message:'正在启动依赖准备操作……'}:null)};
 const notify=(text:string,error=false)=>{
  const id=nextNoticeId.current++;setNotices(prev=>[...prev,{id,text,error}]);
  if(!error)setTimeout(()=>setNotices(prev=>prev.filter(x=>x.id!==id)),5000);
 };
 // A single persistent toast represents the active MP4 export task. Host status
 // updates replace its text instead of creating duplicate messages.
 const setExportTaskNotice=(text:string,cancelable=true)=>{
  let id=exportNoticeId.current;
  if(id===null){id=nextNoticeId.current++;exportNoticeId.current=id}
  setNotices(prev=>prev.some(n=>n.id===id)
   ?prev.map(n=>n.id===id?{...n,text,error:false,task:true,cancelable}:n)
   :[...prev,{id,text,error:false,task:true,cancelable}]);
 };
 const cancelExport=()=>{
  if(exportNoticeId.current===null)return;
  setExportTaskNotice('正在取消导出，等待渲染进程退出并清理缓存…',false);
  desktop?.postMessage({kind:'export-cancel'});
 };
  const clearExportTaskNotice=()=>{
  const id=exportNoticeId.current;
  if(id===null)return;
  exportNoticeId.current=null;
  setNotices(prev=>prev.filter(n=>n.id!==id));
 };
 useEffect(()=>{let frame=0;const tick=()=>{if(mediaRef.current)setTime(mediaRef.current.currentTime);frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[]);
 const plan=useMemo(()=>{if(!words.length||canvasHeight-mediaHeight<=0)return undefined;try{return paginate(words,style,canvasWidth,canvasHeight-mediaHeight,measureWithCanvas(style.fontFamily,style.fontSize,style.fontWeight))}catch{return undefined}},[words,style,canvasWidth,canvasHeight,mediaHeight]);
 const seek=(t:number)=>{const v=mediaRef.current;if(!v)return;v.currentTime=Math.max(0,Math.min(Number.isFinite(v.duration)?v.duration:t,t));setTime(v.currentTime)};
 const toggle=()=>{const v=mediaRef.current;if(v){if(v.paused)void v.play().catch(e=>notify(`播放失败：${String(e)}`,true));else v.pause()}};
 const stop=()=>{mediaRef.current?.pause();seek(0)};
 const openPicker=()=>{if(!exporting)inputRef.current?.click()};
 const doSave=()=>{if(exporting)return notify('视频导出期间暂不支持保存工程，请在导出完成后保存。',true);
  if(!project)return notify('尚未打开标准字幕',true);
  if(projectLoadBlocked)return notify('现有工程未能通过验证，已禁止覆盖。请检查工程文件并重新打开字幕。',true);
  let currentWords=words;const active=editRef.current;
  if(active){try{currentWords=updateWord(words,active.id,active.text)}catch(error){notify(`无法保存工程：请先修正正在编辑的单词。${String(error)}`,true);return}if(!commitEditing())return}
  const p=saveProjectView(project,currentWords),revision=projectEditStateRef.current.currentRevision;
  if(desktop){desktop.postMessage({kind:'save',project:p,revision});return}
  const blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=transcriptStem(project.source.subtitleName)+'.project.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
  updateProjectEditState(acknowledgeProjectSave(projectEditStateRef.current,revision));
  notify('工程 JSON 已保存')};
 const doExportText=()=>{
  if(!project||!words.length)return notify('尚未打开可导出的字幕',true);
  if(exporting||dependencyDialogRef.current)return;
  let currentWords=words;
  const active=editRef.current;
  if(active){
   try{currentWords=updateWord(words,active.id,active.text)}
   catch(error){notify(`无法导出正文：请先修正正在编辑的单词。${String(error)}`,true);return}
   // Commit the active edit before taking the export snapshot. Use currentWords
   // rather than React state, which does not update synchronously.
   if(!commitEditing())return;
  }
  const text=exportPlainText(currentWords);
  if(!text)return notify('右栏没有可导出的正文',true);
  if(desktop){desktop.postMessage({kind:'export-text',text});return}
  const name=transcriptStem(project.source.subtitleName)+'.article.txt';
  const blob=new Blob([text],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify(`已下载正文文本：${name}`);
 };
 const doExport=()=>{
  if(dependencyDialogRef.current)return;
  if(mediaState!=='ready'){notify(`媒体尚未就绪：${mediaName||'未选择媒体'}`,true);return}
  if(!desktop){notify('请使用 Windows 桌面版导出 MP4',true);return}
  if(projectLoadBlocked){notify('现有工程未能通过验证，已禁止导出。请检查工程文件并重新打开字幕。',true);return}
  if(!project||!mediaUrl||!duration||!plan){notify('尚未载入可导出的媒体和字幕，或画布无法排版',true);return}
  let exportWords=words;
  const active=editRef.current;
  if(active){
   try{exportWords=updateWord(words,active.id,active.text)}
   catch(error){notify(`无法导出视频：请先修正正在编辑的单词。${String(error)}`,true);return}
   if(!commitEditing())return;
  }
  let exportPlan;
  try{exportPlan=paginate(exportWords,style,canvasWidth,canvasHeight-mediaHeight,measureWithCanvas(style.fontFamily,style.fontSize,style.fontWeight))}
  catch(error){notify(`无法生成视频分页：${String(error)}`,true);return}
  if(!exportPlan.pages.length){notify('没有可导出的视频正文页面。',true);return}
  setExporting(true);setExportTaskNotice('正在准备导出…');
  desktop.postMessage({kind:'export',project:saveProjectView(project,exportWords),duration,videoHeight:mediaHeight,pagePlan:exportPlan});
 };
 const applyPair=(data:Extract<DesktopMessage,{kind:'pair'}>)=>{
  try{const input=JSON.parse(data.transcript),parsed=parseTranscriptStudio(input);
   const next=createProject(data.mediaName,data.subtitleName,parsed.words);next.style=settingsToStyle(appSettingsRef.current);next.canvas={...appSettingsRef.current.output};next.source.subtitleSha256=data.fingerprint;next.mediaKind=data.mediaKind;
   let current=next,currentWords=parsed.words,blocked=false;
   if(data.project!==null){try{
    const saved:unknown=JSON.parse(data.project);
    if(!validateProject(saved,parsed.words)||saved.source.subtitleSha256!==data.fingerprint||
      saved.source.videoName.toLowerCase()!==data.mediaName.toLowerCase()||
      saved.source.subtitleName.toLowerCase()!==data.subtitleName.toLowerCase()||
      (saved.mediaKind!==undefined&&saved.mediaKind!==data.mediaKind))
      throw Error('工程格式、来源或字幕指纹不匹配');
    current=normalizeProjectStyle(saved);currentWords=applyOverrides(parsed,current).words;
    desktop?.postMessage({kind:'project-validated',fingerprint:data.fingerprint,subtitleName:data.subtitleName});
   }catch(e){blocked=true;notify(`工程读取失败，已禁止覆盖原工程文件：${String(e)}`,true)}}
   setProjectLoadBlocked(blocked);
   setMediaUrl(data.mediaUrl);setMediaName(data.mediaName);setKind(data.mediaKind);setProject(current);setWords(currentWords);setEditing(null);setWordTool(null);setToolLeaving(false);resetProjectDirtyState();setDuration(0);setVideoRatio(null);setMediaState('loading');setTime(0);setPlaying(false);
   notify(`已找到媒体：${data.mediaName}（${data.mediaKind==='audio'?'音频':'视频'}模式），正在读取媒体信息；${parsed.words.length} 个单词`);
  }catch(e){
   // The host has already selected this pair's media URL. Never leave the previous
   // pair visible if the new transcript fails validation.
   setMediaUrl('');setMediaName('');setKind('video');setProject(null);setWords([]);
   setEditing(null);setWordTool(null);setToolLeaving(false);resetProjectDirtyState();setDuration(0);setVideoRatio(null);
   setMediaState('error');setTime(0);setPlaying(false);setProjectLoadBlocked(false);
   notify(`字幕读取失败：${String(e)}`,true);
  }
 };
 useEffect(()=>{const receive=({data}:MessageEvent<DesktopMessage>)=>{if(data.kind==='settings'){if(validateSettings(data.settings)){loadedSettingsRef.current=true;appSettingsRef.current=data.settings;setAppSettings(data.settings)}}else if(data.kind==='pair')applyPair(data);else if(data.kind==='saved'){
   const nextState=acknowledgeProjectSave(projectEditStateRef.current,data.revision);
   updateProjectEditState(nextState);
   notify(hasUnsavedProjectChanges(nextState)?`${data.message}；当前工程仍有未保存修改`:data.message);
  }else if(data.kind==='text-exported')notify(data.message);else if(data.kind==='text-export-error')notify(data.message,true);else if(data.kind==='dependency-confirm')setDependency({mode:'confirm',...data});else if(data.kind==='dependency-progress')setDependency({mode:'progress',title:data.title,message:data.message});else if(data.kind==='dependency-cancelling'){const d=dependencyDialogRef.current;if(d?.mode==='progress')setDependency({mode:'cancelling',title:d.title,message:'正在停止安装任务并清理临时文件……'})}else if(data.kind==='dependency-end')setDependency(null);else if(data.kind==='export-cancelling')setExportTaskNotice('正在取消导出，等待渲染进程退出并清理缓存…',false);else if(data.kind==='dependency-failed')setDependency({mode:'error',message:data.message});else if(data.kind==='status'){setExporting(data.busy);if(data.busy){if(data.error)notify(data.message,true);else setExportTaskNotice(data.message,data.canCancel!==false)}else{clearExportTaskNotice();if(!data.error&&dependencyDialogRef.current?.mode==='progress')setDependency(null);if(!dependencyDialogRef.current||dependencyDialogRef.current.mode!=='error')notify(data.message,!!data.error)}}};desktop?.addEventListener('message',receive);return()=>desktop?.removeEventListener('message',receive)},[]);
 useEffect(()=>{desktop?.postMessage({kind:'ready'})},[]);
 async function openBrowserJson(file:File){
  try{const input=JSON.parse(await file.text());const parsed=parseTranscriptStudio(input);const stem=transcriptStem(file.name);
   // Browser File API cannot read siblings of a user-selected file without separate permission.
   const picker=(window as Window&{showDirectoryPicker?:()=>Promise<FileSystemDirectoryHandle>}).showDirectoryPicker;
   if(!picker)throw Error('浏览器不能自动访问同目录媒体；请使用 Windows 桌面版。');
   const directory=await picker();const names:string[]=[];for await(const [name] of (directory as any).entries())names.push(name);
   const match=selectCompanion(file.name,names);if(!match)throw Error(missingCompanionMessage(stem));
   const handle=await directory.getFileHandle(match.name),media=await handle.getFile(),url=URL.createObjectURL(media);
   const next=createProject(match.name,file.name,parsed.words);next.style=settingsToStyle(appSettingsRef.current);next.canvas={...appSettingsRef.current.output};next.mediaKind=match.kind;
   setProjectLoadBlocked(false);
   setMediaUrl(old=>{if(old.startsWith('blob:'))URL.revokeObjectURL(old);return url});setMediaName(match.name);setKind(match.kind);setProject(next);setWords(parsed.words);setEditing(null);setWordTool(null);resetProjectDirtyState();setVideoRatio(null);setMediaState('loading');setDuration(0);notify(`已找到媒体：${match.name}（${match.kind==='audio'?'音频':'视频'}模式），正在读取媒体信息`);
  }catch(e){notify(`导入失败：${String(e)}`,true)}
 }
 const openSubtitleFile=(file:File)=>{
  if(desktop)desktop.postMessageWithAdditionalObjects({kind:'open'},[file]);
  else void openBrowserJson(file);
 };
 const requestOpenSubtitle=(file:File)=>{
  if(hasUnsavedChanges()){setPendingImportFile(file);return}
  openSubtitleFile(file);
 };
 const resolvePendingImport=(accepted:boolean)=>{
  const file=pendingImportFile;
  setPendingImportFile(null);
  if(accepted&&file)openSubtitleFile(file);
 };
 const onMediaReady=(element:HTMLMediaElement)=>{
  if(!Number.isFinite(element.duration)||element.duration<=0){setMediaState('error');notify(`无法读取媒体时长：${mediaName}`,true);return}
  if(kind==='video'){
   const video=element as HTMLVideoElement;
   if(video.videoWidth<=0||video.videoHeight<=0){setMediaState('error');notify(`视频元数据无效（宽高为 0）：${mediaName}`,true);return}
   const ratio=video.videoHeight/video.videoWidth;
   if(Math.round(canvasWidth*ratio)>=canvasHeight){setMediaState('error');notify(`视频画面占满字幕画布：${mediaName}。请调整输出尺寸。`,true);return}
   setVideoRatio(ratio);
  }
  setDuration(element.duration);setMediaState('ready');
  notify(`媒体已就绪：${mediaName}（${kind==='audio'?'音频':'视频'}，${element.duration.toFixed(1)} 秒）`);
 };
 const onMediaFailed=(element:HTMLMediaElement)=>{
  setMediaState('error');setPlaying(false);
  notify(`无法播放媒体：${mediaName||'未知文件'}。${describeMediaError(element.error?.code)}。请核对文件名与内部编码。`,true);
 };
 const refresh=(newWords:Word[])=>{setWords(newWords);markDirty()};
 const snapshot=(w:Word,text=w.display):WordToolSnapshot=>({id:w.id,text,start:w.start,end:w.end,breakParagraph:w.breakParagraph});
 const setEditing=(next:{id:string;text:string}|null)=>{
  editRef.current=next;setEdit(next);
  updateProjectEditState(setProjectDraftChanged(projectEditStateRef.current,hasUnsavedWordDraft(wordsRef.current,next)));
 };
 const commitEditing=():boolean=>{
  const current=editRef.current;if(!current)return true;
  const w=words.find(x=>x.id===current.id);
  if(!w){setEditing(null);return true}
  try{
   const changed=updateWord(words,w.id,current.text);
   if(changed!==words)refresh(changed);
   setWordTool(snapshot({...w,display:current.text},current.text));
   setEditing(null);return true;
  }catch(error){notify(`无法保存单词：${String(error)}`,true);return false}
 };
 const cancelEditing=()=>{
  const current=editRef.current;if(current){const w=words.find(x=>x.id===current.id);if(w)setWordTool(snapshot(w));}
  setEditing(null);
 };
 const startEditing=(w:Word)=>{
  if(editRef.current?.id===w.id)return;
  if(!commitEditing())return;
  mediaRef.current?.pause();
  // Re-read the latest visible display in case the previous word was just committed.
  setWordTool(snapshot(w));setToolLeaving(false);setEditing({id:w.id,text:w.display});
 };
 useEffect(()=>{
  if(!wordTool||edit)return;
  setToolLeaving(false);
  const wait=window.setTimeout(()=>setToolLeaving(true),4000);
  const remove=window.setTimeout(()=>setWordTool(null),4250);
  return()=>{window.clearTimeout(wait);window.clearTimeout(remove)};
 },[wordTool?.id,edit?.id,wordTool?.text,wordTool?.breakParagraph]);
 useEffect(()=>{
  const onOutsideDoubleClick=(event:MouseEvent)=>{
   if(!editRef.current)return;
   if((event.target as Element)?.closest?.('.word-edit,.transcript-word,.word-tools'))return;
   commitEditing();
  };
  document.addEventListener('dblclick',onOutsideDoubleClick);
  return()=>document.removeEventListener('dblclick',onOutsideDoubleClick);
 },[words]);
 const toggleParagraph=()=>{
  const current=editRef.current;if(!current)return;
  const w=words.find(x=>x.id===current.id);if(!w)return;
  const visible=words.filter(x=>!x.hidden);
  if(visible.length&&visible[visible.length-1].id===w.id)return;
  const next=!w.breakParagraph;
  refresh(words.map(x=>x.id===w.id?{...x,breakParagraph:next}:x));
  setWordTool(snapshot({...w,breakParagraph:next},current.text));
 };

 const settingsChange=(next:AppSettings)=>{
  if(!validateSettings(next))return notify('设置参数无效，未保存',true);
  const layoutChanged=JSON.stringify({...next,rightFont:undefined})!==JSON.stringify({...displayedSettings,rightFont:undefined});
  const globalNext=layoutChanged?next:{...appSettings,rightFont:next.rightFont};
  appSettingsRef.current=globalNext;setAppSettings(globalNext);
  if(project&&layoutChanged){mediaRef.current?.pause();setProject(p=>p?{...p,canvas:{...next.output},style:settingsToStyle(next)}:p);markDirty()}
  if(desktop&&loadedSettingsRef.current)desktop.postMessage({kind:'settings-save',settings:globalNext});
 };
 shortcutRef.current=(e:KeyboardEvent)=>{if(e.defaultPrevented||e.altKey||e.metaKey||settingsOpen||dependencyDialogRef.current)return;const target=e.target;if(target instanceof HTMLElement&&(target.isContentEditable||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(target.tagName)))return;
  const action=resolvePlayerShortcut(e.key,e.ctrlKey,e.shiftKey);if(!action||(e.repeat&&['toggle','stop','open-file','save'].includes(action)))return;e.preventDefault();
  if(action==='save')return doSave();if(action==='open-file')return openPicker();const v=mediaRef.current;if(!v)return;
  switch(action){case 'toggle':toggle();break;case 'stop':stop();break;case 'next-frame':v.pause();seek(v.currentTime+1/(project?.export.fps||30));break;case 'previous-frame':v.pause();seek(v.currentTime-1/(project?.export.fps||30));break;case 'forward-10':seek(v.currentTime+10);break;case 'backward-10':seek(v.currentTime-10);break;case 'forward-30':seek(v.currentTime+30);break;case 'backward-30':seek(v.currentTime-30);break;case 'normal-speed':v.playbackRate=1;break;case 'volume-up':v.muted=false;v.volume=Math.min(1,v.volume+.05);break;case 'volume-down':v.volume=Math.max(0,v.volume-.05);break;case 'mute':v.muted=!v.muted;break;}
 };
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>shortcutRef.current(event);window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);

 const timeLabel=(x:number)=>`${Math.floor(x/60).toString().padStart(2,'0')}:${Math.floor(x%60).toString().padStart(2,'0')}`;
 const iconButton=(name:Parameters<typeof Icon>[0]['name'],title:string,click:()=>void,disabled=false)=><button className="circle-button" title={title} aria-label={title} disabled={disabled} onClick={click}><Icon name={name}/></button>;
 const dependencyTitle=dependencyDialog?.mode==='error'?'视频导出环境准备失败':dependencyDialog?.mode==='cancelling'?'正在取消安装':dependencyDialog?.title??'';
 const dependencyActions:DialogAction[]=!dependencyDialog?[]:dependencyDialog.mode==='confirm'
  ?[{label:'取消',variant:'primary',autoFocus:true,onClick:()=>replyDependency(false)},
    {label:dependencyDialog.action,variant:'secondary',onClick:()=>replyDependency(true)}]
  :dependencyDialog.mode==='progress'
   ?[{label:'取消安装',variant:'secondary',autoFocus:true,onClick:cancelDependencyInstall}]
   :dependencyDialog.mode==='cancelling'
    ?[{label:'正在取消…',variant:'secondary',disabled:true,onClick:()=>{}}]
    :[{label:'关闭',variant:'primary',autoFocus:true,onClick:()=>setDependency(null)},
      {label:'重试',variant:'secondary',onClick:()=>{setDependency(null);setTimeout(()=>doExport(),0)}}];
 return <div className="app">
  <input className="hidden-file-input" type="file" accept=".transcript-studio.json" ref={inputRef} onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value='';if(f)requestOpenSubtitle(f)}}/>
  <main className="workspace" style={{gridTemplateColumns:`${geometry.frameWidth}px minmax(240px,1fr)`}}>
   <section className="preview" aria-label="阅读画布预览" style={{width:geometry.frameWidth,height:geometry.frameHeight}}>
    <div className="preview-stage" style={{width:geometry.previewWidth,height:geometry.previewHeight}}>
     <div className="scaled-holder" style={{width:geometry.previewWidth,height:geometry.previewHeight}}><div className="canvas-frame" style={{width:canvasWidth,height:canvasHeight,transform:`scale(${scale})`}}>
     <ReaderCanvas words={words} style={style} time={time} canvasWidth={canvasWidth} canvasHeight={canvasHeight} videoHeight={mediaHeight} pagePlan={plan} video={kind==='video'&&mediaUrl?<><video key={mediaUrl} ref={el=>{mediaRef.current=el}} src={mediaUrl} preload="metadata" onLoadStart={()=>setMediaState('loading')} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onError={e=>onMediaFailed(e.currentTarget)} onLoadedMetadata={e=>onMediaReady(e.currentTarget)} style={{width:canvasWidth,height:mediaHeight,objectFit:'fill',display:'block'}}/>{mediaState!=='ready'&&<div className="media-state-overlay" role={mediaState==='error'?'alert':'status'}>{mediaState==='loading'?'正在加载视频：':'视频尚未就绪：'}{mediaName}</div>}</>:null}/>
     </div></div>
    </div>
   {kind==='audio'&&mediaUrl&&<audio key={mediaUrl} ref={el=>{mediaRef.current=el}} src={mediaUrl} preload="metadata" onLoadStart={()=>setMediaState('loading')} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onLoadedMetadata={e=>onMediaReady(e.currentTarget)} onError={e=>onMediaFailed(e.currentTarget)}/>}
   <div className="transport" style={{width:geometry.previewWidth}}>
    <span className="transport-time">{timeLabel(time)} / {timeLabel(duration)}</span>
    <div className="transport-row"><input aria-label="进度" type="range" min={0} max={duration||1} step="0.01" value={time} onChange={e=>seek(Number(e.target.value))}/>{iconButton(playing?'pause':'play',playing?'暂停 Space':'播放 Space',toggle)}{iconButton('stop','停止 X',stop)}</div>
   </div></section>
   <aside><div className="toolbar"><span className="app-label">Transcript Studio {hasUnsavedProjectChanges(projectEditState)?'●':''}</span>{iconButton('settings','设置',openSettings)}{iconButton('import',mediaName?`导入 JSON Ctrl+O · 当前媒体：${mediaName}`:'导入 JSON Ctrl+O',openPicker,exporting)}{iconButton('save','保存工程 Ctrl+S',doSave,!project||exporting||projectLoadBlocked)}{iconButton('text-export','导出正文 TXT',doExportText,!project||exporting)}{iconButton('export','导出 MP4',doExport,!project||exporting||projectLoadBlocked)}</div>
    <div className="panel"><div ref={transcriptRef} className="transcript" style={{fontFamily:appSettings.rightFont.family,fontSize:editorFontSize,fontWeight:400,lineHeight:1.5,color:appSettings.rightFont.color,backgroundColor:appSettings.rightFont.backgroundColor}}>
     {words.map(w=><React.Fragment key={w.id}>{w.hidden?null:edit?.id===w.id?<InlineWordEditor key={w.id} text={edit.text} fontFamily={appSettings.rightFont.family} fontSize={editorFontSize} color={appSettings.rightFont.color} availableWidth={editorAvailableWidth}
       onText={text=>setEditing({id:w.id,text})} onCommit={commitEditing} onCancel={cancelEditing}/>
       :<span className="transcript-word" title={`${w.start.toFixed(3)}–${w.end.toFixed(3)}`} onDoubleClick={e=>{e.stopPropagation();startEditing(w)}}>{w.display}</span>}{' '}{w.breakParagraph?<div className="paragraph-break"/>:null}</React.Fragment>)}
    </div></div>
    <div className="aside-floats">
     <div className="notices" role="status">{notices.filter(n=>n.error||n.task||notices.slice(-3).includes(n)).map(n=><div key={n.id} className={`notice ${n.error?'error':''} ${n.task?'notice-task':''}`} role={n.error?'alert':'status'}><span className="notice-content">{n.task&&<span className="notice-spinner" aria-hidden="true"/>}{n.text}</span>{!n.task?<button aria-label="关闭消息" title="关闭" onClick={()=>setNotices(a=>a.filter(x=>x.id!==n.id))}><Icon name="close"/></button>:<button type="button" className="notice-cancel-export" onClick={cancelExport} disabled={n.cancelable===false} title={n.cancelable===false?'当前阶段无法取消':'取消导出'}>取消</button>}</div>)}</div>
     {wordTool&&<div className={`word-tools ${toolLeaving?'word-tools-leaving':''}`} role="group" aria-label="单词编辑工具栏"
      onMouseDown={e=>{if(editRef.current)e.preventDefault()}}>
       <div className="word-tools-title">{edit?.id===wordTool.id?edit.text:wordTool.text}: {wordTool.start.toFixed(3)}–{wordTool.end.toFixed(3)}</div>
       <div className="word-tools-actions"><button type="button" disabled={!edit} onClick={()=>{
        const current=editRef.current;const w=words.find(x=>x.id===current?.id);if(w){seek(w.start);mediaRef.current?.pause()}
       }}>定位</button><button type="button" disabled={!edit||words.filter(x=>!x.hidden).at(-1)?.id===wordTool.id} onClick={toggleParagraph}>
        {paragraphActionLabel(wordTool.breakParagraph)}
       </button></div>
     </div>}
    </div>
   </aside>
  </main>
  {pendingImportFile&&<Dialog title="打开其他字幕" subtitle="字幕工程" icon="warning"
   onClose={()=>resolvePendingImport(false)} onEscape={()=>resolvePendingImport(false)} dismissOnBackdrop
   actions={[
    {label:'取消',variant:'primary',autoFocus:true,onClick:()=>resolvePendingImport(false)},
    {label:'放弃修改并打开',variant:'danger',onClick:()=>resolvePendingImport(true)}
   ]}>
   <p>当前字幕存在尚未保存的修改。继续打开其他字幕将丢失这些修改，是否继续？</p>
  </Dialog>}
  {dependencyDialog&&<Dialog title={dependencyTitle} subtitle="视频导出环境准备"
   icon={dependencyDialog.mode==='error'?'error':'package'}
   onClose={dependencyDialog.mode==='confirm'?()=>replyDependency(false):dependencyDialog.mode==='error'?()=>setDependency(null):undefined}
   onEscape={dependencyDialog.mode==='confirm'?()=>replyDependency(false):dependencyDialog.mode==='progress'?cancelDependencyInstall:dependencyDialog.mode==='error'?()=>setDependency(null):undefined}
   actions={dependencyActions} className="dependency-dialog"
   showCloseButton={dependencyDialog.mode==='confirm'||dependencyDialog.mode==='error'}>
   {dependencyDialog.mode==='confirm'?<><strong className="dependency-heading">{dependencyDialog.heading}</strong><p>{dependencyDialog.details}</p><div className="dependency-tip"><span aria-hidden="true">ⓘ</span><span>仅在你确认后开始准备应用自身的导出资源；不会安装系统级 Node.js 或 .NET。</span></div></>:
    (dependencyDialog.mode==='progress'||dependencyDialog.mode==='cancelling')?<><strong className="dependency-heading">{dependencyDialog.mode==='cancelling'?'正在取消安装':'正在准备运行环境'}</strong><p aria-live="polite">{dependencyDialog.message}</p><div className="dependency-progress-track" role="progressbar" aria-label={dependencyDialog.mode==='cancelling'?'正在取消':'安装进行中'}><span/></div><p className="dependency-fine-print">{dependencyDialog.mode==='cancelling'?'正在终止程序启动的安装进程，完成后会自动关闭此窗口。':'此步骤无法可靠计算百分比，完成后会自动继续导出。'}</p></>:
    <><strong className="dependency-heading">安装或准备操作未成功</strong><p className="dependency-error-text">{dependencyDialog.message}</p><div className="dependency-tip"><span aria-hidden="true">ⓘ</span><span>可以检查网络、npm 安装状态后重试。已完成的字幕编辑不会丢失。</span></div></>}
  </Dialog>}
  {settingsOpen&&<div className="modal-backdrop settings-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)closeSettings()}}>
   <div className="settings-dialog" role="dialog" aria-modal="true" aria-label="设置"
    style={{left:settingsRect.x,top:settingsRect.y,width:settingsRect.width,height:settingsRect.height}}>
    <div className="settings-head" onPointerDown={onSettingsPointerDown} onPointerMove={onSettingsPointerMove}
     onPointerUp={onSettingsPointerEnd} onPointerCancel={onSettingsPointerEnd}>
     <strong>设置</strong>{iconButton('close','关闭设置',closeSettings)}
    </div>
    <div className="settings-body" ref={settingsBodyRef}><StyleSettings settings={displayedSettings} onChange={settingsChange} onInvalid={m=>notify(m,true)}/></div>
   </div>
  </div>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
