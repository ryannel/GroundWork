# Database & Schema Management (Drizzle + Postgres)

## 1. Declarative Schema, Diff-Derived Migrations

The Drizzle schema (`src/adapters/postgres/schema.ts`) is the target state of the database — readable without executing scripts. `drizzle-kit generate` diffs it against the migration history to compute each migration; `drizzle-kit migrate` applies them at deploy. Hand-written `ALTER TABLE` scripts drift from the schema and from each other.

The diff engine proposes; hazards are yours to catch. Review every generated migration for locking rewrites, drops, and type changes. Safe-change discipline: additive and nullable-first, new tables empty, renames/drops/type-rewrites sequenced expand-contract across releases — never in the same release as the consuming code.

## 2. The Shape of the Persistence Port

The Drizzle client is already a typed query surface — a thin CRUD path uses it directly in the adapter rather than defining its own port. Introduce a persistence port (a domain-named interface in `src/core/ports.ts`) only when a rich aggregate with invariants must stay storage-ignorant. When you do:

- **One port per aggregate root, named in the domain's language** (`OrderStore.byId`, `.save`) — never a generic `Repository<T>`. A uniform CRUD surface leaks the store's shape into the core, the very leak the port was meant to prevent.
- **Keep it narrow**: only the methods the service calls. If an in-memory fake of the port is awkward to write, the port is too broad.
- When query variety grows, add a query/specification object — not more methods, and never a leaked Drizzle query builder.
- Integration-test the adapter against a real Postgres (Testcontainers); never mock the port or the database.

## 3. Transactions

`db.transaction(async (tx) => …)` is the unit of work; the boundary lives in the adapter or a unit-of-work port the service calls — never leaked as a client handle into the core. Every statement inside the callback must use `tx`, not `db` — a stray `db` call silently escapes the transaction and commits independently. A write that must also publish an event belongs in the outbox shape (`integration.md`).

## 4. Raw SQL Through the Same Client

When a query outgrows the builder — window functions, recursive CTEs, a tuned join — write it with the `sql` template on the same client. Interpolations become bound parameters, so it stays injection-safe, and it runs in the same pool and transaction scope. The defect is reaching for a second client or string concatenation, not raw SQL itself.

## 5. Query Evidence

Indexes and query changes are evidence-based, never speculative:

- **`EXPLAIN ANALYZE` before any index change**, on the real query at realistic data volume; the plan, not intuition, justifies the index. Include the read-out in the PR for non-trivial queries.
- **`pg_stat_statements` and `pg_stat_user_indexes` decide what to keep.** A query earns attention when the statistics say it is hot; an index earns its write amplification when the statistics say it is used.
- Drizzle surface: ``db.execute(sql`EXPLAIN ANALYZE …`)`` in a scratch session, and `.toSQL()` on any builder query shows what it actually emits — profile that, not your mental model of it.

## 6. Test Isolation

Never mock the database. Testcontainers runs the real Postgres, pinned to the production major. Between tests, truncate rather than recreate the schema — truncation is dramatically faster:

```ts
beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE orders, order_events RESTART IDENTITY CASCADE`);
});
```

## Anti-Patterns

- **Hand-written migration scripts.** The schema is target-state; migrations are derived.
- **Mocking the persistence layer.** Mocks hide SQL errors, constraint violations, and transaction semantics.
- **Generic `Repository<T>`.** Premature generality that leaks the schema into the core.
- **A stray `db` call inside a transaction callback.** It commits outside the transaction, silently.
- **Indexes "just in case."** Every index taxes writes; the plan and the statistics justify it, or it goes.
- **String-built SQL.** Bound parameters only (`security.md`).
