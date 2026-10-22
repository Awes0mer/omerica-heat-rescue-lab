/**
 * Browser-local constrained Bayesian optimization. This is a small, genuine
 * Gaussian-process learning loop, not an LLM and not a scripted winning path.
 * Models are refitted from observed simulation results after every experiment.
 * The fixed kernel/hyperparameters below are modeling choices, not a new method.
 * https://arxiv.org/abs/1206.2944
 * https://arxiv.org/abs/1403.5607
 * Surrogate uncertainty is NOT calibrated real-world uncertainty or a safety
 * guarantee. Every candidate's feasibility is checked by the thermal simulator.
 */

export const DEFAULT_DESIGN = Object.freeze({ counts: Object.freeze([2, 2, 2]), triggerC: 74, backupFlowFraction: 0.5 });
export const PLANNER_PROTOCOL = Object.freeze({
  version: 'heat-rescue-bo-v1',
  defaultBudget: 18,
  warmupTrials: 4,
  temperatureLimitC: 80,
  triggersC: Object.freeze([66, 70, 74, 78]),
  flowFractions: Object.freeze([0.25, 0.5, 0.75, 1]),
  lengthScales: Object.freeze([0.32, 0.32, 0.32, 0.5, 0.5]),
  noiseVariance: 0.000001,
  objective: 'Maximize worst-case generated energy minus modeled incremental cooling energy, subject to peak hot-plate temperature at or below 80 C.',
});

const clone = value => JSON.parse(JSON.stringify(value));
export const designKey = d => `${d.counts.join(',')}|${d.triggerC}|${d.backupFlowFraction}`;
export const designFeatures = d => [...d.counts.map(n => n / 6), (d.triggerC - 66) / 12, (d.backupFlowFraction - 0.25) / 0.75];

export function candidateDesigns() {
  const designs = [];
  for (let a = 0; a <= 6; a++) for (let b = 0; b <= 6 - a; b++) {
    for (const triggerC of PLANNER_PROTOCOL.triggersC) for (const backupFlowFraction of PLANNER_PROTOCOL.flowFractions) {
      designs.push({ counts: [a, b, 6 - a - b], triggerC, backupFlowFraction });
    }
  }
  return designs;
}

/** Mulberry32: Tommy Ettinger (2017), CC0; JavaScript adaptation published
 * in bryc/code under its public-domain dedication. Attribution and full
 * license: third-party/MULBERRY32-LICENSE.txt and third-party/CC0-1.0.txt.
 * https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 * https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 * The state transition is unchanged. For simulation sampling, not security.
 */
export function seededRandom(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffled(items, rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function kernel(a, b, lengths) {
  let distance = 0;
  for (let i = 0; i < a.length; i++) distance += ((a[i] - b[i]) / lengths[i]) ** 2;
  return Math.exp(-0.5 * distance);
}

function cholesky(matrix) {
  const n = matrix.length;
  const lower = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let value = matrix[i][j];
    for (let k = 0; k < j; k++) value -= lower[i][k] * lower[j][k];
    if (i === j) {
      if (value <= 0 || !Number.isFinite(value)) throw new Error('Surrogate covariance is not positive definite.');
      lower[i][j] = Math.sqrt(value);
    } else lower[i][j] = value / lower[j][j];
  }
  return lower;
}

function solveLower(lower, vector) {
  const answer = new Float64Array(vector.length);
  for (let i = 0; i < answer.length; i++) {
    let value = vector[i];
    for (let j = 0; j < i; j++) value -= lower[i][j] * answer[j];
    answer[i] = value / lower[i][i];
  }
  return answer;
}

function solveUpperFromLower(lower, vector) {
  const answer = new Float64Array(vector.length);
  for (let i = answer.length - 1; i >= 0; i--) {
    let value = vector[i];
    for (let j = i + 1; j < answer.length; j++) value -= lower[j][i] * answer[j];
    answer[i] = value / lower[i][i];
  }
  return answer;
}

/** Fixed RBF kernel, standardized targets, small numerical observation nugget.
 * Fitting computes K^-1 y from ALL observations. No outcomes are preloaded.
 */
export function fitGaussianProcess(points, values, { lengthScales = PLANNER_PROTOCOL.lengthScales, noiseVariance = PLANNER_PROTOCOL.noiseVariance, minimumScale = 0.01 } = {}) {
  if (!points.length || points.length !== values.length || values.some(v => !Number.isFinite(v))) throw new RangeError('A GP needs finite, paired training observations.');
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const scale = Math.max(minimumScale, Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length));
  const covariance = points.map((a, i) => points.map((b, j) => kernel(a, b, lengthScales) + (i === j ? noiseVariance : 0)));
  const lower = cholesky(covariance);
  const alpha = solveUpperFromLower(lower, solveLower(lower, values.map(v => (v - mean) / scale)));
  return {
    observationCount: points.length,
    predict(point) {
      const cross = points.map(p => kernel(point, p, lengthScales));
      const solved = solveLower(lower, cross);
      const standardizedMean = cross.reduce((sum, value, i) => sum + value * alpha[i], 0);
      const variance = Math.max(1e-12, 1 - solved.reduce((sum, v) => sum + v * v, 0));
      return { mean: mean + scale * standardizedMean, sd: scale * Math.sqrt(variance) };
    },
  };
}

