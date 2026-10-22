# Third-party components and provenance

Checked October 22, 2026. These notices describe material actually included in the distributable. The project's own source license does not replace the font licenses below.

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

Node.js is an optional test/benchmark development tool, not bundled in the web application. It has its own [license and third-party notices](https://github.com/nodejs/node/blob/main/LICENSE). There are no npm package dependencies or bundled AI model weights in this release.
