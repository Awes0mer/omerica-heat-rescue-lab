import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetry, sanitizeEvent, sanitizeError, filterOutgoing, loadPostHog } from './dist/telemetry.mjs';

const config = { enabled: true, projectToken: 'phc_0123456789abcdefghijklmnop', apiHost: 'https://us.i.posthog.com', release: 'test-build' };
function fixture(loadSDK) {
  const handlers = new Map(), calls = [];
  const scope = { location: { origin: 'https://example.test' }, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) };
  const sdk = { capture: (...args) => calls.push(['capture', ...args]), captureException: (...args) => calls.push(['error', ...args]), set_config: options => { loadedOptions = { ...loadedOptions, ...options }; } };
  let loadedOptions, loads = 0;
  const telemetry = createTelemetry(config, { scope, document: {}, loadSDK: async input => { loads++; loadedOptions = input.options; return loadSDK ? loadSDK(input) : sdk; } });
  return { telemetry, scope, handlers, calls, sdk, get options() { return loadedOptions; }, get loads() { return loads; } };
}

test('unconfigured or wrong-host telemetry loads nothing and is safe to call', async () => {
  let loads = 0;
  for (const input of [{}, { ...config, enabled: false }, { ...config, projectToken: '' }, { ...config, apiHost: 'https://us.i.posthog.com.attacker.test' }]) {
    const t = createTelemetry(input, { document: {}, loadSDK: () => { loads++; } });
    assert.equal(await t.start(), false); assert.equal(t.capture('app_loaded'), false);
  }
  assert.equal(loads, 0);
});

test('initialization is idempotent and opts out of incidental collection', async () => {
  const f = fixture();
  assert.strictEqual(f.telemetry.start(), f.telemetry.start());
  assert.equal(await f.telemetry.start(), true); assert.equal(f.loads, 1);
  for (const key of ['autocapture', 'capture_pageleave', 'capture_heatmaps', 'capture_dead_clicks', 'capture_performance', 'enable_recording_console_log']) assert.equal(f.options[key], false);
  assert.equal(f.options.capture_pageview, true); assert.equal(f.options.capture_exceptions, true);
  assert.equal(f.options.disable_session_recording, true); assert.equal(f.options.disable_persistence, true);
  assert.equal(f.options.person_profiles, 'never');
  assert.deepEqual(f.calls, [['capture', 'app_loaded', { release: 'test-build' }]]);
});

test('explicit event names and properties have a strict allowlist', async () => {
  const f = fixture(); await f.telemetry.start();
  f.telemetry.capture('experiment_completed', { model: 'finite_stream', input: 'secret', temperature: 50, email: 'person@example.test' });
  assert.deepEqual(f.calls.at(-1), ['capture', 'experiment_completed', { model: 'finite_stream', release: 'test-build' }]);
  assert.equal(f.telemetry.capture('arbitrary_private_text', {}), false);
  assert.deepEqual(sanitizeEvent('assembly_step', { step: 14 }), {});
  assert.deepEqual(sanitizeEvent('view_changed', { view: 'private text' }), {});
});

test('outgoing payload loses URLs, referrers, DOM text and automatic events', () => {
  assert.equal(filterOutgoing({ event: '$autocapture', properties: {} }), null);
  const filtered = filterOutgoing({ event: 'view_changed', properties: { view: 'manual', token: 'public-project-token', distinct_id: 'ephemeral', $current_url: 'https://example.test/?secret=x', $referrer: 'private', $elements: [], text: 'private', $set: { email: 'private' } } });
  assert.deepEqual(filtered.properties, { view: 'manual', token: 'public-project-token', distinct_id: 'ephemeral', application: 'omerica-heat-rescue-lab' });
});

test('errors discard raw messages and foreign/query-bearing stack contents', async () => {
  const e = new TypeError('Input value supersecret is invalid');
  e.stack = 'TypeError: supersecret\n at render (https://example.test/app.js?token=private:22:7)\n at other (https://elsewhere.test/a.js:1:2)';
  const safe = sanitizeError(e, 'https://example.test');
  assert.equal(safe.name, 'TypeError');
  assert.equal(safe.stack, 'TypeError: Unexpected application error\n    at https://example.test/app.js:22:7');
  const f = fixture(); await f.telemetry.start();
  f.telemetry.captureError(e); f.telemetry.captureError(e);
  assert.equal(f.calls.filter(c => c[0] === 'error').length, 1);
  assert.equal(f.calls.at(-1)[2].error_context, 'window_error');
});

