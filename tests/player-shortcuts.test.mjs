import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {resolvePlayerShortcut}=require('../.tmp-core/index.js');
const cases=[
 [' ',false,'toggle'],['x',false,'stop'],['F',false,'next-frame'],['D',false,'previous-frame'],
 ['ArrowRight',false,'forward-10'],['ArrowLeft',false,'backward-10'],
 ['ArrowRight',true,'forward-30'],['ArrowLeft',true,'backward-30'],
 ['z',false,'normal-speed'],['ArrowUp',false,'volume-up'],['ArrowDown',false,'volume-down'],
 ['m',false,'mute'],['o',true,'open-file'],['s',true,'save']
];
for(const [key,ctrl,expected] of cases){
 test(`Shortcut ${ctrl?'Ctrl+':''}${key} -> ${expected}`,()=>assert.equal(resolvePlayerShortcut(key,ctrl),expected));
}
test('Unmapped keys and shifted combinations are ignored',()=>{
 assert.equal(resolvePlayerShortcut('q'),null);
 assert.equal(resolvePlayerShortcut('f',false,true),null);
 assert.equal(resolvePlayerShortcut('x',true),null);
 assert.equal(resolvePlayerShortcut('f',true),null, 'Ctrl+F should remain available for native find');
});
