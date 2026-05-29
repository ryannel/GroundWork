# Phase 2 — Resilience footguns

**Prerequisite:** Phase 0 complete (`./dev migrate` and `./dev test integration` harness working).

**Phase goal:** Eliminate silent resilience footguns in the generated scaffolds. Generated services must bound every timeout, enforce real cross-instance rate limits, expose dependency-aware readiness probes, configure DB connection pools, and wire the resilient HTTP client and load-shedder from config. Fail loud, never silent.

**Phase acceptance gate (run after ALL tasks):**
```bash
cd /Users/ryannel/Workspace/groundWork
npm run build                                   # generators must transpile
./dev test generation                           # structural checks, all option combos
./dev test compilation                          # go build ./... + tsc + uv sync — HARD GATE, must pass
```
Expected: all three commands exit 0. Docker-gated integration assertions (`./dev test scaffolds`) are listed per-task as the stronger check where a service must boot — run only if Docker is available.

---

## Execution notes (read once before starting)

- **Templates are EJS.** Files end in `.template`; the suffix is stripped on generation. `<%= var %>` interpolates; `<% if (x) { %> ... <% } %>` are conditional branches. **Any replacement snippet inside a branched region must reproduce BOTH arms verbatim** or one generator combination breaks.
- **Line numbers are approximate.** Several files are edited by more than one task. After the first edit to a file, later line numbers drift. **Match on the verbatim Anchor string, not the line number.** Each task's anchor is a unique string so tasks do not clobber each other.
- **Always `npm run build` after editing any `generator.ts`.** Editing only `.template` files does not require a rebuild, but running it is harmless.
- **Sample regenerate command** (used in acceptance steps):
  ```bash
  GJSON=/Users/ryannel/Workspace/groundWork/generators.json
  TMP=/Users/ryannel/Workspace/groundWork/.sandboxes/demo
  rm -rf $TMP; mkdir -p $TMP/services; printf '{}' >$TMP/nx.json; printf '{"name":"demo"}' >$TMP/package.json
  (cd $TMP && npx --yes nx g $GJSON:workspace-dev-cli --appName demo)
  (cd $TMP && npx --yes nx g $GJSON:go-microservice --name api --auth service)
  ```

**Shared-file edit map (respect Depends-on):**
| File | Tasks |
|---|---|
| `internal/config/config.go.template` | 2.1, 2.4, 2.7 |
| `cmd/api/main.go.template` | 2.1, 2.6 |
| `internal/entrypoints/api/router.go.template` | 2.3, 2.6, 2.7 |

---

### Task 2.1 — Bound WriteTimeout (Slowloris fix)
- **Files:**
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/cmd/api/main.go.template`
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/config/config.go.template`
- **Depends on:** none
- **Goal:** Replace `WriteTimeout: 0` (unbounded — a slow reader holds a writer goroutine forever) with a bounded, env-configurable write timeout (default 20s).
- **Anchor (current code to find):**

  `main.go.template` (~line 59-65):
  ```go
  	srv := &http.Server{
  		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
  		Handler:      router,
  		ReadTimeout:  15 * time.Second,
  		WriteTimeout: 0,
  		IdleTimeout:  60 * time.Second,
  	}
  ```
  `config.go.template` (~line 25-27):
  ```go
  type ServerConfig struct {
  	Port int `env:"PORT" envDefault:"8080"`
  }
  ```
- **Change:**
  1. In `config.go.template`, add a `WriteTimeoutSeconds` field to `ServerConfig`:
     ```go
     type ServerConfig struct {
     	Port                int `env:"PORT" envDefault:"8080"`
     	WriteTimeoutSeconds int `env:"WRITE_TIMEOUT_SECONDS" envDefault:"20"`
     }
     ```
  2. In `main.go.template`, replace the server block:
     ```go
     	srv := &http.Server{
     		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
     		Handler:      router,
     		ReadTimeout:  15 * time.Second,
     		WriteTimeout: time.Duration(cfg.Server.WriteTimeoutSeconds) * time.Second,
     		IdleTimeout:  60 * time.Second,
     	}
     ```
     (`time` is already imported.)
- **Acceptance:**
  ```bash
  npm run build && ./dev test compilation
  ```
  Then regenerate and confirm the value is wired:
  ```bash
  # after the sample regenerate command
  grep -n "WriteTimeout: time.Duration" /Users/ryannel/Workspace/groundWork/.sandboxes/demo/services/api/cmd/api/main.go
  grep -n "WRITE_TIMEOUT_SECONDS" /Users/ryannel/Workspace/groundWork/.sandboxes/demo/services/api/internal/config/config.go
  ```
  Expected: `go build` passes; both greps match; no `WriteTimeout: 0` remains.
- **Guardrails:** Do not touch `ReadTimeout` or `IdleTimeout`. Do not reformat the rest of `ServerConfig` beyond aligning the struct tags. This task owns ONLY `ServerConfig` and the `srv := &http.Server{}` block — leave `buildApp` for Task 2.6.

---

### Task 2.2 — Real Redis-backed rate limiter (kill the dead Redis path)
- **Files:**
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/entrypoints/api/middleware_ratelimit.go.template`
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/go.mod.template`
- **Depends on:** none
- **Goal:** Today the Redis branch logs "Using Valkey/Redis" then stubs to `memorystore` (in-memory) — so limits are per-instance and a 3-replica deploy allows 3× the intended rate. Implement a real Redis fixed-window limiter (using `go-redis`) when `REDIS_URL` is set; fall back to `memorystore` ONLY when no Redis URL is configured. Drop the dead Postgres branch.
- **Anchor (current code to find):**

  `middleware_ratelimit.go.template` (entire file, ~48 lines):
  ```go
  package api

  import (
  	"database/sql"
  	"net/http"
  	"time"

  	"github.com/sethvargo/go-limiter"
  	"github.com/sethvargo/go-limiter/httplimit"
  	"github.com/sethvargo/go-limiter/memorystore"
  	"github.com/rs/zerolog/log"

  	// Postgres store isn't native to sethvargo/go-limiter core without custom or third party,
  	// but for demonstration of fallback we use an interface that delegates.
  	// Usually, for sethvargo, memory or redis are the standard, but we'll
  	// stub the postgres fallback concept here.
  )

  func RateLimitMiddleware(redisURL string, db *sql.DB) func(http.Handler) http.Handler {
  	var store limiter.Store
  	if redisURL != "" {
  ```
  `go.mod.template` (~line 30-32):
  ```
  	github.com/sony/gobreaker v1.0.0
  	github.com/cenkalti/backoff/v4 v4.3.0
  	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.49.0
  ```
