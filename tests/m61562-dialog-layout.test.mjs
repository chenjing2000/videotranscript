import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync('src/style.css','utf8');

test('M6.15.6.2: shared dialog backdrop stays within the viewport and can scroll on short screens',()=>{
 assert.match(css,/\.fluent-dialog-backdrop\s*\{[^}]*padding:\s*24px[^}]*overflow-y:\s*auto[^}]*align-items:\s*safe center/s);
 assert.match(css,/\.fluent-dialog\s*\{[^}]*max-height:\s*calc\(100vh\s*-\s*48px\)[^}]*max-height:\s*calc\(100dvh\s*-\s*48px\)/s);
});

test('M6.15.6.2: dialog header is not constrained by the app-wide 54px header rule',()=>{
 assert.match(css,/\.fluent-dialog-head\s*\{[^}]*height:\s*auto[^}]*min-height:\s*64px/s);
 assert.match(css,/\.fluent-dialog-head\s*\{[^}]*flex:\s*0 0 auto/s);
 assert.match(css,/\.fluent-dialog-titles span\s*\{[^}]*flex:\s*none/s);
});

test('M6.15.6.2: dialog actions are not constrained by the app-wide 28px footer rule',()=>{
 assert.match(css,/\.fluent-dialog-actions\s*\{[^}]*height:\s*auto[^}]*min-height:\s*70px[^}]*padding:\s*14px 20px 20px/s);
 assert.match(css,/\.fluent-dialog-actions\s*\{[^}]*flex:\s*0 0 auto/s);
});

test('M6.15.6.2: only the dialog body scrolls while header and actions remain fixed',()=>{
 assert.match(css,/\.fluent-dialog-body\s*\{[^}]*flex:\s*1 1 auto[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/s);
 assert.match(css,/\.fluent-dialog-head\s*\{[^}]*flex:\s*0 0 auto/s);
 assert.match(css,/\.fluent-dialog-actions\s*\{[^}]*flex:\s*0 0 auto/s);
});
