import {createHash} from 'node:crypto';
/** Standalone CLI admission gate; mirrors src/core/transcript.ts. */
export function assertTranscriptStudio(input){
 const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const meta=input?.transcript_studio;
 if(!object(input)||!object(meta)||meta.format!=='transcript-studio'||meta.schemaVersion!==2)
  throw new Error('仅支持 Transcript Studio v2 (*.transcript-studio.json)');
 if(Object.keys(meta).some(k=>!['format','schemaVersion','displayOverrides'].includes(k)))throw new Error('未知 transcript_studio 字段');
 if('evr' in input||'paragraphs' in input||'paragraphBreaksAfter' in input)throw new Error('禁止旧格式字段');
 if(input.language!=='en'||!Array.isArray(input.segments)||!input.segments.length)throw new Error('必须包含英语 segments');
 const ids=new Set();let last=-Infinity,paragraphs=1,terminal;
 for(let si=0;si<input.segments.length;si++){
  const seg=input.segments[si];if(!object(seg)||!Array.isArray(seg.words)||!seg.words.length)throw new Error(`segment ${si} 缺少 words`);
  if(['paragraph_start','paragraph_id','breakParagraph'].some(k=>k in seg))throw new Error(`segment ${si} 存在错误分段字段`);
  for(let wi=0;wi<seg.words.length;wi++){
   const w=seg.words[wi],id=`s${si}w${wi}`;
   if(!object(w)||typeof w.word!=='string'||!w.word.trim()||/\s/u.test(w.word.trim()))throw new Error(`单词无效：${id}`);
   if(typeof w.start!=='number'||!Number.isFinite(w.start)||typeof w.end!=='number'||!Number.isFinite(w.end)||w.start<0||w.end<=w.start||w.start<last)throw new Error(`时间戳无效：${id}`);
   if('paragraphAfter' in w||'paragraphBreaksAfter' in w||'paragraph_start' in w)throw new Error(`旧版分段字段：${id}`);
   if('breakParagraph' in w&&w.breakParagraph!==true)throw new Error(`breakParagraph 必须为 true：${id}`);
   if(w.breakParagraph===true)paragraphs++;
   last=w.start;terminal=w;ids.add(id);
  }
 }
 if(terminal.breakParagraph===true)throw new Error('末词不能标记 breakParagraph');
 if(input.word_segments!==undefined){
  if(!Array.isArray(input.word_segments)||input.word_segments.some(w=>!object(w)||'breakParagraph' in w))throw new Error('word_segments 禁止分段标记');
 }
 if(meta.displayOverrides!==undefined){
  if(!object(meta.displayOverrides))throw new Error('displayOverrides 必须为对象');
  for(const [id,v] of Object.entries(meta.displayOverrides))if(!ids.has(id)||typeof v!=='string'||!v.trim()||/\s/u.test(v.trim()))throw new Error(`显示词覆盖无效：${id}`);
 }
 return {wordCount:ids.size,paragraphCount:paragraphs};
}


/** Strict admission check for a saved project supplied directly to the export CLI. */
export function assertProjectForExport(project,{mediaName,subtitleName,subtitleBytes,mediaKind,transcript}){
 const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const color=s=>typeof s==='string'&&/^#[0-9a-f]{6}$/i.test(s);
 if(!object(project)||project.format!=='transcript-studio-project'||project.schemaVersion!==2)
  throw new Error('Expected Transcript Studio project v2');
 const source=project.source;
 if(!object(source)||typeof source.videoName!=='string'||typeof source.subtitleName!=='string'||
    source.videoName.toLowerCase()!==mediaName.toLowerCase()||source.subtitleName.toLowerCase()!==subtitleName.toLowerCase())
  throw new Error('Project source names mismatch');
 const expectedHash=createHash('sha256').update(subtitleBytes).digest('hex');
 if(typeof source.subtitleSha256!=='string'||!/^[a-f0-9]{64}$/i.test(source.subtitleSha256)||source.subtitleSha256.toLowerCase()!==expectedHash)
  throw new Error('Subtitle SHA256 mismatch');
 if(project.mediaKind!==undefined&&project.mediaKind!==mediaKind)throw new Error('Project media kind mismatch');
 const canvas=project.canvas;
 if(!object(canvas)||!Number.isInteger(canvas.width)||!Number.isInteger(canvas.height)||
    canvas.width<320||canvas.width>3840||canvas.height<320||canvas.height>3840||canvas.width%2||canvas.height%2)
  throw new Error('Invalid even canvas dimensions');
 const output=project.export;
 if(!object(output)||(output.fps!==30&&output.fps!==60)||!['standard','high'].includes(output.quality))
  throw new Error('Invalid project export settings');
 const style=project.style;
 if(!object(style)||!['left','justify'].includes(style.textAlign)||typeof style.fontFamily!=='string'||!style.fontFamily.trim())
  throw new Error('Invalid project reading style');
 for(const key of ['fontSize','fontWeight','lineHeight','paragraphGap','paddingX','paddingY'])
  if(!finite(style[key]))throw new Error(`Invalid project style value: ${key}`);
 if(style.fontSize<=0||style.fontWeight<=0||style.lineHeight<=0||style.paragraphGap<0||style.paddingX<0||style.paddingY<0)
  throw new Error('Project reading style contains out-of-range values');
 const indent=style.firstLineIndentEm??style.firstLineIndentCh??0;
 if(!finite(indent)||indent<0)throw new Error('Invalid project first-line indentation');
 if(style.firstLineIndentEm!==undefined&&(!Number.isInteger(style.firstLineIndentEm)||style.firstLineIndentEm>9))
  throw new Error('Invalid project firstLineIndentEm');
 if(style.minScrollDuration!==undefined&&(!finite(style.minScrollDuration)||style.minScrollDuration<0))
  throw new Error('Invalid project minScrollDuration');
 for(const key of ['textColor','highlightColor','backgroundColor'])
  if(!color(style[key]))throw new Error(`Invalid project color: ${key}`);
 if(!object(project.overrides))throw new Error('Project overrides must be an object');
 const ids=new Set(transcript.segments.flatMap((segment,si)=>segment.words.map((_,wi)=>`s${si}w${wi}`)));
 for(const [id,override] of Object.entries(project.overrides)){
  if(!ids.has(id)||!object(override))throw new Error(`Invalid project word override: ${id}`);
  if(override.display!==undefined&&(typeof override.display!=='string'||!override.display.trim()||/\s/u.test(override.display.trim())))
   throw new Error(`Invalid project display override: ${id}`);
  if(override.hidden!==undefined&&typeof override.hidden!=='boolean')throw new Error(`Invalid project hidden override: ${id}`);
  if(override.breakParagraph!==undefined&&typeof override.breakParagraph!=='boolean')throw new Error(`Invalid project paragraph override: ${id}`);
 }
 return project;
}
