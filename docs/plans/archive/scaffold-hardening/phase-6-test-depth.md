# Phase 6 — Per-component test depth

**Prerequisite:** Phases 1–4 complete (the behavior under test exists — real auth wiring, rate limit, readiness, real CRUD/idempotency/outbox repositories). Tasks 6.2 and 6.4-readyz assert *real persistence/connectivity* added by those phases; against the current STUB repositories (`internal/provider/postgres.go.template` Create/GetByID/outbox all `return nil`, `idempotency/repository.go.template` Get/Save `return nil`) they fail by design — that is the FAIL LOUD signal, not a bug in the test.

**Phase goal:** Add per-component unit/middleware tests with REAL assertions for the behavior Phases 1–4 introduced, going beyond the Phase 0 single integration test (`cmd/api/main_test.go.template`). Every test must drive real code paths (httptest for handler/middleware, testcontainers for the data layer, real Svix signing for webhooks) and assert concrete outcomes — never `assert True` / `pass`.

**Phase acceptance gate (run from each freshly regenerated service dir):**
- `npm run build` (rebuild generators after every `generator.ts` edit) — exit 0.
- Regenerate the sample workspace (commands in REPO CONTEXT) — generator exits 0 for every option combo.
- `./dev test generation` — still **159 pass** (structural tests unchanged; new test templates are gated/deleted correctly so no minimal-workspace combo gains an orphaned file).
- `./dev test compilation` — green. NOTE: the Go compilation step is `go build ./...`, which does **NOT** compile `_test.go` files; the Next.js step is `pnpm tsc --noEmit`, which **DOES** typecheck `.test.ts`; the Python step is only `import src.main`. So compilation alone does not exercise the new suites — the unit suites below are the real gate.
- Unit suites green per service:
  - Go: `go test ./...` (clerk combo and non-clerk combo; messaging combo and `none` combo).
  - Python: `uv sync --extra dev && uv run pytest` (postgres combo; `rest` enabled).
  - Next.js: `pnpm install && pnpm test` (apiProxy combo; clerk + non-clerk combo).

---

### Task 6.1 — Go API middleware tests (load shed, timeout, rate limit, auth, idempotency)
- **Files:**
  - NEW `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/entrypoints/api/middleware_test.go.template`
  - NEW `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/entrypoints/api/idempotency/middleware_test.go.template`
  - NEW `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/entrypoints/api/auth_middleware_test.go.template`
  - EDIT `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/generator.ts` (gate the clerk-only auth test)
- **Depends on:** none (middleware logic is real; idempotency test uses a fake in-memory `Repository`, no DB).
- **Goal:** Prove `LoadSheddingMiddleware` returns 503 past `maxConcurrent`, `TimeoutMiddleware` returns 503 (`http.TimeoutHandler`) when the handler exceeds the deadline, `RateLimitMiddleware` returns 429 after the token bucket empties, the idempotency `Middleware` replays the cached response on a duplicate key, and (clerk only) `AuthMiddleware` bypasses `/health` and rejects with 401 when Clerk verification fails.
- **Anchor (current code to find / pattern to match):**
  - httptest + testify pattern, from `cmd/api/main_test.go.template` (lines 88–98):
    ```go
    req := httptest.NewRequest(http.MethodGet, "/health", nil)
    req = req.WithContext(ctx)
    rr := httptest.NewRecorder()
    router.ServeHTTP(rr, req)
    require.Equal(t, http.StatusOK, rr.Code)
    ```
  - Middleware signatures under test, `internal/entrypoints/api/middleware_loadshed.go.template` (lines 11, 34) and `middleware_ratelimit.go.template` (line 19):
    ```go
    func LoadSheddingMiddleware(maxConcurrent int) func(http.Handler) http.Handler
    func TimeoutMiddleware(timeout time.Duration) func(http.Handler) http.Handler
    func RateLimitMiddleware(redisURL string, db *sql.DB) func(http.Handler) http.Handler  // memorystore: Tokens:15, Interval: time.Minute
    ```
  - Idempotency contract, `internal/entrypoints/api/idempotency/repository.go.template` (lines 9–19):
    ```go
    type CachedResponse struct { Status int; Header map[string][]string; Body []byte }
    type Repository interface {
        Get(ctx context.Context, key string, userID string) (*CachedResponse, error)
        Save(ctx context.Context, key string, userID string, resp *CachedResponse) error
    }
    func Middleware(repo Repository) func(http.Handler) http.Handler  // middleware.go.template
    ```
  - Auth bypass rule, `middleware_auth.go.template` (lines 30–37): paths under `/health` and `/webhooks` skip Clerk; everything else hits `clerkhttp.RequireHeaderAuthorization()`.
