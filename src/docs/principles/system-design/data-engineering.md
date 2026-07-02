---
title: Data Engineering
description: Events, streams, CQRS, event sourcing, and the data contracts that outlive any service.
status: active
last_reviewed: 2026-06-19
---
# Data Engineering

## TL;DR

Data outlives services. We treat every event we emit and every table we own as a long-term contract, shaped so downstream consumers — today and in three years — can work with it without archaeology. Events are append-only, schemas are versioned, and the log of what happened is preserved even when the current-state projection is rebuilt.

## Why this matters

Services are replaced; data lives on. The data contracts we set today — table shapes, event payloads, field semantics — are the single most durable thing we will produce. Getting the contract right once is cheap; changing it retroactively after the data has multiplied is brutal.

## Our principles

### 1. Events are append-only and immutable

Once an event is emitted, it is never rewritten. Correction happens through *compensating* events, not through mutation of the original. This is the discipline that lets downstream consumers trust the event log as a truthful history of the system.

### 2. Schemas are versioned and evolvable

Event payloads have explicit versions. New fields are additive; removed fields are deprecated with a deadline, not removed silently. Consumers can detect an old schema and handle it or refuse it — they are never surprised. This is the AsyncAPI discipline ([API Design](api-design.md)) applied to every stream.

### 3. Partition keys are chosen deliberately

Partitioning forces a tradeoff with no universal answer: ordering pulls toward concentrating related records on one partition, even distribution pulls toward spreading them. The key that guarantees per-entity order — the entity's ID — also creates a hot partition the moment one entity is far busier than the rest, and the broker will not rebalance skew away for you. You size for the hottest partition and waste the rest.

Decision rule:

- Per-entity ordering needed and entities are roughly uniform → partition by entity ID.
- Ordering needed but some entities are hot → use a composite key (`tenantId|entityId`) to widen routing cardinality while preserving order for the inner entity, or salt the hot key into K buckets and accept that order is lost *across* buckets.
- No ordering requirement → leave the key null and let the producer round-robin for even load.

Choosing a partition key casually is one of the most expensive mistakes in a data system. Repartitioning a live topic is a migration, not a config change, so the key gets reviewed at design time.

### 4. CQRS where it pays

For read-heavy surfaces with complex projections, we maintain a read model separate from the write model. The write model owns truth; the read model owns query performance. We do not apply CQRS universally; we apply it where the read load and the write load have genuinely different shapes. The tax is eventual consistency — the read model lags the write, so any surface built on it must not assume read-after-write. If a single well-indexed table serves both paths, you do not have a CQRS problem; splitting the model early buys two things to keep in sync and nothing else.

### 5. Event sourcing is a tool, not a religion

For domains where the history of change is itself the product — audit logs, participation timelines — we store the event log as the primary artefact and derive current state from it. For domains where current state is what matters, we store current state and publish events as derivatives. Event sourcing every table "because it is purer" is overengineering.

### 6. Data contracts are documented, versioned, and owned

Every significant table and every published event has an owner, a documented schema, a migration history, and a compatibility policy. Unowned tables and undocumented events are a ticking integration-debt clock.

### 7. Retention is a design decision

Every dataset we store has a retention policy — deletion after N days, archival after M days, live forever. Retention is decided when the dataset is created, reviewed when the regulatory surface changes ([Privacy](../quality/privacy.md)), and enforced by automation. "We will figure it out later" is the decision that becomes a compliance incident three years later.

### 8. Backfills are a planned operation

Changing the shape of historical data — renaming a field, re-computing a derived column — is a project with a plan, a rollback, and a measurement. We do not backfill by running a script and hoping. Backfills are rehearsed in staging and measured in production.

### 9. Change capture, enforced schemas, and the AI-era layer

**Change capture vs. outbox.** The transactional outbox is the events we *mean* to publish, written in the same database transaction as the state change so there is no dual write to lose. CDC streams the raw row changes of a table. They are complementary, not rivals: the cleanest outbox relay *is* CDC — Debezium tailing the write-ahead log — rather than a polling loop. We reach for raw-table CDC as an integration backbone only when the source cannot give us a real contract; a CDC feed of someone else's schema is a contract we never negotiated, and they can break it without telling us.

**Enforced, not just versioned.** Versioning (principle 2) is the policy; enforcement is the mechanism. A schema registry checks compatibility at registration and fails the producer's build on a breaking change, shifting the contract left into CI instead of into a consumer's pager at 3am. The contract is owned by the producer; an unowned contract is stale documentation.

**The AI-era data layer is architecture, not a bolt-on.** Vector/embedding stores are the retrieval core of RAG, and chunking, hybrid (lexical + semantic) search, re-ranking, and metadata filtering are design decisions, not library defaults. Default to `pgvector` in the database you already run — under roughly ten million vectors it matches dedicated stores on latency and recall while saving you a whole system to operate and keep consistent. Move to a dedicated vector database when scale, recall under heavy concurrency, or index build time make Postgres the bottleneck. Embeddings are derived data: a model change invalidates them, so re-embedding is a planned backfill (principle 8) against a versioned embedding model, never an ad-hoc rerun.

**Storage: layer, don't pick a camp.** Data mesh (an org model: domain-owned data products, federated governance) and the lakehouse (a technical substrate) answer different questions — layer them: a platform team owns storage, catalog, and CI templates, domain teams own the products on top. Pick a table format (Delta Lake, Apache Iceberg) for the engines you actually run and the vendor coupling you can tolerate, not for the benchmark of the week.

## How we apply this

- [Postgres](../stack/postgres.md) — how we apply these principles inside our chosen database.

## Anti-patterns we reject

- **Silent schema changes.** Renaming a column in a hot table without coordinating consumers. This is how outages start.
- **Mutable event logs.** Going back and "fixing" a past event. The event is what happened; the correction is a new event.
- **Kitchen-sink "events" table.** One table that accepts a JSON blob for every kind of event. The type system is the best friend of a data contract; do not throw it away.
- **Backfills in production without rehearsal.** See above.
- **Retention by accident.** Tables that grow forever because no one considered retention at creation time.

## Further reading

- *Designing Data-Intensive Applications*, Martin Kleppmann — the single best survey of the territory, including the chapters on derived data, stream processing, and batch processing.
- *Data Mesh*, Zhamak Dehghani — the argument for treating data as a first-class product with owners.
- *Streaming Systems*, Akidau, Chernyak, Lax — the deep treatment of time, watermarks, and windowing in stream processing.
- *Event Sourcing and CQRS*, Vaughn Vernon (the relevant chapters of *Implementing DDD*) — a grounded, implementation-focused view.
- *Data Contracts*, Chad Sanderson, Mark Freeman & B. E. Schmidt (O'Reilly, 2025) — producer-owned, shift-left enforcement of the contracts in principles 6 and 9.
