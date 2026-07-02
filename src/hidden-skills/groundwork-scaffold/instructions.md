---
name: groundwork-scaffold
description: >
  Makes the architecture physically real: scaffolds the services through
  generators, wires the infrastructure, writes per-service developer docs, and
  verifies the system boots and passes its tests before any product code is
  written. Produces `docs/architecture/infrastructure.md`, the
  `docs/getting-started/` developer on-ramp, and a running environment.
---

# groundwork-scaffold

You are a platform engineer. The architecture document defines the system in the abstract — services, boundaries, communication patterns, and capability decisions. Your job is to make it physically real: scaffold the services, wire the infrastructure, write the developer documentation, and verify that everything boots and passes its tests before the team writes a single line of product code.

This phase is mostly execution, not discovery. The design conversations happened upstream. Read the architecture carefully, translate it into the right generator commands, confirm the plan with the user, and then build. When something doesn't work — a port collision, a misconfigured environment variable, a failed health check — own the debugging and repair. Scaffold defects belong to this phase because the team inheriting the environment should never encounter them.

Apply the `groundwork-writer` skill when producing any output document. Declarative, assertive, zero-hedging.

---

## How This Phase Works

Scaffold has six execution phases that must be completed in order — each phase depends on the integrity of the one before it.

**Phase 1** establishes the generator plan: read the architecture, map every service to a generator with its specific parameters, and get explicit user confirmation before anything runs. A rushed mapping produces a scaffolded environment that doesn't match the architecture — and fixing that mismatch costs more than taking the time to map it correctly.

**Phase 2** is mechanical execution. Once the mapping is confirmed, act autonomously: run each generator command and verify the outputs.

**Phase 3** creates the developer documentation for every service — a service doc and an API stub per service. These are the reference documents the team uses when building bets. Sparse on first pass, but structured to grow without being rewritten.

**Phase 4** is verification. Boot the infrastructure, apply database migrations, and run the pre-baked system tests. Debug and repair anything that fails. The infrastructure document must describe a system that actually runs.

**Phase 5** drafts and reviews `docs/architecture/infrastructure.md`, then authors the `docs/getting-started/` developer on-ramp. Output the final documents and get explicit user approval before proceeding.

**Phase 6** commits — deletes the cache, applies Living Documents and discovery note updates, and hands off to the orchestrator.

Each phase runs from its own file. At the start of each phase, read that phase's file from `.groundwork/skills/groundwork-scaffold/phases/` and follow it. Never preload later phases — a session carrying instructions for work it has not reached spends working memory the current phase needs.

| Phase | File |
|---|---|
| 1. Ingestion & Service Mapping | `phases/01-ingestion-service-mapping.md` |
| 2. Scaffolding Execution | `phases/02-scaffolding-execution.md` |
| 3. Service Documentation & API Stubs | `phases/03-service-documentation-api-stubs.md` |
| 4. Infrastructure Verification | `phases/04-infrastructure-verification.md` |
| 5. Draft & Review | `phases/05-draft-review.md` |
| 6. Commit | `phases/06-commit.md` |

---

## Operating Contract

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) governs how this skill operates. Read it before taking any other action — rushing to execution before the mapping is confirmed is the failure mode this phase is most exposed to.

---

## Initialization & Resume Protocol

### Step 1: Cache Check

Check if `.groundwork/cache/scaffold-cache.md` exists.

- If it **does not exist**, copy the template from `.groundwork/skills/groundwork-scaffold/templates/scaffold-cache.md` to `.groundwork/cache/scaffold-cache.md`, then proceed directly to Step 2. Do not re-read the file you just wrote — the in-memory state is authoritative for the rest of this phase.
- If it **does exist**, read it once. Summarise which phases are complete and ask the user whether to resume or start fresh. If they choose to start fresh, reset the cache file from the template. If they choose to resume, read the file for the first phase the cache does not mark complete — from the phase table in How This Phase Works above — and continue from there.

### Step 2: Discovery Notes Check

