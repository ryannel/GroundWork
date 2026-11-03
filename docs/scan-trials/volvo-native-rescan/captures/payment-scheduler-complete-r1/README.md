# Payment Scheduler source capture

Selected snapshot `c928e6c2ac32cd9acf39877d95d4e6b0f4081d2066a120c42a7a9d281752a5df` with **27,184 records**.

The complete pinned-source pass covers 71 production Java files, 147 method/declaration/lambda frames, 13 entries and 15 native I/O associations. Root independently inspected the full polling, registration, retry, mapping, locking, client, producer, configuration and strategy bodies. Eight independent root queries positively check registration to Mongo, poll to Mongo and payment API, notification to Kafka, actual topic/key/payload values and lock deletion.

Five typed writes distinguish three unknown save policies from explicit insert/delete. Normal return does not prove affected rows or durability. Source lock acquisition precedes its protected try; refresh/release failures are retained. RetryJobMapper.toEntity omits retryStrategy even though the persisted type declares it. Actual remote retry takes one paymentSessionId argument, not an invented body. Notification keys come from stored job params while payload IDs come from the response.

Acceptance contains 190 entry queries, 278 method/binding queries and 81 source assertions with 49 targeted queries. Fourteen broad poll views retain node limits, including root's broad poll query. A smaller actual notification implementation query positively reaches Kafka; a truncated poll view is never evidence of no publication. Imported transport, cron dialect compatibility, source-store conversion and runtime lock/index guarantees remain explicit gaps.

[Bundle](bundle.json), [snapshot](snapshot.json), [handoff](HANDOFF.md) and compressed query evidence retain the reviewed selection. Original sealed inputs and predecessors remain immutable. Published JSON may be reformatted with parsed-data equality checked; source seals retain original-path byte digests. Any predecessor ledgers are provenance, not a claim that their old IDs select the current revision.

No production app/workspace migration, source application build/test, fetch or live endpoint/store/broker call was performed. Source-local completeness is separate from runtime or formal control/data-flow proof.
