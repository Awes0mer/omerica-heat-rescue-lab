import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateDesigns, designKey, fitGaussianProcess, expectedImprovement, chooseNext, runExperimentCampaign } from './dist/ai-planner.js';

test('candidate space fixes the hardware budget and contains 448 distinct designs', () => {
  const designs = candidateDesigns();
  assert.equal(designs.length, 448);
  assert.equal(new Set(designs.map(designKey)).size, 448);
  assert.ok(designs.every(d => d.counts.reduce((a, b) => a + b) === 6));
});

test('GP learns observed values with low uncertainty and extrapolates with more uncertainty', () => {
  const model = fitGaussianProcess([[0], [0.5], [1]], [0, 5, 10], { lengthScales: [0.5] });
  for (const [x, y] of [[0, 0], [0.5, 5], [1, 10]]) assert.ok(Math.abs(model.predict([x]).mean - y) < 0.0001);
  assert.ok(model.predict([2]).sd > 100 * model.predict([0.5]).sd);
  assert.ok(model.predict([0.75]).mean > model.predict([0.25]).mean);
});

test('expected improvement retains exploration when the predicted mean equals the incumbent', () => {
  assert.ok(Math.abs(expectedImprovement(3, 2, 3) - 2 / Math.sqrt(2 * Math.PI)) < 1e-10);
  assert.equal(expectedImprovement(5, 0, 3), 2);
  assert.equal(expectedImprovement(2, 0, 3), 0);
});

test('changed measured outcomes change the next AI experiment, with no prerecorded winner', () => {
  const candidates = [0, 1, 2, 3, 4, 5, 6].map(n => ({ counts: [n, 6 - n, 0], triggerC: 74, backupFlowFraction: 0.5 }));
  const history = values => [0, 3, 6].map((n, i) => ({ design: candidates[n], outcome: { scoreJ: values[i], maxHotC: 70, feasible: true } }));
  const nextLeft = chooseNext(history([100, 20, 0]), candidates, { seed: 8 });
  const nextRight = chooseNext(history([0, 20, 100]), candidates, { seed: 8 });
  assert.notEqual(designKey(nextLeft.design), designKey(nextRight.design));
  assert.ok(nextLeft.design.counts[0] < nextRight.design.counts[0]);
  assert.ok(nextLeft.prediction.sdEnergyJ > 0);
});

function syntheticOutcome(design, split) {
  // Deliberately independent test function, not the thermodynamic model.
  const scoreJ = 200 - 15 * (design.counts[0] - 3) ** 2 - 5 * (design.counts[1] - 2) ** 2 - 0.5 * (design.triggerC - 70) ** 2 - 30 * (design.backupFlowFraction - 0.5) ** 2 + (split === 'holdout' ? -17 : 0);
  const maxHotC = 70 + design.counts[2] + design.backupFlowFraction;
  return { scoreJ, worstNetEnergyJ: scoreJ, meanNetEnergyJ: scoreJ + 10, maxHotC, feasible: maxHotC < 80, trials: [] };
}

test('campaign uses equal budgets, shared initial data, no repeated candidates, and holds out evaluation until winners are frozen', async () => {
  const calls = [];
  const records = [];
  const run = () => runExperimentCampaign({ budget: 12, seed: 42, evaluateDesign: (d, { split }) => { calls.push({ design: d, split }); return syntheticOutcome(d, split); }, onTrial: r => records.push(r), yieldControl: async () => {} });
  const result = await run();
  assert.equal(result.ai.history.length, 12);
  assert.equal(result.random.history.length, 12);
  assert.equal(result.placement.history.length, 12);
  assert.equal(records.length, 36);
  for (const method of ['ai', 'random', 'placement']) assert.equal(new Set(result[method].history.map(r => designKey(r.design))).size, 12);
  assert.ok(result.placement.history.every(r => r.design.triggerC === 74 && r.design.backupFlowFraction === 0.5));
  assert.deepEqual(result.ai.history.slice(0, 4).map(r => r.outcome), result.random.history.slice(0, 4).map(r => r.outcome));
  assert.ok(calls.filter(c => c.split === 'train').length <= 31, 'common starting observations are cached, with exactly 12 available to each search');
  const firstHeldout = calls.findIndex(c => c.split === 'holdout');
  assert.ok(firstHeldout > 0);
  assert.ok(calls.slice(firstHeldout).every(c => c.split === 'holdout'));
  assert.equal(result.metadata.heldoutUsedForSelection, false);
  assert.deepEqual(result.ai.best, (await run()).ai.best, 'same seed and observations give reproducible selection');
});

test('held-out outcomes cannot influence the selected designs', async () => {
  const run = offset => runExperimentCampaign({ budget: 9, seed: 81, evaluateDesign: (d, { split }) => { const r = syntheticOutcome(d, split); if (split === 'holdout') r.scoreJ += offset * d.counts[0]; return r; }, yieldControl: async () => {} });
  const first = await run(-10000);
  const second = await run(10000);
  assert.deepEqual(first.ai.best, second.ai.best);
  assert.deepEqual(first.random.best, second.random.best);
  assert.deepEqual(first.placement.best, second.placement.best);
});

test('search reports unsafe simulations honestly and supports cancellation', async () => {
  const unsafe = await runExperimentCampaign({ budget: 5, seed: 3, evaluateDesign: d => ({ scoreJ: 10 + d.counts[0], maxHotC: 90 + d.counts[1], feasible: false }), yieldControl: async () => {} });
  assert.equal(unsafe.ai.best.outcome.feasible, false);
  assert.equal(unsafe.ai.holdout.feasible, false);
  await assert.rejects(runExperimentCampaign({ evaluateDesign: syntheticOutcome, shouldStop: () => true }), { name: 'AbortError' });
});

test('the exact 80 C comparison boundary agrees with the physical evaluator', async () => {
  const result = await runExperimentCampaign({ budget: 4, seed: 1, evaluateDesign: () => ({ scoreJ: 1, maxHotC: 80, feasible: true }), yieldControl: async () => {} });
  assert.equal(result.ai.best.outcome.feasible, true);
  assert.equal(result.ai.holdout.maxHotC, 80);
  await assert.rejects(runExperimentCampaign({ budget: 4, seed: 1, evaluateDesign: () => ({ scoreJ: 1, maxHotC: 80.0001, feasible: true }), yieldControl: async () => {} }), /disagree/);
});

test('proposal is awaited and exposes only predictions before the physics evaluation', async () => {
  let proposalReady = false;
  let proposedKey = null;
  let proposals = 0;
  await runExperimentCampaign({
    budget: 5, seed: 9, yieldControl: async () => {},
    async onProposal(proposal) {
      proposalReady = false;
      assert.deepEqual(Object.keys(proposal).sort(), ['design', 'method', 'phase', 'prediction', 'reason', 'trial']);
      assert.equal('outcome' in proposal, false);
      assert.equal('bestSoFar' in proposal, false);
      proposedKey = designKey(proposal.design);
      await Promise.resolve();
      proposalReady = true;
      proposals++;
    },
    evaluateDesign(design, { split }) {
      if (split === 'train') {
        assert.equal(proposalReady, true, 'asynchronous proposal callback must finish before simulation starts');
        assert.equal(designKey(design), proposedKey);
      }
      return syntheticOutcome(design, split);
    },
  });
  assert.equal(proposals, 15, 'all three methods announce all five observations, including shared starts');
});
