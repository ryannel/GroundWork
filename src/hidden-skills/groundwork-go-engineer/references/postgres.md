# Postgres

## Principles

1. **Schema design is a design document.** What it represents, identifies, invariants, queries, retention.
2. **Columns over JSONB for stable shape.** JSONB for varying shape or rarely queried metadata.
3. **Migrations are additive, reversible, online.** Nullable columns or cheap defaults. Never block on large rewrites.
4. **Indexes are evidence-based.** Justified by `pg_stat_user_indexes` and `pg_stat_statements`.
5. **`pgvector` is the vector store.** Operational simplicity over marginal dedicated-DB performance.
6. **Connection management is explicit.** Deliberate pool sizing, idle timeouts, statement timeouts.
7. **Query patterns are reviewed.** `EXPLAIN ANALYZE` in PRs for non-trivial queries.
8. **Backups and retention are not afterthoughts.** Test restores. Retention decided at table creation.

## Target-State Schema Workflow

1. `db/schema.sql` describes the desired final state.
2. Migrator compares live DB to target using `pg-schema-diff` or equivalent.
3. `dry-run` prints planned DDL and hazards.
4. `migrate` applies the plan.

### Safe Schema Changes

- Add nullable columns first, cheap defaults only when safe for table size.
- Add new tables empty. Add indexes for known access patterns.
- Avoid renames, drops, type rewrites in same release as consuming code.
- Multi-release: expand-contract sequencing.

## Anti-Patterns

- JSONB-everything. Indexes "just in case." Migrations that lock hot tables.
- Raw string interpolation. A second database without documented need.
