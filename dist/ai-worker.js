import { runExperimentCampaign } from './ai-planner.js';
import { PARAMS } from './model.js';
import { evaluateDesign, runTrial, EXPERIMENT_PARAMS, TRAIN_SCENARIOS, HOLDOUT_SCENARIOS } from './experiment-model.js';

self.onmessage = async ({ data }) => {
  if (data.type !== 'start') return;
  try {
    const result = await runExperimentCampaign({
      evaluateDesign, budget: data.budget, seed: data.seed,
      onStage: stage => self.postMessage({ type: 'stage', stage }),
      onProposal: async proposal => {
        self.postMessage({ type: 'proposal', proposal });
        await new Promise(resolve => setTimeout(resolve, 160));
      },
      onTrial: async record => {
        self.postMessage({ type: 'trial', record });
        // Pause only the presentation, never the simulated physics or search.
        await new Promise(resolve => setTimeout(resolve, 130));
      },
    });
    const replays = HOLDOUT_SCENARIOS.map(scenario => ({
      scenario, ...runTrial(result.ai.best.design, scenario, { includeTrace: true }),
    }));
    self.postMessage({ type: 'complete', result: {
      ...result, parameters: EXPERIMENT_PARAMS, sharedThermalParameters: PARAMS,
      trainingScenarios: TRAIN_SCENARIOS, heldoutScenarios: HOLDOUT_SCENARIOS,
      replays, generatedAt: new Date().toISOString(),
    } });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
};
