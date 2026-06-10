---
title: Testing
description: Go honeycomb testing with Testcontainers, table-driven tests, service perimeter tests, and httptest.
status: active
last_reviewed: 2026-05-26
---
# Testing

## TL;DR

Service perimeter tests are our default: real Postgres via Testcontainers, real HTTP via `httptest`, no mocks inside the service boundary. Unit tests exist for isolated, complex logic only. The test pyramid does not apply to services that can spin up a real database in two seconds.

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

## Anti-patterns

- **Mocking the database.** The whole point is to test the repository against a real schema.
- **`testing.Short()` skipping service tests.** Service tests are fast; don't gate-keep them.
- **Test helpers that test nothing.** A helper that builds a fully valid object in one line is fine; a helper that makes assertions on your behalf hides failures.
- **Magic `time.Sleep` in tests.** Use `eventually` loops with tight timeouts, or make the behaviour deterministic.
- **One giant test.** Each test case should be independently runnable and independently failing.
