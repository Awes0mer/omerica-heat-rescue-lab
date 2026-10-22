# Heat Rescue — AI Experiment Lab

**Can an AI learn where to place six thermoelectric generators and when to activate backup cooling, then pass cooling failures it has not trained on?**

Heat Rescue runs that experiment in the browser. A Gaussian-process learning model proposes designs, a thermal simulator calculates their results, and the learner updates before choosing its next experiment. Random search and placement-only AI receive the same experiment budget. The selected designs then face held-out conditions.

**Every temperature, watt and joule is simulated.** These are results from an uncalibrated model with example parameters, not hardware measurements, a certified cooling system, or proof of a first-ever invention. The AI method is established Bayesian optimization, not an LLM or a scripted winning design.

## Run and reproduce

No installation or build step is required. Serve `dist/` with a static HTTP server and open it in a browser. The interface uses ES modules and workers; opening `index.html` directly as a local file is insufficient for workers on many browsers.

```sh
python3 -m http.server 8000 --directory dist
npm test
npm run benchmark
```

`npm test` runs all `*.test.mjs` files with Node's built-in test runner. `npm run benchmark` reruns the frozen eight-seed comparison and writes `dist/ai-benchmark.json`, including scenario definitions, individual results, learning curves and SHA-256 hashes of the planner and experimental physics source. The benchmark needs no network, API key or external model service.

## A short demonstration for judges

1. Open **AI experiment lab** and click **Run AI experiments**. Say: “We give each search 18 design experiments. Each design uses the same six tiles and the same test conditions.”
2. Point to **AI predicted** and **Physics calculated**. Say: “The AI predicts a result, runs that experiment, then learns from the difference. It chooses where the tiles go, the temperature that starts backup cooling, and the backup flow.”
3. Compare the learning curves and final cards. Say: “More generated electricity is not enough. We subtract extra pumping energy and separately check the temperature limit.”
4. Open **Watch the chosen design face a held-out pipe failure**, choose a condition and replay it. Say: “These longer faults were withheld from the searches. The hot plate and water change temperature over time, and backup pumping has an electrical cost.”
5. Open **The experiment notebook**, **Fair comparison & reproducibility**, and **What’s the research gap?** Say: “The predictions, observations, equations, assumptions and comparison results are inspectable. Some learned designs fail unfamiliar conditions; we report those failures.”

For the physical intuition, the separate **Explore the physics** tab lets a viewer block a pipe and enable backup cooling directly. Its equal-load teaching setup is different from the AI benchmark; do not treat its readings as a replay of an AI design.

## The experiment protocol

The AI plant has three branches with assumed heat inputs of **240, 200 and 160 W**. The total is 600 W. Each design has exactly six tiles, giving 28 possible integer allocations across the branches. Four activation temperatures—66, 70, 74 and 78°C—and four backup flow fractions—25%, 50%, 75% and 100% of nominal main flow—give **448 joint designs**.

Each branch has its own temperature-only backup controller. It reads the hot plate once per second, turns on at the chosen threshold, and turns off 2°C below it. It cannot inspect fault location, fault severity or future conditions. Backup supplies an independent parallel route and may run on a healthy branch if that branch is hot enough. Branch flows do not redistribute.

- **Training:** three separate 600-second trials, fully blocking A, B or C after 30 healthy seconds. Each design begins at its own all-open, pre-controller equilibrium. Preparation energy before the trial is excluded consistently.
- **Objective:** maximize the smallest integrated net recovery across the three training cases: generated electrical energy minus the assumed 0.9 W recovery-equipment cost and calculated backup pumping energy.
- **Constraint:** maximum modeled hot-plate temperature must stay at or below the illustrative 80°C comparison limit. This is not a hardware-approved temperature rating.
- **Joint AI:** two Gaussian-process surrogates learn energy and maximum temperature. Expected improvement, weighted by predicted feasibility, selects the next unused design. Kernel scales are fixed in the published protocol; the fitted predictions update after every observation.
- **Random:** seeded uniform sampling without consulting observed outcomes. It and joint AI share the same four initial observations and receive 18 observations each, including those starts.
- **Placement-only AI:** the same 18-observation budget and learning method, restricted to the 28 allocations with a 74°C trigger and 50% backup flow. It has four starts within its restricted space, including the fixed baseline.
- **Fixed baseline:** two tiles on each branch, 74°C activation and 50% backup flow.

All selected designs are frozen before held-out evaluation. The **six held-out 900-second cases** cover partial blockage, warmer inlet/room temperatures, shifted workload, weaker thermal conductances, reduced main flow, and a combined condition. The full case definitions are public in `dist/experiment-model.js`; held-out results are never fed to the learner or used to choose its winner. This is a reproducible held-out model test, not an externally administered blind trial.

