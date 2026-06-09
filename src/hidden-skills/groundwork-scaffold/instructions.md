---
name: groundwork-scaffold
description: >
  Makes the architecture physically real: scaffolds the services through
  generators, wires the infrastructure, writes per-service developer docs, and
  verifies the system boots and passes its tests before any product code is
  written. Produces `docs/infrastructure.md` and a running environment.
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

**Phase 5** drafts and reviews `docs/infrastructure.md`. Output the final document and get explicit user approval before proceeding.

**Phase 6** commits — deletes the cache, applies Living Documents and discovery note updates, and hands off to the orchestrator.

---

## Operating Contract

Rushing to execution before the mapping is confirmed, skipping verification because the system "should" work, and treating the infrastructure document as a fill-in-the-blanks template are the failure modes this process is built to prevent.

**Before proceeding, load and apply all protocols from `.agents/groundwork/skills/operating-contract.md` (contract v1).** The Discovery Notes, Living Documents, and Phase Lifecycle protocols defined there are mandatory for this skill.

---

## Initialization & Resume Protocol

### Step 1: Cache Check

Check if `.groundwork/cache/scaffold-cache.md` exists.

- If it **does not exist**, copy the template from `.agents/groundwork/skills/groundwork-scaffold/templates/scaffold-cache.md` to `.groundwork/cache/scaffold-cache.md`, then proceed directly to Step 2. Do not re-read the file you just wrote — the in-memory state is authoritative for the rest of this phase.
- If it **does exist**, read it once. Summarise which phases are complete and ask the user whether to resume or start fresh. If they choose to start fresh, reset the cache file from the template.

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

## Phase 1: Ingestion & Service Mapping

Read `docs/architecture.md` to identify every service, database, and messaging component the system requires. This document is the source of truth for what needs to be built.

Read `.groundwork/config/generators.json` to discover the available generators. Then read the schema for each generator relevant to the architecture — schemas define the full parameter space (authentication models, messaging integrations, WebSocket support, database inclusion) and understanding them before mapping ensures each generator is configured correctly.

With the architecture and schemas in hand, **propose the full service-to-generator mapping in a single structured pass** — one row per service with the generator choice, key parameters, and a one-line rationale. Proposing everything at once exposes cross-service inconsistencies that per-service interrogation hides, and lets the user react to the complete picture rather than approving one service at a time.

For each service in the proposal:
- Identify which generator produces this service.
- Determine the parameters from the architecture's capability decisions: authentication model, messaging integration, WebSocket requirement. Use the Generator Capability Mapping below to translate architectural language into specific flag values — architecture documents are written in vendor-neutral capability terms, and the generators are flag-driven, so an explicit translation table is the contract between the two.
- Derive a service name that follows the architecture's naming conventions.

Planning ends before execution begins because running generators from a partially-confirmed plan generates services that don't match the architecture — fixing generated code is harder than correcting a mapping. Once every service is confirmed, write the complete execution plan to `scaffold-cache.md` — every generator command in order with all parameters — and get final approval for the full plan before proceeding. Mark the Service Mapping phase complete in `scaffold-cache.md`.

Count the services in `docs/architecture.md`, count the confirmed mappings, and verify they match before closing Phase 1.

**Interface medium:** Read `docs/design-system.md` and identify the project's interface track — `graphical-ui`, `cli`, or `agentic-protocol`. Pass this value as `--interfaceMedium` when running `system-test-runner`. This single flag determines whether `pytest-playwright` is included in the test dependencies and whether the `frontend_base_url` fixture is generated. For `graphical-ui` projects, pytest-playwright is included; for `cli` and `agentic-protocol`, it is not. Note: browser-driven interface proof is fully supported for `graphical-ui`; for `cli` and `agentic-protocol`, bet-progress tests use `subprocess`/HTTP against the running endpoint (no shared fixture is generated — write those tests against bare `subprocess`/HTTP).

**Generator Capability Mapping:**

