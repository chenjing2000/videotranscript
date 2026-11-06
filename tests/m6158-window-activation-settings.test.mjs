import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as settings from '../.tmp-core/app-settings.js';

const read = path => readFileSync(path, 'utf8');
const host = read('desktop/ReaderWindow.cs');
const appSettings = read('src/core/app-settings.ts');

const closing = host.slice(
  host.indexOf('private async void OnClosing'),
  host.indexOf('private bool ConfirmDiscardUnsavedChanges')
);

const activation = host.slice(
  host.indexOf('private void RestoreAfterCancelledClose'),
  host.indexOf('private bool ConfirmDiscardUnsavedChanges')
);

test('M6.15.8: every user-cancelled close path schedules restoration of a previously visible main window', () => {
  assert.equal((closing.match(/RestoreAfterCancelledClose\(wasVisible\)/g) ?? []).length, 3);
  assert.match(closing, /var wasVisible = IsVisible;/);
  assert.match(closing, /Close cancelled; export continues\.[\s\S]*?RestoreAfterCancelledClose\(wasVisible\);/);
  assert.match(closing, /Close cancelled; unsaved project changes are retained and export continues\.[\s\S]*?RestoreAfterCancelledClose\(wasVisible\);/);
  assert.match(closing, /Close cancelled; unsaved project changes are retained\.[\s\S]*?RestoreAfterCancelledClose\(wasVisible\);/);
});

test('M6.15.8: delayed restoration never shows a window that was hidden in the tray', () => {
  assert.match(activation, /if \(!wasVisible\s*\|\| Dispatcher\.HasShutdownStarted\s*\|\| Dispatcher\.HasShutdownFinished\)\s*return;/);
  assert.match(activation, /Dispatcher\.BeginInvoke\(DispatcherPriority\.Normal/);
  assert.match(activation, /if \(isShuttingDown\s*\|\|\s*!IsVisible\)\s*return;/);
  assert.match(activation, /ActivateFromTray\(\)/);
  assert.match(activation, /AppLog\.WriteException\("Window\.RestoreAfterCancelledClose"/);
});

test('M6.15.8: global settings use the Transcript Studio filename and format marker', () => {
  assert.equal(settings.SETTINGS_FILENAME, 'transcriptstudio.settings.json');
  assert.equal(settings.DEFAULT_SETTINGS.format, 'transcriptstudio-settings');
  assert.equal(settings.validateSettings(settings.DEFAULT_SETTINGS), true);
  assert.equal(settings.validateSettings({ ...settings.DEFAULT_SETTINGS, format: 'voicetranscript-settings' }), false);
  assert.match(appSettings, /format:SETTINGS_FORMAT/);
  assert.match(appSettings, /SETTINGS_FILENAME = 'transcriptstudio\.settings\.json'/);
});

test('M6.15.8: the host prefers the new settings file and migrates only when it is absent', () => {
  assert.match(host, /SettingsFileName = "transcriptstudio\.settings\.json"/);
  assert.match(host, /SettingsFormat = "transcriptstudio-settings"/);
  assert.match(host, /LegacySettingsFileName = "voicetranscript\.settings\.json"/);
  assert.match(host, /LegacySettingsFormat = "voicetranscript-settings"/);
  assert.match(host, /format = SettingsFormat, schemaVersion = 1/);
  assert.match(host, /GetProperty\("format"\)\.GetString\(\) != SettingsFormat/);
  assert.match(host, /if \(File\.Exists\(settingsFile\)\)[\s\S]*?if \(!File\.Exists\(settingsFile\) && File\.Exists\(legacySettingsFile\)\)/);
  assert.match(host, /TryMigrateLegacySettings\(out var migrated\)/);
});

test('M6.15.8: legacy migration validates, fills missing defaults, writes new settings atomically and retains the old file', () => {
  const migration = host.slice(
    host.indexOf('private bool TryMigrateLegacySettings'),
    host.indexOf('private static void FillMissing')
  );
  assert.match(migration, /LegacySettingsFormat/);
  assert.match(migration, /candidate\["schemaVersion"\]/);
  assert.match(migration, /FillMissing\(candidate, fallback\)/);
  assert.match(migration, /candidate\["format"\]\s*=\s*SettingsFormat/);
  assert.match(migration, /ValidSettings\(migratedDoc\.RootElement\)/);
  assert.match(migration, /AtomicWrite\(settingsFile, migrated\)/);
  assert.doesNotMatch(migration, /File\.(?:Move|Delete)\(legacySettingsFile/);
});
