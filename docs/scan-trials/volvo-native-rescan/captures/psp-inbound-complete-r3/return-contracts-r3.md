# Source return contracts

Immutable successor `bundle.final-r3.json` + `snapshot.final-r3.json`, snapshot `1b0d1a29545f67f31cc7f7eaf8f4a5c0d31f29568adde0f94697275af4b6a56c`. Prior r2 bundle and manifest are preserved.

Pinned declarations establish 84 return signatures. 4 invented void-call values and dependent false flows/derivations are removed. 6 local constructors now have void call results and separate allocation/new-expression values, with normal completion between them. Source actual parameters, receivers, captures, mutations, exceptions, non-void results and async handles remain. Transaction expression lambdas calling known void methods also have void contracts.

Native/source validation passes. `return-acceptance-r3/acceptance.json` checks every known void/constructor contract and representative true parameter/capture/allocation lineage. The 39 source assertions and 26 queries in `source-acceptance-final-r3` retain native webhook/heartbeat→Kafka positives, actual field/message schemas, receiver/capture/formal bindings and separate deferred callbacks. All 164 entry queries complete without limits. Legacy workspace alias `volvo` remains intentionally preserved for parent explicit combined-ingestion normalisation.

Original source ledgers and earlier acceptance packs remain tied to their original selection. Translate record IDs through the exact `changed` map in the adjacent correction JSON when using those ledgers with this successor; deleted false facts are listed separately. No source build/test, network fetch or live call was run.
