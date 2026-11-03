# CRM synchronizer handoff

Author gates pass; independent parent review/publication remains pending.

Selected immutable pair: `bundle.final-r1.json` + `snapshot.final-r1.json`.
Snapshot: `ec13e0709f41ee068bfb69c4a86d0bdc68b389a1738c642d6f5ca7b841cf065d`.
Pinned repository: `volvo-cars/cds-ecom-customer-crm-synchronizer@4ea3677cd5df3a19e0d0903d6c803c1413e6a2cd`.

149/149 blobs offline, no gitlinks. Complete finite review: 69 production Java files, 83 types, 124 declarations/117 bodies, 14 lambda bodies, seven abstract declarations. 138 source frames plus five opaque configured mounts =143 native frames. 38 test files yield 189 non-executed body assertions. All source/config/docs/support declarations classified; no source build/test/application/live/store/fetch activity.

12,206 records; 23 entries; nine real interactions (five HTTP terminal retrievals, three consumer callbacks, Kafka Admin health). No invented local store write or producer/DLQ. 160 source/caller/OpenAPI/partial imported shapes, 59 actual CDB setter operands, separate wrappers/projections and exact receiver/formal/capture values. Individual/corporate CDB changes precede customer PATCH and OM; partial remote effects have no compensation. Annotation security/retry and Kafka delivery activation remain source declarations, not eager Java calls.

Native + pinned-source validation: 1,422 ranges pass. Strict final-identity acceptance: 779 queries, 788 request/continuation pages, 1,386 assertions pass. Every query request/response/continuation validated; budgets maxNodes2000/maxRecords5000. Twenty-two broad sync queries explicitly remain bounded; exact owner and actual root/value positives pass. The proof pack includes actual REST/subscription roots, distinct Kafka groups, consumed String to selected customer ID, REST selector formals, real HTTP body construction and negative DB/producer/DLQ/unused setter results.

Read README/report/completeness ledger for source behaviours and exact limits. `validation-source.final-r1.log`, `acceptance.final-r1.log`, all `*.final-r1.json` ledgers and `query-final-r1/**` form the reviewed gates. `seal.final-r1.json` hashes the selected artefacts. Draft/prototype files are diagnostic only.

Replay:

```
GIT_NO_LAZY_FETCH=1 GIT_TERMINAL_PROMPT=0 node --import ./tools/register.ts --conditions=react-server tools/validate-knowledge.ts reports/volvo-native-rescan/cds-ecom-customer-crm-synchronizer-complete/bundle.final-r1.json --sources /Users/RNEL/.cache/groundwork/clones
node --import ./tools/register.ts --conditions=react-server reports/volvo-native-rescan/cds-ecom-customer-crm-synchronizer-complete/acceptance.mjs bundle.final-r1.json query-review
```

Do not overwrite the selected pair or matched ledgers. A correction needs a fresh namespace/successor. No global scan state or publication was edited. Next repository is assigned by root after acceptance.