| Architectural decision | Generator + flag |
|---|---|
| End-user authentication via Clerk | `nextjs-app --auth clerk`, `go-microservice --auth clerk` |
| Service-to-service authentication | `go-microservice --auth service` |
| No authentication required | `--auth none` (or omit `--auth`) |
| Transactional outbox via Kafka | `--messaging kafka` |
| Transactional outbox via GCP Pub/Sub | `--messaging gcp-pubsub` |
| Lightweight pub/sub via Redis (Python only) | `python-microservice --messaging redis` |
| WebSocket real-time delivery | `--websockets` |
| Frontend → backend API proxy | `nextjs-app --apiProxy` |
| Command-line application as the product (or a CLI surface for a service) | `cli-app --name <name>` (add `--repl` when the design system specified an interactive/REPL paradigm) |
| LLM integration (Python service) | `python-microservice --llm --llmProvider <openai\|anthropic>` (default `openai`) |
| GPU inference on RunPod (Python service) | `python-microservice --runpod` |
| PostgreSQL on a Python service | `python-microservice --postgres` |
| REST surface on a Python service | `python-microservice --rest` |
| Docker Compose test topology (graphical-ui project) | `system-test-runner --interfaceMedium graphical-ui` |
| Docker Compose test topology (CLI project) | `system-test-runner --interfaceMedium cli` |
| Docker Compose test topology (agentic-protocol project) | `system-test-runner --interfaceMedium agentic-protocol` |
| Fumadocs documentation site | `docs-site --name <slug>` |

This table is the one place to update when generator flags evolve. When a new flag ships, add a row here; when a flag is removed, delete the row. The mapping is the contract between architecture's vocabulary and scaffold's execution — keep it current.

**When the generators cannot honour an architecture decision.** This is common and expected: the architecture may have chosen a vendor, language, or topology the available generators do not produce (e.g. a TypeScript backend when only Go/Python exist, or Supabase auth when only Clerk is wired). Surface the genuine product trade-off to the user as a single decision (Protocol 4), take their call, then recognise what you are doing to the docs: **adopting the generator's path almost always *reverses* an architecture Key Decision or supersedes an ADR.** That makes it a **reversal** under Protocol 2 — not a refinement. At commit (Phase 6) you must follow the Reversal Protocol in full: reconcile the architecture *body* (not just its summary), reconcile every dependent doc the reversal touches — the domain entity docs (`Owner:`, fields), service docs, infrastructure — write the superseding ADR, and re-invoke `groundwork-review` on each mutated doc. The committed architecture must describe the system you actually scaffolded, with no residue of the abandoned one.

**LLM provider: scaffold the boilerplate, hand the integration to the bet.** When the architecture names an LLM provider, map it to `--llmProvider` (`openai` or `anthropic`) so the generated gateway targets the right SDK and a sensible default model from the start. But be precise about what the generator delivers and what it does not. The `--llm` flag produces a *generic gateway*: a single `generate_text` call behind the abstract `LLMGateway` port, with retries and a circuit breaker. It does **not** implement the provider-specific behaviour an architecture usually depends on — prompt caching a large shared context, streaming responses, structured outputs, a moderation/safety gate, or tool use. Those are **bet/MVP development work**, not scaffold output. Record them in the scaffold hand-off as work the first bet must build, and say so plainly when presenting the scaffold. Never describe the generated gateway as "provider-agnostic" or imply it already satisfies an architectural capability it only stubs — an honest "the gateway is scaffolded; prompt caching and streaming are bet work" is worth more than a green checkmark that papers over the gap. If the architecture's provider is not one the flag offers, that is the reversal path above, not a silent substitution to whatever the generator defaults to.

**Generator availability:**

| Generator | What it produces | Key parameters |
|---|---|---|
| `go-microservice` | Go API with PostgreSQL, optional auth and messaging | `--name`, `--auth` (none/service/clerk), `--messaging` (none/kafka/gcp-pubsub), `--websockets` |
| `python-microservice` | Python FastAPI service, optional PostgreSQL and messaging | `--name`, `--rest`, `--postgres`, `--messaging` (none/redis/kafka/gcp-pubsub), `--websockets`, `--llm`, `--llmProvider` (openai/anthropic, default openai), `--runpod` |
| `nextjs-app` | Next.js frontend with App Router | `--name`, `--auth` (none/clerk), `--apiProxy`, `--websockets` |
| `cli-app` | Branded Node+TypeScript command-line application, themed from `brand-tokens.json` | `--name`, `--repl` (scaffold the interactive REPL layer) |
| `system-test-runner` | Docker Compose test topology and system test suite | `--interfaceMedium` (graphical-ui/cli/agentic-protocol, default: graphical-ui) |
| `docs-site` | Fumadocs-powered documentation site | `--name` |

`workspace-dev-cli` is handled in initialization and does not appear in service mapping.

---

## Phase 2: Scaffolding Execution

