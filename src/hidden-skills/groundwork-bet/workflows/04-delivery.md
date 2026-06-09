# Phase 4: Delivery

**Goal:** Turn bet-progress tests green, slice by slice, while rolling out permanent best-practice tests as each slice completes.

## Restrictions

⚠️ **CRITICAL CONSTRAINT:** Write only the code required to make the bet-progress tests pass and satisfy the contracts established in the Design phase. If you discover a fundamental flaw in the contracts, pause, revert to Phase 2 (Design), update the tests and contracts, and get user approval before returning to Delivery. Do not perform large refactors or touch unrelated subsystems.

## Operating Contract

This workflow operates under the protocols defined in `.agents/groundwork/skills/operating-contract.md` (Continuous Bet mode). Implementation rarely surfaces phase-crossing signals — but when it does, capture it under the matching section in `.groundwork/cache/discovery-notes.md` and continue. The full Living Documents scan happens in Validation (Phase 5). Do not interrupt delivery to apply upstream updates mid-flight.

## Step 0: Implementation Readiness Gate

Before any slice work, verify the bet is actually executable. Load `.agents/groundwork/skills/groundwork-review/checklists/implementation-readiness.md` and check every item against the bet's artifacts — the document chain, the contracts, the test scaffolding, and currency. These are mechanical existence and consistency checks; run them inline (no review subagent — the artifacts were already authorship-gated when their phases committed them, and there is nothing here to be biased about).

The gate is fail-closed: any 🔴 item blocks delivery. Report each failed item by name with what is missing, route back to the owning phase (a missing contract → Design Foundations; missing tests → Decomposition; an unreconciled discovery note → resolve it with the user now), and do not begin implementation until the item passes. 🟡 items are surfaced to the user with your read on whether they touch this bet; the user decides whether to proceed.

When every 🔴 item passes, state so in one line and proceed.

## Instructions

1. Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: delivery`.
2. Inform the user you are entering "Developer Mode".
3. Iterate slice by slice, working through the milestone order established in `docs/bets/<bet-slug>/decomposition.md`:
   - Run the active slice's bet-progress tests (`tests/bets/<bet-slug>/test_slice_<n>_*`). They start red — implementation does not exist yet.
   - Implement the logic to make the slice's tests pass.
   - **Enforce Contracts:** When writing cross-service communication logic, use the API contracts established in Design Foundations as the implementation spec. All service APIs introduced or changed by this bet must be fully documented in machine-readable format (OpenAPI, protobuf, or AsyncAPI) before the bet closes — clients must be generated from this documentation. An API that is not documented in machine-readable format by delivery close is not complete.
   - Once a slice's bet-progress tests are green, roll out that slice's **permanent best-practice tests** — interface tests, HTTP API system tests, honeycomb service-perimeter tests, and unit tests for complex logic, per the project's testing strategy. These live in the service repos and `tests/system/`, not in `tests/bets/`. They are permanent and stay in the codebase after the bet is archived.
   - After all slices for a milestone are green, run the milestone's bet-progress tests (`tests/bets/<bet-slug>/test_milestone_<n>_*`) to confirm the full user-visible outcome is proven.
4. Stay focused on the active Milestones and Slices defined in `decomposition.md`. Do not introduce scope not covered by the decomposition.

## Transition

Once all bet-progress tests are green and the permanent best-practice tests for every slice are in place, you are ready for validation.

Read and follow: `.agents/groundwork/skills/groundwork-bet/workflows/05-validation.md`
