# Phase 2: Design Foundations (UI Design, Data Flows, API Design, Schema & Data Design)

**Goal:** Produce the design contract this bet executes against — before any decomposition begins. The contract anchors everything downstream: milestone front-door tests assert against the UI Design subsections; slice capabilities trace to the API Design and Schema & Data Design; the review loop verifies the chain is intact. Design that locks the contract before the UI is settled produces a contract shaped by guesswork about the experiences it must serve.

## Restrictions
⚠️ **CRITICAL CONSTRAINT:** You are FORBIDDEN from writing implementation code during this phase. You may only write design documentation, interface specifications, API contracts, and schemas.

## Operating Contract

This workflow operates under the protocols defined in `.groundwork/skills/operating-contract.md` (contract v1; Continuous Bet mode: Protocols 1, 2, 4, 8, and 9 apply). Read it before taking any other action.

## Discovery Notes Check

Check if `.groundwork/cache/discovery-notes.md` exists and has entries under `## Design Details`.

If entries exist, treat them as pre-discovered context — implementation decisions parked during the architecture phase that this design step is responsible for translating into contracts and schemas. Carry them into the relevant sections. After incorporating a `## Design Details` entry, remove it from the notes file so it is not re-applied to a future bet.

If the file does not exist or has no `## Design Details` entries, skip this step.

