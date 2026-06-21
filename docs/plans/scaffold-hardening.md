# Plan: Harden the Scaffold Generators for the MVP Foundation

**Status (updated 2026-06-21):** PARTIALLY EXECUTED. The task bodies below were written
against the pre-restructure scaffold layout; verify intent against the current generators,
not the literal paths. Per-phase state, audited against the current code:

- **Phase 0 (harness + CI):** ✅ landed — `.github/workflows/ci.yml`, real `tests/scaffolds/*`, and the Jaeger-polling trace assertion live in the generated `test_system.py` (gated by `GROUNDWORK_REQUIRE_TRACES=1`), not a `test_traces.py`.
- **Phase 1 (security):** ✅ landed; the one residual fail-open (Clerk webhook `whsec_stub` default) was removed 2026-06-21 — unconfigured now fails loud (503).
- **Phase 2 (resilience):** ✅ landed — rate limiter, load-shedding, app-layer `TimeoutMiddleware` (`WriteTimeout: 0` is deliberate, paired with it), readiness probes.
- **Phase 3 (observability):** ✅ executed 2026-06-21 (Python OTel init, Go metrics, Next custom metric + browser spans, log↔trace correlation across all three). See its DoD for the verification record + caveats (live Jaeger boot pending a Docker daemon; pre-existing Clerk `baseTheme` `tsc` error).
- **Phase 4 (reference CRUD):** ✅ landed — persisting Postgres repository + idempotent replay (Go + Python).
- **Phase 5 (data & DX):** ❌ NOT done — `./dev reset`/`health`, schema-tooling parity, ruff/black, Zod `validatedFetch`, config-route validation all still absent.
- **Phase 6 (test depth):** ❌ NOT done — the gated cross-stack unit-test suite (Go middleware/idempotency/webhook tests, Python middleware/worker/llm tests, Next route tests) does not exist; only the weak `test_main.py` remains.

**Remaining to fully close this plan:** Phase 5, Phase 6, and a live-boot run of the Phase-3 trace assertions once Docker is available.

## Context

We just found that the OpenTelemetry trace pipeline in generated services had **never worked** — every service exported to a `otel-collector` host that didn't exist, the Go exporter mis-used `WithEndpoint`, and the only "trace test" asserted a header the test itself set. It survived because **nothing ran the tests**: the system-test suite is all stubs and there is no CI.

That bug is a symptom, not an exception. A full audit of `src/generators/*` found the same failure class throughout: the scaffolds are an architecturally sound skeleton, but execution is ~40% complete and dominated by **"looks-wired-but-silently-does-nothing"** — auth middleware scaffolded but never applied, the rate limiter's Redis path is dead code, Python OTel declared but never initialized, readiness probes that don't check the DB, repository CRUD that returns `nil` so data silently vanishes, `WriteTimeout: 0`, and a webhook secret that defaults to a stub (fail-open).

**Decisions (from the requester):** target the **generator templates** (so every future scaffold and a regenerated storyengine inherit the fixes); cover **everything in the audit**; ship a **real reference CRUD slice** so the example entity actually persists.

**Intended outcome:** a generated workspace is a genuinely production-shaped foundation — observability that emits, safe-by-default security, real resilience, a working reference vertical slice — and a verification harness + CI that makes this class of silent breakage impossible to merge.

## Guiding principles

1. **Fail loud, not silent.** Placeholders return `501 Not Implemented` (or panic in non-prod), never a silent `nil`/mock. Required secrets fail fast at startup; no fail-open defaults.
2. **Everything that's supposed to work is proven by a test that runs in CI.** If it isn't asserted by a booted integration test, assume it's broken.
3. **Templates are the unit of work.** Every change lands in `src/generators/*`; validation = regenerate a workspace, boot it, run the harness. The `.sandboxes/evals` live stack is disposable and only used for spot-validation.

## Phasing (leverage-ordered)

Phase 0 ships first because it makes every later phase verifiable. Phases 1–4 are the core hardening. Phases 5–6 are operability and test depth.

---

