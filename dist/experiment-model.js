/**
 * Experimental plant for Heat Rescue's design-search demonstration.
 * Shares the original, constant-property thermoelectric equations and module
 * assumptions with model.js. All scenario values are hypothetical, not field
 * measurements. No global state is mutated between candidate experiments.
 *
 * Backup policy reads only hot-plate temperatures once per second. It cannot
 * see the fault location or remaining main-line flow. Each independent backup
 * route adds regulated flow to its branch, including when that branch is
 * healthy. Main flows do not redistribute and supply temperature is imposed.
 *
 * Backup electrical power = pressureDrop * massFlow / (density * efficiency).
 * PressureDrop = referencePressure * (massFlow/referenceFlow)^2 is an assumed
 * fixed-resistance circuit relation; efficiency is assumed constant. This is
 * not a calibrated pump curve. The pump is external to the thermal control
 * volume, so its electrical input is charged in the objective but its heat is
 * not added to the plates. Chiller power and converter losses are excluded.
 * Source: DOE, Test for Pumping System Efficiency (system electrical efficiency)
 * https://www1.eere.energy.gov/manufacturing/tech_assistance/pdfs/test_pumping_system__pumping_systemts4.pdf
 */
import { PARAMS, tegAt } from './model.js';

export const EXPERIMENT_PARAMS = Object.freeze({
  illustrativeLimitC: 80,
  normalFlowKgS: 0.01,
  backupReferenceFlowKgS: 0.005,
  backupReferencePressurePa: 25000,
  backupPumpEfficiency: 0.25,
  waterDensityKgM3: 997,
  addedRecoveryPumpW: 0.9,
  fixedMainPumpW: 3,
  hysteresisC: 2,
  controllerPeriodS: 1,
  maximumStepS: 0.25,
  tracePeriodS: 5,
  faultStartS: 30,
});

export const BASELINE_DESIGN = Object.freeze({ counts: Object.freeze([2, 2, 2]), triggerC: 74, backupFlowFraction: 0.5 });

const baseScenario = {
  loadsW: [240, 200, 160], inletC: 25, ambientC: 25,
  normalFlowScale: 1, coldWaterScale: 1, bypassScale: 1,
  remainingFlowFraction: 0, faultStartS: 30, durationS: 600,
};
const scenario = (id, label, overrides) => Object.freeze({ ...baseScenario, id, label, ...overrides, loadsW: Object.freeze([...(overrides.loadsW || baseScenario.loadsW)]) });

export const TRAIN_SCENARIOS = Object.freeze([0, 1, 2].map(i => scenario(`train-${i + 1}`, `Pipe ${'ABC'[i]} fully blocked`, { faultBranch: i })));
export const HOLDOUT_SCENARIOS = Object.freeze([
  scenario('holdout-partial', 'Partial blockage in pipe A', { faultBranch: 0, remainingFlowFraction: 0.25, durationS: 900 }),
  scenario('holdout-warm', 'Warmer supply and room; pipe B blocked', { faultBranch: 1, inletC: 30, ambientC: 30, durationS: 900 }),
  scenario('holdout-load', 'Workload moved between servers; pipe C blocked', { faultBranch: 2, loadsW: [180, 220, 200], durationS: 900 }),
  scenario('holdout-contact', 'Weaker heat transfer; pipe A blocked', { faultBranch: 0, coldWaterScale: 0.8, bypassScale: 0.8, durationS: 900 }),
  scenario('holdout-flow', '20% less main flow; pipe B blocked', { faultBranch: 1, normalFlowScale: 0.8, durationS: 900 }),
  scenario('holdout-combined', 'Warm partial blockage with shifted workload', { faultBranch: 2, remainingFlowFraction: 0.25, inletC: 30, ambientC: 28, loadsW: [200, 180, 220], coldWaterScale: 0.9, durationS: 900 }),
]);

function validateDesign(design) {
  if (!design || !Array.isArray(design.counts) || design.counts.length !== 3 || design.counts.some(n => !Number.isInteger(n) || n < 0 || n > 6) || design.counts.reduce((a, b) => a + b, 0) !== 6) throw new RangeError('A design needs exactly six tiles across three branches.');
  if (!Number.isFinite(design.backupTriggerC) || design.backupTriggerC < 25 || design.backupTriggerC > 100) throw new RangeError('Backup threshold must be 25–100°C.');
  if (!Number.isFinite(design.backupFlowFraction) || design.backupFlowFraction < 0 || design.backupFlowFraction > 1) throw new RangeError('Backup flow fraction must be between zero and one.');
}

