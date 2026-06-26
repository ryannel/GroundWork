# Testing

## The Model: Honeycomb, Not Pyramid

The default shape is the test honeycomb: a fat middle of sociable service-perimeter tests, a thin layer of solitary unit tests, a few end-to-end checks on top. Testcontainers starts real Postgres in seconds, so the old excuse for mocking the database is gone — and a mock-heavy suite passes while production breaks. This is the stack idiom of the framework testing canon ([`docs/principles/foundations/testing.md`](../../../docs/principles/foundations/testing.md)); when this file and the canon disagree, the canon wins and this file is the one to fix.

## Testing Tiers

### Tier 1 — Service Perimeter Tests (Default)

Most tests live here. Start a real Postgres container, run migrations, exercise the handler through `httptest.NewRecorder`, and assert on HTTP responses and database state.

```go
func TestCreateEntity(t *testing.T) {
    ctx := context.Background()

    pg, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
        ContainerRequest: testcontainers.ContainerRequest{
            Image:        "postgres:16",
            ExposedPorts: []string{"5432/tcp"},
            Env: map[string]string{
                "POSTGRES_PASSWORD": "test",
                "POSTGRES_DB":       "test_db",
            },
            WaitingFor: wait.ForListeningPort("5432/tcp"),
        },
        Started: true,
    })
    require.NoError(t, err)
    t.Cleanup(func() { pg.Terminate(ctx) })

    connStr, _ := pg.ConnectionString(ctx, "sslmode=disable")
    db, err := sql.Open("pgx", connStr)
    require.NoError(t, err)

    require.NoError(t, migrate.Up(ctx, db))

    handler := buildHandler(db)
    rec := httptest.NewRecorder()
    req := httptest.NewRequest(http.MethodPost, "/entities", body(t, createReq))
    handler.ServeHTTP(rec, req)

    require.Equal(t, http.StatusCreated, rec.Code)
}
```

Use `t.Cleanup` for container teardown. Use `require` for fatal assertions; `assert` for non-fatal checks.

### Tier 2 — Unit Tests (Complex Isolated Logic Only)

Write a unit test when:

- The function has complex conditional logic expensive to exercise through HTTP
- The function is pure (no I/O) with clear inputs/outputs
- Edge cases would require brittle HTTP request construction

Do not write a unit test because it is faster or easier. A unit test that passes while the integrated system is broken is a false signal.

```go
func TestScoringLogic(t *testing.T) {
    cases := []struct {
        name  string
        input ScoringInput
        want  float64
    }{
        {"zero input", ScoringInput{}, 0},
        {"full confidence", ScoringInput{Confidence: 1.0, Length: 100}, 1.0},
        {"penalises short segments", ScoringInput{Confidence: 1.0, Length: 5}, 0.5},
    }

    for _, tc := range cases {
        t.Run(tc.name, func(t *testing.T) {
            got := Score(tc.input)
            assert.InDelta(t, tc.want, got, 0.001)
        })
    }
}
```

### Tier 3 — System Tests (Rare, Explicit)

Full end-to-end tests across multiple live services. Run in a dedicated CI stage, not on every PR. Add one only when no Tier 1 test can reach the integration point.

## Test Structure

### Package Layout

Test files live alongside the code they test. Internal tests use the same package name; black-box tests use the `_test` suffix. Prefer black-box tests for handlers and services.

### Shared Test Helpers

Container setup, database fixtures, request builders live in `internal/testutil/` and are only compiled for tests.

### Test Isolation

Each test creates its own database state. Use a fresh schema per test run, or truncate tables in `t.Cleanup`. Do not share mutable state across tests.

### Parallel Tests

Mark independent tests with `t.Parallel()`. Tests sharing a container must synchronise table state or use separate databases.

## What to Mock

| Dependency | Approach |
|---|---|
| Postgres | Real container via Testcontainers |
| External HTTP APIs | `httptest.NewServer` returning canned responses |
| LLM / embedding providers | Interface mock with fixed outputs |
| Pub/Sub | `testcontainers/modules/pubsub` or interface mock |
| Time | Pass `time.Time` / `func() time.Time` as dependency; no global `time.Now` |

Do not mock the database. Do not mock internal service or repository interfaces. Mocking your own internals tests the mock, not the code.

## Testing Foundations

Tests are risk-weighted assertions about production behaviour — not boxes ticked for coverage.

### Core Principles

