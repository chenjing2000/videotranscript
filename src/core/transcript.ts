import type {Transcript,WhisperXInput,Word,Project} from './types';
const valid=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
export function parseWhisperX(input:WhisperXInput):Transcript {
 if(!input||!Array.isArray(input.segments))throw new Error('字幕 JSON 必须包含 segments 数组');
 const words:Word[]=[];const warnings:string[]=[];
 input.segments.forEach((segment,si)=>{
  if(!Array.isArray(segment.words)){warnings.push(`segment ${si}: 缺少 words`);return;}
  segment.words.forEach((entry,wi)=>{
   const original=(entry.word??'').trim();if(!original){warnings.push(`segment ${si} word ${wi}: 空词`);return;}
   if(!valid(entry.start)||!valid(entry.end)||entry.start<0||entry.end<=entry.start){warnings.push(`segment ${si} word ${wi}: 时间异常，已跳过`);return;}
   words.push({id:`s${si}w${wi}`,segmentId:`s${si}`,original,display:original,start:entry.start,end:entry.end,score:entry.score,hidden:false,paragraphAfter:false});
  });
 });
 if(words.length===0)throw new Error('字幕没有可用的逐词时间戳');
 for(let i=1;i<words.length;i++)if(words[i].start<words[i-1].start)warnings.push(`word ${words[i].id}: 时间顺序异常`);
 return {language:input.language,words,warnings};
}
export function updateWord(words:Word[],id:string,display:string):Word[]{
 const v=display.trim();if(!v||/\s/u.test(v))throw new Error('每个时间锚点只能编辑一个词，不能输入空格或空词');
 return words.map(w=>w.id===id?{...w,display:v}:w);
}
export function applyOverrides(t:Transcript,p:Project):Transcript{
 return {...t,words:t.words.map(w=>{const o=p.overrides[w.id];return o?{...w,display:o.display??w.display,hidden:o.hidden??w.hidden,paragraphAfter:o.paragraphAfter??w.paragraphAfter}:w;})};
}
export function buildOverrides(words:Word[]):Project['overrides']{
 const out:Project['overrides']={}; for(const w of words){const x:{display?:string;hidden?:boolean;paragraphAfter?:boolean}={};if(w.display!==w.original)x.display=w.display;if(w.hidden)x.hidden=true;if(w.paragraphAfter)x.paragraphAfter=true;if(Object.keys(x).length)out[w.id]=x;}return out;
}
export function visibleWords(words:Word[]):Word[]{return words.filter(w=>!w.hidden)}