- **Change:**

  `internal/entrypoints/api/middleware_test.go.template` (NOT clerk-gated — these three middlewares exist in every Go build):
  ```go
  package api

  import (
  	"net/http"
  	"net/http/httptest"
  	"sync"
  	"testing"
  	"time"

  	"github.com/stretchr/testify/require"
  )

  // okHandler always returns 200.
  func okHandler() http.Handler {
  	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
  		w.WriteHeader(http.StatusOK)
  	})
  }

  func TestLoadSheddingMiddleware_ShedsBeyondCapacity(t *testing.T) {
  	// maxConcurrent = 1. First request blocks inside the handler holding the only
  	// slot; the second must be shed with 503 immediately.
  	release := make(chan struct{})
  	entered := make(chan struct{})
  	blocking := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
  		entered <- struct{}{}
  		<-release
  		w.WriteHeader(http.StatusOK)
  	})

  	h := LoadSheddingMiddleware(1)(blocking)

  	var wg sync.WaitGroup
  	wg.Add(1)
  	rr1 := httptest.NewRecorder()
  	go func() {
  		defer wg.Done()
  		h.ServeHTTP(rr1, httptest.NewRequest(http.MethodGet, "/", nil))
  	}()

  	<-entered // first request now occupies the only slot

  	rr2 := httptest.NewRecorder()
  	h.ServeHTTP(rr2, httptest.NewRequest(http.MethodGet, "/", nil))
  	require.Equal(t, http.StatusServiceUnavailable, rr2.Code, "second concurrent request must be shed")
  	require.Equal(t, "5", rr2.Header().Get("Retry-After"))

  	close(release)
  	wg.Wait()
  	require.Equal(t, http.StatusOK, rr1.Code, "first request completes normally")
  }

  func TestTimeoutMiddleware_TimesOut(t *testing.T) {
  	slow := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
  		time.Sleep(100 * time.Millisecond)
  		w.WriteHeader(http.StatusOK)
  	})
  	h := TimeoutMiddleware(10 * time.Millisecond)(slow)

  	rr := httptest.NewRecorder()
  	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))
  	// http.TimeoutHandler responds 503 with the configured message when exceeded.
  	require.Equal(t, http.StatusServiceUnavailable, rr.Code)
  	require.Contains(t, rr.Body.String(), "Request Timeout")
  }

  func TestRateLimitMiddleware_429AfterThreshold(t *testing.T) {
  	// memorystore is configured with Tokens:15 per minute. The 16th request from
  	// the same IP within the window must be rejected with 429.
  	h := RateLimitMiddleware("", nil)(okHandler())

  	var last int
  	for i := 0; i < 16; i++ {
  		rr := httptest.NewRecorder()
  		req := httptest.NewRequest(http.MethodGet, "/", nil)
  		req.RemoteAddr = "203.0.113.7:12345" // stable key for IPKeyFunc
  		h.ServeHTTP(rr, req)
  		last = rr.Code
  	}
  	require.Equal(t, http.StatusTooManyRequests, last, "16th request within window must be rate limited")
  }
  ```

  `internal/entrypoints/api/idempotency/middleware_test.go.template` (NOT gated; idempotency middleware exists in every build):
  ```go
  package idempotency

  import (
  	"context"
  	"net/http"
  	"net/http/httptest"
  	"sync/atomic"
  	"testing"

  	"github.com/stretchr/testify/require"
  )

  // fakeRepo is an in-memory Repository for testing the middleware without a DB.
  type fakeRepo struct {
  	store map[string]*CachedResponse
  }

  func newFakeRepo() *fakeRepo { return &fakeRepo{store: map[string]*CachedResponse{}} }

  func (f *fakeRepo) Get(ctx context.Context, key, userID string) (*CachedResponse, error) {
  	return f.store[key+":"+userID], nil
  }
  func (f *fakeRepo) Save(ctx context.Context, key, userID string, resp *CachedResponse) error {
  	f.store[key+":"+userID] = resp
  	return nil
  }

  func TestIdempotencyMiddleware_DuplicateKeyReplaysCached(t *testing.T) {
  	repo := newFakeRepo()

  	var calls int32
  	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
  		atomic.AddInt32(&calls, 1)
  		w.Header().Set("Content-Type", "application/json")
  		w.WriteHeader(http.StatusCreated)
  		_, _ = w.Write([]byte(`{"id":"abc"}`))
  	})
  	h := Middleware(repo)(handler)

  	// First POST executes the handler and caches the 201 response.
  	rr1 := httptest.NewRecorder()
  	req1 := httptest.NewRequest(http.MethodPost, "/api/v1/entities", nil)
  	req1.Header.Set("Idempotency-Key", "key-1")
  	h.ServeHTTP(rr1, req1)
  	require.Equal(t, http.StatusCreated, rr1.Code)
  	require.Equal(t, `{"id":"abc"}`, rr1.Body.String())

  	// Duplicate POST with the same key replays the cached response; handler not re-run.
  	rr2 := httptest.NewRecorder()
  	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/entities", nil)
  	req2.Header.Set("Idempotency-Key", "key-1")
  	h.ServeHTTP(rr2, req2)
  	require.Equal(t, http.StatusCreated, rr2.Code)
  	require.Equal(t, `{"id":"abc"}`, rr2.Body.String())

  	require.Equal(t, int32(1), atomic.LoadInt32(&calls), "handler must execute exactly once for a repeated key")
  }

  func TestIdempotencyMiddleware_GetBypassesCache(t *testing.T) {
  	repo := newFakeRepo()
  	var calls int32
  	h := Middleware(repo)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
  		atomic.AddInt32(&calls, 1)
  		w.WriteHeader(http.StatusOK)
  	}))

  	for i := 0; i < 2; i++ {
  		rr := httptest.NewRecorder()
  		req := httptest.NewRequest(http.MethodGet, "/api/v1/entities", nil)
  		req.Header.Set("Idempotency-Key", "key-2")
  		h.ServeHTTP(rr, req)
  		require.Equal(t, http.StatusOK, rr.Code)
  	}
  	require.Equal(t, int32(2), atomic.LoadInt32(&calls), "GET must never be deduplicated")
  }
  ```

  `internal/entrypoints/api/auth_middleware_test.go.template` (FULLY clerk-gated with EJS so it only emits for `auth === 'clerk'`):
  ```go
  <% if (auth === 'clerk') { %>package api

  import (
  	"net/http"
  	"net/http/httptest"
  	"testing"

  	"github.com/stretchr/testify/require"
  )

  func protectedHandler() http.Handler {
  	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
  		w.WriteHeader(http.StatusOK)
  		_, _ = w.Write([]byte("protected"))
  	})
  }

  // VERIFY when implementing: clerkhttp.RequireHeaderAuthorization may require a
  // configured Clerk secret key to construct. Run `go test -run TestAuthMiddleware`
  // on a clerk build first. If it panics/errors instead of returning 401 for the
  // missing/bad-token cases, set a dummy key in a package-level setup, e.g.:
  //   func init() { clerk.SetKey("sk_test_dummy") }   // import "github.com/clerk/clerk-sdk-go/v2"
  // The 401 assertions below assume the SDK rejects an absent/unverifiable token —
  // confirm empirically, do not assume.

  func TestAuthMiddleware_BypassesHealthAndWebhooks(t *testing.T) {
  	h := AuthMiddleware()(protectedHandler())

  	for _, path := range []string{"/health", "/webhooks/clerk"} {
  		rr := httptest.NewRecorder()
  		h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, path, nil))
  		require.Equal(t, http.StatusOK, rr.Code, "auth must bypass %s", path)
  	}
  }

  func TestAuthMiddleware_RejectsMissingToken(t *testing.T) {
  	// No Authorization header on a protected route -> Clerk's RequireHeaderAuthorization
  	// rejects with 401 before reaching the inner handler.
  	h := AuthMiddleware()(protectedHandler())
  	rr := httptest.NewRecorder()
  	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/v1/entities", nil))
  	require.Equal(t, http.StatusUnauthorized, rr.Code)
  }

  func TestAuthMiddleware_RejectsBadToken(t *testing.T) {
  	h := AuthMiddleware()(protectedHandler())
  	rr := httptest.NewRecorder()
  	req := httptest.NewRequest(http.MethodGet, "/api/v1/entities", nil)
  	req.Header.Set("Authorization", "Bearer not-a-real-jwt")
  	h.ServeHTTP(rr, req)
  	require.Equal(t, http.StatusUnauthorized, rr.Code, "an unverifiable token must not pass")
  }
  <% } %>
  ```

  `generator.ts` edit — add the new clerk-gated test to the EXISTING `if (options.auth !== 'clerk')` deletion block (find the block deleting `middleware_auth.go` / `clerk_webhook.go`):
  ```ts
    if (options.auth !== 'clerk') {
      tree.delete(`${projectRoot}/internal/entrypoints/api/middleware_auth.go`);
      tree.delete(`${projectRoot}/internal/entrypoints/api/auth_middleware_test.go`); // ADD
      tree.delete(`${projectRoot}/internal/entrypoints/api/clerk_webhook.go`);
      // ... existing deletes unchanged ...
    }
  ```
  > Do NOT add the EJS `<% if %>` wrapper as the only guard for the clerk test — an empty `.go` file (zero bytes after EJS) still emits and `go test` will fail on an empty package file. Keep BOTH the EJS guard AND the `tree.delete`. (Same pattern Phase-4 used for `clerk_webhook.go`.)
