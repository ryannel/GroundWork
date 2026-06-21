# Integration Patterns

## Principles

1. **Default to async; upgrade to sync when required.** Sync only for inline response values or strict writes.
2. **Outbox pattern for DB write + event agreement.** Write event to `outbox` table in same transaction; worker relays to broker.
3. **Every consumer is idempotent.** De-duplication key or idempotent operations (UPSERT, conditional update).
4. **Retries have policies.** Explicit maximum, backoff curve, dead-letter destination.
5. **Webhooks verify, sign, and replay.** HMAC signature over payload. Both sides support replay.
6. **Timeouts are end-to-end budgets.** Allocated from the outermost caller's budget.
7. **Circuit breakers protect the system.** Open after threshold, fast-fail, probe periodically.
8. **Every integration has a contract test.** Real signature verification, retry curve, idempotency in CI.

## Anti-Patterns

- Sync chains three deep. Fire-and-forget webhooks. Commit-and-then-publish.
- Global retry policies. Dead-letter queues as logs.

---

# Real-Time Architecture

## Principles

1. **WebSocket is the default transport.** SSE for one-way server-to-client only. No long-polling.
2. **Every message carries a sequence number.** Monotonic, per-session. Detect gaps, duplicates, resync.
3. **Reconnection is the normal case.** Exponential backoff, jitter, resumption token.
4. **Backpressure is explicit.** Shed, coalesce, or block. Never buffer unbounded.
5. **Echo suppression is a design concern.** Specified before the first line of code.
6. **Idempotent handlers.** Same sequence number processed twice has no additional effect.
7. **Observability is unbroken across the socket.** OTel trace context propagates into the socket.
8. **Client state is recoverable, not sacred.** Server is the source of truth.

## Anti-Patterns

- Socket as fire-and-forget bus. Per-connection unbounded buffers. Reconnect-then-refetch-everything.
- Ad-hoc event schemas. Client-side echo reconciliation.

---

# Data Engineering

## Principles

1. **Events are append-only and immutable.** Correction via compensating events.
2. **Schemas are versioned and evolvable.** Additive new fields; deprecated fields have a deadline.
3. **Partition keys are chosen deliberately.** Ordering guarantee per partition.
4. **CQRS where it pays.** Separate read model for complex projections.
5. **Event sourcing is a tool, not a religion.** Only where change history is the product.
6. **Data contracts are documented, versioned, and owned.**
7. **Retention is a design decision.** Decided at creation, enforced by automation.
8. **Backfills are planned operations.** Rehearsed in staging, measured in production.

## Anti-Patterns

- Silent schema changes. Mutable event logs. Kitchen-sink events table.
- Backfills without rehearsal. Retention by accident.
