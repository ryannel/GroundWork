# Phase 4 — Real reference CRUD vertical slice

**Prerequisite:** Phase 0 complete (provides `test_crud_round_trip` in `src/generators/system-test-runner/files/tests/system/test_system.py.template`, currently `xfail`).

**Phase goal:** Turn the silently-succeeding no-op repository, idempotency, and handler stubs in the Go microservice generator into a genuinely working persistence vertical slice, so a freshly generated default service (`messaging=none`, `auth=none`, `websockets=false`) actually writes an entity to Postgres on `POST /api/v1/entities` and reads it back on `GET /api/v1/entities`. Add a real idempotency store so identical POST replays return the cached response. Close the one real Python stub (idempotency middleware never wired). When `messaging` is enabled, wire a real transactional outbox plus a relay worker.

**Phase acceptance gate (run from repo root `/Users/ryannel/Workspace/groundWork`):**
```bash
# 1. Generators build
npm run build                         # expect: exit 0, no TS errors

# 2. Generated Go service compiles for every option combo (pairwise go build)
./dev test compilation                # expect: PASS (go build / tsc / uv sync all green)

# 3. Full Docker boot + inner system tests, including the Phase 0 round-trip
./dev test scaffolds                  # expect: PASS, including test_crud_round_trip and test_idempotency_middleware
```
Expected end state: `test_crud_round_trip` (POST then GET `/api/v1/entities`, asserts the created entity is read back from the DB) PASSES; an idempotent POST replay (same `Idempotency-Key`) returns the identical cached response body/status.

> **There is no `./dev up`, `./dev migrate`, or `./dev test integration`.** The only test subcommands are `nx`, `generation`, `compilation`, `scaffolds` (see `./dev` at repo root). The round-trip runs *inside* `./dev test scaffolds` (it boots Docker via `tests/scaffolds/test_scaffolds.py` and runs the generated `tests/system/test_system.py`). Schema is applied by `scripts/apply-schema.sh` during boot and by the integration test's raw `db.DB.ExecContext(ctx, string(schemaBytes))` in `cmd/api/main_test.go`. The Go `cmd/api/main_test.go` testcontainers test is NOT run by `./dev test compilation` (that only does `go build`); it runs under `go test` inside the generated service, exercised by `./dev test scaffolds`.

---

## Generator-option gating (verified — READ before scoping any task)

Defaults from `src/generators/go-microservice/schema.json`: `messaging="none"`, `auth="none"`, `websockets=false`. The gate command `nx g go-microservice --name api --auth service` passes only `auth=service`, so the generated default service has **`messaging=none`** and **`websockets=false`**.

Consequences (verified in `generator.ts` lines 188-215 and the EJS guards):
- `messaging==='none'` → `generator.ts` DELETES `internal/core/gateway/message_queue.go`, `internal/core/gateway/outbox_repository.go`. The `<% if (messaging !== 'none') %>` blocks in `postgres.go.template`, `app_service.go.template`, `main.go.template`, `schema.sql.template` render to nothing. So in the default service there is NO outbox, NO `MessageQueue`, NO relay. **Task 3 code must stay entirely inside `<% if (messaging !== 'none') %>` and the new relay file must be deleted by `generator.ts` when `messaging==='none'`.**
- `websockets===false` → in `main.go.template` line 102, `buildApp` calls `service.NewAppService(txManager, entityRepo, nil ...)` — the `eventHub` is **nil**. `AppService.ExecuteUseCase` (`app_service.go.template` line 68) calls `s.eventHub.Broadcast(...)` UNCONDITIONALLY → **nil-pointer panic → HTTP 500 on every POST**. This is the #1 gate-blocker and is fixed in Task 4.0.
- `auth` does not affect the entity CRUD path. `auth=service` removes none of the files Phase 4 touches.

`var _ gateway.Repository[domain.Entity] = (*PostgresRepository)(nil)` (`postgres.go.template` line 84) is the ONLY implementer of `Repository[T]`. The interface (`repository.go.template`) has GetByID/Create/Update/Delete — **no List**. The list path is added in Task 4.4 without widening the generic interface.

---

### Task 4.0 — Guard the nil EventHub so POST does not panic
- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/core/service/app_service.go.template`
- **Depends on:** none
- **Goal:** Stop the unconditional `s.eventHub.Broadcast(...)` from nil-panicking in the default (`websockets=false`) service, where `eventHub` is injected as `nil`.
- **Anchor (current code to find — `app_service.go.template` ~lines 66-72):**
  ```go
  	// Broadcast the domain event synchronously to live clients
  	s.eventHub.Broadcast(domain.Event{
  		Type:    "entity.created",
  		Payload: entity,
  	})

  	return nil
  ```
- **Change:** Wrap the broadcast in a nil check. Replace the anchor with:
  ```go
  	// Broadcast the domain event synchronously to live clients.
  	// eventHub is nil when WebSockets are not enabled; broadcasting is optional.
  	if s.eventHub != nil {
  		s.eventHub.Broadcast(domain.Event{
  			Type:    "entity.created",
  			Payload: entity,
  		})
  	}

  	return nil
  ```
- **Acceptance:** `npm run build` → exit 0. After Task 4.1+4.4, a default-service POST returns 2xx instead of 500. Verified end-to-end by `./dev test scaffolds` (`test_crud_round_trip`).
- **Guardrails:** Do not change the `NewAppService` signature or the `main.go` wiring. Keep the broadcast best-effort (no error return). Do not remove the call — only guard it.

---

### Task 4.1 — Go entity repository: real parameterized CRUD
- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/provider/postgres.go.template`
- **Depends on:** none (but coordinate with Task 4.3 for the shared `querier`/tx helper if `messaging!=='none'`)
- **Goal:** Implement `Create`/`GetByID`/`Update`/`Delete` with real parameterized SQL against the `entities` table (`db/schema.sql.template`: `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`, `name VARCHAR(255) NOT NULL`, `created_at`, `updated_at`), matching `domain.Entity{ID,Name,CreatedAt,UpdatedAt}` (`model.go.template`).
- **Anchor (current code to find — `postgres.go.template` lines 91-113):**
  ```go
  // Create persists a new entity.
  func (r *PostgresRepository) Create(ctx context.Context, entity *domain.Entity) error {
  	// STUB: INSERT INTO entities (id, name) VALUES ($1, $2)
  	return nil
  }

  // GetByID retrieves an entity by its ID.
  func (r *PostgresRepository) GetByID(ctx context.Context, id string) (*domain.Entity, error) {
  	// STUB: SELECT id, name FROM entities WHERE id = $1
  	return &domain.Entity{ID: id}, nil
  }

  // Update modifies an existing entity.
  func (r *PostgresRepository) Update(ctx context.Context, entity *domain.Entity) error {
  	// STUB: UPDATE entities SET name = $2 WHERE id = $1
  	return nil
  }

  // Delete removes an entity by its ID.
  func (r *PostgresRepository) Delete(ctx context.Context, id string) error {
  	// STUB: DELETE FROM entities WHERE id = $1
  	return nil
  }
  ```