export function normalCDF(z) {
  // Abramowitz & Stegun (1964), Handbook of Mathematical Functions,
  // NBS Applied Mathematics Series 55, p.299, equation 7.1.26.
  // Original implementation of the published mathematical formula, not copied
  // library code or book prose. Government publication source and rights:
  // https://www.nist.gov/mathematics-statistics/handbook-mathematical-functions-abramowitz-and-stegun
  // https://www.nist.gov/open/license
  // Bounded normal-CDF approximation.
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + Math.sign(z) * erf);
}

export function expectedImprovement(mean, sd, incumbent) {
  if (sd < 1e-12) return Math.max(0, mean - incumbent);
  const z = (mean - incumbent) / sd;
  return Math.max(0, (mean - incumbent) * normalCDF(z) + sd * Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI));
}

function bestRecord(history) {
  return history.reduce((best, trial) => {
    if (!best) return trial;
    if (trial.outcome.feasible !== best.outcome.feasible) return trial.outcome.feasible ? trial : best;
    if (!trial.outcome.feasible && trial.outcome.maxHotC !== best.outcome.maxHotC) return trial.outcome.maxHotC < best.outcome.maxHotC ? trial : best;
    return trial.outcome.scoreJ > best.outcome.scoreJ ? trial : best;
  }, null);
}

export function fitSurrogates(history) {
  const points = history.map(record => designFeatures(record.design));
  const energy = fitGaussianProcess(points, history.map(record => record.outcome.scoreJ));
  const heat = fitGaussianProcess(points, history.map(record => record.outcome.maxHotC), { minimumScale: 0.25 });
  const feasible = history.filter(record => record.outcome.feasible);
  const incumbent = feasible.length ? Math.max(...feasible.map(record => record.outcome.scoreJ)) : null;
  return {
    observationCount: history.length,
    predict(design) {
      const features = designFeatures(design);
      const e = energy.predict(features);
      const h = heat.predict(features);
      const probabilityFeasible = normalCDF((PLANNER_PROTOCOL.temperatureLimitC - h.mean) / Math.max(h.sd, 1e-9));
      const improvement = incumbent === null ? 0 : expectedImprovement(e.mean, e.sd, incumbent);
      return { meanEnergyJ: e.mean, sdEnergyJ: e.sd, meanHotC: h.mean, sdHotC: h.sd, probabilityFeasible, expectedImprovementJ: improvement, acquisition: incumbent === null ? probabilityFeasible * (1 + 0.05 * h.sd) : improvement * probabilityFeasible, hasFeasibleIncumbent: incumbent !== null };
    },
  };
}

/** Select an UNOBSERVED design from predictions made only from training trials. */
export function chooseNext(history, candidates = candidateDesigns(), { seed = 0 } = {}) {
  if (!history.length) throw new RangeError('Observe at least one experiment before fitting the planner.');
  const used = new Set(history.map(record => designKey(record.design)));
  const available = shuffled(candidates.filter(d => !used.has(designKey(d))), seededRandom(seed));
  if (!available.length) return null;
  const model = fitSurrogates(history);
  let selected = null;
  for (const design of available) {
    const prediction = model.predict(design);
    if (!selected || prediction.acquisition > selected.prediction.acquisition) selected = { design: clone(design), prediction };
  }
  const p = selected.prediction;
  selected.reason = p.hasFeasibleIncumbent
    ? `The learned model predicts ${p.meanEnergyJ.toFixed(1)} J, with ${p.sdEnergyJ.toFixed(1)} J surrogate uncertainty. Expected improvement ${p.expectedImprovementJ.toFixed(1)} J is weighted by ${(100 * p.probabilityFeasible).toFixed(0)}% predicted temperature feasibility.`
    : `No observed design has met the temperature limit yet. Test a design with ${(100 * p.probabilityFeasible).toFixed(0)}% predicted feasibility; this is a surrogate estimate, not a safety guarantee.`;
  return selected;
}

