import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const core=require('../.tmp-core/index.js');
const style={...core.DEFAULT_STYLE,fontFamily:'Arial',fontSize:10,fontWeight:400,lineHeight:1,paragraphGap:7,paddingX:0,paddingY:2,firstLineIndentCh:4};
const measure=text=>text.length*5;
const words=(list)=>list.map((text,i)=>({id:`w${i}`,original:text,display:text,start:i*1.3,end:i*1.3+0.8,hidden:false,paragraphAfter:false,segmentId:'s0'}));
const plan=(w,height=25,width=65,s=style)=>core.paginate(w,s,width,height,measure);
test('M2: short text stays one stationary page, starts with first-line indentation',()=>{
 const p=plan(words(['Hi.','Bye.']),30,100);
 assert.equal(p.pages.length,1);assert.equal(p.switches[0],0);
 assert.equal(p.pages[0].rows[0].top,2);
 assert.equal(p.pages[0].rows[0].words[0].x,20);
 for(const t of [-1,0,2,100])assert.equal(core.pageAtTime(p,t),0);
});
test('M2: long text has finite pages, no clipped rows, every visible word exactly once',()=>{
 const w=words(Array.from({length:29},(_,i)=>i%4===3?'end.':'word'));
 const p=plan(w,23,75);
 assert.ok(p.pages.length>2);
 const seen=p.pages.flatMap(pg=>pg.rows.flatMap(r=>r.words.map(x=>x.id)));
 assert.deepEqual(seen,w.map(x=>x.id));
 for(const pg of p.pages){for(const row of pg.rows){assert.ok(row.top>=style.paddingY);assert.ok(row.top+row.height<=23-style.paddingY+1e-6);}}
 for(let i=1;i<p.switches.length;i++)assert.ok(p.switches[i]>=p.switches[i-1]);
});
test('M2: paragraphs only indent their real first line, not page continuation',()=>{
 const w=words(['One','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve']);
 const p=plan(w,14,50);
 assert.ok(p.pages.length>1);
 const all=p.pages.flatMap(x=>x.rows);
 assert.equal(all[0].words[0].x,20);
 for(const row of all.slice(1))assert.equal(row.words[0].x,0);
});
test('M2: new paragraph indent and spacing are applied within the page',()=>{
 const w=words(['First.','Second.']);w[0].paragraphAfter=true;
 const p=plan(w,35,100);
 assert.equal(p.pages.length,1);
 assert.equal(p.pages[0].rows[1].top,style.paddingY+10+style.paragraphGap);
 assert.equal(p.pages[0].rows[1].words[0].x,20);
});
test('M2: margin/font change deterministically repaginates',()=>{
 const w=words(Array.from({length:40},(_,i)=>i%5===0?'text.':'text'));
 const a=plan(w,45,110),b=plan(w,45,65),c=plan(w,45,110,{...style,fontSize:15});
 assert.ok(b.pages.length>=a.pages.length);assert.ok(c.pages.length>=a.pages.length);
 assert.deepEqual(plan(w,45,110),a);
});
test('M2: switch is within speech gap, and rewind is stateless',()=>{
 const w=words(Array.from({length:12},()=> 'longword.'));
 const p=plan(w,14,55);
 assert.ok(p.pages.length>1);
 const prev=p.pages[0],next=p.pages[1];
 assert.ok(p.switches[1]>prev.lastEnd&&p.switches[1]<next.firstStart);
 assert.equal(core.pageAtTime(p,p.switches[1]-0.001),0);
 assert.equal(core.pageAtTime(p,p.switches[1]),1);
 assert.equal(core.pageAtTime(p,0),0);
});
test('M2: overlapping speech generates warning but never time-reversed switches',()=>{
 const w=words(['one.','two.','three.']);w[1].start=w[0].end-0.3;w[2].start=w[1].end-0.2;
 const p=plan(w,14,55);
 assert.ok(p.warnings.some(x=>x.includes('重叠')));
 assert.ok(p.switches.every((t,i)=>i===0||t>=p.switches[i-1]));
});
test('M2: hidden word is excluded and changes visible layout',()=>{
 const w=words(['first','hidden','last']);w[1].hidden=true;
 const p=plan(w,35,110);
 assert.deepEqual(p.pages.flatMap(x=>x.rows.flatMap(r=>r.words.map(x=>x.id))),['w0','w2']);
});
test('M2: refuses page shorter than one row',()=>{
 assert.throws(()=>plan(words(['text']),8,100),/不足/);
});
test('M2: parses presegmented paragraph metadata without changing source time',()=>{
 const inp=JSON.parse(readFileSync('fixtures/6 Minute English 01-seg1.evr-transcript.json','utf8'));
 const source=core.parseWhisperX(inp);assert.equal(source.words.length,200);
 const tagged=structuredClone(inp);tagged.evr.paragraphBreaksAfter=['s0w0'];
 const trans=core.parseWhisperX(tagged);
 assert.equal(trans.words[0].paragraphAfter,true);
 assert.deepEqual(trans.words.map(w=>[w.start,w.end]),source.words.map(w=>[w.start,w.end]));
});
test('M2: old project gains new style defaults without losing existing values',()=>{
 const p=core.createProject('test.mp4','test.json',words(['one.']));delete p.style.firstLineIndentCh;delete p.style.fontWeight;
 p.style.fontSize=44;const migrated=core.migrateProjectStyle(p);
 assert.equal(migrated.style.fontSize,44);assert.equal(migrated.style.firstLineIndentCh,4);assert.equal(migrated.style.fontWeight,400);
});

