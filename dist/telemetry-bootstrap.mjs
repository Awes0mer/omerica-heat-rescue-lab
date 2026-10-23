import config from './telemetry-config.mjs';
import { createTelemetry } from './telemetry.mjs';

export const telemetry = createTelemetry(config);
// Cover startup while the SDK downloads, then let its exception hooks take over.
const earlyError = event => telemetry.captureError(event.error, 'window_error');
const earlyRejection = event => telemetry.captureError(event.reason, 'unhandled_rejection');
window.addEventListener('error', earlyError);
window.addEventListener('unhandledrejection', earlyRejection);

function renderChoice(available) {
  const button = document.getElementById('analytics-toggle');
  const status = document.getElementById('analytics-status');
  if (button) {
    button.disabled = telemetry.status === 'privacy_blocked';
    button.textContent = telemetry.status === 'privacy_blocked' ? 'Analytics disabled' : telemetry.status === 'unavailable' ? 'Retry analytics' : telemetry.enabled ? 'Disable analytics' : 'Enable analytics';
    button.setAttribute('aria-pressed', String(telemetry.enabled));
  }
  if (status) status.textContent = telemetry.status === 'privacy_blocked' ? 'Analytics disabled by your browser privacy setting.' : telemetry.status === 'unavailable' ? 'Analytics unavailable; the simulation still works.' : !telemetry.enabled ? 'Analytics disabled.' : available ? 'Analytics enabled.' : 'Analytics unavailable; the simulation still works.';
}

void telemetry.start().then(available => {
  window.removeEventListener('error', earlyError);
  window.removeEventListener('unhandledrejection', earlyRejection);
  renderChoice(available);
});
document.getElementById('analytics-toggle')?.addEventListener('click', async () => {
  const available = await telemetry.setEnabled(!telemetry.enabled);
  renderChoice(available);
});

window.addEventListener('heat-mode', event => telemetry.capture('view_changed', { view: event.detail }));
window.addEventListener('heat-ai-start', () => telemetry.capture('ai_run_started'));
window.addEventListener('heat-scene-action-result', ({ detail }) => {
  if (detail?.type === 'export-assembly' && detail.ok) telemetry.capture('export_completed', { format: 'json', kind: 'assembly' });
});
document.addEventListener('click', event => {
  const button = event.target.closest?.('button,[data-pipe]');
  if (!button || button.disabled) return;
  const id = button.id;
  if (id === 'assembly-demo-start') telemetry.capture('assembly_demo_started', { action: 'start' });
  const action = id.replace('assembly-demo-', '');
  if (id.startsWith('assembly-demo-') && ['previous', 'next', 'play', 'pause', 'end'].includes(action)) telemetry.capture('assembly_demo_step', { action });
  if (id === 'download') telemetry.capture('export_completed', { format: 'csv', kind: 'readings' });
  if (id === 'download-parameters') telemetry.capture('export_completed', { format: 'json', kind: 'parameters' });
  if (id === 'ai-download') telemetry.capture('export_completed', { format: 'json', kind: 'ai_results' });
}, true);
