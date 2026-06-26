# Phase 3: Decomposition (Milestones, Slices, Proof of Work)

**Goal:** With the design locked, break the bet into the order of work and write — in prose — the proof each step must pass. Plan *just enough* to start building coherently: author the full **milestone ladder** — every rung's headline proof — but only the **first milestone's slices**. Each later milestone is sliced when its turn comes, in Delivery, re-derived from what the milestones before it actually taught — not guessed now and defended later. Agent-led, then reviewed: the agent proposes the breakdown and authors the proofs; the user reviews sequencing and the proofs. This phase produces **prose only** — the decomposition tree. No test code, no implementation code. The prose proofs are the contract; Delivery materializes them into a red suite and turns it green.

This phase is where the bet becomes executable. Milestones define the demonstrable checkpoints — capability proofs at the contract, surface proofs in each surface's medium. Slices define the vertical units of work. Each milestone and each slice carries a **Proof of work** written in plain language: what it proves and how the suite will prove it. The milestone ladder is the bet's success signal made executable — each rung is a demonstrable state that must be **un-mockable** (a stub or double cannot satisfy it), and the rungs are ordered to retire the bet's biggest risk earliest. That prose is the definition of done the user approves — turning it green is Delivery's job, and the red board is generated from this approved prose at Delivery start (`workflows/04-delivery.md` Step 0).

## Restrictions
⚠️ **CRITICAL CONSTRAINT:** This phase produces **prose only** — the decomposition tree. You are FORBIDDEN from writing implementation code, and equally from writing test code: both belong to Delivery. The Proof-of-work sections describe each proof in plain language; the runnable red stubs are generated from them at Delivery start. Nothing a compiler or interpreter would run is authored in this phase.

## Operating Contract

This workflow operates under the protocols defined in `.groundwork/skills/operating-contract.md` (contract v1; Continuous Bet mode: Protocols 1, 2, 4, 8, and 9 apply). Read it before taking any other action.

Protocol 1 applies throughout: milestone and slice discussions surface signals that belong elsewhere — future-bet instincts (`## Bets`), implementation details worth preserving (`## Design Details`). Capture them in `.groundwork/cache/discovery-notes.md` as they occur, then steer back to sequencing.