**If command execution tools are available:** Execute the confirmed generator commands in order. For each command:
1. Run `npx --yes nx g "$(pwd)/.groundwork/config/generators.json:<generator-name>" <parameters>`. The absolute `$(pwd)` prefix is required because Nx calls `require.resolve` on the collection argument — a relative path resolves against Nx's own `node_modules`, not the workspace root.
2. Verify the expected output files exist (e.g., `services/<name>/go.mod` for a Go service, `services/<name>/package.json` for a Next.js app).

After all generators have run, verify that `docker-compose.yml` includes entries for every scaffolded service.

Go and Python generators automatically install the corresponding `groundwork-go-engineer` or `groundwork-python-engineer` skill into `.agents/skills/`. The Next.js generator installs `groundwork-nextjs-engineer`. Verify each skill file exists after its generator runs — if any are missing, copy them from `src/hidden-skills/` manually.

Mark the Scaffolding Execution phase complete in `scaffold-cache.md` and proceed to Phase 3.

**If command execution tools are unavailable:** The execution plan is already in `scaffold-cache.md`. Present the full runbook to the user as a single handoff — all commands in order, with the expected output for each. Do not ask them to run one command and report back. Accept their confirmation and mark the Scaffolding Execution phase complete. Note that infrastructure verification (Phase 4) must be done manually.

---

## Phase 3: Service Documentation & API Stubs

For each scaffolded service, create two files: a service document and an API stub. These give every developer a consistent entry point into each service from day one — before any product code exists.

Create `docs/services/` and `docs/api/` if they do not exist.

### Service Document

Write `docs/services/<service-name>.md` for each service:

```markdown
# <service-name>

**Generator:** <generator-name>
**Language:** Go | TypeScript | Python
**Port:** <port>
**Base path:** `services/<service-name>/`

## Overview

<One paragraph: what this service does and its role in the system. Derive from the architecture document.>

## Dependencies

| Dependency | Type | Notes |
|---|---|---|
| PostgreSQL | Database | `<service-name>` database — DB-backed services only; a stateless frontend owns no database |
| `<other-service>` | Service | Called via HTTP — URL at `<OTHER_SERVICE_URL>` env var |
| `<external-provider>` | External | e.g. Clerk, GCP Pub/Sub |

## API

[`docs/api/<service-name>.md`](../api/<service-name>.md)

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Service port (default: <port>) |
| `<database connection vars>` | Yes | Database connection — language-specific names, DB-backed services only (see population rules) |

See `services/<service-name>/.env.example` for the full list.

## Running Locally

```bash
./dev start <service-name>
```

## Testing

```bash
<unit test command for this language>
```
```

**Population rules:**

- Derive the port from `docker-compose.yml` or the architecture document after generation. Do not guess.
- List every inter-service dependency by name with the env var the calling service uses to reach it. If service A calls service B, service A's doc names service B and the env var (e.g. `AUTH_SERVICE_URL`).
- List every external dependency — databases, auth providers, message brokers. Derive from the generator flags and the architecture document.
- A stateless frontend owns no database. The `nextjs-app` generator scaffolds no datastore, so its service doc omits the PostgreSQL dependency row and every database environment variable. Only a service scaffolded with a database — a Go microservice, or a Python microservice with `--postgres` — names a database. Naming a database for a frontend describes infrastructure that does not exist.
- The database connection is exposed through language-specific environment variables, so populate the variables the generated service actually reads. A Go service reads a single `DATABASE_URL` connection string. A Python service reads discrete variables — `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — and composes the connection internally. The generated `.env.example` is the ground truth; do not assume `DATABASE_URL` for a service that reads discrete variables.
- Read the generated `.env.example` for each service to populate the environment variables table. If `.env.example` does not exist, list only variables derivable from the generator flags.
- Derive the unit test command from the language: `go test ./...` for Go, `uv run pytest` for Python, `pnpm test` for Next.js.
- Do not invent variables, routes, or descriptions. If a value cannot be derived from existing files or the architecture document, leave its cell blank rather than fabricating a placeholder.

**Drift frontmatter.** Open each `docs/services/<name>.md` and `docs/api/<name>.md` with YAML frontmatter so `groundwork-check` can detect drift automatically: `generation_mode: generated`, `source_of_truth:` (the canonical code paths for this service — its `services/<name>/` root and any contract files), and `last_reviewed:` (today's date). The `generated` mode routes `groundwork-check`'s recovery to re-running the generator; the brownfield extract phases use `extracted` instead. Both stamp the same three keys, so the check glob reads greenfield and brownfield docs identically.

### API Stub

Write `docs/api/<service-name>.md` for each service that exposes HTTP endpoints — Go microservices and Python microservices with `--rest`. Skip frontend apps and the system-test-runner.

```markdown
# <service-name> API

