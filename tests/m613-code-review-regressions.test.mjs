import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {assertProjectForExport} from '../scripts/transcript-studio-contract.mjs';

const ui=readFileSync('src/main.tsx','utf8');
const reader=readFileSync('desktop/ReaderWindow.cs','utf8');
const media=readFileSync('desktop/LocalMediaServer.cs','utf8');
const exportScript=readFileSync('scripts/export.mjs','utf8');
const m1Capture=readFileSync('desktop/M1Capture.cs','utf8');

test('Code review: MP4 export commits the active word and snapshots a matching page plan',()=>{
 const start=ui.indexOf(' const doExport=()=>{');
 const end=ui.indexOf('\n const applyPair=',start);
 assert.ok(start>=0&&end>start);
 const body=ui.slice(start,end);
 assert.match(body,/updateWord\(words,active\.id,active\.text\)/);
 assert.match(body,/if\(!commitEditing\(\)\)return/);
 assert.match(body,/paginate\(exportWords,style,canvasWidth,canvasHeight-mediaHeight/);
 assert.match(body,/saveProjectView\(project,exportWords\)/);
 assert.match(body,/pagePlan:exportPlan/);
});

test('Code review: invalid incoming transcript clears the old visible pair',()=>{
 const start=ui.indexOf(' const applyPair=');
 const end=ui.indexOf('\n useEffect(()=>{const receive=',start);
 const body=ui.slice(start,end);
 assert.match(body,/setMediaUrl\(''\)/);
 assert.match(body,/setProject\(null\)/);
 assert.match(body,/setWords\(\[\]\)/);
 assert.match(body,/字幕读取失败/);
});

test('Code review: project file is read before the active media source is switched',()=>{
 const start=reader.indexOf('    private void OpenPair(');
 const end=reader.indexOf('\n    private Source CheckSource',start);
 const body=reader.slice(start,end);
 assert.ok(body.indexOf('File.ReadAllText(projectPath)')<body.indexOf('mediaServer ?? throw'));
 assert.ok(body.indexOf('mediaServer ?? throw')<body.indexOf('source = new Source'));
});

test('Code review: dependency preparation failures are distinct from render failures',()=>{
 const receiveCatch=reader.slice(reader.indexOf('        catch (Exception error)',reader.indexOf('private async void Receive')),reader.indexOf('\n    private async Task<bool> ConfirmDependencyAsync'));
 assert.doesNotMatch(receiveCatch,/dependency-failed/);
 const prepareStart=reader.indexOf('runtime = await PrepareExportRuntimeAsync');
 const prepareFailure=reader.indexOf('kind = "dependency-failed"',prepareStart);
 assert.ok(prepareStart>=0&&prepareFailure>prepareStart);
});

test('Code review: media response streams are disposed if response handoff fails',()=>{
 assert.match(media,/responseBody\?\.Dispose\(\);\s*file\?\.Dispose\(\);/);
 assert.match(media,/responseBody = null; \/\/ Ownership transferred to WebView2/);
});

test('Code review: standalone export checks saved project media kind',()=>{
 assert.match(exportScript,/if\(projectPath\)assertProjectForExport\(project,/);
});


test('Code review: direct export CLI rejects projects with bad source, media kind, style or overrides',()=>{
 const require=createRequire(import.meta.url),core=require('../.tmp-core/index.js');
 const subtitleName='6 Minute English 01-seg1.transcript-studio.json';
 const mediaName='6 Minute English 01-seg1.mp4';
 const bytes=readFileSync('fixtures/6 Minute English 01-seg1.transcript-studio.json');
 const transcript=JSON.parse(bytes.toString('utf8'));
 const words=core.parseTranscriptStudio(transcript).words;
 const project=core.createProject(mediaName,subtitleName,words);
 project.source.subtitleSha256=createHash('sha256').update(bytes).digest('hex');
 project.mediaKind='video';
 const context={mediaName,subtitleName,subtitleBytes:bytes,mediaKind:'video',transcript};
 assert.equal(assertProjectForExport(project,context),project);
 assert.throws(()=>assertProjectForExport(null,context),/project v2/i);
 assert.throws(()=>assertProjectForExport({...project,mediaKind:'audio'},context),/media kind/i);
 assert.throws(()=>assertProjectForExport({...project,source:{...project.source,subtitleSha256:'0'.repeat(64)}},context),/SHA256/);
 assert.throws(()=>assertProjectForExport({...project,style:{...project.style,fontSize:0}},context),/style/i);
 assert.throws(()=>assertProjectForExport({...project,overrides:{s999w999:{hidden:true}}},context),/override/i);
});

test('Code review: optional M1 evidence capture supports both video and audio-only preview',()=>{
 assert.match(m1Capture,/document\.querySelector\('video, audio'\)/);
});

test('Code review: invalid settings backups never overwrite an earlier backup',()=>{
 assert.match(reader,/settingsFile \+ \"\.invalid-\"[\s\S]*Guid\.NewGuid\(\)\.ToString\(\"N\"\)\[\.\.8\]/);
 assert.match(reader,/File\.Move\(settingsFile, backup\);/);
 assert.doesNotMatch(reader,/File\.Move\(settingsFile, backup, overwrite: true\)/);
});

test('Code review: local media endpoint is token-bound to one selected basename, not a folder mapping',()=>{
 assert.match(media,/var path = Path\.GetFullPath\(absoluteFilePath\)/);
 assert.match(media,/segments\.Length != 3/);
 assert.match(media,/!string\.Equals\(segments\[1\], selectedToken, StringComparison\.Ordinal\)/);
 assert.match(media,/Uri\.UnescapeDataString\(segments\[2\]\), Path\.GetFileName\(selectedPath\)/);
 assert.match(reader,/Directory\.EnumerateFiles\(folder, "\*", SearchOption\.TopDirectoryOnly\)/);
 assert.doesNotMatch(reader,/SetVirtualHostNameToFolderMapping\([^\n]*media/i);
});
