import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync('src/main.tsx','utf8');
const css=readFileSync('src/style.css','utf8');

test('M6.13: export preparation is no longer rendered inside transcript flow',()=>{
 assert.doesNotMatch(ui,/exportStatus|setExportStatus|className="export-status"/);
 assert.match(ui,/setExportTaskNotice\('正在准备导出…'\)/);
});

test('M6.13: host busy updates reuse one persistent task notice and completion clears it',()=>{
 assert.match(ui,/const setExportTaskNotice=\(text:string,cancelable=true\)=>/);
 assert.match(ui,/const clearExportTaskNotice=\(\)=>/);
 assert.match(ui,/if\(data\.busy\)\{if\(data\.error\)notify\(data\.message,true\);else setExportTaskNotice\(data\.message,data\.canCancel!==false\)\}else\{clearExportTaskNotice\(\)/);
 assert.match(ui,/task\?:boolean;cancelable\?:boolean/);
 assert.match(ui,/n\.error\|\|n\.task\|\|notices\.slice\(-3\)\.includes\(n\)/);
});

test('M6.13: active task toast shares the normal notice stack without a dismiss button',()=>{
 assert.match(ui,/<div className="aside-floats">[\s\S]*?<div className="notices"[\s\S]*?notice-task[\s\S]*?!n\.task[\s\S]*?<div className=\{`word-tools/);
 assert.match(ui,/<span className="notice-spinner" aria-hidden="true"\/>/);
});

test('M6.13: floating notices stack above the word toolbar and stay out of transcript layout',()=>{
 assert.match(css,/\.aside-floats\{[\s\S]*?position:absolute/);
 assert.match(css,/\.aside-floats \.notices\{[\s\S]*?position:static/);
 assert.match(css,/\.aside-floats \.word-tools\{[\s\S]*?position:relative/);
 assert.match(css,/@keyframes notice-spin/);
});
