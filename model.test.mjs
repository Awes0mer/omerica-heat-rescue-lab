import test from 'node:test';
import assert from 'node:assert/strict';
import { PARAMS, tegAt, createSimulation, setBlocked, setBackupCooling, step, snapshot, evaluateLayout } from './dist/model.js';

const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);

test('equal-temperature tiles produce no voltage, current, or electric power', () => {
  for (const temperature of [0, 25, 60, 100]) {
    const t = tegAt(temperature, temperature);
    near(t.voltageV, 0);
    near(t.currentA, 0);
    near(t.powerW, 0);
    near(t.heatInW, 0);
    near(t.heatOutW, 0);
  }
});

test('electricity is accounted for in heat loss, and generation stays below Carnot limit', () => {
  for (const [hot, cold] of [[40, 25], [70, 30], [100, 60]]) {
    for (const count of [1, 2, 6]) {
      const t = tegAt(hot, cold, count);
      near(t.heatInW - t.heatOutW, t.powerW);
      assert.ok(t.powerW > 0);
      assert.ok(t.powerW / t.heatInW < 1 - (cold + 273.15) / (hot + 273.15));
    }
  }
});

test('constant-property matched-load power follows the squared temperature difference', () => {
  const small = tegAt(45, 25, 2);
  const large = tegAt(65, 25, 2);
  near(large.powerW, 4 * small.powerW);
  near(large.voltageV, 2 * small.voltageV);
  const reversed = tegAt(25, 45, 2);
  near(reversed.powerW, small.powerW);
  near(reversed.voltageV, -small.voltageV);
});

test('initial conditions are a true steady thermal balance, not a prerecorded display', () => {
  for (const counts of [[2, 2, 2], [4, 2, 0], [0, 0, 6]]) {
    const sim = createSimulation({ counts });
    const initial = snapshot(sim);
    near(initial.storedHeatRateW, 0, 1e-7);
    near(initial.totalPowerW + initial.waterExportW + initial.ambientLossW, 600, 1e-7);
    const later = step(sim, 600);
    near(later.totalPowerW, initial.totalPowerW, 1e-8);
    near(later.maxHotC, initial.maxHotC, 1e-8);
    assert.ok(later.branches.every(b => b.hotC > b.coldC && b.coldC > b.waterC));
  }
});

test('blockage warms trapped water and cold plate; output changes continuously from computed temperatures', () => {
  const sim = createSimulation();
  const initial = snapshot(sim);
  const justBlocked = setBlocked(sim, 1, true);
  near(justBlocked.totalPowerW, initial.totalPowerW);
  near(justBlocked.branches[1].flowKgS, 0);
  near(justBlocked.pumpPowerW, initial.pumpPowerW);
  const blocked = step(sim, 120);
  assert.ok(blocked.branches[1].waterC > initial.branches[1].waterC);
  assert.ok(blocked.branches[1].coldC > initial.branches[1].coldC);
  assert.ok(blocked.branches[1].hotC > initial.branches[1].hotC);
  assert.ok(blocked.branches[1].deltaC < initial.branches[1].deltaC);
  assert.ok(blocked.branches[1].powerW < initial.branches[1].powerW);
  near(blocked.branches[0].powerW, initial.branches[0].powerW);
  near(blocked.branches[2].hotC, initial.branches[2].hotC);
  setBlocked(sim, 1, false);
  const recovered = step(sim, 3600);
  near(recovered.branches[1].hotC, initial.branches[1].hotC, 1e-5);
  near(recovered.totalPowerW, initial.totalPowerW, 1e-6);
});

test('the entire transient conserves source energy through blockage and recovery', () => {
  const sim = createSimulation({ counts: [4, 1, 1] });
  for (let phase = 0; phase < 12; phase++) {
    setBlocked(sim, phase % 3, phase % 2 === 0);
    const s = step(sim, 37.5);
    near(s.energyBalanceW, 0, 1e-9);
    near(s.energyResidualJ, 0, 1e-5);
    assert.ok(s.branches.every(b => Number.isFinite(b.hotC) && Number.isFinite(b.powerW) && b.powerW >= 0));
  }
});

