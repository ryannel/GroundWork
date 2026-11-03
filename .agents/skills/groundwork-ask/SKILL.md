---
name: groundwork-ask
description: Answer questions about mapped company systems using Groundwork evidence and cited code, with freshness, gaps and labelled interpretations.
---

# Answer from Groundwork evidence

For workspace-backed questions, first run `npm run --silent workspace -- list --json` in the Groundwork checkout.
Resolve the name, id and folder there, not by searching `workspaces/`; see [workspace discovery](../README.md#find-the-workspace-first).

Answer the question from the selected map or capture, then inspect cited source where the answer needs
more detail. Keep the explanation useful to a newcomer and distinguish what is observed, inferred or unknown.

## Select the evidence

For a workspace question, start with `MAP.md` or `npm run map` to locate the repository and records.
Read [legacy map lookup](legacy-map.md) for its query commands, file layout and scan marks. For an explicitly
supplied question-led capture, start with its metadata, entry catalogue and existing bounded query pages;
these are not yet loaded by the production map. Use the
[repository query workflow](../../../docs/scan-trials/scan-readiness/README.md) only within the question's
authorised source scope. A partial capture cannot establish absence.

Use record IDs and commit-pinned source ranges to follow relevant calls, contracts and data. Inspect the
cited code when the selected evidence does not settle the question. Do not treat demo/seed data as source
proof or a candidate component/version as the deployed one.

## Explain meaning and freshness

For purpose, probable users, journeys and relationships, make the best informed guess from the evidence
and surrounding context already examined. Follow [interpretation](../groundwork-schema/interpretation.md):
lead with a useful **Inferred** answer, concise rationale and confidence, and retain its limitations. Intent
need not be provable to support a labelled interpretation; that interpretation is not a runtime guarantee.

State the source revision and relevant analysis freshness. A local reference or legacy scan mark cannot
establish current remote or deployed state. If source contradicts the map, explain the discrepancy and the
scope needing refresh. Lead with the answer, then material source links, freshness and unresolved questions.

## Feed gaps into the next scan

When a recurring missing answer exposes a tooling gap, retain its evidence and hand it to the next authorised
scan's [learning loop](../groundwork-scan/learning.md). A read-only question does not require scanner edits or
new repository scans. Preserve the stopped queue and keep useful current answers separate from maintenance.
