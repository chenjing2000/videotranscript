import type {Transcript,WhisperXInput,Word,Project} from './types';

const valid = (n:unknown):n is number => typeof n==='number' && Number.isFinite(n);
const record = (v:unknown):v is Record<string,unknown> => v!==null && typeof v==='object' && !Array.isArray(v);
/** Strict EVR Transcript v1 admission gate. No raw WhisperX fallback. */
export function validateEvrTranscript(input:unknown):asserts input is WhisperXInput {
 if(!record(input))throw new Error('字幕必须是 JSON 对象，且符合 EVR Transcript v1 标准');
 const evr=input.evr;
 if(!record(evr)||evr.format!=='evr-transcript'||evr.schemaVersion!==1)
  throw new Error('只支持 EVR Transcript v1：请先使用 docs/english-transcript-paragraphs Skill 生成 *.evr-transcript.json');
 const expected=new Set(['format','schemaVersion','paragraphBreaksAfter','displayOverrides']);
 for(const key of Object.keys(evr))if(!expected.has(key))throw new Error(`EVR 不支持的扩展字段：${key}`);
 if('paragraphs' in input)throw new Error('EVR v1 不允许旧版 paragraphs，请用 Skill 统一转换');
 if(input.language!=='en')throw new Error('仅支持 language: "en" 的英语字幕');
 if(!Array.isArray(input.segments)||input.segments.length===0)throw new Error('EVR 字幕必须包含非空 segments 数组');
 if(!Array.isArray(evr.paragraphBreaksAfter))throw new Error('evr.paragraphBreaksAfter 必须为数组（没有段落边界时使用 []）');
 const ids:string[]=[];
 let lastStart=-Infinity;
 input.segments.forEach((segment,si)=>{
  if(!record(segment)||!Array.isArray(segment.words)||!segment.words.length)throw new Error(`segment ${si} 缺少 words`);
  if('paragraph_start' in segment || 'paragraph_id' in segment)throw new Error(`segment ${si} 包含过期的段落字段，请用 Skill 转换`);
  segment.words.forEach((w,wi)=>{
   if(!record(w)||typeof w.word!=='string'||!w.word.trim()||/\s/u.test(w.word.trim()))throw new Error(`s${si}w${wi} 不是合法的单词锚点`);
   if(!valid(w.start)||!valid(w.end)||w.start<0||w.end<=w.start)throw new Error(`s${si}w${wi} 时间戳无效`);
   if(w.start<lastStart)throw new Error(`s${si}w${wi} 时间戳起点倒序`);
   lastStart=w.start;ids.push(`s${si}w${wi}`);
  });
 });
 if(!ids.length)throw new Error('字幕没有可用单词');
 const lookup=new Map(ids.map((id,i)=>[id,i]));
 let lastIndex=-1;
 for(const id of evr.paragraphBreaksAfter){
  if(typeof id!=='string'||!lookup.has(id))throw new Error(`无效的自然段边界：${String(id)}`);
  const i=lookup.get(id)!;
  if(i<=lastIndex)throw new Error(`自然段边界必须按顺序排列，且不能重复：${id}`);
  if(i===ids.length-1)throw new Error('最后一个单词后无需记录自然段边界');
  lastIndex=i;
 }
 if(evr.displayOverrides!==undefined){
  if(!record(evr.displayOverrides))throw new Error('displayOverrides 必须是对象');
  for(const [id,value] of Object.entries(evr.displayOverrides)){
   if(!lookup.has(id))throw new Error(`显示文字覆盖的单词不存在：${id}`);
   if(typeof value!=='string'||!value.trim()||/\s/u.test(value.trim()))throw new Error(`非法单词显示覆盖：${id}`);
  }
 }
}
export function parseWhisperX(input:unknown):Transcript {
 validateEvrTranscript(input);
 const words:Word[]=[];
 const boundaries=new Set(input.evr.paragraphBreaksAfter);
 const overrides=input.evr.displayOverrides??{};
 input.segments.forEach((segment,si)=>{
  segment.words!.forEach((entry,wi)=>{
   const id=`s${si}w${wi}`,original=entry.word!.trim();
   const paragraphAfter=boundaries.has(id);
   words.push({id,segmentId:`s${si}`,original,display:overrides[id]??original,sourceDisplay:overrides[id]??original,start:entry.start!,end:entry.end!,score:entry.score,hidden:false,paragraphAfter,sourceParagraphAfter:paragraphAfter});
  });
 });
 return {language:'en',words,warnings:[]};
}
export function updateWord(words:Word[],id:string,display:string):Word[]{
 const v=display.trim();if(!v||/\s/u.test(v))throw new Error('每个时间锚点只能编辑一个词，不能输入空格或空词');
 return words.map(w=>w.id===id?{...w,display:v}:w);
}
export function applyOverrides(t:Transcript,p:Project):Transcript{
 return {...t,words:t.words.map(w=>{const o=p.overrides[w.id];return o?{...w,display:o.display??w.display,hidden:o.hidden??w.hidden,paragraphAfter:o.paragraphAfter??w.paragraphAfter}:w;})};
}
export function buildOverrides(words:Word[]):Project['overrides']{
 const out:Project['overrides']={};for(const w of words){const x:{display?:string;hidden?:boolean;paragraphAfter?:boolean}={};if(w.display!==(w.sourceDisplay??w.original))x.display=w.display;if(w.hidden)x.hidden=true;if(w.paragraphAfter!==(w.sourceParagraphAfter??false))x.paragraphAfter=w.paragraphAfter;if(Object.keys(x).length)out[w.id]=x;}return out;
}
export function visibleWords(words:Word[]):Word[]{return words.filter(w=>!w.hidden)}
