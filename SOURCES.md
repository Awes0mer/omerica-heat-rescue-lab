# Omerica Heat Rescue — sources for this combined release

- Audited application base: `e56c199`, branch `assembly-20261022`.
- Alternate assembly interaction reference: `2aa2cd5`, from the same author’s Omerica Heat Rescue repository. Controls were adapted to the audited application’s existing simulation rather than replacing the audited UI.
- Claude’s follow-up `0290bfb` supplied the completed README submission paragraph and prompted clearer hosting documentation and a version-specific supplemental renderer-notice check. Its alternative branch is preserved as `claude-entry-20261022`; its newer renderer was not transplanted.
- Claude’s naming follow-ups through `374edca` supplied Omerica-prefixed package/export names and the renamed public source link. The internal planner protocol identifier remains unchanged.
- The guided component tour, camera focus and collapsible explanation panels are original additions using the existing teaching solver. Its benefit language describes possible uses and hardware-validation limits, supported by the existing citation ledger; it makes no new measured performance claim.
- Equations and research sources: [citation ledger](dist/CITATIONS.md), [bibliography](dist/SOURCES.bib), and [research comparison](dist/research-gap.md).
- Bundled renderer, fonts and seeded random routine: [third-party notices](dist/third-party/README.md), [asset provenance](dist/third-party/asset-provenance.json), and [Three.js provenance](dist/vendor/three/provenance.json), and [version-specific upstream notices](dist/third-party/THREE-NOTICE.md).
- New controls and procedural geometry use the repository MIT license. No new dependency, mesh, image, font or reference-project asset was added.
