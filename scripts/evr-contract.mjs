/** CLI strict admission gate: aligned with src/core/transcript.ts. */
export function assertEvrTranscript(input){
 const object=x=>!!x && typeof x==='object' && !Array.isArray(x);
 if(!object(input)||!object(input.evr)||input.evr.format!=='evr-transcript'||input.evr.schemaVersion!==1)
  throw new Error('仅接受 EVR Transcript v1 (*.evr-transcript.json)，请先使用 docs/english-transcript-paragraphs Skill');
 const evr=input.evr;
 if(Object.keys(evr).some(k=>!['format','schemaVersion','paragraphBreaksAfter','displayOverrides'].includes(k)))throw new Error('EVR 扩展字段未知');
 if('paragraphs' in input)throw new Error('过期的 paragraphs 字段必须先转换');
 if(input.language!=='en'||!Array.isArray(input.segments)||!input.segments.length)throw new Error('EVR 字幕语言必须为 en，segments 不得为空');
 const keys=[];let prev=-Infinity;
 for(let si=0;si<input.segments.length;si++){
  const segment=input.segments[si];if(!object(segment)||!Array.isArray(segment.words)||!segment.words.length)throw new Error(`segment ${si} 缺少单词`);
  if('paragraph_start' in segment || 'paragraph_id' in segment)throw new Error(`segment ${si} 包含过期分段字段`);
  for(let wi=0;wi<segment.words.length;wi++){
   const w=segment.words[wi],key=`s${si}w${wi}`;
   if(!object(w)||typeof w.word!=='string'||!w.word.trim()||/\s/u.test(w.word.trim()))throw new Error(`无效单词：${key}`);
   if(typeof w.start!=='number'||!Number.isFinite(w.start)||typeof w.end!=='number'||!Number.isFinite(w.end)||w.start<0||w.end<=w.start||w.start<prev)throw new Error(`时间戳无效：${key}`);
   prev=w.start;keys.push(key);
  }
 }
 if(!Array.isArray(evr.paragraphBreaksAfter))throw new Error('段落边界必须为数组');
 const positions=new Map(keys.map((k,i)=>[k,i]));let last=-1;
 for(const key of evr.paragraphBreaksAfter){const i=positions.get(key);if(i===undefined||i<=last||i===keys.length-1)throw new Error(`无效段落边界：${key}`);last=i;}
 if(evr.displayOverrides!==undefined){
  if(!object(evr.displayOverrides))throw new Error('显示词覆盖格式无效');
  for(const [key,value] of Object.entries(evr.displayOverrides))if(!positions.has(key)||typeof value!=='string'||!value.trim()||/\s/u.test(value.trim()))throw new Error(`显示词覆盖无效：${key}`);
 }
 return {wordCount:keys.length,paragraphCount:evr.paragraphBreaksAfter.length+1};
}
