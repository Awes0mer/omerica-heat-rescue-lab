import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoRun } from './dist/assembly-demo-state.js';
import { createSimulation, setBlocked, setBackupCooling, step, snapshot } from './dist/model.js';

test('guided scenarios reproduce the existing teaching physics with a fresh six-tile allocation', () => {
  for (const scenario of ['baseline', 'blocked', 'backup']) {
    const {sim, frames} = createDemoRun({scenario, seconds:120});
    const reference = createSimulation({counts:[2,2,2]});
    if (scenario !== 'baseline') setBlocked(reference,1,true);
    if (scenario === 'backup') setBackupCooling(reference,true);
    for (let second=0;second<120;second++) step(reference,1);
    assert.deepEqual(snapshot(sim), snapshot(reference));
    assert.equal(frames.length,121);
    assert.equal(frames[0].time,0);
    assert.equal(frames.at(-1).time,120);
    assert.deepEqual(frames.at(-1).branches.map(b=>b.count),[2,2,2]);
  }
});

test('moving backward in the guide cannot carry a blocked pipe or backup state into the overview', () => {
  createDemoRun({scenario:'backup',seconds:120});
  const {frames} = createDemoRun({scenario:'baseline'});
  assert.equal(frames.length,1);
  assert.equal(frames[0].time,0);
  assert.ok(frames[0].branches.every(b=>!b.blocked && !b.backupActive));
  assert.equal(frames[0].backupPumpW,0);
});

test('invalid demo requests fail before making a simulation', () => {
  for (const spec of [{scenario:'unknown'}, {scenario:'baseline',seconds:-1}, {scenario:'backup',seconds:Infinity}, {scenario:'blocked',seconds:601}, {scenario:'blocked',seconds:.5}]) {
    assert.throws(()=>createDemoRun(spec),RangeError);
  }
});
