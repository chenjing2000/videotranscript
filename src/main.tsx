import React,{useEffect,useMemo,useRef,useState} from 'react';import{createRoot}from'react-dom/client';
import{ReaderCanvas}from './ui/ReaderCanvas';import{parseVideoTranscript,applyOverrides,createProject,updateWord,saveProjectView,validateProject,paginate,measureWithCanvas,DEFAULT_STYLE,normalizeProjectStyle,HEIGHT,WIDTH}from './core';import type{Word,Project,VideoTranscriptInput}from './core';import './style.css';
import{StyleSettings}from './ui/StyleSettings';
import {resolvePlayerShortcut} from './core/player-shortcuts';
type DesktopMessage =
 | {kind: 'pair'; videoName: string; subtitleName: string;
    transcript: string; fingerprint: string; project: string | null; videoUrl?: string}
 | {kind: 'saved'; message: string}
 | {kind: 'status'; message: string; busy: boolean}
 | {kind: 'folder'; folder: string; videos: {name: string; path: string}[]};

const desktop = (window as Window & {chrome?: {webview?: {
 postMessage(message: unknown): void;
 postMessageWithAdditionalObjects(message: unknown, files: File[]): void;
 addEventListener(type: 'message', listener: (event: MessageEvent<DesktopMessage>) => void): void;
 removeEventListener(type: 'message', listener: (event: MessageEvent<DesktopMessage>) => void): void;
}}}).chrome?.webview;

