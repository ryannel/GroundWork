# Phase 3: Decomposition (Milestones, Slices, Proof of Work)

**Goal:** With the design locked, break the bet into the order of work and write — in prose — the proof each step must pass. Plan *just enough* to start building coherently: author the full **milestone ladder** — every rung's headline proof — but only the **first milestone's slices**. Each later milestone is sliced when its turn comes, in Delivery, re-derived from what the milestones before it actually taught — not guessed now and defended later. Agent-led, then reviewed: the agent proposes the breakdown and authors the proofs; the user reviews sequencing and the proofs. This phase produces **prose only** — the decomposition tree. No test code, no implementation code. The prose proofs are the contract; Delivery materializes them into a red suite and turns it green.

This phase is where the bet becomes executable. A **milestone** is a thin, user-visible step proven by driving the real product the way its consumer would — through the real front door, on the real pipeline. A **slice** is a vertical cut through one service, the unit of work that builds toward a milestone; slices run in sequence, each built on the one before. Each milestone and each slice carries a **Proof of work** written in plain language: what it proves and how the suite will prove it. The milestone ladder is the bet's success signal made executable — each rung is a state the consumer observes at their real surface, and the rungs are ordered to retire the bet's biggest risk earliest. That prose is the definition of done the user approves — turning it green is Delivery's job, and the red board is generated from this approved prose at Delivery start (`workflows/04-delivery.md` Step 0).

## Restrictions
⚠️ **CRITICAL CONSTRAINT:** This phase produces **prose only** — the decomposition tree. You are FORBIDDEN from writing implementation code, and equally from writing test code: both belong to Delivery. The Proof-of-work sections describe each proof in plain language; the runnable red stubs are generated from them at Delivery start. Nothing a compiler or interpreter would run is authored in this phase.

## Operating Contract

This workflow operates under the protocols defined in `.groundwork/skills/operating-contract.md` (contract v1; Continuous Bet mode: Protocols 1, 2, 4, 8, and 9 apply). Read it before taking any other action.

Protocol 1 applies throughout: milestone and slice discussions surface signals that belong elsewhere — future-bet instincts (`## Bets`), implementation details worth preserving (`## Design Details`). Capture them in `.groundwork/cache/discovery-notes.md` as they occur, then steer back to sequencing.

