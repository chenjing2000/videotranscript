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
