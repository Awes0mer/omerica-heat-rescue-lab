# Heat Rescue — license and citation review

Reviewed October 22, 2026. Scope: the current `synthetic-open-v2` portable source release, not all earlier development history and not the legal status of a future hardware product.

## What may be reused commercially

| Distributed component | License / provenance | Conditions |
| --- | --- | --- |
| Project-authored JavaScript, HTML, CSS, SVG, tests and documentation | [MIT](LICENSE.txt) | Retain the copyright and permission notice. Commercial use, modification, integration, distribution and sale are permitted by this license. |
| Synthetic simulation inputs and generated benchmark results | Project-authored; included with the MIT release | Preserve notices and identify the assumptions. These are not measured manufacturer data or validation results. |
| DM Sans and Space Grotesk font files | SIL Open Font License 1.1 | Keep their original OFL notices; bundling in a commercial app is permitted. Fonts must not be sold by themselves. No font modifications were made. |
| Mulberry32 pseudorandom-number routine | Original author CC0 dedication; JavaScript public-domain provenance | Attribution and full CC0 text are retained in `third-party/`. No claim that this routine is newly invented. |

See [third-party notices](third-party/README.md) and [pinned source hashes](third-party/asset-provenance.json). No npm packages, remote AI weights, third-party images, paper PDFs, scientific abstracts, manufacturer coefficient tables or raw Valency exports are distributed. All executable imports and font requests are local.

## Citations are not licenses

[CITATIONS.md](CITATIONS.md) maps equations, algorithms, numerical methods and assumptions to their sources. [SOURCES.bib](SOURCES.bib) supplies bibliographic records. Scientific facts and independently implemented mathematical methods are distinguished from the authors' prose, figures, code and datasets. Linked publications retain their own rights; the MIT license does not cover them. No full paper or copied diagram is bundled.

The current TEG constants (0.05 V/K, 2.5 ohm and 0.6 W/K) are independent round benchmark assumptions. Earlier manufacturer's polynomial tables were removed because an open commercial redistribution license was not verified. The previous numerical results do not describe this release. The same fixed test suite was rerun; there was no tuning to recover an earlier winning score.

## Valency and external services

Valency Bond was used to discover literature during hackathon research. The application does not call Valency or require its account, API, search corpus, or outputs at runtime. No Valency result payload is bundled. The research comparison is independently written from the primary sources linked in the citation ledger.

The [Valency terms effective September 29, 2026](https://www.valency.io/terms/) restrict the free tier and require separate commercial licensing for productization or redistribution/exposure of its functionality, content or outputs. Hackathon sponsorship and permission to use Bond in a hackathon are not a verified commercial waiver. The owner has not confirmed a separate written commercial agreement. **Commercial Valency integration is unresolved and excluded from this release's license clearance.**

OpenAI Codex/ChatGPT, OpenAI Sites, GitHub and Slack are proprietary authoring, hosting or collaboration services. This repository does not license them and cannot honestly call the entire development stack open source. The portable application can run on an open-source HTTP server and browser without those services. It has no paid/proprietary experiment API dependency.

## Hackathon status

The [Moment participation page](https://scientificintelligence.org/hackathon) permits solo projects and requires a public repository with a README, a public project post, and submission through a Moment account/team. The [event submission page](https://llmhackathon.github.io/submission/) also requests a one-page write-up and a video of up to four minutes accessible without login. Prepare the stricter deliverable set because video wording differs across the two official pages.

The [organizer's October 22, 7:06 p.m. Eastern Slack announcement](https://llmsformateri-0lw8517.slack.com/archives/C04TLL1RSGH/p1792710369058659) extends the deadline to **11 p.m. CDT October 22 / midnight EDT October 23 / 04:00 UTC October 23** and allows submitted entries to be edited until then. This supersedes the older 7 p.m. Central deadline still on the event page.

Disclose Omer Orman as the solo participant, AI coding/research assistance, the earlier manual simulation/UI extended during the event, actual Valency research use, and the fully simulated nature of results. Valency sponsor eligibility is conditional on actual Bond use and organizer verification; no award or eligibility ruling is claimed. No Moment submission, social post or terms acceptance is performed by this code release.

## Limits of this review

This is a documented component-license and rule audit, not a legal opinion or certification of worldwide patent, trademark, contract, safety or regulatory clearance. MIT/OFL/CC0 permissions address the distributed materials under their stated terms. They do not certify a physical implementation, grant rights in cited papers, or replace a needed commercial-service agreement.
