import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateWordEditorWidth,paragraphActionLabel} from '../.tmp-core/word-editing.js';
import {parseTranscriptStudio,updateWord,buildOverrides,applyOverrides} from '../.tmp-core/transcript.js';

test('M6.6 editor width includes safety padding, has a minimum, and grows until available width',()=>{
 assert.equal(calculateWordEditorWidth(0,300),24);
 assert.equal(calculateWordEditorWidth(35.2,300),48);
 assert.equal(calculateWordEditorWidth(63.1,300),76);
 assert.equal(calculateWordEditorWidth(900,200),200);
 assert.equal(calculateWordEditorWidth(0,20),24);
});
test('M6.6 paragraph button label reflects current effective break',()=>{
 assert.equal(paragraphActionLabel(false),'插入分段');
 assert.equal(paragraphActionLabel(true),'取消分段');
});
test('M6.6 removing a source paragraph break survives project overrides',()=>{
 const input={language:'en',transcript_studio:{format:'transcript-studio',schemaVersion:2},segments:[{words:[{word:'First',start:1,end:1.4,breakParagraph:true},{word:'Second',start:1.5,end:1.8}]}]};
 const parsed=parseTranscriptStudio(input);
 const changed=parsed.words.map((w,i)=>i===0?{...w,breakParagraph:false}:w);
 const overrides=buildOverrides(changed);
 assert.equal(overrides.s0w0.breakParagraph,false);
 assert.equal(applyOverrides(parsed,{overrides}).words[0].breakParagraph,false);
 assert.equal(parsed.words[0].breakParagraph,true);
});
test('M6.6 editing never mutates original timestamps and rejects multiple words',()=>{
 const input={language:'en',transcript_studio:{format:'transcript-studio',schemaVersion:2},segments:[{words:[{word:'person',start:4.036,end:4.057},{word:'talks',start:4.06,end:4.2}]}]};
 const parsed=parseTranscriptStudio(input);const result=updateWord(parsed.words,'s0w0','persons');
 assert.equal(result[0].display,'persons');
 assert.equal(result[0].start,4.036);assert.equal(result[0].end,4.057);
 assert.equal(parsed.words[0].display,'person');
 assert.throws(()=>updateWord(parsed.words,'s0w0','two words'));
});
test('M6.6 editor CSS keeps 1-DIP focus border and 4-DIP rounded corners; toolbar has only two actions',()=>{
 const css=readFileSync('src/style.css','utf8');
 const main=readFileSync('src/main.tsx','utf8');
 assert.match(css,/\.transcript \.word-edit:focus[^\{]*\{[^}]*border:1px solid #ab1d22/s);
 assert.match(css,/\.transcript \.word-edit\{[^}]*border-radius:4px/s);
 assert.match(css,/\.word-tools-actions\{[^}]*gap:6px/s);
 assert.match(main,/paragraphActionLabel\(wordTool\.breakParagraph\)/);
 assert.doesNotMatch(main,/>切换段落</);
 assert.doesNotMatch(main,/>隐藏</);
 assert.doesNotMatch(main,/>恢复</);
});
