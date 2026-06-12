# The Capability Core and Its Surfaces

GroundWork models every product as one **capability core** plus zero or more **surfaces**. The split is not backend vs frontend — a self-contained CLI and an MCP server front nothing, and "frontend" smuggles the hosted-web shape into products that never had one.

- The **capability core** is the product's domain logic, data, and contracts. Every product has one, including a self-contained CLI — its command layer calls an internal core the same way a web app calls an API. The core is always designed, assessed, and validated **headless**, against its contracts, with no surface in the loop.
- A **surface** is a deployed artifact a consumer interacts with: a web app, a mobile app, a CLI binary, an MCP server. Surfaces are adapters over the core. A product has zero or more of them — zero is legal, because a headless API product's only surface *is* its protocol.
- Whether the core is **hosted** (services over a network) or **embedded** (a library in-process with its single surface) is an architecture-phase deployment decision, not a methodology branch. Nothing downstream branches on it except the contract spec format and the transport capability tests run against.

Two artifacts carry the model through the lifecycle: the **surface registry** (`docs/surfaces.md`) names each surface — type, platform, status, core-access path, scaffold target, test medium — and the **capability ledger** inside it records, capability by capability, which surfaces have it, will get it, or deliberately never will. Both have a machine-readable twin at `.groundwork/surfaces.json`.

## Type vs instance

The interface taxonomy (`graphical-ui`, `cli`, `agentic-protocol`) is the **type** axis: types own design tracks, test medium families, and vocabulary. A **surface** is an instance of a type: `web-app` and `ios-app` are both `graphical-ui`, but they deploy separately, test separately, and diverge separately. Design tracks run once per type in use; scaffolding, testing, and parity tracking run per surface.

## The five product shapes are one model

| Shape | Core deployment | Registry contents |
|---|---|---|
| Self-contained CLI | embedded | one `cli` surface |
| Self-contained desktop/mobile app | embedded | one `graphical-ui` surface |
| Single-frontend web app | hosted | one `graphical-ui` surface |
| Multi-frontend service fleet | hosted | several surfaces, mixed types |
| Headless API | hosted | zero surfaces, or the protocol registered as an `agentic-protocol` surface |

The phases never fork on shape. A product brief enumerates surfaces; the design system runs a track per type in use; architecture writes the registry and settles the core's deployment; scaffold generates one app per surface; the bet loop types its milestones as capability or surface. A single-surface product experiences zero added ceremony — every phase degrades to its familiar behaviour when the registry holds one surface.

## Prove logic once, headless; prove wiring per surface

Capability behaviour is validated against the core's contract exactly once, in **capability milestones** whose demonstrable state is a contract exercised end-to-end — curl-able, scriptable, observable, no surface running. **Surface milestones** then prove each surface delivers the capability to its users — asserted in that surface's medium, bounded to wiring, rendering, and interaction. A surface test that re-asserts a business rule already proven at the contract is a review finding.

This principle is what makes multiple surfaces affordable. Without it, N surfaces multiply the entire test pyramid; with it, surface count scales only the thin adapter layer.

## Parity is tracked, not presumed — and divergence is a decision, not a gap

The capability ledger records, for every capability × surface cell, one of four states: `delivered`, `planned`, `omitted` (a deliberate product choice, with rationale), or `n/a` (structurally meaningless on that surface). An empty cell is the only illegal state — bet validation fills every column or the bet does not close.

The ledger never nags toward 100% parity. Admin tooling belongs on web only; offline mode belongs on mobile only. A parity tracker that shames every gap gets ignored; one that records decisions gets maintained. The ledger tracks capability parity, never pixel parity — cross-surface visual consistency is the design system's foundation layer, not a ledger concern.

## Every product has a latent agentic surface

A headless core with promoted contracts means an API or MCP surface costs almost nothing to expose — the capability milestone that proves the core headless is, in embryo, that surface's proof. When a bet has only one surface in scope, the latent agentic surface stands in as the contract's second consumer: would a programmatic caller find this contract complete? As agents become first-class product consumers, the headless discipline stops being a validation tactic and becomes a product capability.

## Surface birth is a lifecycle event

Adding a surface to a live product — the mobile app eighteen months in — is the moment silent divergence is born. `groundwork-surface-activation` owns that moment: register the surface, run its type's design track if missing, scaffold (or record `scaffold: manual`), and **triage the ledger** — walk every existing capability row and fill the new surface's column as `planned`, `omitted`, or `n/a`. The triage is the sync decision made once, recorded, and inherited by every future bet.