## Step 1: Update pitch status

Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: design`.

## Step 1.5: Reconcile domain entities

Read `docs/architecture/domain/` if it exists. Identify whether this bet introduces any new domain entities or adds new lifecycle states to existing ones. This is the Living Documents protocol applied to `docs/architecture/domain/`.

- If the bet introduces a **new entity** (a noun a service will own that does not yet have a file in `docs/architecture/domain/`), create a stub at `docs/architecture/domain/<entity-name>.md` using the template at `.groundwork/skills/templates/domain-entity.md`. Fill in what the bet already implies — ownership, core fields, and lifecycle states as far as they are known. Stubs are explicitly incomplete.
- If the bet adds **new lifecycle states** to an existing entity, update the relevant `docs/architecture/domain/<entity-name>.md` file in place.

Confirm any domain doc changes with the user before proceeding to Step 2. Skip this step entirely if the bet introduces no new entities or state transitions.

## Step 1.9: Adopt the architect persona

The Technical Design Document below is architecture work — service boundaries, contract shapes, data flows, consistency models — done at bet scope. Load `.groundwork/skills/groundwork-architect/SKILL.md` and design as that persona for the headless core of this phase: the Data Flows & Business Logic, API Design, and Schema & Data Design. The UI Design subsection is the designer's — see Step 1.95.

Route to its `references/` by what this bet touches: `core-and-boundaries.md` if it adds or moves a boundary; `api-and-contracts.md` and `integration-and-workflows.md` for the API contracts and sync/async choices; `realtime-and-async.md` for any live path; `data-architecture.md` and `security-and-trust.md` for the schema, ownership, and trust decisions; `ai-native-architecture.md` for a model-in-the-loop feature. Apply the reference's reasoning and its antipatterns to the design.

The bet must fit inside the boundaries `docs/architecture/index.md` already committed. Where it cannot, the persona surfaces that explicitly — say the committed boundary is changing and why, and record it (`decision-records.md`); do not let the architecture drift one quiet bet at a time.

If a design decision changes what the bet delivers to its users — cutting a capability to fit the appetite, or expanding scope the pitch did not commit — that is a value/scope call, not a structural one: defer it to the product persona (`.groundwork/skills/groundwork-product/SKILL.md`) rather than deciding it from the architecture seat. The architect owns feasibility; product owns whether the changed scope is still worth building.

## Step 1.92: De-risk the unknowns with proof of concepts

Some bets turn on a real unknown the design cannot resolve by reasoning alone — whether a model fits in the memory budget, whether an approach is fast enough to feel live, whether a library actually does what its docs claim. Left unproven, that unknown can collapse the whole design after the bet is half-built. The design phase is where you retire it: build a **proof of concept** that tests the risky thing directly, in the open, before the design commits to it.

Before you build one, scope it against what is already known. A prior bet or investigation may have already answered part of the question — carried in as pre-discovered context during Discovery, or as a prior proof of concept or proven recipe handed forward at Delivery. Read what those retired, and aim the POC at the *residual* unknown only. Re-proving signal a prior investigation already established burns the appetite and risks a stale answer overriding a fresher one.

A POC is a deliberate throwaway. Build the smallest thing that answers the question — the model loaded and timed, the approach run against a realistic input — and read the answer. Then **write what you learned into the technical design**: what you tested, which approach you chose, what risk it retired, and the constraints it revealed (the memory ceiling, the latency floor). That written learning is the durable artifact; the POC code is discarded, not folded into the product. Recording the *why* this way keeps the decision trail future bets need without keeping a second, unmaintained implementation alive.

One rule the design must honour, because it is the rule a real bet broke: **a POC's result is not proof for the product.** A POC measured the captioner at 3.7s, then the shipped design swapped the approach and ran 5–10× slower because nothing re-checked it. The POC retires a design risk; the real design still has to prove the outcome on the shipping path, in a milestone. A non-functional number a user feels — latency, throughput, memory headroom — is a milestone proof on the real build, never a one-time POC measurement carried forward.

## Step 1.95: Adopt the designer persona for UI Design

The **UI Design** section of the Technical Design Document (Step 2) is design discipline — how each surface looks, the wireframe and states it must cover, and the interaction and visual intent that the contract then serves. For that section, load `.groundwork/skills/groundwork-designer/SKILL.md` and design as that persona; return to the architect for the headless core. The designer owns usability and craft, the architect owns feasibility — and UI Design is drafted first precisely because the contract must serve the experience.

Route to the designer's Context Routing table for the reference each surface decision turns on. Specify the per-surface visual intent concretely enough that a milestone test can judge the rendered result against it, and use the design system in `docs/design-system.md` rather than inventing a parallel one.

**Solve each UX problem with the current best-in-class pattern, and record the choice.** For a recurring problem — filtering, loading, search, pagination, empty states — reach for the solution the leading products have converged on (the removable filter pill with its clear affordance, the skeleton frame that holds layout while content loads) rather than a bespoke or dated one. The designer persona knows these patterns; the `## Design References` record in `docs/design-system.md` shows them in context — draw on both. Name the chosen pattern in `01-ui-design.md` for each view that needs it, specified completely enough that the build implements every affordance it implies (the pill removes when its x is clicked), and the milestone test and the experience-auditor can judge the rendered result against it. Where the pattern is new to the project, add it to the design system as a real component (so it projects into tokens and the next bet inherits it) rather than leaving it a one-off — the project accumulates one consistent pattern library instead of each bet re-choosing in isolation.

For a `graphical-ui` surface, that visual intent is a **micro-polish spec** — written at the parameter level and traceable to the design system's tokens, never adjectives. This is where high-end craft is won or lost: agents reliably ship the macro layout and skip the micro, so the spec must make the micro explicit. For each surface, specify all three layers, each as the token it resolves to:

- **Motion** — for every interactive and state transition, the named motion profile or its `{duration, easing, transform}` (the `hover`, `press`, `enter`/`exit`, `stagger` profiles from the design system's `motion.interactions`). Motion is required, not optional — a surface with no motion spec is underspecified.
- **Atmosphere / material** — the surface treatment as a token (`surface-glass`/`surface-elevated`/`surface-hero`, or an explicit composition of blur level, tint, border, elevation stack, and gradient), plus any ambient glow or grain, by token.
- **Static micro** — the elevation level (`shadow-low/mid/high`), spacing-scale steps, type roles with their line-height and tracking, perceptual colour roles, and the optical-alignment and crisp-rendering obligations the surface carries.

Write each as the token it resolves to (`surface-elevated`, `shadow-mid`, the `press` motion profile, the `body` type role) so the build applies the projected token and a conformance test can assert it landed. "Modelled light" or "subtle motion" is not a spec; `surface-elevated` with the `press` profile is. Where the surface needs a treatment the design system has not defined, specify it concretely and add it to the design system (so it projects into the tokens) rather than inventing a one-off in the component.

## Step 2: Draft the Technical Design Document

Draft the technical design as a **directory** of per-section files at `docs/bets/<bet-slug>/technical-design/`, using the templates under `.groundwork/skills/groundwork-bet/templates/technical-design/`. Write one file per section (the tool creates parent directories automatically):

| File | Content | Template |
|---|---|---|
| `01-ui-design.md` | The **UI Design** — one subsection per surface: an ASCII wireframe per key view (`graphical-ui`), its states, interactions, and the micro-polish spec. | `technical-design/01-ui-design.md` |
| `02-data-flows.md` | **Data Flows & Business Logic** — how data moves through the system, the business logic and routing decisions, mermaid-heavy (a `sequenceDiagram` per non-trivial flow). | `technical-design/02-data-flows.md` |
| `03-api-design.md` | **API Design** — the interface contracts (purpose, full request/response shapes, error guidance, rationale), surface-neutral. | `technical-design/03-api-design.md` |
| `04-data-design.md` | **Schema & Data Design** — the data model: stores, key fields with types, lifecycle states, and modelling rationale. | `technical-design/04-data-design.md` |

The numeric prefixes determine reading and concatenation order. Each file is a self-contained markdown section whose top-level heading starts at H2 so the files compose cleanly when concatenated. The per-section layout means any later edit — a review revise, a post-review change — touches only the affected file instead of regenerating the whole document in one turn.

The technical design covers the **entire bet** — not per-milestone. Write it before any decomposition into milestones or slices. The section order is the design's logic: **UI Design** is drafted first, because the contract must serve the experiences — never the other way around; then the headless core beneath it, surface-neutral — **Data Flows & Business Logic** (how the system works), then **API Design** (the interfaces), then **Schema & Data Design** (how data is stored). The system's topology — the picture of which services and components this bet touches — lives in the pitch's Solution (added in Step 2.1), not in this directory, so it is not redrawn here.

**UI Design (`01-ui-design.md`):** One subsection per surface in the pitch's `surfaces:` frontmatter. Each subsection describes what that surface's users observe and interact with, organised by view, command, or interaction — not by feature or service. For each: the purpose, its states (loading, active, empty, error, degraded), and its key interactions. For `graphical-ui` surfaces, each key view also carries an **ASCII wireframe** — a low-fidelity layout sketch fixing structure and hierarchy — and the **micro-polish spec** from Step 1.95 (the motion, atmosphere, and static-micro tokens the surface resolves to), so both layout and craft are specified rather than left to the build to improvise. A real mockup image, when one exists, may supplement the ASCII but never replaces it. Write each subsection in the vocabulary of that surface's interface type, from its design track in `docs/design-system.md`: screens, wireframes, and states for `graphical-ui`, commands and output for `cli` (no wireframe), request/response turns for `agentic-protocol` (no wireframe) — a bet spanning a web app and a CLI carries one subsection in each vocabulary. Each subsection is what that surface's milestone tests will assert against — it must be specific enough to make a test pass or fail unambiguously. When the project has no surface registry (`docs/surfaces.md` absent), the product has a single implicit surface: write one subsection for it in the project's interface medium and skip every other surface consideration in this workflow. A single-surface registry likewise produces exactly one subsection, with no added questions.

**Data Flows & Business Logic (`02-data-flows.md`):** How the bet actually works — talk through the key data paths in prose, diagram-heavy. Require fenced ` ```mermaid ` blocks (these render on GitHub and the Fumadocs site): a `sequenceDiagram` is **required** for each non-trivial cross-service or data flow, and a `flowchart` where the logic is a routing decision rather than a sequence. For each significant path, describe what triggers it, which services handle it, the business logic and routing decisions that govern it (including any API-to-API calls), what persists, and the key design decisions that shaped it. Skip trivial CRUD; focus on paths where timing, service boundaries, routing, or failure modes are non-obvious. This file does not redraw the topology — it details how data moves across the topology the pitch already shows.

**API Design (`03-api-design.md`)** is part of the headless core — everything in it must be designable, implementable, and provable with no surface running. For each service boundary (or, for a single app / embedded core, each key component interface) this bet touches, produce a fully specified interface design: full request shape with field types, full response shape with field types, all error cases with caller guidance, and design rationale for non-obvious decisions. Derive the specification from the pitch, upstream architecture, and the UI design and data flows above — the user provides intent and context; you produce the detailed contract. Where a detail is ambiguous, propose the best design and confirm the key decisions with the user rather than leaving the field unspecified. Vague shapes ("returns the entity") cannot drive correct implementation. The shapes belong here, in the prose, at design fidelity — the full request and response with field types, alongside the purpose, error-case guidance, and design rationale. This prose is the contract Decomposition writes its proofs against and Delivery implements against; the machine-readable contract (OpenAPI/AsyncAPI/proto) is generated from the running code at Delivery and captured as the canonical `docs/architecture/api/<service>/` record at Validation — not authored here as a separate spec file. For a single app with no cross-service API, focus on the key component interfaces the rest of the app depends on, and say so in one line if the bet introduces no meaningful interface boundary.

**The contract serves every in-scope surface and presumes none.** Designing the contract against all of its consumers at once is the cheapest moment to catch a web-shaped API a mobile client or CLI cannot use — a session assumption baked into a response, markup returned where data belongs, pagination sized to a viewport. Walk each surface's design against the contract before locking it. When only one surface is in scope, the latent agentic surface stands in as the second consumer: would a programmatic caller, with no UI and no session, find this contract complete? The review enforces this check.

**Schema & Data Design (`04-data-design.md`):** For each table, collection, or store this bet introduces or changes, define key fields, any lifecycle state machines, and the modelling rationale for non-obvious choices. Reference `docs/architecture/domain/` rather than duplicating it — note the domain entity path and describe only what this bet adds or changes.

Write the section files into `docs/bets/<bet-slug>/technical-design/`. These files are a commitment — they should reflect the actual design decisions, not a placeholder.

## Step 2.1: Update the pitch's Solution with the topology

The design just established the actual shape of the system — which services and components this bet touches and how they connect. Now that the shape is known, fill in the topology graph in the pitch's Solution (`docs/bets/<bet-slug>/pitch.md` → `### Topology`), replacing the placeholder graph with the real one. This is the Living Documents protocol applied to the pitch: a reader of the pitch should see the system the bet plays in, at a glance, before they open any design file. Keep it a topology `graph` only — the per-flow `sequenceDiagram`s belong in `02-data-flows.md`, not the pitch. If the bet is a trivial single-component change with no meaningful topology, leave a one-line note in place of the graph rather than a contrived diagram.

## Step 2.5: Independent Review of the Technical Design

The technical design is the contract Decomposition and Delivery execute against. A silently invented constraint, a dropped capability from the pitch, or a contradiction against the upstream architecture compounds into every milestone test and every line of implementation code. The review pass catches what the agent missed before the design hardens.

For a `graphical-ui` surface the review also gates **micro-polish concreteness**: a UI Design that gestures at craft in adjectives — "modelled light", "smooth motion", "premium feel" — rather than naming the tokens and parameters (the surface treatment, the motion profile, the elevation and type tokens) across all three layers is incomplete and returns REVISE. The spec must be concrete enough that the build applies tokens and a conformance test can assert they landed.

1. **Announce** the shift — the agent is moving from drafting into an independent review of the technical design before handing off to Decomposition.
2. **Assemble the sections for review.** The design lives as a directory of section files, so concatenate them into one document for the reviewer — a shell operation that consumes no output tokens regardless of size: `run_command("cat docs/bets/<bet-slug>/technical-design/*.md > /tmp/<bet-slug>-technical-design.md")`. Then **invoke the review subagent** (Protocol 9) with `document_path: /tmp/<bet-slug>-technical-design.md` and `document_type: technical-design`. The gate is fail-closed (Protocol 8): proceed only on a parseable `VERDICT: PRESENT`; a review that errors, hangs, or returns no verdict follows Protocol 9's failure path.
3. **Revise loop.** If the verdict is **REVISE**, apply every 🔴 Critical finding directly to the technical design — rewrite only the affected section file(s) under `docs/bets/<bet-slug>/technical-design/` rather than producing a list of suggestions. Re-assemble (`cat docs/bets/<bet-slug>/technical-design/*.md > /tmp/<bet-slug>-technical-design.md`) and run the review again. The revise cap is a hard stop, not a target to push past: after 3 REVISE verdicts, stop, surface remaining 🔴 findings as 🟡 Advisory, and disclose that the review did not reach **PRESENT** (Protocol 8). Clean up the assembled file once the review settles: `run_command("rm /tmp/<bet-slug>-technical-design.md")`.
4. **Carry advisory findings forward.** When the verdict is PRESENT, hold any 🟡 Advisory findings — they surface during the Decomposition review so the user can decide whether to act on them.

## Quality Standard: What a Good Technical Design Section Looks Like

The technical design is a contract, not an outline. Every section must be specific enough that a developer can implement from it without asking for clarification. Surface states, data flows, and API shapes must be explicit — not gestured at.

**Shallow (insufficient):**

```markdown
### API Design

#### Notification Service

**`GET /api/notifications`**
- Returns list of notifications for the authenticated user
- Requires auth token

**`POST /api/notifications/mark-read`**
- Marks notifications as read
```

**Deep (required standard):**

```markdown
### API Design

#### Notification Service

**`GET /api/notifications`**

**Purpose:** Returns unread notifications for the authenticated user, ordered newest-first.
Used by the UI on initial load and by the polling fallback when the websocket is unavailable.

**Request:**
```
Authorization: Bearer <token>   — required
?limit: integer                 — max results (default 20, max 100)
?before_id: uuid                — cursor; returns notifications older than this id
```

**Response:**
```
notifications: Notification[]
  id: uuid
  operation_id: uuid            — links to the triggering operation
  operation_type: enum(export, import, sync)
  status: enum(in_progress, completed, failed)
  message: string               — human-readable current state description
  created_at: timestamp
  read_at: timestamp | null     — null if unread
has_more: boolean               — true if older notifications exist past this page
```

**Errors:**
- `401 Unauthorized` — missing or expired token; caller should redirect to login
- `429 Too Many Requests` — polling interval too short; caller must back off to 10s

**Design rationale:** Cursor-based pagination (before_id) rather than offset because
the feed changes frequently — offset pagination skips or duplicates items as new
notifications arrive between pages.
```

The shallow version has no request shapes, no response field types, no error cases, and no design rationale. The deep version gives a developer everything needed to implement the endpoint correctly on the first pass.

## Transition

Once the technical design has passed review, present it to the user as the design contract for this bet. Orient with the pitch's topology graph (the system the bet plays in), then walk the **UI Design** (`technical-design/01-ui-design.md`) subsection by subsection — the wireframes and states, where the user's mental model of the bet lives — then the **Data Flows & Business Logic** (`technical-design/02-data-flows.md`): how the system works; then the **API Design** (`technical-design/03-api-design.md`): the interfaces; then the **Schema & Data Design** (`technical-design/04-data-design.md`): how data is stored. When the user wants to push a section deeper — or a section reads thin against the quality standard above — load `.groundwork/skills/groundwork-elicit/instructions.md` and follow it.

On approval:

1. Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: decomposition` — the design is locked and the bet advances to the Decomposition phase.
2. ➡️ Read and follow: `.groundwork/skills/groundwork-bet/workflows/03-decomposition.md`
