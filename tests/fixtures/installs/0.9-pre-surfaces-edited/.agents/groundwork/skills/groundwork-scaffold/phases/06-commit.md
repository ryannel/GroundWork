# Phase 6: Commit

Execute only after explicit user approval from Phase 5. Follow Protocol 3.4 of the Operating Contract.

1. **Verify the summary headers.** Confirm `docs/infrastructure.md` and `docs/maturity.md` open with a `## Summary for Downstream` section. Add a one-line `llms.txt` entry for each newly created doc, `docs/maturity.md` included. For the infrastructure doc, the summary is populated per Protocol 5 — Key Decisions (the ports, the boot command, the test command, the database schema model), Binding Constraints (anything MVP Planning must respect: env var requirements, manual verification gaps), Deferred Questions, Out of Scope. If missing, apply `groundwork-writer` to add it before continuing.

2. **Write the hand-off file.** Copy `.agents/groundwork/skills/templates/handoff.md` to `.groundwork/cache/handoff/scaffold.md` and fill in only the sections that have content: rejected generator parameters or service-name choices, deferred verification steps if execution tools were unavailable, user instincts about future infrastructure (CI/CD, observability) not yet scaffolded, and any other context MVP Planning needs to understand the running system. Omit empty sections.

3. **Clean up caches.** Remove the scaffold cache and the consumed previous hand-off: `run_command("rm -f .groundwork/cache/scaffold-cache.md .groundwork/cache/handoff/architecture.md")`. Cache Isolation (Protocol 7) requires the previous hand-off to be deleted once consumed.

4. Apply the Living Documents protocol — scan the conversation for insights that refine any existing `docs/` artifact. Apply surgical updates and refresh affected summary headers. Report what changed. **Scaffold-time vendor/language/topology changes are reversals** (Protocol 2): reconcile the architecture body and every dependent doc — domain entities, service docs, infrastructure — write the superseding ADR, and re-invoke `groundwork-review` on each mutated doc before committing. Because this reversal supersedes ADRs, re-review **every** `docs/domain/*.md` (`document_type: domain-entity`), not only the ones you remembered to edit — these stubs carry no summary and are the dependents most often left stale. Do not leave the architecture body or domain docs describing the design you replaced.

5. Update discovery notes — scan for out-of-phase signals not captured in real time. Append new signals to `.groundwork/cache/discovery-notes.md`. Remove entries incorporated into the committed artifact or the hand-off file.

6. Confirm that the phase is complete.

7. Recommend a fresh context for the next phase — a clean context gives the next skill full working memory.

8. Immediately load and execute the `groundwork-orchestrator` skill to proceed to MVP Planning. Do not ask the user to invoke it.
