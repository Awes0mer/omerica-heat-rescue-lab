import { telemetry } from './telemetry-bootstrap.mjs';
const $ = id => document.getElementById(id);
const names = { ai: 'Joint AI', random: 'Random search', placement: 'Placement-only AI', fixed: 'Fixed baseline' };
const colors = { ai: '#eed084', random: '#8c9b97', placement: '#83bdc5' };
const format = (n, digits = 1) => Number.isFinite(n) ? n.toFixed(digits) : '—';
let worker = null, result = null, records = [], budget = 18, replayFrame = null;

function mode(name) {
  const ai = name === 'ai';
  $('ai-view').hidden = !ai; $('manual-view').hidden = ai;
  for (const key of ['ai', 'manual']) {
    $('show-' + key).classList.toggle('active', name === key);
    $('show-' + key).setAttribute('aria-pressed', String(name === key));
  }
  window.dispatchEvent(new CustomEvent('heat-mode', { detail: name }));
  history.replaceState(null, '', '#' + name);
}
$('show-ai').addEventListener('click', () => mode('ai'));
$('show-manual').addEventListener('click', () => mode('manual'));
window.addEventListener('hashchange', () => {
  if (location.hash === '#ai' || location.hash === '#manual') mode(location.hash.slice(1));
});

function designView(design, label = 'STARTING DESIGN', trial = '6 tiles total') {
  window.dispatchEvent(new CustomEvent('heat-ai-design', {detail:{design,label,trial}}));
  $('bench-label').textContent = label; $('bench-trial').textContent = trial;
  $('ai-design').replaceChildren(...design.counts.map((count, i) => {
    const row = document.createElement('div'); row.className = 'bench-row';
    row.innerHTML = `<div class="bench-server">SERVER ${'ABC'[i]}<small>${[240, 200, 160][i]} W heat</small></div><div class="bench-tiles">${count ? '<i class="bench-tile"></i>'.repeat(count) : '<span class="bench-empty">No tiles</span>'}</div><strong class="bench-count">${count}</strong>`;
    return row;
  }));
  $('ai-trigger').textContent = design.triggerC + '°C';
  $('ai-flow').textContent = Math.round(design.backupFlowFraction * 100) + '%';
}

function learningChart() {
  const graph = $('learning-chart'), left = 55, right = 630, top = 18, bottom = 190;
  const series = Object.fromEntries(Object.keys(colors).map(method => [method, records.filter(r => r.method === method)]));
  const values = records.filter(r => r.bestSoFar.feasible).map(r => r.bestSoFar.scoreJ);
  let lo = values.length ? Math.min(0, ...values) : 0, hi = values.length ? Math.max(100, ...values) : 400;
  const pad = Math.max(20, (hi - lo) * .12); lo -= pad; hi += pad;
  const x = t => left + (t - 1) / Math.max(1, budget - 1) * (right - left);
  const y = v => bottom - (v - lo) / (hi - lo) * (bottom - top);
  let svg = '';
  for (let i = 0; i <= 4; i++) {
    const v = lo + (hi - lo) * i / 4, yy = y(v);
    svg += `<line x1="${left}" x2="${right}" y1="${yy}" y2="${yy}" stroke="#ffffff12"/><text x="${left - 9}" y="${yy + 3}" text-anchor="end" fill="#96ae9c" font-size="9">${v.toFixed(0)} J</text>`;
  }
  [1, Math.round(budget / 2), budget].forEach(n => svg += `<text x="${x(n)}" y="210" text-anchor="middle" fill="#96ae9c" font-size="9">${n}</text>`);
  svg += '<text x="340" y="224" text-anchor="middle" fill="#96ae9c" font-size="8">Experiments per search · higher net energy is better</text>';
  for (const [method, history] of Object.entries(series)) {
    const feasible = history.filter(r => r.bestSoFar.feasible);
    if (!feasible.length) continue;
    svg += `<path d="${feasible.map((r, i) => `${i ? 'L' : 'M'}${x(r.trial).toFixed(2)},${y(r.bestSoFar.scoreJ).toFixed(2)}`).join(' ')}" fill="none" stroke="${colors[method]}" stroke-width="${method === 'ai' ? 2.7 : 1.8}" ${method === 'random' ? 'stroke-dasharray="5 4"' : ''}/>`;
    const last = feasible.at(-1);
    svg += `<circle cx="${x(last.trial)}" cy="${y(last.bestSoFar.scoreJ)}" r="3.5" fill="${colors[method]}"/>`;
  }
  if (!records.length) svg += '<text x="340" y="110" text-anchor="middle" fill="#abc0aa" font-size="12">Run the lab to watch evidence accumulate.</text>';
  graph.innerHTML = svg;
}

