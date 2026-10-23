import { createSimulation, setBlocked, setBackupCooling, step, snapshot } from './model.js';

// The guide uses the same teaching model. Each stop is a fresh, paused example.
export function createDemoRun({ scenario, seconds = 0 }) {
  if (!['baseline', 'blocked', 'backup'].includes(scenario) ||
      !Number.isInteger(seconds) || seconds < 0 || seconds > 600) {
    throw new RangeError('Choose a demo scenario and 0–600 whole simulated seconds.');
  }
  const sim = createSimulation({ counts: [2, 2, 2] });
  if (scenario !== 'baseline') setBlocked(sim, 1, true);
  if (scenario === 'backup') setBackupCooling(sim, true);
  const frames = [snapshot(sim)];
  for (let second = 0; second < seconds; second++) {
    step(sim, 1);
    frames.push(snapshot(sim));
  }
  return { sim, frames };
}
