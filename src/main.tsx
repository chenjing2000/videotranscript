import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ReaderCanvas} from './ui/ReaderCanvas';
import {StyleSettings} from './ui/StyleSettings';
import {parseTranscriptStudio,applyOverrides,createProject,updateWord,saveProjectView,validateProject,paginate,measureWithCanvas,DEFAULT_STYLE,normalizeProjectStyle,WIDTH,HEIGHT,validCanvas,transcriptStem,selectCompanion} from './core';
import type {Word,Project,TranscriptStudioInput} from './core';
import {resolvePlayerShortcut} from './core/player-shortcuts';
import './style.css';
import {getWorkspaceLayout} from './core/workspace-layout';
type DesktopMessage =
 | {kind:'pair';mediaName:string;mediaKind:'video'|'audio';subtitleName:string;transcript:string;fingerprint:string;project:string|null;mediaUrl:string}
 | {kind:'saved';message:string}
 | {kind:'status';message:string;busy:boolean;error?:boolean};
const desktop=(window as Window & {chrome?:{webview?:{postMessage(m:unknown):void;postMessageWithAdditionalObjects(m:unknown,files:File[]):void;addEventListener(t:'message',l:(e:MessageEvent<DesktopMessage>)=>void):void;removeEventListener(t:'message',l:(e:MessageEvent<DesktopMessage>)=>void):void}}}).chrome?.webview;
type Notice={id:number;text:string;error:boolean};
function Icon({name}:{name:'settings'|'save'|'import'|'export'|'play'|'pause'|'stop'|'close'}){
 const paths:Record<typeof name,React.ReactNode>={
 settings:<><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="#fff"/><circle cx="16" cy="12" r="2" fill="#fff"/><circle cx="10" cy="18" r="2" fill="#fff"/></>,
 save:<><path d="M4 3h13l3 3v15H4z"/><path d="M7 3v7h10V3M7 21v-8h10v8"/></>,
 import:<><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/></>,
 export:<><path d="M12 21V9m-4 4 4-4 4 4M4 7V3h16v4"/></>,
 play:<path d="M7 4 20 12 7 20z"/>, pause:<><path d="M7 4v16M17 4v16"/></>,
 stop:<rect x="5" y="5" width="14" height="14" rx="1"/>,
 close:<path d="M5 5 19 19M19 5 5 19"/>};
 return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function App(){
 const [mediaUrl,setMediaUrl]=useState('');const [mediaName,setMediaName]=useState('');const [kind,setKind]=useState<'video'|'audio'>('video');
 const [videoRatio,setVideoRatio]=useState(0);const [words,setWords]=useState<Word[]>([]);const [project,setProject]=useState<Project|null>(null);
 const [time,setTime]=useState(0);const [duration,setDuration]=useState(0);
 const [selected,setSelected]=useState<string|null>(null);const [edit,setEdit]=useState<{id:string;text:string}|null>(null);
 const [dirty,setDirty]=useState(false);const [playing,setPlaying]=useState(false);const [exporting,setExporting]=useState(false);const [exportStatus,setExportStatus]=useState('');
 const [settingsOpen,setSettingsOpen]=useState(false);const [viewport,setViewport]=useState({width:window.innerWidth,height:window.innerHeight});const [notices,setNotices]=useState<Notice[]>([]);
 const shortcutRef=useRef<(e:KeyboardEvent)=>void>(()=>{});
 const mediaRef=useRef<HTMLMediaElement|null>(null);const inputRef=useRef<HTMLInputElement>(null);
 const sourceRef=useRef<TranscriptStudioInput|null>(null);const nextNoticeId=useRef(1);
 const canvasWidth=project?.canvas.width??WIDTH,canvasHeight=project?.canvas.height??HEIGHT;
 useEffect(()=>{const update=()=>setViewport({width:window.innerWidth,height:window.innerHeight});window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update)},[]);
 const geometry=getWorkspaceLayout(viewport.width,viewport.height,canvasWidth,canvasHeight);
 const scale=geometry.previewWidth/canvasWidth;
 useEffect(()=>{desktop?.postMessage({kind:'layout',minimumClientWidth:geometry.minimumClientWidth,minimumClientHeight:Math.ceil(geometry.minimumClientHeight),outputWidth:canvasWidth,outputHeight:canvasHeight})},[canvasWidth,canvasHeight,geometry.minimumClientWidth,geometry.minimumClientHeight]);
 const mediaHeight=kind==='video'?Math.round(canvasWidth*videoRatio):0;
 const style=project?.style??DEFAULT_STYLE;
 const notify=(text:string,error=false)=>{
  const id=nextNoticeId.current++;setNotices(prev=>[...prev,{id,text,error}]);
  if(!error)setTimeout(()=>setNotices(prev=>prev.filter(x=>x.id!==id)),5000);
 };
 useEffect(()=>{let frame=0;const tick=()=>{if(mediaRef.current)setTime(mediaRef.current.currentTime);frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)},[]);
 const plan=useMemo(()=>{if(!words.length||canvasHeight-mediaHeight<=0)return undefined;try{return paginate(words,style,canvasWidth,canvasHeight-mediaHeight,measureWithCanvas(style.fontFamily,style.fontSize,style.fontWeight))}catch{return undefined}},[words,style,canvasWidth,canvasHeight,mediaHeight]);
 const seek=(t:number)=>{const v=mediaRef.current;if(!v)return;v.currentTime=Math.max(0,Math.min(Number.isFinite(v.duration)?v.duration:t,t));setTime(v.currentTime)};
 const toggle=()=>{const v=mediaRef.current;if(v){if(v.paused)void v.play().catch(e=>notify(`播放失败：${String(e)}`,true));else v.pause()}};
 const stop=()=>{mediaRef.current?.pause();seek(0)};
 const openPicker=()=>{if(!exporting)inputRef.current?.click()};
 const doSave=()=>{if(!project)return notify('尚未打开标准字幕',true);const p=saveProjectView(project,words);if(desktop){desktop.postMessage({kind:'save',project:p});return}
  const blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`${mediaName.replace(/\.[^.]+$/,'')}.project.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);setDirty(false);notify('工程 JSON 已保存')};
 const doExport=()=>{if(!desktop){notify('请使用 Windows 桌面版导出 MP4',true);return}if(!project||!mediaUrl||!duration||!plan){notify('尚未载入可导出的媒体和字幕，或画布无法排版',true);return}setExporting(true);setExportStatus('正在准备导出…');desktop.postMessage({kind:'export',project:saveProjectView(project,words),duration,videoHeight:mediaHeight,pagePlan:plan})};
 const applyPair=(data:Extract<DesktopMessage,{kind:'pair'}>)=>{
  try{const input=JSON.parse(data.transcript) as TranscriptStudioInput,parsed=parseTranscriptStudio(input);sourceRef.current=input;
   const next=createProject(data.mediaName,data.subtitleName,parsed.words);next.source.subtitleSha256=data.fingerprint;next.mediaKind=data.mediaKind;
   let current=next,currentWords=parsed.words;
   if(data.project){try{const saved:unknown=JSON.parse(data.project);if(!validateProject(saved)||saved.source.subtitleSha256!==data.fingerprint)throw Error('旧工程或字幕指纹不匹配');current=normalizeProjectStyle(saved);currentWords=applyOverrides(parsed,current).words}catch(e){notify(`未恢复工程：${String(e)}`,true)}}
   setMediaUrl(data.mediaUrl);setMediaName(data.mediaName);setKind(data.mediaKind);setProject(current);setWords(currentWords);setSelected(null);setEdit(null);setDirty(false);setDuration(0);setVideoRatio(0);setTime(0);setPlaying(false);
   notify(`已载入 ${parsed.words.length} 个单词 · ${data.mediaKind==='audio'?'纯音频':'视频'}模式`);
  }catch(e){notify(`字幕读取失败：${String(e)}`,true)}
 };
 useEffect(()=>{const receive=({data}:MessageEvent<DesktopMessage>)=>{if(data.kind==='pair')applyPair(data);else if(data.kind==='saved'){setDirty(false);notify(data.message)}else if(data.kind==='status'){setExporting(data.busy);setExportStatus(data.busy?data.message:'');if(!data.busy)notify(data.message,!!data.error)}};desktop?.addEventListener('message',receive);return()=>desktop?.removeEventListener('message',receive)},[]);
 async function openBrowserJson(file:File){
  try{const input=JSON.parse(await file.text());const parsed=parseTranscriptStudio(input);const stem=transcriptStem(file.name);
   // Browser File API cannot read siblings of a user-selected file without separate permission.
   const picker=(window as Window&{showDirectoryPicker?:()=>Promise<FileSystemDirectoryHandle>}).showDirectoryPicker;
   if(!picker)throw Error('浏览器不能自动访问同目录媒体；请使用 Windows 桌面版。');
   const directory=await picker();const names:string[]=[];for await(const [name] of (directory as any).entries())names.push(name);
   const match=selectCompanion(file.name,names);if(!match)throw Error('找不到同名 MP4 / MKV / MP3 / WAV');
   const handle=await directory.getFileHandle(match.name),media=await handle.getFile(),url=URL.createObjectURL(media);
   const next=createProject(match.name,file.name,parsed.words);next.mediaKind=match.kind;
   setMediaUrl(old=>{if(old.startsWith('blob:'))URL.revokeObjectURL(old);return url});setMediaName(match.name);setKind(match.kind);setProject(next);setWords(parsed.words);setDirty(false);setVideoRatio(0);setDuration(0);sourceRef.current=input;notify(`已打开 ${stem} · ${match.kind}`);
  }catch(e){notify(`导入失败：${String(e)}`,true)}
 }
 const refresh=(newWords:Word[])=>{setWords(newWords);setDirty(true)};
 const styleChange=(newStyle:typeof style)=>{if(!project)return;mediaRef.current?.pause();setProject({...project,style:newStyle});setDirty(true)};
 const changeCanvas=(axis:'width'|'height',value:number)=>{if(!project)return;const c={...project.canvas,[axis]:value};if(!validCanvas(c.width,c.height))return;mediaRef.current?.pause();setProject({...project,canvas:c});setDirty(true)};
 shortcutRef.current=(e:KeyboardEvent)=>{if(e.defaultPrevented||e.altKey||e.metaKey||settingsOpen)return;const target=e.target;if(target instanceof HTMLElement&&(target.isContentEditable||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(target.tagName)))return;
  const action=resolvePlayerShortcut(e.key,e.ctrlKey,e.shiftKey);if(!action||(e.repeat&&['toggle','stop','open-file','save'].includes(action)))return;e.preventDefault();
  if(action==='save')return doSave();if(action==='open-file')return openPicker();const v=mediaRef.current;if(!v)return;
  switch(action){case 'toggle':toggle();break;case 'stop':stop();break;case 'next-frame':v.pause();seek(v.currentTime+1/(project?.export.fps||30));break;case 'previous-frame':v.pause();seek(v.currentTime-1/(project?.export.fps||30));break;case 'forward-10':seek(v.currentTime+10);break;case 'backward-10':seek(v.currentTime-10);break;case 'forward-30':seek(v.currentTime+30);break;case 'backward-30':seek(v.currentTime-30);break;case 'normal-speed':v.playbackRate=1;break;case 'volume-up':v.muted=false;v.volume=Math.min(1,v.volume+.05);break;case 'volume-down':v.volume=Math.max(0,v.volume-.05);break;case 'mute':v.muted=!v.muted;break;}
 };
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>shortcutRef.current(event);window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);

 const timeLabel=(x:number)=>`${Math.floor(x/60).toString().padStart(2,'0')}:${Math.floor(x%60).toString().padStart(2,'0')}`;
 const iconButton=(name:Parameters<typeof Icon>[0]['name'],title:string,click:()=>void,disabled=false)=><button className="circle-button" title={title} aria-label={title} disabled={disabled} onClick={click}><Icon name={name}/></button>;
 return <div className="app">
  <input className="hidden-file-input" type="file" accept=".transcript-studio.json" ref={inputRef} onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value='';if(!f)return;if(dirty&&!window.confirm('未保存的编辑将丢失，确定打开其他字幕？'))return;if(desktop)desktop.postMessageWithAdditionalObjects({kind:'open'},[f]);else void openBrowserJson(f)}}/>
  <main className="workspace" style={{gridTemplateColumns:`${geometry.frameWidth}px minmax(240px,1fr)`}}>
   <section className="preview" aria-label="阅读画布预览" style={{width:geometry.frameWidth,height:geometry.frameHeight}}>
    <div className="preview-stage" style={{width:geometry.previewWidth,height:geometry.previewHeight}}>
     <div className="scaled-holder" style={{width:geometry.previewWidth,height:geometry.previewHeight}}><div className="canvas-frame" style={{width:canvasWidth,height:canvasHeight,transform:`scale(${scale})`}}>
     <ReaderCanvas words={words} style={style} time={time} canvasWidth={canvasWidth} canvasHeight={canvasHeight} videoHeight={mediaHeight} pagePlan={plan} video={kind==='video'?<video ref={el=>{mediaRef.current=el}} src={mediaUrl||undefined} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onError={()=>notify('视频解码失败，请检查 MKV/MP4 的内部编码格式',true)} onLoadedMetadata={e=>{const el=e.currentTarget;setVideoRatio(el.videoHeight/el.videoWidth);setDuration(el.duration)}} style={{width:canvasWidth,height:mediaHeight,objectFit:'fill'}}/>:null}/>
     </div></div>
    </div>
   {kind==='audio'&&<audio ref={el=>{mediaRef.current=el}} src={mediaUrl||undefined} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} onError={()=>notify('音频文件无法解码',true)}/>}
   <div className="transport" style={{width:geometry.previewWidth}}>
    <span className="transport-time">{timeLabel(time)} / {timeLabel(duration)}</span>
    <div className="transport-row"><input aria-label="进度" type="range" min={0} max={duration||1} step="0.01" value={time} onChange={e=>seek(Number(e.target.value))}/>{iconButton(playing?'pause':'play',playing?'暂停 Space':'播放 Space',toggle)}{iconButton('stop','停止 X',stop)}</div>
   </div></section>
   <aside><div className="toolbar"><span className="app-label">Transcript Studio {dirty?'●':''}</span>{iconButton('settings','设置',()=>setSettingsOpen(true))}{iconButton('save','保存工程 Ctrl+S',doSave,!project||exporting)}{iconButton('import','导入 JSON Ctrl+O',openPicker,exporting)}{iconButton('export','导出 MP4',doExport,!project||exporting)}</div>
    <div className="panel">{exportStatus&&<div className="export-status" role="status">{exportStatus}</div>}<h3>字幕</h3><div className="transcript" style={{fontFamily:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,lineHeight:style.lineHeight}}>
     {words.map(w=><React.Fragment key={w.id}>{w.hidden?null:edit?.id===w.id?<input className="word-edit" style={{font:'inherit'}} autoFocus value={edit.text} onChange={e=>setEdit({...edit,text:e.target.value})} onKeyDown={e=>{if(e.key==='Escape')setEdit(null);if(e.key==='Enter'){try{refresh(updateWord(words,w.id,edit.text));setEdit(null)}catch(err){notify(String(err),true)}}}}/>:<span className={selected===w.id?'selected':''} title={`${w.start.toFixed(3)}–${w.end.toFixed(3)}`} onClick={()=>setSelected(w.id)} onDoubleClick={()=>{mediaRef.current?.pause();setEdit({id:w.id,text:w.display})}}>{w.display}</span>}{' '}{w.breakParagraph?<div className="paragraph-break"/>:null}</React.Fragment>)}
    </div>{selected&&<div className="word-tools">{(()=>{const w=words.find(x=>x.id===selected);if(!w)return null;return <><strong>{w.original}</strong><span>{w.start.toFixed(3)}–{w.end.toFixed(3)}</span><button onClick={()=>{seek(w.start);mediaRef.current?.pause()}}>定位</button><button onClick={()=>refresh(words.map(x=>x.id===w.id?{...x,breakParagraph:!x.breakParagraph}:x))}>切换段落</button><button onClick={()=>refresh(words.map(x=>x.id===w.id?{...x,hidden:!x.hidden}:x))}>隐藏</button><button onClick={()=>refresh(updateWord(words,w.id,w.original))}>恢复</button></>})()}</div>}</div>
    <div className="notices" role="status">{notices.filter(n=>n.error || notices.slice(-3).includes(n)).map(n=><div key={n.id} className={`notice ${n.error?'error':''}`} role={n.error?'alert':'status'}><span>{n.text}</span><button aria-label="关闭消息" title="关闭" onClick={()=>setNotices(a=>a.filter(x=>x.id!==n.id))}><Icon name="close"/></button></div>)}</div>
   </aside>
  </main>
  {settingsOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSettingsOpen(false)}}><div className="settings-dialog" role="dialog" aria-modal="true" aria-label="设置"><div className="settings-head"><strong>设置</strong>{iconButton('close','关闭设置',()=>setSettingsOpen(false))}</div><div className="settings-body"><h3>输出视频尺寸</h3><div className="canvas-fields"><label>宽度（px）<input type="number" min="320" max="3840" step="2" key={`w-${canvasWidth}`} defaultValue={canvasWidth} onBlur={e=>{if(validCanvas(+e.target.value,canvasHeight))changeCanvas('width',+e.target.value);else{notify('画布宽度必须是 320–3840 的偶数',true);e.target.value=String(canvasWidth)}}}/></label><label>高度（px）<input type="number" min="320" max="3840" step="2" key={`h-${canvasHeight}`} defaultValue={canvasHeight} onBlur={e=>{if(validCanvas(canvasWidth,+e.target.value))changeCanvas('height',+e.target.value);else{notify('画布高度必须是 320–3840 的偶数',true);e.target.value=String(canvasHeight)}}}/></label></div><p className="style-note">最终 MP4 采用上述分辨率。宽高必须为 320–3840 之间的偶数。</p><StyleSettings style={style} onChange={styleChange}/></div></div></div>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