function observe(record) {
  records.push(record);
  const { outcome, prediction, design, method, trial } = record;
  designView(design, names[method].toUpperCase(), `Trial ${trial} / ${budget}`);
  $('reason-heading').textContent = method === 'random' ? 'THE COMPARISON' : 'WHY TRY THIS DESIGN?';
  $('ai-reason').textContent = record.reason;
  $('predicted-energy').textContent = prediction ? `${format(prediction.meanEnergyJ, 0)} J` : '—';
  $('prediction-note').textContent = prediction ? `±${format(prediction.sdEnergyJ, 0)} J, one surrogate standard deviation` : method === 'random' ? 'Random search makes no prediction' : 'Starting trial; no prediction yet';
  $('observed-energy').textContent = format(outcome.scoreJ, 0) + ' J';
  $('observation-note').textContent = 'Worst of 3 training faults · 600 s each';
  $('observed-temperature').textContent = format(outcome.maxHotC) + '°C';
  $('observed-temperature').classList.toggle('bad', !outcome.feasible);
  $('temperature-verdict').textContent = outcome.feasible ? 'Passes all training temperature limits' : 'Fails at least one temperature limit';
  $('ai-progress-fill').style.width = `${records.length / (budget * 3) * 100}%`;
  $('ai-stage-count').textContent = `${records.length} / ${budget * 3} design trials · 3 searches`;
  if (records.length === 1) $('trial-log').replaceChildren();
  const row = document.createElement('tr'); row.className = 'method-' + method;
  const cells = [names[method], trial, design.counts.join(' / '), design.triggerC + '°C', design.backupFlowFraction * 100 + '%', prediction ? format(prediction.meanEnergyJ) + ' J' : '—', format(outcome.scoreJ) + ' J', format(outcome.maxHotC), outcome.feasible ? 'Pass' : 'FAIL'];
  cells.forEach((value, i) => { const cell = document.createElement('td'); cell.textContent = value; if (i === 8 && !outcome.feasible) cell.className = 'infeasible'; row.append(cell); });
  $('trial-log').append(row);
  $('log-count').textContent = `${records.length} recorded observations · predictions precede calculations`;
  learningChart();
}

function propose(proposal) {
  const { design, method, trial, prediction } = proposal;
  designView(design, names[method].toUpperCase(), `Trial ${trial} / ${budget}`);
  $('reason-heading').textContent = method === 'random' ? 'NEXT RANDOM DESIGN' : 'NEXT DESIGN TO TEST';
  $('ai-reason').textContent = proposal.reason;
  $('predicted-energy').textContent = prediction ? `${format(prediction.meanEnergyJ, 0)} J` : '—';
  $('prediction-note').textContent = prediction ? `±${format(prediction.sdEnergyJ, 0)} J · prediction made before calculation` : 'No learned prediction for this starting or random trial';
  $('observed-energy').textContent = '…';
  $('observation-note').textContent = 'Testing the proposed design against 3 faults';
  $('observed-temperature').textContent = '…';
  $('temperature-verdict').textContent = 'Result not yet known';
}

function controls(running) {
  $('ai-run').disabled = running; $('ai-stop').hidden = !running;
  $('ai-budget').disabled = running; $('ai-seed').disabled = running;
  $('ai-run').textContent = running ? 'Experiments running…' : records.length ? 'Run another experiment ↗' : 'Run AI experiments ↗';
}

