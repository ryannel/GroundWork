# Payment transaction source capture

This reviewed successor captures `020d2fabb141b47b6d1e8173c02405795f71613a`: 56,280 records, 168 production
Java files and 480 method/lambda frames. Independent pinned validation checked all 4,417 source ranges.
It retains the r4 payload/destination corrections and clarifies conditional repository method-reference calls.
All 43 native I/O edges are audited by exact source receiver/target, with 39 source-owner interaction queries.
The two Optional.flatMap callbacks really invoke repository reads; the later local update callbacks are separate.

Capture's actual PSP construction has attributes, psp, countryCode, pspTransactionId and accountId; no amount.
Create, retry and refund constructions retain actual nested fields. PSP and retry scheduler are source-configured
components. Imported SDK wire placement, deployed routing and unknown formatters remain explicit boundaries.
No imported configuration helper is invented as another network service.

Acceptance includes 185 entry/value/write queries, 37 representative method queries, 17 payload queries and
19 semantic checks. The largest create-route views and one representative method retain node-budget limits;
smaller method/payload views and paginated records remain available. Source inspection is complete locally;
heap feasibility, dependency/runtime behaviour and scheduling are not proved.

[Bundle](bundle.json), [snapshot](snapshot.json), [source report](source-report.md), [handoff](HANDOFF.md),
ledgers and compressed query evidence preserve the result. Snapshot:
`9d0a63b6ca64b19212019fab88daf56965ac16d3c46dfc8b1cd6765c0b7b2475`.
Earlier captures remain available. No source app build/test, fetch, live endpoint/store/broker or production
workspace/scan-mark change occurred. The combined seven-repository selection is still awaiting reconciliation.
