# CPAM ingress handoff

Select `bundle.final-r5.json` with `snapshot.final-r5.json`.
Snapshot: `9273eddda4c5fff911958b4a6b82143b69d166f1a50b66279bb19755660f27aa`.
Pin: `6db6ba2b9c76751a690ea9b0184b42e58412a09e`; workspace `volvo-cars`.

All author gates pass: native validation/seal; 18,713 verified evidence records / 9,115 unique tuples;
581 strict standard queries and 24 consumed support pages; 198 assertions across 63 strict source queries.
Independent root acceptance passed 83 queries. See `verification.final-r5.json`, `report.json`,
`query-final-r5/acceptance.json`, `source-final-r5/acceptance.json` and `source-verification.final-r5.json`.

The 160,947 records retain all 744 unique original bodies as 1,645 native frames, with 1,671 host execution
bindings. All `init` keys are file/offset-distinct, with a cardinality assertion. The Go app package imports
PCF through its aggregator file in every command; r3's additive bindings preserve this without invoking
aggregator business handlers in other hosts. Final-r5 retains that fix and uses fresh identities for the narrow
library-evaluation correction. Its two `BoolVariation` calls have null target/effect and exact per-call gaps;
configured flag purpose remains separately declared. No other source semantics were reauthored for that correction.

Coverage is repository-wide source review: 169 files; six REST routes; three programs; 21 startup bindings;
68 callbacks, including two subscriptions; 34 native interactions; six guarded storage writes. Source/config,
registration, body/control/value, source schema/construction, storage and asynchronous paths are reconciled
in the matching `*.final-r5.json` ledgers. There is no outstanding local source inspection.

Keep explicit limits: 31 standard views and four source views hit declared budgets; source/helper segments
retain positive actual boundaries. SDK/artifact/environment/deployment, channel scheduling, mutable state
versions, dynamic dispatch identity, wire codecs and effective committed-header status are not runtime proof.
Subscriptions retain exact `WithHandler` event-type intent with unresolved imported header routing; no
invented producer-to-consumer delivery guarantee. No application build/test or live calls were run.

R1/r2/r3 and invalid unselected r4 bytes remain preserved. Only final-r5 is selected. Saved baseline evidence
and the verified five-tuple delta make source verification replayable without treating a namespace move as
new evidence. The independent generator map-key audit is `generator-r5-aid-audit.json`; root owns its separate
successor, and this worker has not edited sealed generator files.

Next assigned repository is `volvo-cars/cce-optimization-api` at
`286985b6bebccb6123de78d03aa87b7513f69ed5`, including its exact offline protobuf gitlink correspondence.
