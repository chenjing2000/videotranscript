import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {assertEvrTranscript} from '../scripts/evr-contract.mjs';
const require=createRequire(import.meta.url);
const core=require('../.tmp-core/index.js');
const source=JSON.parse(readFileSync('fixtures/6 Minute English 01-seg1.evr-transcript.json','utf8'));
const raw=JSON.parse(readFileSync('fixtures/6 Minute English 01-seg1.json','utf8'));
const clone=x=>structuredClone(x);
function checkBoth(data){assertEvrTranscript(data);return core.parseWhisperX(data)}
function rejectBoth(data,pattern){assert.throws(()=>assertEvrTranscript(data),pattern);assert.throws(()=>core.parseWhisperX(data),pattern)}
test('M4: reader accepts canonical EVR v1, 200 anchor times untouched',()=>{
 const parsed=checkBoth(source);assert.equal(parsed.words.length,200);assert.deepEqual(parsed.words.map(w=>[w.start,w.end]),raw.segments.flatMap(s=>s.words.map(w=>[w.start,w.end])));
});
test('M4: reader rejects original raw WhisperX even if word timestamps valid',()=>rejectBoth(raw,/EVR|只接受|只支持/));
test('M4: all EVR keys must be present, correct version, English',()=>{
 const a=clone(source);delete a.evr.paragraphBreaksAfter;rejectBoth(a,/边界|paragraphBreaksAfter/);
 const b=clone(source);b.evr.schemaVersion=2;rejectBoth(b,/EVR/);
 const c=clone(source);c.language='fr';rejectBoth(c,/en|英语/);
});
test('M4: rejects dangling, unordered, duplicate, and terminal paragraph anchors',()=>{
 for(const seq of [['s99w0'],['s1w2','s0w0'],['s1w2','s1w2'],['s12w8']]){
  const copy=clone(source);copy.evr.paragraphBreaksAfter=seq;rejectBoth(copy,/边界/);
 }
});
test('M4: validates all word anchors, no skipping malformed entries',()=>{
 for(const field of ['start','end','word']){
  const copy=clone(source);copy.segments[4].words[1][field]=field==='word'?'two tokens':-2;
  rejectBoth(copy,/单词|锚点|时间/);
 }
 const unsorted=clone(source);unsorted.segments[1].words[0].start=-1;rejectBoth(unsorted,/时间/);
});
test('M4: word-level breaks inside a WhisperX segment and source display overrides',()=>{
 const modified=clone(source);modified.evr.paragraphBreaksAfter=['s4w9'];modified.evr.displayOverrides={'s4w9':'pet.'};
 const parsed=checkBoth(modified);assert.equal(parsed.words.find(w=>w.id==='s4w9').paragraphAfter,true);
 assert.equal(parsed.words.find(w=>w.id==='s4w9').display,'pet.');
 assert.equal(parsed.words.find(w=>w.id==='s4w9').original,'pet,');
 const restored=core.updateWord(parsed.words,'s4w9','pet,');
 const proj=core.createProject('lesson.mp4','lesson.evr-transcript.json',restored);
 assert.equal(proj.overrides['s4w9'].display,'pet,');
 assert.equal(core.applyOverrides(parsed,proj).words.find(w=>w.id==='s4w9').display,'pet,');
});
test('M4: invalid displayOverrides or rogue schema keys fail closed',()=>{
 const copy=clone(source);copy.evr.displayOverrides={'s4w0':'a different phrase'};rejectBoth(copy,/显示|覆盖/);
 const copy2=clone(source);copy2.evr.unknownField=1;rejectBoth(copy2,/字段/);
});
test('M4: semantic boundaries preserve source IDs when moving word-level paragraph positions',()=>{
 const c=clone(source);c.evr.paragraphBreaksAfter=['s3w2','s4w9','s8w20'];
 const parsed=checkBoth(c);
 assert.deepEqual(parsed.words.filter(x=>x.paragraphAfter).map(x=>x.id),c.evr.paragraphBreaksAfter);
 const p=core.saveProjectView(core.createProject('a.mp4','a.evr-transcript.json',parsed.words),parsed.words);
 assert.deepEqual(core.applyOverrides(parsed,p).words.map(w=>w.paragraphAfter),parsed.words.map(w=>w.paragraphAfter));
});

test('M4: legacy paragraph fields cannot coexist with authoritative EVR boundaries',()=>{
 const c=clone(source);c.segments[2].paragraph_start=true;rejectBoth(c,/段落|分段/);
 const d=clone(source);d.paragraphs=[{start_segment:0,end_segment:2}];rejectBoth(d,/paragraphs/);
});