- **Change:**
  1. Add `errors` and `time` to the import block (top of file, lines 3-10). The block becomes:
     ```go
     import (
     	"context"
     	"database/sql"
     	"errors"
     	"fmt"

     	"<%= name %>/internal/core/domain"
     	"<%= name %>/internal/core/gateway"
     )
     ```
     (`time` is not needed — `created_at`/`updated_at` are scanned via `RETURNING`/`SELECT` into `time.Time` fields already imported transitively through `domain`; do NOT add a `time` import unless the compiler complains.)
  2. Add the transaction-context primitives and a `querier` helper so the same methods run on either the pooled `*sql.DB` or an in-flight `*sql.Tx` pulled from context. These primitives are NOT gated (they compile and work with `messaging=none`; `querier` simply returns `r.db.DB` when no tx is bound). They make Create + outbox share one transaction once Task 4.3 enlists the tx. Insert this block immediately AFTER `NewPostgresRepository` (after line 89):
     ```go
     // txContextKey binds an in-flight *sql.Tx to a context so repositories sharing
     // the same use-case can enlist in one transaction (see querier).
     type txContextKey struct{}

     // txFromContext returns the *sql.Tx bound to ctx, if any.
     func txFromContext(ctx context.Context) (*sql.Tx, bool) {
     	tx, ok := ctx.Value(txContextKey{}).(*sql.Tx)
     	return tx, ok
     }

     // sqlExecutor is the subset of *sql.DB / *sql.Tx used by the repository.
     type sqlExecutor interface {
     	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
     	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
     	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
     }

     // querier returns the active transaction's executor if one is bound to the
     // context, otherwise the connection pool. This lets a single use-case run
     // Create and outbox.InsertEvent in one tx.
     func (r *PostgresRepository) querier(ctx context.Context) sqlExecutor {
     	if tx, ok := txFromContext(ctx); ok {
     		return tx
     	}
     	return r.db.DB
     }
     ```
     Then add `WithContext` to `PostgresTransaction` so the service can enlist repository calls (Task 4.3 uses it; defining it here keeps the `Transaction` interface and provider consistent in one place). Insert after `Rollback` (~line 76):
     ```go
     // WithContext binds this transaction's *sql.Tx to the returned context so
     // repository calls enlist in this transaction.
     func (t *PostgresTransaction) WithContext(ctx context.Context) context.Context {
     	return context.WithValue(ctx, txContextKey{}, t.tx)
     }
     ```
     And widen the `Transaction` interface in `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/core/gateway/repository.go.template` (lines 13-17) to:
     ```go
     // Transaction represents an active database transaction.
     type Transaction interface {
     	Commit(ctx context.Context) error
     	Rollback(ctx context.Context) error
     	// WithContext returns a context that enlists repository calls in this transaction.
     	WithContext(ctx context.Context) context.Context
     }
     ```
  3. Replace the four stub methods with:
     ```go
     // Create persists a new entity, letting Postgres assign the UUID and timestamps.
     func (r *PostgresRepository) Create(ctx context.Context, entity *domain.Entity) error {
     	const q = `
     		INSERT INTO entities (name)
     		VALUES ($1)
     		RETURNING id, name, created_at, updated_at`
     	err := r.querier(ctx).QueryRowContext(ctx, q, entity.Name).
     		Scan(&entity.ID, &entity.Name, &entity.CreatedAt, &entity.UpdatedAt)
     	if err != nil {
     		return fmt.Errorf("insert entity: %w", err)
     	}
     	return nil
     }

     // GetByID retrieves an entity by its ID. Returns domain.ErrNotFound if absent.
     func (r *PostgresRepository) GetByID(ctx context.Context, id string) (*domain.Entity, error) {
     	const q = `
     		SELECT id, name, created_at, updated_at
     		FROM entities
     		WHERE id = $1`
     	var e domain.Entity
     	err := r.querier(ctx).QueryRowContext(ctx, q, id).
     		Scan(&e.ID, &e.Name, &e.CreatedAt, &e.UpdatedAt)
     	if errors.Is(err, sql.ErrNoRows) {
     		return nil, domain.ErrNotFound
     	}
     	if err != nil {
     		return nil, fmt.Errorf("get entity by id: %w", err)
     	}
     	return &e, nil
     }

     // Update modifies an existing entity's mutable fields.
     func (r *PostgresRepository) Update(ctx context.Context, entity *domain.Entity) error {
     	const q = `
     		UPDATE entities
     		SET name = $2, updated_at = NOW()
     		WHERE id = $1
     		RETURNING updated_at`
     	err := r.querier(ctx).QueryRowContext(ctx, q, entity.ID, entity.Name).
     		Scan(&entity.UpdatedAt)
     	if errors.Is(err, sql.ErrNoRows) {
     		return domain.ErrNotFound
     	}
     	if err != nil {
     		return fmt.Errorf("update entity: %w", err)
     	}
     	return nil
     }

     // Delete removes an entity by its ID. Returns domain.ErrNotFound if no row matched.
     func (r *PostgresRepository) Delete(ctx context.Context, id string) error {
     	const q = `DELETE FROM entities WHERE id = $1`
     	res, err := r.querier(ctx).ExecContext(ctx, q, id)
     	if err != nil {
     		return fmt.Errorf("delete entity: %w", err)
     	}
     	n, err := res.RowsAffected()
     	if err != nil {
     		return fmt.Errorf("delete entity rows affected: %w", err)
     	}
     	if n == 0 {
     		return domain.ErrNotFound
     	}
     	return nil
     }
     ```
  4. **Confirm `domain.ErrNotFound` exists.** Read `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/core/domain/errors.go.template`. If the exported sentinel is named differently (e.g. `ErrNotFound` vs `ErrConflict`), use the exact name found there. `app_handler.go` already references `domain.ErrConflict`, so the errors file exists.
- **Acceptance:** `npm run build` → exit 0; `./dev test compilation` → PASS (the generated service `go build`s). Round-trip verified by `./dev test scaffolds`.
- **Guardrails:** Keep ALL SQL parameterized (`$1`, `$2` — never string-concatenate input). Do NOT change the `gateway.Repository[domain.Entity]` interface or the `var _` assertion (line 84). Do NOT have `Create` set `entity.ID` itself — let Postgres `RETURNING` populate it (the `uuid_generate_v4()` default), so the prior hardcoded `"gen-id-123"` is gone and the column's UUID type is respected.

