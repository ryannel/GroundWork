---
title: Postgres
description: Schema design, JSONB, migrations, indexing, and pgvector as a production vector store.
status: active
last_reviewed: 2026-05-26
---
# Postgres

## TL;DR

Postgres is the canonical data store for every service that needs persistence. We design schemas explicitly, migrate online, index deliberately, and use `pgvector` as our vector store. When the question is "which database?", the answer is Postgres unless we have a specific, written reason it cannot be.

## Why this matters

Every additional datastore in a system is a multiplier on operational complexity: another backup story, another failure mode, another skill profile to hire for, another surface to monitor. Postgres is a remarkable outlier — it does relational, JSONB document storage, full-text search, and vector similarity well enough that most workloads never need another engine. Committing to it as a default keeps the operational surface small and the engineers productive.

## Our principles

### 1. Schema design is a design document

Every new table begins with a schema design: what does it represent, what identifies it, what are the invariants, what queries does it need to support, what retention does it live under. This is not a formality — schema shape is the contract that outlives any service that reads or writes the table ([Data Engineering](../system-design/data-engineering.md)).

### 2. Prefer columns to JSONB for stable shape

JSONB is powerful but it is not a replacement for column design. When a field is present on every row, queried often, and stable in meaning, it belongs in a column. JSONB is the right call when the shape varies per row, is rarely queried directly, or is a bag of external metadata. The default is columns.

### 3. Migrations are additive, reversible, and online

Every migration is additive — new columns are nullable or carry sensible defaults, new tables start empty. We never block on a migration that rewrites a large table in a single transaction; long DDL runs online, with back-filling separated into background jobs. Rollback is pre-written; a migration without a rollback is not a finished migration.

### 4. Indexes are evidence-based

Every index is justified by a query pattern backed by real production data — `pg_stat_user_indexes` and `pg_stat_statements` tell us which queries are hot and which indexes are paying their cost. Unused indexes cost write throughput and disk; we remove them. Speculative indexes "in case we need them later" are the opposite of the principle.

### 5. `pgvector` is our vector store

Semantic search, embedding similarity, RAG retrieval — all of this runs on `pgvector` in the same Postgres cluster as relational data. This is an explicit decision in favour of operational simplicity over marginal performance. If we ever need a dedicated vector DB, the data and the requirement will make the case.

### 6. Connection management is explicit

Every service manages its connection pool with deliberate sizing — max connections, idle timeouts, statement timeouts, per-service limits. "Just use the defaults" is how Postgres gets hammered into `too many connections` errors under load. Postgres is a shared resource; treat it like one.

### 7. Query patterns are reviewed

Every new query is reviewed for plan shape, not just correctness. `EXPLAIN ANALYZE` on representative data is part of the PR for any non-trivial query. N+1 queries, full-table scans, and unbounded `IN` lists are caught in review, not in production.

### 8. Backups, retention, and disaster recovery are not afterthoughts

Automated backups run with RPO and RTO targets that the business has signed off on. We test restores — a backup we have never restored is not a backup. Retention policies are set per table at creation time and aligned with the privacy policy ([Privacy](../quality/privacy.md)).

## How we apply this

- [Data Engineering](../system-design/data-engineering.md) — the broader treatment of data contracts.
- [Privacy](../quality/privacy.md) — the rules that shape retention and residency.

## Anti-patterns we reject

- **JSONB-everything.** Not a schema; a confession of avoided design.
- **Indexes "just in case."** Every index is a write tax; justify it from a query or remove it.
- **Migrations that lock a hot table.** `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT` on a 10M-row table. Use `NULL` first, backfill, then tighten.
- **Using Postgres as a message broker.** It can work; it is still not what we should be doing when we also have a proper message broker available.
- **Raw string interpolation into queries.** Parameterised queries, always. This is a security rule ([Security](../quality/security.md)) and a clarity rule.
- **A second database "just because."** Adding Redis or DynamoDB without a specific, documented need Postgres cannot meet. Most of the time, Postgres can.

## Further reading

- *PostgreSQL: Up and Running*, Obe & Hsu — a practical, current reference.
- *The Art of PostgreSQL*, Dimitri Fontaine — advanced patterns with a teaching bent.
- *Designing Data-Intensive Applications*, Martin Kleppmann — the systems-level argument for relational-as-default.
- *pgvector documentation* ([github.com/pgvector/pgvector](https://github.com/pgvector/pgvector)) — the canonical source for vector index strategies.