- **Change:**
  1. In `go.mod.template`, add `go-redis` to the `require (...)` block (the generator runs `go mod tidy`, which resolves the version and writes `go.sum` — there is no `go.sum.template`, so adding the require alone is sufficient):
     ```
     	github.com/sony/gobreaker v1.0.0
     	github.com/cenkalti/backoff/v4 v4.3.0
     	github.com/redis/go-redis/v9 v9.7.0
     	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.49.0
     ```
  2. Replace the **entire** `middleware_ratelimit.go.template` file with the following. It uses `go-redis` for a documented Redis fixed-window limiter (INCR + EXPIRE per IP per window) when a Redis URL is set, and falls back to `memorystore` only when it is empty. The `db *sql.DB` parameter is removed (the Postgres branch was dead — see Task 2.3/2.6 callers, which must drop the `db` argument):
     ```go
     package api

     import (
     	"net/http"
     	"strconv"
     	"strings"
     	"time"

     	"github.com/redis/go-redis/v9"
     	"github.com/rs/zerolog/log"
     	"github.com/sethvargo/go-limiter/httplimit"
     	"github.com/sethvargo/go-limiter/memorystore"
     )

     const (
     	rateLimitTokens   = 15
     	rateLimitInterval = time.Minute
     )

     // RateLimitMiddleware returns IP-based rate limiting middleware.
     //
     // When redisURL is set, limits are enforced via Redis (INCR + EXPIRE fixed
     // window) so they hold ACROSS all instances of the service. When redisURL is
     // empty, it falls back to an in-process memory store — per-instance limits
     // only, acceptable for single-replica or local development.
     func RateLimitMiddleware(redisURL string) func(http.Handler) http.Handler {
     	if redisURL != "" {
     		opt, err := redis.ParseURL(redisURL)
     		if err != nil {
     			log.Fatal().Err(err).Str("redis_url", redisURL).Msg("Invalid REDIS_URL for rate limiter")
     		}
     		rdb := redis.NewClient(opt)
     		log.Info().Msg("Using Redis for distributed rate limiting")
     		return redisRateLimiter(rdb, rateLimitTokens, rateLimitInterval)
     	}

     	log.Info().Msg("REDIS_URL not set — using in-memory rate limiting (per-instance only)")
     	store, err := memorystore.New(&memorystore.Config{
     		Tokens:   rateLimitTokens,
     		Interval: rateLimitInterval,
     	})
     	if err != nil {
     		log.Fatal().Err(err).Msg("Failed to create memory rate-limit store")
     	}
     	middleware, err := httplimit.NewMiddleware(store, httplimit.IPKeyFunc())
     	if err != nil {
     		log.Fatal().Err(err).Msg("Failed to create rate-limit middleware")
     	}
     	return middleware.Handle
     }

     // redisRateLimiter implements a cross-instance fixed-window limiter keyed by
     // client IP. The first request in a window sets the key with a TTL; once the
     // count exceeds the limit within the TTL, requests are rejected with 429.
     func redisRateLimiter(rdb *redis.Client, limit int, window time.Duration) func(http.Handler) http.Handler {
     	return func(next http.Handler) http.Handler {
     		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
     			ip := clientIP(r)
     			key := "ratelimit:" + ip
     			ctx := r.Context()

     			count, err := rdb.Incr(ctx, key).Result()
     			if err != nil {
     				// Fail OPEN on Redis errors so a Redis outage does not take
     				// the service down, but log loudly so it is never silent.
     				log.Error().Err(err).Str("ip", ip).Msg("Rate limiter Redis error — failing open")
     				next.ServeHTTP(w, r)
     				return
     			}
     			if count == 1 {
     				// First request in this window — set the expiry.
     				if err := rdb.Expire(ctx, key, window).Err(); err != nil {
     					log.Error().Err(err).Str("ip", ip).Msg("Rate limiter failed to set TTL")
     				}
     			}

     			remaining := limit - int(count)
     			if remaining < 0 {
     				remaining = 0
     			}
     			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(limit))
     			w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(remaining))

     			if int(count) > limit {
     				w.Header().Set("Retry-After", strconv.Itoa(int(window.Seconds())))
     				w.WriteHeader(http.StatusTooManyRequests)
     				_, _ = w.Write([]byte(`{"detail":"rate limit exceeded"}`))
     				return
     			}
     			next.ServeHTTP(w, r)
     		})
     	}
     }

     // clientIP extracts the best-effort client IP, preferring the first
     // X-Forwarded-For entry and falling back to RemoteAddr.
     func clientIP(r *http.Request) string {
     	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
     		return strings.TrimSpace(strings.Split(xff, ",")[0])
     	}
     	return r.RemoteAddr
     }
     ```
  3. The caller in `router.go.template` must drop the `db` argument. **Verified: `RateLimitMiddleware(...)` has exactly ONE caller — `router.go.template` line ~53. No other file calls it.** Update it now so the package compiles:
     find `router.go.template` line ~53:
     ```go
     	router.Use(RateLimitMiddleware(cfg.Redis.URI, db))    // Rate limiter
     ```
     replace with:
     ```go
     	router.Use(RateLimitMiddleware(cfg.Redis.URI))        // Distributed rate limiter (Redis when REDIS_URL set)
     ```
- **Acceptance:**
  ```bash
  npm run build && ./dev test compilation
  ```
  Expected: `go build ./...` passes for all combinations (the new `go-redis` require resolves via `go mod tidy`). Confirm dead path gone:
  ```bash
  # after sample regenerate
  ! grep -n "Falling back to Postgres" /Users/ryannel/Workspace/groundWork/.sandboxes/demo/services/api/internal/entrypoints/api/middleware_ratelimit.go
  grep -n "redis/go-redis/v9" /Users/ryannel/Workspace/groundWork/.sandboxes/demo/services/api/go.mod
  ```
  **Stronger check (Docker-gated, optional):** `./dev test scaffolds` — with REDIS_URL set, the inner system test that hammers an endpoint should observe HTTP 429 after >15 requests/min from one IP.
- **Guardrails:** Do not change the limit (15/min) or add config for it — out of scope. Do not implement a sliding window or token-bucket Lua script — fixed-window INCR/EXPIRE is the documented choice. Keep the `db`-less signature; the idempotency middleware (also in `router.go`) still uses `db` and must not be touched.

---

