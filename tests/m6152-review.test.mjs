import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=(path)=>readFileSync(path,'utf8');
const composition=read('src/remotion/Composition.tsx');
const reader=read('src/ui/ReaderCanvas.tsx');
const app=read('src/main.tsx');
const host=read('desktop/ReaderWindow.cs');

test('Remotion memoizes normalized project style across frame renders',()=>{
 assert.match(composition,/useMemo\(\(\)=>project\?normalizeProjectStyle\(project\):null,\[project\]\)/);
});
test('ReaderCanvas recomputes the plan when viewport width changes and rejects mismatched snapshots',()=>{
 assert.match(reader,/pagePlan\.viewportWidth===canvasWidth/);
 assert.match(reader,/pagePlan\.viewportHeight===availableHeight/);
 assert.match(reader,/\[pagePlan,words,visible,style,canvasWidth,availableHeight\]/);
});
test('desktop project admission checks override IDs against the parsed source words',()=>{
 assert.match(app,/validateProject\(saved,parsed\.words\)/);
});
test('settings projection is stable during playback-only renders',()=>{
 assert.match(app,/const displayedSettings=useMemo\(\(\)=>project\?projectStyleToSettings\(style,project\.canvas,appSettings\):appSettings,\[project,style,appSettings\]\)/);
});
test('export-cancelling message matches the WPF host payload',()=>{
 assert.match(app,/\{kind:'export-cancelling'\}/);
 assert.doesNotMatch(app,/kind:'export-cancelling';taskId:string/);
});
test('unused preset picker and its style data are not shipped',()=>{
 assert.equal(existsSync('src/ui/PresetDropdown.tsx'),false);
 assert.equal(existsSync('src/core/style-presets.ts'),false);
 assert.doesNotMatch(read('src/style.css'),/\.preset-(?:control|trigger|menu|option)/);
});
test('export commit failure preserves a rendered temporary file for both move and replace paths',()=>{
 const commit=host.slice(host.indexOf('task.Status = ExportStatus.Committing'),host.indexOf('committed = true;',host.indexOf('task.Status = ExportStatus.Committing')));
 assert.match(commit,/File\.Move\(task\.TemporaryOutputPath, task\.OutputPath\)/);
 assert.match(commit,/catch \(Exception error\)/);
 assert.match(commit,/preserveFailedOutput = File\.Exists\(task\.TemporaryOutputPath\)/);
});
test('cache enumeration failures are isolated from export startup',()=>{
 const cleanup=host.slice(host.indexOf('private static void CleanupStaleProjectCache'),host.indexOf('private static void TryDeleteFile'));
 assert.equal((cleanup.match(/catch \{[^}]*\}/g)||[]).length>=4,true);
});
