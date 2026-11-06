import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const app=readFileSync('src/main.tsx','utf8');
const host=readFileSync('desktop/ReaderWindow.cs','utf8');
const css=readFileSync('src/style.css','utf8');
const reactDialogExists=existsSync('src/ui/Dialog.tsx');
const wpfDialogExists=existsSync('desktop/UI/FluentDialog.cs');

test('M6.15.6: React unsaved marker derives from the single project edit state',()=>{
 assert.match(app,/hasUnsavedProjectChanges\(projectEditState\)/);
 assert.match(app,/projectEditStateRef/);
 assert.match(app,/setProjectDraftChanged/);
});

test('M6.15.6: native WPF title follows the same dirty-state message',()=>{
 assert.match(host,/hasUnsavedChanges\s*=\s*request\.GetProperty\("dirty"\)\.GetBoolean\(\);[\s\S]*UpdateWindowTitle\(\)/);
 assert.match(host,/Title\s*=\s*hasUnsavedChanges\s*\?\s*"Transcript Studio ●"\s*:\s*"Transcript Studio"/);
});

test('M6.15.6: subtitle import no longer uses browser-owned confirmation',()=>{
 assert.doesNotMatch(app,/window\.confirm\s*\(/);
 assert.match(app,/pendingImportFile/);
 assert.match(app,/放弃修改并打开/);
 assert.match(app,/打开其他字幕/);
 assert.match(app,/dismissOnBackdrop/);
});

test('M6.15.6: React dialogs share one shell and design tokens',()=>{
 assert.equal(reactDialogExists,true,'src/ui/Dialog.tsx must exist');
 if(reactDialogExists){
  const dialog=readFileSync('src/ui/Dialog.tsx','utf8');
  assert.match(dialog,/role="dialog"/);
  assert.match(dialog,/aria-modal="true"/);
  assert.match(dialog,/onEscape/);
  assert.match(dialog,/data-autofocus/);
  assert.match(dialog,/dismissOnBackdrop/);
  assert.match(dialog,/tabIndex=\{-1\}/);
  assert.match(dialog,/activeButton\?\.disabled/);
 }
 assert.match(app,/<Dialog/);
 assert.match(css,/--dialog-primary:\s*#0F6CBD/i);
 assert.match(css,/--dialog-danger:\s*#C42B1C/i);
 assert.match(css,/--dialog-radius:\s*10px/i);
});

test('M6.15.6: dependency dialog is rendered through the shared React shell',()=>{
 const start=app.indexOf('{dependencyDialog&&');
 const end=app.indexOf('{settingsOpen&&',start);
 const dependencyMarkup=app.slice(start,end);
 assert.match(dependencyMarkup,/<Dialog/);
 assert.match(dependencyMarkup,/视频导出环境准备/);
 assert.doesNotMatch(dependencyMarkup,/Transcript Studio · 环境准备/);
});

test('M6.15.6: WPF notices use one reusable Fluent dialog, not MessageBox or inline windows',()=>{
 assert.equal(wpfDialogExists,true,'desktop/UI/FluentDialog.cs must exist');
 assert.doesNotMatch(host,/MessageBox\.Show/);
 assert.match(host,/FluentDialog\.ShowConfirmation/);
 assert.match(host,/FluentDialog\.ShowMessage/);
});

test('M6.15.6: WPF confirmation safe action is default and destructive action is not default',()=>{
 assert.match(host,/FluentDialog\.ShowConfirmation\(\s*IsVisible\s*\?\s*this\s*:\s*null/);
 const helper=readFileSync('desktop/UI/FluentDialog.cs','utf8');
 assert.match(helper,/safeButton\.IsDefault\s*=\s*true/);
 assert.match(helper,/safeButton\.IsCancel\s*=\s*true/);
 assert.match(helper,/otherButton\.IsDefault\s*=\s*false/);
 assert.match(helper,/using Button = System\.Windows\.Controls\.Button/);
 assert.match(helper,/using Color = System\.Windows\.Media\.Color/);
 assert.match(helper,/\(Brush Background, Brush Foreground, Brush Border, Brush Hover\) style = kind switch/);
 assert.match(helper,/Background = style\.Background/);
 assert.match(helper,/button\.MouseEnter \+= \(_, _\) => button\.Background = style\.Hover/);
});

test('M6.15.6: deferred close explicitly discards DispatcherOperation to document fire-and-forget intent',()=>{
 assert.match(host,/_\s*=\s*Dispatcher\.BeginInvoke\(new Action\(Close\), DispatcherPriority\.Normal\)/);
});