## Step 1: Update pitch status

Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: decomposition`.

## Step 2: Propose milestones

Read every file in `docs/bets/<bet-slug>/technical-design/` in full — `01-ui-design.md` for the UI design subsections, `02-data-flows.md` for the business logic and data flows, `03-api-design.md` for the interfaces and their shapes, and `04-data-design.md` for the schema and data model. From these, decompose the bet into milestones — then present the breakdown for review before writing a single proof.

**What a milestone is:** a thin, user-visible step the product reaches — a state its consumer observes at their real surface, proven by driving the shipping build the way that consumer would. The consumer is whoever the step serves: a person at a screen, a developer calling an SDK, an operator reading a dashboard or trace, another system calling the API. A pure-API product has a front door like any other — its surface is the API and its consumer is the caller. The test of a milestone is simple: name who sees the outcome and what they see. If you cannot, it is not a milestone — it is horizontal scaffolding to fold into the milestone that consumes it, or an unknown to retire as a proof of concept in design.

**Decomposition constraints the agent must hold:**
- Order by integration value *and risk*: the first milestone is the thinnest user-visible flow that proves the architecture works **through the bet's riskiest real path** — the proof that retires the biggest unknown comes early, not last. Later milestones add richness to that proven foundation. Front-loading risk is the point of laddering: a bet that proves its plumbing for three milestones and only meets its hard dependency at the end has surfaced its risk too late to act on cheaply.
- The **first user-visible milestone lands the design system in the running app** — the shell, the theme and tokens wired in, the base components, and the first real screen built on them. Every later screen is built on that foundation; "make it look right later" is the mistake this whole process exists to stop.
- Dependencies flow forward only — each milestone builds on the proven state of the ones before it.
- Milestones are never horizontal. "Build all the schemas" is not a milestone; it is invisible to every consumer and produces no observable state. Proving a backend contract end-to-end is real work, but it is a *slice* on the way to a front door, never a milestone that stops there.
- The ladder must **sum to a complete, well-rounded experience** — each milestone works, looks right, and is genuinely good to use. A missing rung (the way back from a screen, the progress an operation needs, the information a view requires to be usable) is an incomplete plan, not a smaller scope. The dead-end navigation and the silent progress screen that a real bet shipped were each a *missing milestone* — a rung the ladder should have had.
- 2–5 milestones is the healthy range. Fewer means the bet is probably not scoped in demonstrable increments. More means it is probably not a bet — it is a roadmap.

Present the milestone list with the **sequencing rationale** for each: what proof Milestone 1 provides, why Milestone 2 can only follow it, and so on, and which consumer observes each. The review focuses on **ordering, whether each milestone names a real outcome a named consumer observes at their surface, and whether the ladder sums to a complete experience** — not implementation detail. Revise the ordering until the user is satisfied before proceeding.

## Step 3: Write each milestone's Proof of work (prose)

For each approved milestone, write its **Proof of work** prose before moving to slices — the proof the user reviews and signs, in plain language, with no assertion code. A milestone's proof describes what its consumer observes when they drive the real product: the action they take at their surface, what they see in return, and the real data and pipeline behind it. Write it in the consumer's medium — `graphical-ui` what renders and how the user interacts, `cli` the command and its output, `agentic-protocol` the request and the response structure — so a reader understands exactly what becomes true for the consumer when the milestone lands.

**Keep it to the headline proof.** A milestone's Proof of work is the small set of outcomes that prove its consumer-visible state — typically one to three. It does not enumerate every permutation, error code, or boundary; that granular coverage is the permanent best-practice tests the slice-worker rolls out per slice in Delivery (`workflows/04-delivery.md`, the Slice Loop), not the headline proof the user reviews. Include an error case here only when the milestone's demonstrable outcome depends on it. These headline cases are the milestone's **agreed front-door test cases** — the integrity anchor the user signs at planning; they live in the milestone's acceptance criteria and Proof of work.

**The headline proof drives the real product through the real front door.** Each rung's proof must be falsifiable by *reality*: the consumer's action runs the shipping build end to end, on the real pipeline, the way it actually travels — never a test harness driving a scripted stand-in for the work. A proof that a stub, a mock, or a hardcoded return could satisfy is proving plumbing, and plumbing is never a milestone's success signal. The dependency that makes the milestone meaningful runs for real — the live model, the real external service, the actual store — not a placeholder standing in for it. Seeded inputs are fine (handing the real pipeline a known fixture folder tests it on controlled data); replacing the pipeline with a script that emits the expected output is the violation. And **any fake a proof leans on needs a real test behind it**: if a test stands in a fixture for work a real stage should do, some other proof must exercise the real stage that produces it — a fixture nothing real ever generates is a green light wired to nothing. You may not defer the bet's central risk to a stub across the *whole* ladder: the milestone that retires that risk must engage the real thing. (If a real dependency genuinely cannot be reached in the test environment, name that constraint here and route it as a `BLOCKING CONCERN` in Delivery — never quietly redefine the proof down to what a stub can pass.) This is the decomposition-time complement to Delivery's *honest green*: honest green stops a proof that *named* real work from being hollowed during implementation; this stops a proof from being *authored* hollow in the first place.

**The proof's shapes come from the prose design.** Every request, response field, and name a proof references traces to `docs/bets/<bet-slug>/technical-design/03-api-design.md` (or a store in `04-data-design.md`) — the prose design carries the shapes at design fidelity, and the proof rests on them. A proof that invents a shape the design does not define is describing a contract that does not exist; the review blocks it.

Write the milestone's `Proves` / `How we prove it` / `Test file` into its `index.md` (Step 5) — the test file path is named here but the stub is not written until Delivery.

## Step 4: Decompose milestones into slices

Break the **first milestone** into **vertical slices** — the smallest units that are independently buildable, deployable, and verifiable. Author slices for the first rung only; the later milestones keep their headline proof but are *not* sliced yet. Each later milestone is sliced when its turn comes, at the prior milestone's postmortem in Delivery (`workflows/04-delivery.md`), so its slices are derived from what the milestones before it actually taught. The slicing discipline below is identical wherever it runs, whether now for the first milestone or on arrival for a later one.

**Slices build toward the front door, in sequence.** Lay the slices out so they compose coherently into the milestone — what each one solves for and how they stack — and order them so each builds on the proven state of the one before it. They are delivered in that order, integrating continuously, and the milestone's front-door proof is what the last of them closes. This is a plan to steer, not a sealed breakdown: hold what each slice must achieve and how they sum to the milestone, and adjust the how as each slice teaches you something.

**The vertical-slice test:** *Can this slice be deployed and verified without any future slice existing?* If yes, it is vertical. If it requires a downstream slice to be useful, it is too thin or horizontal — merge it up or reframe it as a capability of a larger slice.

Never slice horizontally: "all schemas, then all APIs, then all UI" is three horizontal passes. Each slice must cross whatever service boundaries are needed to deliver a testable capability end-to-end.

Each slice spec must contain:
- **Owner service** — the primary service this slice lives in (from `docs/architecture/infrastructure.md`)
- **Surface** — `core` or the registry slug the slice builds for (registry projects only; omit when the project carries no `docs/surfaces.md`). Core-before-surface sequencing and the validation ledger's landing column both read this value; the readiness gate blocks a slice whose value is missing or is neither `core` nor a registry slug.
- **Complexity** — S / M / L
- **Model tier** *(optional)* — omit for the `execution` default; set `frontier` with a one-line reason only when the slice is *particularly challenging or vague* (the same risk signal that warrants a POC), judged when the slice is authored — here for the first milestone, or in Delivery's *Opening a milestone* for a later rung. This lifts the slice-worker's model for this slice; Delivery reads it at dispatch (Model Tiers, operating contract). It is one-directional — a slice can ask for a higher tier, never a lower one.
- **Prerequisite** — the exact prior merge gate (e.g. "Slice 1.2 merged"), or none
- **Scope** — a one-paragraph intro linking the slice to its parent milestone and stating what vertical capability it contributes, plus **Required Capabilities**: falsifiable behaviour statements, each tracing to an interface in `technical-design/03-api-design.md` or a store in `technical-design/04-data-design.md`. "The endpoint exists" is not falsifiable. "POST `/api/sessions` returns 201 with a `session_id` field when given a valid request body matching the API design" is.
- **Design** — where the slice lands in the design: the interface it implements, the data flow it realizes in `02-data-flows.md`, and, when it builds a screen, the view it wires in `01-ui-design.md` and the pattern it implements in full.
- **Proof of work** — the slice's prose proof (Step 5): what it proves and how, the handful of outcomes that show its capability is present.

## Step 5: Write the decomposition tree

Write the reviewable artifact as a **browsable tree** at `docs/bets/<bet-slug>/decomposition/`, using the templates under `.groundwork/skills/groundwork-bet/templates/decomposition/` (the tool creates parent directories automatically):

| Path | Content | Template |
|---|---|---|
| `decomposition/meta.json` | Sidebar order + the "Decomposition" title. | `decomposition/meta.json` |
| `decomposition/NN-<milestone-slug>/index.md` | One folder per milestone; `index.md` is its landing page — consumer, demonstrable goal, sequencing rationale, acceptance criteria (the agreed front-door cases), **Proof of work** (Step 3), and links to its slices. | `decomposition/milestone-index.md` |
| `decomposition/NN-<milestone-slug>/NN-<slice-slug>.md` | One file per slice — header, **Scope** (intro + Required Capabilities), **Design**, **Proof of work** (Step 4 / Step 5). | `decomposition/slice.md` |

**The full ladder, the first rung sliced.** Write every milestone's `index.md` now — the complete ladder of headline proofs the user approves. Write slice files only for the **first milestone**. A later milestone's folder holds its `index.md` with the headline proof and its slice list deferred (the `milestone-index.md` template's *authored on arrival* affordance) until Delivery opens it; its slice files are written then. This is *plan just enough* on disk: the whole ladder is visible and reviewable, but only the rung you are about to climb is detailed.

The `NN-` numeric prefixes order the milestone folders and the slices within each, so the tree reads top to bottom on the docs site as the order of work. Discover the project's test language and service names from the scaffold (`docs/architecture/infrastructure.md` and the generated `docker-compose.yml`) so each `Test file:` path names the right extension and owning service — do not hardcode a language or service name. The path is named; the stub is generated at Delivery start.

**The slice's Proof of work is the prose proof.** Write each `Proves` / `How we prove it` from the slice's target-state intent — what becomes true and the observable condition that shows it — never assertion code. A slice proves the behaviour at its service edge; when a slice builds a screen, it proves the screen renders and behaves through the pattern it implements in full. This is the headline proof, not every assertion: the granular edge-case and permutation coverage is added when the slice is built in Delivery.

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

- Every milestone names a real outcome a named consumer observes at their surface, traceable to `technical-design/`: the user-visible step traces to its surface's subsection in `01-ui-design.md`, and the data and interfaces beneath it to `02-data-flows.md` / `03-api-design.md` / `04-data-design.md`. Name who sees it and what they see, or it is not a milestone.
- The first user-visible milestone lands the design system in the running app — shell, tokens, base components, and a real screen built on them — not a bare-bones screen with styling deferred.
- The ladder sums to a complete, well-rounded experience: no missing rung (a way back from every screen, the progress and state information each view needs to be usable). A dead-end or a silent-progress screen is a missing milestone, caught here.
- Every milestone's headline Proof of work **drives the real product through the real front door** — the consumer's action runs the shipping build on the real pipeline, falsifiable by reality, not satisfiable by a stub, mock, or hardcoded return; the milestone that retires the bet's central risk engages the real thing; and any fake the proof leans on has a real test behind it that exercises the real producer.
- Every milestone has a **Proof of work** in its `index.md` — `Proves`, `How we prove it`, and a named `Test file:` path at `tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.<ext>`.
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
| Milestones | Each goal is a real outcome a named consumer observes at their surface, traceable to the design | Every slice belongs to exactly one milestone |
| Slices | Required Capabilities trace to interfaces/stores in `technical-design/03-api-design.md` / `04-data-design.md` | Proof of work traces to milestone acceptance criteria |

## Quality Standard: What Good Milestones and Slices Look Like

A milestone is a thin user-visible step the product reaches for a named consumer — a state they observe at their real surface — not a layer of the stack, not a phase of implementation. A slice is a vertical column through one service that builds toward it, not a horizontal pass. If the milestone does not name a consumer and what they see, the decomposition is wrong.

**Shallow (insufficient):**

```markdown
## Milestones

