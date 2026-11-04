import test from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';const require=createRequire(import.meta.url);
const {selectCompanion,transcriptStem,validCanvas}=require('../.tmp-core/media.js');
test('JSON drives prioritized same-stem media discovery',()=>{
 const f='My Lesson.transcript-studio.json',files=['My Lesson.wav','My Lesson.mkv','My Lesson.mp3','My Lesson.mp4'];
 assert.equal(transcriptStem(f),'My Lesson');
 assert.deepEqual(selectCompanion(f,files),{name:'My Lesson.mp4',kind:'video'});
 assert.deepEqual(selectCompanion(f,files.slice(0,3)),{name:'My Lesson.mkv',kind:'video'});
 assert.deepEqual(selectCompanion(f,['My Lesson.WAV','My Lesson.MP3']),{name:'My Lesson.MP3',kind:'audio'});
 assert.equal(selectCompanion(f,['Other.mp4']),null);
 assert.throws(()=>transcriptStem('raw.json'));
});
test('Canvas accepts even pixels and rejects invalid export dimensions',()=>{
 assert.ok(validCanvas(1200,1600));assert.ok(validCanvas(1920,1080));
 for(const [w,h] of [[0,1600],[1201,1600],[1200,1601],[4000,1080],[640,200]])assert.equal(validCanvas(w,h),false);
});
