/**
 * Heat Rescue: an illustrative, uncalibrated lumped thermal model.
 * This is not a CFD model, device certification, or prediction for a real rack.
 *
 * Equations: Ferrotec Thermoelectric Reference Guide §§11,13.
 * https://thermal.ferrotec.com/technology/thermoelectric-reference-guide/thermalref11/
 * https://thermal.ferrotec.com/technology/thermoelectric-reference-guide/thermalref13/
 * The equations are implemented independently. No manufacturer coefficient
 * table, software, figures, or measured dataset is distributed. Module values
 * alpha=0.05 V/K, R=2.5 ohm, K=0.6 W/K are independent round assumptions for
 * a synthetic benchmark, chosen before rerunning the license-clean release.
 * They are not fitted to a device, rounded manufacturer outputs, or calibration.
 * Temperature dependence, Thomson heating and conversion losses are unresolved.
 *
 * C dT/dt = heat in - heat out; conductive paths Q = G deltaT.
 * Flowing-water heat export = mdot cp (Twater - Tin).
 * Each branch has an isothermal hot plate, cold plate, and well-mixed water
 * volume. Bypass conduction lets heat avoid the tiles. A blocked branch has
 * zero main-line water flow, but retains its water and passive room heat
 * losses. An optional independent backup route can supply a blocked branch
 * at half normal flow. Branch flows do not redistribute. Main pump draw
 * remains constant; the assumed backup pump cost applies only when needed.
 */

const KELVIN = 273.15;

export const PARAMS = Object.freeze({
  branchCount: 3,
  totalTiles: 6,
  serverHeatW: 200,
  ambientC: 25,
  inletC: 25,
  flowKgS: 0.01,
  backupFlowKgS: 0.005,
  waterCpJkgK: 4183,
  hotCapacityJK: 900,
  coldCapacityJK: 450,
  waterCapacityJK: 418.3,
  bypassConductanceWK: 4,
  coldWaterConductanceWK: 25,
  hotAmbientConductanceWK: 1,
  coldAmbientConductanceWK: 2,
  waterAmbientConductanceWK: 0.5,
  basePumpW: 3,
  extraPumpW: 0.9,
  backupPumpW: 0.5,
  illustrativeLimitC: 80,
  parameterProfile: 'synthetic-open-v2',
  alphaVK: 0.05,
  resistanceOhm: 2.5,
  conductanceWK: 0.6,
  maximumStepS: 0.25,
});

/** Independent matched resistive loads: maximum power at fixed temperatures.
 * The displayed voltage is for ONE tile at its load, not a six-tile bus.
 * Kelvin is required for the Peltier heat terms. Negative differences reverse
 * voltage/current; a resistor can still receive nonnegative electrical power.
 */
export function tegAt(hotC, coldC, count = 2) {
  const p = PARAMS;
  const deltaC = hotC - coldC;
  const openCircuitV = p.alphaVK * deltaC;
  const currentA = openCircuitV / (2 * p.resistanceOhm);
  const voltageV = currentA * p.resistanceOhm;
  const perTilePowerW = currentA ** 2 * p.resistanceOhm;
  const heatInW = count * (p.alphaVK * (hotC + KELVIN) * currentA - 0.5 * currentA ** 2 * p.resistanceOhm + p.conductanceWK * deltaC);
  const heatOutW = count * (p.alphaVK * (coldC + KELVIN) * currentA + 0.5 * currentA ** 2 * p.resistanceOhm + p.conductanceWK * deltaC);
  return { deltaC, currentA: count ? currentA : 0, voltageV: count ? voltageV : 0, openCircuitV: count ? openCircuitV : 0, perTilePowerW, powerW: count * perTilePowerW, heatInW, heatOutW };
}

function rates(branch, temperatures = [branch.hotC, branch.coldC, branch.waterC], backupCooling = false) {
  const p = PARAMS;
  const [hotC, coldC, waterC] = temperatures;
  const teg = tegAt(hotC, coldC, branch.count);
  const bypassW = p.bypassConductanceWK * (hotC - coldC);
  const coldToWaterW = p.coldWaterConductanceWK * (coldC - waterC);
  const hotRoomW = p.hotAmbientConductanceWK * (hotC - p.ambientC);
  const coldRoomW = p.coldAmbientConductanceWK * (coldC - p.ambientC);
  const waterRoomW = p.waterAmbientConductanceWK * (waterC - p.ambientC);
  const backupActive = Boolean(branch.blocked && backupCooling);
  const flowKgS = branch.blocked ? (backupActive ? p.backupFlowKgS : 0) : p.flowKgS;
  const waterExportW = flowKgS * p.waterCpJkgK * (waterC - p.inletC);
  const heatRates = [
    p.serverHeatW - teg.heatInW - bypassW - hotRoomW,
    teg.heatOutW + bypassW - coldToWaterW - coldRoomW,
    coldToWaterW - waterExportW - waterRoomW,
  ];
  return {
    ...teg,
    derivatives: heatRates.map((q, i) => q / [p.hotCapacityJK, p.coldCapacityJK, p.waterCapacityJK][i]),
    heatRates,
    flowKgS,
    backupActive,
    bypassW,
    coldToWaterW,
    ambientLossW: hotRoomW + coldRoomW + waterRoomW,
    waterExportW,
  };
}

