# Integration

Async integration, event schemas, and webhooks in Python, distilling `docs/principles/system-design/integration-patterns.md`'s decision set into the three places Python idiom actually earns its keep: the outbox relay, the idempotent consumer, and webhook signing. When this file and the canon disagree, the canon wins and this file is the one to fix.

## The outbox pattern — solving the dual-write problem

A handler must not commit a domain write and publish an event as two separate operations — a crash between them loses the event or double-fires it. Write the event to an `outbox` table in the **same transaction** as the domain write; a relay worker polls the table and publishes, marking rows sent.

```python
async def place_order(self, request: PlaceOrderRequest) -> Order:
    async with self._session.begin():  # one transaction — rolls back together
        order = Order.from_request(request)
        self._session.add(order)
        self._session.add(OutboxEvent.for_payload(
            event_type="order.placed",
            payload={"order_id": str(order.id)},
        ))
    return order
```

The relay is a separate task or process — an `asyncio` loop under the FastAPI `lifespan`, or a dedicated worker container — polling `outbox` for unsent rows, publishing, and marking them sent; logical replication (Debezium-style CDC) replaces polling at higher throughput. It is at-least-once by construction, which is why every consumer must be idempotent (below).

## Every consumer is idempotent

At-least-once delivery means a consumer sees the same message more than once. De-duplicate on a key, or make the operation naturally idempotent (an upsert instead of an insert, a conditional update guarded by a version column):

```python
async def handle(self, message: Message) -> None:
    stmt = (
        insert(ProcessedMessage)
        .values(idempotency_key=message.idempotency_key)
        .on_conflict_do_nothing()
    )
    result = await self._session.execute(stmt)
    if result.rowcount == 0:
        return  # already processed — not an error, not a retry
    await self._apply_order_placed(message)
```

A `UNIQUE` constraint on the idempotency key backed by `ON CONFLICT DO NOTHING` is often simpler than a separate dedup store — reach for it first when the consumer already writes to Postgres.

## Webhooks verify, sign, and support replay

An inbound webhook is untrusted input from the network, not an internal event — verify an HMAC signature over the raw body before parsing, using constant-time comparison. In FastAPI that means reading the raw bytes, not the parsed model:

```python
@router.post("/webhooks/payments")
async def payment_webhook(request: Request) -> Response:
    raw_body = await request.body()
    signature = request.headers.get("webhook-signature", "")
    expected = hmac.new(settings.webhook_secret, raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="invalid webhook signature")
    event = WebhookEvent.model_validate_json(raw_body)  # parse only after verification
    ...
```

Follow the Standard Webhooks shape (`id`, `timestamp`, `signature` headers; reject a timestamp outside a tolerance window to close the replay window) rather than inventing a bespoke envelope. Outbound webhooks this service sends need the same signature on the way out, and both directions must tolerate redelivery — the receiver's idempotency key, not a promise never to resend.

## Everything else is the canon's, not Python's

Transport choice (async-vs-sync, choreography-vs-orchestration), retry budgets and circuit breakers (`references/resilience.md`), and contract-testing the integration are conceptual decisions with no Python-specific shape — `docs/principles/system-design/integration-patterns.md` is the full model. Real-time transport (WebSocket/SSE, sequence numbers, backpressure) is `docs/principles/system-design/real-time.md`. Data-engineering concerns (event schemas, partitioning, CQRS, retention) are `docs/principles/system-design/data-engineering.md` — a Python service applies them through the event specs and migration workflow already routed in `references/architecture.md` and `references/database.md`, not through anything distinct here.

## Anti-Patterns

- **Commit-and-then-publish.** Two operations where one crash loses the event; use the outbox.
- **A consumer that assumes at-most-once delivery.** Every consumer sees duplicates eventually; make it idempotent or it corrupts state on redelivery.
- **Fire-and-forget webhooks with no signature.** Unsigned inbound webhooks are unauthenticated remote code triggers with extra steps.
- **Verifying the parsed model instead of the raw body.** Re-serialising a Pydantic model never reproduces the sender's exact bytes; the HMAC must cover what arrived.
- **Global retry policy for every integration.** Retry shape belongs to the specific failure mode, not a blanket default.