function normalizeDesign(input) {
  const design = { ...input, backupTriggerC: input?.backupTriggerC ?? input?.triggerC };
  validateDesign(design);
  return design;
}

function context(input) {
  const s = { ...baseScenario, ...input };
  if (!Array.isArray(s.loadsW) || s.loadsW.length !== 3 || s.loadsW.some(w => !Number.isFinite(w) || w <= 0)) throw new RangeError('Three finite, positive server loads are required.');
  if (!Number.isInteger(s.faultBranch) || s.faultBranch < 0 || s.faultBranch > 2) throw new RangeError('Unknown fault branch.');
  for (const field of ['durationS', 'normalFlowScale', 'coldWaterScale', 'bypassScale']) if (!Number.isFinite(s[field]) || s[field] <= 0) throw new RangeError(`${field} must be positive.`);
  if (!Number.isFinite(s.faultStartS) || s.faultStartS < 0 || !Number.isFinite(s.remainingFlowFraction) || s.remainingFlowFraction < 0 || s.remainingFlowFraction > 1) throw new RangeError('Invalid fault timing or remaining flow.');
  if (![s.inletC, s.ambientC].every(Number.isFinite)) throw new RangeError('Finite supply and room temperatures are required.');
  return {
    ...s,
    normalFlowKgS: EXPERIMENT_PARAMS.normalFlowKgS * s.normalFlowScale,
    coldWaterConductanceWK: PARAMS.coldWaterConductanceWK * s.coldWaterScale,
    bypassConductanceWK: PARAMS.bypassConductanceWK * s.bypassScale,
    capacities: [PARAMS.hotCapacityJK, PARAMS.coldCapacityJK, PARAMS.waterCapacityJK],
  };
}

export function backupPumpPowerW(flowKgS) {
  if (!Number.isFinite(flowKgS) || flowKgS < 0) throw new RangeError('Backup flow must be finite and nonnegative.');
  const p = EXPERIMENT_PARAMS;
  const pressurePa = p.backupReferencePressurePa * (flowKgS / p.backupReferenceFlowKgS) ** 2;
  return pressurePa * flowKgS / (p.waterDensityKgM3 * p.backupPumpEfficiency);
}

function thermalRates(t, branch, flowKgS, ctx) {
  const [hotC, coldC, waterC] = t;
  const teg = tegAt(hotC, coldC, branch.count);
  const bypassW = ctx.bypassConductanceWK * (hotC - coldC);
  const coldToWaterW = ctx.coldWaterConductanceWK * (coldC - waterC);
  const hotRoomW = PARAMS.hotAmbientConductanceWK * (hotC - ctx.ambientC);
  const coldRoomW = PARAMS.coldAmbientConductanceWK * (coldC - ctx.ambientC);
  const waterRoomW = PARAMS.waterAmbientConductanceWK * (waterC - ctx.ambientC);
  const waterExportW = flowKgS * PARAMS.waterCpJkgK * (waterC - ctx.inletC);
  const q = [branch.loadW - teg.heatInW - bypassW - hotRoomW,
    teg.heatOutW + bypassW - coldToWaterW - coldRoomW,
    coldToWaterW - waterExportW - waterRoomW];
  return { ...teg, q, d: q.map((v, i) => v / ctx.capacities[i]), waterExportW, ambientLossW: hotRoomW + coldRoomW + waterRoomW };
}

function solve3(matrix, rhs) {
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let k = 0; k < 3; k++) {
    let pivot = k;
    for (let i = k + 1; i < 3; i++) if (Math.abs(a[i][k]) > Math.abs(a[pivot][k])) pivot = i;
    [a[k], a[pivot]] = [a[pivot], a[k]];
    const divisor = a[k][k];
    for (let j = k; j < 4; j++) a[k][j] /= divisor;
    for (let i = 0; i < 3; i++) if (i !== k) {
      const f = a[i][k];
      for (let j = k; j < 4; j++) a[i][j] -= f * a[k][j];
    }
  }
  return a.map(row => row[3]);
}

