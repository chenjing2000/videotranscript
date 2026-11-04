import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const cs=readFileSync('desktop/ReaderWindow.cs','utf8');
const main=readFileSync('src/main.tsx','utf8');
const css=readFileSync('src/style.css','utf8');
test('M6.7: npm and browser confirmation use asynchronous UI bridge, not legacy MessageBox',()=>{
 assert.match(cs,/ConfirmDependencyAsync\(/);
 assert.match(cs,/"安装视频导出模块", "视频导出组件尚未安装"/);
 assert.match(cs,/"准备导出浏览器", "需要准备专用渲染浏览器"/);
 assert.doesNotMatch(cs,/MessageBoxButton\.YesNo/);
 assert.match(cs,/kind == "dependency-decision"/);
 assert.match(cs,/if \(exporting\) return;/);
 assert.ok(cs.indexOf('kind == "dependency-decision"')<cs.indexOf('if (exporting) return;'));
 assert.match(cs,/TaskCreationOptions\.RunContinuationsAsynchronously/);
});
test('M6.7: React dialog supports confirm, progress, error and explicit cancellation',()=>{
 for(const mode of ['dependency-confirm','dependency-progress','dependency-failed','dependency-end']) assert.ok(main.includes(mode),mode);
 assert.match(main,/aria-modal="true"/);
 assert.match(main,/replyDependency\(false\)/);
 assert.match(main,/dependency-dialog-actions/);
 assert.match(main,/dependency-progress-track/);
 assert.match(main,/重试/);
 assert.match(css,/width:min\(460px,calc\(100vw - 48px\)\)/);
 assert.match(css,/border-radius:12px/);
 assert.match(css,/background:#D3E5EB/);
 assert.match(css,/prefers-reduced-motion/);
});
