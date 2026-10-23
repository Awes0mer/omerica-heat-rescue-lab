// Buildless PostHog adapter. See MONITORING.md for setup and data boundaries.
const CLOUD_HOSTS = Object.freeze({
  'https://us.i.posthog.com': 'https://us-assets.i.posthog.com',
  'https://eu.i.posthog.com': 'https://eu-assets.i.posthog.com',
});
const EVENT_FIELDS = Object.freeze({
  app_loaded: {},
  view_changed: { view: ['assembly', 'experiment', 'manual', 'ai', 'science', 'studio', 'interactive'] },
  assembly_step: { step: value => Number.isInteger(value) && value >= 1 && value <= 13 },
  assembly_completed: {},
  experiment_completed: { model: ['finite_stream', 'reservoir', 'teaching', 'ai'] },
  export_completed: { format: ['csv', 'json'], kind: ['assembly', 'readings', 'parameters', 'ai_results'] },
  renderer_fallback: { reason: ['webgl_unavailable', 'asset_load_failed'] },
  assembly_demo_started: { action: ['start'] },
  assembly_demo_step: { action: ['previous', 'next', 'play', 'pause', 'end'] },
  pipe_toggled: { pipe: ['A', 'B', 'C'] },
  backup_toggled: {},
  ai_run_started: {},
  ai_run_completed: {},
  monitoring_verified: { source: ['browser', 'smoke_test'] },
});
const ERROR_CONTEXTS = ['window_error', 'unhandled_rejection', 'renderer_init', 'asset_load', 'experiment', 'verification', 'ai_worker', 'layout_worker'];
const ERROR_NAMES = ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError'];
const SDK_FIELDS = new Set(['token', 'distinct_id', '$device_id', '$session_id', '$window_id', '$lib', '$lib_version', '$insert_id', '$time', '$process_person_profile']);

export function sanitizeEvent(name, properties = {}) {
  if (!Object.hasOwn(EVENT_FIELDS, name)) return null;
  const safe = {};
  for (const [key, rule] of Object.entries(EVENT_FIELDS[name])) {
    const value = properties?.[key];
    if (typeof rule === 'function' ? rule(value) : rule.includes(value)) safe[key] = value;
  }
  return safe;
}

// Do not forward error messages or rejection payloads: they can contain input text.
// Preserve only same-origin JS source locations for useful error grouping.
export function sanitizeError(error, origin) {
  const safe = new Error('Unexpected application error');
  safe.name = ERROR_NAMES.includes(error?.name) ? error.name : 'Error';
  const locations = [];
  for (const line of String(error?.stack || '').split('\n').slice(1, 25)) {
    const match = line.match(/(https?:\/\/[^\s)]+):(\d+):(\d+)/);
    if (!match) continue;
    try {
      const url = new URL(match[1]);
      if (url.origin !== origin || !/\.(?:m?js)$/.test(url.pathname)) continue;
      locations.push(`    at ${url.origin}${url.pathname}:${match[2]}:${match[3]}`);
    } catch { /* Ignore malformed stack locations. */ }
  }
  safe.stack = `${safe.name}: ${safe.message}\n${locations.join('\n')}`;
  return safe;
}