The searches do not evaluate every joint design and do not establish a global optimum. An infeasible trial is retained and labeled. If no feasible design is found, the result stays infeasible. A higher energy score cannot turn an over-temperature design into a success.

## Recorded eight-seed result

Current parameter profile: **synthetic-open-v2**. This supersedes earlier manufacturer-derived development results; the release uses independently chosen assumptions, and the same seeds/scenarios were rerun without tuning.

The frozen benchmark used seeds **1 through 8**, 18 observations per search, and the protocol above. No algorithm or scenario was retuned after inspecting these held-out results.

| Search | Within temperature limit in every held-out case | Positive worst-case net energy AND within limit | Median worst-case held-out energy |
|---|---:|---:|---:|
| Joint AI | 6 / 8 | **6 / 8** | 167.677 J |
| Random search | 5 / 8 | 1 / 8 | −270.580 J |
| Placement-only AI | 8 / 8 | 0 / 8 | −219.123 J |
| Fixed baseline | 8 / 8 | 0 / 8 | −385.763 J |

The energy medians include unsuccessful temperature outcomes; always read them together with feasibility. Joint AI exceeded the temperature limit on seeds 2 and 6. Random search did so on seeds 2, 3 and 7. Eight seeds and one assumed physical model are an illustrative comparison, not statistical proof of general superiority or real-world safety.

The interface's separately specified default seed, **20261022**, selected tiles **[3, 2, 1]**, activation **66°C**, and backup flow **25%**. Its worst held-out net energy was **141.054 J**, and its peak temperature across the held-out suite was **78.898°C**. These are calculated model outcomes, not constants used to steer the search. Change the seed or budget to rerun the learning loop; an AI win is not guaranteed.

## Physics and accounting

The experimental plant shares the thermoelectric equations in `dist/model.js` with the manual illustration. For each tile, with temperatures in kelvin in the Peltier terms:

```text
I   = α(Th − Tc) / (R + RL), with matched load RL = R
P   = N I² RL
Qh  = N[α Th I − ½ I² R + K(Th − Tc)]
Qc  = N[α Tc I + ½ I² R + K(Th − Tc)]
Qh − Qc = P
```

Each hot plate, cold plate and water volume obeys `C dT/dt = heat in − heat out`. Conductive paths use `Q = G ΔT`; flowing water exports `Q = ṁ cp (Twater − Tin)`. A parallel metal path lets some heat bypass the generator tiles. The solver uses fourth-order Runge–Kutta with steps no greater than 0.25 seconds. Closing a pipe removes main flow but retains the water and its stored heat.

The experimental backup pumping cost uses:

```text
Ppump = Δp ṁ / (ρ η)
Δp = Δpref (ṁ / ṁref)²
```

The reference pressure is **25 kPa**, reference flow **0.005 kg/s**, assumed efficiency **25%**, and water density **997 kg/m³**. This is an assumed fixed-resistance circuit relationship, not a measured pump curve. Each independently regulated backup route is charged separately. At the four flow choices, one active route costs approximately 0.063, 0.502, 1.693 or 4.012 W. Larger backup flow can erase the recovered electricity.

The displayed net recovery subtracts **incremental modeled cooling costs**, not all rack or facility electricity. The unchanged 3 W main pump and server electricity are outside that incremental objective. Pump dissipation is outside the modeled thermal control volume. The model does not prove net facility savings or that recovered power can operate the cooling system.

## Limits and what may be new

Valency was used for nine literature searches, followed by primary-source checks. It is not a runtime dependency or a validator of the physics. The detailed comparison and search coverage are in `dist/research-gap.md`.

Heat-to-electricity conversion, thermoelectric placement optimization, machine-learning heat-recovery optimization, Bayesian thermal design and subtracting cooling costs all have prior work. **The candidate contribution is this particular joint placement-and-backup fault benchmark, its budgeted learning experiment and its reproducible results.** The reviewed papers did not establish an exact match, but incomplete search coverage is not proof that the combination is unprecedented. Do not pitch this as the first AI heat-recovery system or a new physical mechanism.

The thermoelectric properties are independent synthetic benchmark assumptions: α = 0.05 V/K, R = 2.5 Ω, K = 0.6 W/K, held constant. The synthetic-open-v2 release removes the earlier manufacturer polynomial dataset; it is not a rounded copy or measured calibration. Results were rerun after this provenance change without tuning against the held-out suite. Heat capacities, geometry, thermal conductances, loads, flow rates and cooling boundaries are assumptions. The model has no hardware calibration, internal CPU hotspots, CFD, hydraulic coupling, temperature-dependent module properties, converter losses, facility chiller model or complete pump characterization. The imposed water supply temperature is a boundary condition, not free cooling demonstrated in a real facility. Gaussian-process uncertainty describes the learned surrogate, not calibrated measurement error or safety confidence.