function solveLinear(matrix, rhs) {
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let k = 0; k < 3; k++) {
    let pivot = k;
    for (let r = k + 1; r < 3; r++) if (Math.abs(a[r][k]) > Math.abs(a[pivot][k])) pivot = r;
    [a[k], a[pivot]] = [a[pivot], a[k]];
    const divisor = a[k][k];
    for (let j = k; j < 4; j++) a[k][j] /= divisor;
    for (let r = 0; r < 3; r++) if (r !== k) {
      const factor = a[r][k];
      for (let j = k; j < 4; j++) a[r][j] -= factor * a[k][j];
    }
  }
  return a.map(row => row[3]);
}

function equilibrium(count) {
  const branch = { count, blocked: false };
  let t = [65, 35, 29];
  for (let iteration = 0; iteration < 30; iteration++) {
    const residual = rates(branch, t).heatRates;
    if (Math.max(...residual.map(Math.abs)) < 1e-10) return t;
    const epsilon = 1e-4;
    const columns = t.map((_, j) => {
      const perturbed = [...t];
      perturbed[j] += epsilon;
      return rates(branch, perturbed).heatRates.map((v, i) => (v - residual[i]) / epsilon);
    });
    const jacobian = [0, 1, 2].map(i => columns.map(column => column[i]));
    const correction = solveLinear(jacobian, residual.map(v => -v));
    t = t.map((v, i) => v + correction[i]);
  }
  throw new Error('Initial thermal equilibrium did not converge.');
}

function storedEnergyJ(branches) {
  const p = PARAMS;
  return branches.reduce((sum, b) => sum + p.hotCapacityJK * (b.hotC - p.ambientC) + p.coldCapacityJK * (b.coldC - p.ambientC) + p.waterCapacityJK * (b.waterC - p.ambientC), 0);
}

function validateCounts(counts) {
  if (!Array.isArray(counts) || counts.length !== 3 || counts.some(n => !Number.isInteger(n) || n < 0 || n > 6) || counts.reduce((a, b) => a + b, 0) !== 6) {
    throw new RangeError('Place exactly six whole tiles across three branches.');
  }
}

/** Starts each selected arrangement at its own all-open steady condition. */
export function createSimulation({ counts = [2, 2, 2] } = {}) {
  validateCounts(counts);
  const branches = counts.map((count, id) => {
    const [hotC, coldC, waterC] = equilibrium(count);
    return { id, count, blocked: false, hotC, coldC, waterC };
  });
  const sim = {
    time: 0,
    branches,
    backupCooling: false,
    generatedEnergyJ: 0,
    waterExportEnergyJ: 0,
    ambientLossEnergyJ: 0,
    serverEnergyJ: 0,
    initialStoredEnergyJ: storedEnergyJ(branches),
    baseline: null,
  };
  const initial = snapshot(sim);
  sim.baseline = {
    totalPowerW: initial.totalPowerW,
    maxHotC: initial.maxHotC,
    netRecoveryW: initial.netRecoveryW,
    pumpPowerW: initial.pumpPowerW,
    branches: initial.branches.map(b => ({ hotC: b.hotC, coldC: b.coldC, waterC: b.waterC, powerW: b.powerW, deltaC: b.deltaC })),
  };
  return sim;
}

export function setBlocked(sim, branchIndex, blocked) {
  if (!Number.isInteger(branchIndex) || !sim.branches[branchIndex]) throw new RangeError('Unknown cooling branch.');
  sim.branches[branchIndex].blocked = Boolean(blocked);
  return snapshot(sim);
}

/** Enables an assumed separately powered, independent backup water route.
 * It does not unblock the failed main pipe. Its 0.5 W electrical cost is an
 * explicit scenario assumption, not a derived pump curve or measured value.
 */
export function setBackupCooling(sim, enabled) {
  sim.backupCooling = Boolean(enabled);
  return snapshot(sim);
}

/** Fourth-order Runge–Kutta, internally substepped for stable realtime use. */
export function step(sim, dtSeconds) {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) throw new RangeError('Elapsed time must be finite and nonnegative.');
  if (dtSeconds === 0) return snapshot(sim);
  const n = Math.ceil(dtSeconds / PARAMS.maximumStepS);
  const h = dtSeconds / n;
  for (let iteration = 0; iteration < n; iteration++) {
    for (const b of sim.branches) {
      const t = [b.hotC, b.coldC, b.waterC];
      const r1 = rates(b, t, sim.backupCooling);
      const r2 = rates(b, t.map((v, i) => v + h * r1.derivatives[i] / 2), sim.backupCooling);
      const r3 = rates(b, t.map((v, i) => v + h * r2.derivatives[i] / 2), sim.backupCooling);
      const r4 = rates(b, t.map((v, i) => v + h * r3.derivatives[i]), sim.backupCooling);
      const weighted = key => (r1[key] + 2 * r2[key] + 2 * r3[key] + r4[key]) / 6;
      const next = t.map((v, i) => v + h * (r1.derivatives[i] + 2 * r2.derivatives[i] + 2 * r3.derivatives[i] + r4.derivatives[i]) / 6);
      [b.hotC, b.coldC, b.waterC] = next;
      sim.generatedEnergyJ += h * weighted('powerW');
      sim.waterExportEnergyJ += h * weighted('waterExportW');
      sim.ambientLossEnergyJ += h * weighted('ambientLossW');
    }
    sim.serverEnergyJ += h * PARAMS.serverHeatW * PARAMS.branchCount;
    sim.time += h;
  }
  return snapshot(sim);
}

