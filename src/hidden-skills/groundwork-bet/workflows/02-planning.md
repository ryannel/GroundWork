# Phase 2: Planning (Stories & TDD Proof of Work)

**Goal:** Translate the user-value Epics into structural contracts and Tests-Up-Front (TDD) that act as Proof of Work.

## Restrictions
⚠️ **CRITICAL CONSTRAINT:** You are FORBIDDEN from writing implementation code during this phase. You may only write tests, API signatures, database schemas, and documentation.

## Instructions

1. Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: planning`.
2. For each Epic defined in the Pitch, break it down into developer **Stories**. A story is a specific vertical slice that can be implemented and tested.
3. For each Story, perform the **Tests-Up-Front** protocol:
   - **API Schema First:** If inter-service communication is required, locate the service's OpenAPI schema (or equivalent). Add the new endpoints/models to the schema and run the repository's client generation script. You cannot write backend implementation code yet.
   - **Tests:** Create a specific test file (e.g., `tests/integration/test_<feature>.py`) containing the failing tests that verify the story's acceptance criteria. Bind these tests to the newly generated API clients.
   - **Database:** If a schema change is required, define the migration.
   - **UI:** If UI is required, define the UI states and data bindings.
4. Populate a TDD checklist mapping out these structural components. Read the template at `.agents/groundwork/skills/groundwork-bet/templates/tdd-checklist.md` and save the filled version to `docs/bets/<bet-slug>/tdd/checklist.md`.

## Transition

Once the Tests-Up-Front are written and the TDD checklist is complete, present the failing test suite and structural contracts to the user as Proof of Work.

Ask for their approval to move to implementation.

If they agree, read and follow: `.agents/groundwork/skills/groundwork-bet/workflows/03-delivery.md`