test('negative incremental recovery and an exceeded illustrative limit are allowed', () => {
  const sim = createSimulation();
  for (let i = 0; i < 3; i++) setBlocked(sim, i, true);
  const s = step(sim, 7200);
  assert.ok(s.maxHotC > PARAMS.illustrativeLimitC);
  assert.equal(s.withinIllustrativeLimit, false);
  assert.ok(s.netRecoveryW < 0);
  assert.ok(s.totalPowerW > 0, 'passive room heat rejection still supports a temperature difference');
  near(s.waterExportW, 0);
  near(s.energyResidualJ, 0, 1e-4);
});

test('layout trials keep the equipment budget fixed and check all three independent faults', () => {
  assert.throws(() => createSimulation({ counts: [2, 2, 3] }), RangeError);
  assert.throws(() => createSimulation({ counts: [2.5, 1.5, 2] }), RangeError);
  const spread = evaluateLayout([2, 2, 2]);
  const grouped = evaluateLayout([4, 2, 0]);
  assert.equal(spread.trials.length, 3);
  near(spread.trials[0].netRecoveryW, spread.trials[1].netRecoveryW);
  near(spread.trials[1].netRecoveryW, spread.trials[2].netRecoveryW);
  assert.ok(spread.worstNetRecoveryW > grouped.worstNetRecoveryW);
  assert.ok(grouped.worstNetRecoveryW < 0);
});

test('invalid inputs are rejected and returned snapshots cannot mutate the thermal state', () => {
  const sim = createSimulation();
  assert.throws(() => step(sim, -1), RangeError);
  assert.throws(() => step(sim, Infinity), RangeError);
  assert.throws(() => setBlocked(sim, 9, true), RangeError);
  const s = snapshot(sim);
  s.branches[0].hotC = 1000;
  assert.ok(snapshot(sim).branches[0].hotC < 100);
});

test('an independent backup path cools a blocked branch and charges its extra electrical cost', () => {
  const withoutBackup = createSimulation();
  const withBackup = createSimulation();
  for (const sim of [withoutBackup, withBackup]) {
    setBlocked(sim, 1, true);
    step(sim, 120);
  }
  const before = snapshot(withBackup);
  const justEnabled = setBackupCooling(withBackup, true);
  assert.equal(justEnabled.branches[1].blocked, true, 'the main pipe remains blocked');
  assert.equal(justEnabled.branches[1].backupActive, true);
  near(justEnabled.branches[1].flowKgS, PARAMS.backupFlowKgS);
  near(justEnabled.branches[1].flow, 0.5);
  near(justEnabled.totalPowerW, before.totalPowerW, 1e-10);
  near(justEnabled.netRecoveryW, before.netRecoveryW - 0.5, 1e-10);
  near(justEnabled.pumpPowerW, 4.4);
  near(justEnabled.incrementalPumpW, 1.4);
  const rescued = step(withBackup, 240);
  const unrescued = step(withoutBackup, 240);
  assert.ok(rescued.branches[1].hotC < unrescued.branches[1].hotC);
  assert.ok(rescued.branches[1].coldC < unrescued.branches[1].coldC);
  assert.ok(rescued.branches[1].powerW > unrescued.branches[1].powerW);
  near(rescued.energyBalanceW, 0, 1e-9);
  near(rescued.energyResidualJ, 0, 1e-5);
  const off = setBackupCooling(withBackup, false);
  near(off.branches[1].flowKgS, 0);
  near(off.backupPumpW, 0);
  near(off.netRecoveryW, rescued.netRecoveryW + 0.5);
});

test('enabled backup stays idle with no blocked branch and preserves the all-open baseline', () => {
  const sim = createSimulation();
  const before = snapshot(sim);
  const enabled = setBackupCooling(sim, true);
  assert.equal(enabled.backupCooling, true);
  assert.equal(enabled.backupActive, false);
  near(enabled.backupPumpW, 0);
  near(enabled.netRecoveryW, before.netRecoveryW);
  assert.deepEqual(enabled.baseline, before.baseline);
  const active = setBlocked(sim, 0, true);
  assert.equal(active.backupActive, true);
  near(active.branches[0].flow, 0.5);
  const reopened = setBlocked(sim, 0, false);
  assert.equal(reopened.backupActive, false);
  near(reopened.backupPumpW, 0);
  near(reopened.branches[0].flow, 1);
});