## Step 1: Update pitch status

Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: decomposition`.

## Step 2: Propose milestones

Read every file in `docs/bets/<bet-slug>/technical-design/` in full — `01-ui-design.md` for the UI design subsections, `02-data-flows.md` for the business logic and data flows, `03-api-design.md` for the interfaces and their shapes, and `04-data-design.md` for the schema and data model. From these, decompose the bet into milestones — then present the breakdown for review before writing a single proof.

**What a milestone is:** a demonstrable state the product reaches, ordered so each one is independently shippable. Its consumer gets value from Milestone 1 even if Milestone 2 never ships. Milestones come in two types:

- **Capability milestone** — proves core behaviour headless. Its demonstrable state is a contract exercised end-to-end against the running services (or the embedded core's public API): curl-able, scriptable, observable, with no surface running. This amends the user-visible rule honestly rather than bending it: a capability milestone is *consumer-visible at the contract*, and the decomposition records who that consumer is — the bet's in-scope surfaces, whose milestones build on it; or, when the bet delivers headless, the latent agentic surface (the programmatic caller the promoted contract serves).
- **Surface milestone** — proves a named surface delivers the capability to its users. Its demonstrable state is asserted in that surface's medium and bounded to wiring, rendering, and interaction — the business behaviour beneath it was already proven at the contract.

**Degrade rule:** a project with no `docs/surfaces.md` has a single implicit surface — skip milestone typing and the slice `surface` field entirely; milestones are user-visible states in the product's interface medium, exactly as before this distinction existed. A single-surface registry types its milestones (one capability milestone, then surface milestones for the lone surface) with no extra questions to the user — the typing falls out of the design, not a conversation.

**Decomposition constraints the agent must hold:**
- A bet introducing new capability **opens with its capability milestone**; surface milestones follow and depend on it. The contract proof comes first because every surface milestone consumes it.
- A bet may legitimately **end at the capability milestone** with every surface milestone deferred — a headless delivery. The pitch's surface no-gos predicted this, and validation records the deferral in the capability ledger.
- Order by integration value *and risk*: the first milestone is the thinnest end-to-end flow that proves the architecture works **through the bet's riskiest real path** — the un-mockable proof that retires the biggest unknown comes early, not last. Later milestones add richness to that proven foundation. Front-loading risk is the point of laddering: a bet that proves its plumbing for three milestones and only meets its hard dependency at the end has surfaced its risk too late to act on cheaply.
- Each milestone is independently shippable — dependencies flow forward only.
- Milestones are never horizontal. "Build all the schemas" is not a milestone; it is invisible to every consumer and produces no demonstrable state. A capability milestone is not horizontal — its contract is demonstrable end-to-end, just at the API rather than on a screen.
- 2–5 milestones is the healthy range. Fewer means the bet is probably not scoped in demonstrable increments. More means it is probably not a bet — it is a roadmap.

Present the milestone list with the **sequencing rationale** for each: what architectural proof Milestone 1 provides, why Milestone 2 can only follow it, and so on. The review focuses on **ordering, typing, and whether each milestone names a demonstrable outcome for a named consumer** — not implementation detail. Revise the ordering until the user is satisfied before proceeding.

## Step 3: Write each milestone's Proof of work (prose)

For each approved milestone, write its **Proof of work** prose before moving to slices — the proof the user reviews and signs, in plain language, with no assertion code. A milestone's proof follows its type:

**Capability milestone proofs** describe what is exercised against the contract directly — end-to-end against the running services (or the embedded core's public API): the request made, the response and persisted effect observed, the error case the milestone's outcome rests on. No surface is in the loop. Write it so a reader understands exactly what becomes true at the contract.

**Surface milestone proofs** describe what that surface's users observe, in that surface's medium — `graphical-ui` what renders and how the user interacts, `cli` the command and its output, `agentic-protocol` the request and the response structure. **A surface proof never re-proves core logic** — the capability milestone already proved every business rule at the contract, and re-asserting one at a surface multiplies the test pyramid by the surface count for nothing. Surface proofs cover wiring, rendering, and interaction.

**Degrade rule:** with no surface registry, write each milestone's proof as the two familiar layers — an interface-level proof in the project's single medium plus an API-level proof that localizes failures — exactly as before milestone typing existed.

**Keep it to the headline proof.** A milestone's Proof of work is the small set of outcomes that prove its consumer-visible state — typically one to three. It does not enumerate every permutation, error code, or boundary; that granular coverage is the permanent best-practice tests the slice-worker rolls out per slice in Delivery (`workflows/04-delivery.md`, the Slice Loop), not the headline proof the user reviews. Include an error case here only when the milestone's demonstrable outcome depends on it.

**The headline proof must be un-mockable.** The milestone ladder is the success signal made executable, so each rung's proof must be falsifiable by *reality*, not satisfiable by a *double*. If a stub, a mock, or a hardcoded return could make the proof pass, it is not proving the milestone — it is proving plumbing, and plumbing is never a milestone's success signal. A capability milestone's proof exercises the real dependency that makes the capability meaningful (the live model, the real external service, the actual store) — not a placeholder standing in for it. You may not defer the bet's central risk to a stub across the *whole* ladder: the milestone that retires that risk must engage the real thing. (If a real dependency genuinely cannot be reached in the test environment, name that constraint here and route it as a `BLOCKING CONCERN` in Delivery — never quietly redefine the proof down to what a stub can pass.) This is the decomposition-time complement to Delivery's *honest green*: honest green stops a proof that *named* real work from being hollowed during implementation; this stops a proof from being *authored* hollow in the first place.

**The proof's shapes come from the prose design.** Every request, response field, and name a proof references traces to `docs/bets/<bet-slug>/technical-design/03-api-design.md` (or a store in `04-data-design.md`) — the prose design carries the shapes at design fidelity, and the proof rests on them. A proof that invents a shape the design does not define is describing a contract that does not exist; the review blocks it.

Write the milestone's `Proves` / `How we prove it` / `Test file` into its `index.md` (Step 5) — the test file path is named here but the stub is not written until Delivery.

## Step 4: Decompose milestones into slices

Break the **first milestone** into **vertical slices** — the smallest units that are independently buildable, deployable, and verifiable. Author slices for the first rung only; the later milestones keep their headline proof but are *not* sliced yet. Each later milestone is sliced when its turn comes, at the prior milestone's postmortem in Delivery (`workflows/04-delivery.md`), so its slices are derived from what the milestones before it actually taught. The slicing discipline below is identical wherever it runs, whether now for the first milestone or on arrival for a later one.

**The vertical-slice test:** *Can this slice be deployed and verified without any future slice existing?* If yes, it is vertical. If it requires a downstream slice to be useful, it is too thin or horizontal — merge it up or reframe it as a capability of a larger slice.

Never slice horizontally: "all schemas, then all APIs, then all UI" is three horizontal passes. Each slice must cross whatever service boundaries are needed to deliver a testable capability end-to-end.

Each slice spec must contain:
- **Owner service** — the primary service this slice lives in (from `docs/architecture/infrastructure.md`)
- **Surface** — `core` for a slice implementing capability-core behaviour, or the registry slug of the surface it wires (omit the field entirely when the project has no surface registry). The field drives delivery sequencing — core slices merge before the surface slices that consume them — and tells the reviewer which test discipline applies: contract proof for `core`, wiring-only for a surface.
- **Complexity** — S / M / L
- **Prerequisite** — the exact prior merge gate (e.g. "Slice 1.2 merged"), or none
- **Scope** — a one-paragraph intro linking the slice to its parent milestone and stating what vertical capability it contributes, plus **Required Capabilities**: falsifiable behaviour statements, each tracing to an interface in `technical-design/03-api-design.md` or a store in `technical-design/04-data-design.md`. "The endpoint exists" is not falsifiable. "POST `/api/sessions` returns 201 with a `session_id` field when given a valid request body matching the API design" is.
- **Design** — where the slice lands in the design: the interface it implements, the data flow it realizes in `02-data-flows.md`, and (for a surface slice) the view it wires in `01-ui-design.md`.
- **Proof of work** — the slice's prose proof (Step 5): what it proves and how, the handful of outcomes that show its capability is present.

## Step 5: Write the decomposition tree

Write the reviewable artifact as a **browsable tree** at `docs/bets/<bet-slug>/decomposition/`, using the templates under `.groundwork/skills/groundwork-bet/templates/decomposition/` (the tool creates parent directories automatically):

| Path | Content | Template |
|---|---|---|
| `decomposition/meta.json` | Sidebar order + the "Decomposition" title. | `decomposition/meta.json` |
| `decomposition/NN-<milestone-slug>/index.md` | One folder per milestone; `index.md` is its landing page — type, consumer, demonstrable goal, sequencing rationale, acceptance criteria, **Proof of work** (Step 3), and links to its slices. | `decomposition/milestone-index.md` |
| `decomposition/NN-<milestone-slug>/NN-<slice-slug>.md` | One file per slice — header, **Scope** (intro + Required Capabilities), **Design**, **Proof of work** (Step 4 / Step 5). | `decomposition/slice.md` |

**The full ladder, the first rung sliced.** Write every milestone's `index.md` now — the complete ladder of headline proofs the user approves. Write slice files only for the **first milestone**. A later milestone's folder holds its `index.md` with the headline proof and its slice list deferred (the `milestone-index.md` template's *authored on arrival* affordance) until Delivery opens it; its slice files are written then. This is *plan just enough* on disk: the whole ladder is visible and reviewable, but only the rung you are about to climb is detailed.

The `NN-` numeric prefixes order the milestone folders and the slices within each, so the tree reads top to bottom on the docs site as the order of work. Discover the project's test language and service names from the scaffold (`docs/architecture/infrastructure.md` and the generated `docker-compose.yml`) so each `Test file:` path names the right extension and owning service — do not hardcode a language or service name. The path is named; the stub is generated at Delivery start.

**The slice's Proof of work is the prose proof.** Write each `Proves` / `How we prove it` from the slice's target-state intent — what becomes true and the observable condition that shows it — never assertion code. A `core` slice proves contract behaviour; a surface slice proves wiring, rendering, and interaction only. This is the headline proof, not every assertion: the granular edge-case and permutation coverage is added when the slice is built in Delivery.

Apply `groundwork-writer` when drafting the tree — declarative, assertive, zero-hedging.

## Step 6: Independent review

The decomposition is the sequencing commitment this bet executes against. A milestone no consumer can observe, a slice that is horizontal, or a proof that does not trace to the design compounds into every delivery decision. The review pass catches these before the plan hardens.

1. **Announce** the shift — the agent is moving from authoring into an independent review of the decomposition before presenting Proof of Work.
2. **Assemble the tree for review.** The decomposition lives as a tree of files, so concatenate them into one document for the reviewer — a shell operation that consumes no output tokens regardless of size: `run_command("find docs/bets/<bet-slug>/decomposition -name '*.md' | sort | xargs cat > /tmp/<bet-slug>-decomposition.md")` (sorted so milestone and slice order is preserved). Then **invoke the review subagent** (Protocol 9) with `document_path: /tmp/<bet-slug>-decomposition.md` and `document_type: decomposition`. The gate is fail-closed (Protocol 8): proceed only on a parseable `VERDICT: PRESENT`; a review that errors, hangs, or returns no verdict follows Protocol 9's failure path.
3. **Revise loop.** If the verdict is **REVISE**, apply every 🔴 Critical finding directly to the affected milestone `index.md` or slice file. Rewrite sections rather than annotating them. Re-assemble (`find docs/bets/<bet-slug>/decomposition -name '*.md' | sort | xargs cat > /tmp/<bet-slug>-decomposition.md`) and run the review again. The revise cap is a hard stop, not a target to push past: after 3 REVISE verdicts, stop, surface remaining 🔴 findings as 🟡 Advisory, and disclose that the review did not reach **PRESENT** (Protocol 8). Clean up the assembled file once the review settles: `run_command("rm /tmp/<bet-slug>-decomposition.md")`.
4. **Carry advisory findings forward.** When the verdict is PRESENT, hold any 🟡 Advisory findings — they surface during the Proof of Work transition so the user can decide whether to act on them.

The review verifies document-chain integrity — see the **Document Chain Integrity** section below for the exact checks the reviewer applies.

## Decomposition Gate

Before presenting Proof of Work, verify every item. This gate runs at initial decomposition over **the full ladder and the first milestone's slices**, and runs again — scoped to a single milestone's slices — each time Delivery opens a later milestone or introduces a new one (`workflows/04-delivery.md`):

- Every milestone names a demonstrable goal a reviewer can trace to `technical-design/`: a surface milestone's user-visible goal traces to its surface's subsection in `01-ui-design.md`; a capability milestone's contract state traces to `03-api-design.md` / `04-data-design.md` (and the data flows in `02-data-flows.md`), with its consumer named.
- Every milestone's headline Proof of work is **un-mockable** — falsifiable by the real dependency it names, not satisfiable by a stub, mock, or hardcoded return; the milestone that retires the bet's central risk engages the real thing.
- When the project has a surface registry: every milestone is typed (`capability` or `surface (<slug>)`), the bet's new capability opens with its capability milestone, and every slice carries a `surface` value (`core` or a registry slug). With no registry, none of this applies — untyped milestones, no surface fields.
- Every milestone has a **Proof of work** in its `index.md` — `Proves`, `How we prove it`, and a named `Test file:` path at `tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.<ext>`.
- No surface milestone proof re-asserts a business rule the capability milestone proves at the contract — surface proofs are bounded to wiring, rendering, and interaction.
- Every **authored** slice (the first milestone's at initial decomposition; the opened or introduced milestone's on arrival) is vertical — it can be deployed and verified without any future slice existing.
- Every authored slice has falsifiable Required Capabilities, each tracing to an interface in `technical-design/03-api-design.md` or a store in `technical-design/04-data-design.md`.
- Every authored slice has a **Proof of work** and a named `Test file:` path at `tests/bets/<bet-slug>/test_slice_<N>_<service>_<slice-slug>.<ext>`.
- Every request shape, response field, and name a proof references traces to `technical-design/03-api-design.md` / `04-data-design.md` — no shapes the prose design does not define.
- The `decomposition/` tree carries `meta.json`, **every** milestone `index.md` (the full ladder of headline proofs), and the slice files for **every milestone authored so far** — the first milestone at initial decomposition, the current milestone on arrival — with those slice links resolving. A later, unopened milestone legitimately has no slice files yet.

A *missing rung* is not Proof of Work — the full ladder of headline proofs must be present and approved. But an unsliced *later* milestone is not a partial decomposition; it is the plan-just-enough design. What must be complete is the ladder plus the slices for the milestone now being authored.

## Document Chain Integrity

The review subagent applies these checks. The agent authoring the decomposition should apply them during Step 6 as well — they catch drift before it reaches the reviewer.

| Document | Upstream check | Downstream check |
|----------|---------------|-----------------|
| Pitch | Solves the stated problem within appetite | Design covers the pitched solution |
| Technical Design | Every surface element/flow traces to the pitch | Milestones can be derived from it |
| Milestones | Each goal is consumer-visible value — at the contract for capability milestones, in the surface's medium for surface milestones — traceable to the design | Every slice belongs to exactly one milestone |
| Slices | Required Capabilities trace to interfaces/stores in `technical-design/03-api-design.md` / `04-data-design.md` | Proof of work traces to milestone acceptance criteria |

## Quality Standard: What Good Milestones and Slices Look Like

A milestone is a demonstrable state the product reaches for a named consumer — at the contract for a capability milestone, in a surface's medium for a surface milestone — not a layer of the stack, not a phase of implementation. A slice is a vertical column through one component, not a horizontal pass. If neither description produces a name that means something to its consumer, the decomposition is wrong.

**Shallow (insufficient):**

```markdown
## Milestones

