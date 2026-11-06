import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {parseTranscriptStudio, updateWord} = require('../.tmp-core/transcript.js');
const input = {
  language:'en', transcript_studio:{format:'transcript-studio',schemaVersion:2},
  segments:[{words:[{word:'person',start:0,end:0.4},{word:'talks',start:0.5,end:0.8}]}]
};

test('M6.15.7: pressing Enter without changing the word leaves the revision unchanged',()=>{
  const words=parseTranscriptStudio(input).words;
  assert.strictEqual(updateWord(words,'s0w0','person'),words,
    'commitEditing relies on array identity to decide whether to increment currentRevision');
});

test('M6.15.7: editing then restoring the original word is not a committed change',()=>{
  const words=parseTranscriptStudio(input).words;
  assert.strictEqual(updateWord(words,'s0w0','  person  '),words,
    'trimmed input equal to current display must preserve the array reference');
});

test('M6.15.7: a real edit returns new words and preserves source timestamps',()=>{
  const words=parseTranscriptStudio(input).words;
  const changed=updateWord(words,'s0w0','persons');
  assert.notStrictEqual(changed,words);
  assert.equal(changed[0].display,'persons');
  assert.equal(changed[0].start,words[0].start);
  assert.equal(words[0].display,'person');
  assert.strictEqual(changed[1],words[1]);
});

test('M6.15.7: CLI concurrent task caches are unique under the selected root',async()=>{
  const {createCliTaskCacheDir}=await import('../scripts/cli-cache.mjs');
  const parent=await mkdtemp(path.join(tmpdir(),'transcript-cli-cache-review-'));
  try{
    const cacheRoot=path.join(parent,'selected-cache');
    const [first,second]=await Promise.all([
      createCliTaskCacheDir(cacheRoot),createCliTaskCacheDir(cacheRoot)
    ]);
    assert.notEqual(first,second);
    assert.equal(path.dirname(first),cacheRoot);
    assert.equal(path.dirname(second),cacheRoot);
    assert.match(path.basename(first),/^job-/);
    assert.match(path.basename(second),/^job-/);
    assert.ok((await stat(first)).isDirectory());
    assert.ok((await stat(second)).isDirectory());
  }finally{
    await rm(parent,{recursive:true,force:true});
  }
});

test('M6.15.7: CLI feeds isolated directory to media, bundle and render locations',()=>{
  const script=readFileSync('scripts/export.mjs','utf8');
  assert.match(script,/cacheDir\s*=\s*await createCliTaskCacheDir\(cacheRoot\)/);
  assert.match(script,/path\.join\(cacheDir,'media'\)/);
  assert.match(script,/path\.join\(cacheDir,'bundle'\)/);
  assert.match(script,/path\.join\(cacheDir,'render-output\.mp4'\)/);
});

test('M6.15.7: render directory absence does not prevent temp cache cleanup',()=>{
  const cs=readFileSync('desktop/ReaderWindow.cs','utf8');
  const cleanup=cs.slice(cs.indexOf('private static void CleanupStaleProjectCache'),cs.indexOf('private static void TryDeleteFile'));
  assert.doesNotMatch(cleanup,/if\s*\(!Directory\.Exists\(renderRoot\)\)\s*return\s*;/);
  assert.match(cleanup,/if\s*\(Directory\.Exists\(renderRoot\)\)/);
  assert.match(cleanup,/if\s*\(Directory\.Exists\(tempRoot\)\)/);
  assert.match(cleanup,/File\.GetLastWriteTimeUtc\(file\)\s*<\s*cutoff/);
});


test('M6.15.7: desktop runtime bundles the new CLI cache helper',()=>{
  const project=readFileSync('desktop/TranscriptStudio.csproj','utf8');
  assert.match(project,/Include="\.\.\/scripts\/cli-cache\.mjs"\s+LogicalName="TSRUNTIME\/scripts\/cli-cache\.mjs"/);
});