function equilibrium(branch, ctx) {
  let t = [ctx.ambientC + 40, ctx.inletC + 10, ctx.inletC + 4];
  for (let iter = 0; iter < 25; iter++) {
    const q = thermalRates(t, branch, ctx.normalFlowKgS, ctx).q;
    if (Math.max(...q.map(Math.abs)) < 1e-9) return t;
    const epsilon = 1e-4;
    const columns = t.map((_, i) => {
      const shifted = [...t]; shifted[i] += epsilon;
      return thermalRates(shifted, branch, ctx.normalFlowKgS, ctx).q.map((v, j) => (v - q[j]) / epsilon);
    });
    const change = solve3([0, 1, 2].map(i => columns.map(column => column[i])), q.map(v => -v));
    t = t.map((v, i) => v + change[i]);
  }
  throw new Error('Thermal equilibrium failed to converge.');
}

function storedJ(branches, ctx) {
  return branches.reduce((sum, b) => sum + b.t.reduce((total, v, i) => total + ctx.capacities[i] * (v - ctx.ambientC), 0), 0);
}

/** A temperature-only policy: no fault status or future scenario is supplied. */
function updateController(branches, design) {
  for (const b of branches) {
    if (b.t[0] >= design.backupTriggerC) b.backupOn = true;
    else if (b.t[0] <= design.backupTriggerC - EXPERIMENT_PARAMS.hysteresisC) b.backupOn = false;
  }
}

function flows(branches, design, ctx, time) {
  return branches.map((b, i) => {
    const mainFlowKgS = ctx.normalFlowKgS * (time >= ctx.faultStartS && i === ctx.faultBranch ? ctx.remainingFlowFraction : 1);
    const backupFlowKgS = b.backupOn ? design.backupFlowFraction * EXPERIMENT_PARAMS.normalFlowKgS : 0;
    return { mainFlowKgS, backupFlowKgS, flowKgS: mainFlowKgS + backupFlowKgS, pumpW: backupPumpPowerW(backupFlowKgS) };
  });
}

function capture(branches, design, ctx, time) {
  const flow = flows(branches, design, ctx, time);
  const states = branches.map((b, i) => ({ hotC: b.t[0], coldC: b.t[1], waterC: b.t[2], count: b.count, loadW: b.loadW, backupOn: b.backupOn, ...flow[i], powerW: tegAt(b.t[0], b.t[1], b.count).powerW }));
  const totalPowerW = states.reduce((sum, b) => sum + b.powerW, 0);
  const backupPumpW = flow.reduce((sum, f) => sum + f.pumpW, 0);
  return { time, faultActive: time >= ctx.faultStartS, branches: states, totalPowerW, backupPumpW, netRecoveryW: totalPowerW - EXPERIMENT_PARAMS.addedRecoveryPumpW - backupPumpW };
}

/** Each candidate starts at its own pre-controller, all-open equilibrium.
 * This fixed protocol includes 30 healthy seconds before the failure. The
 * objective covers the entire trial; warm-up preparation is not included.
 */
