# Integration

Async integration, event schemas, and webhooks in Go, distilling `docs/principles/system-design/integration-patterns.md`'s decision set into the three places Go idiom actually earns its keep: the outbox relay, the idempotent consumer, and webhook signing. When this file and the canon disagree, the canon wins and this file is the one to fix.

## The outbox pattern — solving the dual-write problem

A handler must not commit a domain write and publish an event as two separate operations — a crash between them loses the event or double-fires it. Write the event to an `outbox` table in the **same transaction** as the domain write; a relay worker polls the table and publishes, marking rows sent.

```go
func (s *OrderService) PlaceOrder(ctx context.Context, req PlaceOrderRequest) (*Order, error) {
    return s.db.WithTx(ctx, func(tx pgx.Tx) (*Order, error) {
        order, err := s.orders.Insert(ctx, tx, req)
        if err != nil {
            return nil, fmt.Errorf("inserting order: %w", err)
        }
        if err := s.outbox.Enqueue(ctx, tx, OrderPlacedEvent{OrderID: order.ID}); err != nil {
            return nil, fmt.Errorf("enqueuing outbox event: %w", err) // same transaction — rolls back together
        }
        return order, nil
    })
}
```

The relay is a separate goroutine or process, polling or driven by logical replication (Debezium-style CDC for higher throughput); it is at-least-once by construction, which is why every consumer must be idempotent (below). The event hub pattern in the SKILL.md Quick Reference is the in-process front end to this table.

## Every consumer is idempotent

At-least-once delivery means a consumer sees the same message more than once. De-duplicate on a key, or make the operation naturally idempotent (`UPSERT` instead of `INSERT`, a conditional update guarded by a version column):

```go
func (c *OrderConsumer) Handle(ctx context.Context, msg Message) error {
    seen, err := c.dedup.MarkIfNew(ctx, msg.IdempotencyKey) // e.g. Redis SETNX with a TTL, or a unique DB constraint
    if err != nil {
        return fmt.Errorf("checking dedup key: %w", err)
    }
    if seen {
        return nil // already processed — not an error, not a retry
    }
    return c.applyOrderPlaced(ctx, msg)
}
```

A `UNIQUE` constraint on the idempotency key backed by an `ON CONFLICT DO NOTHING` upsert is often simpler than a separate dedup store — reach for it first when the consumer already writes to Postgres.

## Webhooks verify, sign, and support replay

An inbound webhook is untrusted input from the network, not an internal event — verify an HMAC signature over the raw body before parsing, using constant-time comparison:

```go
func verifyWebhookSignature(secret, rawBody []byte, sigHeader string) error {
    mac := hmac.New(sha256.New, secret)
    mac.Write(rawBody)
    expected := hex.EncodeToString(mac.Sum(nil))
    if !hmac.Equal([]byte(expected), []byte(sigHeader)) {
        return errors.New("invalid webhook signature")
    }
    return nil
}
```

Follow the Standard Webhooks shape (`id`, `timestamp`, `signature` headers; reject a timestamp outside a tolerance window to close the replay window) rather than inventing a bespoke envelope. Outbound webhooks this service sends need the same signature on the way out, and both directions must tolerate redelivery — the receiver's idempotency key, not a promise never to resend.

## Everything else is the canon's, not Go's

Transport choice (async-vs-sync, choreography-vs-orchestration), retry budgets and circuit breakers (`references/reliability-performance.md`), and contract-testing the integration are conceptual decisions with no Go-specific shape — `docs/principles/system-design/integration-patterns.md` is the full model. Real-time transport (WebSocket/SSE, sequence numbers, backpressure) is `docs/principles/system-design/real-time.md`; this stack has no real-time idiom of its own beyond what `references/reliability-performance.md` already covers for backpressure. Data-engineering concerns (event schemas, partitioning, CQRS, retention) are `docs/principles/system-design/data-engineering.md` — a Go service applies them through the event specs and migration workflow already routed in `references/architecture.md` and `references/postgres.md`, not through anything distinct here.

## Anti-Patterns

- **Commit-and-then-publish.** Two operations where one crash loses the event; use the outbox.
- **A consumer that assumes at-most-once delivery.** Every consumer sees duplicates eventually; make it idempotent or it corrupts state on redelivery.
- **Fire-and-forget webhooks with no signature.** Unsigned inbound webhooks are unauthenticated remote code triggers with extra steps.
- **Global retry policy for every integration.** Retry shape belongs to the specific failure mode, not a blanket default.
