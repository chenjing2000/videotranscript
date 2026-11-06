import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const host = readFileSync('desktop/ReaderWindow.cs', 'utf8');
const single = readFileSync('desktop/AppLifecycle/SingleInstanceManager.cs', 'utf8');
const tray = readFileSync('desktop/AppLifecycle/TrayIconManager.cs', 'utf8');
const project = readFileSync('desktop/TranscriptStudio.csproj', 'utf8');

test('M6.14: application acquires single-instance ownership before creating the WPF window', () => {
  assert.match(host, /new SingleInstanceManager\(\)/);
  assert.match(host, /TryBecomePrimaryOrActivate\(\)/);
  assert.ok(host.indexOf('TryBecomePrimaryOrActivate()') < host.indexOf('new ReaderWindow()'));
  assert.match(single, /Mutex\(/);
  assert.match(single, /NamedPipeClientStream/);
  assert.match(single, /NamedPipeServerStream/);
});

test('M6.14: secondary launch forwards activation and does not create another window', () => {
  assert.match(single, /WriteLine\("ACTIVATE"\)/);
  assert.match(host, /StartListening\(/);
  assert.match(host, /ActivateFromTray/);
});

test('M6.14: minimizing hides the window without closing the WebView2 instance', () => {
  assert.match(host, /WindowState != WindowState\.Minimized/);
  assert.match(host, /ShowInTaskbar = false/);
  assert.match(host, /Hide\(\)/);
  assert.match(host, /DisposeSafely\("WebView2", view\.Dispose\)/);
});

test('M6.14 current tray retains the WPF menu while NotifyIcon owns the tray icon', () => {
  assert.match(tray, /Forms\.NotifyIcon/);
  assert.match(tray, /CreateItem\("打开"/);
  assert.match(tray, /CreateItem\("退出"/);
  assert.match(tray, /#FFFBC7/);
  assert.match(project, /<UseWindowsForms>true<\/UseWindowsForms>/);
});
