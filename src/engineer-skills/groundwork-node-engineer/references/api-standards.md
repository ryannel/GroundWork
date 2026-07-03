# API Standards & Inbound Defenses

Every service exposes a hardened, predictable API surface. Implement these Day-2 operational requirements at the Fastify entrypoint layer.

## 1. Schema-Validated Routes

Every route declares its request and response schemas; Fastify validates the request before the handler runs and serializes the reply against the response schema. Wire zod in through the zod type provider (register its `validatorCompiler`/`serializerCompiler` once at the composition root) so one schema yields both runtime validation and static types:

```ts
import { type ZodTypeProvider } from "fastify-type-provider-zod";

app.withTypeProvider<ZodTypeProvider>().post("/orders", {
  schema: {
    body: CreateOrderSchema,                 // zod — validated before the handler runs
    response: { 201: OrderResponseSchema },  // reply serialized against this
  },
}, async (request, reply) => {
  const order = await orders.place(toDomain(request.body)); // typed by the schema
  return reply.code(201).send(toResponse(order));
});
```

A route without a schema skips validation and Fastify's compiled serialization — a security defect and a performance defect in one omission.

## 2. Centralized Error Mapping

Handlers throw domain errors; one `setErrorHandler` maps them to HTTP. Inline status-code crafting per handler drifts.

```ts
app.setErrorHandler((err, request, reply) => {
  const status = statusFor(err); // the table below; unknown errors map to 500
  request.log.error({ err }, "request failed");
  return reply.code(status).send({ error: codeFor(err), traceId: currentTraceId() });
});
```

The client receives a stable code and a correlation id; stack traces, SQL fragments, and upstream messages stay in the logs (`security.md`).

| Domain error | HTTP |
|---|---|
| `NotFoundError` | 404 |
| `UnauthorizedError` | 401 |
| `ForbiddenError` | 403 |
| `ConflictError` | 409 |
| `ValidationError` | 422 |
| `TransientUpstreamError` | 503 |
| `PermanentUpstreamError` | 502 |

## 3. Idempotency

Mutating endpoints (`POST`, `PATCH`) must be idempotent to allow safe client retries; `PUT` is idempotent by HTTP semantics and needs no key.

- Require an `Idempotency-Key` header on mutating requests; enforce it in a `preHandler` hook before business logic executes.
- Store the intent and the final response in persistent state (a Postgres table or Redis) — an in-memory map evaporates on restart and never shares across replicas.
- Known key and `IN_PROGRESS`: return `409 Conflict`. Known key and `COMPLETED`: return the cached response immediately.

## 4. Cursor-Based Pagination

Never use offset/limit pagination for collections. Offset pagination scales O(N) in the database and skips or duplicates items when the dataset changes mid-iteration.

- Return an opaque `nextCursor` (base64 of the last seen id + sort key) and `hasNext`.
- Accept `cursor` and `limit` (capped) in the query schema; pass the cursor down to the persistence layer.

## 5. Load Shedding & Timeouts

A saturated service serves fewer requests well; it does not queue until memory dies.

- Set `connectionTimeout` and `requestTimeout` on the Fastify factory so a hung client cannot hold a socket forever.
- Enforce an inbound concurrency limit that sheds with `503` when saturated. `@fastify/under-pressure` watching event-loop delay is the right trigger — event-loop lag is Node's truthful saturation signal, where CPU% is not.

## 6. CORS Configuration

Configure allowed origins explicitly from validated config. Never `origin: "*"` or `origin: true` — a reflected wildcard leaks cross-origin data. Allow the `Idempotency-Key` header alongside `Authorization` and `Content-Type`.

## Anti-Patterns

- **Schemaless routes.** Unvalidated input and slow serialization in one omission.
- **Per-handler try/catch status mapping.** One error handler; handlers throw domain errors.
- **Offset pagination.** `?limit=50&offset=1000` scans and discards 1,000 rows.
- **Ignoring idempotency keys.** Clients retry on timeout; duplicate side-effects follow.
- **In-memory idempotency stores.** Restart or a second replica silently breaks the guarantee.
- **Queuing without bounds.** Shed the 100th concurrent request; do not park it for 10 seconds.
- **Wildcard CORS.** Restrict to known frontends.