### Task 2.3 — Dependency-aware readiness probes (`/livez` + `/readyz`)
- **Files:**
  - Go: `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/entrypoints/api/health_handler.go.template`
  - Go router (otel filter): `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/entrypoints/api/router.go.template`
  - Python: `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/src/main.py.template`
- **Depends on:** none (but if Task 2.2 has not run, do NOT edit the `RateLimitMiddleware` line here — only edit the otel filter and `RegisterHealthHandler` lines).
- **Goal:** Separate liveness (process up, no deps) from readiness (deps reachable). Liveness must never query the DB; readiness must run `SELECT 1` (and Redis ping when enabled) and return 503 when a dependency is down. Keep these probes under the otel-filtered prefix so k8s probes do not spam traces.
- **Anchor (current code to find):**

  Go `health_handler.go.template` — the single combined handler (~line 39-46):
  ```go
  	huma.Register(api, huma.Operation{
  		OperationID: "get-health",
  		Method:      "GET",
  		Path:        "/health",
  		Summary:     "Health check",
  		Description: "Check if the service is healthy",
  		Tags:        []string{"System"},
  	}, func(ctx context.Context, input *struct{}) (*HealthResponse, error) {
  ```
  Go `router.go.template` otel filter (~line 33-35):
  ```go
  			otelhttp.WithFilter(func(r *http.Request) bool {
  				return !strings.HasPrefix(r.URL.Path, "/health")
  			}),
  ```
  Python `main.py.template` readiness probe (~line 80-86):
  ```python
  @app.get("/readyz")
  async def readiness_probe(request: Request):
      """Kubernetes readiness probe. Checks backing services."""
      from fastapi.responses import JSONResponse
      if getattr(request.app.state, "startup_failed", False):
          return JSONResponse(status_code=503, content={"status": "not ready"})
      return {"status": "ready"}
  ```
- **Change:**

  **(A) Go — keep probes under the `/health` prefix** so the existing otel filter covers them. Add `/health/livez` (liveness, no deps) and `/health/readyz` (readiness, pings DB). Do NOT rename `/health/livez` and `/health/readyz` to bare `/livez` `/readyz` — that would escape the otel filter. The otel filter on lines 33-35 stays UNCHANGED because `/health/*` already matches its `HasPrefix(r.URL.Path, "/health")`.

  In `health_handler.go.template`, register two additional operations right after the existing `/health` registration's closing `})` (the existing `/health` op stays as-is for backward compatibility). Insert before the final closing `}` of `RegisterHealthHandler`:
  ```go
  	// Liveness: process is up. No dependency checks — must never fail on a slow DB.
  	huma.Register(api, huma.Operation{
  		OperationID: "get-livez",
  		Method:      "GET",
  		Path:        "/health/livez",
  		Summary:     "Liveness probe",
  		Description: "Returns ok if the process is running. No dependency checks.",
  		Tags:        []string{"System"},
  	}, func(ctx context.Context, input *struct{}) (*HealthResponse, error) {
  		var body HealthCheck
  		body.Status = "ok"
  		body.Checks.DB = "ok"
  		return &HealthResponse{Body: body}, nil
  	})

  	// Readiness: dependencies reachable. Returns 503 when the DB is down.
  	huma.Register(api, huma.Operation{
  		OperationID: "get-readyz",
  		Method:      "GET",
  		Path:        "/health/readyz",
  		Summary:     "Readiness probe",
  		Description: "Returns ok only when backing dependencies are reachable.",
  		Tags:        []string{"System"},
  	}, func(ctx context.Context, input *struct{}) (*HealthResponse, error) {
  		var body HealthCheck
  		if err := db.PingContext(ctx); err != nil {
  			body.Checks.DB = "error"
  			body.Status = "degraded"
  			return nil, huma.Error503ServiceUnavailable("database not ready")
  		}
  		body.Checks.DB = "ok"
  		body.Status = "ok"
  		return &HealthResponse{Body: body}, nil
  	})
  ```
  Note: `db` here is the `DBPinger` parameter already in `RegisterHealthHandler`'s signature (both the websockets and non-websockets arms accept `db DBPinger` — see lines 35/37). No signature change needed. `huma.Error503ServiceUnavailable` is provided by the already-imported `huma` package.

  The otel filter (router.go.template lines 33-35) requires NO change — `/health/livez` and `/health/readyz` both start with `/health`.

  **(B) Python — split liveness from readiness with a real DB check.** Replace the `/readyz` block. The `/health` and `/healthz` liveness routes (lines 74-78) stay as liveness; add an explicit `/livez` alias and make `/readyz` run `SELECT 1` via SQLAlchemy 2.x `text()` when Postgres is enabled.

  Replace the anchored `/readyz` block with:
  ```python
  @app.get("/livez", status_code=200)
  async def liveness_alias():
      """Liveness probe alias. Process up, no dependency checks."""
      return {"status": "alive"}

  @app.get("/readyz")
  async def readiness_probe(request: Request):
      """Readiness probe. Returns 503 unless backing dependencies are reachable."""
      from fastapi.responses import JSONResponse
      if getattr(request.app.state, "startup_failed", False):
          return JSONResponse(status_code=503, content={"status": "not ready", "reason": "startup_failed"})
  <% if (postgres) { %>
      # Dependency check: DB must answer SELECT 1.
      from sqlalchemy import text
      from src.provider.database import async_session_maker
      try:
          async with async_session_maker() as session:
              await session.execute(text("SELECT 1"))
      except Exception as exc:
          return JSONResponse(status_code=503, content={"status": "not ready", "reason": f"db: {exc}"})
  <% } %>
  <% if (messaging === 'redis' || websockets) { %>
      # Dependency check: Redis must answer PING.
      import redis.asyncio as redis_async
      from src.provider.config import settings
      try:
          r = redis_async.from_url(settings.redis_url)
          await r.ping()
          await r.aclose()
      except Exception as exc:
          return JSONResponse(status_code=503, content={"status": "not ready", "reason": f"redis: {exc}"})
  <% } %>
      return {"status": "ready"}
  ```
  Note: SQLAlchemy 2.x rejects raw string `execute("SELECT 1")` — `text()` is mandatory. `async_session_maker` is exported from `src/provider/database.py`. `aclose()` is the redis-py 5.x async close.
