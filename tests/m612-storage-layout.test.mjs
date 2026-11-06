import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transcriptStem} from '../.tmp-core/media.js';
const cs=readFileSync('desktop/ReaderWindow.cs','utf8');
const ui=readFileSync('src/main.tsx','utf8');

test('M6.12: exact JSON suffix becomes shared work-folder and both output names',()=>{
 assert.equal(transcriptStem('lesson01.transcript-studio.json'),'lesson01');
 assert.equal(transcriptStem('My Lesson.TRANSCRIPT-STUDIO.JSON'),'My Lesson');
 assert.throws(()=>transcriptStem('lesson01.json'));
 assert.match(cs,/var workFolder = Path.Combine\(folder, stem\)/);
 assert.match(cs,/var projectPath = Path.Combine\(workFolder, stem \+ "\.project\.json"\)/);
 assert.match(cs,/var articlePath = Path.Combine\(workFolder, stem \+ "\.article\.txt"\)/);
});
test('M6.12: legacy path is not searched or migrated and schema stays v2',()=>{
 assert.doesNotMatch(cs,/"\.transcript-studio", "projects"/);
 assert.doesNotMatch(cs,/project\.settings\.json/);
 assert.match(cs,/schema\.GetInt32\(\) != 2/);
 assert.match(ui,/saveProjectView\(project,currentWords\)/);
 assert.match(ui,/a\.download=transcriptStem\(project\.source\.subtitleName\)\+'\.project\.json'/);
 assert.match(ui,/transcriptStem\(project\.source\.subtitleName\)\+'\.article\.txt'/);
});
test('M6.12: existing corrupt project cannot be silently overwritten',()=>{
 assert.match(cs,/projectSaveLocked = projectContent != null/);
 assert.match(cs,/case "project-validated":/);
 assert.match(cs,/if \(projectSaveLocked\)/);
 assert.match(ui,/setProjectLoadBlocked\(blocked\)/);
 assert.match(ui,/kind:'project-validated',fingerprint:data\.fingerprint,subtitleName:data\.subtitleName/);
 assert.match(ui,/projectLoadBlocked\)return notify/);
 assert.match(ui,/保存工程 Ctrl\+S',doSave,!project\|\|exporting\|\|projectLoadBlocked/);
});
test('M6.12: saves only on demand and does not create empty directory on import',()=>{
 const open=cs.slice(cs.indexOf('private void OpenPair'),cs.indexOf('private Source CheckSource'));
 assert.doesNotMatch(open,/Directory\.CreateDirectory/);
 assert.match(cs,/private static void AtomicWrite/);
 assert.match(cs,/File\.Move\(temp, file, overwrite: true\)/);
 assert.match(cs,/AtomicWrite\(current\.Project, project\.GetRawText\(\)\)/);
 assert.match(cs,/AtomicWrite\(articlePath, windowsText\)/);
});
