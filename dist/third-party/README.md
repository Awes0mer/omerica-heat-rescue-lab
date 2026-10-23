# Third-party components and provenance

Checked October 22, 2026; PostHog runtime-service entry added October 23, 2026. These notices distinguish bundled material from remotely loaded software. The project's own source license does not replace the component licenses below.

## Fonts

The two original variable font files are bundled locally. The app no longer requests Google Fonts or another font service at runtime. The files are unmodified; only their local filenames were shortened.

| Component | Upstream authors | License | Included notice |
|---|---|---|---|
| DM Sans | Copyright 2014 The DM Sans Project Authors | SIL Open Font License 1.1 | [DM-SANS-OFL.txt](DM-SANS-OFL.txt) |
| Space Grotesk | Copyright 2020 The Space Grotesk Project Authors | SIL Open Font License 1.1 | [SPACE-GROTESK-OFL.txt](SPACE-GROTESK-OFL.txt) |

Both were obtained from [google/fonts commit 5695f452dc9e725f214a1ccc22fc68be7fc94cf3](https://github.com/google/fonts/tree/5695f452dc9e725f214a1ccc22fc68be7fc94cf3). Exact upstream file URLs, byte sizes, and SHA-256 hashes are recorded in [asset-provenance.json](asset-provenance.json).

OFL permits commercial embedding and distribution with software. Preserve each copyright notice and the full OFL text when distributing these fonts. Font files remain under OFL; do not sell them by themselves or misrepresent endorsement. Consult the included license for modification and naming conditions.

## Reproducible sampling

The `seededRandom` helper in `ai-planner.js` implements Mulberry32, originally published by Tommy Ettinger under CC0, with the corresponding JavaScript variant published by bryc under a public-domain dedication. See [MULBERRY32-LICENSE.txt](MULBERRY32-LICENSE.txt), the full [CC0 legal text](CC0-1.0.txt), and the pinned source references in the provenance manifest. The algorithm is not new and is not cryptographically secure.

## Mathematical methods

The normal cumulative-distribution approximation implements Abramowitz and Stegun (1964), *Handbook of Mathematical Functions*, NBS Applied Mathematics Series 55, p.299, equation 7.1.26. The code does not bundle scans, prose, or a third-party implementation of that formula. See [NIST's handbook record](https://www.nist.gov/mathematics-statistics/handbook-mathematical-functions-abramowitz-and-stegun) and [NIST's rights statement](https://www.nist.gov/open/license).

Gaussian-process regression, expected improvement, constrained Bayesian optimization, Runge–Kutta integration, and the thermal equations are established methods implemented in the project's source. Scientific citations document those methods; a paper link is not a software dependency or a claim that the paper itself is open source. The app's equations and sources sections identify the scientific references.

## External services and development tools

Valency was used for literature research. No Valency client, API key, model weights, or raw paper abstracts are embedded in this app. It is not called by the deployed experiment loop.

The hosted demonstration uses OpenAI Sites, a service separate from this portable source. The source can be served by another static HTTP server. This notice does not grant rights to OpenAI Sites, Valency, web browsers, operating systems, or any other external service.

Node.js is an optional test/benchmark development tool, not bundled in the web application. It has its own [license and third-party notices](https://github.com/nodejs/node/blob/main/LICENSE). No npm install step or bundled AI model weights are required. This release has a locally vendored npm-origin dependency: Three.js 0.170.0, described below. The lack of a package.json dependencies field does not mean no third-party JavaScript is present.

## PostHog JavaScript SDK — remotely loaded monitoring

When analytics is enabled, the app loads the SDK from `https://us-assets.i.posthog.com/static/array.js` and sends selected usage events and sanitized browser-error metadata to PostHog US at `https://us.i.posthog.com`. It uses a public project token. The application configuration disables session recording, automatic interaction capture and person profiles, excludes raw simulation inputs, and keeps analytics identifiers in memory. The footer includes a control to disable collection for this browser. The opt-out preference alone is saved in local storage when available.

The SDK is fetched at runtime, not bundled in this source archive or included in `asset-provenance.json`; the remotely served version may change. [PostHog's upstream LICENSE](https://github.com/PostHog/posthog-js/blob/main/LICENSE) identifies Apache-2.0 for the JavaScript SDK and retains separate incorporated-code notices, including MIT-licensed portions. Retain the full applicable upstream license and notices when redistributing SDK files. This project's MIT license does not relicense the SDK or the hosted PostHog service.

Official references: [JavaScript web configuration](https://posthog.com/docs/libraries/js/config), [web error tracking](https://posthog.com/docs/error-tracking/installation/web), and [upstream source](https://github.com/PostHog/posthog-js).


## Three.js — 3D assembly view

Three.js **0.170.0** is bundled in `../vendor/three/three.module.js` under the [MIT license](../vendor/three/LICENSE), copyright © 2010–2024 three.js authors. Keep that complete license with the module and preserve the [version-specific supplemental notices](THREE-NOTICE.md), including embedded Earcut 2.2.4 (ISC) and upstream shader/math credits. [Notice provenance](three-0.170.0-notice-provenance.json) records exact source pins and hashes. It is used only to render the presentation layer; it does not replace or alter the thermal solver, AI planner or experiment protocol.

Source package: [official npm tarball](https://registry.npmjs.org/three/-/three-0.170.0.tgz). The verified SHA-512 package integrity and per-file SHA-256 values are recorded in [vendor provenance](../vendor/three/provenance.json). The locally included module and LICENSE were rehashed during the release audit and match that record.

The original `assembly-scene.js` builds new procedural server/plate/tile/plumbing geometry and local text labels. No assets from external visual references, manufacturer CAD, downloaded textures, or stock images are included. It uses handwritten orbit/pinch/raycast interaction rather than an additional controls dependency. The module itself carries the project's MIT notice.

The 3D assembly view is part of this release. Three.js is used only for drawing; it does not change the physics, the optimizer or the recorded benchmark.