### Phase 0 — Verification harness + CI (the spine)

**Why first:** this is the root-cause fix. Until tests are real and run automatically, every other fix can silently regress.

**Approach (decided): run integration tests against the dev stack, not a parallel test-compose.** The generators already inject each app service into the main `docker-compose.yml` with correct build context, ports, health, and `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317`. Maintaining a second `docker-compose.test.yml` that each generator must also populate is exactly the duplicated, unrun surface that hid the trace bug. `test_traces.py` and `tests/scaffolds/test_scaffolds.py` already target the dev stack.

Changes:
- **Delete** `system-test-runner/files/tests/system/docker-compose.test.yml.template`; drop `pytest-docker` from `tests/pyproject.toml.template`.
- **Service discovery** (`conftest.py.template`): a `services_manifest` session fixture parses `docker-compose.yml` (PyYAML) and returns every app service (discriminator: `build.context` under `./services/`), with `{name, host_port, db_name, health_path, otel_name, type}`. `type` inferred from `go.mod`/`pyproject.toml`/`package.json`. Generic over N services — no manifest file, no hardcoded ports.
- **Health-gated `cluster` fixture** (replace the no-op): poll each discovered service's health path + jaeger `/api/services` with tenacity backoff. `GROUNDWORK_REQUIRE_SERVICES=1` (CI) turns "unreachable" into a failure; unset (local) degrades to skip.
- **Generic `pure_state_reset`**: for each discovered DB, reflect `pg_tables WHERE schemaname='public'` then `TRUNCATE … RESTART IDENTITY CASCADE`; tolerate missing DBs. No hand-maintained table list.
- **Real `test_system.py`** (replace `assert True`): parametrized over discovered services — (a) every service `/health` is ok (Go: `checks.db == "ok"`); (b) generalize `test_traces.py` into `test_instrumented_get_exports_span` (inject traceparent → poll jaeger `/api/traces/{id}` → assert span with discovered `otel_name`), gated by `GROUNDWORK_REQUIRE_TRACES=1`; (c) `test_crud_round_trip` (POST then GET round-trips through the real DB), `xfail` until Phase 4 lands the reference CRUD.
- **`./dev migrate`** (`lifecycle.sh.template`): for each app service, create its DB if missing, then run `scripts/apply-schema.sh`. Promotes the ad-hoc DB-creation now inlined in `test_scaffolds.py`.
- **`./dev test integration`** (`quality.sh.template`): `start → migrate → health-gate → pytest system/ → stop`. Bare `./dev test` stays the fast inner loop.
- **CI** (`.github/workflows/ci.yml`, new): jobs map onto existing repo-root `./dev` commands — `generation` (`./dev test generation`, ~2–3 min), `compilation` (`./dev test compilation`, ~5–8 min), `e2e` (extended `./dev test scaffolds`: generate → `./dev up` → `./dev migrate` → booted system tests with `GROUNDWORK_REQUIRE_TRACES=1` + `GROUNDWORK_REQUIRE_SERVICES=1`, ~10–15 min). Optional gated `eval` job (needs LLM keys; nightly/label only). Cache Go modules + npm + uv; GH ubuntu runners ship Docker. Concurrency-cancel on ref.

Key files: `system-test-runner/files/tests/system/{conftest.py,test_system.py,test_traces.py,pyproject.toml}.template`, `workspace-dev-cli/files/scripts/cli/{lifecycle,quality}.sh.template`, `tests/scaffolds/test_scaffolds.py`, new `.github/workflows/ci.yml`.

---

### Phase 1 — Security defaults (safe-by-default)

All in `go-microservice` (and Python/Next where noted). These are live vulnerabilities in generated output.

