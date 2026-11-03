# Filter source capture handoff

Use only this pair for the current candidate:

- `/Users/RNEL/Workspace/groundWork/reports/volvo-native-rescan/cce-filter-service-complete/revision-003/bundle.json`
- `/Users/RNEL/Workspace/groundWork/reports/volvo-native-rescan/cce-filter-service-complete/revision-003/snapshot.json`

Snapshot `026b45380097c239e2511a7ce9186329c0af6e0a24ba7bf73beac41b6e39705f`; 60,208 records. Pin `2020ff59219b4d7bb9ad935fde361b2a6e857112`.

Read REPORT.md, sourcefile-completeness-ledger.json, body-signature-ledger.json, sql-column-lineage-ledger.json, subscription-ledger.json, write-acknowledgement-ledger.json, handoff-ledger.json, source-range-audit.json and query-replay/summary.json. Strict replay: 123 queries/123 pages, 17 explicit maxNodes frontiers. Exact actual I/O values beyond broad traversal are checked in query-replay/rooted-path-values.json. Native column/value queries for config_policy.payload pass. Eight handler registrations/one subscribe site/four topic settings are distinct from 32 derived conditional contexts.

Query replay command from repository root:
`node --import ./tools/register.ts --conditions=react-server reports/volvo-native-rescan/cce-filter-service-complete/revision-003/queries.mjs reports/volvo-native-rescan/cce-filter-service-complete/revision-003/ <fresh-output-directory>/`

Retain immutable source-local facts and explicit runtime/analysis gaps. Root independently reviews and selects/publishes; this author capture does not assert acceptance or deployment behaviour. Revision-001/002 and draft results are diagnostic history only.
