import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../.tmp-core/index.js');

const transcript = core.parseVideoTranscript({language:'en',video_transcript:{format:'video-transcript',schemaVersion:2},segments: [
  {words: [{word:'Hello.',start:7.293,end:7.613}]},
  {words: [{word:'Here',start:8,end:8.4},{word:'again.',start:8.5,end:9}]}
]});
const style = {...core.DEFAULT_STYLE, fontSize: 10, lineHeight: 1, paddingX: 0, paddingY: 0};
const measure = text => text.length * 5;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8);

test('Silent opening is uncolored and stationary, with stateless midpoint and rewind', () => {
  const word = transcript.words[0];
  const layout = core.buildLayout(transcript.words, style, 30, 20, measure);
  const plan = core.buildScrollPlan(layout);
  for (const time of [0, 7, 7.292]) {
    assert.equal(core.wordProgress(time, word.start, word.end), 0);
    assert.equal(core.scrollOffset(plan, time), 0);
  }
  const middle = (word.start + word.end) / 2;
  near(core.wordProgress(middle, word.start, word.end), .5);
  assert.equal(core.wordProgress(word.end + 1, word.start, word.end), 1);
  near(core.wordProgress(middle, word.start, word.end), .5);
  assert.equal(core.wordProgress(0, word.start, word.end), 0);
  assert.equal(word.display, 'Hello.');
});

test('Semantic paragraph overrides remain separate from segment IDs and line wrapping', () => {
  const original = transcript.words;
  const changed = original.map(word => word.id === 's1w0' ? {...word, breakParagraph: true} : word);
  const project = core.createProject('sample.mp4', 'sample.json', changed);
  const restored = core.applyOverrides(transcript, project).words;
  assert.deepEqual(Object.keys(project.overrides), ['s1w0']);
  assert.deepEqual(restored.map(({id,start,end}) => [id,start,end]), original.map(({id,start,end}) => [id,start,end]));
  const small = core.buildLayout(restored, {...style, paragraphGap: 4}, 100, 22, measure);
  const large = core.buildLayout(restored, {...style, paragraphGap: 20}, 100, 22, measure);
  assert.deepEqual(small.rows.map(row => row.startWord), [0, 2]);
  assert.deepEqual(large.rows.map(row => row.top), [0, 30]);
  assert.equal(core.buildScrollPlan(small).maxOffset, 2);
  assert.equal(core.buildScrollPlan(large).maxOffset, 18);
  const short = core.buildLayout(restored, style, 100, 100, measure);
  assert.equal(short.rows[0].top, 0);
  assert.equal(core.scrollOffset(core.buildScrollPlan(short), 100), 0);
});

test('Queued scroll consumes remaining silence and stays continuous and bounded', () => {
  const rows = [[0,1],[1.01,1.03],[1.05,1.06],[1.8,2]].map(([firstStart,lastEnd], index) => ({
    index, firstStart, lastEnd, top: index === 3 ? 80 : index * 20, bottom: index === 3 ? 100 : (index + 1) * 20,
    startWord: index, endWord: index
  }));
  const plan = core.buildScrollPlan({rows, totalHeight:100, viewportHeight:40, viewportWidth:100, wordRows:[0,1,2,3]});
  assert.equal(plan.events.length, 3);
  near(plan.events[0].end, 1.15);
  near(plan.events[1].start, 1.15);
  near(plan.events[1].end, 1.30);
  near(plan.events[2].start, 1.30);
  near(plan.events[2].end, 1.80);
  let last = 0;
  for (let time = 0; time < 2.1; time += .001) {
    const next = core.scrollOffset(plan, time);
    assert.ok(next >= last && next <= 60);
    assert.ok(next - last < .3, 'adjacent 1 ms samples must remain continuous');
    last = next;
  }
  near(core.scrollOffset(plan, 2), 60);
  const midpoint = core.scrollOffset(plan, 1.55);
  near(midpoint, 50);
  near(core.scrollOffset(plan, 0), 0);
  near(core.scrollOffset(plan, 1.55), midpoint);
});

test('Serialized export snapshot keeps preview geometry and edits after subsequent editing', () => {
  const project = core.createProject('sample.mp4','sample.json',transcript.words);
  const words = core.updateWord(transcript.words, 's0w0', 'Hi.');
  const layout = core.buildLayout(words, project.style, 1200, 925, measure);
  const snapshot = JSON.parse(JSON.stringify({project:core.saveProjectView(project, words),layout}));
  const later = core.updateWord(words, 's0w0', 'Later.');
  assert.equal(later[0].display, 'Later.');
  const rendered = core.applyOverrides(transcript, snapshot.project).words;
  assert.equal(rendered[0].display, words[0].display);
  assert.equal(rendered[0].start, words[0].start);
  assert.deepEqual(snapshot.layout, layout);
  assert.deepEqual(core.buildScrollPlan(snapshot.layout), core.buildScrollPlan(layout));
});