---

### Task 4.2 — Go idempotency repository: real store + schema table
- **Files:**
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/entrypoints/api/idempotency/repository.go.template`
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/db/schema.sql.template`
- **Depends on:** none
- **Goal:** Implement `Get`/`Save` against an `idempotency_keys` table so the existing `idempotency.Middleware` actually caches and replays 2xx POST responses. The middleware (`middleware.go.template`) calls `repo.Get(ctx, key, userID)` and, on a 2xx, `repo.Save(ctx, key, userID, &CachedResponse{Status, Header, Body})` where `Header` is `map[string][]string`.
- **Anchor 1 (current stub — `repository.go.template` lines 29-37):**
  ```go
  func (r *PostgresRepository) Get(ctx context.Context, key string, userID string) (*CachedResponse, error) {
  	// STUB
  	return nil, nil
  }

  func (r *PostgresRepository) Save(ctx context.Context, key string, userID string, resp *CachedResponse) error {
  	// STUB
  	return nil
  }
  ```
- **Anchor 2 (current schema — `schema.sql.template` lines 6-11, the `entities` table; the file has NO idempotency table):**
  ```sql
  CREATE TABLE entities (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  ```
- **Change:**
  1. **Schema** — add the idempotency table to `schema.sql.template` immediately after the `entities` table (before the `<% if (messaging !== 'none') %>` outbox block). The table is named `idempotency_keys` with a `created_at` column because `cmd/worker/cleanup/main.go.template` line 31 already runs `DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours'`. Insert:
     ```sql
     -- Idempotency cache: stores the response of a previously executed mutating
     -- request so identical Idempotency-Key replays return the same result.
     -- The cleanup worker (cmd/worker/cleanup) prunes rows older than 24h.
     CREATE TABLE idempotency_keys (
         idempotency_key VARCHAR(255) NOT NULL,
         user_id VARCHAR(255) NOT NULL,
         response_status INT NOT NULL,
         response_headers JSONB NOT NULL,
         response_body BYTEA NOT NULL,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
         PRIMARY KEY (idempotency_key, user_id)
     );
     ```
  2. **Repository** — replace the two stubs. The `CachedResponse.Header` is `map[string][]string`; store it as JSON. Update the import block (currently `context`, `database/sql`) to add `encoding/json` and `errors`:
     ```go
     import (
     	"context"
     	"database/sql"
     	"encoding/json"
     	"errors"
     )
     ```
     Then:
     ```go
     func (r *PostgresRepository) Get(ctx context.Context, key string, userID string) (*CachedResponse, error) {
     	const q = `
     		SELECT response_status, response_headers, response_body
     		FROM idempotency_keys
     		WHERE idempotency_key = $1 AND user_id = $2`
     	var (
     		status      int
     		headersJSON []byte
     		body        []byte
     	)
     	err := r.db.QueryRowContext(ctx, q, key, userID).Scan(&status, &headersJSON, &body)
     	if errors.Is(err, sql.ErrNoRows) {
     		return nil, nil // cache miss — middleware proceeds to execute the request
     	}
     	if err != nil {
     		return nil, err
     	}
     	header := map[string][]string{}
     	if len(headersJSON) > 0 {
     		if err := json.Unmarshal(headersJSON, &header); err != nil {
     			return nil, err
     		}
     	}
     	return &CachedResponse{Status: status, Header: header, Body: body}, nil
     }

     func (r *PostgresRepository) Save(ctx context.Context, key string, userID string, resp *CachedResponse) error {
     	headersJSON, err := json.Marshal(resp.Header)
     	if err != nil {
     		return err
     	}
     	const q = `
     		INSERT INTO idempotency_keys
     			(idempotency_key, user_id, response_status, response_headers, response_body)
     		VALUES ($1, $2, $3, $4, $5)
     		ON CONFLICT (idempotency_key, user_id) DO NOTHING`
     	_, err = r.db.ExecContext(ctx, q, key, userID, resp.Status, headersJSON, resp.Body)
     	return err
     }
     ```
