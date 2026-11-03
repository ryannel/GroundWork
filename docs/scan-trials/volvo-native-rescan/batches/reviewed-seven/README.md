# Reviewed seven-repository selection

This immutable selection reconciles Transaction deep, Manage and Segment deep, Assortment, reviewed PSP
Integration, reviewed Customer, PSP Inbound and Scheduler. It contains **15,736 records** after deduplicating
602 identical canonical records shared by the soft-offer captures. `inputs.json` records all seven source
selections and their exact bundle digests. Conflicting IDs fail reconciliation; names, ownership and nearby
package versions do not establish equivalence or an implementation match.

Snapshot: `aebbd97f92a319076fa3af075f20b1943e9d0e97959f9f248c28b25b25a1d8cc`.

All **120** saved requests replay against this single snapshot. Their nodes and edges are identical to the
corresponding per-repository results after ignoring collection order; no historical fixture was silently
skipped. Node/support budgets remain enforced. `query-replay.json` records the comparisons. Per-repository
source assertions and detailed acceptance reports are retained under `../../captures/`. This replay is a
represented-graph regression check, not a claim of complete behaviour or a production latency budget.

The generic validator passed schema, semantic closure, manifest digests and **4,318 pinned source ranges**.
Those checks establish available files and range bounds, not evidence entailment or deployment. Independent
bounded source review additionally checked response wrappers, local-module authority, representative method
frames and six repository/UoW write associations. Captures retain partial coverage and explicit frontiers.

```sh
npm run knowledge:validate -- docs/scan-trials/volvo-native-rescan/batches/reviewed-seven/bundle.json --snapshot docs/scan-trials/volvo-native-rescan/batches/reviewed-seven/snapshot.json --sources /Users/RNEL/.cache/groundwork/clones
```

Use this combined bundle/manifest for cross-capture queries, or select one matching per-repository capture.
Do not combine the earlier and replacement namespaces for the same repository as active routes. The
original selections remain available for history. The SQLite index is a disposable projection.