- **Acceptance:**
  ```bash
  npm run build && ./dev test compilation
  ```
  Expected: `go build ./...` passes (all combos); `uv sync` and Python import succeed for postgres/redis/websockets combos. Confirm routes exist:
  ```bash
  # after sample regenerate (Go)
  grep -n "/health/livez\|/health/readyz" /Users/ryannel/Workspace/groundWork/.sandboxes/demo/services/api/internal/entrypoints/api/health_handler.go
  ```
  **Stronger check (Docker-gated, optional):** `./dev test scaffolds` with the DB container stopped — `GET /health/readyz` (Go) and `GET /readyz` (Python) must return **503**, while `GET /health/livez` / `GET /livez` still return **200**.
- **Guardrails:** Do NOT change the otel filter predicate (the `/health/*` prefix is deliberately kept). Do NOT remove the existing `/health` Go endpoint or `/health`/`/healthz` Python endpoints — they stay for backward compatibility. Do not add a Redis check to the Go readiness probe in this task — the Go service has no Redis ping client wired (out of scope; Redis is only used by the rate limiter in Task 2.2). Keep the Python DB check inside the `<% if (postgres) { %>` branch so non-postgres services still compile.

---

### Task 2.4 — DB connection pool configuration (Go)
- **Files:**
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/provider/postgres.go.template`
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/config/config.go.template`
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/cmd/api/main_test.go.template`
- **Depends on:** none (config.go also touched by 2.1 and 2.7 — match the anchor string, not the line).
- **Callers (verified):** `NewPostgresDB(cfg.Database.URI)` is called in exactly two places — `cmd/api/main.go.template` (line ~38) AND `cmd/api/main_test.go.template` (line ~67). BOTH must be updated or `go build ./...` / `go test` fails. There are no other callers.
- **Goal:** `sql.Open` uses driver defaults (unlimited open conns, no lifetime) — under load this exhausts Postgres connections and leaks stale ones. Configure the pool, env-driven.
- **Anchor (current code to find):**

  `postgres.go.template` (~line 17-25):
  ```go
  // NewPostgresDB initializes a new PostgreSQL connection.
  func NewPostgresDB(connString string) (*PostgresDB, error) {
  	// STUB: actual connection logic using e.g., pgx
  	db, err := sql.Open("postgres", connString)
  	if err != nil {
  		return nil, fmt.Errorf("open postgres connection: %w", err)
  	}
  	return &PostgresDB{DB: db}, nil
  }
  ```
  `config.go.template` `DatabaseConfig` (~line 29-31):
  ```go
  type DatabaseConfig struct {
  	URI string `env:"DATABASE_URL" envDefault:"postgres://postgres:postgres@localhost:5432/<%= name %>?sslmode=disable"`
  }
  ```
- **Change:**
  1. In `config.go.template`, extend `DatabaseConfig`:
     ```go
     type DatabaseConfig struct {
     	URI                    string `env:"DATABASE_URL" envDefault:"postgres://postgres:postgres@localhost:5432/<%= name %>?sslmode=disable"`
     	MaxOpenConns           int    `env:"DB_MAX_OPEN_CONNS" envDefault:"25"`
     	MaxIdleConns           int    `env:"DB_MAX_IDLE_CONNS" envDefault:"25"`
     	ConnMaxLifetimeMinutes int    `env:"DB_CONN_MAX_LIFETIME_MINUTES" envDefault:"5"`
     	ConnMaxIdleMinutes     int    `env:"DB_CONN_MAX_IDLE_MINUTES" envDefault:"5"`
     }
     ```
  2. In `postgres.go.template`, change `NewPostgresDB` to accept the config and apply pool settings. Replace the function with a signature that takes `*config.DatabaseConfig`:
     ```go
     // NewPostgresDB initializes a new PostgreSQL connection with a bounded pool.
     func NewPostgresDB(cfg config.DatabaseConfig) (*PostgresDB, error) {
     	db, err := sql.Open("postgres", cfg.URI)
     	if err != nil {
     		return nil, fmt.Errorf("open postgres connection: %w", err)
     	}
     	db.SetMaxOpenConns(cfg.MaxOpenConns)
     	db.SetMaxIdleConns(cfg.MaxIdleConns)
     	db.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetimeMinutes) * time.Minute)
     	db.SetConnMaxIdleTime(time.Duration(cfg.ConnMaxIdleMinutes) * time.Minute)
     	return &PostgresDB{DB: db}, nil
     }
     ```
  3. Add the two new imports to `postgres.go.template`'s import block (currently `context`, `database/sql`, `fmt`, plus the internal `domain`/`gateway`). Add `"time"` and the config import:
     ```go
     import (
     	"context"
     	"database/sql"
     	"fmt"
     	"time"

     	"<%= name %>/internal/config"
     	"<%= name %>/internal/core/domain"
     	"<%= name %>/internal/core/gateway"
     )
     ```
  4. Update BOTH callers. In `main.go.template` (~line 38) AND in `main_test.go.template` (~line 67), the identical line appears:
     ```go
     	db, err := provider.NewPostgresDB(cfg.Database.URI)
     ```
     Replace it in BOTH files with:
     ```go
     	db, err := provider.NewPostgresDB(cfg.Database)
     ```
- **Acceptance:**
  ```bash
  npm run build && ./dev test compilation
  ```
  ```bash
  # after sample regenerate
  grep -n "SetMaxOpenConns\|SetConnMaxLifetime" /Users/ryannel/Workspace/groundWork/.sandboxes/demo/services/api/internal/provider/postgres.go
  grep -n "DB_MAX_OPEN_CONNS" /Users/ryannel/Workspace/groundWork/.sandboxes/demo/services/api/internal/config/config.go
  ```
  Expected: `go build` passes; both greps match.
- **Guardrails:** Do not touch `Close`, `PostgresTransactionManager`, `PostgresRepository`, or the outbox code. Do not introduce `pgx` — keep the `database/sql` + `lib/pq` driver. Only `NewPostgresDB`, its imports, the `DatabaseConfig` struct, and the one call site change.

---

### Task 2.5 — Compose restart policy + resource limits on base infra
- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/workspace-dev-cli/files/docker-compose.yml.template`
- **Depends on:** none
- **Goal:** Base infra (`db`, `redis`, `pubsub`, `jaeger`) has no `restart:` policy and no resource caps — a crashed container stays down, and an unbounded container can starve the host. Add `restart: unless-stopped` and `mem_limit` to each. Microservice service blocks already set their own `restart` (verified in `go-microservice/generator.ts` line 155) — do NOT touch those; this task is base infra only.
- **Anchor (current code to find):** the four infra service blocks. Example (`db`, ~line 4-21):
  ```yaml
    db:
      image: ankane/pgvector:v0.5.0
      container_name: <%= projectPrefix %>-db
      environment:
        - POSTGRES_USER=postgres
        - POSTGRES_PASSWORD=postgres
        - POSTGRES_DB=<%= projectPrefix %>
      ports:
        - "5432:5432"
      networks:
        - groundwork-net
      volumes:
        - db_data:/var/lib/postgresql/data
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U postgres"]
        interval: 5s
        timeout: 5s
        retries: 5
  ```