export function filterOutgoing(event, origin = globalThis.location?.origin || '') {
  if (!event || (!Object.hasOwn(EVENT_FIELDS, event.event) && !['$exception', '$pageview'].includes(event.event))) return null;
  const source = event.properties || {};
  const properties = event.event.startsWith('$') ? {} : sanitizeEvent(event.event, source);
  for (const key of SDK_FIELDS) if (Object.hasOwn(source, key)) properties[key] = source[key];
  if (event.event === '$exception') {
    properties.$exception_message = 'Unexpected application error';
    properties.$exception_type = ERROR_NAMES.includes(source.$exception_type) ? source.$exception_type : 'Error';
    properties.$exception_level = 'error';
    properties.$exception_list = (Array.isArray(source.$exception_list) ? source.$exception_list : []).filter(exception => exception && typeof exception === 'object').slice(0, 5).map(exception => {
      const frames = [];
      for (const frame of (exception.stacktrace?.frames || []).slice(-24)) {
        try {
          const url = new URL(frame.filename || frame.abs_path, origin);
          if (url.origin !== origin || !/\.(?:m?js)$/.test(url.pathname)) continue;
          const safe = { filename: url.origin + url.pathname, in_app: true };
          for (const key of ['lineno', 'colno']) if (Number.isInteger(frame[key]) && frame[key] >= 0) safe[key] = frame[key];
          frames.push(safe);
        } catch { /* Discard malformed or external frame locations. */ }
      }
      const result = { type: ERROR_NAMES.includes(exception.type) ? exception.type : 'Error', value: 'Unexpected application error', stacktrace: { frames } };
      if (typeof exception.mechanism?.handled === 'boolean') result.mechanism = { type: 'generic', handled: exception.mechanism.handled };
      return result;
    });
  }
  if (ERROR_CONTEXTS.includes(source.error_context)) properties.error_context = source.error_context;
  if (typeof source.release === 'string' && /^[a-zA-Z0-9._-]{1,64}$/.test(source.release)) properties.release = source.release;
  properties.application = 'omerica-heat-rescue-lab';
  // URL, referrer, DOM text, input values, person properties and campaign fields are omitted.
  return { ...event, properties };
}

/** Official snippet queue protocol; SDK comes only from the chosen PostHog cloud. */
export function loadPostHog({ scope, document, host, token, options, timeoutMs = 8000 }) {
  return new Promise((resolve, reject) => {
    if (scope.posthog) { reject(new Error('An existing PostHog instance must be reviewed before integrating')); return; }
    const stub = []; stub._i = [[token, options, 'posthog']]; stub.__SV = 1;
    stub.people = [];
    for (const method of ['capture', 'captureException']) stub[method] = (...args) => stub.push([method, ...args]);
    scope.posthog = stub;
    const script = document.createElement('script');
    script.async = true; script.crossOrigin = 'anonymous'; script.referrerPolicy = 'no-referrer';
    script.src = `${CLOUD_HOSTS[host]}/static/array.js`;
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      script.onload = script.onerror = null;
      if (error) { script.remove(); if (scope.posthog === stub) delete scope.posthog; reject(error); }
      else resolve(scope.posthog);
    };
    const timer = setTimeout(() => finish(new Error('Analytics SDK timed out')), timeoutMs);
    script.onload = () => finish(scope.posthog !== stub && typeof scope.posthog?.capture === 'function' && typeof scope.posthog?.captureException === 'function' ? null : new Error('Analytics SDK unavailable'));
    script.onerror = () => finish(new Error('Analytics SDK unavailable'));
    try { document.head.appendChild(script); } catch (error) { finish(error); }
  });
}

