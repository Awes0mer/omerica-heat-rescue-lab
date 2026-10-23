# Omerica Heat Rescue — license and citation review

Reviewed October 22, 2026. Scope: this release, which adds a 3D assembly view to the `synthetic-open-v2` portable source release; not all earlier development history and not the legal status of a future hardware product.

Analytics addendum: October 23, 2026. The optional runtime monitoring integration described below introduces a remote PostHog SDK and event destination. The earlier local-only runtime description no longer applies when monitoring is enabled.

## What may be reused commercially

| Distributed component | License / provenance | Conditions |
| --- | --- | --- |
| Project-authored JavaScript, HTML, CSS, SVG, tests and documentation | [MIT](LICENSE.txt) | Retain the copyright and permission notice. Commercial use, modification, integration, distribution and sale are permitted by this license. |
| Synthetic simulation inputs and generated benchmark results | Project-authored; included with the MIT release | Preserve notices and identify the assumptions. These are not measured manufacturer data or validation results. |
| DM Sans and Space Grotesk font files | SIL Open Font License 1.1 | Keep their original OFL notices; bundling in a commercial app is permitted. Fonts must not be sold by themselves. No font modifications were made. |
| Three.js 0.170.0 WebGL renderer | [MIT](vendor/three/LICENSE), embedded Earcut ISC and [supplemental upstream notices](third-party/THREE-NOTICE.md), locally vendored from the official npm package | Retain the original copyright and permission notice and all supplemental notice files. Vendor hashes and package integrity are in `vendor/three/provenance.json`. |
| Original procedural 3D geometry and interaction code | Project-authored, MIT | No external meshes, textures, stock photos, or reference-project code/assets are included. Geometry and particles are illustrative. |
| Mulberry32 pseudorandom-number routine | Original author CC0 dedication; JavaScript public-domain provenance | Attribution and full CC0 text are retained in `third-party/`. No claim that this routine is newly invented. |

See [third-party notices](third-party/README.md) and [pinned source hashes](third-party/asset-provenance.json). Three.js is an included npm-origin third-party renderer; no package installation is needed because its module and MIT notice are vendored. No remote AI weights, third-party images, paper PDFs, scientific abstracts, manufacturer coefficient tables or raw Valency exports are included. Simulation modules, renderer and fonts are local. Analytics additionally loads the PostHog JavaScript SDK remotely; it is not part of the pinned local-asset manifest.

## PostHog runtime monitoring

When analytics is enabled, the browser loads the SDK from PostHog's US asset service and sends selected usage events and sanitized browser-error metadata to `https://us.i.posthog.com`. The application disables session recording and automatic interaction capture, excludes raw simulation inputs, and makes no identify or person-profile calls. Analytics identifiers use memory persistence. The footer provides a control to disable collection for this browser. A single opt-out preference is saved in local storage when available; analytics identifiers still use memory. Previously received events are unaffected. Host and network logging are separate from this application setting.

The [upstream PostHog JavaScript license](https://github.com/PostHog/posthog-js/blob/main/LICENSE) is Apache-2.0, with separate notices for incorporated components, including MIT-licensed portions. It is not covered by this project's MIT license. The SDK is loaded from a remote service rather than vendored here, and its served version may change. Preserve the appropriate upstream license and notices if distributing a copy. PostHog's hosted service has separate terms; this inventory does not establish consent, legal compliance, or a service agreement. Configuration and error-reporting behavior are documented in the [JavaScript configuration reference](https://posthog.com/docs/libraries/js/config) and [web error-tracking guide](https://posthog.com/docs/error-tracking/installation/web).

## Citations are not licenses

[CITATIONS.md](CITATIONS.md) maps equations, algorithms, numerical methods and assumptions to their sources. [SOURCES.bib](SOURCES.bib) supplies bibliographic records. Scientific facts and independently implemented mathematical methods are distinguished from the authors' prose, figures, code and datasets. Linked publications retain their own rights; the MIT license does not cover them. No full paper or copied diagram is bundled.

The current TEG constants (0.05 V/K, 2.5 ohm and 0.6 W/K) are independent round benchmark assumptions. Earlier manufacturer's polynomial tables were removed because an open commercial redistribution license was not verified. The previous numerical results do not describe this release. The same fixed test suite was rerun; there was no tuning to recover an earlier winning score.

## Valency and external services

Valency Bond was used to discover literature during hackathon research. The application does not call Valency or require its account, API, search corpus, or outputs at runtime. No Valency result payload is bundled. The research comparison is independently written from the primary sources linked in the citation ledger.

The [Valency terms effective September 29, 2026](https://www.valency.io/terms/) restrict hackathon and trial use and require separate commercial licensing for productization or redistribution/exposure of its functionality, content or outputs. Hackathon sponsorship and permission to use Bond in a hackathon are not a verified commercial waiver. The owner has not confirmed a separate written commercial agreement. **Commercial Valency integration is unresolved and excluded from this release's license clearance.**

OpenAI Codex/ChatGPT, OpenAI Sites, GitHub and Slack are proprietary authoring, hosting or collaboration services. This repository does not license them and cannot honestly call the entire development stack open source. The portable application can run on an open-source HTTP server and browser without those services. It has no proprietary experiment API dependency.

## Hackathon status

The [Moment participation page](https://scientificintelligence.org/hackathon) permits solo projects and requires a public repository with a README, a public project post, and submission through a Moment account/team. The [event submission page](https://llmhackathon.github.io/submission/) also requests a one-page write-up and a video of up to four minutes accessible without login.

The organizer's October 22, 7:06 p.m. Eastern announcement on the event Slack extends the deadline to **11 p.m. CDT October 22 / midnight EDT October 23 / 04:00 UTC October 23** and allows submitted entries to be edited until then. This supersedes the older 7 p.m. Central deadline still on the event page.

Omer Orman is the solo participant; the entry discloses AI coding/research assistance, the earlier manual simulation/UI extended during the event, actual Valency research use, and the fully simulated nature of results. Valency sponsor eligibility is conditional on actual Bond use and organizer verification; no award or eligibility ruling is claimed. No Moment submission, social post or terms acceptance is performed by this code release.

## Limits of this review

This is a documented component-license and rule audit, not a legal opinion or certification of worldwide patent, trademark, contract, safety or regulatory clearance. MIT/OFL/CC0 permissions address the distributed materials under their stated terms. They do not certify a physical implementation, grant rights in cited papers, or replace a needed commercial-service agreement.
