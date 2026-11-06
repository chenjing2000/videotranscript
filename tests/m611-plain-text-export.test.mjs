import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {exportPlainText}=require('../.tmp-core/plain-text.js');
const word=(display,options={})=>({id:'s0w0',segmentId:'s0',original:display,display,start:1,end:2,hidden:false,breakParagraph:false,...options});

test('M6.11: exports visible word content verbatim, including odd punctuation and original case',()=>{
 assert.equal(exportPlainText([word('Hello'),word(','),word('WORLD'),word('!')]),'Hello , WORLD !');
});

test('M6.11: paragraphs are separated by exactly one empty CRLF line, no final newline',()=>{
 const result=exportPlainText([word('One'),word('two.',{breakParagraph:true}),word('Third'),word('line!',{breakParagraph:true})]);
 assert.equal(result,'One two.\r\n\r\nThird line!');
 assert.equal(result.includes('\n')&&result.replaceAll('\r\n','').includes('\n'),false);
});

test('M6.11: hidden words are excluded but their paragraph boundary remains visible',()=>{
 assert.equal(exportPlainText([word('Keep'),word('hidden',{hidden:true,breakParagraph:true}),word('this')]),'Keep\r\n\r\nthis');
 assert.equal(exportPlainText([word('invisible',{hidden:true})]),'');
 assert.equal(exportPlainText([word('hidden',{hidden:true,breakParagraph:true}),word('visible')]),'visible');
});

test('M6.11: handles Unicode as plaintext without markup or timestamps',()=>{
 assert.equal(exportPlainText([word('café'),word('中文'),word('00:01',{hidden:true})]),'café 中文');
});

test('M6.12: toolbar order is settings, import, save, text, MP4',()=>{
 const source=readFileSync('src/main.tsx','utf8');
 assert.match(source,/iconButton\('settings','设置',openSettings\).*iconButton\('import',.*iconButton\('save','保存工程 Ctrl\+S'.*iconButton\('text-export','导出正文 TXT',doExportText.*iconButton\('export','导出 MP4'/s);
 assert.match(source,/desktop\.postMessage\(\{kind:'export-text',text\}\)/);
 assert.match(source,/currentWords=updateWord\(words,active\.id,active\.text\)/);
 assert.match(source,/kind==='text-exported'\)notify\(data\.message\)/);
});

test('M6.12: Windows text export uses fixed, atomic UTF-8 without BOM CRLF path',()=>{
 const source=readFileSync('desktop/ReaderWindow.cs','utf8');
 assert.match(source,/case "export-text":\s*ExportPlainText/);
 assert.match(source,/stem \+ "\.article\.txt"/);
 assert.match(source,/Replace\("\\r\\n", "\\n"\)\.Replace\('\\r', '\\n'\)\.Replace\("\\n", "\\r\\n"\)/);
 assert.match(source,/AtomicWrite\(articlePath, windowsText\)/);
 assert.match(source,/new UTF8Encoding\(false\)/);
 assert.doesNotMatch(source,/new SaveFileDialog/);
 assert.doesNotMatch(source,/case "export-text":\s*SaveProject/);
});