The separate manual example uses three identical 200 W branches and an assumed fixed 0.5 W backup cost. Its original 28-layout exhaustive comparison is a teaching exercise, not the AI benchmark.

## Verifiable sources

- [Ferrotec, thermoelectric generation equations, §13](https://thermal.ferrotec.com/technology/thermoelectric-reference-guide/thermalref13/)
- [Ferrotec, reference-module parameter model, §11](https://thermal.ferrotec.com/technology/thermoelectric-reference-guide/thermalref11/)
- [MIT, lumped thermal balance, §6.7.2](https://web.mit.edu/snively/www/2_005%20Coursenotes-1.pdf)
- [Bosch, flowing-water heat balance](https://www.boiler-planning.com/en/hotwater/planning/fundamentals/heat-output)
- [US Department of Energy, pumping-system efficiency](https://www1.eere.energy.gov/manufacturing/tech_assistance/pdfs/test_pumping_system__pumping_systemts4.pdf)
- [Snoek et al., Gaussian-process Bayesian optimization, 2012](https://arxiv.org/abs/1206.2944)
- [Gelbart et al., constrained Bayesian optimization, 2014](https://arxiv.org/abs/1403.5607)
- [H2P: data-center thermoelectric hardware and cooling optimization](https://fangmingliu.github.io/files/H2P-camera-ready.pdf)
- [Physics-based machine learning optimization of thermoelectric assembly, 2024](https://doi.org/10.1016/j.energy.2024.132821)
- [Transient thermal-network layout optimization using Bayesian optimization, 2020](https://arxiv.org/abs/2008.13571)
- [Existing thermoelectric array reconfiguration research, 2022](https://www.frontiersin.org/journals/energy-research/articles/10.3389/fenrg.2022.967167/full)

Published equations support the mechanisms. Prior hardware papers do not validate this implementation's assumed component values or predict its accuracy on a real rack.

## Verification

The combined tests check thermoelectric and full-transient energy conservation, steady initialization, blockage and restoration, negative net recovery, temperature failures, pump accounting, temperature-only controller behavior, fixed tile budgets, surrogate fitting, observed data changing the next proposal, reproducibility, equal observation budgets, held-out isolation and cancellation. Numerical consistency tests establish that the implementation follows its stated model; hardware measurements would still be required for physical validation.

The interface exports calculated experiment observations. Replay traces are computed by the simulator. No winning design or result trace is prerecorded into the planner. The benchmark JSON is separately labeled saved verification evidence.

## Open-source release and commercial reuse

Project-authored code, UI, documentation and synthetic benchmark data are released under the [MIT license](LICENSE). Preserve that notice. Bundled fonts retain SIL OFL-1.1; Mulberry32 has CC0/public-domain provenance. Preserve every file in `dist/third-party/`. See [license scope](dist/COMPLIANCE.md), [third-party inventory](dist/third-party/README.md), [citation ledger](dist/CITATIONS.md), and [BibTeX](dist/SOURCES.bib). There are no npm dependencies, external AI weights, or runtime API credentials. The runtime uses only local files and browser APIs, including local font files.

The clean public source release excludes earlier private Git history, raw Valency exports, manufacturer coefficient tables, third-party paper PDFs and private hosting configuration. No claim is made that cited papers themselves are open source.

Valency was a research-stage service. It is not integrated into the executable app or required to rerun it. A separate commercial Valency license has **not** been verified; do not sell a Valency integration or redistribute its content/outputs on the strength of hackathon sponsorship. OpenAI Codex/ChatGPT, OpenAI Sites, GitHub and Slack are proprietary development/hosting/collaboration services, not dependencies licensed by this repository. The portable app can be served with open-source Python on Linux and viewed in Firefox without those services.

## Hackathon disclosure

Solo project prepared by Omer Orman with AI coding and research assistance in OpenAI Codex/ChatGPT. Valency Bond was used for literature discovery; primary sources were checked independently. Existing event-period manual simulation/UI were extended with the AI experiment loop, benchmark, and license-clean release. Do not claim an LLM runtime, manufacturer validation, proven first-ever novelty, or an entirely open-source authoring/hosting stack.

The [current Moment instructions](https://scientificintelligence.org/hackathon) allow solo participation and require a public repository, README, public project post and submission on Moment. [Organizer extension (event Slack login required)](https://llmsformateri-0lw8517.slack.com/archives/C04TLL1RSGH/p1792710369058659): 11 p.m. CDT October 22 = midnight EDT October 23, 2026. The [event submission page](https://llmhackathon.github.io/submission/) retains earlier timing and a mandatory video of at most four minutes, while Moment phrases video as optional; prepare the video to satisfy both. This repository is not evidence that a Moment entry has been submitted.