- **Acceptance:**
  - `npm run build` → exit 0.
  - Regenerate `api` with `--auth clerk` and a second service with `--auth none`.
  - clerk service: `go test ./internal/entrypoints/api/... ./internal/entrypoints/api/idempotency/...` → PASS (auth + middleware + idempotency tests run).
  - none service: confirm `internal/entrypoints/api/auth_middleware_test.go` is ABSENT (`test -f ... && echo PRESENT || echo absent` → absent) and `go test ./internal/entrypoints/api/...` → PASS (loadshed/timeout/ratelimit + idempotency still run).
  - `./dev test compilation` → green; `./dev test generation` → 159 pass.
- **Guardrails:** Real assertions only — every test asserts a concrete status code / call count, no `t.Skip` without env reason, no `pass`. Idempotency test uses the in-memory `fakeRepo` (the real interface), not the Postgres stub. Clerk test is gated by BOTH EJS and `tree.delete`. RateLimit test pins `RemoteAddr` so `IPKeyFunc()` keys are stable. Use `httptest`, no DB.

---

### Task 6.2 — Go data-layer tests (repository CRUD, tx commit/rollback, outbox)
- **Files:**
  - NEW `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/provider/postgres_test.go.template`
  - (No generator.ts edit for the file itself — it lives in a package present in every build. The outbox section is EJS-gated inside the file.)
- **Depends on:** Phases 1–4 (real `PostgresRepository.Create/GetByID/Update/Delete` and `OutboxRepository.InsertEvent/PollUnpublished/MarkPublished` — currently STUBS returning nil; against stubs these tests fail by design, proving FAIL LOUD). Task 6.1 independent.
- **Goal:** Against a real testcontainers Postgres with `db/schema.sql` applied: round-trip an `Entity` (Create then GetByID returns it; Update mutates; Delete removes → GetByID errors); verify real transactional semantics on the raw `*sql.Tx` (rollback discards, commit persists) and that the manager's Begin→Commit/Rollback lifecycle works; and (messaging only) verify outbox InsertEvent → PollUnpublished returns it → MarkPublished removes it from the unpublished set. The CRUD and outbox tests depend on Phase-1-4 real repos; the transaction tests pass today.
- **Anchor (current code to find / pattern to match) — mirror the container + schema setup from `cmd/api/main_test.go.template` lines 24–72, adjusting the schema path for depth:**
  ```go
  func TestAPIIntegration(t *testing.T) {
  	if testing.Short() { t.Skip("skipping integration test") }
  	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute); defer cancel()
  	pgContainer, err := postgres.RunContainer(ctx,
  		testcontainers.WithImage("postgres:16-alpine"),
  		postgres.WithDatabase("<%= name %>_test"),
  		postgres.WithUsername("testuser"), postgres.WithPassword("testpass"),
  		testcontainers.WithWaitStrategy(
  			wait.ForLog("database system is ready to accept connections").
  				WithOccurrence(2).WithStartupTimeout(5*time.Second)))
  	require.NoError(t, err)
  	defer func() { _ = pgContainer.Terminate(context.Background()) }()
  	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable"); require.NoError(t, err)
  	// schema applied via: db, _ := provider.NewPostgresDB(uri); db.DB.ExecContext(ctx, string(schemaBytes))
  ```
  > Package note: this test lives in `internal/provider/` (package `provider`), three dirs deep, so the schema path is `filepath.Join("..", "..", "db", "schema.sql")` — SAME depth as `cmd/api`, confirm before shipping.
  > Method signatures under test (`provider/postgres.go.template`): `Create(ctx, *domain.Entity) error`, `GetByID(ctx, id) (*domain.Entity, error)`, `Update`, `Delete`, `Begin(ctx) (gateway.Transaction, error)`, and (messaging) `InsertEvent(ctx, tx, eventType string, payload []byte)`, `PollUnpublished(ctx, limit) ([]gateway.OutboxEvent, error)`, `MarkPublished(ctx, id string)`.