1. **Backend** — Build the database schema and notification service
2. **Frontend** — Add notification UI components
3. **Integration** — Connect frontend to backend and end-to-end test
```

**Deep (required standard) — a milestone `index.md`:**

```markdown
# Milestone 1: Notification lifecycle proven at the contract

**Type:** capability
**Consumer:** the `web-app` and `admin-cli` surfaces — Milestones 2 and 3 build on
this contract.

**Demonstrable goal:** An operation lifecycle event posted to the notification service
produces a queryable notification record, and subsequent events update its status in
place — provable end-to-end against the running services with nothing but an HTTP client.

**Sequencing rationale:** This contract is what every surface consumes. Proving it
headless first makes Milestones 2 and 3 wiring exercises against a known-good core —
a red surface test can only mean a surface problem.

**Acceptance criteria:**
- [ ] `POST /internal/events` with a valid operation lifecycle event returns `202`, and
  `GET /api/notifications` returns the corresponding record within 2 seconds.
- [ ] A `completed` event for the same operation updates the existing record's status in
  place — no duplicate record.

## Proof of work

**Proves:** A lifecycle event becomes a queryable notification, and a later event for the
same operation updates that record rather than creating a second one.

**How we prove it:** Against the running services with an HTTP client only — POST a valid
event, then GET the feed and see the record within 2 seconds; POST a `completed` event for
the same operation and see the one record's status change in place, with no duplicate.