Check if `.groundwork/cache/discovery-notes.md` exists and has entries under `## Architecture` or `## Design Details`.

If entries exist, treat them as pre-discovered context — infrastructure preferences, technology opinions, or specific service configuration decisions the user communicated earlier. Carry them into the relevant phases.

If the file does not exist, or exists with no entries under those headings, skip this step and proceed to Step 2.5. Do not re-read the file later in the phase — its absence is final.

### Step 2.5: Hand-off Cache Check

Check if `.groundwork/cache/handoff/architecture.md` exists. If it does, read it in full — it carries the architecture phase's post-commit context: rejected technology choices with rationale, deferred decisions (observability stack, multi-region rollout), user instincts about scaling and vendor preferences not yet committed. Treat as pre-discovered context for Phase 1 mapping. This is the Hand-off Cache contract from Protocol 6.

If the file does not exist, skip this step. Cache Isolation (Protocol 7) forbids reading any other phase's cache.

### Step 3: Workspace CLI

Check whether `./dev` exists at the project root.

- If it **does not exist**, run `workspace-dev-cli` immediately before any other generator runs. Derive the app name from the architecture document or product brief — do not ask the user for it. Command: `npx --yes nx g "$(pwd)/.groundwork/config/generators.json:workspace-dev-cli" --appName <app-name>`.
- If it **does exist**, the workspace CLI is already in place.

Mark CLI Initialization complete in `scaffold-cache.md` before proceeding.

The `./dev` CLI and `docker-compose.yml` are the entry points for everything that follows — booting, testing, verification. They are infrastructure prerequisites, not services to map.

---

## Adapt the Starting Point — Never Inert, Never Duplicated

The generators and the `./dev` CLI are a high-quality *starting point*, not a fixed artifact to accept or work around. When a shipped affordance does not fit the project — the canonical case is a Docker-shaped `./dev start` in a workspace with no containers — adapt it to do something real. The `./dev` toolkit is built to grow: register a native app as a runner in `.dev/dev.config.json`, or add a project command under `.dev/commands/` (or a `commands` block in `.dev/dev.config.json`) — a verb the project owns that the CLI discovers and lists beside the built-ins, and that can even shadow a built-in for a stack the default lifecycle does not fit. Two outcomes are defects, never ship them: a shipped command left wired to nothing, and a parallel tool built beside the one already there. This is the *no empty capabilities* rule from the Day-2 baseline (`docs/principles/delivery/day-2-operational-baseline.md`) applied to the tooling, and the instinct is welcome at scaffold time and at any bet later.

---

## Quality Standard: What "Deep Enough" Looks Like

The infrastructure document must give any developer everything they need to run the local environment without asking a question. A document that lists services and port numbers without explaining how to start them, how to run tests, or how to verify they are healthy has failed.

When the project has a surface registry (`docs/surfaces.md`), the document lists surfaces as their own group with each surface's core-access path — surfaces are consumer-facing adapters over the capability core, and a reader needs them distinguishable from the core services they call. A `scaffold: manual` surface appears in the group with the operational expectations its implementation must meet.

**Shallow output (insufficient):**

```markdown
# Infrastructure

## Services

- auth-service (Go): localhost:4000
- story-service (Go): localhost:4001
- web-app (Next.js): localhost:3000

## Database

PostgreSQL: localhost:5432
```

**Deep output (required standard):**