1. **Favour service tests over solitary unit tests.** Interesting bugs live at the boundaries — HTTP serialisation, SQL query correctness, event emission.
2. **Emulate, don't mock.** If a dependency can run in a container, emulate it.
3. **Observability is a test surface.** Assert that traces are unbroken end-to-end — a missing span is a test failure.
4. **Name tests by behaviour.** `[Function] should [expected outcome] when [condition]`.
5. **Risk-based depth.** Score modules with Impact × Complexity × Change-frequency before deciding test depth.
6. **Tests are part of the change.** A PR without tests is incomplete.

## Trace Assertions

Observability is a test surface (principle 3): a critical-path request must emit an unbroken trace, and a missing span is a test failure, not an instrumentation TODO. The mechanism is an **in-memory span exporter** from the OTel SDK — no external tooling, and the durable approach now that the dedicated trace-test tools have gone dormant.

```go
import (
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
    "go.opentelemetry.io/otel/sdk/trace/tracetest"
)

func TestCreateEntity_EmitsTrace(t *testing.T) {
    exporter := tracetest.NewInMemoryExporter()
    tp := sdktrace.NewTracerProvider(sdktrace.WithSyncer(exporter))
    otel.SetTracerProvider(tp)
    t.Cleanup(func() { _ = tp.Shutdown(context.Background()) })

    // exercise the real handler (Tier 1 setup) ...

    spans := exporter.GetSpans().Snapshots()
    names := spanNames(spans)
    require.Contains(t, names, "POST /entities") // the entry span exists
    require.Contains(t, names, "db.insert")       // the work span exists
    // assert the DB span is a descendant of the entry span — the trace is connected
}
```

Assert what the contract promises — the spans that must exist on the journey, that the trace stays connected across hops, and the attributes a dashboard or SLO query depends on. Pinning the exact span tree and every attribute couples the test to implementation and trains the team to delete it.

## Mutation Testing — the assertion-quality read-out

A fat service-perimeter test drives many branches through one HTTP call and can *execute* them all while only asserting on the response body. Mutation testing is the one instrument that proves the suite checks what it runs: inject a fault, confirm a test fails, and a surviving mutant is a line you cover but do not check. Treat it as a **signal, never a gate** — run it on the high-risk modules the risk matrix flags and on changed code only.

Go's mutation tooling is immature: `gremlins` is pre-1.0 and slow on large packages, and `go-mutesting` is effectively unmaintained. So here it stays a deliberate, hand-run spot check on a dense package under active change (`gremlins unleash ./internal/pricing`), not a CI expectation. Where it surfaces a surviving mutant on changed high-risk code, that is the missing assertion to add — the same read-out catches AI-generated tests whose oracle was lifted from the implementation.

## Anti-Patterns

- **Mocking the database.** Test against a real schema.
- **Snapshot tests as a default.** Acceptable only for genuinely opaque artefacts.
- **Coverage-gated CI.** Use as a read-out, never as a gate.
- **Shared staging environments as test bed.** No hermetic guarantees, no reproducibility.
- **Magic `time.Sleep` in tests.** Use `eventually` loops with tight timeouts.
- **One giant test.** Each test case should be independently runnable and independently failing.

## Bet Slice Rollout — the permanent tests a slice owes

When a bet slice's progress tests go green, the slice-worker rolls out permanent coverage as part of the same slice, before the driver reviews it (bet workflow, Delivery). The bet-progress tests prove the capability once and are archived; these stay.

- **Service perimeter test (always).** One Tier 1 test per capability the slice delivered, exercising the real handler against real Postgres — this is the honeycomb wall that survives refactors.
- **Unit tests (when logic earned them).** Pure-function tests for branching business logic the slice introduced — state machines, pricing rules, parsers. CRUD plumbing does not earn unit tests; the perimeter test already covers it.
- **Property-based tests (when invariants exist).** A slice that introduced an invariant — serialization round-trips, idempotent handlers, commutative merges — pins it with a property test (`testing/quick` or rapid), because example-based tests sample invariants instead of stating them.
- **Critical-path trace assertions (when the slice added an observable path).** A slice that introduced a handler or background job whose trace a dashboard or SLO depends on pins it with an in-memory-exporter test: the entry and work spans exist and the trace stays connected. A missing span is a test failure, not an instrumentation TODO.
- **Contract conformance (when the slice changed an API).** The served OpenAPI must match the promoted spec in `docs/architecture/api/<service>/openapi.yaml`; the generated system suite checks this — the slice's job is to keep the spec promotion current, not to hand-write the check.