test('early explicit error is queued without recording its arbitrary payload', async () => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const f = fixture(() => pending); const ready = f.telemetry.start();
  f.telemetry.captureError({ password: 'private' }, 'unhandled_rejection');
  release(f.sdk); await ready;
  assert.equal(f.calls[0][0], 'error'); assert.equal(f.calls[0][1].message, 'Unexpected application error');
  assert.equal(f.calls[0][2].error_context, 'unhandled_rejection');
});

test('blocked or failing SDK never rejects into the application', async () => {
  const f = fixture(() => { throw new Error('offline'); });
  assert.equal(await f.telemetry.start(), false); assert.equal(f.telemetry.capture('app_loaded'), false);
  assert.equal(f.handlers.size, 0);
  const broken = fixture(() => ({ capture() { throw new Error('SDK error'); }, captureException() { throw new Error('SDK error'); } }));
  assert.equal(await broken.telemetry.start(), true);
  assert.equal(broken.telemetry.capture('app_loaded'), false);
  assert.equal(broken.telemetry.captureError(new Error('test')), false);
});

test('disposal removes listeners and stops captures', async () => {
  const f = fixture(); await f.telemetry.start(); f.telemetry.dispose();
  assert.equal(f.handlers.size, 0); assert.equal(f.telemetry.capture('app_loaded'), false);
});

test('CDN loader failure cleans up its stub and honors timeout', async () => {
  const scope = {}; let removed = false, script;
  const document = { createElement() { return script = { remove() { removed = true; } }; }, head: { appendChild() {} } };
  await assert.rejects(loadPostHog({ scope, document, host: config.apiHost, token: config.projectToken, options: {}, timeoutMs: 1 }), /timed out/);
  assert.equal(removed, true); assert.equal(scope.posthog, undefined);
  assert.equal(script.src, 'https://us-assets.i.posthog.com/static/array.js');
  assert.equal(script.referrerPolicy, 'no-referrer');
});

test('SDK exception autocapture is scrubbed while stack locations remain useful', () => {
  const event = { event: '$exception', properties: { token: 'public', distinct_id: 'ephemeral', $current_url: 'https://example.test?password=secret', $exception_message: 'secret', $exception_type: 'TypeError', $exception_list: [{ type: 'TypeError', value: 'secret', mechanism: { handled: false }, stacktrace: { frames: [{ filename: 'https://example.test/app.js?password=secret', lineno: 22, colno: 7, context_line: 'password=secret', vars: { password: 'secret' } }, { filename: 'https://other.test/a.js', lineno: 3 }] } }] } };
  const filtered = filterOutgoing(event, 'https://example.test');
  assert.equal(JSON.stringify(filtered).includes('secret'), false);
  assert.deepEqual(filtered.properties.$exception_list[0].stacktrace.frames, [{ filename: 'https://example.test/app.js', in_app: true, lineno: 22, colno: 7 }]);
  assert.equal(filtered.properties.$exception_list[0].mechanism.handled, false);
  assert.notEqual(filterOutgoing({ event: '$pageview', properties: {} }), null);
});

