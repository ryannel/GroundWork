# Active return-contract successor

Selected `bundle.final-r3.json` + `snapshot.final-r3.json`, snapshot `1b0d1a29545f67f31cc7f7eaf8f4a5c0d31f29568adde0f94697275af4b6a56c`. Read `return-contracts-r3.md` and the exact ID translation in `return-contracts-r3.json`. Earlier source ledgers are unchanged and apply through that translation. Runtime/source-review limits remain as documented.

# PSP Inbound handoff

Final pair: `bundle.final-r2.json` + `snapshot.final-r2.json`.
Snapshot: `eaaef2ed0e7238cf7ed324b9812017073b02716f3020b53e04be8aa5b9bca64a`.
Pinned source: `volvo-cars/cds-paymentservice-psp-inbound@ae1d9ddfb34dae71c15913e9f28d41321d66266a`.

Source review is complete: 104 files reconciled, 28 production Java files, 84 declarations/79 method bodies,
17 lambdas: 96 body frames, and 101 native frames including five declaration/opaque frames. Native validation: 10,715 records, 636 pinned ranges. Acceptance: 164
all-entry queries, 179 method/binding queries, 26 source field/value/destination queries, 39 assertions;
no node/record budgets hit and every method owned-record query closes.

Read README.md and report/ledger JSON. The positive native component checks cover POST→internal Kafka and
schedule→heartbeat Kafka with exact actual arguments; negative checks exclude local helper network edges.
Future callbacks are separate source entries and associations, with unresolved capture origins at an isolated
callback root. Filter/dispatcher/SDK/framework/deployment/wire and automatic heap-feasibility limits remain
explicit. Base YAML ip-addresses sequence versus LinkedHashMap.class cast is a concrete compatibility gap.

The earlier three-bundle reviewed selection and draft r1 query checkpoint remain unchanged. No network,
source application tests/builds, live runtime calls or workspace scan-mark changes occurred.
