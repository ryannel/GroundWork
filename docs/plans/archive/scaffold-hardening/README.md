# Scaffold Hardening — Delivery Runbook

**Audience:** the engineer/agent executing this plan. Follow it literally, one task at a time. Do not improvise beyond what a task says.

**Goal:** make the GroundWork generators (`src/generators/*`) emit a **rock-solid, fully-wired, production-shaped** set of services — a foundation an MVP can be built on without first fixing the scaffold. We are hardening the **templates**, not any single generated app.

**Why this exists:** an audit found the generated services are an architecturally sound skeleton but only ~40% wired. The dominant defect is **"looks-wired-but-silently-does-nothing"** — e.g. the OpenTelemetry trace pipeline exported to a host that didn't exist and *no test caught it* because the system tests were stubs and there is no CI. The strategic rationale lives in [`../scaffold-hardening.md`](../scaffold-hardening.md). This directory is the executable version of that plan.

---

## The one principle that governs every task

> **FAIL LOUD, NOT SILENT.**
> A placeholder returns `501 Not Implemented` or panics in non-prod — never a silent `nil`/mock that looks like it worked. A required secret fails fast at startup — never defaults to a stub. A check that can't run in CI **fails** — it never passes green by being skipped. Nothing is "done" until a command proves it.

---

## How the repo works (you must know this)

- Generators live in `src/generators/{go-microservice,python-microservice,nextjs-app,workspace-dev-cli,system-test-runner}`.
- Each generator has a `generator.ts` (TypeScript logic, e.g. mutating `docker-compose.yml`) and a `files/` tree of `*.template` files. On generation, the `.template` suffix is stripped and `<%= var %>` EJS tags are interpolated (`<%= name %>` = service name). **Some files without a `.template` suffix are still EJS-processed** (noted per-task).
- **Two kinds of edits, two verification paths:**
  - Editing a `*.template` (or EJS) file → **no build needed**; regenerate a workspace to test.
  - Editing a `generator.ts` → you **must** run `npm run build` (tsc) from the repo root before regenerating, or your change won't take effect.

### Regenerate a sample workspace (validated pattern)

```bash
GJSON=/Users/ryannel/Workspace/groundWork/generators.json
TMP=/Users/ryannel/Workspace/groundWork/.sandboxes/demo   # MUST be under the repo so nx resolves the plugin
rm -rf "$TMP"; mkdir -p "$TMP/services"
printf '{}' > "$TMP/nx.json"; printf '{"name":"demo"}' > "$TMP/package.json"
(cd "$TMP" && npx --yes nx g "$GJSON":workspace-dev-cli --appName demo)
(cd "$TMP" && npx --yes nx g "$GJSON":go-microservice --name api --auth service)
# add --auth clerk for auth/webhook tasks; add a python/nextjs service where the task says so
```

Always `rm -rf "$TMP"` and regenerate fresh before an acceptance check — stale output hides bugs. Delete `$TMP` when done.

### The command set (canonical)

Repo-root meta-tests (exist today): `./dev test generation` (fast structural, 159 cases), `./dev test compilation` (`go build`/`tsc`/`uv sync`), `./dev test scaffolds` (boots a generated stack), `./dev eval`.

Inside a **generated** workspace, the `./dev` CLI has `start|stop|status|logs|clean|doctor|test|lint`. **Phase 0 ADDS** these — they do not exist until Phase 0 is complete:
- `./dev migrate` — create each service DB if missing + apply its declarative schema.
- `./dev test integration` — `start → migrate → health-gate → pytest → stop`.
- env flags `GROUNDWORK_REQUIRE_SERVICES=1` / `GROUNDWORK_REQUIRE_TRACES=1` — flip "unreachable/skipped" into **hard failures** (used in CI).

> **Vocabulary note for later phases:** because phases run **in order**, by the time you reach Phases 1–6 the Phase 0 commands exist — use `./dev test integration` (with the `REQUIRE_*` flags) as the canonical acceptance command. A few phase docs also reference the underlying `./dev test scaffolds` or `tests/system/test_traces.py` directly; treat those as the same mechanism Phase 0 wraps. If a phase doc's acceptance command predates Phase 0, prefer the Phase 0 equivalent.

---

## Execution protocol (apply to EVERY task)