**Test file:** `tests/bets/notifications/test_milestone_1_notification_contract.py` —
generated red at Delivery start; traces to the `POST /internal/events` and
`GET /api/notifications` interfaces in `03-api-design.md`.

## Slices
- [Slice 1.1 — notification-service: Operation event intake](./01-event-intake.md)
```

The shallow version has horizontal milestones invisible to every consumer, no acceptance criteria, no sequencing rationale, and no proof. Its "Backend" milestone names a build activity, not a contract state anyone can exercise. The deep version opens with the capability milestone that proves the contract headless for named consumers; surface milestones follow, bounded to wiring in each surface's medium.

**Deep (required standard) — a slice file:**

```markdown
# Slice 1.1 — notification-service: Operation event intake

**Owner service:** notification-service
**Surface:** core
**Complexity:** M
**Prerequisite:** none

## Scope

Wires the notification service to receive operation lifecycle events from the operations
service and persist them as notification records. This is the notification-service's data
foundation — every other slice depends on this record existing.

**Required Capabilities:**
- `POST /internal/events` accepts an operation lifecycle event matching the `OperationEvent`
  shape in `03-api-design.md`; returns `202 Accepted`.
- A notification record is created in the `notifications` table with status, message, and
  operation_id populated from the event payload.
- Duplicate events for the same operation_id + status are idempotent; a second identical
  event produces no additional record.