- **Change:** This is a Compose v2 (Docker Compose CLI) file using `version: '3.8'`. Use the **`mem_limit` / `restart` top-level keys** (the v2 runtime honours these without Swarm; `deploy.resources` is ignored outside Swarm, so do NOT use it here — pick one and be consistent). Add `restart: unless-stopped` and `mem_limit` to each infra service, placed immediately after the `container_name:` line.

  - **db** — after `container_name: <%= projectPrefix %>-db`, add:
    ```yaml
        restart: unless-stopped
        mem_limit: 512m
    ```
  - **redis** — after `container_name: <%= projectPrefix %>-redis`, add:
    ```yaml
        restart: unless-stopped
        mem_limit: 256m
    ```
  - **pubsub** — after `container_name: <%= projectPrefix %>-pubsub`, add:
    ```yaml
        restart: unless-stopped
        mem_limit: 512m
    ```
  - **jaeger** — after `container_name: <%= projectPrefix %>-jaeger`, add:
    ```yaml
        restart: unless-stopped
        mem_limit: 512m
    ```
  (Indentation is 4 spaces for keys under a service, matching the existing `image:`/`ports:` indentation.)
- **Acceptance:**
  ```bash
  npm run build && ./dev test generation
  ```
  ```bash
  # after sample regenerate
  # PRIMARY check — mem_limit is added ONLY to infra, so this is the clean discriminator:
  grep -c "mem_limit:" /Users/ryannel/Workspace/groundWork/.sandboxes/demo/docker-compose.yml                # → exactly 4 (db, redis, pubsub, jaeger)
  # restart count = 4 infra + 1 per microservice generated. The sample regen generates ONE service (api),
  # which the go generator already gives `restart: unless-stopped` (generator.ts line 155), so expect 5 here:
  grep -c "restart: unless-stopped" /Users/ryannel/Workspace/groundWork/.sandboxes/demo/docker-compose.yml   # → 4 infra + 1 api = 5
  # validate the compose file parses
  (cd /Users/ryannel/Workspace/groundWork/.sandboxes/demo && docker compose config >/dev/null && echo COMPOSE_OK)
  ```
  Expected: `mem_limit:` count is exactly **4** (the reliable signal); `restart: unless-stopped` is `4 + (number of microservices generated)` = **5** with the sample regen; `docker compose config` prints `COMPOSE_OK` (Docker-gated — skip the last line if Docker absent).
- **Guardrails:** Do NOT add `restart`/limits to microservice blocks (those are appended by each microservice generator and already have `restart`). Do NOT switch to `deploy.resources.limits` — it is Swarm-only and silently ignored by `docker compose up`. Do not change images, ports, healthchecks, volumes, or the network.

---

