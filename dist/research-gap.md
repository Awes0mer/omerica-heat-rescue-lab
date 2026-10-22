# Heat Rescue: research-gap assessment
Checked October 22, 2026. Nine Valency searches were used, followed by original-paper inspection. Valency's corpus did not contain every close paper; a zero result is not proof of novelty.

## Recommendation

Build a **budgeted learning experiment for transient cooling failures**: jointly choose where a fixed set of generators goes and when backup cooling activates; learn from simulated trials; then lock the design and test it on unseen partial pipe blockages and varied heat-transfer conductances.

Research question: **Can learning from a small number of fault experiments find a design that recovers more net electricity while respecting a temperature limit, and does the result survive faults it has not seen?**

This is a candidate application and benchmark contribution. It is not evidence of a first-ever technique or hardware invention. The honest distinctive output is the implemented benchmark, experimental protocol, data and measured-in-simulation result. A positive result is not guaranteed.

## Closest papers and limits

1. **[Heat to Power: Thermal Energy Harvesting and Recycling for Warm Water-Cooled Datacenters](https://fangmingliu.github.io/files/H2P-camera-ready.pdf).** Full 14-page author PDF inspected. It already combines a TEG hardware prototype, water-circulation design, cooling settings and workload balancing, with temperature constraints. Its evaluation focuses on workload traces. The inspected experiments do not address partial-blockage fault ensembles, a learned backup threshold or held-out heat-transfer-conductance variation. Do not claim our simulator matches its hardware validation.

2. **[Physics-based machine learning optimization of thermoelectric assembly for maximizing waste heat recovery](https://doi.org/10.1016/j.energy.2024.132821), 2024.** Publisher abstract, introduction and section excerpts inspected; full text unavailable. It already uses physical simulation plus random-forest/polynomial prediction and genetic search for a data-center fan/heat-sink/TEG assembly. It explicitly maximizes generation minus fan electricity. The disclosed optimization changes fin geometry, not a transient liquid-cooling fault response. This rules out “AI optimizing data-center heat recovery” and “counting cooling costs” as novelty.

3. **[Machine learning thermal circuit network model for thermal design optimization of electronic circuit board layout with transient heating chips](https://arxiv.org/abs/2008.13571), 2020.** Full 13-page preprint inspected. It already uses Gaussian-process Bayesian optimization with lumped transient heat networks, comparing against PSO, genetic and exhaustive searches. Its task is chip-temperature/layout optimization under prescribed changing loads. Our use of BO and transient thermal networks is therefore established methodology, not a new algorithm.

4. **[Generative Design for Direct-to-Chip Liquid Cooling for Data Centers](https://arxiv.org/abs/2604.10941), 2026.** Full preprint HTML inspected. It iteratively generates cooling-channel layouts from thermal feedback. Section 2 explicitly uses a two-dimensional steady-state model under worst-case thermal design power. It does not model thermoelectric power generation, transient blockages or backup-control co-design.

5. **[Bi-objective Bayesian Optimization for Multi-variable Performance Enhancement of Non-uniform Thermoelectric Generators](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5645576), 2025.** Author-uploaded SSRN abstract inspected; full text not inspected. It combines an experimentally checked zero-dimensional model with Bayesian optimization over hot-gas temperature, device duty ratio and leg height for power/efficiency tradeoffs. BO applied to TEGs is already done. The abstract does not report our fault-and-backup benchmark; this is not a claim about unseen full text.

Additional overlaps: [PSO array reconfiguration](https://www.frontiersin.org/journals/energy-research/articles/10.3389/fenrg.2022.967167/full), [prediction-based vehicle TEG rewiring](https://arxiv.org/abs/1804.01574), and [robust multi-stage TEG uncertainty analysis](https://doi.org/10.1016/j.applthermaleng.2024.123212). Reconfiguration, prediction and uncertainty individually are not new.

## Required scientific distinctions

- **Real AI:** fit a predictive surrogate to completed experiments, update it, use an acquisition function to choose the next design. Record the prediction before evaluation and display it alongside the observed result.
- **Fair test:** equal simulation budgets against random search and sensible fixed designs, same initial observations, multiple seeds. A learned optimizer must earn its improvement.
- **Sealed test:** hold out fault severity, heat-transfer-conductance and inlet-temperature scenarios; fault onset remains fixed at 30 seconds. Never feed test scores back to the learner.
- **Ablation:** compare placement alone with placement plus backup activation threshold.
- **Accounting:** integrate generated electricity minus incremental cooling electricity over the same time horizon; show both terms. Enforce the temperature limit separately.
- **Failure is allowed:** show infeasible designs and negative net energy. Do not tune the benchmark after observing test results to create an AI win.
- **Scope:** all physics outputs remain simulated with assumed parameters until verified against hardware measurements.

## Suggested claim

“Heat Rescue is an open simulated experiment in learning how to place thermoelectric generators and control backup cooling under pipe failures. The AI chooses experiments, learns from their results, and is evaluated on faults withheld from its training.”

If a statistically credible advantage is observed, append its numerical result with uncertainty. Until then, state the question rather than an achievement.

Search summary: nine Valency queries covering thermoelectric fault tolerance, Bayesian thermal design, backup control, and uncertainty, followed by direct checks of the primary works listed above. Full raw tool outputs are retained with the development record, not served as a live app integration.

