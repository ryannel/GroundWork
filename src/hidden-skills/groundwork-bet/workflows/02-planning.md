# Phase 2: Planning (Technical Design & TDD Proof of Work)

**Goal:** Produce two planning artifacts before any implementation begins: a Technical Design Document that captures the full design of this bet across all phases, and a TDD checklist that specifies what must be built and tested in each phase.

## Restrictions
⚠️ **CRITICAL CONSTRAINT:** You are FORBIDDEN from writing implementation code during this phase. You may only write tests, API contracts, schemas, and design documentation.

## Operating Contract

**Before proceeding, load and apply all protocols from `.agents/groundwork/skills/operating-contract.md`.** Planning surfaces implementation details — async flows, callback patterns, contract format choices — that may belong to other phases. Capture those signals under the appropriate section in `.groundwork/cache/discovery-notes.md` as they arise.

## Discovery Notes Check

Check if `.groundwork/cache/discovery-notes.md` exists and has entries under `## Design Details`.

If entries exist, treat them as pre-discovered context — implementation decisions parked during the architecture phase that this planning step is responsible for translating into contracts and tests. Carry them into the relevant phases. After incorporating a `## Design Details` entry, remove it from the notes file so it is not re-applied to a future bet.

If the file does not exist or has no `## Design Details` entries, skip this step.

## Step 1: Update pitch status

Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: planning`.

## Step 2: Draft the Technical Design Document

Read the pitch to identify all Milestones and their scope. Then draft `docs/bets/<bet-slug>/technical-design.md` using the template at `.agents/groundwork/skills/groundwork-bet/templates/technical-design.md`.

The Technical Design Document covers the **entire bet** — not per-milestone. Write it before the phase-by-phase breakdown. It has three sections:

**Data Flows:** Identify the key data paths this bet introduces or changes. For each path, describe what triggers it, which services handle it, what persists, and the key design decisions that shaped it. Skip trivial CRUD; focus on paths where timing, service boundaries, or failure modes are non-obvious.

**API Contracts:** For each service boundary touched by this bet, define the endpoints with request/response shapes and the reasoning behind each design decision. The goal is a document a developer can pick up during Delivery and make consistent implementation choices from — explain the why, not just the what.

**UX Design:** For each screen or interaction introduced by this bet, define the states it can be in, what triggers transitions, and what data drives each state. Reference `docs/ux-design.md` for design system rules; do not repeat them here.

Write the draft to `docs/bets/<bet-slug>/technical-design.md`. This document is a commitment — it should reflect the actual design decisions, not a placeholder.

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
