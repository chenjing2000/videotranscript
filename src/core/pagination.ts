/** M2 static, deterministic pagination. All dimensions are 1200x1600 logical pixels. */
import type {Word,ReadingStyle} from './types';
import type {Measure} from './layout';
export interface PageWord { index:number; id:string; x:number; width:number }
export interface PageRow {startWord:number;endWord:number;top:number;height:number;paragraphStart:boolean;paragraphEnd:boolean;endsSentence:boolean;words:PageWord[]}
export interface Page {index:number;rows:PageRow[];firstWordId:string;lastWordId:string;firstStart:number;lastEnd:number;usedHeight:number}
export interface PagePlan {pages:Page[];switches:number[];warnings:string[];availableHeight:number;availableWidth:number;viewportHeight:number;viewportWidth:number}
const EPS=1e-6;
const isSentenceEnd=(s:string)=>/[.!?][)'"”’]*$/u.test(s.trim());
interface RawRow extends Omit<PageRow,'top'> {}
export function paginate(words:Word[],style:ReadingStyle,viewportWidth:number,viewportHeight:number,measure:Measure):PagePlan{
 const numeric=[style.fontSize,style.lineHeight,style.paragraphGap,style.paddingX,style.paddingY,style.firstLineIndentEm??style.firstLineIndentCh??0,viewportWidth,viewportHeight];
 if(numeric.some(x=>!Number.isFinite(x)))throw new Error('排版参数必须为有限数值');
 if(style.fontSize<=0||style.lineHeight<=0||style.paddingX<0||style.paddingY<0||style.paragraphGap<0||(style.firstLineIndentEm??style.firstLineIndentCh??0)<0)throw new Error('无效的排版参数');
 const availableWidth=viewportWidth-2*style.paddingX,availableHeight=viewportHeight-2*style.paddingY;
 const height=style.fontSize*style.lineHeight;
 if(availableWidth<=0||availableHeight+EPS<height)throw new Error('阅读区域不足以容纳一行文字');
 // Hidden words do not render, but a paragraph break attached to a hidden
 // word still ends that paragraph. Transfer the boundary to the last visible
 // word before it, without mutating the source transcript or edit overrides.
 const visible:Word[]=[];
 for(const word of words){
  if(!word.hidden){visible.push(word);continue;}
  if(word.breakParagraph&&visible.length){
   const last=visible.length-1;
   visible[last]={...visible[last],breakParagraph:true};
  }
 }
 const warnings:string[]=[];
 if(!visible.length)return {pages:[],switches:[],warnings,availableHeight,availableWidth,viewportHeight,viewportWidth};
 for(let i=0;i<visible.length;i++){
  const w=visible[i];if(!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.end<=w.start)throw new Error(`无效时间戳：${w.id}`);
  if(i>0&&w.start<visible[i-1].start)warnings.push(`单词时间倒序：${w.id}`);
 }
 const indent=style.firstLineIndentCh!==undefined?style.firstLineIndentCh*measure('0'):(style.firstLineIndentEm??0)*style.fontSize, spaceWidth=measure(' ');
 const raw:RawRow[]=[];let start=0,width=0,atParagraphStart=true,positions:PageWord[]=[];
 function flush(end:number,para:boolean){
  if(end<start)return;
  // Word-like justification: expand INTER-WORD spaces, never the glyphs.
  // The final line of a true paragraph stays left aligned; a page break
  // does not change a line's paragraphEnd flag.
  if((style.textAlign??'justify')==='justify'&&!para&&positions.length>1){
   const lineLeft=atParagraphStart?indent:0;
   const contentWidth=availableWidth-lineLeft;
   const glyphWidth=positions.reduce((sum,item)=>sum+item.width,0);
   const justifiedSpace=(contentWidth-glyphWidth)/(positions.length-1);
   // A line can contain an overwide unbreakable word. Never create
   // negative spacing in that case; overflow is separately warned.
   if(justifiedSpace>=spaceWidth-EPS){
    let x=lineLeft;
    positions=positions.map(item=>{const result={...item,x};x+=item.width+justifiedSpace;return result;});
   }
  }
  raw.push({startWord:start,endWord:end,height,paragraphStart:atParagraphStart,paragraphEnd:para,endsSentence:isSentenceEnd(visible[end].display),words:positions});
  start=end+1;width=0;positions=[];atParagraphStart=para;
 }
 visible.forEach((w,i)=>{
  let lead=i===start?(atParagraphStart?indent:0):spaceWidth;
  const measured=measure(w.display);
  if(i>start && width+lead+measured>availableWidth+EPS){flush(i-1,false);lead=0;}
  positions.push({index:i,id:w.id,x:width+lead,width:measured});width+=lead+measured;
  if(width>availableWidth+EPS)warnings.push(`单词或首行缩进超过行宽：${w.id}`);
  if(w.breakParagraph)flush(i,true);
 });
 if(start<visible.length)flush(visible.length-1,true);
 if(raw.length)raw[raw.length-1].paragraphEnd=true;
 // M5: strict greedy fill; no sentence/paragraph score, widow or orphan controls.
 // Every page consumes the maximum number of complete lines that physically fit.
 const pages:Page[]=[];
 for(let i=0;i<raw.length;){
  const rows:PageRow[]=[];let y=style.paddingY;
  while(i<raw.length){
   const line=raw[i];
   const gap=rows.length>0&&line.paragraphStart?style.paragraphGap:0;
   if(rows.length>0&&y+gap+height>style.paddingY+availableHeight+EPS)break;
   if(rows.length===0&&height>availableHeight+EPS)throw new Error('自动分页失败：一行文字无法容纳');
   y+=gap;rows.push({...line,top:y});y+=height;i++;
  }
  const a=visible[rows[0].startWord],b=visible[rows[rows.length-1].endWord];
  pages.push({index:pages.length,rows,firstWordId:a.id,lastWordId:b.id,firstStart:a.start,lastEnd:b.end,usedHeight:y-style.paddingY});
 }
 const switches=[0];
 for(let i=1;i<pages.length;i++){
  const prev=pages[i-1],cur=pages[i], t=cur.firstStart>prev.lastEnd?(cur.firstStart+prev.lastEnd)/2:cur.firstStart;
  if(cur.firstStart<prev.lastEnd)warnings.push(`跨页单词时间重叠：${i-1} → ${i}`);
  if(t<switches[i-1])warnings.push(`翻页时间倒序：第 ${i+1} 页，已钳位`);
  switches.push(Math.max(t,switches[i-1]));
 }
 return {pages,switches,warnings,availableHeight,availableWidth,viewportHeight,viewportWidth};
}
export function pageAtTime(plan:PagePlan,time:number){
 if(!plan.pages.length)return -1;if(!Number.isFinite(time))return 0;
 let lo=0,hi=plan.switches.length;
 while(lo<hi){const m=(lo+hi)>>>1;if(plan.switches[m]<=time)lo=m+1;else hi=m;}
 return Math.max(0,lo-1);
}
/** Validate the shape and basic invariants of an external page-plan snapshot.
 * This is a guard for rendering, not a replacement for source fingerprint checks. */
