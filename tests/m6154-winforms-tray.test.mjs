import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const tray = read('desktop/AppLifecycle/TrayIconManager.cs');
const host = read('desktop/ReaderWindow.cs');
const project = read('desktop/TranscriptStudio.csproj');

test('M6.15.4 enables the built-in Windows Forms desktop framework without adding a tray package', () => {
  assert.match(project, /<UseWPF>true<\/UseWPF>/);
  assert.match(project, /<UseWindowsForms>true<\/UseWindowsForms>/);
  assert.doesNotMatch(project, /PackageReference Include=".*(NotifyIcon|Tray)/i);
});

test('M6.15.4 uses WinForms NotifyIcon for tray registration and mouse input', () => {
  assert.match(tray, /Forms\.NotifyIcon/);
  assert.match(tray, /MouseDoubleClick\s*\+=\s*OnMouseDoubleClick/);
  assert.match(tray, /MouseUp\s*\+=\s*OnMouseUp/);
  assert.match(tray, /Forms\.MouseButtons\.Left/);
  assert.match(tray, /Forms\.MouseButtons\.Right/);
  assert.match(tray, /Visible\s*=\s*true/);
});

test('M6.15.4 tray manager contains no application-owned Shell or user32 P/Invoke plumbing', () => {
  assert.doesNotMatch(tray, /Shell_NotifyIcon|NotifyIconData|HwndSource|RegisterWindowMessage|DllImport|ExtractIconEx|DestroyIcon|GetCursorPos|MonitorFromPoint|GetMonitorInfo/);
});

test('M6.15.4 keeps the custom WPF tray menu and its agreed dimensions and labels', () => {
  assert.match(tray, /private sealed class TrayMenuWindow\s*:\s*Window/);
  assert.match(tray, /Width\s*=\s*70/);
  assert.match(tray, /SizeToContent\s*=\s*SizeToContent\.Height/);
  assert.match(tray, /CreateItem\("打开"/);
  assert.match(tray, /CreateItem\("退出"/);
  assert.match(tray, /#FFFBC7/);
});

test('M6.15.4 uses WinForms cursor and screen wrappers for WPF menu placement', () => {
  assert.match(tray, /Forms\.Cursor\.Position/);
  assert.match(tray, /Forms\.Screen\.FromPoint/);
  assert.doesNotMatch(tray, /DllImport|GetCursorPos|MonitorFromPoint|GetMonitorInfo/);
});

test('M6.15.4 disposes NotifyIcon before releasing its owned icon', () => {
  const dispose = tray.slice(tray.indexOf('public void Dispose()'), tray.indexOf('private sealed class TrayMenuWindow'));
  assert.match(dispose, /notifyIcon\.Visible\s*=\s*false/);
  assert.match(dispose, /notifyIcon\.Dispose\(\)/);
  assert.match(dispose, /trayIconImage\.Dispose\(\)/);
});

test('M6.15.4 normalizes the WPF state before hiding the main window in the tray', () => {
  const state = host.slice(host.indexOf('StateChanged += '), host.indexOf('Closing += OnClosing'));
  assert.match(state, /WindowState\s*=\s*WindowState\.Normal[\s\S]*?ShowInTaskbar\s*=\s*false[\s\S]*?Hide\(\)/);
});

test('M6.15.4 restores the existing WPF window and uses WPF activation without user32 P/Invoke', () => {
  const activation = host.slice(host.indexOf('internal void ActivateFromTray'), host.indexOf('private static void DisposeSafely'));
  assert.match(activation, /ShowInTaskbar\s*=\s*true/);
  assert.match(activation, /WindowState\s*=\s*WindowState\.Normal/);
  assert.match(activation, /if\s*\(!IsVisible\)\s*Show\(\)/);
  assert.match(activation, /Topmost\s*=\s*true/);
  assert.match(activation, /Topmost\s*=\s*wasTopmost/);
  assert.match(activation, /Activate\(\)/);
  assert.doesNotMatch(host, /SetForegroundWindow|DllImport\("user32\.dll"\)/);
});

test('M6.15.4.1 explicitly qualifies WPF HorizontalAlignment to avoid WinForms namespace collisions', () => {
  assert.match(tray, /HorizontalAlignment = System\.Windows\.HorizontalAlignment\.Stretch/);
  assert.match(readFileSync('desktop/UI/FluentDialog.cs','utf8'), /HorizontalAlignment = HorizontalAlignment\.Right/);
});