function start() {
  const seed = Number($('ai-seed').value);
  if (!Number.isInteger(seed) || seed < 1 || seed > 2147483647) {
    $('ai-state').textContent = 'Enter a whole-number seed from 1 to 2147483647.'; $('ai-seed').focus(); return;
  }
  worker?.terminate(); cancelAnimationFrame(replayFrame);
  records = []; result = null; budget = Number($('ai-budget').value);
  $('ai-results').hidden = true; $('ai-progress-fill').style.width = '0%';
  $('trial-log').replaceChildren(); $('ai-stage-count').textContent = `0 / ${budget * 3} design trials · 3 searches`;
  $('ai-state').textContent = 'Starting the physics engine…';
  controls(true); learningChart();
  window.dispatchEvent(new CustomEvent('heat-ai-start'));
  try {
    worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.type === 'trial') observe(data.record);
      else if (data.type === 'proposal') propose(data.proposal);
      else if (data.type === 'stage') {
        $('ai-stage-text').textContent = data.stage.message;
        $('ai-state').textContent = data.stage.stage === 'holdout' ? 'Designs locked · testing new conditions' : data.stage.stage === 'complete' ? 'Experiment complete' : 'Running simulated experiments';
      } else if (data.type === 'complete') {
        result = data.result; finish(); worker.terminate(); worker = null;
      } else if (data.type === 'error') { telemetry.captureError(new Error('AI worker failed'), 'ai_worker'); fail(data.message); }
    };
    worker.onerror = event => { telemetry.captureError(event.error || new Error('AI worker failed'), 'ai_worker'); fail('The experiment could not finish. Reload the page and retry; no result is being claimed.'); };
    worker.postMessage({ type: 'start', seed, budget });
  } catch (error) { telemetry.captureError(error, 'ai_worker'); fail(error.message); }
}
function fail(message) {
  worker?.terminate(); worker = null; controls(false);
  $('ai-state').textContent = 'Run did not finish'; $('ai-stage-text').textContent = message;
  if ($('observed-energy').textContent === '…') { $('observed-energy').textContent = '—'; $('observed-temperature').textContent = '—'; $('observation-note').textContent = 'Stopped before this design was calculated'; $('temperature-verdict').textContent = 'Not calculated'; }
}
$('ai-run').addEventListener('click', start);
$('ai-stop').addEventListener('click', () => fail('Stopped. Partial observations remain in the notebook; no final design has been evaluated.'));
$('ai-budget').addEventListener('change', () => {
  document.querySelector('.ai-brief h2').innerHTML = `Give it ${Number($('ai-budget').value)} experiments.<br>See what it learns.`;
  const b = Number($('ai-budget').value);
  $('ai-stage-text').textContent = `448 possible designs. ${b} design trials per search; 3 faults per design. Held-out tests come last.`;
  $('ai-stage-count').textContent = `0 / ${b * 3} design trials · 3 searches`;
});
$('ai-seed').addEventListener('input', () => { if ($('ai-state').textContent.startsWith('Enter a whole-number seed')) $('ai-state').textContent = "Ready for experiments"; });