- **Change:** `internal/provider/postgres_test.go.template`:
  ```go
  package provider

  import (
  	"context"
  	"os"
  	"path/filepath"
  	"testing"
  	"time"

  	"github.com/stretchr/testify/require"
  	"github.com/testcontainers/testcontainers-go"
  	"github.com/testcontainers/testcontainers-go/modules/postgres"
  	"github.com/testcontainers/testcontainers-go/wait"

  	"<%= name %>/internal/core/domain"

  	_ "github.com/lib/pq"
  )

  // setupTestDB starts a Postgres container, applies db/schema.sql, and returns a live PostgresDB.
  func setupTestDB(t *testing.T) (*PostgresDB, context.Context) {
  	t.Helper()
  	if testing.Short() {
  		t.Skip("skipping data-layer integration test in -short mode")
  	}
  	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
  	t.Cleanup(cancel)

  	pgContainer, err := postgres.RunContainer(ctx,
  		testcontainers.WithImage("postgres:16-alpine"),
  		postgres.WithDatabase("<%= name %>_test"),
  		postgres.WithUsername("testuser"),
  		postgres.WithPassword("testpass"),
  		testcontainers.WithWaitStrategy(
  			wait.ForLog("database system is ready to accept connections").
  				WithOccurrence(2).WithStartupTimeout(30*time.Second)),
  	)
  	require.NoError(t, err)
  	t.Cleanup(func() { _ = pgContainer.Terminate(context.Background()) })

  	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
  	require.NoError(t, err)

  	db, err := NewPostgresDB(connStr)
  	require.NoError(t, err)
  	t.Cleanup(func() { _ = db.Close() })

  	// internal/provider -> ../../db/schema.sql (same depth as cmd/api)
  	schemaPath := filepath.Join("..", "..", "db", "schema.sql")
  	schemaBytes, err := os.ReadFile(schemaPath)
  	require.NoError(t, err, "failed to read schema.sql from %s", schemaPath)
  	_, err = db.DB.ExecContext(ctx, string(schemaBytes))
  	require.NoError(t, err, "failed to apply schema")

  	return db, ctx
  }

  func TestPostgresRepository_CRUDRoundTrip(t *testing.T) {
  	db, ctx := setupTestDB(t)
  	repo := NewPostgresRepository(db)

  	ent := &domain.Entity{Name: "first"}
  	require.NoError(t, repo.Create(ctx, ent))
  	require.NotEmpty(t, ent.ID, "Create must populate the generated ID")

  	got, err := repo.GetByID(ctx, ent.ID)
  	require.NoError(t, err)
  	require.Equal(t, "first", got.Name)

  	got.Name = "renamed"
  	require.NoError(t, repo.Update(ctx, got))
  	reloaded, err := repo.GetByID(ctx, ent.ID)
  	require.NoError(t, err)
  	require.Equal(t, "renamed", reloaded.Name)

  	require.NoError(t, repo.Delete(ctx, ent.ID))
  	_, err = repo.GetByID(ctx, ent.ID)
  	require.Error(t, err, "GetByID after Delete must return an error (not found)")
  }

  // NOTE on transactional writes: gateway.Transaction exposes only Commit/Rollback,
  // not Exec — you cannot write *through* the gateway tx from a test. So we verify
  // real transactional semantics directly on the raw *sql.Tx the wrapper holds
  // (db.DB.BeginTx), AND verify the manager's Begin→Commit/Rollback lifecycle works.
  // Do NOT route writes through db.DB.ExecContext and then call tx.Commit/Rollback:
  // a pool Exec autocommits on a *different* connection, so the manager tx would be
  // a no-op and the assertion would be meaningless.

  func TestPostgresTransaction_RawRollbackDiscards(t *testing.T) {
  	db, ctx := setupTestDB(t)

  	tx, err := db.DB.BeginTx(ctx, nil)
  	require.NoError(t, err)
  	_, err = tx.ExecContext(ctx, "INSERT INTO entities (name) VALUES ('rolled-back')")
  	require.NoError(t, err)
  	require.NoError(t, tx.Rollback())

  	var count int
  	err = db.DB.QueryRowContext(ctx, "SELECT count(*) FROM entities WHERE name = 'rolled-back'").Scan(&count)
  	require.NoError(t, err)
  	require.Equal(t, 0, count, "rolled-back insert must not persist")
  }

  func TestPostgresTransaction_RawCommitPersists(t *testing.T) {
  	db, ctx := setupTestDB(t)

  	tx, err := db.DB.BeginTx(ctx, nil)
  	require.NoError(t, err)
  	_, err = tx.ExecContext(ctx, "INSERT INTO entities (name) VALUES ('committed')")
  	require.NoError(t, err)
  	require.NoError(t, tx.Commit())

  	var count int
  	err = db.DB.QueryRowContext(ctx, "SELECT count(*) FROM entities WHERE name = 'committed'").Scan(&count)
  	require.NoError(t, err)
  	require.Equal(t, 1, count, "committed insert must persist")
  }

  func TestPostgresTransactionManager_BeginCommitRollbackLifecycle(t *testing.T) {
  	db, ctx := setupTestDB(t)
  	tm := NewPostgresTransactionManager(db)

  	// Begin → Commit must succeed.
  	txA, err := tm.Begin(ctx)
  	require.NoError(t, err)
  	require.NoError(t, txA.Commit(ctx))

  	// Begin → Rollback must succeed.
  	txB, err := tm.Begin(ctx)
  	require.NoError(t, err)
  	require.NoError(t, txB.Rollback(ctx))
  }

  <% if (messaging !== 'none') { %>
  func TestOutboxRepository_InsertPollMark(t *testing.T) {
  	db, ctx := setupTestDB(t)
  	repo := NewOutboxRepository(db)
  	tm := NewPostgresTransactionManager(db)

  	tx, err := tm.Begin(ctx)
  	require.NoError(t, err)
  	require.NoError(t, repo.InsertEvent(ctx, tx, "entity.created", []byte(`{"id":"e1"}`)))
  	require.NoError(t, tx.Commit(ctx))

  	events, err := repo.PollUnpublished(ctx, 10)
  	require.NoError(t, err)
  	require.Len(t, events, 1, "the inserted event must be pollable as unpublished")
  	require.Equal(t, "entity.created", events[0].EventType)

  	require.NoError(t, repo.MarkPublished(ctx, events[0].ID))

  	after, err := repo.PollUnpublished(ctx, 10)
  	require.NoError(t, err)
  	require.Empty(t, after, "a published event must no longer appear as unpublished")
  }
  <% } %>
  ```
- **Acceptance:**
  - `npm run build` → exit 0.
  - Regenerate `api --messaging kafka` (outbox table present) and a second `api --messaging none`.
  - kafka service: `go test ./internal/provider/...` (Docker available) → the 3 transaction-lifecycle tests PASS today; the CRUD round-trip and outbox tests PASS *once Phases 1–4 land*. Against current stubs, expect ONLY the CRUD/outbox tests to fail — that is correct (FAIL LOUD); note it in the PR. (If a transaction test fails, that is a real bug to fix, not expected.)
  - none service: confirm outbox test is absent from the emitted file (`grep -c TestOutboxRepository internal/provider/postgres_test.go` → 0) and `go test ./internal/provider/...` runs CRUD + tx tests.
  - `./dev test compilation` (build-only) → green; `./dev test generation` → 159.
- **Guardrails:** Real testcontainers Postgres + real `db/schema.sql`, no mocks. Outbox section EJS-gated by `messaging !== 'none'` (no `tree.delete` needed — the file is in a package present in all builds, only the section is conditional). Skip is explicit only via `testing.Short()`. Schema path depth confirmed `../../db/schema.sql`. Each test gets its own container via `setupTestDB` for isolation.

---

### Task 6.3 — Go Clerk webhook signature tests
- **Files:**
  - NEW `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/entrypoints/api/clerk_webhook_test.go.template`
  - EDIT `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/generator.ts` (gate alongside `clerk_webhook.go`)
- **Depends on:** Task 6.1 (shares the clerk gating block edit — coordinate so both deletes land in the same `if (options.auth !== 'clerk')` block).
- **Goal:** Prove `ClerkWebhookHandler` rejects a missing signature (400), rejects a tampered/bad signature (400), returns 500 when the signing secret is empty, and accepts a request signed with a valid Svix signature (200 `{"status":"ok"}`). Construct the valid signature in-test with the same `svix` library the handler uses.
- **Anchor (current code to find / pattern to match) — handler under test, `internal/entrypoints/api/clerk_webhook.go.template` lines 38–96:**
  ```go
  func ClerkWebhookHandler(userService *service.UserService, webhookSigningSecret string) http.HandlerFunc {
  	// secret == "" -> 500 "webhook not configured"
  	// wh, _ := svix.NewWebhook(webhookSigningSecret)
  	// headers: svix-id, svix-timestamp, svix-signature from request
  	// wh.Verify(body, headers) err -> 400 "invalid signature"
  	// success -> 200 {"status":"ok"}
  ```
  Svix lib is already in go.mod for clerk builds: `github.com/svix/svix-webhooks v1.90.0` (import path `svix "github.com/svix/svix-webhooks/go"`). A `*service.UserService` is constructed via `service.NewUserService(userRepo)` (see `main.go.template` line 107); for "unknown event type" payloads the handler never touches the service, so a `nil` service is safe in tests that send a non-user event type.