- **Wire the auth middleware.** `middleware_auth.go.template` exists but `router.go.template`'s `RegisterRoutes` never calls `router.Use(AuthMiddleware())`. Apply it (when `auth === 'clerk'`) to non-`/health`/`/webhooks` routes — protected endpoints are currently public.
- **No fail-open secret.** `config.go.template:21` defaults `CLERK_WEBHOOK_SIGNING_SECRET` to `"whsec_stub"` → forged webhooks accepted in prod. Make required secrets have no default and fail fast at startup (see Phase 2 config validation).
- **CORS via env, not wildcard.** `router.go.template:42` is `AllowedOrigins: ["*"]`. Read from `CORS_ALLOWED_ORIGINS`, default to localhost dev origins.
- **Input validation.** Add Huma `validate:` tags to request bodies (e.g. `CreateEntityRequest.Name` min/max). Python already uses Pydantic bounds (`Query(ge=1, le=100)`) — keep.
- **Python auth + CORS.** `python-microservice` has no auth and a hardcoded `["https://your-frontend.com"]` CORS origin (`main.py.template:59`). Read origins from config; add a bearer/JWT guard hook (even if optional) instead of hardcoding `user_id="anonymous"`.
- **Next.js secret-leak guard.** Keep the `server-only` import in `lib/config.ts`; document the `NEXT_PUBLIC_*` footgun in `.env.example`.

---

### Phase 2 — Resilience footguns

- **`WriteTimeout: 0` → bounded** (`main.go.template:63`) — currently enables Slowloris. Set ~20s (configurable).
- **Rate limiter Redis path is dead code** (`middleware_ratelimit.go.template`) — the "use Redis" branch immediately stubs to in-memory, so limits are per-instance only. Implement the Redis-backed `httplimit` store; fall back to memory only when no Redis URL.
- **Readiness must check the DB.** Go `/health` conflates liveness/readiness; Python `/readyz` (`main.py.template:84`) only checks a `startup_failed` flag and never queries the DB. Split into `/livez` (process up) and `/readyz` (DB `SELECT 1` + Redis ping when enabled).
- **DB connection pool config.** Go `postgres.go.template` uses bare `sql.Open` with defaults — add `SetMaxOpenConns/SetMaxIdleConns/SetConnMaxLifetime/SetConnMaxIdleTime` (env-configurable).
- **Compose restart + resource limits.** Base `docker-compose.yml.template` infra has neither `restart: unless-stopped` nor `resources.limits` — a crashed container stays dead and memory is unbounded. Add both (db/redis/pubsub/jaeger).
- **Wire the ResilientClient.** `http_client.go.template` has retry+circuit-breaker but is never instantiated. Provide it through `buildApp` so inter-service calls use it by default.
- **Configurable load-shedding.** `router.go.template:51` hardcodes 100 — read `MAX_CONCURRENT_REQUESTS`.
- **Next.js proxy fetch timeout** (`app/api/proxy/__path__/route.ts.template`) — wrap upstream `fetch` in an `AbortController` (~30s) so requests can't hang indefinitely.
- **Python worker error handling** (`worker.py.template`) — try/catch, structured error logging, retry/DLQ hook, SIGTERM handling. Python WS hub: heartbeat + reconnect, inject via app state (testable).

---

### Phase 3 — Observability completion

- **Python OTel actually initialized.** `pyproject.toml` declares OTel but `main.py` never starts an SDK or calls `FastAPIInstrumentor.instrument_app(app)`, and `.env.template` has no OTLP endpoint → zero spans. Add SDK bootstrap (TracerProvider + OTLP gRPC exporter from `OTEL_EXPORTER_OTLP_ENDPOINT`) in the lifespan hook, register FastAPI instrumentation, and set the OTLP env. This is what makes Python join the Phase 0 trace assertion.
- **Metrics export.** Go has no metrics at all; Next.js wires a metric reader but emits nothing custom. Add a Prometheus/OTLP metrics reader + baseline HTTP server metrics (request count, latency, in-flight) in Go; add app-level metrics in Next.
- **Log↔trace correlation.** No service injects `trace_id`/`span_id` into logs. Add a logging bridge (Go zerolog hook from span context; Python JSON logger with trace ids; Next structured logs) so logs are joinable to traces.
- **Next.js client-side spans.** `instrumentation.ts` is server-only; add browser fetch/XHR instrumentation so client calls are traced.

---

