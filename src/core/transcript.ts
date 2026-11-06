import type {Transcript,TranscriptStudioInput,Word,Project} from './types';
const valid = (n:unknown):n is number => typeof n==='number' && Number.isFinite(n);
const record = (v:unknown):v is Record<string,unknown> => v!==null && typeof v==='object' && !Array.isArray(v);
/** Transcript Studio v2 is the only supported subtitle format. */
export function validateTranscriptStudio(input:unknown):asserts input is TranscriptStudioInput {
 if(!record(input))throw new Error('字幕必须是 Transcript Studio v2 JSON 对象');
 const meta=input.transcript_studio;
 if(!record(meta)||meta.format!=='transcript-studio'||meta.schemaVersion!==2)
  throw new Error('仅支持 Transcript Studio v2：请使用 docs/skills/transcript-studio-paragraphs Skill 生成 *.transcript-studio.json');
 for(const key of Object.keys(meta))if(!['format','schemaVersion','displayOverrides'].includes(key))throw new Error(`不支持的 transcript_studio 字段：${key}`);
 if('evr' in input||'paragraphs' in input||'paragraphBreaksAfter' in input)throw new Error('禁止旧版自然段字段');
 if(input.language!=='en')throw new Error('仅支持 language: "en" 的英语字幕');
 if(!Array.isArray(input.segments)||!input.segments.length)throw new Error('必须包含非空 segments 数组');
 let lastStart=-Infinity,total=0;
 const ids=new Set<string>();
 input.segments.forEach((segment,si)=>{
  if(!record(segment)||!Array.isArray(segment.words)||!segment.words.length)throw new Error(`segment ${si} 缺少 words`);
  if('paragraph_start' in segment||'paragraph_id' in segment||'breakParagraph' in segment)throw new Error(`segment ${si} 包含错误的分段字段`);
  segment.words.forEach((w,wi)=>{
   const id=`s${si}w${wi}`;
   if(!record(w)||typeof w.word!=='string'||!w.word.trim()||/\s/u.test(w.word.trim()))throw new Error(`${id} 不是合法的单词锚点`);
   if(!valid(w.start)||!valid(w.end)||w.start<0||w.end<=w.start||w.start<lastStart)throw new Error(`${id} 时间戳无效或倒序`);
   if('paragraphAfter' in w||'paragraph_start' in w||'paragraphBreaksAfter' in w)throw new Error(`${id} 存在旧版分段字段`);
   if('breakParagraph' in w&&w.breakParagraph!==true)throw new Error(`${id} 的 breakParagraph 只能是 true 或省略`);
   lastStart=w.start;ids.add(id);total++;
  });
 });
 const segments=input.segments;
 const last=segments[segments.length-1].words;
 if(last[last.length-1].breakParagraph===true)throw new Error('最后一个单词禁止设置 breakParagraph');
 if(input.word_segments!==undefined){
  if(!Array.isArray(input.word_segments))throw new Error('word_segments 必须为数组');
  input.word_segments.forEach((w,i)=>{if(!record(w)||'breakParagraph' in w)throw new Error(`word_segments[${i}] 不能包含 breakParagraph`);});
 }
 if(meta.displayOverrides!==undefined){
  if(!record(meta.displayOverrides))throw new Error('displayOverrides 必须是对象');
  for(const [id,value] of Object.entries(meta.displayOverrides)){
   if(!ids.has(id))throw new Error(`显示文字覆盖的单词不存在：${id}`);
   if(typeof value!=='string'||!value.trim()||/\s/u.test(value.trim()))throw new Error(`非法单词显示覆盖：${id}`);
  }
 }
}
export function parseTranscriptStudio(input:unknown):Transcript {
 validateTranscriptStudio(input);
 const words:Word[]=[];
 const overrides=input.transcript_studio.displayOverrides??{};
 input.segments.forEach((segment,si)=>segment.words.forEach((entry,wi)=>{
  const id=`s${si}w${wi}`,original=entry.word.trim(),breakParagraph=entry.breakParagraph===true;
  words.push({id,segmentId:`s${si}`,original,display:overrides[id]??original,sourceDisplay:overrides[id]??original,start:entry.start,end:entry.end,score:entry.score,hidden:false,breakParagraph,sourceBreakParagraph:breakParagraph});
 }));
 return {language:'en',words,warnings:[]};
}
export function updateWord(words:Word[],id:string,display:string):Word[]{
 const v=display.trim();if(!v||/\s/u.test(v))throw new Error('每个时间锚点只能编辑一个词，不能输入空格或空词');
 if(words.some(w=>w.id===id&&w.display===v))return words;
 return words.map(w=>w.id===id?{...w,display:v}:w);
}
export function applyOverrides(t:Transcript,p:Project):Transcript{
 return {...t,words:t.words.map(w=>{const o=p.overrides[w.id];return o?{...w,display:o.display??w.display,hidden:o.hidden??w.hidden,breakParagraph:o.breakParagraph??w.breakParagraph}:w;})};
}
export function buildOverrides(words:Word[]):Project['overrides']{
 const out:Project['overrides']={};for(const w of words){const x:{display?:string;hidden?:boolean;breakParagraph?:boolean}={};if(w.display!==(w.sourceDisplay??w.original))x.display=w.display;if(w.hidden)x.hidden=true;if(w.breakParagraph!==(w.sourceBreakParagraph??false))x.breakParagraph=w.breakParagraph;if(Object.keys(x).length)out[w.id]=x;}return out;
}
export function visibleWords(words:Word[]):Word[]{return words.filter(w=>!w.hidden)}
