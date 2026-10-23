// Presentation controls keep the same six-tile budget as the teaching model.
export function isTileAllocation(counts) {
  return Array.isArray(counts) && counts.length === 3 &&
    Array.from(counts).every(n => Number.isInteger(n) && n >= 0 && n <= 6) &&
    counts.reduce((sum, n) => sum + n, 0) === 6;
}

const isBranch = index => Number.isInteger(index) && index >= 0 && index < 3;

/** Validate before changing any simulation state. Never mutate the input. */
export function allocationForAction(current, action) {
  if (!isTileAllocation(current)) return { ok: false, reason: 'The current allocation must contain exactly six whole tiles.' };
  if (!action || typeof action !== 'object' || Array.isArray(action)) return { ok: false, reason: 'No tile action was supplied.' };
  let counts;
  if (action.type === 'move-tile') {
    if (!isBranch(action.from) || !isBranch(action.to)) return { ok: false, reason: 'Choose a source and destination branch.' };
    if (action.from === action.to) return { ok: false, reason: 'Choose two different branches.' };
    if (current[action.from] === 0) return { ok: false, reason: 'The source branch has no tiles to move.' };
    counts = [...current];
    counts[action.from] -= 1;
    counts[action.to] += 1;
  } else if (action.type === 'balance-tiles') {
    counts = [2, 2, 2];
  } else if (action.type === 'apply-ai-layout') {
    if (!isTileAllocation(action.counts)) return { ok: false, reason: 'The AI allocation must contain exactly six whole tiles.' };
    counts = [...action.counts];
  } else {
    return { ok: false, reason: 'Unknown tile action.' };
  }
  return { ok: true, changed: counts.some((count, i) => count !== current[i]), counts };
}

const copyJson = value => JSON.parse(JSON.stringify(value));

/** Export live teaching values separately from any displayed AI/view metadata. */
export function createAssemblyExport({ snapshot, counts, parameters, selected, running, metadata = null }) {
  if (!isTileAllocation(counts)) throw new RangeError('Export requires exactly six whole tiles.');
  if (!snapshot || !Array.isArray(snapshot.branches) || snapshot.branches.length !== 3 ||
      snapshot.branches.some((branch, index) => branch.count !== counts[index])) {
    throw new RangeError('Export allocation must match the current simulation snapshot.');
  }
  return copyJson({
    schema: 'omerica-heat-rescue-assembly-v1',
    label: 'SIMULATED — hypothetical teaching model, not measured hardware',
    allocation: { A: counts[0], B: counts[1], C: counts[2], total: 6 },
    counts: [...counts],
    simulation: snapshot,
    parameters,
    controls: { selectedBranch: selected, running: Boolean(running) },
    displayedMetadata: metadata,
    limitations: {
      teachingModel: 'Three assumed 200 W heat sources; independent regulated branch flows; synthetic thermoelectric constants; no calibration to hardware.',
      aiTransfer: 'Applying an AI layout transfers tile counts only. The AI experiment uses a different load and fault scenario, controller threshold, backup-flow rule, and pump model. Its scores and controller settings do not carry into this teaching run.',
      layoutReset: 'A changed allocation restarts time and readings at its own all-open thermal equilibrium, clears blocked pipes, and disables backup cooling.',
      netRecovery: 'Net recovery subtracts assumed extra pump cost only, excluding facility cooling and conversion electronics.',
      drawing: 'The assembly is an illustrative component arrangement, not a dimensioned engineering drawing or a thermal camera image.'
    }
  });
}