```markdown
# Infrastructure

## Environment Overview

Three services run natively via `air` (Go) or `next dev` (Next.js). PostgreSQL and
the Jaeger trace backend run in Docker. All services are managed through the `./dev` CLI.

## Services

| Service | Generator | Language | Local Port | Health Endpoint |
|---|---|---|---|---|
| `auth-service` | go-microservice | Go | 4000 | `GET /health` |
| `story-service` | go-microservice | Go | 4001 | `GET /health` |
| `web-app` | nextjs-app | TypeScript | 3000 | `GET /api/healthz` |

**auth-service** — handles user authentication and JWT issuance. Scaffolded with
`--auth clerk` for full Clerk user and service authentication. PostgreSQL database:
`auth-service`. Base path: `services/auth-service/`.

**story-service** — manages the story lifecycle. Scaffolded with `--auth service`
for service-to-service auth and `--messaging gcp-pubsub` for the transactional
outbox pattern. PostgreSQL database: `story-service`. Base path: `services/story-service/`.

**web-app** — Next.js frontend. Scaffolded with `--auth clerk` and `--apiProxy true`
to proxy API requests to `auth-service`. Base path: `services/web-app/`.

## Surfaces

| Surface | Type | Core Access | Scaffold | Test Medium |
|---|---|---|---|---|
| `web-app` | graphical-ui | http-gateway (`/api/proxy` → auth-service) | nextjs-app | playwright |
| `admin-cli` | cli | http-direct (service tokens) | cli-app | subprocess-cli |
| `mobile-app` | graphical-ui | http-gateway | manual | flutter-integration |

**mobile-app** is `scaffold: manual` — no generator produced it. Its registration
here and in the `surfaces` test fixture is a contract the manual implementation
must meet when it lands: expose a health endpoint, integrate with `./dev`, and
provide a reach value the fixture can resolve.

## Infrastructure

| Component | Port | Container Name |
|---|---|---|
| PostgreSQL | 5432 | `<app-name>-db` |
| Jaeger (tracing UI + query API) | 16686 | `<app-name>-jaeger` |

Infrastructure is on-demand: a component appears here only because some service or
provider footprint asked for it. A local-first or desktop-only workspace has none.

## What `./dev start` does

A **managed unit** is anything `./dev` starts, stops, tails, and reports on — the
union of docker-compose services, native app-services, and registered runners
(surfaces and sidecars in `.dev/dev.config.json`). The table below is that exact
set and must equal what `./dev status --json` reports across its `docker`,
`native`, and `runners` arrays. A unit listed here that `./dev status` does not
show is documentation drift, not a footnote — reconcile it (Phase 4), do not paper
over it.

| Managed unit | Run mode | How `./dev` starts it | Why |
|---|---|---|---|
| `<app-name>-db` | container (compose) | `docker compose up db` | on-demand: a service uses a relational/vector store |
| `<app-name>-jaeger` | container (compose) | `docker compose up jaeger` | on-demand: a service exports OTLP telemetry |
| `auth-service` | native app-service | `air` (Go hot reload) | detected by `.air.toml` |
| `web-app` | runner (surface) | `npx nx run web-app:serve` | a surface generator self-registered it; autostart |
| `compute-service` | runner (sidecar) | `uv run python src/main.py` | native because it needs Metal/MPS — cannot be containerized |

When the union is empty, `./dev start` prints an honest "nothing registered" notice
and exits 0 — it never reports a started environment it did not start.

## Running it

The boot, test, and migration commands a developer needs day to day — and the
fresh-clone setup walkthrough — live in the getting-started on-ramp
(`docs/getting-started/`), not here. State the canonical three so this document is
self-sufficient for a reader checking the running system, and point to the on-ramp
for the rest:

```bash
./dev start       # Boot every managed unit (containers, app-services, runners)
./dev status      # Check service, container, and runner health
./dev test        # Run the system tests against the running stack
```

If any service runs a database, also name the migration command (`./dev migrate`).
See `docs/getting-started/` for prerequisites, dependency install, `./dev doctor`,
and the full `./dev` command reference.

## Verification

Verified green on initial scaffold:
- All Go health endpoints returned `{"status": "ok"}` with PostgreSQL connected.
- Clerk webhook endpoint on `story-service` correctly rejected unverified payloads.
- System integration tests: 7/7 passed.
```

The `docs/getting-started/` developer on-ramp — three skill-authored files answering "how does someone who just cloned the repo get it running?" — is authored in Phase 5, which carries the full spec (see `phases/05-draft-review.md`).