### Task 2.6 — Wire the ResilientClient into the composition root
- **Files:**
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/cmd/api/main.go.template`
  - (reference, do not edit) `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/provider/http_client.go.template`
- **Depends on:** 2.1 (both edit `main.go`; apply 2.1 first so the `&http.Server{}` block is settled).
- **Goal:** `provider.NewResilientClient` (retry + gobreaker circuit breaker) exists but is never instantiated, so generated services have no resilient path for inter-service HTTP calls. Instantiate one in the composition root and thread it into `buildApp` so services can use it. Keep it minimal — a single provided `*ResilientClient`.
- **Anchor (current code to find):**

  `main.go.template` `buildApp` call sites in `main()` (~line 49-54):
  ```go
  <% if (websockets) { %>
  	// Initialize WebSocket Hub
  	wsHub := websocket.NewHub(cfg)
  	go wsHub.Run()

  	// Composition Root: Wire up Gateways, Providers, and Services
  	router, err := buildApp(cfg, db, wsHub)
  <% } else { %>
  	// Composition Root: Wire up Gateways, Providers, and Services
  	router, err := buildApp(cfg, db)
  <% } %>
  ```
  `main.go.template` `buildApp` definitions (~line 84-103):
  ```go
  <% if (websockets) { %>
  func buildApp(cfg *config.Config, db *provider.PostgresDB, wsHub *websocket.Hub) (http.Handler, error) {
  <% } else { %>
  func buildApp(cfg *config.Config, db *provider.PostgresDB) (http.Handler, error) {
  <% } %>
  	// --- Providers (Gateways) ---

  	txManager := provider.NewPostgresTransactionManager(db)
  	entityRepo := provider.NewPostgresRepository(db)
  ```
- **Change:** Both EJS arms must be updated (websockets and non-websockets).

  1. In `main()`, instantiate the client before the `buildApp` call and pass it in. Replace the anchored call-site block with:
     ```go
  <% if (websockets) { %>
  	// Initialize WebSocket Hub
  	wsHub := websocket.NewHub(cfg)
  	go wsHub.Run()

  	// Resilient HTTP client for inter-service calls (retry + circuit breaker).
  	httpClient := provider.NewResilientClient("<%= name %>")

  	// Composition Root: Wire up Gateways, Providers, and Services
  	router, err := buildApp(cfg, db, httpClient, wsHub)
  <% } else { %>
  	// Resilient HTTP client for inter-service calls (retry + circuit breaker).
  	httpClient := provider.NewResilientClient("<%= name %>")

  	// Composition Root: Wire up Gateways, Providers, and Services
  	router, err := buildApp(cfg, db, httpClient)
  <% } %>
     ```
  2. Update both `buildApp` signatures. Replace the anchored definition block with:
     ```go
  <% if (websockets) { %>
  func buildApp(cfg *config.Config, db *provider.PostgresDB, httpClient *provider.ResilientClient, wsHub *websocket.Hub) (http.Handler, error) {
  <% } else { %>
  func buildApp(cfg *config.Config, db *provider.PostgresDB, httpClient *provider.ResilientClient) (http.Handler, error) {
  <% } %>
  	// --- Providers (Gateways) ---
  	_ = httpClient // available for inter-service gateways; wire into services that make outbound calls

  	txManager := provider.NewPostgresTransactionManager(db)
  	entityRepo := provider.NewPostgresRepository(db)
     ```
     The `_ = httpClient` line keeps the build green while making the client a first-class provided dependency that future inter-service gateways consume (replace `_ =` with a real gateway constructor when one is added). This is the minimal, compiling wiring requested.
- **Acceptance:**
  ```bash
  npm run build && ./dev test compilation
  ```
  ```bash
  # after sample regenerate (non-websocket)
  grep -n "NewResilientClient" /Users/ryannel/Workspace/groundWork/.sandboxes/demo/services/api/cmd/api/main.go
  # and with websockets
  TMP=/Users/ryannel/Workspace/groundWork/.sandboxes/demo
  (cd $TMP && npx --yes nx g /Users/ryannel/Workspace/groundWork/generators.json:go-microservice --name wsapi --auth service --websockets)
  grep -n "buildApp(cfg, db, httpClient, wsHub)" $TMP/services/wsapi/cmd/api/main.go
  ```
  Expected: `go build` passes for BOTH websockets and non-websockets combos; greps match.
- **Guardrails:** Do not modify `http_client.go.template` — it already compiles. Do not change `RegisterRoutes` / `service.NewAppService` signatures — the client stays inside `buildApp` for now. Keep the `_ = httpClient` so the no-op path compiles; do not delete the parameter.

---

### Task 2.7 — Configurable load shedding
- **Files:**
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/entrypoints/api/router.go.template`
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/config/config.go.template`
- **Depends on:** none (router.go also touched by 2.3/2.6; config.go by 2.1/2.4 — match anchor strings).
- **Goal:** `LoadSheddingMiddleware(100)` hard-codes the concurrency ceiling. Make it env-configurable via `MAX_CONCURRENT_REQUESTS`.
- **Anchor (current code to find):**

  `router.go.template` (~line 50-51):
  ```go
  	// Inbound Defenses
  	router.Use(LoadSheddingMiddleware(100))               // Max 100 concurrent requests
  ```
  `config.go.template` `ServerConfig` (~line 25-27, may already carry `WriteTimeoutSeconds` from Task 2.1):
  ```go
  type ServerConfig struct {
  	Port int `env:"PORT" envDefault:"8080"`
  }
  ```
- **Change:**
  1. In `config.go.template`, add a `MaxConcurrentRequests` field to `ServerConfig`. If Task 2.1 already added `WriteTimeoutSeconds`, append after it; the result must contain all fields:
     ```go
     type ServerConfig struct {
     	Port                  int `env:"PORT" envDefault:"8080"`
     	WriteTimeoutSeconds   int `env:"WRITE_TIMEOUT_SECONDS" envDefault:"20"`
     	MaxConcurrentRequests int `env:"MAX_CONCURRENT_REQUESTS" envDefault:"100"`
     }
     ```
     (If 2.1 has not run yet, the `WriteTimeoutSeconds` line will not be present — add only `MaxConcurrentRequests`; 2.1 adds its own field when it runs.)
  2. In `router.go.template`, replace the load-shedding line:
     ```go
     	// Inbound Defenses
     	router.Use(LoadSheddingMiddleware(cfg.Server.MaxConcurrentRequests)) // Configurable concurrency ceiling
     ```
     (`cfg` is the `*config.Config` parameter already in `RegisterRoutes`.)
- **Acceptance:**
  ```bash
  npm run build && ./dev test compilation
  ```
  ```bash
  # after sample regenerate
  grep -n "LoadSheddingMiddleware(cfg.Server.MaxConcurrentRequests)" /Users/ryannel/Workspace/groundWork/.sandboxes/demo/services/api/internal/entrypoints/api/router.go
  grep -n "MAX_CONCURRENT_REQUESTS" /Users/ryannel/Workspace/groundWork/.sandboxes/demo/services/api/internal/config/config.go
  ```
  Expected: `go build` passes; both greps match; no `LoadSheddingMiddleware(100)` remains.
- **Guardrails:** Do not change `TimeoutMiddleware(30 * time.Second)` or the rate limiter line (that is Task 2.2). Only the one `LoadSheddingMiddleware` call and the one config field.

---

### Task 2.8 — Next.js proxy fetch timeout
- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/nextjs-app/files/app/api/proxy/__path__/route.ts.template`
- **Depends on:** none
- **Goal:** The upstream `fetch` has no timeout — a hung backend holds the proxy request open indefinitely. Wrap it with `AbortController`, env-configurable (default 30s), and return 504 on timeout.
- **Anchor (current code to find):** (~line 78-99)
  ```ts
      try {
          const upstream = await fetch(url, {
              method: request.method,
              headers: await forwardHeaders(request.headers),
              body: request.body,
              // @ts-expect-error -- Node fetch supports duplex for streaming request bodies
              duplex: "half",
          });

          // Build response, forwarding status and filtered headers.
          const responseHeaders = new Headers();
          upstream.headers.forEach((value, key) => {
              if (!HOP_BY_HOP.has(key.toLowerCase())) {
                  responseHeaders.set(key, value);
              }
          });

          return new NextResponse(upstream.body, {
              status: upstream.status,
              statusText: upstream.statusText,
              headers: responseHeaders,
          });
      } catch (err) {
  ```
- **Change:**
  1. Add a module-level constant near `HOP_BY_HOP` (after the `HOP_BY_HOP` set definition, ~line 31):
     ```ts
     /** Upstream request timeout in milliseconds (env-configurable). */
     const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS ?? "30000");
     ```
  2. Replace the anchored `try { ... } catch (err) {` opening through the end of the `try` body. The new body sets up an `AbortController`, passes `signal`, and clears the timer in a `finally`:
     ```ts
         const controller = new AbortController();
         const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
         try {
             const upstream = await fetch(url, {
                 method: request.method,
                 headers: await forwardHeaders(request.headers),
                 body: request.body,
                 signal: controller.signal,
                 // @ts-expect-error -- Node fetch supports duplex for streaming request bodies
                 duplex: "half",
             });

             // Build response, forwarding status and filtered headers.
             const responseHeaders = new Headers();
             upstream.headers.forEach((value, key) => {
                 if (!HOP_BY_HOP.has(key.toLowerCase())) {
                     responseHeaders.set(key, value);
                 }
             });

             return new NextResponse(upstream.body, {
                 status: upstream.status,
                 statusText: upstream.statusText,
                 headers: responseHeaders,
             });
         } catch (err) {
             if (err instanceof Error && err.name === "AbortError") {
                 // eslint-disable-next-line no-console
                 console.error("[api/proxy] upstream timeout after", PROXY_TIMEOUT_MS, "ms");
                 return NextResponse.json(
                     { detail: "Backend service timed out" },
                     { status: 504 }
                 );
             }
             // eslint-disable-next-line no-console
             console.error("[api/proxy] upstream error:", err);
             return NextResponse.json(
                 { detail: "Backend service unavailable" },
                 { status: 502 }
             );
         } finally {
             clearTimeout(timeout);
         }
     }
     ```
     This replaces the existing `try { ... } catch (err) { ...502... } }` block in full — note the original `catch` body (the 502 branch) is preserved as the non-timeout fallback, and a `finally` is added to clear the timer.
- **Acceptance:**
  ```bash
  npm run build && ./dev test compilation
  ```
  Expected: `pnpm tsc` (the TS compile step in the compilation harness) passes for the nextjs-app. Confirm:
  ```bash
  # regenerate a nextjs app then:
  grep -n "AbortController\|PROXY_TIMEOUT_MS\|status: 504" <generated-nextjs>/app/api/proxy/[...path]/route.ts
  ```
  Expected: `AbortController`, `PROXY_TIMEOUT_MS`, and the 504 branch all present; tsc clean.
- **Guardrails:** Do not change `forwardHeaders`, `getUpstreamUrl`, `HOP_BY_HOP`, the Clerk branch, or the response-header forwarding logic. Keep the existing 502 fallback. Only the timeout constant, the `AbortController` wrapper, the `signal`, the 504 branch, and the `finally`.

---

### Task 2.9 — Python worker error handling + websocket resilience
- **Files:**
  - Worker: `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/src/entrypoints/worker/worker.py.template`
  - WS handler: `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/src/entrypoints/api/websocket_handler.py.template`
  - Main (hub injection): `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/src/main.py.template`
- **Depends on:** 2.3 (both edit `main.py`; apply 2.3 first so the `/readyz` block is settled, then add hub injection to `lifespan`).
- **Goal:** The worker handler has no try/except, no retry, no DLQ hook, no SIGTERM handling — failures vanish silently and in-flight jobs are killed on shutdown. The WS handler instantiates a module-global hub (not injected via app state) and has no heartbeat. Add structured error handling + a documented retry/DLQ hook + SIGTERM handling to the worker; add ping/heartbeat to the WS server and inject the hub via `app.state`. (Client-side reconnect is the browser's job — server-side we provide the heartbeat that lets clients detect a dead socket; do not fabricate a server "reconnect.")
- **Anchor (current code to find):**

  `worker.py.template` (full file):
  ```python
  import runpod
  from typing import Any, Dict
  ```
  ... (handler with no error handling, ending):
  ```python
  def handler(job: Dict[str, Any]) -> Dict[str, Any]:
      job_input = job['input']

      # Example boundary validation
      if 'prompt' not in job_input:
          return {"error": "Missing required field 'prompt' in input"}

      prompt = job_input['prompt']

      # In a real app, initialize services here. For async, use asyncio.run
      return {"status": "success", "echo": prompt}

  if __name__ == '__main__':
      runpod.serverless.start({'handler': handler})
  ```
  `websocket_handler.py.template` (full file):
  ```python
  from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
  from src.provider.websocket_hub import WebSocketHub

  # Instantiate hub (in a real app, bind to app state in lifespan)
  hub = WebSocketHub()

  router = APIRouter(prefix="/ws", tags=["websocket"])

  @router.websocket("")
  async def websocket_endpoint(websocket: WebSocket):
      await hub.connect(websocket)
      try:
          # Subscribe to a default channel or read from query
          await hub.subscribe("global")
          while True:
              data = await websocket.receive_text()
              # Handle incoming data if needed
              await hub.broadcast("global", {"echo": data})
      except WebSocketDisconnect:
          hub.disconnect(websocket)
  ```
  `main.py.template` lifespan (~line 23-44):
  ```python
  @asynccontextmanager
  async def lifespan(app: FastAPI):
      # Initialize resources like Redis pools, DB connections
      app.state.startup_failed = False
      try:
  ```
- **Change:**

  **(A) Worker — replace the full file** with structured error handling, a bounded retry loop, a documented DLQ hook, and SIGTERM handling. `runpod.serverless.start` owns the main loop; SIGTERM is handled by a registered signal handler that flips a shutdown flag and lets in-flight work finish.
  ```python
  import logging
  import signal
  import sys
  from typing import Any, Dict

  import runpod

  <% if (llm) { %>
  from src.provider.llm_gateway import OpenAILLMGateway
  <% } %>
  <% if (postgres) { %>
  from src.provider.database import get_db_session
  from src.provider.database_repository import PostgresExampleRepository
  from src.core.domain.entities import ExampleEntity
  import uuid
  import asyncio
  <% } %>

  logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
  logger = logging.getLogger("worker")

  MAX_RETRIES = 3

  # Set when SIGTERM/SIGINT is received so the handler can stop accepting new work
  # and let in-flight jobs finish (RunPod sends SIGTERM on scale-down/pre-empt).
  _shutting_down = False


  def _handle_sigterm(signum, frame):
      global _shutting_down
      _shutting_down = True
      logger.info("Received signal %s — draining; will reject new jobs", signum)


  signal.signal(signal.SIGTERM, _handle_sigterm)
  signal.signal(signal.SIGINT, _handle_sigterm)


  def send_to_dlq(job: Dict[str, Any], error: str) -> None:
      """Dead-letter hook. Replace with a real publish to a DLQ topic/table.

      Called when a job exhausts all retries. Kept as a documented stub so the
      failure is never silent — a real implementation publishes the failed job
      and its error to a durable dead-letter destination for later inspection.
      """
      logger.error("DLQ: job %s exhausted retries: %s", job.get("id", "unknown"), error)


  def process_job(job_input: Dict[str, Any]) -> Dict[str, Any]:
      """Pure business logic for one job. Raises on unrecoverable input."""
      if "prompt" not in job_input:
          raise ValueError("Missing required field 'prompt' in input")
      prompt = job_input["prompt"]
      # In a real app, initialize services here. For async work, use asyncio.run.
      return {"status": "success", "echo": prompt}


  def handler(job: Dict[str, Any]) -> Dict[str, Any]:
      if _shutting_down:
          return {"error": "worker shutting down", "retry": True}

      job_input = job.get("input", {})

      # Validation failures are NOT retried — they will always fail.
      if "prompt" not in job_input:
          logger.warning("Rejecting job %s: missing 'prompt'", job.get("id", "unknown"))
          return {"error": "Missing required field 'prompt' in input"}

      last_error = ""
      for attempt in range(1, MAX_RETRIES + 1):
          try:
              return process_job(job_input)
          except Exception as exc:  # noqa: BLE001 — boundary: log everything, never swallow silently
              last_error = str(exc)
              logger.error(
                  "Job %s failed (attempt %d/%d): %s",
                  job.get("id", "unknown"), attempt, MAX_RETRIES, last_error,
                  exc_info=True,
              )

      # All retries exhausted — dead-letter and fail loud.
      send_to_dlq(job, last_error)
      return {"error": f"job failed after {MAX_RETRIES} attempts: {last_error}"}


  if __name__ == "__main__":
      try:
          runpod.serverless.start({"handler": handler})
      except Exception:
          logger.critical("Worker crashed", exc_info=True)
          sys.exit(1)
  ```

  **(B) WS handler — replace the full file** to accept the hub from app state (no module global) and add a server-side heartbeat ping loop that detects dead sockets.
  ```python
  import asyncio

  from fastapi import APIRouter, WebSocket, WebSocketDisconnect

  from src.provider.websocket_hub import WebSocketHub

  router = APIRouter(prefix="/ws", tags=["websocket"])

  # Server-side heartbeat: ping idle clients so dead sockets are detected and
  # cleaned up. Clients reconnect on their side when a ping/connection fails.
  HEARTBEAT_INTERVAL_SECONDS = 30


  def _get_hub(websocket: WebSocket) -> WebSocketHub:
      """Resolve the shared hub injected into app.state during lifespan startup."""
      hub = getattr(websocket.app.state, "ws_hub", None)
      if hub is None:
          # Fail loud: the hub must be wired in lifespan.
          raise RuntimeError("WebSocketHub not initialized on app.state.ws_hub")
      return hub


  @router.websocket("")
  async def websocket_endpoint(websocket: WebSocket):
      hub = _get_hub(websocket)
      await hub.connect(websocket)

      async def heartbeat():
          while True:
              await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)
              await websocket.send_json({"type": "ping"})

      hb_task = asyncio.create_task(heartbeat())
      try:
          await hub.subscribe("global")
          while True:
              data = await websocket.receive_text()
              await hub.broadcast("global", {"echo": data})
      except WebSocketDisconnect:
          hub.disconnect(websocket)
      finally:
          hb_task.cancel()
  ```

  **(C) main.py — inject the hub into app.state during lifespan.** This edit applies ONLY when websockets are enabled. After Task 2.3 settles `lifespan`, find the `app.state.startup_failed = False` line inside `lifespan` (~line 26) and add the hub initialization immediately after it, guarded by the websockets branch:
  ```python
      app.state.startup_failed = False
  <% if (websockets) { %>
      # Shared WebSocket hub, injected so the WS handler reads it from app.state.
      from src.provider.websocket_hub import WebSocketHub
      app.state.ws_hub = WebSocketHub()
  <% } %>
  ```
- **Acceptance:**
  ```bash
  npm run build && ./dev test compilation
  ```
  Expected: `uv sync` + Python import succeed for the runpod/websockets/postgres combinations. Confirm:
  ```bash
  # regenerate a python service with --websockets --runpod, then:
  grep -n "send_to_dlq\|signal.SIGTERM\|MAX_RETRIES" <gen>/src/entrypoints/worker/worker.py
  grep -n "app.state.ws_hub\|HEARTBEAT_INTERVAL_SECONDS" <gen>/src/entrypoints/api/websocket_handler.py
  grep -n "app.state.ws_hub" <gen>/src/main.py
  ```
  Expected: all greps match; no module-global `hub = WebSocketHub()` remains in `websocket_handler.py`.
- **Guardrails:** Do not implement a full DLQ — `send_to_dlq` stays a documented logging stub (real publish is left to the user). Do not add a server-side "reconnect" — only the heartbeat ping. Do not change `WebSocketHub` in `websocket_hub.py` (Redis pub/sub stays as-is). Keep the worker's `process_job`/`handler` split so validation errors are not retried. The `main.py` hub injection must stay inside the `<% if (websockets) { %>` branch so non-websocket services do not import the hub.

---

## Definition of done for Phase 2

- [ ] 2.1 — `WriteTimeout` is `time.Duration(cfg.Server.WriteTimeoutSeconds) * time.Second` (default 20s); no `WriteTimeout: 0` anywhere.
- [ ] 2.2 — `go.mod.template` requires `github.com/redis/go-redis/v9`; `RateLimitMiddleware` uses a real Redis fixed-window limiter when `REDIS_URL` is set and falls back to memory only when empty; the dead "Falling back to Postgres" branch is gone; `RateLimitMiddleware` signature dropped `db`.
- [ ] 2.3 — Go exposes `/health/livez` (no deps) and `/health/readyz` (DB ping → 503 on failure) under the otel-filtered `/health` prefix; Python exposes `/livez` (no deps) and `/readyz` (SELECT 1 via `text()` + Redis ping when enabled → 503).
- [ ] 2.4 — `NewPostgresDB` applies `SetMaxOpenConns`/`SetMaxIdleConns`/`SetConnMaxLifetime`/`SetConnMaxIdleTime`, all env-configurable via `DatabaseConfig`.
- [ ] 2.5 — Base infra (`db`/`redis`/`pubsub`/`jaeger`) each have `restart: unless-stopped` + `mem_limit`; microservice blocks untouched; `docker compose config` parses.
- [ ] 2.6 — `provider.NewResilientClient` is instantiated in `main()` and threaded through both `buildApp` arms (websockets + non-websockets).
- [ ] 2.7 — `LoadSheddingMiddleware` reads `cfg.Server.MaxConcurrentRequests` (env `MAX_CONCURRENT_REQUESTS`, default 100); no hard-coded `100`.
- [ ] 2.8 — Next.js proxy `fetch` is wrapped in an `AbortController` (default 30s, `PROXY_TIMEOUT_MS`), returns 504 on timeout, keeps the 502 fallback, clears the timer in `finally`.
- [ ] 2.9 — Python worker has try/except + bounded retry + `send_to_dlq` hook + SIGTERM handling; WS handler reads the hub from `app.state.ws_hub` (no module global) with a heartbeat ping; `main.py` injects `app.state.ws_hub` in `lifespan` under the websockets branch.
- [ ] Phase gate green: `npm run build && ./dev test generation && ./dev test compilation` all exit 0.
