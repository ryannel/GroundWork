# Testing

## The Model: Honeycomb, Not Pyramid

Fat middle of sociable service-perimeter tests, thin unit layer, few end-to-end checks on top, plus one front-door proof above it that drives the real service through its real HTTP/gRPC API on the real pipeline — the framework testing canon's model in full (`docs/principles/foundations/testing.md`, including the fake-needs-a-real-test rule); canon wins on disagreement, this file is the one to fix. Testcontainers starts real Postgres in seconds, so the old excuse for mocking the database is gone — a mock-heavy suite passing while production breaks is the one failure mode Go has no excuse for.

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

Tests are risk-weighted assertions about production behaviour, not boxes ticked for coverage — the full principle set (service-tests-over-units, real dependencies, observability-as-test-surface, behavioural naming, risk-based depth, tests-are-part-of-the-change) is `docs/principles/foundations/testing.md`; this file states only where Go's tooling and idiom diverge from the general case.

## Trace Assertions

Observability is a test surface (canon principle 3): a missing span is a test failure, not an instrumentation TODO. The mechanism is Go's OTel SDK **in-memory span exporter** (`tracetest.NewInMemoryExporter`):

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

Assert what the contract promises, not the whole span tree (canon principle 3: pinning every attribute couples the test to implementation and trains the team to delete it).

## Mutation Testing — the assertion-quality read-out

Mutation testing is the assertion-quality read-out (canon principle 5): a **signal, never a gate**, run on the high-risk modules the risk matrix flags and on changed code only. Go's tooling is immature — `gremlins` is pre-1.0 and slow on large packages, `go-mutesting` is effectively unmaintained — so here it stays a deliberate, hand-run spot check on a dense package under active change (`gremlins unleash ./internal/pricing`), not a CI expectation. A surviving mutant on changed high-risk code is the missing assertion to add — the same read-out catches AI-generated tests whose oracle was lifted from the implementation.

## Generate the Inputs You Can't Enumerate

The bugs live in the cases you didn't enumerate (canon principle 7). Two generative surfaces apply in Go, both highest-leverage on the **dense, boundary-poor** logic that earns Tier 2 unit tests:

- **Property-based tests** for code with an invariant that holds across a large input space — a round-trip (`Decode(Encode(x)) == x`), a parser that must never panic, a pricing calculation with an algebraic law, a state machine that must preserve a constraint. State the property and let the framework generate and shrink counterexamples. Reach for `pgregory.net/rapid` (modern, shrinks well) over stdlib `testing/quick`; one property covers an infinity of examples, and most caught faults surface on a single generated input.

```go
func TestEncodeDecode_RoundTrips(t *testing.T) {
    rapid.Check(t, func(t *rapid.T) {
        order := genOrder().Draw(t, "order") // a rapid generator for the domain type
        got, err := Decode(Encode(order))
        require.NoError(t, err)
        require.Equal(t, order, got)
    })
}
```

- **Native fuzzing** (`go test -fuzz`) at the byte boundary — parsers, decoders, anything that ingests untrusted input. Coverage-guided, first-class in the toolchain since Go 1.18, and a failing input is saved under `testdata/fuzz/` as a permanent regression seed. Run a fuzz target in a bounded CI lane (`-fuzztime=30s`) on changed parsers, not unbounded on every PR.

The cost is authoring — a meaningful property needs a real invariant and a generator — so reach for these where invariants are real, not everywhere. Where the input space is small or there is no invariant, a table-driven unit test is the right tool.

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
