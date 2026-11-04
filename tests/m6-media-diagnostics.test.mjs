import test from 'node:test';
import assert from 'node:assert/strict';
import {previewEditorFontSize,provisionalVideoHeight,describeMediaError,missingCompanionMessage} from '../.tmp-core/media-diagnostics.js';
test('editor uses preview screen pixels, not MP4 logical font pixels',()=>{
 assert.equal(previewEditorFontSize(40,420,1200),14);
 assert.equal(previewEditorFontSize(36,600,1200),18);
 assert.throws(()=>previewEditorFontSize(36,0,1200));
});
test('video mode always reserves a visible slot until metadata arrives',()=>{
 assert.equal(provisionalVideoHeight(1200,1600,null),675);
 assert.equal(provisionalVideoHeight(1200,1600,0.75),900);
});
test('media errors are distinguishable and file candidates are shown',()=>{
 assert.match(describeMediaError(4),/不支持/);
 assert.match(describeMediaError(3),/解码/);
 const message=missingCompanionMessage('Episode A');
 for(const ext of ['mp4','mkv','mp3','wav'])assert.ok(message.includes(`Episode A.${ext}`));
});