- **Acceptance:** `npm run build` → exit 0; `./dev test compilation` → PASS. Replay behaviour verified by `./dev test scaffolds` (`test_idempotency_middleware` un-skipped — see Task 4.6).
- **Guardrails:** Parameterized SQL only. `ON CONFLICT DO NOTHING` so a racing duplicate save does not error. `Get` MUST return `(nil, nil)` on cache miss (the middleware treats `err==nil && cached==nil` as "execute the request") — do NOT return an error for "not found". Keep the `Repository` interface (lines 16-19) and `var _`-style usage intact; `NewPostgresRepository(db *sql.DB)` signature is unchanged (it's called in `router.go` line 57).

---

### Task 4.3 — Go transactional outbox + relay worker (gated on `messaging !== 'none'`)
- **Files:**
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/provider/postgres.go.template` (implement `InsertEvent`/`PollUnpublished`/`MarkPublished` — tx primitives already added in Task 4.1)
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/core/service/app_service.go.template` (bind tx to ctx so Create joins the outbox tx)
  - NEW: `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/cmd/worker/outbox/main.go.template`
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/generator.ts` (delete the new worker file when `messaging==='none'`)
- **Depends on:** 4.1 (consumes `txFromContext`/`PostgresTransaction.WithContext`/widened `Transaction` interface added there)
- **Goal:** Make the outbox real: `InsertEvent` writes to `outbox_events` inside the use-case transaction; a standalone relay worker polls unpublished rows with `FOR UPDATE SKIP LOCKED`, publishes via `gateway.MessageQueue`, and marks them published — failing loud (does NOT mark published if `Publish` errors).
- **Anchor 1 (current outbox stubs — `postgres.go.template` lines 115-145, the `<% if (messaging !== 'none') %>` block):**
  ```go
  // InsertEvent saves a domain event to the outbox table.
  func (r *OutboxRepository) InsertEvent(ctx context.Context, tx gateway.Transaction, eventType string, payload []byte) error {
  	// STUB: INSERT INTO outbox (event_type, payload) VALUES ($1, $2)
  	return nil
  }

  // PollUnpublished fetches unpublished events from the outbox.
  func (r *OutboxRepository) PollUnpublished(ctx context.Context, limit int) ([]gateway.OutboxEvent, error) {
  	// STUB: SELECT * FROM outbox WHERE published = false ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED
  	return nil, nil
  }

  // MarkPublished marks an outbox event as successfully published.
  func (r *OutboxRepository) MarkPublished(ctx context.Context, id string) error {
  	// STUB: UPDATE outbox SET published = true WHERE id = $1
  	return nil
  }
  ```
- **Anchor 2 (tx not threaded to Create — `app_service.go.template` lines 42-53):**
  ```go
  func (s *AppService) ExecuteUseCase(ctx context.Context, entity *domain.Entity) error {
  	// Begin transaction
  	tx, err := s.txManager.Begin(ctx)
  	if err != nil {
  		return fmt.Errorf("begin transaction: %w", err)
  	}
  	defer tx.Rollback(ctx)

  	// Perform business logic (e.g., save to DB)
  	if err := s.repo.Create(ctx, entity); err != nil {
  		return fmt.Errorf("create entity: %w", err)
  	}
  ```
- **Change:**
  1. **Tx context primitives are already added in Task 4.1** (`txContextKey`, `txFromContext`, `PostgresTransaction.WithContext`, and the widened `gateway.Transaction` interface). Do NOT redefine them here. This task only consumes them.
  2. **Thread tx into the use-case** — in `app_service.go.template`, after `defer tx.Rollback(ctx)` (line 48), enlist the repo in the tx:
     ```go
     	defer tx.Rollback(ctx)

     	// Enlist repository operations in this transaction.
     	ctx = tx.WithContext(ctx)

     	// Perform business logic (e.g., save to DB)
     	if err := s.repo.Create(ctx, entity); err != nil {
     		return fmt.Errorf("create entity: %w", err)
     	}
     ```
     This is NOT gated — it is harmless when `messaging=none` (single statement still commits) and is required for Create+InsertEvent atomicity when messaging is on.
  3. **Outbox repository (gated)** — replace the three stubs (`outbox_events` columns from `schema.sql.template`: `id UUID PK`, `event_type`, `payload JSONB`, `created_at`, `published_at TIMESTAMPTZ NULL`):
     ```go
     // InsertEvent saves a domain event to the outbox within the caller's transaction.
     // OutboxRepository and PostgresTransaction are in the same `provider` package,
     // so the concrete *sql.Tx is reached by type-asserting the gateway.Transaction.
     func (r *OutboxRepository) InsertEvent(ctx context.Context, tx gateway.Transaction, eventType string, payload []byte) error {
     	pt, ok := tx.(*PostgresTransaction)
     	if !ok {
     		return fmt.Errorf("insert outbox event: unexpected transaction type %T", tx)
     	}
     	const q = `INSERT INTO outbox_events (event_type, payload) VALUES ($1, $2)`
     	if _, err := pt.tx.ExecContext(ctx, q, eventType, payload); err != nil {
     		return fmt.Errorf("insert outbox event: %w", err)
     	}
     	return nil
     }

     // PollUnpublished returns up to `limit` unpublished events, oldest first.
     // Delivery is AT-LEAST-ONCE: the relay marks an event published only after a
     // successful Publish, so a crash between publish and mark re-delivers it.
     // This is a plain read (no row lock held across the publish), so consumers
     // must dedupe by event id. Running more than one relay replica can publish
     // the same event twice; for single-replica deployments this is sufficient.
     func (r *OutboxRepository) PollUnpublished(ctx context.Context, limit int) ([]gateway.OutboxEvent, error) {
     	const q = `
     		SELECT id, event_type, payload, EXTRACT(EPOCH FROM created_at)::bigint
     		FROM outbox_events
     		WHERE published_at IS NULL
     		ORDER BY created_at
     		LIMIT $1`
     	rows, err := r.db.DB.QueryContext(ctx, q, limit)
     	if err != nil {
     		return nil, fmt.Errorf("poll unpublished: %w", err)
     	}
     	defer rows.Close()

     	var events []gateway.OutboxEvent
     	for rows.Next() {
     		var e gateway.OutboxEvent
     		if err := rows.Scan(&e.ID, &e.EventType, &e.Payload, &e.CreatedAt); err != nil {
     			return nil, fmt.Errorf("scan outbox event: %w", err)
     		}
     		events = append(events, e)
     	}
     	return events, rows.Err()
     }

     // MarkPublished marks an outbox event as published.
     func (r *OutboxRepository) MarkPublished(ctx context.Context, id string) error {
     	const q = `UPDATE outbox_events SET published_at = NOW() WHERE id = $1`
     	res, err := r.db.DB.ExecContext(ctx, q, id)
     	if err != nil {
     		return fmt.Errorf("mark published: %w", err)
     	}
     	n, err := res.RowsAffected()
     	if err != nil {
     		return fmt.Errorf("mark published rows affected: %w", err)
     	}
     	if n == 0 {
     		return fmt.Errorf("mark published: no row for id %s", id)
     	}
     	return nil
     }
     ```
  4. **Relay worker (NEW file, fully gated)** — create `cmd/worker/outbox/main.go.template`. The whole file is wrapped in `<% if (messaging !== 'none') %> ... <% } %>` so it renders empty for the default service (and the generator deletes it — step 5). It builds the concrete `MessageQueue` for the selected broker (`provider.NewKafkaPublisher` for kafka, `provider.NewPubSubPublisher` for gcp-pubsub — read `kafka.go.template`/`gcp_pubsub.go.template` for exact constructor names/args). FAIL LOUD: skip `MarkPublished` when `Publish` errors.
     ```go
     <% if (messaging !== 'none') { %>package main

     import (
     	"context"
     	"os"
     	"os/signal"
     	"syscall"
     	"time"

     	_ "github.com/joho/godotenv/autoload"
     	_ "github.com/lib/pq"
     	"github.com/rs/zerolog/log"

     	"<%= name %>/internal/config"
     	"<%= name %>/internal/core/gateway"
     	"<%= name %>/internal/provider"
     )

     func main() {
     	cfg := config.Load()

     	db, err := provider.NewPostgresDB(cfg.Database.URI)
     	if err != nil {
     		log.Fatal().Err(err).Msg("Failed to connect to database")
     	}
     	defer db.Close()

     	outbox := provider.NewOutboxRepository(db)

     	var mq gateway.MessageQueue
     <% if (messaging === 'kafka') { %>
     	mq, err = provider.NewKafkaPublisher(os.Getenv("KAFKA_BROKERS"))
     <% } else if (messaging === 'gcp-pubsub') { %>
     	mq, err = provider.NewPubSubPublisher(os.Getenv("GCP_PROJECT_ID"))
     <% } %>
     	if err != nil {
     		log.Fatal().Err(err).Msg("Failed to initialize message publisher")
     	}

     	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
     	defer stop()

     	ticker := time.NewTicker(1 * time.Second)
     	defer ticker.Stop()

     	log.Info().Msg("Outbox relay worker started")

     	for {
     		select {
     		case <-ctx.Done():
     			log.Info().Msg("Outbox relay worker shutting down")
     			return
     		case <-ticker.C:
     			relayBatch(ctx, outbox, mq)
     		}
     	}
     }

     // relayBatch publishes one batch of unpublished events. It marks an event
     // published ONLY after a successful Publish — a publish failure leaves the
     // row unpublished for the next tick (at-least-once delivery), failing loud.
     func relayBatch(ctx context.Context, outbox gateway.OutboxRepository, mq gateway.MessageQueue) {
     	events, err := outbox.PollUnpublished(ctx, 100)
     	if err != nil {
     		log.Error().Err(err).Msg("Failed to poll outbox")
     		return
     	}
     	for _, e := range events {
     		if err := mq.Publish(ctx, e.EventType, []byte(e.ID), e.Payload); err != nil {
     			log.Error().Err(err).Str("event_id", e.ID).Msg("Publish failed; leaving event unpublished")
     			continue
     		}
     		if err := outbox.MarkPublished(ctx, e.ID); err != nil {
     			log.Error().Err(err).Str("event_id", e.ID).Msg("Failed to mark event published")
     		}
     	}
     }
     <% } %>
     ```
     > Verify the publisher constructor signatures by reading `kafka.go.template` (`NewKafkaPublisher(brokers string)`) and `gcp_pubsub.go.template` (`NewPubSubPublisher(projectID string)`) — both confirmed. If `cfg` already exposes broker config, prefer that over `os.Getenv`; the current `config.go.template` has no broker fields, so `os.Getenv` is correct unless Task adds them.
  5. **Generator gating** — in `generator.ts`, the existing `if (options.messaging === 'none')` block (lines 194-198) must ALSO delete the new worker dir. Add inside that block:
     ```ts
     tree.delete(`${projectRoot}/cmd/worker/outbox`);
     ```
     (Place it next to the existing `tree.delete` calls for `asyncapi-pubsub.yaml`, `message_queue.go`, `outbox_repository.go`.)
- **Acceptance:** `npm run build` → exit 0. `./dev test compilation` → PASS for BOTH a `messaging=none` combo (worker absent, no `MessageQueue` import errors) AND a `messaging=kafka`/`gcp-pubsub` combo (worker compiles). `./dev test generation` → PASS (confirms `cmd/worker/outbox` is present only when messaging != none).
- **Guardrails:** Every line that references `OutboxRepository`, `gateway.MessageQueue`, `txContextKey`-via-outbox, or the relay file MUST be inside `<% if (messaging !== 'none') %>` (or deleted by `generator.ts`) — otherwise the default service fails to compile because `message_queue.go`/`outbox_repository.go` are deleted. Keep `FOR UPDATE SKIP LOCKED`. Do NOT mark published before a successful publish. Do not add broker config to `config.go` unless you also gate it.

---

### Task 4.4 — Go handler: POST persists & returns real data; GET lists from DB with cursor pagination
- **Files:**
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/entrypoints/api/app_handler.go.template`
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/core/service/app_service.go.template` (add `ListEntities`)
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/provider/postgres.go.template` (add concrete `List` on `PostgresRepository`)
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/internal/core/gateway/repository.go.template` (add `EntityLister` interface — keeps generic `Repository[T]` untouched)
- **Depends on:** 4.0, 4.1
- **Goal:** POST returns the actually-persisted entity (real UUID + timestamps from Task 4.1); GET lists from the DB using the already-scaffolded `decodeCursor`/`buildPagination`, fetching `limit+1` rows seeked by `(created_at, id)`.
- **Anchor 1 (POST handler — `app_handler.go.template` lines 48-65):**
  ```go
  }, func(ctx context.Context, input *CreateEntityRequest) (*CreateEntityResponse, error) {

  		entity := &domain.Entity{
  			ID:   "gen-id-123", // STUB: use uuid.New()
  			Name: input.Body.Name,
  		}

  		if err := appSvc.ExecuteUseCase(ctx, entity); err != nil {
  			if errors.Is(err, domain.ErrConflict) {
  				return nil, huma.Error409Conflict("Entity already exists", err)
  			}
  			return nil, huma.Error500InternalServerError("Internal server error", err)
  		}

  		resp := &CreateEntityResponse{}
  		resp.Body.ID = entity.ID
  		return resp, nil
  	})
  ```
- **Anchor 2 (GET handler — `app_handler.go.template` lines 74-107):**
  ```go
  	}, func(ctx context.Context, input *ListEntitiesRequest) (*ListEntitiesResponse, error) {

  		// 1. Decode Cursor
  		var afterID string
  		var afterCreatedAt time.Time
  		if payload := decodeCursor(input.Cursor); payload != nil {
  			afterID = payload.ID
  			afterCreatedAt = payload.CreatedAt
  		}

  		_ = afterID
  		_ = afterCreatedAt

  		// STUB: Use afterID, afterCreatedAt and input.Limit to fetch items.
  		// Example: items, err := appSvc.ListEntities(ctx, afterID, afterCreatedAt, input.Limit+1)

  		// For demonstration, we create a mock list
  		now := time.Now()
  		items := []*domain.Entity{
  			{ID: "ent-1", Name: "First", CreatedAt: now.Add(-1 * time.Hour)},
  			{ID: "ent-2", Name: "Second", CreatedAt: now.Add(-2 * time.Hour)},
  		}

  		// 2. Build Pagination
  		data, pagination := buildPagination(items, input.Limit,
  			func(e *domain.Entity) string { return e.ID },
  			func(e *domain.Entity) time.Time { return e.CreatedAt },
  		)

  		resp := &ListEntitiesResponse{}
  		resp.Body.Data = data
  		resp.Body.Pagination = pagination
  		return resp, nil
  	})
  ```
- **Change:**
  1. **Gateway lister interface** — in `repository.go.template` (which Task 4.1 already widened the `Transaction` interface in). First update its import block: the file is `package gateway` and currently imports only `"context"`. Replace that single import with:
     ```go
     import (
     	"context"
     	"time"

     	"<%= name %>/internal/core/domain"
     )
     ```
     Then, after the `Repository[T]` interface (after line 11), add (the generic interface stays unchanged per guardrails):
     ```go
     // EntityLister provides keyset/cursor listing for entities. It is a separate
     // interface from the generic Repository[T] so the generic contract stays minimal.
     type EntityLister interface {
     	List(ctx context.Context, afterCreatedAt time.Time, afterID string, limit int) ([]*domain.Entity, error)
     }
     ```
  2. **Concrete List** — in `postgres.go.template`, add to `PostgresRepository` (after `Delete`, before the `<% if messaging %>` block, ~line 113). Keyset on `(created_at, id)` ascending; pass `afterCreatedAt.IsZero()` as the "no cursor" signal:
     ```go
     // List returns up to `limit` entities ordered by (created_at, id) ascending,
     // starting strictly after the (afterCreatedAt, afterID) keyset when provided.
     func (r *PostgresRepository) List(ctx context.Context, afterCreatedAt time.Time, afterID string, limit int) ([]*domain.Entity, error) {
     	const q = `
     		SELECT id, name, created_at, updated_at
     		FROM entities
     		WHERE ($1::timestamptz IS NULL)
     		   OR (created_at, id) > ($1, $2)
     		ORDER BY created_at, id
     		LIMIT $3`
     	// Bind BOTH keyset params as nil when there is no cursor. Passing the empty
     	// string for the id would make Postgres bind $2 as uuid and fail with
     	// "invalid input syntax for type uuid" at bind time, even though the
     	// "$1 IS NULL" branch is the one that matches. NULL::uuid binds cleanly.
     	var afterTS, afterIDArg any
     	if !afterCreatedAt.IsZero() {
     		afterTS = afterCreatedAt
     		afterIDArg = afterID
     	}
     	rows, err := r.querier(ctx).QueryContext(ctx, q, afterTS, afterIDArg, limit)
     	if err != nil {
     		return nil, fmt.Errorf("list entities: %w", err)
     	}
     	defer rows.Close()

     	var out []*domain.Entity
     	for rows.Next() {
     		var e domain.Entity
     		if err := rows.Scan(&e.ID, &e.Name, &e.CreatedAt, &e.UpdatedAt); err != nil {
     			return nil, fmt.Errorf("scan entity: %w", err)
     		}
     		out = append(out, &e)
     	}
     	return out, rows.Err()
     }
     ```
     Add `"time"` to the `postgres.go.template` import block (it is now genuinely needed here).
  3. **Service ListEntities** — in `app_service.go.template`, the `AppService.repo` field is typed `gateway.Repository[domain.Entity]`, which has no `List`. Add a method that type-asserts to `gateway.EntityLister` (the concrete `*PostgresRepository` satisfies both). Add after `ExecuteUseCase`:
     ```go
     // ListEntities returns a page of entities using keyset pagination.
     func (s *AppService) ListEntities(ctx context.Context, afterCreatedAt time.Time, afterID string, limit int) ([]*domain.Entity, error) {
     	lister, ok := s.repo.(gateway.EntityLister)
     	if !ok {
     		return nil, fmt.Errorf("repository does not support listing")
     	}
     	return lister.List(ctx, afterCreatedAt, afterID, limit)
     }
     ```
     Add `"time"` to `app_service.go.template` imports (currently `context`, `fmt`).
  4. **POST handler** — replace Anchor 1's body with (no more `"gen-id-123"`; the entity's ID/timestamps are filled by Create via `RETURNING`):
     ```go
     }, func(ctx context.Context, input *CreateEntityRequest) (*CreateEntityResponse, error) {

     		entity := &domain.Entity{
     			Name: input.Body.Name,
     		}

     		if err := appSvc.ExecuteUseCase(ctx, entity); err != nil {
     			if errors.Is(err, domain.ErrConflict) {
     				return nil, huma.Error409Conflict("Entity already exists", err)
     			}
     			return nil, huma.Error500InternalServerError("Internal server error", err)
     		}

     		resp := &CreateEntityResponse{}
     		resp.Body.ID = entity.ID
     		return resp, nil
     	})
     ```
     > Optional: widen `CreateEntityResponse.Body` to return the full entity (Name/CreatedAt). Not required for the round-trip (GET reads it back), so keep the `ID`-only shape to minimize change unless Phase 0's test asserts the POST body.
  5. **GET handler** — replace Anchor 2's body with a real DB-backed list (fetch `limit+1` so `buildPagination`'s limit+1 technique works):
     ```go
     	}, func(ctx context.Context, input *ListEntitiesRequest) (*ListEntitiesResponse, error) {

     		// 1. Decode Cursor
     		var afterID string
     		var afterCreatedAt time.Time
     		if payload := decodeCursor(input.Cursor); payload != nil {
     			afterID = payload.ID
     			afterCreatedAt = payload.CreatedAt
     		}

     		// 2. Fetch limit+1 rows so buildPagination can detect a further page.
     		items, err := appSvc.ListEntities(ctx, afterCreatedAt, afterID, input.Limit+1)
     		if err != nil {
     			return nil, huma.Error500InternalServerError("Internal server error", err)
     		}

     		// 3. Build Pagination
     		data, pagination := buildPagination(items, input.Limit,
     			func(e *domain.Entity) string { return e.ID },
     			func(e *domain.Entity) time.Time { return e.CreatedAt },
     		)

     		resp := &ListEntitiesResponse{}
     		resp.Body.Data = data
     		resp.Body.Pagination = pagination
     		return resp, nil
     	})
     ```
     `time` is already imported in `app_handler.go.template` (line 7). The `_ = afterID` / `_ = afterCreatedAt` discards are removed.
- **Acceptance:** `npm run build` → exit 0; `./dev test compilation` → PASS. Round-trip (`./dev test scaffolds`): POST `/api/v1/entities` returns 2xx with a real UUID `id`; GET `/api/v1/entities` returns the just-created entity in `data`.
- **Guardrails:** Go through `AppService` — handlers call `appSvc.ExecuteUseCase` / `appSvc.ListEntities`, NEVER the repo directly (service-layer guardrail). Do NOT widen `gateway.Repository[T]`. Reuse the existing `decodeCursor`/`encodeCursor`/`buildPagination` (`types.go`) — do not write a second cursor codec. Keyset SQL stays parameterized.

---

### Task 4.5 — Python: wire the idempotency middleware (the one real Python stub)
- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/src/main.py.template`
- **Depends on:** none
- **Goal:** The Python entity CRUD is ALREADY real — `PostgresExampleRepository.save`/`get_by_id`/`list_items` and `PostgresIdempotencyRepository` in `database_repository.py` perform genuine async SQLAlchemy CRUD, the service (`example_service.py`) calls `repository.save` then returns the entity, the router returns it, and `schema.sql` already defines `examples` + `idempotency_keys`. **Do NOT rewrite the Python repository or service.** The single real stub is in `main.py`: the `lifespan` sets `app.state.db_engine` but NEVER sets `app.state.idempotency_repo`, so `IdempotencyMiddleware` (`middleware.py` line 86-89) always hits `if not repo: return await call_next(...)` — the middleware silently no-ops and never caches.
- **Anchor (current `main.py.template` lifespan — lines 23-44):**
  ```python
  @asynccontextmanager
  async def lifespan(app: FastAPI):
      # Initialize resources like Redis pools, DB connections
      app.state.startup_failed = False
      try:
  <% if (postgres) { %>
          # Provide the repository for the idempotency middleware
          # For simplicity, we just inject the class/engine. In a real app, DI container is better.
          # But wait, PostgresIdempotencyRepository needs an AsyncSession which is bound to a request scope.
          # For the middleware, we can bind an engine or sessionmaker to app.state.
          app.state.db_engine = engine
  <% } %>
          pass
      except Exception:
          app.state.startup_failed = True

      yield

      # Cleanup resources gracefully
  <% if (postgres) { %>
      await engine.dispose()
  <% } %>
  ```
