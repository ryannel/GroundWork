# Integration

Async integration, event schemas, and webhooks in Node, distilling `docs/principles/system-design/integration-patterns.md`'s decision set into the three places Node idiom actually earns its keep: the outbox relay, the idempotent consumer, and webhook signing. When this file and the canon disagree, the canon wins and this file is the one to fix.

## The outbox pattern — solving the dual-write problem

A handler must not commit a domain write and publish an event as two separate operations — a crash between them loses the event or double-fires it. Write the event to an `outbox` table in the **same transaction** as the domain write; a relay worker polls the table and publishes, marking rows sent.

```ts
async placeOrder(request: PlaceOrderRequest): Promise<Order> {
  return this.db.transaction(async (tx) => { // one transaction — rolls back together
    const [order] = await tx.insert(orders).values(orderFrom(request)).returning();
    await tx.insert(outbox).values({
      eventType: "order.placed",
      payload: { orderId: order.id },
    });
    return order;
  });
}
```

The relay is a background loop started at the composition root — and drained by the shutdown sequence (`node-services.md`) — or a dedicated worker process: poll `outbox` for unsent rows, publish, mark sent. Logical replication (Debezium-style CDC) replaces polling at higher throughput. The outbox is at-least-once by construction, which is why every consumer must be idempotent (below).

## Every consumer is idempotent

At-least-once delivery means a consumer sees the same message more than once. De-duplicate on a key, or make the operation naturally idempotent (an upsert instead of an insert, a conditional update guarded by a version column):

```ts
async handle(message: Message): Promise<void> {
  const inserted = await this.db
    .insert(processedMessages)
    .values({ idempotencyKey: message.idempotencyKey })
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) return; // already processed — not an error, not a retry
  await this.applyOrderPlaced(message);
}
```

A `UNIQUE` constraint on the idempotency key backed by `ON CONFLICT DO NOTHING` is often simpler than a separate dedup store — reach for it first when the consumer already writes to Postgres.

## Webhooks verify, sign, and support replay

An inbound webhook is untrusted input from the network, not an internal event — verify an HMAC signature over the raw body before parsing, using constant-time comparison. In Fastify that means capturing the raw bytes: the JSON parser consumes the body before the handler runs, and re-serialising the parsed object never reproduces the sender's exact bytes. Register a raw-body capture (`fastify-raw-body`, or a content-type parser with `parseAs: "buffer"`) on the webhook route only:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

app.post("/webhooks/payments", { config: { rawBody: true } }, async (request, reply) => {
  const signature = Buffer.from(String(request.headers["webhook-signature"] ?? ""));
  const expected = Buffer.from(
    createHmac("sha256", config.WEBHOOK_SECRET)
      .update(request.rawBody!) // the bytes that arrived, not the parsed object
      .digest("hex"),
  );
  // timingSafeEqual throws on unequal length — check length first, still constant-time
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    return reply.code(401).send({ error: "invalid webhook signature" });
  }
  const event = WebhookEventSchema.parse(JSON.parse(request.rawBody!.toString())); // parse only after verification
  ...
});
```

Follow the Standard Webhooks shape (`id`, `timestamp`, `signature` headers; reject a timestamp outside a tolerance window to close the replay window) rather than inventing a bespoke envelope. Outbound webhooks this service sends need the same signature on the way out, and both directions must tolerate redelivery — the receiver's idempotency key, not a promise never to resend.

## Everything else is the canon's, not Node's

Transport choice (async-vs-sync, choreography-vs-orchestration), retry budgets and circuit breakers (`docs/principles/quality/reliability.md`), and contract-testing the integration are conceptual decisions with no Node-specific shape — `docs/principles/system-design/integration-patterns.md` is the full model. Real-time transport (WebSocket/SSE, sequence numbers, backpressure) is `docs/principles/system-design/real-time.md`. Data-engineering concerns (event schemas, partitioning, CQRS, retention) are `docs/principles/system-design/data-engineering.md` — a Node service applies them through the event specs and migration workflow already routed in `architecture.md` and `database.md`, not through anything distinct here.

## Anti-Patterns

- **Commit-and-then-publish.** Two operations where one crash loses the event; use the outbox.
- **A consumer that assumes at-most-once delivery.** Every consumer sees duplicates eventually; make it idempotent or it corrupts state on redelivery.
- **Fire-and-forget webhooks with no signature.** Unsigned inbound webhooks are unauthenticated remote code triggers with extra steps.
- **Verifying the parsed body instead of the raw bytes.** Re-serialising `request.body` never reproduces the sender's exact bytes; the HMAC must cover what arrived.
- **Global retry policy for every integration.** Retry shape belongs to the specific failure mode, not a blanket default.
