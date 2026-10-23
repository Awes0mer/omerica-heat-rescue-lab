# Omerica Heat Rescue — usage monitoring

## Configuration and deployment

The browser integration targets **PostHog US project 679530**. `telemetry-config.mjs` contains the browser-public `phc_` project token, US ingestion host, enabled flag, and release label. This token routes event writes; it is not a personal API key. Never place a personal API key or other account credential in this file. The project number is an administrative identifier, not the token passed to the SDK.

The app remains buildless. `telemetry-bootstrap.mjs` creates one adapter shared by the UI modules. When enabled, the adapter loads `https://us-assets.i.posthog.com/static/array.js` and sends events to `https://us.i.posthog.com`. The remote SDK version can change independently of this repository. Simulation, optimization, fonts and the 3D renderer still run from the application files.

Serve the app from `dist/` using an HTTP server. For a different PostHog project, change the public project token and supported cloud host in `telemetry-config.mjs`, and set a release label identifying that build. Set `enabled: false` to disable the integration in the build. No package installation is needed.

**Browser verification — October 23, 2026:** the locally served application loaded the actual PostHog SDK **1.438.19** and received HTTP 200 responses from the US `/e/` ingestion endpoint. The browser check exercised `monitoring_verified`, `assembly_demo_started`, `assembly_demo_step`, and both manually reported and automatically captured `$exception` events through the outgoing sanitizer. The PostHog project UI displayed **Installation complete** and received `assembly_demo_started`. The local verification workspace preserves `work/browser-smoke.json` as its receipt. The exception recorded in the browser's error list was deliberately thrown by this verification, not an unexpected application failure.

The automated smoke test temporarily bypassed PostHog's user-agent bot filter in that test page to exercise ingestion from Playwright. This override is not in the production integration; the default bot filter remains enabled. The test still used the real remote SDK and real US ingestion endpoint.

A separate blocked-CDN and persisted-opt-out check exercised the actual 3D guided demo, pipe closure, backup cooling and restoration with no application errors. With the SDK blocked, the app showed the unavailable status and remained usable. With opt-out already saved, it made zero external requests and did not load the SDK. The receipt is `work/blocked-cdn-review.json` in the local verification workspace. These checks do not claim that every event in the table below has been individually observed in PostHog.

**Deployment status:** a production hosting target has not been identified for this change. These checks verify the locally served app and PostHog receipt, not instrumentation of an unidentified live site. Confirm the intended hosted app and repeat received-event verification before reporting deployment complete. The PostHog Inbox's signal sources must also be selected separately; adding this SDK does not configure them.

The final local checks passed **55 tests**. CodeRabbit completed review of the integration with **zero findings**. Real-SDK checks also passed disable → reload → re-enable and disabling/re-enabling while the SDK was still loading. No analytics local-storage entries remained after re-enabling.

## Events connected to the app

This table describes the current UI wiring, not every name accepted by the adapter's allowlist.

| Event | Trigger | App-specific fields |
| --- | --- | --- |
| `$pageview` | SDK pageview capture | None; URL and referrer fields are removed by the outgoing filter. |
| `app_loaded` | Adapter successfully starts | Release label. |
| `view_changed` | The app emits `heat-mode` while changing views | Allowlisted view name. |
| `assembly_demo_started` | Start guided demo button | `action: start`. |
| `assembly_demo_step` | Previous, Next, Play, Pause or End demo button | One of those five action names; this is a control action, not proof that a particular step completed. |
| `pipe_toggled` | A manual pipe state changes | Branch letter `A`, `B` or `C`. |
| `backup_toggled` | Manual backup cooling button | None. |
| `ai_run_started` | The app emits `heat-ai-start` | None. |
| `ai_run_completed` | AI results finish and are displayed | None. |
| `export_completed` | An enabled readings, parameters or AI-results download button is activated; or the app reports a successful assembly export | `format` (`csv` or `json`) and `kind` (`readings`, `parameters`, `ai_results`, or `assembly`). Browser download completion is not verified. |
| `renderer_fallback` | Manual 3D renderer falls back to the schematic | `reason: webgl_unavailable`. |
| `$exception` | Uncaught browser errors/rejections, renderer initialization failures or AI worker failures | Sanitized error type, same-origin JavaScript source locations, and allowlisted error context when available. |

