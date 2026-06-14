# Data Architecture

Data outlives services. Services are replaced; the data contracts you set today — table shapes, event payloads, field semantics — are the single most durable thing the system produces. Getting a contract right once is cheap; changing it retroactively after the data has multiplied is brutal. Treat every event you emit and every table you own as a long-term contract shaped so downstream consumers — today and in three years — can work with it without archaeology.

## The design decisions

1. **Events are append-only and immutable.** Once emitted, an event is never rewritten. Correction happens through compensating events, not mutation of the original. This is what lets downstream consumers trust the event log as a truthful history.
2. **Schemas are versioned and evolvable.** Event payloads carry explicit versions. New fields are additive; removed fields are deprecated with a deadline, not dropped silently. Consumers can detect an old schema and handle or refuse it — never surprised.
3. **Partition keys are chosen deliberately.** Topics partition by the identifier that matters for ordering — typically the primary entity's ID — so all events for one entity flow through a single partition in sequence. A casual partition-key choice is one of the most expensive mistakes in a data system; treat it as a reviewed design decision.
4. **CQRS where it pays.** For read-heavy surfaces with complex projections, separate the read model (owns query performance) from the write model (owns truth). Do not apply it universally — only where read and write loads have genuinely different shapes.
5. **Event sourcing is a tool, not a religion.** Where the history of change is itself the product (audit logs, participation timelines), store the event log as primary and derive current state. Where current state is what matters, store current state and publish events as derivatives. Event-sourcing every table "because it is purer" is overengineering.
6. **Data contracts are documented, versioned, and owned.** Every significant table and published event has an owner, a documented schema, a migration history, and a compatibility policy. Unowned tables and undocumented events are a ticking integration-debt clock.
7. **Retention is a design decision.** Every dataset has a retention policy decided at creation — deletion after N days, archival after M, live forever — reviewed when the regulatory surface changes and enforced by automation. "We'll figure it out later" becomes a compliance incident three years on.
8. **Backfills are a planned operation.** Reshaping historical data is a project with a plan, a rollback, and a measurement — rehearsed in staging, measured in production. Not a script run in hope.

## The schema is a design commitment

When a bet introduces or alters persistent state, the schema (DDL with types, constraints, and the indexes that carry design intent) is written at design time as the commitment — delivery derives migrations from it. State machines on a table's lifecycle are part of that design. Reference the domain model rather than duplicating it; describe what this change adds.

## Getting data out, and the AI-era layer

- **CDC for derived change streams.** Change Data Capture streams a table's changes to consumers — distinct from the outbox: the **outbox** is intentional domain events you own and shape; **CDC** is a derived stream from a table you may not own. CDC is now a backbone for replication, real-time analytics, and agent context; modern engines (Flink CDC, RisingWave) can ingest directly from the source DB without Kafka in the middle.
- **Enforce schema compatibility, don't just version.** A **schema registry** enforces backward/forward/full compatibility at registration time and blocks an incompatible producer in CI — shift the contract left to the producer, don't discover the break at the consumer.
- **The AI-era data layer is real architecture.** Retrieval is a pipeline, not a datastore: **vector/embedding stores** as the RAG core, with chunking, hybrid search, metadata filtering, and re-ranking as design concerns; **feature stores** (online/offline) for ML; and embeddings need **re-embedding/backfill** discipline exactly like any planned backfill. Govern lineage, PII, and retention through it.
- **Storage substrate: both, layered.** The data-mesh-vs-lakehouse debate resolved to *both* — lakehouse storage, mesh ownership — and the portability-determining choice is the **open table format** (Iceberg the de-facto neutral standard).

## Antipatterns to catch

- **Silent schema changes** — renaming a column in a hot table without coordinating consumers. How outages start.
- **Mutable event logs** — going back to "fix" a past event. The event is what happened; the correction is a new event.
- **Kitchen-sink events table** — one table accepting a JSON blob for every event kind. The type system is a data contract's best friend; do not throw it away.
- **Retention by accident** — tables that grow forever because no one considered retention at creation.
- **Backfills without rehearsal** — reshaping production data by running a script and hoping.
