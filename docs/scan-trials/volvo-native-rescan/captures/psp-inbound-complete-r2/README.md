# PSP inbound source capture

The full source pass is independently reviewed at `ae1d9ddfb34dae71c15913e9f28d41321d66266a`: 104 files
reconciled, 28 production Java files, 84 method declarations with 79 bodies and 17 lambdas. The 101 native frames
include 96 body frames and 5 declaration/opaque boundaries. There are 10,715 records and 636 verified source ranges.

Native POST and heartbeat roots positively show the actual Kafka sends, their source arguments and separate
future callbacks. Independent POST-invocation queries follow topic, key and message values in their actual
call context without budgets hit. Message key uses constructed metadata.id; heartbeat uses epoch-millisecond
text and literal null. Neither send waits for broker delivery; a future callback is not a subscription.
There are no local store writes or consumers. Configured Mongo/CloudConfig/OTLP components are labelled
usage-unverified and have no invented runtime calls.

Source review checked controller parameter precedence, connected/platform secret selection, raw Stripe
signature parsing, source-event filtering, message-key switch/fallbacks, envelope/metadata construction,
IP filter/startup and advice. Committed IP settings are a YAML sequence while startup requests LinkedHashMap;
this is a source configuration compatibility gap, not a claim that deployed startup failed. Framework
activation/order, imported SDK/parser/serializer behaviour, effective configuration and callback scheduling
remain unresolved. A callback root does not invent runtime capture origins.

Acceptance retains 164 entry queries, 179 method/binding queries, 26 source field/value/destination queries and
39 positive/negative checks, all without budgets hit. Actual local config/Optional/mapper calls do not add
network edges. Earlier bounded execution summaries are absent from this replacement, so old graph edges
cannot satisfy its current-source acceptance.

[Bundle](bundle.json), [snapshot](snapshot.json), [source report](source-report.md), [handoff](HANDOFF.md),
ledgers and compressed query evidence preserve the result. Snapshot:
`eaaef2ed0e7238cf7ed324b9812017073b02716f3020b53e04be8aa5b9bca64a`.
No source app build/test, fetch, live endpoint/store/broker or production workspace/scan-mark change occurred.