The adapter adds the application identifier and validated release label, and retains the limited SDK routing, identifier and event metadata needed for ingestion. `assembly_step`, `assembly_completed`, `experiment_completed` and `monitoring_verified` are accepted by the adapter but are not currently emitted by the normal UI paths above. Do not interpret those allowlist entries as implemented product signals.

## Visitor controls and data boundaries

The footer's **Disable analytics** / **Enable analytics** button controls collection for this browser. The application saves one opt-out preference, `omerica_telemetry_opt_out`, in local storage when available. If browser storage is blocked, the choice still applies to the current page. Re-enabling removes that preference. The choice does not delete previously received events.

The configured SDK uses memory persistence for analytics identifiers and has persistent SDK storage disabled. The application does not invoke SDK consent-storage methods. Turning collection off aborts its current transport signal; re-enabling creates a new signal. Browser Do Not Track or Global Privacy Control prevents SDK loading and cannot be overridden by the application toggle. The integration makes no `identify` calls and configures person profiles as `never`. Session recording, automatic interaction capture, heatmaps, performance capture, rage clicks, surveys and console recording are disabled. The SDK is configured to respect Do Not Track and disable IP-based enrichment; network requests themselves still expose connection metadata to the receiving service.

The outgoing filter permits only named events and restricted fields. It removes raw simulation inputs and results, input text, DOM elements, page URLs, query strings, referrers, campaign parameters and person-property payloads. Error messages and rejection values are replaced with a generic message. Stack details are restricted to same-origin JavaScript file locations and line/column metadata; arbitrary values and external frames are removed. SDK-generated event identifiers and anonymous in-memory identifiers are still sent, so this is not a claim that no data leaves the browser or that visitors are unidentifiable.

SDK download failures, blocked requests, invalid configuration or offline operation are handled without preventing the simulation from running. A footer status describes whether analytics is enabled, disabled or unavailable. Host logs, browser extensions and network services are outside this application's telemetry controls. These descriptions are implementation boundaries, not a legal compliance or consent determination.

## Test and verify

From the repository root:

```sh
node --test telemetry.test.mjs
npm test
python3 -m http.server 8000 --directory dist
```

Open `http://127.0.0.1:8000/` in a browser and inspect the Network panel. With monitoring enabled and requests permitted, verify the PostHog US SDK request and ingestion requests. Inspect decoded event properties for unexpected URLs, query strings, inputs, DOM text or error messages. Then check the activity feed in the intended **US project 679530** for `app_loaded` and the corresponding release label. Confirm receipt rather than relying only on a successful HTTP response.

Exercise the guided demo, manual pipe and backup controls, AI run, and a download; check the events against the table. A local verification event can be sent deliberately from the browser console:

```js
const { telemetry } = await import('./telemetry-bootstrap.mjs');
await telemetry.start();
telemetry.capture('monitoring_verified', { source: 'browser' });
telemetry.captureError(new Error('Monitoring verification'), 'verification');
```

Verify that PostHog receives the verification event and a sanitized exception, with the supplied error message absent. Do not put credentials or real personal information into a test error.

Disable analytics, repeat interactions and confirm no new events are delivered. Reload and confirm the opt-out persists when local storage is available. Re-enable and confirm event delivery resumes. Also test with the SDK URL blocked and with storage denied; the teaching controls and AI experiment should continue working. Repeat the delivery check on the identified deployment after shipping, because local success does not verify the hosted version.

## Official sources and notices

- [PostHog JavaScript configuration](https://posthog.com/docs/libraries/js/config) describes capture, persistence and outgoing-filter options.
- [PostHog JavaScript persistence](https://posthog.com/docs/libraries/js/persistence) describes browser storage modes.
- [PostHog web error tracking](https://posthog.com/docs/error-tracking/installation/web) describes exception capture and verification.
- [PostHog JavaScript source and license](https://github.com/PostHog/posthog-js/blob/main/LICENSE) contains Apache-2.0 and supplemental incorporated-code notices, including MIT portions.
- [Application third-party inventory](third-party/README.md) distinguishes the remote SDK from bundled assets. The hosted service has separate terms.
