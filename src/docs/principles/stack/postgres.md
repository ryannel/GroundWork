---
title: Postgres
description: Schema design, primary keys, JSONB, expand-contract migrations, indexing, connection pooling, queues, and pgvector as a production vector store.
status: active
last_reviewed: 2026-06-19
---
# Postgres

## TL;DR

Postgres is the canonical data store for every service that needs persistence. We design schemas explicitly, choose primary keys deliberately, migrate with the expand-contract pattern, index from evidence, pool connections, and use `pgvector` as our vector store. When the question is "which database?", the answer is Postgres unless we have a specific, written reason it cannot be.

## Why this matters

Every additional datastore in a system is a multiplier on operational complexity: another backup story, another failure mode, another skill profile to hire for, another surface to monitor. Postgres is a remarkable outlier — it does relational, JSONB document storage, full-text search, queueing, and vector similarity well enough that most workloads never need another engine. Committing to it as a default keeps the operational surface small and the engineers productive.

## Our principles

### 1. Schema design is a design document

Every new table begins with a schema design: what does it represent, what identifies it, what are the invariants, what queries does it need to support, what retention does it live under. This is not a formality — schema shape is the contract that outlives any service that reads or writes the table ([Data Engineering](../system-design/data-engineering.md)). Push invariants into the schema, not just the application: `NOT NULL`, `CHECK`, `FOREIGN KEY`, and `UNIQUE` constraints are enforced by the one component every writer shares. An invariant that lives only in application code is an invariant that some other writer will violate.

### 2. Prefer columns to JSONB for stable shape

JSONB is powerful but it is not a replacement for column design. When a field is present on every row, queried often, or stable in meaning, it belongs in a column — columns get typed constraints, foreign keys, cheap statistics, and B-tree indexes the planner reasons about well. JSONB is the right call when the shape genuinely varies per row, is rarely filtered on, or is a bag of external metadata you store but do not own. When you do query inside JSONB, index it with GIN (or an expression index on the specific path you filter), and remember that you have traded away the constraint enforcement a column would have given you. The default is columns.

### 3. Schema changes follow expand-contract; recovery is roll-forward

Backwards-incompatible change is the source of migration outages, so we never do it in one step. Every change uses expand-contract (parallel change): **expand** the schema with the new, compatible shape; deploy code that writes both old and new; **backfill** existing rows in batched background jobs, never in the migration transaction; cut reads over to the new shape; then **contract** by dropping the old shape once nothing references it. "Migrations are additive" is the easy half of this — the discipline is sequencing the destructive contract step so it lands after every reader and writer has moved.

Two rules make this safe in production, and both are non-obvious:

- **Set `lock_timeout` (and a `statement_timeout`) on the migration connection.** A bare `ALTER TABLE` queues behind any in-flight query holding a conflicting lock, and every request arriving after it then queues behind the `ALTER` — one slow query becomes a full-table stall. A short `lock_timeout` (a few seconds) makes the migration fail fast and retry instead of cascading into an outage.
- **Build indexes and validate constraints `CONCURRENTLY` / `NOT VALID` then `VALIDATE`.** These avoid the long-held `ACCESS EXCLUSIVE` lock that the naive form takes.

The contested zone is rollback. "Every migration has a pre-written down migration" sounds rigorous but is mostly theater: in production, a down migration that reverses a data-bearing change either cannot run without losing data or has never been exercised under load. Our decision rule: **recovery in production is roll-forward** — you ship a new migration that corrects the problem, because expand-contract has kept the previous shape live and compatible the whole time. Keep a tested down path for the local and CI loop, and only for changes that are provably reversible without data loss. For tables too large for an in-place `ALTER`, reach for a tool built for the job (`pgroll`, `pg_osc`) rather than hand-rolling shadow tables.

### 4. Indexes are evidence-based

Most indexes are justified by a query pattern backed by real production data — `pg_stat_user_indexes` and `pg_stat_statements` tell us which queries are hot and which indexes are paying their cost. Unused indexes cost write throughput and disk; we remove them. Speculative indexes "in case we need them later" are the opposite of the principle.

The honest exception: some indexes are required at table creation, before any production traffic exists. Unique constraints are indexes you cannot defer. Foreign keys are not auto-indexed by Postgres, and an unindexed FK turns every parent delete or update into a full scan of the child — index the referencing side up front. Beyond that, reach for the specific index the query needs, not the generic one: partial indexes for queries that always carry the same filter, covering indexes (`INCLUDE`) to serve index-only scans, expression indexes for computed predicates. Always build them `CONCURRENTLY` on a live table.

### 5. `pgvector` is our vector store — to a threshold we name

Semantic search, embedding similarity, RAG retrieval — all of this runs on `pgvector` in the same Postgres cluster as relational data. The payoff is real and specific: vectors live in the same transaction as the rows they describe, so you filter, join, and keep them consistent without a second system to sync, back up, and reconcile.

This is a default, not a law, and the dishonest version of it ignores scale. Vanilla `pgvector` with an HNSW index serves low-latency, high-recall queries comfortably into the low millions of vectors, while the index fits in RAM; performance degrades as the dataset outgrows memory. The decision rule by scale:

- **Up to a few million vectors:** `pgvector` + HNSW. No argument.
- **Tens of millions:** stay in Postgres but switch to `pgvectorscale` (StreamingDiskANN), which keeps the index on disk and holds high QPS at high recall well past where in-memory HNSW falls over.
- **Hundreds of millions and beyond, or hard requirements `pgvector` does not serve** (extreme-scale sharding, specialized hybrid-filtering engines): that is the written reason to run a dedicated vector store. The data and the requirement will make the case; until they do, the second system is unbought complexity.

### 6. Connection management is explicit, and the pooler is the real answer

A Postgres backend is a full OS process with a meaningful memory footprint, so the server tops out at low thousands of connections regardless of how big the box is. The standard architecture is a transaction-mode pooler (PgBouncer or Supavisor) in front of the database: hundreds or thousands of client connections multiplexed onto a small set of server connections, each held only for the duration of a transaction. Size the server-side pool to the database's capacity (a small multiple of CPU cores), not to the number of application instances.

Transaction mode is the right default but it forbids session-scoped state — session-level `SET`, advisory locks, and `LISTEN`/`NOTIFY` break across pooled transactions; isolate those on a session-mode connection. Every service still sets explicit per-connection limits, idle timeouts, and a `statement_timeout`. "Just use the defaults" is how Postgres gets hammered into `too many connections` under load. Postgres is a shared resource; treat it like one.

### 7. Query patterns are reviewed

Every new query is reviewed for plan shape, not just correctness. `EXPLAIN (ANALYZE, BUFFERS)` on representative data is part of the PR for any non-trivial query. N+1 queries, full-table scans, and unbounded `IN` lists are caught in review, not in production.

### 8. Backups, retention, and disaster recovery are not afterthoughts

Automated backups run with RPO and RTO targets that the business has signed off on. We test restores — a backup we have never restored is not a backup. Retention policies are set per table at creation time and aligned with the privacy policy ([Privacy](../quality/privacy.md)).

### 9. Primary keys are a deliberate choice, never UUIDv4

The default is a `bigint GENERATED ALWAYS AS IDENTITY` key: compact, sequential, cache-friendly, and ideal for internal tables that never leave the cluster. Choose a UUID instead when the key is generated by the client or across distributed nodes, exposed in URLs or public APIs (where a guessable sequential id leaks volume and ordering), or merged across systems that must not collide.

When you do reach for a UUID, use **UUIDv7**, never UUIDv4. A v4 key is random, so inserts scatter across the B-tree, fragmenting the index and inflating write amplification and WAL. UUIDv7 is time-ordered: it keeps the global-uniqueness and distributed-generation benefits while restoring the sequential insert locality that makes `bigint` fast — close enough to identity-key performance that the gap stops being a reason to avoid it. Postgres 18+ ships a native `uuidv7()`; on earlier versions generate it in the application or via an extension. The remaining honest cost is size — 16 bytes versus 8 — which multiplies across every secondary index that carries the key, so do not pay it without one of the reasons above.

## How we apply this

- [Data Engineering](../system-design/data-engineering.md) — the broader treatment of data contracts.
- [Privacy](../quality/privacy.md) — the rules that shape retention and residency.

## Anti-patterns we reject

- **JSONB-everything.** Not a schema; a confession of avoided design.
- **UUIDv4 primary keys.** Random keys fragment the index and tax every write. Use `bigint` by default, UUIDv7 when you need a UUID.
- **Indexes "just in case."** Every index is a write tax; justify it from a query or remove it — with the narrow exception of unique constraints and foreign-key indexes, which are required up front.
- **Migrations that lock a hot table.** `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT` on a 10M-row table with no `lock_timeout`. Add the column nullable, backfill in batches, then tighten — and fail fast on a lock you cannot get.
- **Blind down migrations as a production safety net.** They are rarely exercised and often lossy. Expand-contract plus roll-forward is the real recovery story.
- **Raw string interpolation into queries.** Parameterised queries, always. This is a security rule ([Security](../quality/security.md)) and a clarity rule.
- **A second database "just because."** Adding Redis, DynamoDB, or a dedicated vector store without a specific, documented need Postgres cannot meet. Most of the time, Postgres can.

### On using Postgres as a queue

The reflexive "never use the database as a queue" is dated. `SELECT ... FOR UPDATE SKIP LOCKED` gives Postgres a correct, contention-free work queue, and for low-to-moderate throughput (roughly to the low thousands of jobs per second) a Postgres queue — raw `SKIP LOCKED`, or a mature layer like `pgmq` or Oban — is often the *right* call precisely because it honours the "no second datastore" principle: jobs are enqueued in the same transaction that creates the work, so you get exactly-once-with-the-write semantics for free, with one backup and one failure mode instead of two.

The decision rule: **reach for a dedicated broker when the workload outgrows what a table does well** — sustained high throughput, fan-out to many consumers, streaming and replay, or strict ordered partitions (Kafka territory). And respect the one operational tax that is real: a `SKIP LOCKED` queue churns dead tuples, so it lives or dies by autovacuum — tune aggressive autovacuum on the queue table, or partition it, before load finds the bloat for you.

## Further reading

- *PostgreSQL: Up and Running*, Obe & Hsu — a practical, current reference.
- *The Art of PostgreSQL*, Dimitri Fontaine — advanced patterns with a teaching bent.
- *Designing Data-Intensive Applications*, Martin Kleppmann — the systems-level argument for relational-as-default.
- *pgvector documentation* ([github.com/pgvector/pgvector](https://github.com/pgvector/pgvector)) — the canonical source for vector index strategies.