export function runTrial(design, scenarioInput, { includeTrace = false } = {}) {
  design = normalizeDesign(design);
  const ctx = context(scenarioInput);
  const branches = design.counts.map((count, i) => {
    const b = { count, loadW: ctx.loadsW[i], backupOn: false };
    b.t = equilibrium(b, ctx);
    return b;
  });
  const initialStoredJ = storedJ(branches, ctx);
  let time = 0, generatedEnergyJ = 0, backupPumpEnergyJ = 0, waterExportEnergyJ = 0, ambientLossEnergyJ = 0;
  let maxHotC = Math.max(...branches.map(b => b.t[0]));
  const branchMaxHotC = branches.map(b => b.t[0]);
  const backupSeconds = [0, 0, 0];
  const trace = [];
  updateController(branches, design);
  if (includeTrace) trace.push(capture(branches, design, ctx, time));
  while (time < ctx.durationS - 1e-9) {
    updateController(branches, design);
    let interval = Math.min(EXPERIMENT_PARAMS.controllerPeriodS, ctx.durationS - time);
    if (time < ctx.faultStartS && time + interval > ctx.faultStartS) interval = ctx.faultStartS - time;
    const branchFlows = flows(branches, design, ctx, time);
    const substeps = Math.ceil(interval / EXPERIMENT_PARAMS.maximumStepS);
    const h = interval / substeps;
    for (let substep = 0; substep < substeps; substep++) {
      for (let i = 0; i < branches.length; i++) {
        const b = branches[i], flow = branchFlows[i], t = b.t;
        const r1 = thermalRates(t, b, flow.flowKgS, ctx);
        const r2 = thermalRates(t.map((v, j) => v + h * r1.d[j] / 2), b, flow.flowKgS, ctx);
        const r3 = thermalRates(t.map((v, j) => v + h * r2.d[j] / 2), b, flow.flowKgS, ctx);
        const r4 = thermalRates(t.map((v, j) => v + h * r3.d[j]), b, flow.flowKgS, ctx);
        const weighted = key => h * (r1[key] + 2 * r2[key] + 2 * r3[key] + r4[key]) / 6;
        b.t = t.map((v, j) => v + h * (r1.d[j] + 2 * r2.d[j] + 2 * r3.d[j] + r4.d[j]) / 6);
        generatedEnergyJ += weighted('powerW');
        waterExportEnergyJ += weighted('waterExportW');
        ambientLossEnergyJ += weighted('ambientLossW');
        backupPumpEnergyJ += h * flow.pumpW;
        if (b.backupOn) backupSeconds[i] += h;
        branchMaxHotC[i] = Math.max(branchMaxHotC[i], b.t[0]);
        maxHotC = Math.max(maxHotC, b.t[0]);
      }
    }
    time += interval;
    if (includeTrace && (Math.abs(time / EXPERIMENT_PARAMS.tracePeriodS - Math.round(time / EXPERIMENT_PARAMS.tracePeriodS)) < 1e-8 || time >= ctx.durationS - 1e-9)) trace.push(capture(branches, design, ctx, time));
  }
  const addedPumpEnergyJ = EXPERIMENT_PARAMS.addedRecoveryPumpW * time + backupPumpEnergyJ;
  const sourceEnergyJ = ctx.loadsW.reduce((a, b) => a + b, 0) * time;
  const energyResidualJ = sourceEnergyJ - generatedEnergyJ - waterExportEnergyJ - ambientLossEnergyJ - (storedJ(branches, ctx) - initialStoredJ);
  return {
    scenarioId: ctx.id || 'custom', label: ctx.label || 'Custom experiment',
    durationS: time, faultStartS: ctx.faultStartS, faultBranch: ctx.faultBranch,
    remainingFlowFraction: ctx.remainingFlowFraction,
    netEnergyJ: generatedEnergyJ - addedPumpEnergyJ,
    generatedEnergyJ, addedPumpEnergyJ, backupPumpEnergyJ,
    maxHotC, branchMaxHotC, backupSeconds,
    feasible: maxHotC <= EXPERIMENT_PARAMS.illustrativeLimitC,
    energyResidualJ,
    final: capture(branches, design, ctx, time),
    ...(includeTrace ? { trace } : {}),
  };
}

/** Held-out scenarios must only be evaluated after candidate selection. */
export function evaluateDesign(design, { split = 'train' } = {}) {
  design = normalizeDesign(design);
  if (split !== 'train' && split !== 'holdout') throw new RangeError('Unknown experiment split.');
  const scenarios = split === 'train' ? TRAIN_SCENARIOS : HOLDOUT_SCENARIOS;
  const trials = scenarios.map(s => runTrial(design, s));
  const worstNetEnergyJ = Math.min(...trials.map(t => t.netEnergyJ));
  return {
    design: { counts: [...design.counts], triggerC: design.backupTriggerC, backupFlowFraction: design.backupFlowFraction },
    split, scoreJ: worstNetEnergyJ, worstNetEnergyJ,
    meanNetEnergyJ: trials.reduce((sum, t) => sum + t.netEnergyJ, 0) / trials.length,
    maxHotC: Math.max(...trials.map(t => t.maxHotC)),
    feasible: trials.every(t => t.feasible), trials,
  };
}