**Base URL:** `http://localhost:<port>`
**Auth:** <Bearer JWT | Service token (`X-Service-Token` header) | None>

## Health

### GET /health

**Response:** `200 OK`
```json
{"status": "ok"}
```

## Endpoints

<!-- Routes are defined in `services/<service-name>/`. Populate this section as endpoints are implemented. -->
```

**Population rules:**

- Derive auth from the generator flags: `--auth clerk` → Bearer JWT, `--auth service` → service token header, `--auth none` → no auth.
- **If the architecture document already specifies this service's contract — an explicit endpoint, an event stream, a request/response or SSE event schema (e.g. a streaming generation endpoint with named events) — transcribe that contract into the Endpoints section.** This is not inventing routes; it is carrying forward a commitment the architecture already made, so the system's key interface has a documented home from day one. Mark each as `status: planned`.
- Only when the architecture specifies *no* contract for the service, leave the Endpoints section as a placeholder comment for the team to populate as routes are built. Never fabricate routes the architecture did not commit.

Mark the Service Documentation phase complete in `scaffold-cache.md` and proceed to Phase 4.

---

## Phase 4: Infrastructure Verification

Boot the infrastructure and prove it works. The infrastructure document must describe a system that runs, not a system that should run in theory — a document based on an unverified scaffold has no value to the team that inherits it.

1. **Boot** — start the full local stack: `./dev start`.
2. **Migrate** — run database migrations for every service that includes PostgreSQL. Check the generated service for the migration command (typically `./dev migrate` or a service-level script).
3. **Test** — run the system integration tests pre-baked into the scaffolds. These tests verify cluster health, service connectivity, database availability, and cross-service communication.
4. **Self-heal** — if a service fails to start or a test fails, debug and repair it. Read logs, inspect generated configuration, fix port collisions, adjust environment variables, and iterate until everything is green. A failure here indicates a defect in the GroundWork generators — resolve it so the team does not encounter it.

Do not advance to Phase 5 until the entire system boots cleanly and all tests pass.

Mark the Infrastructure Verification phase complete in `scaffold-cache.md`.

**If execution tools are unavailable:** Skip this phase and record in `scaffold-cache.md` that verification is pending. The infrastructure document in Phase 5 must flag this explicitly — it cannot present ports and commands as verified facts if the system has not been booted.

---

## Quality Standard: What "Deep Enough" Looks Like

The infrastructure document must give any developer everything they need to run the local environment without asking a question. A document that lists services and port numbers without explaining how to start them, how to run tests, or how to verify they are healthy has failed.

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

## Infrastructure

| Component | Port | Container Name |
|---|---|---|
| PostgreSQL | 5432 | `<app-name>-db` |
| Jaeger (tracing UI + query API) | 16686 | `<app-name>-jaeger` |

## Running the Environment

```bash
./dev start       # Boot the full local stack
./dev status      # Check service and container health
./dev clean       # Stop and remove all containers
```

## Running Tests

```bash
./dev test                                   # Fast inner loop — system tests against running stack
./dev test integration                       # Boot + run system tests + tear down (Docker)
./dev test bet <slug>                        # Run a bet-progress suite against running stack
./dev test bet <slug> --integration          # Boot + run bet suite + tear down (Docker)
```

## Bet Workflow

```bash
./dev new bet <slug>                         # Create docs/bets/<slug>/ and tests/bets/<slug>/
./dev new milestone <bet> <milestone>        # Scaffold a red milestone test stub
./dev new slice <bet> <milestone> <svc> <s>  # Scaffold a red slice test stub
./dev archive bet <slug>                     # Archive a delivered bet's progress suite
```

## Verification

Verified green on initial scaffold:
- All Go health endpoints returned `{"status": "ok"}` with PostgreSQL connected.
- Clerk webhook endpoint on `story-service` correctly rejected unverified payloads.
- System integration tests: 7/7 passed.
```

---

## Phase 5: Draft & Review

Once the system is verified (or verification is documented as pending):

