/** Frozen, independently seeded comparison. No tuning against held-out results. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runExperimentCampaign, PLANNER_PROTOCOL } from './dist/ai-planner.js';
import { evaluateDesign, TRAIN_SCENARIOS, HOLDOUT_SCENARIOS } from './dist/experiment-model.js';
import { PARAMS } from './dist/model.js';

const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
const budget = 18;
const digest = async path => createHash('sha256').update(await readFile(new URL(path, import.meta.url))).digest('hex');
const summarize = (design, train, holdout) => ({ design, train: { scoreJ: train.scoreJ, maxHotC: train.maxHotC, feasible: train.feasible }, holdout: { scoreJ: holdout.scoreJ, maxHotC: holdout.maxHotC, feasible: holdout.feasible } });
const runs = [];
for (const seed of seeds) {
  const result = await runExperimentCampaign({ evaluateDesign, seed, budget, yieldControl: async () => {} });
  runs.push({ seed, fixed: summarize(result.fixed.design, result.fixed.train, result.fixed.holdout), ...Object.fromEntries(['ai', 'random', 'placement'].map(method => [method, { ...summarize(result[method].best.design, result[method].best.outcome, result[method].holdout), learningCurve: result[method].history.map(r => ({ trial: r.trial, scoreJ: r.bestSoFar.scoreJ, feasible: r.bestSoFar.feasible })) }])) });
  console.log(JSON.stringify({ seed, ...Object.fromEntries(['ai', 'random', 'placement'].map(method => [method, { joules: +runs.at(-1)[method].holdout.scoreJ.toFixed(2), feasible: runs.at(-1)[method].holdout.feasible }])) }));
}
const methods = Object.fromEntries(['fixed', 'ai', 'random', 'placement'].map(method => {
  const values = runs.map(run => run[method].holdout.scoreJ).sort((a, b) => a - b);
  return [method, { count: runs.length, heldoutFeasibleRuns: runs.filter(run => run[method].holdout.feasible).length, positiveNetAndFeasibleRuns: runs.filter(run => run[method].holdout.feasible && run[method].holdout.scoreJ > 0).length, energyStatisticsIncludeUnsafeRuns: true, meanHeldoutWorstEnergyJ: values.reduce((a, b) => a + b, 0) / values.length, medianHeldoutWorstEnergyJ: (values[3] + values[4]) / 2, minimumHeldoutWorstEnergyJ: values[0], maximumHeldoutWorstEnergyJ: values.at(-1) }];
}));
const report = {
  description: 'Eight predeclared seeds, 18 observed training designs per method, fixed scenario protocol; no global optimum or hardware validation claimed.',
  simulated: true,
  seeds,
  budget,
  protocol: PLANNER_PROTOCOL,
  parameterProfile: PARAMS.parameterProfile,
  sharedThermalParameters: PARAMS,
  sourceSHA256: { planner: await digest('./dist/ai-planner.js'), physics: await digest('./dist/experiment-model.js'), thermalModel: await digest('./dist/model.js') },
  trainingScenarios: TRAIN_SCENARIOS,
  heldoutScenarios: HOLDOUT_SCENARIOS,
  heldoutUsedForSelection: false,
  interpretation: 'Read temperature feasibility alongside energy: a high-energy but over-temperature result is a failed design. Eight seeds are an illustrative benchmark, not a statistical proof of superiority. No algorithm or scenario was retuned after reviewing these held-out results.',
  methods,
  runs,
};
await writeFile(new URL('./dist/ai-benchmark.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ summary: methods }));