1. **Backend** — Build the database schema and notification service
2. **Frontend** — Add notification UI components
3. **Integration** — Connect frontend to backend and end-to-end test
```

**Deep (required standard) — a milestone `index.md`:**

```markdown
# Milestone 1: A user sees their notifications update live in the web app

**Consumer:** the person using the `web-app` — they open the notifications panel and watch
it reflect real operations as they happen.

**Demonstrable goal:** With the web app running on the real notification service, a user
opens the notifications panel and sees a real operation appear as a notification, then sees
its status change in place when the operation completes — on the real pipeline, in the
shipped design system, with an empty state before anything arrives and a clear way back to
where they came from.

**Sequencing rationale:** This is the thinnest user-visible flow that proves the whole path
end to end — event intake, persistence, the read API, and the panel that renders it — on
the design system that every later screen builds on. It retires the bet's riskiest unknown
(does the live event path actually reach the screen) at Milestone 1, not last.

**Acceptance criteria (agreed front-door cases):**
- [ ] With the app open on the notifications panel and no notifications yet, the user sees
  the empty state; when a real operation starts, its notification appears within 2 seconds.
- [ ] When that operation completes, the same notification updates its status in place — the
  user sees one entry change, not a duplicate appear.
- [ ] The panel renders in the design system (tokens, components), and the user can close it
  and return to where they were.

