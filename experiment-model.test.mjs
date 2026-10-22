import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, snapshot, PARAMS, tegAt } from './dist/model.js';
import { BASELINE_DESIGN, EXPERIMENT_PARAMS, TRAIN_SCENARIOS, HOLDOUT_SCENARIOS, runTrial, evaluateDesign, backupPumpPowerW } from './dist/experiment-model.js';

const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);

test('experiment plant reproduces the manual plant under identical steady assumptions', () => {
  const manual = snapshot(createSimulation());
  const trial = runTrial({ ...BASELINE_DESIGN, triggerC: 100 }, { ...TRAIN_SCENARIOS[0], loadsW: [200, 200, 200], faultStartS: 60, durationS: 30 }, { includeTrace: true });
  near(trial.generatedEnergyJ / 30, manual.totalPowerW);
  near(trial.netEnergyJ / 30, manual.netRecoveryW);
  near(trial.maxHotC, manual.maxHotC);
  near(trial.backupPumpEnergyJ, 0);
  near(trial.energyResidualJ, 0, 1e-6);
});

test('backup pump charges hydraulic work and fixed-efficiency losses with cubic flow scaling', () => {
  near(backupPumpPowerW(0), 0);
  near(backupPumpPowerW(0.005), 0.5015045135406219);
  near(backupPumpPowerW(0.01), 8 * backupPumpPowerW(0.005));
  assert.throws(() => backupPumpPowerW(-1), RangeError);
});

test('temperature-only policy can run a healthy branch and has no advance access to the fault', () => {
  const design = { ...BASELINE_DESIGN, triggerC: 66 };
  const a = runTrial(design, { ...TRAIN_SCENARIOS[0], durationS: 60 }, { includeTrace: true });
  const b = runTrial(design, { ...TRAIN_SCENARIOS[2], durationS: 60 }, { includeTrace: true });
  assert.equal(a.trace[0].faultActive, false);
  assert.equal(a.trace[0].branches[0].backupOn, true);
  assert.ok(a.trace[0].branches[0].flowKgS > EXPERIMENT_PARAMS.normalFlowKgS);
  assert.deepEqual(a.trace.filter(t => t.time < 30), b.trace.filter(t => t.time < 30));
  assert.ok(a.backupPumpEnergyJ > 0);
});

test('all preset thermal transients conserve energy despite changing controller and fault states', () => {
  for (const scenario of [...TRAIN_SCENARIOS, ...HOLDOUT_SCENARIOS]) {
    const trial = runTrial(BASELINE_DESIGN, scenario);
    near(trial.energyResidualJ, 0, 1e-4);
    near(trial.netEnergyJ, trial.generatedEnergyJ - trial.addedPumpEnergyJ);
    near(trial.addedPumpEnergyJ, scenario.durationS * EXPERIMENT_PARAMS.addedRecoveryPumpW + trial.backupPumpEnergyJ);
    assert.ok(trial.final.branches.every(b => Number.isFinite(b.hotC) && b.powerW >= 0));
  }
});

test('integrated objective reports negative outcomes and temperature violations without hiding them', () => {
  const holdout = evaluateDesign(BASELINE_DESIGN, { split: 'holdout' });
  near(holdout.scoreJ, Math.min(...holdout.trials.map(t => t.netEnergyJ)));
  assert.ok(holdout.scoreJ < 0);
  const noRescue = runTrial({ counts: [0, 0, 6], triggerC: 100, backupFlowFraction: 0 }, TRAIN_SCENARIOS[0]);
  assert.equal(noRescue.feasible, false);
  assert.ok(noRescue.maxHotC > 80);
  assert.ok(Number.isFinite(noRescue.netEnergyJ));
});

test('trace is sampled every five seconds, captures actual physics, and includes fault onset', () => {
  const trial = runTrial(BASELINE_DESIGN, TRAIN_SCENARIOS[0], { includeTrace: true });
  assert.equal(trial.trace.length, 121);
  assert.equal(trial.trace[0].time, 0);
  assert.equal(trial.trace.at(-1).time, 600);
  assert.equal(trial.trace.find(t => t.time === 25).faultActive, false);
  assert.equal(trial.trace.find(t => t.time === 30).faultActive, true);
  for (const sample of trial.trace) {
    near(sample.totalPowerW, sample.branches.reduce((sum, b) => sum + tegAt(b.hotC, b.coldC, b.count).powerW, 0));
    near(sample.netRecoveryW, sample.totalPowerW - EXPERIMENT_PARAMS.addedRecoveryPumpW - sample.backupPumpW);
  }
});

test('independent candidate experiments do not mutate shared parameters or leak previous outcomes', () => {
  const paramsBefore = JSON.stringify(PARAMS);
  const first = evaluateDesign(BASELINE_DESIGN);
  evaluateDesign({ counts: [4, 1, 1], triggerC: 70, backupFlowFraction: 0.75 }, { split: 'holdout' });
  const repeated = evaluateDesign(BASELINE_DESIGN);
  assert.deepEqual(first, repeated);
  assert.equal(JSON.stringify(PARAMS), paramsBefore);
  assert.ok(TRAIN_SCENARIOS.every(t => !HOLDOUT_SCENARIOS.some(h => h.id === t.id)));
});

test('six-tile budget and experiment inputs are validated; legacy threshold alias is supported', () => {
  assert.throws(() => evaluateDesign({ ...BASELINE_DESIGN, counts: [3, 3, 1] }), RangeError);
  assert.throws(() => evaluateDesign({ ...BASELINE_DESIGN, triggerC: NaN }), RangeError);
  assert.throws(() => evaluateDesign({ ...BASELINE_DESIGN, backupFlowFraction: 1.1 }), RangeError);
  assert.throws(() => evaluateDesign(BASELINE_DESIGN, { split: 'cherry-picked' }), RangeError);
  const canonical = runTrial(BASELINE_DESIGN, { ...TRAIN_SCENARIOS[0], durationS: 30 });
  const alias = runTrial({ counts: [2, 2, 2], backupTriggerC: 74, backupFlowFraction: 0.5 }, { ...TRAIN_SCENARIOS[0], durationS: 30 });
  near(canonical.netEnergyJ, alias.netEnergyJ);
});
