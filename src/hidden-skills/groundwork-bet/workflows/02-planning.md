# Phase 2: Planning (Technical Design & TDD Proof of Work)

**Goal:** Produce two planning artifacts before any implementation begins: a Technical Design Document that captures the full design of this bet across all phases, and a TDD checklist that specifies what must be built and tested in each phase.

## Restrictions
⚠️ **CRITICAL CONSTRAINT:** You are FORBIDDEN from writing implementation code during this phase. You may only write tests, API contracts, schemas, and design documentation.

## Operating Contract

Standard assistant behaviour — covering too much ground per turn, rushing to draft before the conversation has earned its conclusions, and treating documents as static after committing them — undermines collaborative design. These are the failure modes this process is built to prevent.

The shared operating contract at `.agents/groundwork/skills/operating-contract.md` defines how to manage conversational pacing, discovery notes, living documents, and phase lifecycles. Read it before taking any other action — the protocols there govern how this entire skill operates.

## Discovery Notes Check

Check if `.groundwork/cache/discovery-notes.md` exists and has entries under `## Design Details`.

If entries exist, treat them as pre-discovered context — implementation decisions parked during the architecture phase that this planning step is responsible for translating into contracts and tests. Carry them into the relevant phases. After incorporating a `## Design Details` entry, remove it from the notes file so it is not re-applied to a future bet.

If the file does not exist or has no `## Design Details` entries, skip this step.

## Step 1: Update pitch status

Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: planning`.

## Step 1.5: Reconcile domain entities

Read `docs/domain/` if it exists. Identify whether this bet introduces any new domain entities or adds new lifecycle states to existing ones. This is the Living Documents protocol applied to `docs/domain/`.

- If the bet introduces a **new entity** (a noun a service will own that does not yet have a file in `docs/domain/`), create a stub at `docs/domain/<entity-name>.md` using the template at `.agents/groundwork/skills/templates/domain-entity.md`. Fill in what the bet already implies — ownership, core fields, and lifecycle states as far as they are known. Stubs are explicitly incomplete.
- If the bet adds **new lifecycle states** to an existing entity, update the relevant `docs/domain/<entity-name>.md` file in place.

Confirm any domain doc changes with the user before proceeding to Step 2. Skip this step entirely if the bet introduces no new entities or state transitions.

## Step 2: Draft the Technical Design Document

Read the pitch to identify all Milestones and their scope. Then draft `docs/bets/<bet-slug>/technical-design.md` using the template at `.agents/groundwork/skills/groundwork-bet/templates/technical-design.md`.

The Technical Design Document covers the **entire bet** — not per-milestone. Write it before the phase-by-phase breakdown. It has three sections:

**Data Flows:** Identify the key data paths this bet introduces or changes. For each path, describe what triggers it, which services handle it, what persists, and the key design decisions that shaped it. Skip trivial CRUD; focus on paths where timing, service boundaries, or failure modes are non-obvious.

**API Contracts:** For each service boundary touched by this bet, define the endpoints with request/response shapes and the reasoning behind each design decision. The goal is a document a developer can pick up during Delivery and make consistent implementation choices from — explain the why, not just the what.

**Design:** For each screen or interaction introduced by this bet, define the states it can be in, what triggers transitions, and what data drives each state. Reference `docs/design-system.md` for design system rules; do not repeat them here.

Write the draft to `docs/bets/<bet-slug>/technical-design.md`. This document is a commitment — it should reflect the actual design decisions, not a placeholder.

## Step 2.5: Independent Review of the Technical Design

The technical design is the contract delivery executes against. A silently invented constraint, a dropped capability from the pitch, or a contradiction against the upstream architecture compounds into every test in the TDD checklist and every line of implementation code. The review pass catches what the agent missed before the design hardens.

1. **Announce** the shift — the agent is moving from drafting into an independent review of the technical design before building the TDD checklist.
2. **Invoke the review subagent** with `document_path: docs/bets/<bet-slug>/technical-design.md` and `document_type: technical-design`. The subagent runs in an isolated context — via the `Task` tool in Claude Code or the `invoke_review` tool in the eval harness — and returns only `VERDICT: PRESENT | REVISE` and a findings list.
3. **Revise loop.** If the verdict is **REVISE**, apply every 🔴 Critical finding directly to the technical design — rewrite the affected sections rather than producing a list of suggestions. Write the revised technical design back to `docs/bets/<bet-slug>/technical-design.md` and run the review again. Repeat until the verdict is **PRESENT**.
4. **Carry advisory findings forward.** When the verdict is PRESENT, hold any 🟡 Advisory findings — they surface to the user during the final Proof of Work transition so the user can decide whether to act on them.

The TDD checklist does not need its own review pass — it is a test contract derived directly from the now-reviewed technical design, not a synthesis that introduces new claims.

## Step 3: Build the TDD checklist milestone by milestone

Read the template at `.agents/groundwork/skills/groundwork-bet/templates/tdd-checklist.md`. For **each Milestone in the pitch**, add a Milestone block to `docs/bets/<bet-slug>/tdd/checklist.md`. Work through all Milestones before presenting Proof of Work — do not stop after one.

For each Milestone:

1. **Criteria:** Write specific, testable Definition of Done statements. "Returns 200 with session_id on valid scenario" is acceptable. "Works correctly" is not.

2. **Service-Level Slices:** Identify which services this phase touches and what each one contributes. If a service is not changed by this phase, omit it from the table.

3. **Requirements:** List the structural components that must exist before the tests can pass — endpoints, database migrations, frontend components. These become the implementation checklist in the Delivery phase.

4. **Test Cases:** Write failing integration tests in `docs/bets/<bet-slug>/tdd/test_milestone<N>_<slug>.py`. Each test must fail immediately because the implementation does not exist yet. List each test method in the checklist under its milestone. Tests must be bound to the API contracts defined in Step 2.

After writing tests for a milestone, update the checklist with the test file paths before moving to the next milestone.

## Gate — All Phases Required

Before presenting Proof of Work, verify:

- Every Milestone from the pitch has a corresponding Milestone block in `docs/bets/<bet-slug>/tdd/checklist.md`.
- Each Milestone block has non-empty Criteria, Service-Level Slices, Requirements, and Test Cases sections.
- A test file exists in `docs/bets/<bet-slug>/tdd/` for each milestone.
- `docs/bets/<bet-slug>/technical-design.md` is complete (all three sections populated).

If any milestone is missing or incomplete, finish it before proceeding. A partial checklist is not Proof of Work.

## Transition

Once all phases are complete and the gate is satisfied, present both documents to the user as Proof of Work:

- `docs/bets/<bet-slug>/technical-design.md` — the design contract for the whole bet
- `docs/bets/<bet-slug>/tdd/checklist.md` — the implementation boundary for every phase

Ask for their approval to move to implementation.

If they agree, read and follow: `.agents/groundwork/skills/groundwork-bet/workflows/03-delivery.md`