### Phase 4 — Real reference vertical slice (CRUD that persists)

Make the example entity a genuinely working end-to-end path — the template the bet-delivery phase copies, and what `test_crud_round_trip` verifies.

- **Go repository** (`provider/postgres.go.template`): implement `Create/GetByID/Update/Delete` with real SQL against `db/schema.sql.template`'s `entities` table, using the existing `Repository[T]` interface + transaction manager. Implement the **idempotency** repo (`idempotency/repository.go.template`) and **outbox** repo for real (currently all `return nil`).
- **Go handler** (`app_handler.go.template`): return persisted data and real cursor pagination instead of the hardcoded `gen-id-123` / mock list.
- **Outbox relay worker:** a background poller that reads unpublished outbox events, publishes to the configured backplane, and marks them published — the transactional outbox currently never drains.
- **Python**: implement `example_service` + repository against the async engine and a real table; replace stub handlers.
- **Tests:** flip `test_crud_round_trip` from `xfail` to required; add `main_test.go` assertions for POST→GET persistence and idempotent replay.

---

### Phase 5 — Data, migrations & DX

- **Auto-apply schema** option on boot (or clearly via `./dev migrate` from Phase 0); document required vs optional env in `.env.template` and add a Python `.env.example`.
- **Python migrations:** Alembic is declared but no `migrations/`/`env.py` scaffolded — generate the baseline (or standardize on the declarative `schema.sql` + apply script like Go).
- **`./dev` additions:** `reset` (stop + `clean --hard` + migrate), `health` (poll all services), `logs <service>` filtering, and **lint all languages** (`quality.sh` currently only runs golangci-lint — add eslint + ruff/black).
- **`doctor` runtime checks:** currently only checks binaries; add real db/redis/pubsub connectivity checks so it can't false-pass.
- **Next.js:** scaffold example Zod schemas in `lib/schemas/` and validate proxied responses; validate `API_URL` in the websocket-config route.

---

### Phase 6 — Test depth

Per-component tests beyond the integration harness: Go middleware (load-shed/timeout/rate-limit/auth/idempotency), repository CRUD + transaction rollback + outbox, Clerk webhook signature verification; Python idempotency/health/worker-error/circuit-breaker; Next.js route + proxy-error + auth tests. These catch logic bugs the integration tests don't isolate.

## Verification (end-to-end)

After each phase, validate against the templates, not just the live sandbox:

1. `npm run build` (generators compile) and `./dev test generation` (159 structural combos still pass).
2. Generate a fresh workspace (workspace-dev-cli + a go service + a python service + nextjs-app), then `./dev up && ./dev migrate && ./dev test integration` with `GROUNDWORK_REQUIRE_TRACES=1 GROUNDWORK_REQUIRE_SERVICES=1` — all services healthy, spans land in Jaeger, CRUD round-trips through the DB.
3. `./dev test compilation` (generated code builds across option combinations).
4. CI green on a PR (generation + compilation + e2e jobs).
5. Spot-check the live `.sandboxes/evals` storyengine by regenerating or applying the same fixes; re-run its trace + milestone tests.

## Risks

- **Skip-to-green** (the failure that hid the trace bug): mitigated by `GROUNDWORK_REQUIRE_*` flags flipping skips to failures in CI.
- **Python OTLP** is unverified until Phase 3 lands the env + SDK init; until then the trace assertion `xfail`s Python services with a TODO.
- **CI Docker/build time**: native boot (air/npm) avoids image builds on the e2e path; cache Go/npm/uv. Budget ~15 min for e2e.
- **`pg-schema-diff` needs Go on the host** in native mode (fine for Go services; verify the Python schema-apply path before wiring it into `./dev migrate`).
- **Scope**: this is large (~40 items). Phases are independently shippable; Phase 0 is the prerequisite for trusting the rest.

## Suggested execution order

Phase 0 → 1 → 2 → 3 → 4 → 5 → 6. Phases 0–4 deliver the "production-shaped, verified foundation"; 5–6 are operability and depth. Each phase ends green on the Verification steps before the next begins.
