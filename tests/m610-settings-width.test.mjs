import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {nextSettingsWidth,requiredSettingsOuterWidth,settingsDialogRect}=require('../.tmp-core/settings-dialog-geometry.js');
const ui=readFileSync('src/main.tsx','utf8');
const css=readFileSync('src/style.css','utf8');
test('M6.10 strict next multiple of ten (even when already a multiple)',()=>{
 for(const [measured,expected] of [[384,390],[394,400],[400,410],[409,410],[412,420],[427,430]]){
  assert.equal(nextSettingsWidth(measured),expected);
 }
 assert.throws(()=>nextSettingsWidth(Number.NaN),RangeError);
});
test('M6.10 outer width includes left/right padding and vertical scrollbar',()=>{
 assert.equal(requiredSettingsOuterWidth(350,17,17,17),401);
 assert.equal(nextSettingsWidth(requiredSettingsOuterWidth(350,17,17,17)),410);
});
test('M6.10 measured width is used by geometry while keeping 16 DIP insets',()=>{
 assert.deepEqual(settingsDialogRect(900,720,null,410),{x:245,y:110,width:410,height:500});
 assert.deepEqual(settingsDialogRect(420,720,null,410),{x:16,y:110,width:388,height:500});
 assert.deepEqual(settingsDialogRect(900,720,{x:9999,y:-100},410),{x:474,y:16,width:410,height:500});
});
test('M6.10 layout effect measures content once on opening and freezes during ordinary editing',()=>{
 assert.match(ui,/useLayoutEffect\(\(\)=>\{\s*if\(!settingsOpen\|\|settingsPreferredWidth!==null\)return;/);
 assert.match(ui,/content\.scrollWidth,content\.getBoundingClientRect\(\)\.width/);
 assert.match(ui,/body\.offsetWidth-body\.clientWidth/);
 assert.match(ui,/nextSettingsWidth\(required\)/);
 assert.match(ui,/setSettingsPreferredWidth\(null\);setSettingsOpen\(true\)/);
 assert.match(ui,/ref=\{settingsBodyRef\}/);
});
test('M6.10 preserves inner grid and independent scrolling',()=>{
 assert.match(css,/grid-template-columns:64px 126px 64px 96px/);
 assert.match(css,/\.settings-backdrop \.settings-body\{[^}]*overflow:auto/);
 assert.match(css,/\.settings-backdrop \.m65-settings\{min-width:350px\}/);
});
