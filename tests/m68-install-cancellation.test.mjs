import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const host=readFileSync('desktop/ReaderWindow.cs','utf8');
const ui=readFileSync('src/main.tsx','utf8');

test('M6.8: cancellation messages are accepted during export and target only dependency installation',()=>{
 assert.match(host,/if \(kind == "dependency-cancel"\)/);
 assert.ok(host.indexOf('kind == "dependency-cancel"') < host.indexOf('if (exporting) return;'));
 assert.match(host,/dependencyInstallCancellation is \{ IsCancellationRequested: false \}/);
 assert.match(host,/active\.Cancel\(\)/);
 assert.match(host,/PrepareExportRuntimeAsync\(installCancellation\.Token\)/);
 assert.match(host,/dependencyInstallCancellation = null;/);
});

test('M6.8: npm and browser preparation share a cancellation token and kill only the subprocess tree',()=>{
 assert.match(host,/RunDependencyCommandAsync\("npm\.cmd"[^;]*cancellationToken:cancellationToken\)/);
 assert.match(host,/RunDependencyCommandAsync\("node\.exe",runtime,\["scripts\/ensure-browser\.mjs"\][^;]*cancellationToken:cancellationToken\)/);
 assert.match(host,/CancellationTokenSource\.CreateLinkedTokenSource\(timeout\.Token,cancellationToken\)/);
 assert.match(host,/process\.Kill\(entireProcessTree:true\)/);
 assert.match(host,/await process\.WaitForExitAsync\(\)/);
 assert.match(host,/cancellationToken\.ThrowIfCancellationRequested\(\)/);
 assert.match(host,/finally\s*\{\s*if\(Directory\.Exists\(staging\)\)Directory\.Delete\(staging,recursive:true\);/);
});

test('M6.8: progress dialog has an actionable cancel button, cancellING state, and stops double cancellation',()=>{
 assert.match(ui,/desktop\?\.postMessage\(\{kind:'dependency-cancel'\}\)/);
 assert.match(ui,/mode:'cancelling'/);
 assert.match(ui,/dependencyDialog\.mode==='progress'\?<button[^>]+onClick=\{cancelDependencyInstall\}>取消安装<\/button>/);
 assert.match(ui,/dependencyDialog\.mode==='cancelling'\?<button[^>]+disabled>正在取消…<\/button>/);
 assert.match(ui,/dependency-cancelling/);
 assert.match(ui,/dependencyDialog\.mode==='progress'\)\{e\.preventDefault\(\);cancelDependencyInstall\(\)/);
});
