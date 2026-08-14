# Part 2: The Standards

Standards live at two levels. Some are universal adoptions, shipped by the framework. Others are per-project standards, owned by each project.

## Universal adoption sheets — shipped

The current principles corpus has 36 docs, about 73k words, across seven families. We distill it into one adoption sheet per family.

Each sheet is one page. It holds imperative lines. Each line is backed by a named check, where a check is possible. Where no check is possible, the line is marked `judgment`. We delete the knowledge content — the essays that explain why.

The adoptions:

- **Architecture**: Clean/hexagonal architecture, adopted deeply.
  - A capability core, with ports and adapters.
  - Import linters enforce the dependency direction. A folder pattern expresses it.
  - ADR discipline for every binding decision.

- **Testing**: Honeycomb shape — system tests first, unit tests where logic warrants.
  - For user-facing capability, the system test drives the UI, not the API beneath it ([proof.md](proof.md)).
  - Independent oracles: the author never grades its own work.
  - On the complex lane, the author never writes the tests that accept its own work either. Those tests are written blind, from the sealed design ([proof.md](proof.md)).
  - Headline proofs are written first. They are observed failing before the implementation exists.
  - Standard-lane slices write their tests first, the same way.
  - Complex-lane accepting suites are written blind, after the build ([proof.md](proof.md)).
  - All of them implement a proof plan, authored before the implementation.
  - Fixtures vary the axes the design names risky — never just the happy shape. Where the stack supports it, use property-based tests.
  - Real infrastructure over mocks, at the seams.

- **Observability**: Trace-first. Spans ship with the first feature, not later. Health, logs, and metrics are a day-2 baseline — present from day one.

- **API**: Contract-first, at the seams. Specs are captured from running code, never promoted from design drafts. One uniform error shape.

- **Design**: Token-driven UI. No raw color, font, or spacing literals. The token scan enforces this ([proof.md](proof.md)). Design system before screens.

- **Quality**: Security, privacy, accessibility, and performance baselines are rows in the capability manifest. They get probed like any other capability ([proof.md](proof.md)).
  - The rows: dependency audit, secrets scan, a11y smoke, and a performance budget.
  - The performance budget is a timing assertion on the headline front-door cases. It is ratcheted, so it may only hold or improve.
  - The budget exists because of the method's founding failure: magpie's first bet shipped a 5–10× slowdown, and it shipped green ([evidence.md](evidence.md)).
  - Privacy's row is the fixture-provenance rule ([proof.md](proof.md)).

- **Delivery**: Progressive delivery and the day-2 operational baseline are scaffold outcomes, not aspirations.
  - Feature flags are opt-in. A project that uses them declares its backend here, and registers each flag ([proof.md](proof.md)). A project that does not use them never sees the machinery.

## Per-project standards — owned by each project

These are written at the birth seal (greenfield) or the adoption seal (brownfield), from the sealed toolchain choices.

- Seeded from a shipped stack sheet, where one exists. The six current stack skills — Go, Python, Node, Next.js, Flutter, Electron — become the first seeds.
- Researched fresh for stacks we have never touched. A fresh-context adversary reviews before sealing, because the researcher would otherwise grade its own work. This is how a new stack is first-class from day one.
- Currency comes from the birth-time choice and the model's own freshness — not from the framework keeping per-platform files current.
- Version-correction notes are kept. They are small and `dated`. They cover cases where model training lags current toolchains.

## Enforcement

- **The blessed module.** Each pattern has a canonical example inside the project: real code that ages with the product. It carries its own freshness date, because agents copy the blessed module when they build new code. A rotted example spreads its rot into everything copied from it.
- **Ratchets.** Lint is diff-scoped: new and changed lines must be clean. Legacy violations are counted per rule, per module, and may only decrease. This is how an existing codebase converges on the style, without a big-bang rewrite.
- **The cleanup pass.** A fresh-context pass, at the execution tier, strips narration comments and simplifies structure on the standard and complex lanes. Not on patches — ceremony stays out of the lightest lane.
- **Bounce feedback.** A repeated review-rejection reason earns an imperative or a check — growth with a stated reason, exactly what the word budget asks ([index.md](index.md)). This way, steering grows from observed failures, not anticipation. The battery publishes each sheet's size, the way CI publishes the corpus total: counted, never gating.
- Ratchet linter code gets the same adversary review and deletion tests as probes ([proof.md](proof.md)). A linter that never fires is as suspect as a test that never fails.
