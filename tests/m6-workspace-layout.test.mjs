import test from 'node:test';
import assert from 'node:assert/strict';
import {getWorkspaceLayout,WORKSPACE} from '../.tmp-core/workspace-layout.js';
const eps=1e-7;
test('frame is exactly six wider, 3-DIP top and bottom padding, transport directly beneath preview',()=>{
 const a=getWorkspaceLayout(1200,900,1200,1600);
 assert.equal(a.frameWidth-a.previewWidth,6);
 assert.ok(Math.abs(a.frameHeight-a.previewHeight-48-6)<eps);
 assert.equal(a.minimumClientWidth,638);
 assert.ok(a.editorWidth>=240);
});
test('wider window gives remaining width to editor when height limits the preview',()=>{
 const a=getWorkspaceLayout(1050,780,1200,1600), b=getWorkspaceLayout(1350,780,1200,1600);
 assert.equal(a.previewWidth,b.previewWidth);
 assert.equal(b.editorWidth-a.editorWidth,300);
});
test('resize keeps exact output aspect ratio and minimum widths',()=>{
 for (const [w,h] of [[1200,1600],[1920,1080],[1080,1920]]) {
  const min=getWorkspaceLayout(638,10000,w,h);
  assert.equal(min.previewWidth,360);
  assert.equal(min.editorWidth,240);
  for (const [cw,ch] of [[900,720],[1500,1100],[638,Math.ceil(min.minimumClientHeight)]]) {
   const a=getWorkspaceLayout(cw,ch,w,h);
   assert.ok(Math.abs(a.previewHeight/a.previewWidth-h/w)<eps);
   assert.ok(a.previewWidth>=360);
   assert.ok(a.editorWidth>=240);
  }
 }
});
test('not enough client height is detectable, for native min-window clamp',()=>{
 const a=getWorkspaceLayout(800,400,1080,1920);
 assert.equal(a.fits,false);
 assert.ok(a.minimumClientHeight>400);
});
