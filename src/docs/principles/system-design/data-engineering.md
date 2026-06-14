---
title: Data Engineering
description: Events, streams, CQRS, event sourcing, and the data contracts that outlive any service.
status: active
last_reviewed: 2026-05-26
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

Event topics partition by the identifier that matters for ordering — typically the primary entity's ID — so that all events for a single entity flow through a single partition in sequence. Choosing a partition key casually is one of the most expensive mistakes in a data system; we treat it as a design decision that deserves review.

### 4. CQRS where it pays

For read-heavy surfaces with complex projections, we maintain a read model separate from the write model. The write model owns truth; the read model owns query performance. We do not apply CQRS universally; we apply it where the read load and the write load have genuinely different shapes.

### 5. Event sourcing is a tool, not a religion

For domains where the history of change is itself the product — audit logs, participation timelines — we store the event log as the primary artefact and derive current state from it. For domains where current state is what matters, we store current state and publish events as derivatives. Event sourcing every table "because it is purer" is overengineering.

### 6. Data contracts are documented, versioned, and owned

Every significant table and every published event has an owner, a documented schema, a migration history, and a compatibility policy. Unowned tables and undocumented events are a ticking integration-debt clock.

### 7. Retention is a design decision

Every dataset we store has a retention policy — deletion after N days, archival after M days, live forever. Retention is decided when the dataset is created, reviewed when the regulatory surface changes ([Privacy](../quality/privacy.md)), and enforced by automation. "We will figure it out later" is the decision that becomes a compliance incident three years later.

### 8. Backfills are a planned operation

Changing the shape of historical data — renaming a field, re-computing a derived column — is a project with a plan, a rollback, and a measurement. We do not backfill by running a script and hoping. Backfills are rehearsed in staging and measured in production.

### 9. Change capture, enforced schemas, and the AI-era layer

**CDC** streams a table's changes to consumers — distinct from the outbox (intentional domain events we own) as a derived stream from a table we may not, and now a backbone for replication and agent context. Schema evolution is **enforced**, not just versioned: a registry checks compatibility at registration and blocks an incompatible producer in CI. The AI-era data layer is first-class architecture — vector/embedding stores as the RAG core (chunking, hybrid search, re-ranking, metadata filtering as design concerns), feature stores for ML, and re-embedding/backfill discipline like any planned backfill. On storage, the mesh-vs-lakehouse debate resolved to *both, layered*, with an open table format (Iceberg) as the portability choice.

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
