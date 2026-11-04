import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {settingsDialogRect}=require('../.tmp-core/settings-dialog-geometry.js');
const ui=readFileSync('src/main.tsx','utf8');
const css=readFileSync('src/style.css','utf8');

const eq=(actual,expected)=>assert.deepEqual(actual,expected);
test('M6.9: 384x500 centred initially with at least 16 DIP inset on each side',()=>{
 eq(settingsDialogRect(900,720),{x:258,y:110,width:384,height:500});
 eq(settingsDialogRect(800,532),{x:208,y:16,width:384,height:500});
});
test('M6.9: panel height shrinks and automatically returns to 500 without persistent resize',()=>{
 eq(settingsDialogRect(800,480),{x:208,y:16,width:384,height:448});
 eq(settingsDialogRect(800,720),{x:208,y:110,width:384,height:500});
});
test('M6.9: drag position clamps within 16-DIP viewport inset for both axes',()=>{
 eq(settingsDialogRect(800,720,{x:-200,y:-100}),{x:16,y:16,width:384,height:500});
 eq(settingsDialogRect(800,720,{x:9999,y:9999}),{x:400,y:204,width:384,height:500});
 eq(settingsDialogRect(800,480,{x:400,y:204}),{x:400,y:16,width:384,height:448});
});
test('M6.9: narrow viewport only shrinks outer panel and content can scroll horizontally',()=>{
 eq(settingsDialogRect(400,700),{x:16,y:100,width:368,height:500});
 assert.match(css,/\.settings-backdrop \.m65-settings\{min-width:350px\}/);
 assert.match(css,/\.settings-backdrop \.settings-body\{[^}]*overflow:auto/);
});
test('M6.9: only title can drag; close and outside-click preserve their actions',()=>{
 assert.match(ui,/onPointerDown=\{onSettingsPointerDown\} onPointerMove=\{onSettingsPointerMove\}/);
 assert.match(ui,/onPointerUp=\{onSettingsPointerEnd\} onPointerCancel=\{onSettingsPointerEnd\}/);
 assert.match(ui,/event\.target as HTMLElement\)\.closest\('button'\)/);
 assert.match(ui,/if\(e\.target===e\.currentTarget\)closeSettings\(\)/);
 assert.match(ui,/iconButton\('close','关闭设置',closeSettings\)/);
 assert.match(ui,/setSettingsPosition\(null\);setSettingsPreferredWidth\(null\);setSettingsOpen\(true\)/);
 assert.match(ui,/setSettingsPosition\(null\);setSettingsOpen\(false\)/);
});
test('M6.9: time font 12 DIP and visual offset 3 DIP without transport grid changes',()=>{
 assert.match(css,/\.transport-time\{font-size:12px;position:relative;top:3px;pointer-events:none\}/);
 assert.match(css,/grid-template-rows:18px 30px/);
});
