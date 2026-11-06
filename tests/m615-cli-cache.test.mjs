import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

function runExport(extraArgs = []) {
  return spawnSync(process.execPath, [
    'scripts/export.mjs',
    '--media', 'missing-input.mp4',
    '--json', 'missing-input.transcript-studio.json',
    '--out', 'out/Lesson.exported.mp4',
    ...extraArgs
  ], {encoding: 'utf8'});
}

test('CLI export accepts an omitted cache directory and proceeds to input validation', () => {
  const result = runExport();
  assert.notEqual(result.status, 2, `unexpected usage rejection: ${result.stderr}`);
  assert.doesNotMatch(result.stderr, /Usage: npm run export/);
  assert.match(result.stderr, /ENOENT|no such file/i);
});

test('CLI export continues to accept an explicit cache directory', () => {
  const result = runExport(['--cache-dir', 'custom-cache']);
  assert.notEqual(result.status, 2, `unexpected usage rejection: ${result.stderr}`);
  assert.doesNotMatch(result.stderr, /Usage: npm run export/);
  assert.match(result.stderr, /ENOENT|no such file/i);
});

test('CLI default cache is placed beside the absolute output path', () => {
  const source = readFileSync('scripts/export.mjs', 'utf8');
  assert.match(source, /path\.join\(path\.dirname\(path\.resolve\(output\)\),\s*['"]\.transcript-studio-cache['"]\)/);
  assert.match(source, /cacheArg\s*\?\s*path\.resolve\(cacheArg\)/);
});