export function snapshot(sim) {
  const p = PARAMS;
  const branches = sim.branches.map(b => {
    const r = rates(b, undefined, sim.backupCooling);
    const storedHeatRateW = r.heatRates.reduce((a, v) => a + v, 0);
    return {
      id: b.id, count: b.count, blocked: b.blocked,
      hotC: b.hotC, coldC: b.coldC, waterC: b.waterC,
      flow: r.flowKgS / p.flowKgS,
      backupActive: r.backupActive,
      flowKgS: r.flowKgS,
      flowLitresMin: r.flowKgS * 60,
      deltaC: r.deltaC,
      powerW: r.powerW,
      voltageV: r.voltageV,
      currentA: r.currentA,
      heatInW: r.heatInW,
      heatOutW: r.heatOutW,
      bypassW: r.bypassW,
      ambientLossW: r.ambientLossW,
      waterExportW: r.waterExportW,
      storedHeatRateW,
      energyBalanceW: p.serverHeatW - r.powerW - r.ambientLossW - r.waterExportW - storedHeatRateW,
    };
  });
  const sum = key => branches.reduce((total, b) => total + b[key], 0);
  const energyStoredJ = storedEnergyJ(sim.branches);
  const backupActive = branches.some(b => b.backupActive);
  const backupPumpW = backupActive ? p.backupPumpW : 0;
  return {
    time: sim.time,
    branches,
    totalPowerW: sum('powerW'),
    serverHeatW: p.serverHeatW * p.branchCount,
    backupCooling: sim.backupCooling,
    backupActive,
    backupPumpW,
    pumpPowerW: p.basePumpW + p.extraPumpW + backupPumpW,
    baselinePumpW: p.basePumpW,
    incrementalPumpW: p.extraPumpW + backupPumpW,
    netRecoveryW: sum('powerW') - p.extraPumpW - backupPumpW,
    maxHotC: Math.max(...branches.map(b => b.hotC)),
    maxColdC: Math.max(...branches.map(b => b.coldC)),
    ambientLossW: sum('ambientLossW'),
    waterExportW: sum('waterExportW'),
    storedHeatRateW: sum('storedHeatRateW'),
    energyBalanceW: sum('energyBalanceW'),
    energyStoredJ,
    generatedEnergyJ: sim.generatedEnergyJ,
    generatedWh: sim.generatedEnergyJ / 3600,
    energyResidualJ: sim.serverEnergyJ - sim.generatedEnergyJ - sim.waterExportEnergyJ - sim.ambientLossEnergyJ - (energyStoredJ - sim.initialStoredEnergyJ),
    illustrativeLimitC: p.illustrativeLimitC,
    withinIllustrativeLimit: branches.every(b => b.hotC < p.illustrativeLimitC),
    baseline: sim.baseline,
  };
}

/** A reproducible model comparison, not proof of an optimal physical rack.
 * Each trial starts fresh at the layout's all-open equilibrium. Reports the
 * worst sampled power and hottest hot plate during one blocked-branch trial.
 */
export function evaluateLayout(counts, { faultSeconds = 120 } = {}) {
  validateCounts(counts);
  if (!Number.isFinite(faultSeconds) || faultSeconds < 0) throw new RangeError('Fault duration must be nonnegative.');
  const trials = [0, 1, 2].map(blockedBranch => {
    const sim = createSimulation({ counts });
    let s = setBlocked(sim, blockedBranch, true);
    let minimumNetRecoveryW = s.netRecoveryW;
    let maxHotC = s.maxHotC;
    while (sim.time < faultSeconds - 1e-9) {
      s = step(sim, Math.min(1, faultSeconds - sim.time));
      minimumNetRecoveryW = Math.min(minimumNetRecoveryW, s.netRecoveryW);
      maxHotC = Math.max(maxHotC, s.maxHotC);
    }
    return { blockedBranch, netRecoveryW: s.netRecoveryW, minimumNetRecoveryW, maxHotC, totalPowerW: s.totalPowerW };
  });
  const maxHotC = Math.max(...trials.map(t => t.maxHotC));
  return { counts: [...counts], faultSeconds, worstNetRecoveryW: Math.min(...trials.map(t => t.minimumNetRecoveryW)), maxHotC, withinIllustrativeLimit: maxHotC < PARAMS.illustrativeLimitC, trials };
}
