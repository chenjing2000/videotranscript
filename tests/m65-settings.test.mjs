import test from 'node:test';
import assert from 'node:assert/strict';
import * as settings from '../.tmp-core/app-settings.js';
import {paginate} from '../.tmp-core/pagination.js';
test('M6.5: default settings match the specification',()=>{
 const s=settings.DEFAULT_SETTINGS;assert.equal(s.leftFont.size,40);assert.equal(s.rightFont.size,16);
 assert.equal(s.paragraph.firstLineIndentEm,2);assert.equal(s.page.paddingX,36);
 assert.equal(s.page.paddingY,30);assert.equal(s.page.backgroundColor,'#F7F4EC');
 assert.equal(s.output.width,1200);assert.equal(s.output.height,1600);
 assert.equal(settings.validateSettings(s),true);
});
test('M6.5: right font is independent of video style',()=>{
 const s={...settings.DEFAULT_SETTINGS,rightFont:{...settings.DEFAULT_SETTINGS.rightFont,size:23}};
 assert.deepEqual(settings.settingsToStyle(s),settings.settingsToStyle(settings.DEFAULT_SETTINGS));
});
test('M6.5: rejects malformed values and output dimensions',()=>{
 for(const mutation of [
  {leftFont:{...settings.DEFAULT_SETTINGS.leftFont,size:100}},
  {rightFont:{...settings.DEFAULT_SETTINGS.rightFont,color:'#ZZZZZZ'}},
  {paragraph:{...settings.DEFAULT_SETTINGS.paragraph,firstLineIndentEm:10}},
  {output:{width:1201,height:1600}},
  {page:{...settings.DEFAULT_SETTINGS.page,paddingX:-1}},
 ])assert.equal(settings.validateSettings({...settings.DEFAULT_SETTINGS,...mutation}),false);
});
test('M6.5: new style uses em indentation rather than ch',()=>{
 const s=settings.settingsToStyle(settings.DEFAULT_SETTINGS);
 assert.equal(s.firstLineIndentEm,2);assert.equal(s.firstLineIndentCh,undefined);
});

test('M6.15.8: legacy settings format is not accepted as the current format',()=>{
 const legacy={...settings.DEFAULT_SETTINGS,format:'voicetranscript-settings'};
 assert.equal(settings.validateSettings(legacy),false);
});