export function isPagePlan(v:unknown):v is PagePlan{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const p=v as Partial<PagePlan>;
 const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
 if(!Array.isArray(p.pages)||!Array.isArray(p.switches)||
    p.pages.length!==p.switches.length||!Array.isArray(p.warnings)||
    !finite(p.availableHeight)||p.availableHeight<=0||
    !finite(p.availableWidth)||p.availableWidth<=0||
    !finite(p.viewportHeight)||p.viewportHeight<=0||
    !finite(p.viewportWidth)||p.viewportWidth<=0)return false;
 let lastSwitch=-Infinity;
 for(let i=0;i<p.pages.length;i++){
  const sw=p.switches[i];
  if(!finite(sw)||sw<0||sw<lastSwitch)return false;
  lastSwitch=sw;
  const page=p.pages[i];
  if(!page||typeof page!=='object'||page.index!==i||!Array.isArray(page.rows)||!page.rows.length||
     typeof page.firstWordId!=='string'||typeof page.lastWordId!=='string'||
     !finite(page.firstStart)||!finite(page.lastEnd)||!finite(page.usedHeight)||page.usedHeight<0)return false;
  let previousTop=-Infinity;
  for(const row of page.rows){
   if(!row||typeof row!=='object'||!Array.isArray(row.words)||!row.words.length||
      !Number.isInteger(row.startWord)||!Number.isInteger(row.endWord)||row.startWord<0||row.endWord<row.startWord||
      !finite(row.top)||!finite(row.height)||row.height<=0||row.top<previousTop||
      typeof row.paragraphStart!=='boolean'||typeof row.paragraphEnd!=='boolean')return false;
   previousTop=row.top;
   for(const word of row.words){
    if(!word||typeof word!=='object'||!Number.isInteger(word.index)||word.index<0||
       typeof word.id!=='string'||!finite(word.x)||!finite(word.width)||word.width<0)return false;
   }
  }
 }
 return true;
}
