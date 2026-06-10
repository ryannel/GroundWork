# 02. The Delivery Loop

After the first bet ships, the project enters the Delivery Loop — an indefinite cycle of bets that delivers all subsequent feature work. Each bet runs the same five-phase workflow.

The `groundwork-bet` skill orchestrates the loop. It activates either by detecting a pitch at `status: design` (the case for the first bet handed off from MVP Planning) or by being invoked directly for a new feature (in which case it starts at Discovery).

## The Five Phases

| Phase | Goal | Workflow file |
|---|---|---|
| 1. Discovery | Shape the problem into a fat-marker pitch — problem, appetite, solution sketch, success signal, and explicit no-gos. | `workflows/01-discovery.md` |
| 2. Design Foundations | Produce the technical design contract — interface design first, then data flows, API contracts, data schema — plus machine-readable spec files at `contracts/` (OpenAPI, AsyncAPI, schema DDL). No implementation code. | `workflows/02-design.md` |
| 3. Decomposition | With design locked, break the bet into milestones (user-visible states ordered by integration value) and slices (vertical capability units). Author the bet-progress tests up front — written red, shapes derived from the specs. The user reviews the suite assertion by assertion and signs it; the signed manifest seals it. | `workflows/03-decomposition.md` |
| 4. Delivery | Turn the sealed bet-progress tests green, slice by slice, recording each slice's outcome in the bet manifest. Three-lens review per slice; permanent best-practice tests roll out as each slice completes. | `workflows/04-delivery.md` |
| 5. Validation | Verify the implementation, promote the contract specs to the canonical per-service record, archive the bet-progress suite, run the bet retrospective, fold learnings back into upstream docs, seed the next bet. | `workflows/05-validation.md` |

Each phase updates the pitch's `status` frontmatter as it activates (`discovery` → `design` → `decomposition` → `delivery` → `validation` → `delivered`), so the orchestrator and any contributor can see where the bet sits at any moment.

## The Two Test Populations

The bet lifecycle produces two distinct populations of tests. Understanding both prevents the mistake of conflating or merging them.

| Population | What it is | Where it lives | When written | Lifecycle |
|---|---|---|---|---|
| **Bet-progress tests** | Macro proof-of-work. User-visible, big-ticket. Red = work to do; green = proven. | `tests/bets/<slug>/` | Up front during Decomposition, before implementation | Temporary — archived to `tests/bets/_archive/<slug>/` at delivery |
| **Permanent best-practice tests** | Thorough, lasting coverage: interface tests, HTTP API system tests, honeycomb service-perimeter tests, unit tests for complex logic. | Service repos / `tests/system/` | During Delivery, rolled out as each slice completes | Permanent — stays in the codebase forever |

## Phase 1: Discovery

Discovery establishes the boundary of the bet in terms of user value. The agent reads the upstream `docs/` artifacts (Product Brief, Architecture, Design System) to ground the conversation in the existing system, checks the `## Bets` section of discovery notes for sequencing instincts captured earlier, then collaborates with the user on:

- The core user problem
- The proposed solution at a high level (not technical)
- The appetite — how long the work is worth
- The success signal — what observable outcome confirms the bet delivered value
- Rabbit holes and no-gos — explicit exclusions, especially natural extensions users would expect

The committed `pitch.md` carries `status: discovery` until the user approves Design Foundations.

## Phase 2: Design Foundations

⚠️ Implementation code is forbidden during this phase.

Design Foundations translates the pitch into the technical contract the bet executes against. The agent leads with what the user sees — the interface design — before moving to the underlying flows and contracts. Sections, in order:

1. **Interface Design** — organised by screen/view/command/interaction, not by feature. For each: layout/regions, states (loading, active, empty, error, degraded), key interactions. The interface-test medium is chosen from `docs/design-system.md`'s interface track.
2. **Data Flows** — how data moves through services to produce each interface state.
3. **API Contracts** — purpose, error guidance, and design rationale per boundary, with the shapes themselves in machine-readable specs.
4. **Data Schema** — tables/collections/stores this bet introduces or changes, key fields, state machines for entities with lifecycle states.

The shapes live in spec files at `docs/bets/<slug>/contracts/` — `openapi.yaml` for HTTP boundaries, `asyncapi.yaml` for events and websockets, `schema.sql` for persistent-state changes. Specs are written at design time so Decomposition writes tests against the same artifact Delivery implements against; the prose carries what the spec format cannot.

The output is a `technical-design.md` plus its spec files, passing an independent review. The bet may not enter Decomposition until the design is locked.

## Phase 3: Decomposition

⚠️ Implementation code is forbidden during this phase.

Decomposition is agent-led, then user-reviewed. With the design locked, the agent proposes the breakdown; the user reviews sequencing and the bet-progress tests.