- **Change:** `internal/entrypoints/api/clerk_webhook_test.go.template` (FULLY clerk-gated):
  ```go
  <% if (auth === 'clerk') { %>package api

  import (
  	"crypto/hmac"
  	"crypto/sha256"
  	"encoding/base64"
  	"fmt"
  	"net/http"
  	"net/http/httptest"
  	"strings"
  	"testing"
  	"time"

  	"github.com/stretchr/testify/require"
  )

  // testSecret is a Svix-format signing secret ("whsec_" + base64). The body of the
  // secret after the prefix must be valid base64 because the verifier decodes it.
  const testSecret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"

  // signSvix produces a valid v1 Svix signature for the given id/timestamp/payload,
  // matching what svix.Webhook.Verify expects.
  func signSvix(t *testing.T, secret, msgID string, ts time.Time, payload []byte) string {
  	t.Helper()
  	secretBytes, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(secret, "whsec_"))
  	require.NoError(t, err)
  	toSign := fmt.Sprintf("%s.%d.%s", msgID, ts.Unix(), string(payload))
  	mac := hmac.New(sha256.New, secretBytes)
  	_, _ = mac.Write([]byte(toSign))
  	sig := base64.StdEncoding.EncodeToString(mac.Sum(nil))
  	return "v1," + sig
  }

  func TestClerkWebhook_MissingSecretReturns500(t *testing.T) {
  	h := ClerkWebhookHandler(nil, "")
  	rr := httptest.NewRecorder()
  	h.ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/webhooks/clerk", strings.NewReader("{}")))
  	require.Equal(t, http.StatusInternalServerError, rr.Code)
  }

  func TestClerkWebhook_MissingSignatureReturns400(t *testing.T) {
  	h := ClerkWebhookHandler(nil, testSecret)
  	rr := httptest.NewRecorder()
  	req := httptest.NewRequest(http.MethodPost, "/webhooks/clerk", strings.NewReader("{}"))
  	// No svix-* headers set.
  	h.ServeHTTP(rr, req)
  	require.Equal(t, http.StatusBadRequest, rr.Code)
  }

  func TestClerkWebhook_BadSignatureReturns400(t *testing.T) {
  	h := ClerkWebhookHandler(nil, testSecret)
  	rr := httptest.NewRecorder()
  	req := httptest.NewRequest(http.MethodPost, "/webhooks/clerk", strings.NewReader("{}"))
  	req.Header.Set("svix-id", "msg_test")
  	req.Header.Set("svix-timestamp", fmt.Sprintf("%d", time.Now().Unix()))
  	req.Header.Set("svix-signature", "v1,deadbeefnotavalidsignature")
  	h.ServeHTTP(rr, req)
  	require.Equal(t, http.StatusBadRequest, rr.Code)
  }

  func TestClerkWebhook_ValidSignatureReturns200(t *testing.T) {
  	// Use an unhandled event type so the handler verifies the signature and
  	// returns 200 without invoking the (nil) UserService.
  	payload := []byte(`{"type":"session.created","data":{}}`)
  	msgID := "msg_valid"
  	ts := time.Now()

  	h := ClerkWebhookHandler(nil, testSecret)
  	rr := httptest.NewRecorder()
  	req := httptest.NewRequest(http.MethodPost, "/webhooks/clerk", strings.NewReader(string(payload)))
  	req.Header.Set("svix-id", msgID)
  	req.Header.Set("svix-timestamp", fmt.Sprintf("%d", ts.Unix()))
  	req.Header.Set("svix-signature", signSvix(t, testSecret, msgID, ts, payload))
  	h.ServeHTTP(rr, req)

  	require.Equal(t, http.StatusOK, rr.Code)
  	require.Contains(t, rr.Body.String(), `"status":"ok"`)
  }
  <% } %>
  ```
  `generator.ts` edit — add to the SAME `if (options.auth !== 'clerk')` block as Task 6.1:
  ```ts
    if (options.auth !== 'clerk') {
      // ... existing deletes ...
      tree.delete(`${projectRoot}/internal/entrypoints/api/clerk_webhook.go`);
      tree.delete(`${projectRoot}/internal/entrypoints/api/clerk_webhook_test.go`); // ADD
      // ...
    }
  ```
- **Acceptance:**
  - `npm run build` → exit 0.
  - clerk service: `go test ./internal/entrypoints/api/ -run TestClerkWebhook` → 4 tests PASS (valid signature accepted, all invalid cases rejected). If `signSvix` disagrees with `svix.Verify`, the valid-signature test FAILS loudly — fix the construction, do not skip.
  - none service: `test -f internal/entrypoints/api/clerk_webhook_test.go` → absent; `go build ./...` and `go test ./...` → green (svix not imported anywhere).
  - `./dev test generation` → 159.
- **Guardrails:** Valid signature constructed in-test via HMAC-SHA256 in the exact Svix `id.timestamp.body` format — no mocking of `svix.Verify`. Gated by BOTH EJS and `tree.delete`. `nil` UserService only used with non-user event types so the service is never dereferenced. No silent skips.

---

### Task 6.4 — Python tests (idempotency replay, livez/readyz, worker errors, LLM circuit breaker)
- **Files:**
  - EDIT `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/tests/test_main.py.template` (REPLACE the `pass`/undefined-`/example` anti-patterns)
  - NEW `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/tests/test_middleware.py.template`
  - NEW `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/tests/test_worker.py.template`
  - NEW `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/tests/test_llm_gateway.py.template`
  - EDIT `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/generator.ts` (gate worker/llm tests to match their source deletions)