- **Change:** The middleware needs an `IdempotencyRepository` it can call OUTSIDE FastAPI's request-DI scope, so give it its own sessionmaker-backed repo. The hard part for a weaker model: `PostgresIdempotencyRepository.__init__(self, session)` takes a *session*, and each call commits — but a single long-lived session across all requests is unsafe. Provide an adapter that opens a fresh session per call.
  1. Update the import (top of file is fine — only on `postgres`). Change the postgres import block to also pull the sessionmaker and repo:
     ```python
  <% if (postgres) { %>
  from src.provider.database import engine, async_session_maker
  from src.provider.database_repository import PostgresIdempotencyRepository
  <% } %>
     ```
  2. Add a per-call session adapter and bind it in `lifespan`. Replace the anchor's `<% if (postgres) %>` body inside the `try` with:
     ```python
  <% if (postgres) { %>
          # Bind an idempotency repository for the IdempotencyMiddleware. The
          # middleware runs outside FastAPI's request-DI scope, so it cannot use
          # Depends(get_db_session). This adapter opens a fresh AsyncSession per
          # call, delegating to the real PostgresIdempotencyRepository.
          class _SessionScopedIdempotencyRepo:
              async def get(self, key, user_id):
                  async with async_session_maker() as session:
                      return await PostgresIdempotencyRepository(session).get(key, user_id)

              async def lock(self, key, user_id):
                  async with async_session_maker() as session:
                      return await PostgresIdempotencyRepository(session).lock(key, user_id)

              async def save(self, key, user_id, response):
                  async with async_session_maker() as session:
                      return await PostgresIdempotencyRepository(session).save(key, user_id, response)

          app.state.db_engine = engine
          app.state.idempotency_repo = _SessionScopedIdempotencyRepo()
  <% } %>
     ```
  3. **Out of scope (document, do not fix here):** `IdempotencyMiddleware` caches a MOCKED body (`middleware.py` line 127: `body='{"status": "completed"}'`) because buffering the ASGI response body is non-trivial. Leave a TODO noting the replay returns a placeholder body, not the original. Fixing real ASGI body buffering is a follow-up, not part of this round-trip gate. The status-code replay (e.g. 200/201) is real and is what `test_idempotency_middleware` can assert for the Python service.
