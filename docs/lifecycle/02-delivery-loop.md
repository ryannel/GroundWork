# 02. The Delivery Loop

After the first bet ships, the project enters the Delivery Loop — an indefinite cycle of bets that delivers all subsequent feature work. Each bet runs the same five-phase workflow.

The `groundwork-bet` skill orchestrates the loop. It activates either by detecting a pitch at `status: design` (the case for the first bet handed off from MVP Planning) or by being invoked directly for a new feature (in which case it starts at Discovery).

## The Five Phases

| Phase | Goal | Workflow file |
|---|---|---|
| 1. Discovery | Shape the problem into a fat-marker pitch — problem, appetite, solution sketch, success signal, and explicit no-gos. | `workflows/01-discovery.md` |
| 2. Design Foundations | Produce the technical design — Surface Design first (one subsection per in-scope surface, in its interface type's vocabulary), then the surface-neutral Capability Design: data flows, API contracts, data schema — as prose that carries the shapes (request/response fields, schemas, error codes) at design fidelity. No implementation code, no separate spec files. | `workflows/02-design.md` |
| 3. Decomposition | With design locked, break the bet into milestones — a capability milestone proving the core's contract headless first, then surface milestones per in-scope surface — and slices (vertical capability units), written as a browsable prose tree where every milestone and slice carries a plain-language *proof of work*. The user reviews the decomposition and approves it; the approved-prose commit is tagged `bet/<slug>/approved` — the integrity baseline. | `workflows/03-decomposition.md` |
| 4. Delivery | Materialize the bet-progress suite red from the approved prose, then turn it green slice by slice — the suite is the board, git the record. Per slice: a tamper-check that the approved prose is unchanged since `bet/<slug>/approved`, an honest-green check, then a three-lens review; permanent best-practice tests roll out as each slice completes. | `workflows/04-delivery.md` |
| 5. Validation | Verify the implementation, capture each touched service's running contract into the canonical per-service record at `docs/architecture/api/<service>/`, write the capability ledger rows (every surface column decided), archive the whole bet (docs and tests), run the bet retrospective, fold learnings back into upstream docs, seed the next bet. | `workflows/05-validation.md` |

Each phase updates the pitch's `status` frontmatter as it activates (`discovery` → `design` → `decomposition` → `delivery` → `validation` → `delivered`), so the orchestrator and any contributor can see where the bet sits at any moment.

## Three lanes: patch, quick bet, bet

Not every change earns five phases. The Delivery Loop offers three lanes, sized by the work, and the orchestrator's Work Intake triage routes each request to the right one:

| Lane | For | Shape |
|---|---|---|
| **patch** (`groundwork-patch`) | A fix, a copy tweak, a small change with no new capability and no contract change | No phases — read, test (with an honest-green check and a blind review for behaviour-shaped patches), log to the patch ledger |
| **quick bet** (`workflows/00-quick.md`) | One small new capability — a single user-visible step, deliverable in one sitting, touching at most a local, non-structural contract delta | A compressed track: Discovery, Design, and Decomposition collapse into one AI-driven, single-approval pass that produces **one milestone**, earns an independent review verdict, then runs the same Delivery (Phase 4) and Validation (Phase 5) tail — scoped to quick depth |
| **bet** (the five phases above) | A substantial feature: a ladder of user-visible milestones, or a structural / cross-service contract change | The full lifecycle |

The quick bet is the middle depth, not a slimmer patch: it still touches every dimension a bet does (what and why, UX, the contract delta, the front-door proof) and still proves its milestone at the front door — it just holds them in one pass instead of five gated phases. Its pitch carries `track: quick`; that marker is how Delivery and Validation know to run at quick depth (one milestone is legal, and the heaviest closure and retrospective steps scope down) while keeping the deterministic floor, the visual UX check, and honest green intact. A quick bet that proves bigger than one sitting escalates to a full bet; one that needs no design at all demotes to a patch.

## The Two Test Populations

The bet lifecycle produces two distinct populations of tests. Understanding both prevents the mistake of conflating or merging them.

| Population | What it is | Where it lives | When written | Lifecycle |
|---|---|---|---|---|
| **Bet-progress tests** | Macro proof-of-work. Consumer-visible, big-ticket — at the contract for capability milestones, in the surface's medium for surface milestones. Red = work to do; green = proven. | `tests/bets/<slug>/` | Materialized red at Delivery start, from the approved prose | Temporary — archived to `tests/bets/_archive/<slug>/` at delivery |
| **Permanent best-practice tests** | Thorough, lasting coverage: interface tests, HTTP API system tests, honeycomb service-perimeter tests, unit tests for complex logic. | Service repos / `tests/system/` | During Delivery, rolled out as each slice completes | Permanent — stays in the codebase forever |

## Phase 1: Discovery

Discovery establishes the boundary of the bet in terms of user value. The agent reads the upstream `docs/` artifacts (Product Brief, Architecture, Design System, and the surface registry at `docs/surfaces.md` when it exists) to ground the conversation in the existing system, checks the `## Bets` section of discovery notes for sequencing instincts captured earlier, then collaborates with the user on:

- The core user problem
- The proposed solution at a high level (not technical)
- The appetite — how long the work is worth
- The success signal — what observable outcome confirms the bet delivered value
- The surface scope — which registry surfaces this bet delivers to (recorded as `surfaces:` in the pitch frontmatter), with surface no-gos for the ones it deliberately will not reach
- Rabbit holes and no-gos — explicit exclusions, especially natural extensions users would expect

The committed `pitch.md` carries `status: discovery` until the user approves Design Foundations.

## Phase 2: Design Foundations

⚠️ Implementation code is forbidden during this phase.

Design Foundations translates the pitch into the technical contract the bet executes against. The agent leads with what the user sees — the surface designs — before moving to the underlying flows and contracts. Sections, in order:

1. **Surface Design** — one subsection per surface in the pitch's `surfaces:` scope, each in its interface type's vocabulary from `docs/design-system.md`: screens and states for `graphical-ui`, commands and output for `cli`, request/response turns for `agentic-protocol`. For each: purpose, states (loading, active, empty, error, degraded), key interactions. Each subsection anchors that surface's milestone tests. A project without a registry writes one subsection for its single implicit surface — today's document with the headings one level deeper.
2. **Capability Design** — surface-neutral and headless, in three parts: **Data Flows** (how data moves through services to produce each surface state), **API Contracts** (purpose, error guidance, and design rationale per boundary, with the shapes carried inline in the prose at design fidelity — checked for neutrality: the contract serves every in-scope surface and presumes none; with one surface in scope, the latent agentic surface stands in as the second consumer), and **Data Schema** (tables/collections/stores this bet introduces or changes, key fields, state machines for entities with lifecycle states).

The shapes are carried inline in the design prose — request/response fields, schemas, error codes — in the vocabulary the core's deployment dictates (HTTP request/response, event payloads, table columns, a typed module API for an embedded core). There is no separate spec directory: the prose is the design-time contract Decomposition reasons about and Delivery builds against, and the real machine-readable contract is generated from the running code and captured at Validation.

The output is the `technical-design/` prose, passing an independent review. The bet may not enter Decomposition until the design is locked.

## Phase 3: Decomposition

⚠️ Implementation code is forbidden during this phase.

Decomposition is agent-led, then user-reviewed. With the design locked, the agent proposes the breakdown; the user reviews sequencing and the bet-progress tests.

The agent decomposes the bet into **milestones** — demonstrable product states, ordered by integration value — typed by what they prove:

- A **capability milestone** proves core behaviour headless: a contract exercised end-to-end against the running services (or the embedded core's API), curl-able and scriptable, with no surface in the loop. A bet introducing new capability opens with one, and may legitimately end there with every surface milestone deferred — a headless delivery the ledger records.
- A **surface milestone** proves a named surface delivers the capability to its users, asserted in that surface's medium and bounded to wiring, rendering, and interaction. Surface tests never re-prove business rules already proven at the contract — that prove-once principle is what keeps surface count from multiplying the test pyramid.

For each milestone the agent writes a plain-language **proof of work** — what it proves and how a test will demonstrate it: contract-level for capability milestones, per-medium for surface milestones, resolved through the `surfaces` fixture. The tests themselves are materialized red at Delivery start, from this approved prose. When a surface test is later red, the capability milestone's green contract tests localise the failure to that surface's adapter layer. A project with no registry keeps the familiar two layers — an interface-level proof in its single medium plus an API-level system test.

Each milestone is then broken into **vertical slices** — the smallest independently buildable and deployable units. A slice crosses services or sits within one, but must be verifiable without any future slice existing. Each slice has bet-progress tests bounded by its parent milestone's tests.

Every shape a proof asserts derives from the design prose — a hand-rolled shape the design does not define is a review-blocking finding.

The output is the browsable prose **decomposition tree** at `docs/bets/<slug>/decomposition/` — `meta.json` for sidebar order, a milestone `index.md` per milestone, and a file per slice, each carrying a **Proof of work** section (what it proves, in plain language, with its chain of justification). There is no machine-readable mirror and no separate test-review surface — the proof-of-work prose is the proof. At Proof of Work the user walks the tree milestone by milestone and approves it; the agent commits the approved prose and tags that commit `git tag bet/<slug>/approved` — the tag is the signature and the integrity baseline. The bet may not enter Delivery until the decomposition gate passes and the prose is approved and tagged.

## Phase 4: Delivery

⚠️ Delivery is constrained to writing only the code required to turn bet-progress tests green within the established contracts.

The approved **prose** is the fixed definition of done. Tests and contracts are built during Delivery — the test files at `tests/bets/<slug>/` fill in red→green and the service code and its generated contract are free to change. What is frozen is the prose: each slice's review runs a tamper-check — `git diff bet/<slug>/approved.. -- docs/bets/<slug>/decomposition/` shows no change to the approved proof-of-work prose outside an approved amendment, and each materialized test still honestly proves what its slice's Proof-of-work section describes. A proof that needs to change mid-delivery routes through the **Amendment Protocol** — stop, state the case, edit the slice's prose only with the user's approval, re-commit (re-tagging or recording the amended commit), then change the code.

Core slices merge before the surface slices that consume them, and a surface slice's context capsule includes the capability milestone's test file — the contract proof it builds on. Each slice runs the same loop: assemble a context capsule (previous slice's record, every file the slice modifies read in full, recent conventions), record the baseline commit, implement to green inside the prose design, pass a three-lens review (blind reviewer, edge-case tracer, coverage auditor — each returning a parseable verdict with its full findings written to a file) with findings triaged into decision-needed / patch / defer / dismiss and closed through a findings ledger (a per-milestone honesty audit re-derives front-door truth at close), roll out the slice's permanent best-practice tests, then commit the slice — the git history is the record. `./dev bet status` renders the milestone/slice board by running the suite (red/green per milestone and slice) at any point.

Discovering a fundamental design flaw during delivery routes through **Change Navigation** — a written change proposal with before/after edits and severity, approved by the user; minor corrections amend the affected tests through the Amendment Protocol, structural ones revert the bet to Design Foundations — not improvisation around the flaw.

## Phase 5: Validation

Validation is the back-feed mechanism that keeps upstream docs aligned with the system as it actually is. A bet that ships without updating upstream docs leaves the next bet operating against a stale map.

The phase runs nine steps:

1. Update pitch status to `validation`.
2. Run the full bet-progress test suite, and the prose-integrity reconciliation once over the whole bet (the approved proof-of-work prose is unchanged since `bet/<slug>/approved` except for approved amendments, and every approved proof is honestly met in code). Verify contract integrity (no rogue HTTP calls, no shapes the design does not define), then **capture the canonical contracts** — snapshot each touched service's served contract (e.g. its `/openapi.json`) into the canonical per-service record at `docs/architecture/api/<service>/openapi.yaml` — and **write the capability ledger rows**: for each capability the bet delivered, every surface column in `docs/surfaces.md` is decided (`delivered`, `planned`, `omitted`, or `n/a`), the JSON twin updated in the same change, and `planned` deferrals cross-posted to discovery notes. A bet cannot close with an empty ledger cell.
3. **Archive the bet** — move `docs/bets/<slug>/` → `docs/bets/_archive/<slug>/` and `tests/bets/<slug>/` → `tests/bets/_archive/<slug>/`. The permanent best-practice tests remain in place; they are the ongoing coverage going forward.
4. Review the delivery with the user.
5. **Apply the Living Documents protocol** — scan and surgically update `docs/architecture/index.md`, `docs/design-system.md`, `docs/product-brief.md`, `docs/architecture/infrastructure.md`, `docs/surfaces.md`, and `docs/maturity.md` against what the bet delivered. Report each change.
6. **Update discovery notes** — append new `## Bets` entries for signals about future work; remove entries consumed during this bet.
7. Write ADRs for significant technical decisions.
8. **Run the bet retrospective** — mine the slice records for repeating patterns, audit the previous bet's action items (ignored-and-costly ones escalate to the maturity roadmap), detect discoveries that invalidate queued bets, and confirm where the delivered work actually stands. Action items get stable IDs and land in discovery notes for the next bet.
9. Mark the pitch `status: delivered` and recommend a fresh context for the next bet. The rich delivery context has been compressed into doc updates, the retrospective, and discovery notes.

The Validation workflow file includes a Quality Standard section showing concrete examples of shallow vs. deep handoff output — the standard is that every doc updated must be named, the change quoted, and the reasoning attached.

## Bet Workflow CLI

Generated workspaces include a `./dev` CLI that surfaces the bet workflow as first-class commands. The `workspace-cli` skill (installed into `.agents/skills/`) documents the full surface for the agent operating inside the project.

| Command | When to use |
|---|---|
| `./dev new bet <slug>` | Phase 3 start — create `docs/bets/<slug>/` and `tests/bets/<slug>/` |
| `./dev new milestone <bet> <milestone>` | Phase 4 start — materialize a red milestone test stub (`test_milestone_<N>_<slug>.py`) from the approved prose |
| `./dev new slice <bet> <milestone> <service> <slice>` | Phase 4 start — materialize a red slice test stub (`test_slice_<N>_<service>_<slug>.py`) from the approved prose |
| `./dev bet status [<slug>]` | Anytime — render the milestone/slice board by running the bet suite (red/green, derived) |
| `./dev surface status` | Anytime — render the surface registry and capability ledger from `.groundwork/surfaces.json`, with `planned`-cell counts per surface |
| `./dev test bet <slug>` | Phase 4 — fast inner loop against the running stack; runs the bet-progress suite |
| `./dev test bet <slug> --integration` | Phase 4 / CI — boot stack, run suite, tear down (Docker required) |
| `./dev archive bet <slug>` | Phase 5 — `git mv` the bet's `docs/bets/<slug>/` and `tests/bets/<slug>/` into `_archive/` |

The CLI writes the same file paths and naming convention the `groundwork-bet` skill uses when it writes test files directly. Both routes produce byte-identical paths — the CLI is the Golden Path shortcut, not a different convention.

## Why each bet stands alone

After the first bet, every subsequent bet runs in a fresh context. The bet skills do not carry conversational memory from earlier bets — they read only the current state of `docs/*.md` and `.groundwork/cache/discovery-notes.md`. This is deliberate: any context worth preserving has been promoted into a living document or parked in discovery notes by the previous bet's Validation step.

The exception is the first bet, which inherits the MVP planning context in the same session. See `01-setup.md` for the MVP→Bet handoff rationale.
