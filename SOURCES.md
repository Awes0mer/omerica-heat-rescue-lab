# Omerica Heat Rescue — sources for this combined release

- Audited application base: `e56c199`, branch `assembly-20261022`.
- Alternate assembly interaction reference: `2aa2cd5`, from the same author’s Omerica Heat Rescue repository. Controls were adapted to the audited application’s existing simulation rather than replacing the audited UI.
- Claude’s follow-up `0290bfb` supplied the completed README submission paragraph and prompted clearer hosting documentation and a version-specific supplemental renderer-notice check. Its alternative branch is preserved as `claude-entry-20261022`; its newer renderer was not transplanted.
- Claude’s naming follow-ups through `374edca` supplied Omerica-prefixed package/export names and the renamed public source link. The internal planner protocol identifier remains unchanged.
- The guided component tour, camera focus and collapsible explanation panels are original additions using the existing teaching solver. Its benefit language describes possible uses and hardware-validation limits, supported by the existing citation ledger; it makes no new measured performance claim.
- Equations and research sources: [citation ledger](dist/CITATIONS.md), [bibliography](dist/SOURCES.bib), and [research comparison](dist/research-gap.md).
- Bundled renderer, fonts and seeded random routine: [third-party notices](dist/third-party/README.md), [asset provenance](dist/third-party/asset-provenance.json), and [Three.js provenance](dist/vendor/three/provenance.json), and [version-specific upstream notices](dist/third-party/THREE-NOTICE.md).
- New assembly controls and procedural geometry use the repository MIT license. Those assembly changes added no new dependency, mesh, image, font or reference-project asset. The later monitoring addition below introduces a remote SDK.

## PostHog monitoring addition — October 23, 2026

- [PostHog JavaScript configuration](https://posthog.com/docs/libraries/js/config): supported capture, persistence, profile and outgoing-filter configuration.
- [PostHog JavaScript persistence](https://posthog.com/docs/libraries/js/persistence): browser storage modes.
- [PostHog event-data redaction](https://posthog.com/tutorials/web-redact-properties): the project-level Discard client IP data control; removing an event property alone does not prevent IP detection.
- [PostHog web error tracking](https://posthog.com/docs/error-tracking/installation/web): the SDK-loading protocol, exception capture and received-event verification.
- [PostHog JavaScript upstream source](https://github.com/PostHog/posthog-js) and [LICENSE](https://github.com/PostHog/posthog-js/blob/main/LICENSE): Apache-2.0 with separate incorporated-code notices, including MIT portions. The SDK is remotely loaded from PostHog US rather than vendored or pinned in the local asset manifest.
- The app-specific event allowlist, payload filtering and footer controls are project-authored integration code. See [monitoring setup and data boundaries](dist/MONITORING.md) and the [third-party inventory](dist/third-party/README.md). The SDK license does not license PostHog's hosted service or establish a legal compliance determination.