- **Acceptance:** `npm run build` → exit 0; `./dev test compilation` → PASS (`uv sync` + import resolves; `async_session_maker` exists in `database.py` line 15). For a Python+postgres service, `app.state.idempotency_repo` is set, so the middleware caches/replays by status. Verified under `./dev test scaffolds` if the Python service is in the boot topology.
- **Guardrails:** Do NOT touch `database_repository.py`, `example_service.py`, `router.py`, `protocols.py`, or `schema.sql` — they are already correct. Keep the change inside `<% if (postgres) %>` (idempotency repo is postgres-only). Do not import request-scoped `get_db_session` into the middleware path.

---

### Task 4.6 — Tests: Go testcontainers persistence/replay + un-skip system round-trip
- **Files:**
  - `/Users/ryannel/Workspace/groundWork/src/generators/go-microservice/files/cmd/api/main_test.go.template`
  - (Phase 0 owns: `/Users/ryannel/Workspace/groundWork/src/generators/system-test-runner/files/tests/system/test_system.py.template`)
- **Depends on:** 4.0, 4.1, 4.2, 4.4
- **Goal:** Add a Go integration test that POSTs then GETs `/api/v1/entities` against the testcontainers Postgres and asserts the round-trip, plus an idempotent-replay assertion. Document the Phase 0 dependency for flipping `test_crud_round_trip` from `xfail` to required.
- **Anchor (existing test — `main_test.go.template` lines 88-99, end of `TestAPIIntegration`):**
  ```go
  	// 6. Test the /health endpoint
  	req := httpx.NewRequest(http.MethodGet, "/health", nil)
  	req = req.WithContext(ctx)

  	rr := httptest.NewRecorder()
  	router.ServeHTTP(rr, req)

  	require.Equal(t, http.StatusOK, rr.Code)

  	// The health check response should have status ok since db and hub are healthy
  	require.Contains(t, rr.Body.String(), `"status":"ok"`)
  }
  ```
  (Note: the existing file uses `httptest.NewRequest`, not `httpx` — match the file's actual imports.)
- **Change:** Add a NEW test function `TestEntityCRUDRoundTrip` to the SAME file (it reuses the container/schema setup pattern but as a standalone test; simplest is to add a second test that re-runs the container setup). Add the imports `encoding/json`, `strings`, `bytes` to the import block as needed. Append after `TestAPIIntegration`:
  ```go
  func TestEntityCRUDRoundTrip(t *testing.T) {
  	if testing.Short() {
  		t.Skip("skipping integration test")
  	}

  	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
  	defer cancel()

  	pgContainer, err := postgres.RunContainer(ctx,
  		testcontainers.WithImage("postgres:16-alpine"),
  		postgres.WithDatabase("<%= name %>_test"),
  		postgres.WithUsername("testuser"),
  		postgres.WithPassword("testpass"),
  		testcontainers.WithWaitStrategy(
  			wait.ForLog("database system is ready to accept connections").
  				WithOccurrence(2).WithStartupTimeout(5*time.Second)),
  	)
  	require.NoError(t, err)
  	defer func() { _ = pgContainer.Terminate(context.Background()) }()

  	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
  	require.NoError(t, err)
  	os.Setenv("DATABASE_URL", connStr)
  	os.Setenv("PORT", "8080")
  	os.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "localhost:4317")

  	cfg := config.Load()

  	schemaBytes, err := os.ReadFile(filepath.Join("..", "..", "db", "schema.sql"))
  	require.NoError(t, err)

  	db, err := provider.NewPostgresDB(cfg.Database.URI)
  	require.NoError(t, err)
  	defer db.Close()
  	_, err = db.DB.ExecContext(ctx, string(schemaBytes))
  	require.NoError(t, err)

  <% if (websockets) { %>
  	wsHub := websocket.NewHub(cfg)
  	go wsHub.Run()
  	defer wsHub.Stop()
  	router, err := buildApp(cfg, db, wsHub)
  <% } else { %>
  	router, err := buildApp(cfg, db)
  <% } %>
  	require.NoError(t, err)

  	// 1. POST creates and persists an entity.
  	idemKey := "test-key-123"
  	createBody := `{"name":"round-trip"}`
  	postReq := httptest.NewRequest(http.MethodPost, "/api/v1/entities", strings.NewReader(createBody))
  	postReq.Header.Set("Content-Type", "application/json")
  	postReq.Header.Set("Idempotency-Key", idemKey)
  	postReq = postReq.WithContext(ctx)
  	postRec := httptest.NewRecorder()
  	router.ServeHTTP(postRec, postReq)
  	require.GreaterOrEqual(t, postRec.Code, 200)
  	require.Less(t, postRec.Code, 300)

  	var created struct {
  		ID string `json:"id"`
  	}
  	require.NoError(t, json.Unmarshal(postRec.Body.Bytes(), &created))
  	require.NotEmpty(t, created.ID)
  	require.NotEqual(t, "gen-id-123", created.ID, "POST must return a real persisted id, not the old stub")

  	// 2. GET lists the entity back from the DB (round-trip).
  	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/entities", nil)
  	getReq = getReq.WithContext(ctx)
  	getRec := httptest.NewRecorder()
  	router.ServeHTTP(getRec, getReq)
  	require.Equal(t, http.StatusOK, getRec.Code)
  	require.Contains(t, getRec.Body.String(), created.ID, "created entity must be read back from the DB")
  	require.Contains(t, getRec.Body.String(), "round-trip")

  	// 3. Idempotent replay: same key returns the same cached response.
  	replayReq := httptest.NewRequest(http.MethodPost, "/api/v1/entities", strings.NewReader(createBody))
  	replayReq.Header.Set("Content-Type", "application/json")
  	replayReq.Header.Set("Idempotency-Key", idemKey)
  	replayReq = replayReq.WithContext(ctx)
  	replayRec := httptest.NewRecorder()
  	router.ServeHTTP(replayRec, replayReq)
  	require.Equal(t, postRec.Code, replayRec.Code, "replay status must match original")
  	require.JSONEq(t, postRec.Body.String(), replayRec.Body.String(), "replay body must match cached response")
  }
  ```
  Import additions for this file (merge into the existing `import (...)` block, lines 3-22): add `"bytes"` only if used (the snippet uses `strings`, not `bytes` — add `"strings"` and `"encoding/json"`). Final additions: `"encoding/json"`, `"strings"`.
- **Phase 0 dependency (document, do NOT edit here):** The `test_crud_round_trip` lives in `src/generators/system-test-runner/files/tests/system/test_system.py.template` and is added/flipped by **Phase 0**. Phase 4 makes it PASS. Phase 0 must: (a) target the running service port (system tests use `http://localhost:5430` for the primary service per `test_system.py`), (b) POST `/api/v1/entities` with `{"name": ...}`, capture the returned `id`, (c) GET `/api/v1/entities` and assert the `id`+`name` appear, (d) replay POST with the same `Idempotency-Key` and assert identical response, (e) remove the `xfail` marker. The existing `test_idempotency_middleware` (lines 47-67) is currently a `pass` stub — Phase 0 should fill it using the same endpoint/port.
- **Acceptance:** `npm run build` → exit 0; `./dev test compilation` → PASS (the test file compiles under `go build`/`go vet`). `./dev test scaffolds` → PASS: the generated service's `go test ./...` (run inside the boot topology) passes `TestEntityCRUDRoundTrip`, and the inner `test_system.py::test_crud_round_trip` passes.
- **Guardrails:** Reuse the existing container/schema setup pattern verbatim (same image, wait strategy, schema-exec via `db.DB.ExecContext`). Respect the `<% if (websockets) %>` `buildApp` arity exactly as `TestAPIIntegration` does. Do not assert on the mocked-body shape. Match the file's existing imports (`httptest`, not `httpx`).

---

## Definition of done for Phase 4

- [ ] **4.0** `app_service.go` guards `eventHub.Broadcast` with `if s.eventHub != nil` — default (`websockets=false`) POST no longer nil-panics.
- [ ] **4.1** `postgres.go` `PostgresRepository` Create/GetByID/Update/Delete run real parameterized SQL against `entities`; Create uses `RETURNING` (no `"gen-id-123"`); `domain.ErrNotFound` returned on miss; `querier(ctx)` helper added.
- [ ] **4.2** `idempotency/repository.go` Get/Save implemented; `idempotency_keys` table added to `db/schema.sql` (with `created_at` for the cleanup worker); `Get` returns `(nil,nil)` on miss.
- [ ] **4.3** Outbox InsertEvent/PollUnpublished/MarkPublished real (gated `messaging!='none'`); `Transaction.WithContext` added; `ExecuteUseCase` enlists repo in the tx; NEW `cmd/worker/outbox/main.go` relay (publish-then-mark, fail loud); `generator.ts` deletes the worker when `messaging==='none'`.
- [ ] **4.4** POST returns the persisted entity; GET lists from the DB via `EntityLister.List` + `AppService.ListEntities` using existing `decodeCursor`/`buildPagination`; generic `Repository[T]` unchanged.
- [ ] **4.5** Python `main.py` lifespan sets `app.state.idempotency_repo` (per-call session adapter); repository/service/schema untouched; mocked-body limitation documented as out-of-scope.
- [ ] **4.6** Go `TestEntityCRUDRoundTrip` (POST→GET persistence + idempotent replay) added to `cmd/api/main_test.go`; Phase 0 `test_crud_round_trip` dependency documented.
- [ ] `npm run build` exits 0.
- [ ] `./dev test generation` PASS (worker present iff `messaging!='none'`; idempotency/outbox files gated correctly).
- [ ] `./dev test compilation` PASS for `messaging=none` AND `messaging=kafka`/`gcp-pubsub` combos.
- [ ] `./dev test scaffolds` PASS — including `test_crud_round_trip` (entity persists + reads back) and idempotent POST replay returning the cached response.
