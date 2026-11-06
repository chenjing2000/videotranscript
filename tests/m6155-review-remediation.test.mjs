import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const wordEditing=require('../.tmp-core/word-editing.js');

const host=readFileSync('desktop/ReaderWindow.cs','utf8');
const app=readFileSync('src/main.tsx','utf8');

test('M6.15.5: cancelled dependency preparation always ends the dependency dialog',()=>{
 const cancelledAt=host.indexOf('task.Status = ExportStatus.Cancelled;');
 const cancelled=host.slice(host.lastIndexOf('catch (OperationCanceledException)',cancelledAt),
  host.indexOf('catch (Exception error)',cancelledAt));
 assert.match(cancelled,/Send\(\s*new\s*\{\s*kind\s*=\s*"dependency-end"/);
 assert.match(cancelled,/kind\s*=\s*"dependency-end"[\s\S]*kind\s*=\s*"status"[\s\S]*busy\s*=\s*false/);
 assert.match(app,/data\.kind==='dependency-end'\)setDependency\(null\)/);
});

test('M6.15.5: an edited but uncommitted word draft counts as unsaved',()=>{
 const words=[{id:'w1',display:'original'}];
 assert.equal(typeof wordEditing.hasUnsavedWordDraft,'function');
 assert.equal(wordEditing.hasUnsavedWordDraft(words,{id:'w1',text:'changed'}),true);
 assert.equal(wordEditing.hasUnsavedWordDraft(words,{id:'w1',text:'original'}),false);
 assert.equal(wordEditing.hasUnsavedWordDraft(words,null),false);
 assert.match(app,/setProjectDraftChanged\(projectEditStateRef\.current,hasUnsavedWordDraft\(wordsRef\.current,next\)\)/);
 assert.match(app,/kind:'dirty-state',dirty:/);
 assert.match(app,/setProjectDraftChanged\(projectEditStateRef\.current,hasUnsavedWordDraft\(wordsRef\.current,next\)\)/);
});

test('M6.15.5: importing another subtitle protects both committed edits and active drafts',()=>{
 assert.match(app,/hasUnsavedChanges\(\)/);
 assert.match(app,/当前字幕存在尚未保存的修改/);
 assert.match(app,/放弃修改并打开/);
});

test('M6.15.5: WPF close asks before discarding unsaved edits, including after export confirmation',()=>{
 assert.match(host,/kind == "dirty-state"/);
 assert.match(host,/hasUnsavedChanges/);
 assert.match(host,/ConfirmDiscardUnsavedChanges\(\)/);
 const close=host.slice(host.indexOf('private async void OnClosing'),host.indexOf('private bool ConfirmCancelExportAndExit'));
 assert.match(close,/ConfirmDiscardUnsavedChanges\(\)/);
 assert.match(close,/isCloseConfirmationOpen/);
 assert.match(host,/FluentDialog\.ShowConfirmation/);
 assert.doesNotMatch(host,/MessageBox\.Show/);
 const exportPrompt=close.indexOf('ConfirmCancelExportAndExit');
 const discardPrompt=close.indexOf('ConfirmDiscardUnsavedChanges');
 const cancelExport=close.indexOf('RequestCancel(shutdown: true)');
 assert.ok(exportPrompt<discardPrompt&&discardPrompt<cancelExport);
 assert.match(close,/_ = Dispatcher\.BeginInvoke\(new Action\(Close\), DispatcherPriority\.Normal\)/);
});

test('M6.15.5: an old save acknowledgement cannot clear dirty state after newer edits',()=>{
 const state=require('../.tmp-core/project-edit-state.js');
 let current=state.createProjectEditState();
 current=state.markProjectEdited(current);
 const savedRevision=current.currentRevision;
 current=state.markProjectEdited(current);
 current=state.acknowledgeProjectSave(current,savedRevision);
 assert.equal(state.hasUnsavedProjectChanges(current),true);
 assert.match(app,/revision=projectEditStateRef\.current\.currentRevision/);
 assert.match(app,/acknowledgeProjectSave\(projectEditStateRef\.current,data\.revision\)/);
 assert.match(app,/markProjectEdited\(projectEditStateRef\.current\)/);
 assert.match(app,/resetProjectEditState\(projectEditStateRef\.current\)/);
 assert.match(host,/SaveProject\(request\.GetProperty\("project"\), request\.GetProperty\("revision"\)\.GetInt64\(\)\)/);
 assert.match(host,/kind = "saved", revision/);
});

test('M6.15.5: settings persistence and dirty-state updates remain accepted during export',()=>{
 const receive=host.slice(host.indexOf('private async void Receive'),host.indexOf('private async Task<bool> ConfirmDependencyAsync'));
 assert.ok(receive.indexOf('kind == "settings-save"') < receive.indexOf('if (exporting) return;'));
 assert.ok(receive.indexOf('kind == "dirty-state"') < receive.indexOf('if (exporting) return;'));
 assert.ok(receive.indexOf('kind == "layout"') < receive.indexOf('if (exporting) return;'));
 assert.match(app,/const doSave=\(\)=>\{if\(exporting\)return notify\('视频导出期间暂不支持保存工程/);
 assert.match(host,/busy\s*=\s*exportTasks\.IsBusy, error\s*=\s*true/);
 assert.match(app,/if\(data\.error\)notify\(data\.message,true\)/);
});
