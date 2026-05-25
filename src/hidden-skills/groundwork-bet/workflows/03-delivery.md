# Phase 3: Delivery (The Slice)

**Goal:** Write the implementation code safely within the boundaries of the established Tests-Up-Front.

## Restrictions
⚠️ **CRITICAL CONSTRAINT:** You are strictly constrained to *only* write the code required to make the tests pass and satisfy the structural contracts defined in the Planning phase. If you discover a fundamental flaw in the contracts, you must pause, revert to Phase 2 (Planning), update the tests/contracts, and get user approval before returning to Delivery.

## Operating Contract

**The protocols from `.agents/groundwork/skills/operating-contract.md` remain in force during delivery.** Implementation rarely surfaces phase-crossing signals because the planning phase did that work — but when it does (a constraint that contradicts an upstream document, a discovery about an existing service the architecture did not capture), capture it under the matching section in `.groundwork/cache/discovery-notes.md` and continue. The full Living Documents scan happens in Phase 4 (Validation) — no need to interrupt delivery to apply upstream updates mid-flight.

## Instructions

1. Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: delivery`.
2. Inform the user you are entering "Developer Mode".
3. Iterate on the implementation code:
   - Run the tests written in Phase 2.
   - Implement the logic to make the tests pass.
   - **Enforce Contracts:** When writing cross-service communication logic, you MUST use the API clients generated in the Planning phase. Manually constructing HTTP requests or defining raw payload structures is forbidden.
   - Update the `docs/bets/<bet-slug>/tdd/checklist.md` as individual components are implemented and tested.
4. Do not perform large refactors or touch unrelated subsystems. Stay focused on the active Milestones and Slices.

## Transition

Once all tests pass and the checklist is fully checked off, you are ready for validation.

Read and follow: `.agents/groundwork/skills/groundwork-bet/workflows/04-validation.md`