The agent decomposes the bet into **milestones** — demonstrable product states, ordered by integration value. The first milestone is the simplest end-to-end flow that proves the architecture works; later milestones add richness. Each milestone is independently shippable.

For each milestone, the agent authors two layers of bet-progress tests (written red, up front):
- **Interface-level** — asserts the user-visible outcome in the project's interface medium.
- **API-level system** — end-to-end HTTP against running services. When the interface test is red, the API test localises whether the failure is frontend or backend.

Each milestone is then broken into **vertical slices** — the smallest independently buildable and deployable units. A slice crosses services or sits within one, but must be verifiable without any future slice existing. Each slice has bet-progress tests bounded by its parent milestone's tests.

Every shape a test asserts derives from the design's spec files — a hand-rolled shape the spec does not define is a review-blocking finding.

The outputs are `decomposition.md` (milestone map + slice specs), a machine-readable mirror at `.groundwork/bets/<slug>/decomposition.json` (the manifest delivery tracking updates), `test-review.md` (every test's verbatim assertions with their chain of justification), and the red suite at `tests/bets/<slug>/`. At Proof of Work the user walks the test-review surface assertion by assertion and signs the suite — `./dev bet sign` writes a hash manifest that seals it. The bet may not enter Delivery until the decomposition gate passes and the suite is sealed.

## Phase 4: Delivery

⚠️ Delivery is constrained to writing only the code required to turn bet-progress tests green within the established contracts.

The sealed suite is the fixed definition of done: the implementing agent never edits `tests/bets/<slug>/`, and `./dev test bet` refuses a suite that drifted from its signed manifest. A test that looks wrong mid-delivery routes through the **Amendment Protocol** — stop, state the case, and change the test only with the user's approval and a re-seal.

Each slice runs the same loop: assemble a context capsule (previous slice's record, every file the slice modifies read in full, recent conventions), record the baseline commit, implement to green inside the contracts, pass a three-lens review (blind reviewer, edge-case tracer, acceptance auditor against the specs) with findings triaged into decision-needed / patch / defer / dismiss, roll out the slice's permanent best-practice tests, then record the outcome — files, commits, notes — in the bet manifest. `./dev bet status` renders the milestone/slice board from that manifest at any point.

Discovering a fundamental design flaw during delivery routes through **Change Navigation** — a written change proposal with before/after edits and severity, approved by the user; minor corrections amend and re-seal, structural ones revert the bet to Design Foundations — not improvisation around the flaw.

## Phase 5: Validation

Validation is the back-feed mechanism that keeps upstream docs aligned with the system as it actually is. A bet that ships without updating upstream docs leaves the next bet operating against a stale map.

The phase runs nine steps:

1. Update pitch status to `validation`.
2. Run the full bet-progress test suite with manifest verification. Verify contract integrity (no rogue HTTP calls, no shapes the specs do not define), then **promote the contract specs** — merge the bet's `contracts/` into the canonical per-service record at `docs/api/<service>/`.
3. **Archive the bet-progress suite** — move `tests/bets/<slug>/` → `tests/bets/_archive/<slug>/`. The permanent tests remain in place; they are the ongoing coverage going forward.
4. Review the delivery with the user.
5. **Apply the Living Documents protocol** — scan and surgically update `docs/architecture.md`, `docs/design-system.md`, `docs/product-brief.md`, `docs/infrastructure.md`, and `docs/maturity.md` against what the bet delivered. Report each change.
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
| `./dev bet sign <slug>` | Phase 3 close — seal the approved suite with a hash manifest |
| `./dev bet status [<slug>]` | Anytime — render the milestone/slice board from the bet manifest |
| `./dev test bet <slug>` | Phase 4 — fast inner loop against the running stack; verifies the seal first |
| `./dev test bet <slug> --integration` | Phase 4 / CI — boot stack, run suite, tear down (Docker required) |
| `./dev archive bet <slug>` | Phase 5 — `git mv tests/bets/<slug>/ tests/bets/_archive/<slug>/` |

The CLI writes the same file paths and naming convention the `groundwork-bet` skill uses when it writes test files directly. Both routes produce byte-identical paths — the CLI is the Golden Path shortcut, not a different convention.

## Why each bet stands alone

After the first bet, every subsequent bet runs in a fresh context. The bet skills do not carry conversational memory from earlier bets — they read only the current state of `docs/*.md` and `.groundwork/cache/discovery-notes.md`. This is deliberate: any context worth preserving has been promoted into a living document or parked in discovery notes by the previous bet's Validation step.

The exception is the first bet, which inherits the MVP planning context in the same session. See `01-setup.md` for the MVP→Bet handoff rationale.
