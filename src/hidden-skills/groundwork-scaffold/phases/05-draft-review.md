# Phase 5: Draft & Review

Once the system is verified (or verification is documented as pending):

1. **Draft.** Write `docs/infrastructure.md` following the quality standard in the entry `instructions.md`. Apply the `groundwork-writer` skill: declarative, active voice, no hedging. Record the actual ports, commands, and verification results — not what they should be in theory. Include the **What `./dev start` does** section: one row per managed unit (container, native app-service, or registered runner) with its run mode and boot command, derived from the final `docker-compose.yml` + `.dev/dev.config.json`. The set must match `./dev status --json` (its `docker`/`native`/`runners` arrays) — if you cannot make the doc and the CLI agree, the gap is a reconciliation failure to fix in Phase 4, not to describe around.

   When `scaffold-cache.md` records verification as pending (Phase 4 was skipped), open the document body with a `## Verification Status` section stating that the system was not booted and that the ports, commands, and health checks below are derived from generated configuration, not observed from a running system, so the reader must run the Phase 4 verification steps before relying on them. Two to three sentences is enough — the point is that no reader can mistake an unverified scaffold for a verified one. Omit the section entirely when verification ran green; the `## Verification` results section covers that case.

1b. **Draft `docs/maturity.md`.** Read the maturity model at `.groundwork/skills/maturity-model.md` and write the initial assessment from the template at `.groundwork/skills/templates/maturity.md`. A freshly scaffolded project scores ✅ on most dimensions — cite the evidence this phase just produced (booted stack, generated harness, registered Serena, a code map regenerable via `npx groundwork-method repo-map`). Open roadmap rows for what scaffolding cannot wire: D6 (CI does not yet invoke `groundwork check`) and any dimension verification left pending. Seed `## History` with one line. This doc is how the project tracks regressions against the target state it was born at.

2. **Review.** Announce that the review process is starting, then invoke the review subagent (Protocol 9) once per document: `document_path: docs/infrastructure.md` with `document_type: infrastructure`, and `document_path: docs/maturity.md` with `document_type: maturity`. Report the verdict and any findings before proceeding. The gate is fail-closed (Protocol 8): proceed only on a parseable `VERDICT: PRESENT` for each; a review that errors, hangs, or returns no verdict follows Protocol 9's failure path.

3. **Revise loop.** If the verdict is **REVISE**, apply all 🔴 Critical findings directly to the document. Re-run the review. Repeat until the verdict is **PRESENT**. After 3 REVISE verdicts, apply the revise cap defined in Protocol 8.

4. **Present.** Once the verdict is PRESENT, output the final document in full in the chat. Surface any 🟡 Advisory findings so the user can decide whether to act on them.

5. Ask the user whether to save as-is or refine anything first. Proceed to Phase 6 only on explicit approval.
