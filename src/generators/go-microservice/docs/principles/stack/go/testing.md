---
title: Testing
description: Go honeycomb testing with Testcontainers, table-driven tests, service perimeter tests, and httptest.
status: active
last_reviewed: 2026-05-26
---
# Testing

## TL;DR

Service perimeter tests are our default: real Postgres via Testcontainers, real HTTP via `httptest`, no mocks inside the service boundary. Unit tests exist for isolated, complex logic only. The default shape is the **test honeycomb** — a fat middle of sociable service tests, a thin solitary-unit layer, a few end-to-end checks — not the pyramid, which assumes a database in a test is expensive. This is the Go idiom of the framework testing canon (`docs/principles/foundations/testing.md`); the canon is the parent principle and wins on any disagreement.

## Why this matters

Tests that mock the database tell you the code compiles and the mock behaves as you programmed it — not that the real system works. Testcontainers has eliminated the main excuse for mocking Postgres. A service perimeter test catches the handler, service, repository, and schema working together; a unit test catches none of those integration points. The cost of a slow test suite is paid once per CI run; the cost of a mock that diverges from production is paid in incidents.

## The testing tiers

### Tier 1 — Service perimeter tests (default)

Most tests live here. They start a real Postgres container, run migrations, exercise the handler through `httptest.NewRecorder`, and assert on HTTP responses and database state.

```go
func TestCreateMeeting(t *testing.T) {
    ctx := context.Background()

    pg, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
        ContainerRequest: testcontainers.ContainerRequest{
            Image:        "postgres:16",
            ExposedPorts: []string{"5432/tcp"},
            Env: map[string]string{
                "POSTGRES_PASSWORD": "test",
                "POSTGRES_DB":       "service_test",
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

    // run migrations
    require.NoError(t, migrate.Up(ctx, db))

    handler := buildHandler(db) // your composition root helper
    rec := httptest.NewRecorder()
    req := httptest.NewRequest(http.MethodPost, "/meetings", body(t, createReq))
    handler.ServeHTTP(rec, req)

    require.Equal(t, http.StatusCreated, rec.Code)
    // assert database state
}
```

Use `t.Cleanup` for container teardown. Use `require` for fatal assertions; `assert` for non-fatal checks on the same response.

### Tier 2 — Unit tests (complex isolated logic only)

Write a unit test when:

- The function has complex conditional logic or multiple branches that would be expensive to exercise through HTTP
- The function is pure (no I/O, no database) and has clear inputs/outputs
- Validating edge cases would require brittle HTTP request construction

Do not write a unit test because it is faster or easier to write. A unit test that passes while the integrated system is broken is a false signal.

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

Table-driven tests are the Go idiom for parameterised cases. Use a `cases` slice with descriptive `name` fields so failure output identifies which case broke.

### Tier 3 — System tests (rare, explicit)

Full end-to-end tests across multiple live services. These run in a dedicated CI stage against a deployed environment, not on every PR. They are expensive to write and maintain — add one only when no Tier 1 test can reach the integration point being verified.

## Test structure

### Package layout

Test files live in `_test.go` files alongside the code they test. Internal tests use the same package name (`package meetings`); black-box tests use the `_test` suffix (`package meetings_test`). Prefer black-box tests for handlers and services to prevent coupling tests to unexported implementation details.

### Shared test helpers

Shared helpers (container setup, database fixtures, request builders) live in `internal/testutil/` and are only compiled for tests (`package testutil`). They are not shipped with the binary.

### Test isolation

Each test creates its own database state. Use a fresh schema per test run, or truncate tables in `t.Cleanup`. Do not share mutable state across tests — parallel tests will race.

### Parallel tests

Mark independent tests with `t.Parallel()`. Tests that share a container must synchronise table state or use separate databases/schemas. Testcontainers supports `ReuseRequest` for container reuse across a test suite; use it for long-lived containers that are read-only.

## What to mock

Mock only what you cannot make real or what is genuinely too expensive:

| Dependency | Approach |
|---|---|
| Postgres | Real container via Testcontainers |
| External HTTP APIs | `httptest.NewServer` returning canned responses |
| LLM / embedding providers | Interface mock with fixed outputs |
| Pub/Sub | `testcontainers/modules/pubsub` or interface mock |
| Time | Pass `time.Time` / `func() time.Time` as dependency; no global `time.Now` |

Do not mock the database. Do not mock internal service or repository interfaces. Mocking your own internals tests the mock, not the code.

## Running tests

```bash
# all unit and service tests
go test ./...

# with race detector (required before merging concurrency changes)
go test -race ./...

# specific package
go test ./internal/meetings/...

# verbose output for a single test
go test -v -run TestCreateMeeting ./internal/meetings/...
```

## Trace assertions — observability is a test surface

A critical-path request must emit an unbroken trace; a missing span is a test failure, not an instrumentation TODO. The mechanism is the OTel SDK's **in-memory span exporter** — register one in the test process, exercise the handler, and assert on the finished spans (the entry span exists, the work span is its descendant, the attributes a dashboard query depends on are present). Use `go.opentelemetry.io/otel/sdk/trace/tracetest` (`NewInMemoryExporter`), no external tooling. Assert what the contract promises and let the rest float — pinning the whole span tree couples the test to implementation.

## Mutation testing — the assertion-quality read-out

A fat service-perimeter test drives many branches through one HTTP call and can *execute* them all while only asserting on the response body. Mutation testing is the instrument that proves the suite checks what it runs: inject a fault, confirm a test fails; a surviving mutant is a covered-but-unchecked line. It is a **signal, never a gate**. Go's tooling is immature (`gremlins` is pre-1.0 and slow; `go-mutesting` is unmaintained), so here it stays a hand-run spot check on a dense package under active change, not a CI expectation.

## Generate the inputs you can't enumerate

Example-based tests check the cases you thought of; the bugs live in the cases you didn't. For dense, boundary-poor logic with a real invariant — a round-trip, a parser that must never panic, a calculation with an algebraic law — state the property and let the framework generate and shrink counterexamples (`pgregory.net/rapid`, or stdlib `testing/quick`). At the byte boundary, native `go test -fuzz` is first-class for parsers and decoders, and a failing input is saved under `testdata/fuzz/` as a permanent regression seed. Reach for these where invariants are real, not everywhere.

## Naming

Name a test by behaviour, not implementation: `[Function] should [expected outcome] when [condition]`. `TestCreateItem_Success` conveys nothing the dashboard does not already show; a failing name should let an on-call engineer form a hypothesis without opening the file.

## Anti-patterns

- **Mocking the database.** The whole point is to test the repository against a real schema.
- **`testing.Short()` skipping service tests.** Service tests are fast; don't gate-keep them.
- **Test helpers that test nothing.** A helper that builds a fully valid object in one line is fine; a helper that makes assertions on your behalf hides failures.
- **Magic `time.Sleep` in tests.** Use `eventually` loops with tight timeouts, or make the behaviour deterministic.
- **One giant test.** Each test case should be independently runnable and independently failing.