function App(){
 const [videoUrl,setVideoUrl]=useState('');const [videoName,setVideoName]=useState('');const [videoHeight,setVideoHeight]=useState(675);const [words,setWords]=useState<Word[]>([]);const[project,setProject]=useState<Project|null>(null);const[time,setTime]=useState(0);const[duration,setDuration]=useState(0);const[tab,setTab]=useState<'样式'|'字幕'|'素材'|'导出'>('素材');const[scale,setScale]=useState(.36);const [selected,setSelected]=useState<string|null>(null);const[edit,setEdit]=useState<{id:string;text:string}|null>(null);const[message,setMessage]=useState('请选择 MP4 和对应的 Video Transcript v2 字幕');const[dirty,setDirty]=useState(false);
 const videoRef=useRef<HTMLVideoElement>(null);const wrapperRef=useRef<HTMLDivElement>(null);const loadRef=useRef<VideoTranscriptInput|null>(null);
 useEffect(()=>{const el=wrapperRef.current;if(!el)return;const ro=new ResizeObserver(()=>setScale(Math.min(el.clientWidth/WIDTH,(el.clientHeight-8)/HEIGHT)));ro.observe(el);return()=>ro.disconnect()},[]);
 useEffect(()=>{let request=0;const update=()=>{const v=videoRef.current;if(v)setTime(v.currentTime);request=requestAnimationFrame(update)};request=requestAnimationFrame(update);return()=>cancelAnimationFrame(request)},[]);
 const selectedFile = useRef<File | null>(null);
 const [exporting, setExporting] = useState(false);
 const [playing, setPlaying] = useState(false);
 const [folderVideos, setFolderVideos] = useState<{name:string;path:string}[]>([]);
 const [browserFolderFiles,setBrowserFolderFiles] = useState<File[]>([]);
 const openVideoInput=useRef<HTMLInputElement>(null);
 const openFolderInput=useRef<HTMLInputElement>(null);
 const seekTo=(target:number)=>{const v=videoRef.current;if(!v)return;v.currentTime=Math.max(0,Math.min(Number.isFinite(v.duration)?v.duration:target,target));setTime(v.currentTime)};
 const togglePlayback=()=>{const v=videoRef.current;if(!v)return;if(v.paused){void v.play().catch(err=>setMessage(`播放失败：${String(err)}`))}else v.pause()};
 const stopPlayback=()=>{const v=videoRef.current;if(!v)return;v.pause();v.currentTime=0;setTime(0)};
 const openFilePicker=()=>{if(exporting)return;setTab('素材');openVideoInput.current?.click()};
 const openFolderPicker=()=>{if(exporting)return;setTab('素材');if(desktop)desktop.postMessage({kind:'open-folder'});else openFolderInput.current?.click()};
 
 useEffect(() => {
  function receive({data}: MessageEvent<DesktopMessage>) {
   if (data.kind === 'folder') {
    setFolderVideos(data.videos);setBrowserFolderFiles([]);setTab('素材');setMessage(`已选择文件夹：${data.folder}（${data.videos.length} 个 MP4）`);return;
   }
   if (data.kind === 'saved') {
    setDirty(false);
    setMessage(data.message);
    return;
   }
   if (data.kind === 'status') {
    setExporting(data.busy);
    setMessage(data.message);
    return;
   }

   const file = selectedFile.current;
   if (!data.videoUrl && !file) return;
   const url = data.videoUrl ?? URL.createObjectURL(file!);
   setVideoUrl(previous => {
    if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
    return url;
   });
   setVideoName(data.videoName);
   setDuration(0);
   setSelected(null);
   setEdit(null);
   setDirty(false);
   setProject(null);
   setWords([]);
   loadRef.current = null;
   try {
    const input = JSON.parse(data.transcript) as VideoTranscriptInput;
    const parsed = parseVideoTranscript(input);
    loadRef.current = input;
    const next = createProject(data.videoName, data.subtitleName, parsed.words);
    next.source.subtitleSha256 = data.fingerprint;
    setProject(next);
    setWords(parsed.words);
    const loaded = `已打开 ${parsed.words.length} 个词项，${parsed.warnings.length} 条字幕提示。`;
    setMessage(loaded);
    if (data.project) {
     try {
      const saved: unknown = JSON.parse(data.project);
      if (!validateProject(saved) || saved.source.subtitleSha256 !== data.fingerprint)
       throw new Error('工程与当前源字幕不匹配');
      setWords(applyOverrides(parsed, saved).words);
      setProject(normalizeProjectStyle(saved));
      setMessage(`${loaded} 已恢复工程。`);
     } catch (error) {
      setMessage(`${loaded} 工程恢复失败：${String(error)}`);
     }
    }
   } catch (error) {
    setMessage(`字幕读取失败：${String(error)}`);
   }
  }
  desktop?.addEventListener('message', receive);
  return () => desktop?.removeEventListener('message', receive);
 }, []);

 const style=project?.style??DEFAULT_STYLE;
 const pagePlan = useMemo(() => videoHeight < HEIGHT
  ? paginate(words, style, WIDTH, HEIGHT - videoHeight, measureWithCanvas(style.fontFamily, style.fontSize, style.fontWeight))
  : undefined, [words, style, videoHeight]);
 const refreshWords=(value:Word[])=>{setWords(value);setDirty(true)};
 const doSave=()=>{if(!project){setMessage('尚未打开字幕');return;}const next=saveProjectView(project,words);
 if (desktop) {
  if (!exporting) desktop.postMessage({kind: 'save', project: next});
  return;
 }
 setProject(next);const blob=new Blob([JSON.stringify(next,null,2)],{type:'application/json'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=`${videoName.replace(/\.mp4$/i,'')}.project.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),500);setDirty(false);setMessage('工程 JSON 已下载。桌面版将自动保存到 .video-transcript/projects/。')};
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   if(e.defaultPrevented||e.altKey||e.metaKey)return;
   const target=e.target;
   if(target instanceof HTMLElement && (target.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target.tagName)))return;
   const action=resolvePlayerShortcut(e.key,e.ctrlKey,e.shiftKey);
   if(!action || (e.repeat && ['toggle','stop','open-file','save'].includes(action)))return;
   e.preventDefault();
   const v=videoRef.current;
   if(action==='save'){doSave();return}
   if(action==='open-file'){openFilePicker();return}
   if(!v)return;
   switch(action){
    case 'toggle':togglePlayback();break;
    case 'stop':stopPlayback();break;
    case 'next-frame':v.pause();seekTo(v.currentTime+1/(project?.export.fps||30));break;
    case 'previous-frame':v.pause();seekTo(v.currentTime-1/(project?.export.fps||30));break;
    case 'forward-10':seekTo(v.currentTime+10);break;
    case 'backward-10':seekTo(v.currentTime-10);break;
    case 'forward-30':seekTo(v.currentTime+30);break;
    case 'backward-30':seekTo(v.currentTime-30);break;
    case 'normal-speed':v.playbackRate=1;break;
    case 'volume-up':v.muted=false;v.volume=Math.min(1,Math.round((v.volume+0.05)*100)/100);break;
    case 'volume-down':v.volume=Math.max(0,Math.round((v.volume-0.05)*100)/100);break;
    case 'mute':v.muted=!v.muted;break;
   }
  };
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey)
 });
 async function importBrowserFolder(fileList:FileList|null){
  if(!fileList)return;
  const files=Array.from(fileList);
  setBrowserFolderFiles(files);
  setFolderVideos(files.filter(f=>/\.mp4$/i.test(f.name)).map(f=>({name:f.webkitRelativePath||f.name,path:f.webkitRelativePath||f.name})));
  setMessage(`已读取 ${files.length} 个文件，请从素材列表选择 MP4。`);
 }
 async function chooseBrowserFolderVideo(path:string){
  const mp4=browserFolderFiles.find(f=>(f.webkitRelativePath||f.name)===path);
  if(!mp4)return;
  const jsonName=path.replace(/\.mp4$/i,'.video-transcript.json');
  const json=browserFolderFiles.find(f=>(f.webkitRelativePath||f.name).toLowerCase()===jsonName.toLowerCase());
  if(!json){setMessage(`缺少同名标准字幕：${jsonName}`);return}
  await importVideo(mp4);await importJsonForPair(json,mp4.name);
 }
 async function importJsonForPair(f:File,pairVideoName:string){try{
  if(!f.name.toLowerCase().endsWith('.video-transcript.json') || f.name.toLowerCase()!==pairVideoName.replace(/\.mp4$/i,'').toLowerCase()+'.video-transcript.json')throw new Error('字幕必须与视频同名且为 v2 标准格式');
  const input=JSON.parse(await f.text()) as VideoTranscriptInput;
  const t=parseVideoTranscript(input);loadRef.current=input;setWords(t.words);setProject(createProject(pairVideoName,f.name,t.words));setMessage(`识别 ${t.words.length} 个有效单词；${t.warnings.length} 条时间提示。`)
 }catch(e){setMessage(String(e))}}
 async function importVideo(f:File){const url=URL.createObjectURL(f);setVideoUrl(old=>{if(old)URL.revokeObjectURL(old);return url});setVideoName(f.name);setMessage('视频已选择，请加载对应的 JSON。')}
 async function importJson(f:File){try{if(!f.name.toLowerCase().endsWith('.video-transcript.json'))throw new Error('只允许导入 *.video-transcript.json 标准字幕');if(videoName && f.name.toLowerCase()!==videoName.replace(/\.mp4$/i,'').toLowerCase()+'.video-transcript.json')throw new Error('字幕文件名必须与视频文件名一致');const input=JSON.parse(await f.text()) as VideoTranscriptInput;const t=parseVideoTranscript(input);loadRef.current=input;setWords(t.words);setProject(createProject(videoName||'video.mp4',f.name,t.words));setMessage(`识别 ${t.words.length} 个有效单词；${t.warnings.length} 条时间提示。`)}catch(e){setMessage(String(e))}}
 async function importProject(f:File){try{const p=JSON.parse(await f.text()) as Project;if(!loadRef.current)throw new Error('请先导入 Video Transcript 标准字幕');if(!validateProject(p))throw new Error('不支持的工程格式');if(p.source?.subtitleName!==project?.source.subtitleName || p.source?.videoName!==project?.source.videoName)throw new Error('工程文件与当前视频/字幕文件名不匹配');const t=applyOverrides(parseVideoTranscript(loadRef.current),p);setWords(t.words);setProject(normalizeProjectStyle(p));setDirty(false);setMessage('工程修改已恢复');}catch(e){setMessage(String(e))}}
 return <div className="app"><input ref={openVideoInput} className="hidden-file-input" type="file" accept=".mp4" onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value='';if(!f)return;if(desktop){if(dirty&&!window.confirm('打开其他素材会丢弃未保存的修改，是否继续？'))return;selectedFile.current=f;desktop.postMessageWithAdditionalObjects({kind:'open'},[f])}else void importVideo(f)}}/><input ref={el=>{openFolderInput.current=el;if(el)el.setAttribute('webkitdirectory','')}} className="hidden-file-input" type="file" multiple onChange={e=>{void importBrowserFolder(e.currentTarget.files);e.currentTarget.value=''}}/><header><strong>Video Transcript — Core Prototype</strong><span>{videoName}{dirty?' *':''}</span><button onClick={doSave}>保存工程 JSON</button></header><main><section className="preview"><div className="preview-stage" ref={wrapperRef}><div style={{width:WIDTH,height:HEIGHT,position:'absolute',left:'50%',top:0,transform:`translateX(-50%) scale(${scale})`,transformOrigin:'top center'}}><ReaderCanvas words={words} style={style} time={time} videoHeight={videoHeight} pagePlan={pagePlan} video={<video ref={videoRef} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} src={videoUrl || undefined} onError={event=>setMessage(`视频加载失败（${event.currentTarget.error?.code ?? 0}）。`)} style={{width:WIDTH,height:videoHeight,objectFit:'fill'}} onLoadedMetadata={e=>{const v=e.currentTarget;setVideoHeight(Math.round(WIDTH*v.videoHeight/v.videoWidth));setDuration(v.duration)}}/>}/></div></div><div className="transport"><input aria-label="播放进度" type="range" min={0} max={duration||1} step={.01} value={time} onChange={e=>seekTo(Number(e.target.value))}/><span className="transport-time">{time.toFixed(2)} / {duration.toFixed(2)}s</span><button type="button" className="transport-icon" title={playing?'暂停（空格）':'播放（空格）'} aria-label={playing?'暂停':'播放'} onClick={togglePlayback}><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">{playing?<path d="M6 4h4v16H6zm8 0h4v16h-4z"/>:<path d="M7 3.5v17l13-8.5z"/>}</svg></button><button type="button" className="transport-icon" title="停止（X）" aria-label="停止" onClick={stopPlayback}><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="1"/></svg></button></div></section><aside><nav>{(['样式','字幕','素材','导出']as const).map(x=><button key={x} className={tab===x?'chosen':''} onClick={()=>setTab(x)}>{x}</button>)}</nav><div className="panel">{tab==='素材' && desktop ? <>
 <h3>打开素材</h3>
 <div className="file-actions"><button type="button" disabled={exporting} onClick={openFilePicker}>打开 MP4 (Ctrl+O)</button><button type="button" disabled={exporting} onClick={openFolderPicker}>打开文件夹</button></div>
 <p>只读取同目录的 &lt;视频名称&gt;.video-transcript.json 标准字幕。</p>{folderVideos.length>0&&<div className="folder-list"><h4>文件夹中的视频</h4>{folderVideos.map(f=><button type="button" key={f.path} onClick={()=>{if(dirty&&!window.confirm('打开其他素材会丢弃未保存的修改，是否继续？'))return;desktop.postMessage({kind:'open-path',path:f.path})}}>{f.name}</button>)}</div>}
 </> : null}{tab==='素材' && !desktop?<><h3>导入素材</h3><div className="file-actions"><button type="button" onClick={openFilePicker}>打开 MP4 (Ctrl+O)</button><button type="button" onClick={openFolderPicker}>打开文件夹</button></div><label>Video Transcript 标准字幕<input type="file" accept=".video-transcript.json" onChange={e=>e.target.files?.[0]&&importJson(e.target.files[0])}/></label><label>恢复工程文件<input type="file" accept=".json" onChange={e=>e.target.files?.[0]&&importProject(e.target.files[0])}/></label>{folderVideos.length>0&&<div className="folder-list"><h4>文件夹中的视频</h4>{folderVideos.map(f=><button type="button" key={f.path} onClick={()=>{void chooseBrowserFolderVideo(f.path)}}>{f.name}</button>)}</div>}<small>原型阶段：浏览器文件选择；正式桌面版使用目录树和同名匹配。</small></>:null}
 {tab==='字幕'?<><h3>逐词编辑</h3><div className="transcript">{words.map(w=><React.Fragment key={w.id}>{w.hidden?null:edit?.id===w.id?<input className="word-edit" autoFocus value={edit.text} onChange={e=>setEdit({...edit,text:e.target.value})} onKeyDown={e=>{if(e.key==='Escape')setEdit(null);if(e.key==='Enter'){try{refreshWords(updateWord(words,w.id,edit.text));setEdit(null)}catch(error){setMessage(String(error))}}}}/>:<span className={selected===w.id?'selected':''} title={`${w.start.toFixed(3)}—${w.end.toFixed(3)}`} onClick={()=>setSelected(w.id)} onDoubleClick={()=>{videoRef.current?.pause();setEdit({id:w.id,text:w.display})}}>{w.display}</span>} {' '}{w.breakParagraph?<div className="paragraph-break"/>:null}</React.Fragment>)}</div>{selected&&<div className="word-tools">{(()=>{const w=words.find(x=>x.id===selected);if(!w)return null;return <><strong>{w.original}</strong> · {w.start.toFixed(3)}–{w.end.toFixed(3)}s <button onClick={()=>{if(videoRef.current){videoRef.current.currentTime=w.start;videoRef.current.pause()}}}>定位播放</button><button onClick={()=>refreshWords(words.map(x=>x.id===w.id?{...x,breakParagraph:!x.breakParagraph}:x))}>切换段落</button><button onClick={()=>refreshWords(words.map(x=>x.id===w.id?{...x,hidden:!x.hidden}:x))}>隐藏词</button><button onClick={()=>refreshWords(updateWord(words,w.id,w.original))}>恢复原词</button></>})()}</div>}</>:null}
 {tab==='样式'?<StyleSettings style={style} onChange={nextStyle=>{if(!project)return;videoRef.current?.pause();setProject({...project,style:nextStyle});setDirty(true)}}/>:null}
 {tab==='导出' && desktop ? <>
 <h3>导出 MP4</h3>
 <p>1200×1600 · {project?.export.fps ?? 30} fps · 保留原声</p>
 <button disabled={!project || !duration || exporting} onClick={() => {
  if (!project) return;
  setExporting(true);
  setMessage('正在准备导出…');
  desktop.postMessage({kind: 'export', project: saveProjectView(project, words), duration, videoHeight, pagePlan});
 }}>{exporting ? '正在导出…' : '导出 MP4'}</button>
 <p>成片保存到素材目录下的 exports 文件夹。</p>
 </> : null}{tab==='导出' && !desktop?<><h3>自动导出</h3><p>1200×1600 · 30 fps · MP4，保留原声。</p><p>浏览器原型不执行导出；在项目目录使用 <code>npm run export -- --video ... --json ... --out ...</code>。</p><p>正式桌面版由 WPF 启动渲染任务，完成后保存到视频所在目录 exports/。</p></>:null}</div><div className="toast" role="status">{message}</div></aside></main>{!desktop && <footer>Video Transcript · Core Prototype</footer>}</div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