test('M2: removing source paragraph break survives project save/reload',()=>{
 const input={language:'en',evr:{format:'evr-transcript',schemaVersion:1,paragraphBreaksAfter:['s0w0']},segments:[{words:[{word:'One.',start:1,end:1.5}]},{words:[{word:'Two.',start:2,end:2.5}]}]};
 const parsed=core.parseWhisperX(input);
 assert.equal(parsed.words[0].paragraphAfter,true);
 const changed=parsed.words.map((w,i)=>i===0?{...w,paragraphAfter:false}:w);
 const project=core.saveProjectView(core.createProject('x.mp4','x.json',parsed.words),changed);
 assert.equal(project.overrides[parsed.words[0].id].paragraphAfter,false);
 assert.equal(core.applyOverrides(parsed,project).words[0].paragraphAfter,false);
});

test('M3: Word-style justification reaches right edge; paragraph last row stays left',()=>{
 const s={...style,firstLineIndentCh:0,textAlign:'justify'};
 const w=words(['aaaa','bbbb','cccc','dddd','eeee']);
 const p=plan(w,90,100,s);
 const rows=p.pages.flatMap(pg=>pg.rows);
 assert.equal(rows.length,2);
 assert.equal(rows[0].paragraphEnd,false);
 assert.ok(Math.abs(rows[0].words.at(-1).x+rows[0].words.at(-1).width-100)<1e-6);
 assert.equal(rows[1].paragraphEnd,true);
 assert.equal(rows[1].words[0].x,0);
});

test('M3: first line justifies inside its indentation, not at left page edge',()=>{
 const w=words(['aaaa','bbbb','cccc','dddd','eeee']);
 const p=plan(w,90,100,{...style,textAlign:'justify'});
 const first=p.pages[0].rows[0];
 assert.equal(first.paragraphStart,true);
 assert.equal(first.words[0].x,20);
 assert.ok(Math.abs(first.words.at(-1).x+first.words.at(-1).width-100)<1e-6);
});

test('M3: left alignment can be selected, and keeps ordinary space widths',()=>{
 const w=words(['aaaa','bbbb','cccc','dddd','eeee']);
 const p=plan(w,90,100,{...style,firstLineIndentCh:0,textAlign:'left'});
 const first=p.pages[0].rows[0];
 assert.ok(first.words.at(-1).x+first.words.at(-1).width<100);
 assert.equal(first.words[1].x-first.words[0].x-first.words[0].width,5);
});

test('M3: page boundary is NOT paragraph boundary; continuation stays justified',()=>{
 const w=words(Array.from({length:32},()=> 'aaaa'));
 const p=plan(w,24,100,{...style,firstLineIndentCh:0,textAlign:'justify'});
 assert.ok(p.pages.length>1);
 const lastOfFirstPage=p.pages[0].rows.at(-1);
 assert.equal(lastOfFirstPage.paragraphEnd,false);
 assert.ok(Math.abs(lastOfFirstPage.words.at(-1).x+lastOfFirstPage.words.at(-1).width-100)<1e-6);
 assert.equal(p.pages[1].rows[0].words[0].x,0);
 const last=p.pages.at(-1).rows.at(-1);
 assert.equal(last.paragraphEnd,true);
});

test('M3: cross-paragraph page filling avoids large empty region and never loses words',()=>{
 const w=words(Array.from({length:24},()=> 'word'));
 // Each 4 words occupy one 100px line: 4*20+3*5=95.
 // Three 2-row paragraphs; first page fits 4 rows and should not stop at 2.
 [7,15,23].forEach(i=>w[i].paragraphAfter=true);
 const s={...style,firstLineIndentCh:0,paragraphGap:0,textAlign:'justify'};
 const p=plan(w,45,100,s);
 assert.equal(p.pages.length,2);
 assert.ok(p.pages[0].rows.length>=3,`first page only ${p.pages[0].rows.length} rows`);
 assert.deepEqual(p.pages.flatMap(pg=>pg.rows.flatMap(r=>r.words.map(x=>x.id))),w.map(x=>x.id));
});
