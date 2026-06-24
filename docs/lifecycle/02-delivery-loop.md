# 02. The Delivery Loop

After the first bet ships, the project enters the Delivery Loop — an indefinite cycle of bets that delivers all subsequent feature work. Each bet runs the same five-phase workflow.

The `groundwork-bet` skill orchestrates the loop. It activates either by detecting a pitch at `status: design` (the case for the first bet handed off from MVP Planning) or by being invoked directly for a new feature (in which case it starts at Discovery).

## The Five Phases

| Phase | Goal | Workflow file |
|---|---|---|
| 1. Discovery | Shape the problem into a fat-marker pitch — problem, appetite, solution sketch, success signal, and explicit no-gos. | `workflows/01-discovery.md` |
| 2. Design Foundations | Produce the technical design contract — Surface Design first (one subsection per in-scope surface, in its interface type's vocabulary), then the surface-neutral Capability Design: data flows, API contracts, data schema — plus machine-readable spec files at `contracts/`. No implementation code. | `workflows/02-design.md` |
| 3. Decomposition | With design locked, break the bet into milestones — a capability milestone proving the core's contract headless first, then surface milestones per in-scope surface — and slices (vertical capability units). Author the bet-progress tests up front — written red, shapes derived from the specs. The user reviews the suite assertion by assertion and approves it; the approved suite is committed (the *approval commit* is its signature). | `workflows/03-decomposition.md` |
| 4. Delivery | Turn the approved bet-progress tests green, slice by slice, recording each slice's outcome in the bet manifest. Per slice: a test-integrity reconciliation against the approved record, then a three-lens review; permanent best-practice tests roll out as each slice completes. | `workflows/04-delivery.md` |
| 5. Validation | Verify the implementation, promote the contract specs to the canonical per-service record, write the capability ledger rows (every surface column decided), archive the bet-progress suite, run the bet retrospective, fold learnings back into upstream docs, seed the next bet. | `workflows/05-validation.md` |

Each phase updates the pitch's `status` frontmatter as it activates (`discovery` → `design` → `decomposition` → `delivery` → `validation` → `delivered`), so the orchestrator and any contributor can see where the bet sits at any moment.

## The Two Test Populations

The bet lifecycle produces two distinct populations of tests. Understanding both prevents the mistake of conflating or merging them.

| Population | What it is | Where it lives | When written | Lifecycle |
|---|---|---|---|---|
| **Bet-progress tests** | Macro proof-of-work. Consumer-visible, big-ticket — at the contract for capability milestones, in the surface's medium for surface milestones. Red = work to do; green = proven. | `tests/bets/<slug>/` | Up front during Decomposition, before implementation | Temporary — archived to `tests/bets/_archive/<slug>/` at delivery |
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
2. **Capability Design** — surface-neutral and headless, in three parts: **Data Flows** (how data moves through services to produce each surface state), **API Contracts** (purpose, error guidance, and design rationale per boundary, with the shapes in machine-readable specs — checked for neutrality: the contract serves every in-scope surface and presumes none; with one surface in scope, the latent agentic surface stands in as the second consumer), and **Data Schema** (tables/collections/stores this bet introduces or changes, key fields, state machines for entities with lifecycle states).

The shapes live in spec files at `docs/bets/<slug>/contracts/`, in the format the core's deployment dictates — `openapi.yaml` for hosted HTTP boundaries, `asyncapi.yaml` for events and websockets, `schema.sql` for persistent-state changes, a typed public module API for an embedded core. Specs are written at design time so Decomposition writes tests against the same artifact Delivery implements against; the prose carries what the spec format cannot.

The output is a `technical-design.md` plus its spec files, passing an independent review. The bet may not enter Decomposition until the design is locked.

## Phase 3: Decomposition

⚠️ Implementation code is forbidden during this phase.

Decomposition is agent-led, then user-reviewed. With the design locked, the agent proposes the breakdown; the user reviews sequencing and the bet-progress tests.

The agent decomposes the bet into **milestones** — demonstrable product states, ordered by integration value — typed by what they prove:

- A **capability milestone** proves core behaviour headless: a contract exercised end-to-end against the running services (or the embedded core's API), curl-able and scriptable, with no surface in the loop. A bet introducing new capability opens with one, and may legitimately end there with every surface milestone deferred — a headless delivery the ledger records.
- A **surface milestone** proves a named surface delivers the capability to its users, asserted in that surface's medium and bounded to wiring, rendering, and interaction. Surface tests never re-prove business rules already proven at the contract — that prove-once principle is what keeps surface count from multiplying the test pyramid.

For each milestone the agent authors bet-progress tests (written red, up front): contract-level tests for capability milestones, and per-medium tests for surface milestones, resolved through the `surfaces` fixture. When a surface test is red, the capability milestone's green contract tests localise the failure to that surface's adapter layer. A project with no registry keeps the familiar two layers — an interface-level test in its single medium plus an API-level system test.

Each milestone is then broken into **vertical slices** — the smallest independently buildable and deployable units. A slice crosses services or sits within one, but must be verifiable without any future slice existing. Each slice has bet-progress tests bounded by its parent milestone's tests.

Every shape a test asserts derives from the design's spec files — a hand-rolled shape the spec does not define is a review-blocking finding.

The outputs are `decomposition.md` (milestone map + slice specs), a machine-readable mirror at `.groundwork/bets/<slug>/decomposition.json` (the manifest delivery tracking updates), `test-review.md` (each test's proof in plain language with its chain of justification), and the red suite at `tests/bets/<slug>/`. At Proof of Work the user walks the test-review surface test by test and approves the suite; the agent then commits the tests together with `test-review.md` and records that commit's SHA as `approval_commit` in `decomposition.json` — the commit is the signature and the baseline. The bet may not enter Delivery until the decomposition gate passes and the suite is approved and committed.

## Phase 4: Delivery

⚠️ Delivery is constrained to writing only the code required to turn bet-progress tests green within the established contracts.

The approved suite is the fixed definition of done: the implementing agent never edits `tests/bets/<slug>/`, and each slice's review runs a test-integrity reconciliation — git history since `approval_commit` shows no test change outside an approved amendment, and each test still proves what its `test-review.md` entry describes. A test that looks wrong mid-delivery routes through the **Amendment Protocol** — stop, state the case, and change the test only with the user's approval, rewriting the `test-review.md` entry and committing the pair.

Core slices merge before the surface slices that consume them, and a surface slice's context capsule includes the capability milestone's test file — the contract proof it builds on. Each slice runs the same loop: assemble a context capsule (previous slice's record, every file the slice modifies read in full, recent conventions), record the baseline commit, implement to green inside the contracts, pass a three-lens review (blind reviewer, edge-case tracer, acceptance auditor against the specs) with findings triaged into decision-needed / patch / defer / dismiss, roll out the slice's permanent best-practice tests, then record the outcome — files, commits, notes — in the bet manifest. `./dev bet status` renders the milestone/slice board from that manifest at any point.

Discovering a fundamental design flaw during delivery routes through **Change Navigation** — a written change proposal with before/after edits and severity, approved by the user; minor corrections amend the affected tests through the Amendment Protocol, structural ones revert the bet to Design Foundations — not improvisation around the flaw.

## Phase 5: Validation

Validation is the back-feed mechanism that keeps upstream docs aligned with the system as it actually is. A bet that ships without updating upstream docs leaves the next bet operating against a stale map.

The phase runs nine steps:

1. Update pitch status to `validation`.
2. Run the full bet-progress test suite, and the test-integrity reconciliation once over the whole bet (every approved assertion still present in code; the only test-file changes since `approval_commit` are approved amendments). Verify contract integrity (no rogue HTTP calls, no shapes the specs do not define), then **promote the contract specs** — merge the bet's `contracts/` into the canonical per-service record at `docs/architecture/api/<service>/` — and **write the capability ledger rows**: for each capability the bet delivered, every surface column in `docs/surfaces.md` is decided (`delivered`, `planned`, `omitted`, or `n/a`), the JSON twin updated in the same change, and `planned` deferrals cross-posted to discovery notes. A bet cannot close with an empty ledger cell.
3. **Archive the bet-progress suite** — move `tests/bets/<slug>/` → `tests/bets/_archive/<slug>/`. The permanent tests remain in place; they are the ongoing coverage going forward.
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
| `./dev new milestone <bet> <milestone>` | Phase 3 — scaffold a red milestone test stub (`test_milestone_<N>_<slug>.py`) |
| `./dev new slice <bet> <milestone> <service> <slice>` | Phase 3 — scaffold a red slice test stub (`test_slice_<N>_<service>_<slug>.py`) |
| `./dev bet status [<slug>]` | Anytime — render the milestone/slice board from the bet manifest |
| `./dev surface status` | Anytime — render the surface registry and capability ledger from `.groundwork/surfaces.json`, with `planned`-cell counts per surface |
| `./dev test bet <slug>` | Phase 4 — fast inner loop against the running stack; runs the bet-progress suite |
| `./dev test bet <slug> --integration` | Phase 4 / CI — boot stack, run suite, tear down (Docker required) |
| `./dev archive bet <slug>` | Phase 5 — `git mv tests/bets/<slug>/ tests/bets/_archive/<slug>/` |

The CLI writes the same file paths and naming convention the `groundwork-bet` skill uses when it writes test files directly. Both routes produce byte-identical paths — the CLI is the Golden Path shortcut, not a different convention.

## Why each bet stands alone

After the first bet, every subsequent bet runs in a fresh context. The bet skills do not carry conversational memory from earlier bets — they read only the current state of `docs/*.md` and `.groundwork/cache/discovery-notes.md`. This is deliberate: any context worth preserving has been promoted into a living document or parked in discovery notes by the previous bet's Validation step.

The exception is the first bet, which inherits the MVP planning context in the same session. See `01-setup.md` for the MVP→Bet handoff rationale.
