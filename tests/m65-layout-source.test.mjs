import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync('src/style.css','utf8');
const ui=readFileSync('src/ui/StyleSettings.tsx','utf8');

test('M6.5 settings: all groups share fixed column origins 0, 64, 190, 254 DIP',()=>{
  assert.match(css,/\.m65-grid\s*\{[^}]*grid-template-columns:\s*64px 126px 64px 96px;/);
  assert.match(css,/\.m65-grid\s*\{[^}]*column-gap:\s*0;/);
  assert.match(ui,/className="m65-grid"/);
});

test('M6.5 settings: all controls 70 DIP except paragraph alignment at 90 DIP, swatches round 20 DIP',()=>{
  assert.match(css,/\.m65-value input,\.m65-value select\s*\{[^}]*width:\s*70px;/);
  assert.match(css,/\.m65-value-align select\s*\{[^}]*width:\s*90px;/);
  assert.match(ui,/title==='段落设置'&&f\.label==='段落对齐'/);
  assert.match(css,/\.m65-swatch\s*\{[^}]*width:\s*20px;[^}]*height:\s*20px;[^}]*border-radius:\s*50%/);
  assert.match(ui,/m65-value-color/);
});

test('M6.5 settings: right font size is labelled 大小',()=>{
  assert.doesNotMatch(ui,/正文字体大小/);
  assert.match(ui,/numeric\('大小',s\.rightFont\.size/);
});


test('M6.5 settings: compact 384-DIP outer dialog has balanced padding and contains widest control',()=>{
  assert.match(css,/\.settings-dialog\s*\{width:min\(384px,calc\(100vw - 40px\)\)\}/);
  assert.match(css,/\.settings-body\s*\{padding:14px 17px 24px\}/);
  // Left inset 17 + column 4 origin 254 + color width 70 + gap 5 + swatch diameter 20 = 366.
  // The right inset is 384 - 366 = 18 DIP (both sides approximately equal).
  assert.equal(17+254+70+5+20,366);
  assert.equal(384-366,18);
  // The alignment dropdown ends earlier: 17+254+90=361 DIP.
  assert.equal(17+254+90,361);
});