## Design

Implements `POST /internal/events` from `03-api-design.md`, realizing the intake flow in
`02-data-flows.md`, and writes the `notifications` store defined in `04-data-design.md`.

## Proof of work

**Proves:** An operation event sent to the service becomes exactly one notification record,
and a repeat of the same event changes nothing.

**How we prove it:** POST a valid event and confirm `202`, then query the `notifications`
table and see one matching row; POST the identical event again and confirm the row count is
unchanged; POST an event missing a required field and confirm `422` with no row written.

**Test file:** `tests/bets/notifications/test_slice_1_notification_service_event_intake.py` —
generated red at Delivery start; traces to `POST /internal/events` and the `notifications`
store.
```

The slice's Proof of work is the headline proof of its vertical capability — not every permutation. The exhaustive edge-case and error-matrix coverage lands in Delivery's permanent best-practice tests, written when the slice is built.

## Transition

Present the decomposition tree as Proof of Work:

- `docs/bets/<bet-slug>/decomposition/` — the sequencing commitment and the prose proofs, browsable milestone by milestone, slice by slice.

Walk the milestone map first — ordering rationale, milestone types, demonstrable goals. Then walk the **Proof of work** sections **proof by proof**: for each milestone and slice, what it proves, where that traces in the design, and why it is the right proof. The proof is prose, but the scrutiny is assertion-grade — the user is approving the definition of done, so pace this walkthrough like the design decision it is (Protocol 4), not a confirmation formality. Where the user challenges a proof, fix the prose and continue.

On approval, **commit the decomposition and tag the baseline**: commit `docs/bets/<bet-slug>/decomposition/` (the full milestone ladder plus the first milestone's slices) together with the finalized `technical-design/` (e.g. `bet(<bet-slug>): approve decomposition`), then tag that commit `git tag bet/<bet-slug>/approved`. The tag is the user's signature on the prose — but it is a **ratchet, not a one-time freeze**. What it seals at this point is the full ladder of headline proofs *and* the first milestone's slices. Each later milestone's slices are sealed when Delivery opens that milestone: the agent authors them, they pass this same gate (scoped to that milestone) and the Protocol 9 review, and on approval the tag **advances** to the commit that adds them (`git tag -f bet/<bet-slug>/approved`, message `bet(<bet-slug>): author milestone <N>`).

The ratchet has **two additive event types**: authoring an existing rung's slices, and **adding a new rung** when a postmortem reveals the ladder is missing a milestone (`bet(<bet-slug>): add milestone <N>` — the *ladder amendment* in `workflows/04-delivery.md`). Both advance the tag additively and never reopen a sealed proof. From any point forward, `git diff bet/<bet-slug>/approved.. -- docs/bets/<bet-slug>/` shows the prose changes since the current seal: a legitimate change is the additive authoring of the milestone just opened, or the additive headline of a milestone just added; any *modification* to an already-sealed headline or slice proof must instead route through the Amendment Protocol in `workflows/04-delivery.md`. The code (tests and implementation) is *built* during Delivery and is free to change; only the prose contract is sealed. (If the project is not under git, there is no tag to anchor to — note that in the bet record; the reconciliation then falls back to checking that each built test still proves what its slice's Proof-of-work prose describes.)

➡️ Read and follow: `.groundwork/skills/groundwork-bet/workflows/04-delivery.md`