## Proof of work

**Proves:** A user driving the running web app sees a real operation surface as a live
notification and update in place, on the design system, with its empty state and a way back.

**How we prove it:** Drive the shipping web build against the real notification service —
open the panel and see the empty state; trigger a real operation through the system and see
its notification appear within 2 seconds; complete the operation and see the one entry's
status change in place with no duplicate; confirm the panel renders the design-system
components and that closing it returns to the prior view.

**Test file:** `tests/bets/notifications/test_milestone_1_notifications_panel_live.py` —
generated red at Delivery start; drives the web surface in `01-ui-design.md` over the
`POST /internal/events` and `GET /api/notifications` interfaces in `03-api-design.md`.

## Slices
- [Slice 1.1 — notification-service: Operation event intake](./01-event-intake.md)
- [Slice 1.2 — web-app: Live notifications panel on the design system](./02-notifications-panel.md)
```

The shallow version has horizontal milestones invisible to every consumer, no acceptance criteria, no sequencing rationale, and no proof — "Backend" names a build activity, not a state anyone observes. The deep version is a thin user-visible step proven by driving the real product through the front door: the backend slice and the panel slice stack into one flow a user actually sees, on the design system, with its states and its way back.

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

Walk the milestone map first — ordering rationale, who observes each milestone, demonstrable goals. Then walk the **Proof of work** sections **proof by proof**: for each milestone and slice, what it proves, where that traces in the design, and why it is the right proof. The proof is prose, but the scrutiny is assertion-grade — the user is approving the agreed front-door test cases that become the definition of done, so pace this walkthrough like the design decision it is (Protocol 4), not a confirmation formality. Where the user challenges a proof, fix the prose and continue.

On approval, **commit and seal the decomposition as the recorded baseline**: commit `docs/bets/<bet-slug>/decomposition/` (the full milestone ladder plus the first milestone's slices) together with the finalized `technical-design/` (e.g. `bet(<bet-slug>): approve decomposition`) — and, under git, tag that commit `bet/<bet-slug>/approved`. That commit and tag are the user's signature on the agreed front-door cases — the integrity anchor the rest of the bet keeps honest. The readiness gate (`groundwork-review/checklists/implementation-readiness.md`) blocks delivery without the tag; it is the sealed baseline that delivery's prose-integrity reconciliation holds the prose to.

The anchor leaves a trail, and the trail is lightweight. **Steering how slices break down is free and needs no record** — adjusting the path to a milestone as delivery teaches you is the plan working as intended. **Changing what a milestone proves** — editing or dropping an agreed front-door case — is an owner-approved move recorded beside the prose: amend the affected `index.md` or slice file and commit it with a message that says what changed and why (`bet(<bet-slug>): amend milestone <N> proof — <reason>`), so a later context (a resumed delivery, a validator) can see it. Authoring a later milestone's slices on arrival, and adding a new rung when a postmortem reveals the ladder is missing one, are the same kind of recorded, additive event. There is no seal to break and no ceremony to run — the record is the commit history of the decomposition tree, and Delivery's prose-integrity check reconciles each built test against the current approved prose it traces to. (This holds whether or not the project is under git: the standing rule is that every built test still proves what its slice's Proof-of-work prose describes, and a change to that prose is a recorded amendment, not a quiet edit.)

➡️ Read and follow: `.groundwork/skills/groundwork-bet/workflows/04-delivery.md`