- **Depends on:** none for the readyz/idempotency/worker/LLM tests — they pass today. (The readyz test drives the EXISTING `app.state.startup_failed` 503 branch; the comment in it flags tightening to a real DB ping once Phases 1–4 add one, but the test does not require that.)
- **Goal:** Replace the existing weak tests with real ones: idempotency middleware replays the cached response for a duplicate `Idempotency-Key` (using a real in-memory `IdempotencyRepository` bound to `app.state`); `/livez`+`/healthz` return alive; `/readyz` returns 503 when the backing dependency is unavailable; the worker `handler` returns an error dict on missing `prompt` (boundary validation) and echoes on valid input; the LLM gateway maps `openai.APIConnectionError` → `TransientInferenceError` and trips the circuit breaker to `CircuitBreakerOpenError` after repeated transient failures.
- **Anchor (current code to find / pattern to match) — fixtures from `tests/test_main.py.template` lines 8–39:**
  ```python
  from testcontainers.postgres import PostgresContainer
  @pytest.fixture(scope="session", autouse=True)
  def setup_postgres():
      with PostgresContainer("postgres:15-alpine") as postgres:
          os.environ["DB_HOST"] = postgres.get_container_host_ip()
          ...
          yield
  @pytest_asyncio.fixture
  async def async_client():
      async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
          yield client
  ```
  Middleware contract under test (`src/entrypoints/api/middleware.py.template` lines 69–131): `IdempotencyMiddleware` reads `app.state.idempotency_repo` (a `IdempotencyRepository` Protocol — `get/lock/save`, see `protocols.py.template` lines 4–17), returns the cached `JSONResponse` on `state == "COMPLETED"`, 409 on `IN_PROGRESS`. Worker handler (`worker.py.template` lines 15–25): missing `prompt` → `{"error": ...}`, else `{"status":"success","echo":prompt}`. LLM gateway (`llm_gateway.py.template` lines 22–49): `@circuit(failure_threshold=5, ... fallback_function=fallback_circuit_breaker, expected_exception=TransientInferenceError)`, `APIConnectionError` → `TransientInferenceError`.
  > readyz reality (`main.py.template` lines 80–86): `/readyz` returns 503 only when `app.state.startup_failed` is truthy. Phases 1–4 are expected to add a live DB ping; until then, the test below sets `app.state.startup_failed = True` to simulate "DB down" so it asserts the real 503 branch that EXISTS today, and carries a comment to tighten to a real ping post-Phase-1-4.
- **Change:**

  `tests/test_main.py.template` — REPLACE the two weak tests (`test_idempotency_middleware` with undefined `/example`, and `test_concurrency_load_shedding` with bare `pass`) with the real readiness tests below; keep the existing fixtures and `test_liveness_probe`/`test_readiness_probe` intact:
  ```python
  <% if (rest) { %>
  @pytest.mark.asyncio
  async def test_livez_and_healthz_report_alive(async_client: AsyncClient):
      for path in ("/healthz", "/health"):
          response = await async_client.get(path)
          assert response.status_code == 200
          assert response.json() == {"status": "alive"}

  @pytest.mark.asyncio
  async def test_readyz_503_when_dependency_down(async_client: AsyncClient):
      # Simulate a failed backing dependency. Phase 1-4 wires /readyz to ping the DB;
      # until then this drives the real startup_failed branch (main.py readiness_probe).
      app.state.startup_failed = True
      try:
          response = await async_client.get("/readyz")
          assert response.status_code == 503
          assert response.json() == {"status": "not ready"}
      finally:
          app.state.startup_failed = False
  <% } %>
  ```
  > Delete the old `test_idempotency_middleware` and `test_concurrency_load_shedding` bodies entirely (they reference an undefined `/example` route and use `pass`). The real idempotency + concurrency assertions move to `test_middleware.py`.

  `tests/test_middleware.py.template` (gated by `rest`, since middleware/app only exist with the API entrypoint):
  ```python
  <% if (rest) { %>
  import pytest
  from httpx import AsyncClient, ASGITransport
  import pytest_asyncio
  from fastapi import FastAPI

  from src.entrypoints.api.middleware import IdempotencyMiddleware, ConcurrencyLimitingMiddleware
  from src.core.domain.entities import IdempotencyResponse


  class InMemoryIdempotencyRepo:
      """Real (non-mock) IdempotencyRepository implementation for tests."""

      def __init__(self):
          self.completed = {}   # key -> IdempotencyResponse
          self.in_progress = set()

      async def get(self, key, user_id):
          k = (key, user_id)
          if k in self.completed:
              return ("COMPLETED", self.completed[k])
          if k in self.in_progress:
              return ("IN_PROGRESS", None)
          return None

      async def lock(self, key, user_id):
          k = (key, user_id)
          if k in self.in_progress or k in self.completed:
              return False
          self.in_progress.add(k)
          return True

      async def save(self, key, user_id, response):
          k = (key, user_id)
          self.in_progress.discard(k)
          self.completed[k] = response


  def build_app_with_idempotency():
      app = FastAPI()
      app.add_middleware(IdempotencyMiddleware)
      app.state.idempotency_repo = InMemoryIdempotencyRepo()

      app.state.calls = 0

      @app.post("/thing")
      async def create_thing():
          app.state.calls += 1
          return {"created": True}

      return app


  @pytest_asyncio.fixture
  async def idem_client():
      app = build_app_with_idempotency()
      async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
          yield client, app


  @pytest.mark.asyncio
  async def test_idempotency_replays_cached_response(idem_client):
      client, app = idem_client
      headers = {"Idempotency-Key": "abc-123"}

      r1 = await client.post("/thing", headers=headers)
      assert r1.status_code == 200

      r2 = await client.post("/thing", headers=headers)
      assert r2.status_code == r1.status_code
      # Second call replays the cached response; the handler runs exactly once.
      assert app.state.calls == 1


  @pytest.mark.asyncio
  async def test_idempotency_get_is_not_deduplicated(idem_client):
      client, app = idem_client
      # GET bypasses the middleware entirely (no /thing GET route -> 405, but never cached).
      r = await client.get("/thing", headers={"Idempotency-Key": "abc-123"})
      assert r.status_code in (404, 405)


  @pytest.mark.asyncio
  async def test_concurrency_limit_sheds_with_503():
      import asyncio

      app = FastAPI()
      app.add_middleware(ConcurrencyLimitingMiddleware, max_concurrent_requests=1)
      release = asyncio.Event()

      @app.get("/slow")
      async def slow():
          await release.wait()
          return {"ok": True}

      transport = ASGITransport(app=app)
      async with AsyncClient(transport=transport, base_url="http://test") as client:
          # Hold the single slot, then fire a second request which must be shed (503).
          first = asyncio.create_task(client.get("/slow"))
          await asyncio.sleep(0.05)
          second = await client.get("/slow")
          assert second.status_code == 503
          assert second.json()["detail"].startswith("Service overloaded")
          release.set()
          r1 = await first
          assert r1.status_code == 200
  <% } %>
  ```

  `tests/test_worker.py.template` (gated by `runpod`, matching the `src/entrypoints/worker` deletion):
  ```python
  <% if (runpod) { %>
  from src.entrypoints.worker.worker import handler


  def test_worker_rejects_missing_prompt():
      # Boundary validation: a job without 'prompt' must return a structured error,
      # never raise an unhandled exception.
      result = handler({"input": {}})
      assert "error" in result
      assert "prompt" in result["error"]


  def test_worker_echoes_valid_prompt():
      result = handler({"input": {"prompt": "hello"}})
      assert result == {"status": "success", "echo": "hello"}
  <% } %>
  ```

  `tests/test_llm_gateway.py.template` (gated by `llm`, matching the `llm_gateway.py` deletion):
  ```python
  <% if (llm) { %>
  import pytest
  import openai

  from src.provider.llm_gateway import OpenAILLMGateway
  from src.core.domain.exceptions import TransientInferenceError, CircuitBreakerOpenError


  class _BoomConnection:
      """Stand-in OpenAI client whose completions always raise a connection error."""

      class chat:
          class completions:
              @staticmethod
              async def create(*args, **kwargs):
                  raise openai.APIConnectionError(request=None)


  @pytest.mark.asyncio
  async def test_connection_error_maps_to_transient():
      gw = OpenAILLMGateway()
      gw.client = _BoomConnection()
      # tenacity retries 5x then re-raises the TransientInferenceError; with the circuit
      # breaker wrapping it, repeated calls eventually surface CircuitBreakerOpenError.
      with pytest.raises((TransientInferenceError, CircuitBreakerOpenError)):
          await gw.generate_text("hi")


  @pytest.mark.asyncio
  async def test_circuit_breaker_opens_after_threshold():
      gw = OpenAILLMGateway()
      gw.client = _BoomConnection()
      tripped = False
      for _ in range(10):
          try:
              await gw.generate_text("hi")
          except CircuitBreakerOpenError:
              tripped = True
              break
          except TransientInferenceError:
              continue
      assert tripped, "circuit breaker must open (CircuitBreakerOpenError) after repeated transient failures"
  <% } %>
  ```
  `generator.ts` edits — add the new test deletions to the EXISTING matching blocks:
  ```ts
    if (!options.runpod) {
      tree.delete(`${projectRoot}/src/entrypoints/worker`);
      tree.delete(`${projectRoot}/src/provider/comfyui_gateway.py`);
      tree.delete(`${projectRoot}/tests/test_worker.py`); // ADD
    }
    if (!options.llm) {
      tree.delete(`${projectRoot}/src/provider/llm_gateway.py`);
      tree.delete(`${projectRoot}/tests/test_llm_gateway.py`); // ADD
    }
    if (!options.rest) {
      tree.delete(`${projectRoot}/src/entrypoints/api`);
      tree.delete(`${projectRoot}/tests/test_middleware.py`); // ADD (middleware imports require the API entrypoint)
    }
  ```
  > `tests/test_main.py` is already emitted only meaningfully under `rest` (its body is EJS-gated) — leave its existing handling unchanged; just keep the `<% if (rest) { %>` wrapper around the readiness tests.
