// SPDX-License-Identifier: MIT
import { PARAMS, createSimulation, step, setBlocked, setBackupCooling, snapshot } from './model.js';
import { createAssemblyScene } from './assembly-scene.js';

const $ = id => document.getElementById(id);
const letters = ['A', 'B', 'C'];
const fmt = (n, digits = 1) => Number.isFinite(n) ? n.toFixed(digits) : '—';
const put = (id, value) => { $(id).textContent = value; };
let counts = [2, 2, 2], sim = createSimulation({ counts });
let selectedBranch = 1, selectedType = 'teg', running = true;
let active = location.hash === '#assembly' || !['#ai', '#manual'].includes(location.hash);
let speed = 5, explode = 0.6, heatColors = false, aiPlacement = null;
let scene = null, lastFrame = performance.now(), lastPaint = 0;

const descriptions = {
  hot: ['Hot plate', 'The server supplies heat to this plate. It passes through the generator tiles and a parallel metal bypass.'],
  teg: ['Generator tiles', 'A hot face and a cold face create voltage. The tiles generate a little electricity while conducting most heat onward.'],
  cold: ['Cold plate', 'This plate receives heat from the tiles and metal bypass. Moving water carries heat away.'],
  pipe: ['Main cooling pipe', 'The main pipe supplies cool water. Blocking it stops this flow but leaves the water and its stored heat in place.'],
  backup: ['Backup water route', 'A separate route can cool a blocked branch. Its pump needs extra electricity, which is subtracted from recovered power.'],
};
function status(message) { put('assembly-status', message); }
function inspect(selection) {
  selectedBranch = selection.branch ?? selectedBranch;
  selectedType = descriptions[selection.type] ? selection.type : 'hot';
  $('assembly-part').value = selectedType;
  scene?.selectPart(`${selectedType}-${selectedBranch}`);
  document.querySelectorAll('[data-assembly-branch]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.assemblyBranch) === selectedBranch)));
  put('assembly-inspect-branch', `server ${letters[selectedBranch]}`);
  const [title, description] = descriptions[selectedType];
  put('assembly-part-title', title); put('assembly-part-description', description);
  render();
}
try {
  scene = createAssemblyScene($('assembly-canvas'), { onSelect: inspect });
  $('assembly-loading').remove();
  $('assembly-canvas').dataset.renderer = 'ready';
  scene.selectPart('teg-1');
  scene.setExplode(explode);
} catch (error) {
  $('assembly-loading').textContent = '3D graphics are unavailable in this browser. The assembly controls and readings still work; use the 2D schematic to see the cooling paths.';
  $('assembly-canvas').dataset.renderer = 'unavailable';
  console.warn('Assembly renderer unavailable:', error.message);
}
function reset(nextCounts = counts, message = 'Test reset. All main pipes are open.') {
  counts = [...nextCounts]; sim = createSimulation({ counts }); running = true;
  $('assembly-pause').textContent = 'Pause';
  status(message); render();
}
function render() {
  const s = snapshot(sim), b = s.branches[selectedBranch];
  scene?.update(s, counts, { paused: !running || !active, showFlow: true });
  put('assembly-power', `${fmt(s.totalPowerW, 2)} W`);
  put('assembly-net', `${fmt(s.netRecoveryW, 2)} W`);
  put('assembly-temperature', `${fmt(s.maxHotC)}°C`);
  put('assembly-time', `${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}`);
  let readings;
  if (selectedType === 'hot') readings = ['Plate temperature', `${fmt(b.hotC)}°C`, 'Heat supplied', '200 W'];
  else if (selectedType === 'cold') readings = ['Cold face', `${fmt(b.coldC)}°C`, 'Water temperature', `${fmt(b.waterC)}°C`];
  else if (selectedType === 'pipe') readings = ['Main water flow', `${fmt(b.blocked ? 0 : PARAMS.flowKgS * 60, 2)} L/min`, 'Pipe state', b.blocked ? 'Blocked' : 'Open'];
  else if (selectedType === 'backup') readings = ['Backup flow here', `${fmt(b.backupActive ? PARAMS.backupFlowKgS * 60 : 0, 2)} L/min`, 'Backup pump cost (system)', `${fmt(s.backupPumpW, 2)} W`];
  else readings = ['Temperature difference', `${fmt(b.deltaC)}°C`, 'Generated in this branch', `${fmt(b.powerW, 3)} W`];
  ['assembly-reading-one-label', 'assembly-reading-one', 'assembly-reading-two-label', 'assembly-reading-two'].forEach((id, i) => put(id, readings[i]));
  counts.forEach((count, i) => {
    put(`assembly-count-${i}`, `${count} tile${count === 1 ? '' : 's'}`);
    const blocked = s.branches[i].blocked;
    put(`assembly-block-${i}`, `${blocked ? 'Restore' : 'Block'} pipe ${letters[i]}`);
    $(`assembly-block-${i}`).setAttribute('aria-pressed', String(blocked));
  });
  $('assembly-backup').setAttribute('aria-pressed', String(s.backupCooling));
  $('assembly-backup').innerHTML = `${s.backupCooling ? 'Disable' : 'Enable'} backup cooling <span>+0.50 W when active</span>`;
  const from = Number($('assembly-from').value), to = Number($('assembly-to').value);
  $('assembly-move').disabled = from === to || counts[from] === 0;
}
$('assembly-part').addEventListener('change', e => inspect({ type: e.target.value, branch: selectedBranch }));
document.querySelectorAll('[data-assembly-branch]').forEach(button => button.addEventListener('click', () => inspect({ branch: Number(button.dataset.assemblyBranch), type: selectedType })));
$('assembly-camera').addEventListener('click', () => scene?.resetCamera());
$('assembly-explode').addEventListener('input', e => {
  explode = Number(e.target.value) / 100; scene?.setExplode(explode);
  put('assembly-explode-label', explode === 0 ? 'Assembled' : `${Math.round(explode * 100)}% separated`);
});
$('assembly-heat').addEventListener('click', () => {
  heatColors = !heatColors; scene?.setHeatColors(heatColors);
  $('assembly-heat').setAttribute('aria-pressed', String(heatColors));
  $('assembly-heat-scale').hidden = !heatColors;
  put('assembly-heat', heatColors ? 'Show material colors' : 'Show temperature colors');
});
$('assembly-pause').addEventListener('click', () => { running = !running; put('assembly-pause', running ? 'Pause' : 'Resume'); render(); });
$('assembly-reset').addEventListener('click', () => reset());
$('assembly-speed').addEventListener('change', e => { speed = Number(e.target.value); });
$('assembly-from').addEventListener('change', render); $('assembly-to').addEventListener('change', render);
$('assembly-move').addEventListener('click', () => {
  const from = Number($('assembly-from').value), to = Number($('assembly-to').value);
  if (from === to || counts[from] === 0) return;
  const next = [...counts]; next[from]--; next[to]++;
  reset(next, `Moved one tile from ${letters[from]} to ${letters[to]}. New allocation: ${next.join(' / ')}. All pipes are open and temperatures start at this design’s equilibrium.`);
  inspect({ branch: to, type: 'teg' });
});
$('assembly-balance').addEventListener('click', () => reset([2, 2, 2], 'Six tiles balanced: 2 / 2 / 2. New test started.'));
letters.forEach((letter, i) => $(`assembly-block-${i}`).addEventListener('click', () => {
  const blocked = !sim.branches[i].blocked; setBlocked(sim, i, blocked);
  inspect({ branch: i, type: 'pipe' });
  status(`${blocked ? 'Blocked' : 'Restored'} pipe ${letter}. ${blocked ? 'Main flow stops; stored heat and temperatures continue to evolve.' : 'Main flow resumes; temperatures recover over time.'}`);
}));
$('assembly-backup').addEventListener('click', () => {
  setBackupCooling(sim, !sim.backupCooling);
  inspect({ branch: selectedBranch, type: 'backup' });
  status(sim.backupCooling ? 'Backup enabled. It supplies only blocked branches; its assumed 0.50 W system cost is charged while active.' : 'Backup disabled. Blocked main pipes remain blocked.');
});
window.addEventListener('heat-mode', e => { active = e.detail === 'assembly'; lastFrame = performance.now(); render(); });
window.addEventListener('heat-ai-design', e => {
  if (e.detail?.counts?.length !== 3) return;
  aiPlacement = [...e.detail.counts]; $('assembly-ai-layout').disabled = false;
  $('assembly-ai-layout').textContent = `Use AI tiles ${aiPlacement.join(' / ')}`;
});
$('assembly-ai-layout').addEventListener('click', () => {
  if (aiPlacement) reset(aiPlacement, 'Copied only the AI’s tile placement into the equal-load teaching model. This is a new illustration, not a replay of the AI benchmark or its backup policy.');
});
$('assembly-export').addEventListener('click', () => {
  const data = { label: 'SIMULATED conceptual assembly, not fabrication CAD or measured hardware', parameterProfile: PARAMS.parameterProfile, tileAllocation: counts, totalTiles: 6, teachingModel: { heatPerBranchW: PARAMS.serverHeatW, parameters: PARAMS }, currentState: snapshot(sim), displayOnly: { exploded: explode, heatColors }, sources: 'CITATIONS.md', softwareNotices: 'third-party/README.md' };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'heat-rescue-assembly.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
render();
function frame(now) {
  const dt = Math.min(.15, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
  if (active && running && !document.hidden) {
    step(sim, dt * speed);
    if (sim.time >= 1800) { running = false; put('assembly-pause', 'Resume'); status('30 simulated minutes reached. Reset the test to start again.'); }
  }
  if (active && now - lastPaint > 120) { render(); lastPaint = now; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
