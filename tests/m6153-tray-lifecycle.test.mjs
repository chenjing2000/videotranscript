import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(path,'utf8');
const tray=read('desktop/AppLifecycle/TrayIconManager.cs');
const single=read('desktop/AppLifecycle/SingleInstanceManager.cs');
const host=read('desktop/ReaderWindow.cs');
const ui=read('src/main.tsx');
const css=read('src/style.css');

test('WinForms NotifyIcon callbacks defer WPF actions to the dispatcher',()=>{
 assert.match(tray,/MouseDoubleClick\s*\+=\s*OnMouseDoubleClick/);
 assert.match(tray,/MouseUp\s*\+=\s*OnMouseUp/);
 assert.match(tray,/QueueOnDispatcher\(ActivateExistingWindow\)/);
 assert.match(tray,/QueueOnDispatcher\(ShowMenu\)/);
});
test('tray menu uses a fixed 70 DIP width and content-sized height',()=>{
 const menu=tray.slice(tray.indexOf('private sealed class TrayMenuWindow'));
 assert.match(menu,/Width = 70;/);
 assert.match(menu,/MinWidth = 70;/);
 assert.match(menu,/MaxWidth = 70;/);
 assert.match(menu,/SizeToContent = SizeToContent\.Height;/);
});
test('tray menu invokes Open and Exit only after Closed has completed',()=>{
 const menu=tray.slice(tray.indexOf('private sealed class TrayMenuWindow'));
 assert.match(menu,/Closed \+=/);
 assert.match(menu,/Dispatcher\.BeginInvoke\(DispatcherPriority\.Background, new Action\(\(\) =>/);
 assert.match(menu,/CreateItem\("打开"/);
 assert.match(menu,/CreateItem\("退出"/);
});
test('the reader is the explicit WPF main window and only its close shuts down the app',()=>{
 assert.match(host,/ShutdownMode = ShutdownMode\.OnMainWindowClose/);
 assert.match(host,/application\.MainWindow = window/);
});
test('tray activation restores taskbar visibility and refuses activation during shutdown',()=>{
 const activation=host.slice(host.indexOf('internal void ActivateFromTray'),host.indexOf('private static void DisposeSafely'));
 assert.match(activation,/if \(isShuttingDown/);
 assert.match(activation,/ShowInTaskbar = true/);
 assert.match(activation,/if \(!IsVisible\)\s*Show\(\)/);
 assert.match(activation,/WindowState = WindowState\.Normal/);
 assert.match(activation,/Activate\(\)/);
 assert.match(activation,/Topmost = true/);
 assert.match(activation,/Topmost = wasTopmost/);
 assert.doesNotMatch(host,/SetForegroundWindow|DllImport\("user32\.dll"\)/);
});
test('minimizing to tray is guarded against re-entrant state changes',()=>{
 assert.match(host,/isMinimizingToTray/);
 assert.match(host,/WindowState = WindowState\.Normal;\s*ShowInTaskbar = false;\s*Hide\(\)/);
});
test('single-instance listener is cancelled and joined without a fixed two-second wait',()=>{
 assert.match(single,/stop\.Cancel\(\)/);
 assert.match(single,/listener\?\.GetAwaiter\(\)\.GetResult\(\)/);
 assert.doesNotMatch(single,/listener\?\.Wait\(TimeSpan\.FromSeconds\(2\)\)/);
});
test('a repeated close request cannot bypass the pending export shutdown wait',()=>{
 const closing=host.slice(host.indexOf('private async void OnClosing'),host.indexOf('private bool ConfirmCancelExportAndExit'));
 assert.match(closing,/if \(isShuttingDown\)[\s\S]*?if \(exportTasks\.IsBusy\) args\.Cancel = true/);
 assert.match(closing,/isCloseConfirmationOpen/);
 assert.match(closing,/while \(exportTasks\.IsBusy\)[\s\S]*?Close\(\)/);
});
test('tray-originated close confirmation remains visible while the main window is hidden',()=>{
 assert.match(host,/FluentDialog\.ShowConfirmation\([\s\S]*?mainWindowVisible \? this : null/);
 assert.match(host,/WindowStartupLocation\.CenterScreen/);
 assert.match(readFileSync('desktop/UI/FluentDialog.cs','utf8'),/ShowInTaskbar = false/);
});
test('export cancel action is horizontal, right aligned, and uses the shorter label',()=>{
 assert.match(ui,/<button[^>]*>取消<\/button>/);
 assert.match(ui,/cancelable\?:boolean/);
 assert.match(ui,/data\.canCancel!==false/);
 assert.match(css,/\.notice-task\{align-items:center\}/);
 assert.match(css,/\.notice-task \.notice-content\{flex:1\}/);
 assert.match(css,/\.notice button\.notice-cancel-export\{[^}]*font-size:13px/);
 assert.match(css,/\.notice button\.notice-cancel-export\{[^}]*width:auto/);
 assert.match(css,/\.notice button\.notice-cancel-export\{[^}]*height:30px/);
 assert.match(css,/\.notice button\.notice-cancel-export\{[^}]*margin-left:auto/);
});
test('queued render progress cannot re-enable Cancel after cancellation starts',()=>{
 assert.match(host,/canCancel = task\.Status != ExportStatus\.Cancelling && task\.Status != ExportStatus\.Committing/);
});
test('the MP4 commit phase explicitly disables cancellation in the notice',()=>{
 const commit=host.slice(host.indexOf('task.Status = ExportStatus.Committing'),host.indexOf('committed = true;',host.indexOf('task.Status = ExportStatus.Committing')));
 assert.match(commit,/canCancel = false/);
});
test('lightweight local lifecycle logging is used without a third-party logger',()=>{
 const log=read('desktop/AppLifecycle/AppLog.cs');
 assert.match(log,/"TranscriptStudio", "logs"/);
 assert.match(host,/DispatcherUnhandledException/);
 assert.match(tray,/AppLog\.Write/);
 assert.match(single,/AppLog\.Write/);
});
