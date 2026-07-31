# Part 2: The Standards

Standards live at two levels: universal adoptions shipped by the framework, and per-project standards owned by each project.

## Universal adoption sheets — shipped

The current principles corpus (36 docs, about 73k words, seven families) is distilled into one adoption sheet per family. A sheet is one page: imperative lines, each backed by a named check where one is possible, marked `judgment` where not. The knowledge content, meaning the essays explaining why, is deleted. The adoptions:

- **Architecture**: clean/hexagonal architecture adopted deeply. Capability core with ports and adapters, dependency direction enforced by import linters, the folder pattern that expresses it. ADR discipline for every binding decision.
- **Testing**: honeycomb shape. System tests first, unit tests where logic warrants. Independent oracles: the author never grades its own work. Proofs materialize red before implementation. Real infrastructure over mocks at the seams.
- **Observability**: trace-first. Spans ship with the first feature, not later. Health, logs, and metrics as a day-2 baseline present from day one.
- **API**: contract-first at the seams. Specs captured from running code, never promoted from design drafts. One uniform error shape.
- **Design**: token-driven UI. No raw color, font, or spacing literals. The token scan enforces this. Design system before screens.
- **Quality**: the security, privacy, accessibility, and performance baselines as manifest rows. The rows: dependency audit, secrets scan, a11y smoke.
- **Delivery**: progressive delivery and the day-2 operational baseline as scaffold outcomes, not aspirations.

## Per-project standards — owned by each project

Written at the birth seal (greenfield) or adoption seal (brownfield) from the sealed toolchain choices.

- Seeded from a shipped stack sheet where one exists. The six current stacks become seeds.
- Researched fresh for stacks we have never touched. A fresh-context adversary reviews before sealing, because the researcher would otherwise grade its own work. This is how a new stack is first-class from day one.
- Currency comes from the birth-time choice and the model's own freshness, not from the framework keeping per-platform files current.
- Version-correction notes are kept, small and `dated`. They cover the cases where model training lags current toolchains.

## Enforcement

- **The blessed module.** Each pattern has a canonical example inside the project: real code that ages with the product. It carries its own freshness date. A rotted example poisons every future mirror.
- **Ratchets.** Lint is diff-scoped: new and changed lines must be clean. Legacy violations are counted per rule per module and may only decrease. This is how an existing codebase converges on the style without a big-bang rewrite.
- **The cleanup pass.** A fresh-context pass strips narration comments and simplifies structure on quick and bet lanes. Not on patches. Ceremony stays out of the light lane.
- **Bounce feedback.** A repeated review-rejection reason earns an imperative or a check, under the word cap. This way steering grows from observed failures instead of anticipation. Per-project sheets have their own cap, checked by the battery.
- Ratchet linter code gets the same adversary review and deletion-testing as probes.