function finish() {
  controls(false); $('ai-results').hidden = false;
  $('ai-state').textContent = 'Complete · held-out results ready';
  telemetry.capture('ai_run_completed');
  designView(result.ai.best.design, 'AI’S SELECTED DESIGN', 'Locked before held-out tests');
  const bestTrial = result.ai.history.find(r => JSON.stringify(r.design) === JSON.stringify(result.ai.best.design));
  const pred = bestTrial?.prediction;
  $('predicted-energy').textContent = pred ? `${format(pred.meanEnergyJ, 0)} J` : '—';
  $('prediction-note').textContent = pred ? `Recorded before winning training trial ${bestTrial.trial}` : 'Selected design was a starting trial';
  $('observed-energy').textContent = format(result.ai.best.outcome.scoreJ, 0) + ' J';
  $('observation-note').textContent = 'Selected AI design · worst training fault';
  $('observed-temperature').textContent = format(result.ai.best.outcome.maxHotC) + '°C';
  $('observed-temperature').classList.toggle('bad', !result.ai.best.outcome.feasible);
  $('temperature-verdict').textContent = 'Selected AI design · training temperature';
  $('reason-heading').textContent = 'WHAT IT LEARNED';
  $('ai-reason').textContent = `Selected using training results: ${result.ai.best.design.counts.join(' / ')} tiles, backup at ${result.ai.best.design.triggerC}°C, ${result.ai.best.design.backupFlowFraction * 100}% extra flow. Scroll to see whether it passed new conditions.`;
  const methods = ['fixed', 'random', 'placement', 'ai'];
  const acceptable = methods.filter(k => result[k].holdout.feasible);
  const champion = acceptable.sort((a, b) => result[b].holdout.scoreJ - result[a].holdout.scoreJ)[0];
  $('result-cards').replaceChildren(...methods.map(method => {
    const r = result[method], design = r.design || r.best.design, score = r.holdout;
    const card = document.createElement('div'); card.className = 'result-card' + (method === champion ? ' champion' : '');
    card.innerHTML = `<span>${names[method]}${method === champion ? ' · best passing result' : ''}</span><strong>${format(score.scoreJ, 0)} <small>J</small></strong><small>Worst net recovery · 900 seconds<br>${format(score.scoreJ / 900, 2)} W average in that case<br>Tiles ${design.counts.join(' / ')}<br>Backup ${design.triggerC}°C · ${design.backupFlowFraction * 100}% flow</small><small class="constraint ${score.feasible ? '' : 'failed'}">${score.feasible ? '✓ All 6 temperature tests pass' : '✕ Temperature constraint failed'}<br>Maximum ${format(score.maxHotC, 2)}°C</small>`;
    return card;
  }));
  const a = result.ai.holdout, delta = a.scoreJ - result.fixed.holdout.scoreJ;
  $('ai-conclusion').textContent = a.feasible
    ? `The joint AI ${a.scoreJ > 0 ? 'recovers positive net energy' : 'still spends more pumping energy than it recovers in its worst case'} and passes all six held-out temperature tests. Its worst-case balance is ${format(Math.abs(delta), 0)} J ${delta >= 0 ? 'higher' : 'lower'} than the fixed design. ${champion === 'ai' ? 'It has the highest score among the passing designs in this run.' : `The best passing result in this run comes from ${names[champion] || 'no method'}.`} These are simulated results.`
    : `The joint AI’s selected design fails the temperature constraint on new conditions: ${format(a.maxHotC, 2)}°C against an illustrative 80°C limit. Its ${format(a.scoreJ)} J energy result does not make it an acceptable design. This run exposes a generalization failure; the notebook retains it.`;
  $('replay-scenario').replaceChildren(...result.replays.map((trial, i) => {
    const option = document.createElement('option'); option.value = i; option.textContent = trial.label + (trial.feasible ? '' : ' — temperature FAIL'); return option;
  }));
  // Open on the AI design’s worst energy case, without changing the selected design.
  const worst = result.replays.reduce((idx, trial, i, all) => trial.netEnergyJ < all[idx].netEnergyJ ? i : idx, 0);
  $('replay-scenario').value = worst;
  renderReplay(0);
}

