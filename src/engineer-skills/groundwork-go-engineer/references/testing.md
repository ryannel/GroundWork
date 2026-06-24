# Testing

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

## Anti-Patterns

- **Mocking the database.** Test against a real schema.
- **Snapshot tests as a default.** Acceptable only for genuinely opaque artefacts.
- **Coverage-gated CI.** Use as a read-out, never as a gate.
- **Shared staging environments as test bed.** No hermetic guarantees, no reproducibility.
- **Magic `time.Sleep` in tests.** Use `eventually` loops with tight timeouts.
- **One giant test.** Each test case should be independently runnable and independently failing.

## Bet Slice Rollout — the permanent tests a slice owes

When a bet slice's progress tests go green, the slice rolls out permanent coverage before it closes (bet workflow, Delivery step 5). The bet-progress tests prove the capability once and are archived; these stay.

- **Service perimeter test (always).** One Tier 1 test per capability the slice delivered, exercising the real handler against real Postgres — this is the honeycomb wall that survives refactors.
- **Unit tests (when logic earned them).** Pure-function tests for branching business logic the slice introduced — state machines, pricing rules, parsers. CRUD plumbing does not earn unit tests; the perimeter test already covers it.
- **Property-based tests (when invariants exist).** A slice that introduced an invariant — serialization round-trips, idempotent handlers, commutative merges — pins it with a property test (`testing/quick` or rapid), because example-based tests sample invariants instead of stating them.
- **Contract conformance (when the slice changed an API).** The served OpenAPI must match the promoted spec in `docs/architecture/api/<service>/openapi.yaml`; the generated system suite checks this — the slice's job is to keep the spec promotion current, not to hand-write the check.