1. **Read the task in full**, including Guardrails.
2. **Open the named file(s)** and locate the **Anchor** (the verbatim current code). If the anchor text is not present, **STOP and report** — the template has changed and the task may be stale.
3. **Make ONLY the change the task specifies.** Do not refactor neighboring code. Match existing imports/style.
4. **Build if needed:** if you edited a `generator.ts`, run `npm run build` from the repo root and confirm it exits 0.
5. **Run the task's Acceptance command(s) verbatim** and compare to the **expected result**.
6. **Green → mark the task done** (check it off in the phase doc) and move on. **Red → revert your change, STOP, and report** the exact command + output. Never proceed past a red. Never weaken an assertion to make it pass.
7. After finishing a phase, run the **Phase acceptance gate** at the top of that phase doc; then run `./dev test generation` to confirm the 159 structural cases still pass.

**Hard rules:**
- One task at a time. Do not batch edits across tasks before verifying.
- Never delete or weaken a test to make a gate pass. If a gate is wrong, STOP and report.
- Respect **option gating**: many templates are emitted only for certain generator flags (`--auth clerk`, `--messaging`, `--postgres`). Each task states whether it's gated; don't apply a gated change unconditionally.
- Keep secrets and dev-ergonomics intact: required-secret fail-fast must apply only outside development (a task will specify the env switch).
- Commit per task (or per phase) with a message naming the task id, so a red is easy to bisect.

---

## Phases (execute strictly in order)

Phase 0 is the prerequisite for trusting everything else — it makes the tests real and adds CI, so every later phase has a way to prove itself. Phases 1–4 are the core hardening. Phases 5–6 are operability and test depth.

| # | Doc | Goal | Depends on |
|---|---|---|---|
| 0 | [phase-0-harness-and-ci.md](phase-0-harness-and-ci.md) | Real, health-gated, span-asserting system tests against the dev stack; `./dev migrate` + `./dev test integration`; GitHub Actions CI that turns skips into failures. | — |
| 1 | [phase-1-security.md](phase-1-security.md) | Safe-by-default: wire the (currently unapplied) auth middleware, kill the fail-open webhook-secret default, CORS via env not `*`, input validation. | 0 |
| 2 | [phase-2-resilience.md](phase-2-resilience.md) | Footguns: `WriteTimeout: 0`, the rate limiter's dead Redis path, readiness probes that don't check the DB, DB pool config, compose restart/limits, wire the unused ResilientClient. | 0 |
| 3 | [phase-3-observability.md](phase-3-observability.md) | Make telemetry actually emit: initialize Python OTel (declared but never started), add metrics export, log↔trace correlation, Next.js client spans. | 0 |
| 4 | [phase-4-reference-crud.md](phase-4-reference-crud.md) | Turn the no-op stub repository into a real working reference vertical slice (Go + Python CRUD, idempotency, outbox relay) that persists data and round-trips through the DB. | 0 |
| 5 | [phase-5-data-and-dx.md](phase-5-data-and-dx.md) | `./dev reset|health|logs <svc>`, lint all languages, doctor runtime checks, Python migrations, Next.js Zod schemas + URL validation. | 0 |
| 6 | [phase-6-test-depth.md](phase-6-test-depth.md) | Per-component tests (Go middleware/data/webhook, Python middleware/worker, Next route/proxy) with real assertions — no `assert True`. | 1–4 |

Each phase doc is self-contained: a phase goal, an acceptance gate, numbered tasks in a fixed format (Files / Depends on / Goal / Anchor / Change / Acceptance / Guardrails), and a "Definition of done" checklist.

---

## Definition of done (whole plan)

1. `npm run build` exits 0 and `./dev test generation` passes all 159 cases.
2. A freshly regenerated workspace (Go + Python + Next.js services) does, with `GROUNDWORK_REQUIRE_SERVICES=1 GROUNDWORK_REQUIRE_TRACES=1`:
   - `./dev up && ./dev migrate && ./dev test integration` → **all green**: every service healthy, spans from **every** service (incl. Python) land in Jaeger, and the example entity **persists and reads back** through the real DB.
   - unauthenticated calls to protected endpoints are rejected; a missing required secret in non-dev fails startup; readiness returns unhealthy when the DB is down; the rate limiter throttles across instances.
3. `./dev test compilation` passes; per-component unit suites (`go test ./...`, `uv run pytest`, vitest) pass.
4. CI (`.github/workflows/ci.yml`) is green on a PR and **would fail** if any of the above regressed (verify by temporarily breaking one and confirming red — then revert).
5. Every phase doc's "Definition of done" checklist is fully checked.

If you reach a point where a task's anchor is missing, an acceptance gate is wrong, or a change has effects beyond its stated scope — **STOP and report** rather than guessing. This plan was written for literal execution; ambiguity is a signal to escalate, not to improvise.
