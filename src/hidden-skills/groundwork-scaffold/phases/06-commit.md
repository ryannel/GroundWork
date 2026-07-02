# Phase 6: Commit

Execute only after explicit user approval from Phase 5. Follow Protocol 3.4 of the Operating Contract.

1. **Write the Downstream Context file (Protocol 5).** The published docs (`docs/architecture/infrastructure.md`, the `docs/getting-started/` set, `docs/maturity.md`) carry no summary section — they are clean reference documentation. Apply `groundwork-writer` to write `.groundwork/context/scaffold.md` — the four-subsection contract per Protocol 5: Key Decisions (the ports, the boot command, the test command, the database schema model), Binding Constraints (anything MVP Planning must respect: env var requirements, manual verification gaps), Deferred Questions, Out of Scope.

2. **Write the hand-off file.** Copy `.groundwork/skills/templates/handoff.md` to `.groundwork/cache/handoff/scaffold.md` and fill in only the sections that have content: rejected generator parameters or service-name choices, deferred verification steps if execution tools were unavailable, user instincts about future infrastructure (CI/CD, observability) not yet scaffolded, and any other context MVP Planning needs to understand the running system. Omit empty sections. **If a stack was forged this phase** (the scaffold cache carries a `## Forged Stack Checklist` from `groundwork-stack-forge`), copy that checklist into the hand-off so MVP scopes the to-be-built Day-2 items into the first bets — it is the seed's path from skeleton to a full Day-2 app.

3. **Register the new docs.** Add a one-line `llms.txt` entry for each doc this phase created — the `docs/getting-started/` set and `docs/maturity.md`.

4. **Clean up caches.** Mark the Commit phase complete in `scaffold-cache.md`, then remove the scaffold cache and the consumed previous hand-off: `run_command("rm -f .groundwork/cache/scaffold-cache.md .groundwork/cache/handoff/architecture.md")`. Cache Isolation (Protocol 7) requires the previous hand-off to be deleted once consumed.

5. Apply the Living Documents protocol (Protocol 3.4 step 5). **Scaffold-time vendor/language/topology changes are reversals** (Protocol 2): reconcile the architecture body and every dependent doc — domain entities, service docs, infrastructure — write the superseding ADR, and re-invoke `groundwork-review` on each mutated doc before committing. Because this reversal supersedes ADRs, re-review **every** `docs/architecture/domain/*.md` (`document_type: domain-entity`), not only the ones you remembered to edit — these stubs carry no summary and are the dependents most often left stale. Do not leave the architecture body or domain docs describing the design you replaced.

6. Then complete Protocol 3.4 steps 6–9: the discovery-notes sweep, confirm, the fresh-context recommendation, and the orchestrator hand-off to MVP Planning.
