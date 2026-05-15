# Phase 4: Validation (Testing & Handoff)

**Goal:** Verify the implementation and merge the temporary bet context back into the global architecture.

## Instructions

1. Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: validation`.
2. Perform a final execution of the test suite. Ensure 100% pass rate for the tests introduced during this bet.
   - **Contract Verification:** Confirm that the test suite successfully utilized the generated API clients and that no manual schema definitions or rogue HTTP calls were introduced during delivery.
3. Review the code changes with the user. Provide a summary of the delivery.
4. **Handoff to Maintenance:** The architecture of the system has now changed. We must merge the local bet documentation (the API contracts, DB schemas) into the global system documentation.
   - Advise the user that you are handing off to the `groundwork-update` skill.
   - Run the equivalent of a doc update to ensure `docs/architecture/` correctly reflects the newly added capabilities.
5. Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: delivered`.
6. Congratulate the user on a successful bet!