function checkOutcome(outcome) {
  if (!outcome || !Number.isFinite(outcome.scoreJ) || !Number.isFinite(outcome.maxHotC) || typeof outcome.feasible !== 'boolean') throw new TypeError('Experiment must return finite scoreJ and maxHotC, and boolean feasible.');
  if (outcome.feasible !== (outcome.maxHotC <= PLANNER_PROTOCOL.temperatureLimitC)) throw new Error('Experiment and planner disagree about the 80 C constraint.');
}

/** The only experiment entry point is the supplied deterministic simulator.
 * Joint-design AI and random search get the same four initial observations.
 * Placement-only search gets four starts within its restricted design space.
 * All searches get the same total trial budget. Shared warmup results are
 * cached, not secretly extra information.
 * Holdout results are requested only AFTER all final selections are frozen;
 * neither surrogate, candidate selection nor winner selection can access them.
 */
export async function runExperimentCampaign({ evaluateDesign, budget = 18, seed = 20261022, includePlacement = true, onProposal = () => {}, onTrial = () => {}, onStage = () => {}, shouldStop = () => false, yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)) } = {}) {
  if (typeof evaluateDesign !== 'function') throw new TypeError('Supply a physics evaluator.');
  const candidates = candidateDesigns();
  const placementCandidates = candidates.filter(d => d.triggerC === DEFAULT_DESIGN.triggerC && d.backupFlowFraction === DEFAULT_DESIGN.backupFlowFraction);
  const maximumBudget = includePlacement ? placementCandidates.length : candidates.length;
  if (!Number.isInteger(budget) || budget < PLANNER_PROTOCOL.warmupTrials || budget > maximumBudget) throw new RangeError(`Budget must be an integer from 4 to ${maximumBudget}.`);
  const stopCheck = () => { if (shouldStop()) { const error = new Error('Experiment campaign stopped.'); error.name = 'AbortError'; throw error; } };
  const stage = async (name, message) => { stopCheck(); await onStage({ stage: name, message }); await yieldControl(); };
  const aiHistory = [];
  const randomHistory = [];
  const placementHistory = [];
  const initialRng = seededRandom(seed);
  const initial = [clone(DEFAULT_DESIGN), ...shuffled(candidates.filter(d => designKey(d) !== designKey(DEFAULT_DESIGN)), initialRng).slice(0, PLANNER_PROTOCOL.warmupTrials - 1)];
  const observe = async (method, history, design, phase, prediction, reason, cached) => {
    stopCheck();
    await onProposal({ method, trial: history.length + 1, phase, design: clone(design), prediction: prediction ? clone(prediction) : null, reason });
    stopCheck();
    const outcome = cached ? clone(cached) : await evaluateDesign(clone(design), { split: 'train' });
    checkOutcome(outcome);
    const record = { method, trial: history.length + 1, phase, design: clone(design), prediction: prediction ? clone(prediction) : null, reason, outcome: clone(outcome), bestSoFar: null };
    history.push(record);
    const best = bestRecord(history);
    record.bestSoFar = { design: clone(best.design), scoreJ: best.outcome.scoreJ, maxHotC: best.outcome.maxHotC, feasible: best.outcome.feasible };
    await onTrial(clone(record));
    await yieldControl();
    return record;
  };

  await stage('warmup', 'Run four shared starting experiments. Both searches receive exactly the same initial observations.');
  for (const design of initial) {
    const observed = await observe('ai', aiHistory, design, 'warmup', null, 'Shared starting experiment; no learned prediction yet.');
    await observe('random', randomHistory, design, 'warmup', null, 'Same starting observation supplied to both methods.', observed.outcome);
  }

  if (includePlacement) {
    await stage('placement', 'Initialize the placement-only comparison: the same six tiles, with trigger fixed at 74 C and backup flow fixed at 50%.');
    const placementInitial = [clone(DEFAULT_DESIGN), ...shuffled(placementCandidates.filter(d => designKey(d) !== designKey(DEFAULT_DESIGN)), seededRandom(seed ^ 0x241E351B)).slice(0, PLANNER_PROTOCOL.warmupTrials - 1)];
    for (const design of placementInitial) {
      const sameObservation = aiHistory.find(record => designKey(record.design) === designKey(design));
      await observe('placement', placementHistory, design, 'warmup', null, 'Starting experiment for placement-only search; cooling trigger and flow stay fixed.', sameObservation?.outcome);
    }
  }

  const randomQueue = shuffled(candidates.filter(d => !initial.some(first => designKey(first) === designKey(d))), seededRandom(seed ^ 0xA511E9B3));
  for (let trial = PLANNER_PROTOCOL.warmupTrials; trial < budget; trial++) {
    await stage('ai', `AI experiment ${trial + 1} of ${budget}: refit the surrogate from ${aiHistory.length} observations and choose the next design.`);
    const proposal = chooseNext(aiHistory, candidates, { seed: seed + trial });
    await observe('ai', aiHistory, proposal.design, 'learned', proposal.prediction, proposal.reason);
    await stage('random', `Random experiment ${trial + 1} of ${budget}: sample one unused design without consulting outcomes.`);
    await observe('random', randomHistory, randomQueue[trial - PLANNER_PROTOCOL.warmupTrials], 'random', null, 'Seeded uniform sampling without using observed outcomes.');
    if (includePlacement) {
      await stage('placement', `Placement-only experiment ${trial + 1} of ${budget}: learn where to put the tiles while keeping the same cooling policy.`);
      const placementProposal = chooseNext(placementHistory, placementCandidates, { seed: seed + trial });
      await observe('placement', placementHistory, placementProposal.design, 'learned', placementProposal.prediction, `Cooling policy stays fixed. ${placementProposal.reason}`);
    }
  }

  // Freeze all three selections BEFORE revealing any held-out scenario output.
  const aiSelected = clone(bestRecord(aiHistory));
  const randomSelected = clone(bestRecord(randomHistory));
  const placementSelected = includePlacement ? clone(bestRecord(placementHistory)) : null;
  const fixedTrain = clone(aiHistory[0].outcome);
  await stage('holdout', 'Freeze every selected design. Now test the fixed baseline and search winners on previously unused fault scenarios.');
  const heldoutCache = new Map();
  const heldout = async design => {
    stopCheck();
    const key = designKey(design);
    if (!heldoutCache.has(key)) {
      const outcome = await evaluateDesign(clone(design), { split: 'holdout' });
      checkOutcome(outcome);
      heldoutCache.set(key, clone(outcome));
      await yieldControl();
    }
    return clone(heldoutCache.get(key));
  };
  const fixed = { design: clone(DEFAULT_DESIGN), train: fixedTrain, holdout: await heldout(DEFAULT_DESIGN) };
  const ai = { history: aiHistory, best: { design: aiSelected.design, outcome: aiSelected.outcome }, holdout: await heldout(aiSelected.design) };
  const random = { history: randomHistory, best: { design: randomSelected.design, outcome: randomSelected.outcome }, holdout: await heldout(randomSelected.design) };
  const placement = includePlacement ? { history: placementHistory, best: { design: placementSelected.design, outcome: placementSelected.outcome }, holdout: await heldout(placementSelected.design) } : null;
  const result = { seed, budget, candidateCount: candidates.length, placementCandidateCount: placementCandidates.length, fixed, ai, random, placement, metadata: { protocol: PLANNER_PROTOCOL, simulated: true, method: 'Constrained Bayesian optimization with two Gaussian-process surrogates and expected improvement', objectiveUnits: 'joules of incremental net electrical recovery', uncertaintyMeaning: 'Predictive uncertainty of the fitted surrogate, not real-world safety or measurement uncertainty.', sharedStartingTrials: PLANNER_PROTOCOL.warmupTrials, evaluatedDesignsPerMethod: budget, placementAblation: includePlacement, heldoutUsedForSelection: false, optimalityProven: false, aiWinGuaranteed: false } };
  await stage('complete', 'Experiment complete. Report observed outcomes, including failures; no improvement or global optimum is guaranteed.');
  return result;
}