test('toggle persists opt-out, gates SDK automatic events and never reinitializes', async () => {
  const f = fixture(), stored = new Map();
  f.scope.localStorage = { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
  let outs = 0, ins = 0;
  f.sdk.opt_out_capturing = () => outs++; f.sdk.opt_in_capturing = () => ins++;
  await f.telemetry.start();
  const oldSignal = f.options.fetch_options.signal;
  await f.telemetry.setEnabled(false);
  assert.equal(f.telemetry.enabled, false); assert.equal(stored.get('omerica_telemetry_opt_out'), '1');
  assert.equal(f.options.before_send({ event: '$pageview', properties: {} }), null);
  assert.equal(f.telemetry.capture('app_loaded'), false);
  assert.equal(oldSignal.aborted, true);
  await f.telemetry.setEnabled(true);
  assert.equal(f.telemetry.enabled, true); assert.equal(stored.size, 0);
  assert.equal(outs, 0); assert.equal(ins, 0); assert.equal(f.loads, 1);
  assert.notStrictEqual(f.options.fetch_options.signal, oldSignal);
  assert.equal(f.options.fetch_options.signal.aborted, false);
  assert.equal(f.options.request_batching, false); assert.equal(f.options.disable_beacon, true); assert.equal(f.options.api_transport, 'fetch');
});

test('opt out, reload and enable uses only our preference and resumes captures', async () => {
  const storage = new Map(); let loads = 0, events = 0;
  const scope = { localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } };
  const deps = { scope, document: {}, loadSDK: () => { loads++; return { capture() { events++; }, captureException() {}, set_config() {}, opt_in_capturing() { throw new Error('Must not persist SDK consent'); }, opt_out_capturing() { throw new Error('Must not persist SDK consent'); } }; } };
  const first = createTelemetry(config, deps); await first.start(); await first.setEnabled(false); first.dispose();
  assert.deepEqual([...storage.entries()], [['omerica_telemetry_opt_out', '1']]);
  const second = createTelemetry(config, deps); assert.equal(await second.start(), false); assert.equal(loads, 1);
  assert.equal(await second.setEnabled(true), true); assert.equal(loads, 2);
  const before = events; assert.equal(second.capture('monitoring_verified', { source: 'smoke_test' }), true); assert.equal(events, before + 1);
  assert.equal(storage.size, 0);
});

test('DNT and GPC prevent SDK loading and cannot be overridden by the app toggle', async () => {
  for (const navigator of [{ doNotTrack: '1' }, { msDoNotTrack: '1' }, { globalPrivacyControl: true }]) {
    let loads = 0; const t = createTelemetry(config, { scope: { navigator }, document: {}, loadSDK: () => { loads++; } });
    assert.equal(await t.start(), false); assert.equal(await t.setEnabled(true), false);
    assert.equal(t.enabled, false); assert.equal(t.available, false); assert.equal(t.status, 'privacy_blocked'); assert.equal(loads, 0);
  }
});

test('failed SDK load can be retried and failure is visible to the UI', async () => {
  let attempts = 0;
  const t = createTelemetry(config, { scope: {}, document: {}, loadSDK: () => { if (++attempts === 1) throw new Error('offline'); return { capture() {}, captureException() {} }; } });
  assert.equal(await t.start(), false); assert.equal(t.enabled, false); assert.equal(t.available, false); assert.equal(t.status, 'unavailable');
  assert.equal(await t.setEnabled(true), true); assert.equal(t.enabled, true); assert.equal(t.status, 'ready'); assert.equal(attempts, 2);
});

test('off and on during SDK download replaces the aborted init transport', async () => {
  let finishLoad; const pending = new Promise(resolve => { finishLoad = resolve; });
  const f = fixture(() => pending); const started = f.telemetry.start();
  await Promise.resolve();
  const initialSignal = f.options.fetch_options.signal;
  await f.telemetry.setEnabled(false);
  const enabling = f.telemetry.setEnabled(true);
  assert.equal(initialSignal.aborted, true);
  finishLoad(f.sdk);
  assert.equal(await enabling, true); assert.equal(await started, true);
  assert.notStrictEqual(f.options.fetch_options.signal, initialSignal);
  assert.equal(f.options.fetch_options.signal.aborted, false);
  assert.equal(f.telemetry.capture('monitoring_verified', { source: 'smoke_test' }), true);
  assert.equal(f.loads, 1);
});

test('persisted opt-out avoids SDK load until enabled, and blocked storage is harmless', async () => {
  let loads = 0;
  const scope = { localStorage: { getItem: () => '1', removeItem() { throw new Error('blocked'); } } };
  const t = createTelemetry(config, { scope, document: {}, loadSDK: () => { loads++; return { capture() {}, captureException() {} }; } });
  assert.equal(await t.start(), false); assert.equal(loads, 0);
  assert.equal(await t.setEnabled(true), true); assert.equal(loads, 1);
  assert.equal(await t.setEnabled(false), false);
});
