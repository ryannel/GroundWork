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

## The persistence boundary

Take the clean break between the core and the store from a narrow, domain-named port plus real-DB tests — never from a generic repository. Idiomatically in Go:

- **Declare the interface where it is consumed, and keep it small.** The service that needs persistence declares an interface naming only the operations it calls (`type OrderStore interface { ByID(ctx, id) (*Order, error); Save(ctx, *Order) error }`), in the domain's language. The Postgres implementation (over `sqlc`/`pgx`) lives in its own package, returns concrete domain structs, and is wired in at the composition root. *"The bigger the interface, the weaker the abstraction"* — never expose the store's full CRUD surface.
- **No generic `Repository[T]`.** Per-entity queries, SQL, and row mapping differ, so persistence belongs to an interface, not a type parameter — Go's own guidance uses a type parameter only to *relate* multiple values, not when the implementation differs per type. A generic base used only by tests is speculative generality; delete it.
- **Right-size it.** A thin CRUD endpoint does not need a hand-written port over the query layer — reach for one when a rich aggregate with invariants must stay storage-ignorant, and then it is one port per aggregate root. When query variety grows, add a query/specification type, not more methods.
- Integration-test the adapter against a real Postgres (see `testing.md`); do not mock it.

## Anti-Patterns

- JSONB-everything. Indexes "just in case." Migrations that lock hot tables.
- Raw string interpolation. A second database without documented need.
- A generic `Repository[T]` over the query layer, or an exposed store-shaped CRUD surface — premature generality that leaks the schema into the core.
