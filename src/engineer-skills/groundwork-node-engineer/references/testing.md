# Testing

## The Model: Honeycomb, Not Pyramid

Service tests are the default; unit tests are reserved for genuinely complex logic; system tests stay minimal — plus one front-door proof above the honeycomb that drives the real service through its real HTTP API on the real pipeline. This is the framework testing canon's model in full (`docs/principles/foundations/testing.md`, including the fake-needs-a-real-test rule); canon wins on disagreement, this file is the one to fix. Testcontainers spins up a real Postgres in seconds — a confidence categorically different from any mock, and a mock-heavy suite passing while production breaks is the failure mode this buys out.

---

## Tier 1 — Service Perimeter Tests (Default)

Build the app through the **real composition root** and drive it over HTTP with Fastify's `app.inject()` (in-process HTTP — full routing, validation, serialization, no port). Infrastructure runs in containers. Never mock your own repositories — the composition root takes a fake only for non-containerisable providers (LLM APIs, payment processors), passed in as an implementation of the port:

```ts
import { PostgreSqlContainer } from "@testcontainers/postgresql";

let app: FastifyInstance;

beforeAll(async () => {
  const pg = await new PostgreSqlContainer("postgres:16-alpine").start();
  app = await buildApp({
    config: testConfig({ DATABASE_URL: pg.getConnectionUri() }),
    payments: fakePayments, // implements the PaymentGateway port — the only substitution
  });
});

test("POST /orders returns 201 and persists the order", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/orders",
    headers: { "idempotency-key": key() },
    payload: { customerEmail: "a@example.com", quantity: 2 },
  });
  expect(res.statusCode).toBe(201);
  const stored = await db.select().from(orders); // assert real state, not a mock's call log
  expect(stored).toHaveLength(1);
});
```

Route handler, service, validation, and SQL all run for real. Assemble the app only through `buildApp` — a test that hand-wires its own app tests a different app than production runs.

## Tier 2 — Unit Tests (Reserved)

Appropriate when logic is algorithmically dense, pure, and painful to exercise through HTTP.

**What earns a unit test:** domain invariants and business rules, complex transformations, pure algorithms (pricing, cursor encoding, state machines).

**What does NOT:** service methods that orchestrate adapter calls, handlers that validate and delegate, adapters that translate SDK responses — the perimeter test already covers them.

## Tier 3 — System Tests (Rare, Explicit)

- **Bootstrap test** — the composition root constructs the full dependency tree against a real config shape; catches missing env vars and wiring failures.
- **Golden path** — one per critical journey, against the full live stack.

---

## Test Isolation

- Scope containers per suite (Vitest `globalSetup` or a per-file `beforeAll`); reset state by truncation between tests (`database.md`) — truncation beats schema recreation by an order of magnitude.
- Vitest runs test files in parallel workers: give each worker its own database or schema rather than sharing one, or truncation in one file races inserts in another.

## No Coverage Gates

A coverage-gated CI is an anti-pattern: a percentage is gamed without reducing risk, and a suite can execute every line while asserting nothing. Assertion quality over line counts. Mutation testing (Stryker) is the assertion-quality read-out — a **signal, never a gate**, run on high-risk changed code; each surviving mutant is a missing assertion.

## Naming

Name by behaviour, so a failure log alone forms a hypothesis:

```ts
test("returns 422 when quantity exceeds the maximum", ...)  // good
test("create order works", ...)                             // bad
```

## Trace Assertions

Observability is a test surface: a missing span on a critical path is a test failure, not an instrumentation TODO. Register an `InMemorySpanExporter` (`@opentelemetry/sdk-trace-base`) in the test process, exercise the endpoint, and assert the entry span and the work spans exist and stay connected. Assert what the contract promises — the spans a dashboard or SLO depends on — not the whole span tree; pinning every attribute couples the test to implementation and trains the team to delete it.

## Anti-Patterns

- **Mocking your own repositories.** Asserts against your SQL-writing skill, not database behaviour. Testcontainers.
- **Testing delegation.** `expect(spy).toHaveBeenCalledWith(...)` tests the mock, not the code. Assert outcomes — the response and the real state.
- **Coverage-gated CI.** Read coverage as a signal; gate on nothing but green.
- **Snapshot tests as a default.** "Update snapshots" launders bugs into the baseline; assert behaviour.
- **Hand-assembled apps in tests.** Only `buildApp` wires the app; anything else tests fiction.
- **Shared mutable state across parallel workers.** One database per worker, or the suite flakes.