- **Acceptance:**
  - `npm run build` → exit 0.
  - Regenerate `worker --rest --postgres --llm --runpod` and a minimal `mini --rest --no-postgres --no-llm --no-runpod` (use the generator's flag names; `--postgres`/`--llm`/`--runpod`/`--rest` booleans).
  - full service: `uv sync --extra dev && uv run pytest -q` → all pass (Docker for testcontainers). `grep -rL "assert True" tests/` confirms no trivial passes; `! grep -rn "    pass$" tests/test_main.py` → no bare `pass`.
  - mini service: confirm `tests/test_worker.py`, `tests/test_llm_gateway.py` ABSENT; `tests/test_middleware.py` absent (no `rest`→ but mini has `--rest`; for a `--no-rest` build it must be absent). Run a `--no-rest` regen and confirm `test_middleware.py` absent. EXIT CODE NOTE: `uv run pytest` returns **exit 5 (no tests collected)** when a workspace emits zero tests (e.g. `--no-rest --no-postgres --no-llm --no-runpod`). Treat exit 0 OR exit 5 as green for the minimal case; only nonzero-and-not-5 is a failure. (`test_main.py`'s readiness tests are `rest`-gated, so a `--no-rest` workspace may collect nothing.)
  - `./dev test compilation` (import check) → green; `./dev test generation` → 159.
- **Guardrails:** No `pass`, no `assert True`, no hits against undefined routes. Idempotency uses a real in-memory repo implementing the actual `IdempotencyRepository` Protocol. Worker/LLM tests gated to match their source-file deletions (both EJS guard AND `tree.delete`). readyz test drives the real 503 branch and is commented for tightening post-Phase-1-4. LLM test substitutes the network client only (`gw.client`), exercising the REAL retry+circuit-breaker decorators.

---

### Task 6.5 — Next.js vitest tests (healthz, proxy error handling, auth-flow smoke)
- **Files:**
  - NEW `/Users/ryannel/Workspace/groundWork/src/generators/nextjs-app/files/app/api/healthz/route.test.ts` (NOT a template — healthz route is unconditional and has no EJS)
  - NEW `/Users/ryannel/Workspace/groundWork/src/generators/nextjs-app/files/app/api/proxy/__path__/route.test.ts.template` (proxy is apiProxy-gated; lives under the proxy dir that is deleted with it)
  - NEW `/Users/ryannel/Workspace/groundWork/src/generators/nextjs-app/files/proxy.test.ts.template` (auth-flow smoke; clerk-gated, lives alongside `proxy.ts` which is deleted for non-clerk)
- **Depends on:** none.
- **Goal:** `GET /api/healthz` returns 200 with `{status:"healthy", timestamp}`; the proxy handler maps an upstream 502 to a 502 and an upstream fetch rejection (e.g. AbortController timeout) to a 502 `{detail:"Backend service unavailable"}`; and an auth-flow smoke test asserts the Clerk middleware passes public routes through and is exported correctly.
- **Anchor (current code to find / pattern to match):**
  - `app/api/healthz/route.ts` (whole file):
    ```ts
    import { NextResponse } from 'next/server';
    export async function GET() {
      return NextResponse.json({ status: 'healthy', timestamp: new Date().toISOString() });
    }
    ```
  - Proxy handler error branch, `app/api/proxy/__path__/route.ts.template` lines 78–107: success forwards `upstream.status`; a thrown `fetch` → `NextResponse.json({detail:"Backend service unavailable"},{status:502})`. Upstream URL base = `process.env.API_URL ?? "http://localhost:4000"`. Handler is exported as `GET/POST/...`.
  - `proxy.ts` (clerk middleware) lines 5–22: `createRouteMatcher([... '/api/healthz(.*)' ...])`; returns `NextResponse.next()` when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is unset.
  - tsconfig (`tsconfig.json`) `include: ["**/*.ts", ...]` → `.test.ts` IS typechecked by `pnpm tsc --noEmit` (the compilation/159 gate). vitest is NOT in `types`/`globals`, so **import every test global explicitly**: `import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";`. `package.json` already has the `test: "vitest run"` script and vitest/jsdom/RTL dev deps — no package.json edit needed.
- **Change:**

  `app/api/healthz/route.test.ts` (plain file, always emitted):
  ```ts
  // @vitest-environment node
  import { describe, it, expect } from "vitest";
  import { GET } from "./route";

  describe("GET /api/healthz", () => {
    it("returns 200 with a healthy status and timestamp", async () => {
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("healthy");
      expect(typeof body.timestamp).toBe("string");
      // timestamp must be a valid ISO date.
      expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
    });
  });
  ```

  `app/api/proxy/__path__/route.test.ts.template` (apiProxy-gated; deleted with the proxy dir):
  ```ts
  // @vitest-environment node
  import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
  import { NextRequest } from "next/server";
  import { GET } from "./route";

  function makeRequest(path: string): NextRequest {
    return new NextRequest(new Request(`http://localhost/api/proxy/${path}`));
  }

  function makeParams(path: string[]) {
    return { params: Promise.resolve({ path }) };
  }

  describe("api proxy error handling", () => {
    const realFetch = global.fetch;

    beforeEach(() => {
      process.env.API_URL = "http://upstream.test";
    });

    afterEach(() => {
      global.fetch = realFetch;
      vi.restoreAllMocks();
    });

    it("forwards an upstream 502 as a 502", async () => {
      global.fetch = vi.fn(async () =>
        new Response("bad gateway", { status: 502, statusText: "Bad Gateway" })
      ) as unknown as typeof fetch;

      const res = await GET(makeRequest("entities"), makeParams(["entities"]));
      expect(res.status).toBe(502);
    });

    it("maps an upstream fetch failure (e.g. timeout/abort) to a 502", async () => {
      global.fetch = vi.fn(async () => {
        // Simulate an AbortController timeout / network failure: fetch rejects.
        throw new DOMException("The operation was aborted.", "AbortError");
      }) as unknown as typeof fetch;

      const res = await GET(makeRequest("entities"), makeParams(["entities"]));
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.detail).toBe("Backend service unavailable");
    });

    it("passes through a successful upstream status", async () => {
      global.fetch = vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      ) as unknown as typeof fetch;

      const res = await GET(makeRequest("entities"), makeParams(["entities"]));
      expect(res.status).toBe(200);
    });
  });
  ```

  `proxy.test.ts.template` (clerk-gated; deleted with `proxy.ts` for non-clerk; auth-flow smoke):
  ```ts
  // @vitest-environment node
  import { describe, it, expect, beforeEach, afterEach } from "vitest";
  import { NextRequest, NextFetchEvent } from "next/server";
  import middleware, { config } from "./proxy";

  describe("clerk auth middleware (proxy.ts)", () => {
    const original = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    afterEach(() => {
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = original;
    });

    it("is a no-op (NextResponse.next) when Clerk is not configured", async () => {
      delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      const req = new NextRequest(new Request("http://localhost/dashboard"));
      // When the publishable key is absent the middleware must not throw and must
      // return a response that lets the request continue.
      const res = middleware(req, {} as NextFetchEvent);
      expect(res).toBeDefined();
      // NextResponse.next() yields a 200-class response with no redirect.
      const status = (res as Response).status ?? 200;
      expect(status).toBeLessThan(400);
    });

    it("exports a matcher config covering API routes", () => {
      expect(Array.isArray(config.matcher)).toBe(true);
      expect(config.matcher.some((m) => m.includes("api"))).toBe(true);
    });
  });
  ```
  > No `generator.ts` edit needed *if* the proxy/auth tests sit inside dirs already deleted by the existing blocks: `app/api/proxy/__path__/route.test.ts.template` is removed by the existing `if (!options.apiProxy) tree.delete(\`${projectRoot}/app/api/proxy\`)` (whole dir). `proxy.test.ts.template` is removed by the existing `if (options.auth !== 'clerk') tree.delete(\`${projectRoot}/proxy.ts\`)` — VERIFY that delete targets `proxy.ts` (a file), not a dir; since the test is a sibling file `proxy.test.ts`, ADD an explicit delete to that block:
  ```ts
    if (options.auth !== 'clerk') {
      tree.delete(`${projectRoot}/app/(auth)`);
      tree.delete(`${projectRoot}/proxy.ts`);
      tree.delete(`${projectRoot}/proxy.test.ts`); // ADD — sibling test must go with proxy.ts
      tree.delete(`${projectRoot}/components/providers/production.tsx`);
    }
  ```
- **Acceptance:**
  - `npm run build` → exit 0.
  - Regenerate `web --auth clerk --apiProxy true` and `web2 --auth none --apiProxy false`.
  - clerk+proxy: `pnpm install && pnpm test` → healthz + proxy (3) + proxy.test auth smoke pass. `pnpm tsc --noEmit` → green (explicit vitest imports keep typecheck happy).
  - none+no-proxy: confirm `app/api/proxy` dir ABSENT and `proxy.test.ts` ABSENT; `pnpm test` → only `healthz/route.test.ts` runs and passes; `pnpm tsc --noEmit` → green.
  - `./dev test compilation` → green (tsc now also covers the new `.test.ts`); `./dev test generation` → 159.
- **Guardrails:** Every `.test.ts` imports its globals explicitly from `vitest` (no reliance on `vitest/globals` types) so the `tsc --noEmit` / 159 gate stays green. Real assertions on real exported handlers — `fetch` is stubbed at the network boundary only, the proxy handler logic runs for real. Proxy test gated by the existing apiProxy dir-delete; auth smoke gated by clerk with an ADDED sibling `tree.delete`. No silent skips.

---

## Definition of done for Phase 6

- [ ] `npm run build` succeeds after every `generator.ts` edit (Tasks 6.1, 6.3, 6.4, 6.5).
- [ ] Go: `internal/entrypoints/api/middleware_test.go.template`, `idempotency/middleware_test.go.template`, `auth_middleware_test.go.template` (clerk-gated), `clerk_webhook_test.go.template` (clerk-gated), `internal/provider/postgres_test.go.template` (outbox EJS-gated) added.
- [ ] Python: `test_main.py.template` weak tests REPLACED; `test_middleware.py.template` (rest-gated), `test_worker.py.template` (runpod-gated), `test_llm_gateway.py.template` (llm-gated) added.
- [ ] Next.js: `app/api/healthz/route.test.ts`, `app/api/proxy/__path__/route.test.ts.template` (apiProxy-gated), `proxy.test.ts.template` (clerk-gated) added.
- [ ] Every option-specific test gated by BOTH an EJS `<% if %>` guard AND a `tree.delete(...)` in the matching `generator.ts` conditional block — verified absent on minimal/opposite-option regenerations.
- [ ] No anti-patterns: zero `assert True`, zero bare `pass`, zero `t.Skip`/`it.skip` without an explicit env/`-short` reason; the old `/example` and `pass` Python tests removed.
- [ ] Unit suites green on a full-option regen: `go test ./...`, `uv run pytest`, `pnpm test` (Docker available; Tasks 6.2 and the readyz assertion presume Phases 1–4 wired real persistence/connectivity — against current stubs they FAIL LOUD, which is expected and noted).
- [ ] `./dev test compilation` green (note: `go build` does not compile `_test.go`; `tsc` does typecheck `.test.ts`; Python step is import-only).
- [ ] `./dev test generation` still **159 pass**.