export function createTelemetry(config = {}, dependencies = {}) {
  const scope = dependencies.scope || globalThis;
  const document = dependencies.document || scope.document;
  const loadSDK = dependencies.loadSDK || loadPostHog;
  const origin = scope.location?.origin || '';
  const configured = /^phc_[A-Za-z0-9]{16,256}$/.test(config.projectToken || '') && Object.hasOwn(CLOUD_HOSTS, config.apiHost);
  const AbortControllerClass = dependencies.AbortController || scope.AbortController || globalThis.AbortController;
  const privacyBlocked = () => [scope.navigator?.doNotTrack, scope.navigator?.msDoNotTrack, scope.doNotTrack, scope.navigator?.globalPrivacyControl].some(value => value === true || value === 1 || value === '1' || value === 'yes');
  const choiceKey = 'omerica_telemetry_opt_out';
  let optedOut = false;
  try { optedOut = scope.localStorage?.getItem(choiceKey) === '1'; } catch { /* Storage can be blocked. */ }
  let enabled = configured && config.enabled === true && !optedOut && !privacyBlocked() && typeof AbortControllerClass === 'function';
  const release = /^[a-zA-Z0-9._-]{1,64}$/.test(config.release || '') ? config.release : 'unversioned';
  let sdk = null, ready = null, failed = false, disposed = false, queued = [], errorCount = 0;
  let transportController = null;
  const canCapture = () => enabled && !failed && !disposed && !privacyBlocked();
  const fetchOptions = () => ({ signal: transportController.signal, keepalive: false, cache: 'no-store' });
  const abortTransport = () => { try { transportController?.abort(); } catch {} };
  const seenErrors = new WeakSet();
  const report = (method, ...args) => {
    if (!canCapture()) return false;
    if (!sdk) { if (queued.length < 25) queued.push([method, ...args]); return false; }
    try { sdk[method](...args); return true; } catch { return false; }
  };
  const capture = (name, properties) => {
    const safe = sanitizeEvent(name, properties);
    return safe ? report('capture', name, { ...safe, release }) : false;
  };
  const captureError = (error, context = 'window_error') => {
    if (!canCapture() || !ERROR_CONTEXTS.includes(context) || errorCount >= 10) return false;
    if (error && typeof error === 'object') { if (seenErrors.has(error)) return false; seenErrors.add(error); }
    errorCount++;
    return report('captureException', sanitizeError(error, origin), { error_context: context, release });
  };
  const dispose = () => {
    disposed = true; queued = [];
    abortTransport();
  };
  const start = () => {
    if (ready) return ready;
    if (!enabled || disposed || !document || privacyBlocked()) return Promise.resolve(false);
    failed = false;
    if (!transportController || transportController.signal.aborted) transportController = new AbortControllerClass();
    const options = {
      api_host: config.apiHost, defaults: '2026-08-30', autocapture: false,
      capture_pageview: true, capture_pageleave: false, capture_dead_clicks: false,
      capture_heatmaps: false, capture_performance: false, rageclick: false,
      // SDK handles uncaught errors; before_send also scrubs automatically captured exceptions.
      capture_exceptions: true, disable_session_recording: true, disable_surveys: true,
      enable_recording_console_log: false, persistence: 'memory', disable_persistence: true,
      person_profiles: 'never', advanced_disable_flags: true, before_send: event => canCapture() ? filterOutgoing(event, origin) : null,
      ip: false, respect_dnt: true,
      // No batch queue or beacon can outlive an opt-out. Retried requests retain
      // the old aborted signal; a new enabled period gets a fresh one.
      request_batching: false, disable_beacon: true, api_transport: 'fetch', fetch_options: fetchOptions(),
    };
    ready = Promise.resolve().then(() => loadSDK({ scope, document, host: config.apiHost, token: config.projectToken, options }))
      .then(instance => {
        if (disposed) return false;
        sdk = instance;
        if (!canCapture()) { queued = []; abortTransport(); return false; }
        // Off→on can occur while the CDN is still loading. Its init options keep
        // the old aborted signal, so replace that transport before flushing.
        if (transportController.signal.aborted) {
          transportController = new AbortControllerClass();
          sdk.set_config?.({ fetch_options: fetchOptions() });
        }
        for (const entry of queued) report(...entry);
        queued = []; capture('app_loaded'); return true;
      }).catch(() => { failed = true; queued = []; ready = null; abortTransport(); return false; });
    return ready;
  };
  const setEnabled = value => {
    if (disposed) return Promise.resolve(false);
    const requested = value === true;
    enabled = requested && configured && !privacyBlocked() && typeof AbortControllerClass === 'function';
    try { if (requested) scope.localStorage?.removeItem(choiceKey); else scope.localStorage?.setItem(choiceKey, '1'); } catch { /* Choice still applies in this page. */ }
    if (!enabled) { queued = []; abortTransport(); return Promise.resolve(false); }
    if (sdk) {
      if (!transportController || transportController.signal.aborted) transportController = new AbortControllerClass();
      try { sdk.set_config?.({ fetch_options: fetchOptions() }); } catch { enabled = false; abortTransport(); return Promise.resolve(false); }
      return Promise.resolve(true);
    }
    return start();
  };
  return Object.freeze({ start, capture, captureError, setEnabled, dispose, get enabled() { return canCapture(); }, get available() { return configured && !disposed && !privacyBlocked() && typeof AbortControllerClass === 'function' && !failed; }, get status() { return disposed ? 'disposed' : !configured ? 'unconfigured' : privacyBlocked() ? 'privacy_blocked' : failed ? 'unavailable' : !enabled ? 'disabled' : sdk ? 'ready' : ready ? 'loading' : 'idle'; } });
}