function selectedReplay() { return result?.replays[Number($('replay-scenario').value)]; }
function renderReplay(index) {
  const trial = selectedReplay(); if (!trial) return;
  const point = trial.trace[Math.max(0, Math.min(index, trial.trace.length - 1))];
  $('replay-time').textContent = point.time.toFixed(0) + ' s';
  $('replay-hot').textContent = format(Math.max(...point.branches.map(b => b.hotC))) + '°C';
  $('replay-power').textContent = format(point.totalPowerW, 2) + ' W';
  $('replay-pump').textContent = format(point.backupPumpW, 2) + ' W';
  const min = Math.floor(Math.min(...trial.trace.flatMap(p => p.branches.map(b => b.hotC))) / 5) * 5 - 2;
  const max = Math.max(82, trial.maxHotC + 3);
  const x = t => 42 + t / trial.durationS * 813, y = t => 136 - (t - min) / (max - min) * 118;
  let svg = `<line x1="42" x2="855" y1="${y(80)}" y2="${y(80)}" stroke="#b57460" stroke-dasharray="5 4"/><text x="848" y="${y(80) - 5}" text-anchor="end" fill="#925b49" font-size="9">80°C illustrative limit</text>`;
  for (let i = 0; i <= 3; i++) { const value = min + (max - min) * i / 3; svg += `<text x="32" y="${y(value) + 3}" fill="#748168" text-anchor="end" font-size="9">${value.toFixed(0)}°</text>`; }
  const traces = trial.trace.slice(0, index + 1);
  ['#ad7049', '#4c777b', '#6c7d42'].forEach((color, i) => {
    svg += `<path d="${traces.map((p, j) => `${j ? 'L' : 'M'}${x(p.time)},${y(p.branches[i].hotC)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2"/><text x="${290 + i * 110}" y="165" fill="${color}" font-size="10">● Server ${'ABC'[i]}</text>`;
  });
  svg += `<line x1="${x(trial.faultStartS)}" x2="${x(trial.faultStartS)}" y1="18" y2="136" stroke="#ad7049" stroke-dasharray="2 4"/><text x="${x(trial.faultStartS) + 6}" y="30" fill="#9c6549" font-size="9">Pipe ${'ABC'[trial.faultBranch]} ${trial.remainingFlowFraction > 0 ? 'partly blocked' : 'blocked'}</text><line x1="${x(point.time)}" x2="${x(point.time)}" y1="18" y2="136" stroke="#516746" opacity=".4"/><text x="42" y="152" fill="#748168" font-size="9">0 s</text><text x="855" y="152" text-anchor="end" fill="#748168" font-size="9">${trial.durationS} s</text>`;
  $('replay-chart').innerHTML = svg;
  const active = point.branches.flatMap((b, i) => b.backupOn ? ['ABC'[i]] : []);
  $('replay-caption').textContent = `${point.faultActive ? `Pipe ${'ABC'[trial.faultBranch]} has ${Math.round(trial.remainingFlowFraction * 100)}% of its normal flow.` : 'All main pipes are open; the fault starts at 30 s.'} Backup active on ${active.length ? active.join(', ') : 'no branches'}. Net recovery now: ${format(point.netRecoveryW, 2)} W after backup and 0.90 W recovery pumping. This is a replay of computed simulation data, not a live measurement.`;
}
$('replay-play').addEventListener('click', () => {
  cancelAnimationFrame(replayFrame); const trial = selectedReplay(); if (!trial) return;
  const start = performance.now(); $('replay-play').textContent = 'Replay from start ↻';
  function frame(now) { const i = Math.max(0, Math.min(trial.trace.length - 1, Math.floor((now - start) / 16000 * (trial.trace.length - 1)))); renderReplay(i); if (i < trial.trace.length - 1) replayFrame = requestAnimationFrame(frame); }
  replayFrame = requestAnimationFrame(frame);
});
$('replay-scenario').addEventListener('change', () => { cancelAnimationFrame(replayFrame); renderReplay(0); });
$('ai-download').addEventListener('click', () => {
  if (!result) return;
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `omerica-heat-rescue-seed-${result.seed}-budget-${result.budget}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

designView({ counts: [2, 2, 2], triggerC: 74, backupFlowFraction: .5 }); learningChart();
mode(location.hash === '#ai' ? 'ai' : 'manual');
// This is a separately recorded verification result, never an input to the optimizer.
$('seed-benchmark').className = 'benchmark-box';
$('seed-benchmark').innerHTML = '<strong>Recorded verification: synthetic-open-v2 · eight seeds, 18 trials each</strong><p>Positive net energy AND all six held-out temperature limits passed: joint AI 6/8 runs; random search 1/8; placement-only AI 0/8; fixed baseline 0/8. The joint AI exceeded the temperature limit in two runs. Fixed and placement-only passed temperatures in all eight, but their worst-case net energy was negative. These eight runs are a small simulation benchmark, not a reliability estimate or hardware validation.</p><a href="ai-benchmark.json" download>Download the recorded results, settings and source hashes ↓</a>';