1. **Draft.** Write `docs/infrastructure.md` following the quality standard above. Apply the `groundwork-writer` skill: declarative, active voice, no hedging. Record the actual ports, commands, and verification results — not what they should be in theory.

1b. **Draft `docs/maturity.md`.** Read the maturity model at `.agents/groundwork/skills/maturity-model.md` and write the initial assessment from the template at `.agents/groundwork/skills/templates/maturity.md`. A freshly scaffolded project scores ✅ on most dimensions — cite the evidence this phase just produced (booted stack, generated harness, registered depwire). Open roadmap rows for what scaffolding cannot wire: D6 (CI does not yet invoke `groundwork check`) and any dimension verification left pending. Seed `## History` with one line. This doc is how the project tracks regressions against the target state it was born at.

2. **Review.** Announce that the review process is starting, then invoke the review subagent once per document: `document_path: docs/infrastructure.md` with `document_type: infrastructure`, and `document_path: docs/maturity.md` with `document_type: maturity`. The subagent runs in an isolated context — via the `Task` tool in Claude Code — and returns only `VERDICT: PRESENT | REVISE` and a findings list. Report the verdict and any findings before proceeding. The gate is fail-closed (Protocol 8): proceed only on a parseable `VERDICT: PRESENT`; if the reviewer errors, returns `REVIEW_UNAVAILABLE`, or returns no parseable verdict, the review has not run — do not commit, report the failure, and pause.

3. **Revise loop.** If the verdict is **REVISE**, apply all 🔴 Critical findings directly to the document. Re-run the review. Repeat until the verdict is **PRESENT**. After 3 REVISE verdicts, apply the revise cap defined in Protocol 8.

4. **Present.** Once the verdict is PRESENT, output the final document in full in the chat. Surface any 🟡 Advisory findings so the user can decide whether to act on them.

5. Ask the user whether to save as-is or refine anything first. Proceed to Phase 6 only on explicit approval.

---

## Phase 6: Commit

Execute only after explicit user approval from Phase 5. Follow Protocol 3.4 of the Operating Contract.

1. **Verify the summary headers.** Confirm `docs/infrastructure.md` and `docs/maturity.md` open with a `## Summary for Downstream` section. Add a one-line `llms.txt` entry for each newly created doc, `docs/maturity.md` included. For the infrastructure doc, the summary is populated per Protocol 5 populated per Protocol 5 — Key Decisions (the ports, the boot command, the test command, the database schema model), Binding Constraints (anything MVP Planning must respect: env var requirements, manual verification gaps), Deferred Questions, Out of Scope. If missing, apply `groundwork-writer` to add it before continuing.

2. **Write the hand-off file.** Copy `.agents/groundwork/skills/templates/handoff.md` to `.groundwork/cache/handoff/scaffold.md` and fill in only the sections that have content: rejected generator parameters or service-name choices, deferred verification steps if execution tools were unavailable, user instincts about future infrastructure (CI/CD, observability) not yet scaffolded, and any other context MVP Planning needs to understand the running system. Omit empty sections.

3. **Clean up caches.** Remove the scaffold cache and the consumed previous hand-off: `run_command("rm -f .groundwork/cache/scaffold-cache.md .groundwork/cache/handoff/architecture.md")`. Cache Isolation (Protocol 7) requires the previous hand-off to be deleted once consumed.

4. Apply the Living Documents protocol — scan the conversation for insights that refine any existing `docs/` artifact. Apply surgical updates and refresh affected summary headers. Report what changed. **Scaffold-time vendor/language/topology changes are reversals** (Protocol 2): reconcile the architecture body and every dependent doc — domain entities, service docs, infrastructure — write the superseding ADR, and re-invoke `groundwork-review` on each mutated doc before committing. Because this reversal supersedes ADRs, re-review **every** `docs/domain/*.md` (`document_type: domain-entity`), not only the ones you remembered to edit — these stubs carry no summary and are the dependents most often left stale. Do not leave the architecture body or domain docs describing the design you replaced.

5. Update discovery notes — scan for out-of-phase signals not captured in real time. Append new signals to `.groundwork/cache/discovery-notes.md`. Remove entries incorporated into the committed artifact or the hand-off file.

6. Confirm that the phase is complete.

7. Recommend a fresh context for the next phase — a clean context gives the next skill full working memory.

8. Immediately load and execute the `groundwork-orchestrator` skill to proceed to MVP Planning. Do not ask the user to invoke it.
