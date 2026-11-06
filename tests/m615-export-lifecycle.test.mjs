import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const host=readFileSync('desktop/ReaderWindow.cs','utf8');
const task=readFileSync('desktop/Export/ExportTask.cs','utf8');
const manager=readFileSync('desktop/Export/ExportTaskManager.cs','utf8');
const processManager=readFileSync('desktop/Export/ExportProcessManager.cs','utf8');
const script=readFileSync('scripts/export.mjs','utf8');
const ui=readFileSync('src/main.tsx','utf8');
const tray=readFileSync('desktop/AppLifecycle/TrayIconManager.cs','utf8');

test('M6.15 derives final output from project JSON sibling directory',()=>{
 assert.match(host,/Path\.GetFullPath\(current\.Project\)/);
 assert.match(host,/stem \+ "\.exported\.mp4"/);
 assert.doesNotMatch(host,/Path\.Combine\(Path\.GetDirectoryName\(current\.Media\)!, "exports"\)/);
});

test('M6.15 task IDs isolate cache and .mp4.tmp output',()=>{
 assert.match(task,/Guid\.NewGuid\(\)\.ToString\("N"\)/);
 assert.match(host,/cacheRoot, "render", "job-" \+ id/);
 assert.match(host,/exported-\{id\}\.mp4\.tmp/);
 assert.match(host,/project-snapshot-\{task\.Id\}\.json\.tmp/);
});

test('M6.15 cancellation terminates the owned process tree and waits for exit',()=>{
 assert.match(processManager,/Kill\(entireProcessTree: true\)/);
 assert.match(processManager,/WaitForExitAsync\(\)/);
 assert.match(manager,/Cancellation\.Cancel\(\)/);
});

test('M6.15 final output is validated before replacement and failed commit preserves temp output',()=>{
 assert.match(host,/ExportStatus\.Validating/);
 assert.match(host,/File\.Replace\(/);
 assert.match(host,/preserveFailedOutput = File\.Exists\(task\.TemporaryOutputPath\)/);
 assert.match(host,/原有正式视频已保留/);
 assert.match(host,/File\.Move\(task\.TemporaryOutputPath, task\.OutputPath\)/);
});

test('M6.15 close confirmation uses the agreed button wording and waits for task completion',()=>{
 assert.match(host,/取消导出并退出/);
 assert.match(host,/while \(exportTasks\.IsBusy\)/);
});

test('M6.15 progress notice exposes a cancel-export action without exiting the app',()=>{
 assert.match(ui,/kind:'export-cancel'/);
 assert.match(ui,/<button[^>]*>取消<\/button>/);
});

test('M6.15 tray menu no longer enforces a minimum width',()=>{
 assert.doesNotMatch(tray,/MinWidth = 100/);
});

test('M6.15 validation does not depend on an external ffprobe executable',()=>{
 assert.match(host,/IsStructurallyValidMp4\(task\.TemporaryOutputPath\)/);
 assert.doesNotMatch(host,/RunDependencyCommandAsync\("ffprobe\.exe"/);
});

test('M6.15 disables NuGet vulnerability feed auditing for this personal desktop app',()=>{
 const project=readFileSync('desktop/TranscriptStudio.csproj','utf8');
 assert.match(project,/<NuGetAudit>false<\/NuGetAudit>/);
});

test('M6.15 uses one cancellation source for preparation and rendering',()=>{
 assert.match(host,/dependencyInstallCancellation = task\.Cancellation/);
 assert.match(host,/var token = task\.Cancellation\.Token/);
 assert.doesNotMatch(host,/CreateLinkedTokenSource\(task\.Cancellation\.Token\)/);
});

test('M6.15.1 close confirmation handler is registered exactly once',()=>{
 assert.match(host,/Closing\s*\+=\s*OnClosing\s*;/);
 assert.doesNotMatch(host,/Closing\s*\+=\s*\(\s*_/);
});

test('M6.15 close confirmation describes a non-cancellable commit accurately',()=>{
 assert.match(host,/ConfirmCancelExportAndExit\(isCommitting, wasVisible\)/);
 assert.match(host,/当前视频正在保存，无法中断/);
 assert.match(host,/保存完成后退出/);
});

test('MP4 validator does not catch EndOfStreamException after its IOException base type',()=>{
 const validator=host.slice(host.indexOf('private static bool IsStructurallyValidMp4'), host.indexOf('private static uint ReadUInt32BigEndian'));
 assert.match(validator,/catch \(IOException\)/);
 assert.doesNotMatch(validator,/catch \(EndOfStreamException\)/);
});
