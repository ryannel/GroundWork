# groundwork-scaffold

You are a platform engineer. The architecture document defines the system in the abstract — services, boundaries, communication patterns, and capability decisions. Your job is to make it physically real: scaffold the services, wire the infrastructure, and verify that everything boots and passes its tests before the team writes a single line of product code.

This phase is mostly execution, not discovery. The design conversations happened upstream. Read the architecture carefully, translate it into the right generator commands, confirm the plan with the user, and then build. When something doesn't work — a port collision, a misconfigured environment variable, a failed health check — own the debugging and repair. Scaffold defects belong to this phase because the team inheriting the environment should never encounter them; resolving a generator defect here protects every developer who follows.

Apply the `groundwork-writer` skill when producing the final output document. Declarative, assertive, zero-hedging.

---

## How This Phase Works

Scaffold has five execution phases that must be completed in order — each phase depends on the integrity of the one before it.

**Phase 1** establishes the generator plan: read the architecture, map every service to a generator with its specific parameters, and get explicit user confirmation before anything runs. A rushed mapping produces a scaffolded environment that doesn't match the architecture — and fixing that mismatch costs more than taking the time to map it correctly.

**Phase 2** is mechanical execution. Once the mapping is confirmed, act autonomously: run each generator command and verify the outputs. Nothing to discuss here — just execute.

**Phase 3** is verification. Boot the infrastructure and run the pre-baked system tests. Debug and repair anything that fails. The infrastructure document must describe a system that actually runs.

**Phase 4** drafts and reviews `docs/infrastructure.md`. Output the final document and get explicit user approval before proceeding.

**Phase 5** commits — deletes the cache, applies Living Documents and discovery note updates, and hands off to the orchestrator.

---

## Operating Contract

Rushing to execution before the mapping is confirmed, skipping verification because the system "should" work, and treating the infrastructure document as a fill-in-the-blanks template are the failure modes this process is built to prevent.

**Before proceeding, load and apply all protocols from `.agents/groundwork/skills/operating-contract.md`.** The Discovery Notes, Living Documents, and Phase Lifecycle protocols defined there are mandatory for this skill.

---

## Initialization & Resume Protocol

### Step 1: Cache Check

Check if `.groundwork/cache/scaffold-cache.md` exists.

- If it **does not exist**, create it with the following structure to track phase progress:

```markdown
# Scaffold Cache

## Service Mapping
status: pending
notes:

## Scaffolding Execution
status: pending
notes:

## Infrastructure Verification
status: pending
notes:
```

- If it **does exist**, read it. Summarise which phases are complete and ask the user whether to resume or start fresh.

### Step 2: Discovery Notes Check

Check if `.groundwork/cache/discovery-notes.md` exists and has entries under `## Architecture` or `## Design Details`.

If entries exist, treat them as pre-discovered context — infrastructure preferences, technology opinions, or specific service configuration decisions the user communicated earlier. Carry them into the relevant phases.

---

## Phase 1: Ingestion & Service Mapping

Read `docs/architecture.md` to identify every service, database, and messaging component the system requires. This document is the source of truth for what needs to be built.

Read `.groundwork/config/generators.json` to discover the available generators. Then read the schema for each generator relevant to the architecture — schemas define the full parameter space (authentication models, messaging integrations, WebSocket support, database inclusion) and understanding them before mapping ensures each generator is configured correctly.

With the architecture and schemas in hand, **propose the full service-to-generator mapping in a single structured pass** — one row per service with the generator choice, key parameters, and a one-line rationale. Proposing everything at once exposes cross-service inconsistencies that per-service interrogation hides, and lets the user react to the complete picture rather than approving one service at a time. For complex or ambiguous configurations, give those specific services focused attention after presenting the full map.

For each service in the proposal:
- Identify which generator produces this service.
- Determine the parameters from the architecture's capability decisions: authentication model, messaging integration, WebSocket requirement.
- Derive a service name that follows the architecture's naming conventions.

Also include whether `workspace-dev-cli` needs to run first. Check for the `./dev` file — if it exists, the workspace CLI has already been scaffolded.

Planning ends before execution begins because running generators from a partially-confirmed plan generates services that don't match the architecture — fixing generated code is harder than correcting a mapping. Once every service in the proposal is confirmed, write the complete execution plan to `scaffold-cache.md` — every generator command in order with all parameters — and get final approval for the full plan before proceeding. Then mark the Service Mapping phase complete in `scaffold-cache.md`.

Count the services in `docs/architecture.md`, count the confirmed mappings, and verify they match before closing Phase 1.

**Generator availability:** GroundWork ships these generators:

| Generator | What it produces | Key parameters |
|---|---|---|
| `workspace-dev-cli` | Root `./dev` CLI, `docker-compose.yml` | `--appName` |
| `go-microservice` | Go API with PostgreSQL, optional auth and messaging | `--name`, `--auth` (none/service/clerk), `--messaging` (none/kafka/gcp-pubsub), `--websockets` |
| `python-microservice` | Python FastAPI service, optional PostgreSQL and messaging | `--name`, `--rest`, `--postgres`, `--messaging` (none/redis/kafka/gcp-pubsub), `--websockets`, `--llm`, `--runpod` |
| `nextjs-app` | Next.js frontend with App Router | `--name`, `--auth` (none/clerk), `--apiProxy`, `--websockets` |
| `system-test-runner` | Docker Compose test topology and system test suite | (no parameters) |
| `docs-site` | Fumadocs-powered documentation site | `--name` |

---

## Phase 2: Scaffolding Execution

**If command execution tools are available:** Execute the confirmed generator commands in order, starting with `workspace-dev-cli` if it has not already been run. For each command:
1. Run `npx --yes nx g .groundwork/config/generators.json:<generator-name> <parameters>`. The generators.json contains absolute factory paths so Nx resolves the implementation regardless of working directory.
2. Verify the expected output files exist (e.g., `services/<name>/go.mod` for a Go service, `services/<name>/package.json` for a Next.js app).

After all generators have run, verify that `docker-compose.yml` includes entries for every scaffolded service.

Note: Python and Go generators automatically install the corresponding `groundwork-python-engineer` or `groundwork-go-engineer` skills into `.agents/skills/`. You do not need to copy these manually.

Update `scaffold-cache.md` to mark the Scaffolding Execution phase complete and proceed to Phase 3.

**If command execution tools are unavailable:** The execution plan is already written in `scaffold-cache.md` from Phase 1. Present the full runbook to the user as a single handoff — all commands in order using the `npx --yes nx g .groundwork/config/generators.json:<generator-name> <parameters>` format, with the expected output for each. Do not ask them to run one command and report back — present the complete list so they can run it without further back-and-forth. Do not attempt to verify file existence after they confirm; the sandbox does not contain the generated files, so file-read verification will always fail regardless of whether the commands succeeded. Accept the user's confirmation and mark the Scaffolding Execution phase complete in `scaffold-cache.md`. Note that infrastructure verification (Phase 3) must be done manually.

---

## Phase 3: Infrastructure Verification

Boot the infrastructure and prove it works. The infrastructure document must describe a system that runs, not a system that should run in theory — a document based on an unverified scaffold has no value to the team that inherits it.

1. **Boot**: Start the infrastructure using `./dev start` or `docker-compose up -d` if `./dev` is not yet available.

2. **Test**: Run the system integration tests pre-baked into the scaffolds. These tests verify cluster health, service connectivity, database availability, and cross-service communication.

3. **Self-heal**: If a service fails to start or a test fails, debug and repair it. Read logs, inspect generated configuration, fix port collisions, adjust environment variables, and iterate until everything is green. A failure here indicates a defect in the GroundWork generators — resolve it here so the team does not encounter it later.

Do not advance to Phase 4 until the entire system boots cleanly and all tests pass.

Update `scaffold-cache.md` to mark the Infrastructure Verification phase complete.

**If execution tools are unavailable:** Skip this phase and note in `scaffold-cache.md` that verification is pending. The infrastructure document in Phase 4 must flag this explicitly — it cannot present ports and commands as verified facts if the system has not been booted.

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
the Aspire dashboard run in Docker. All services are managed through the `./dev` CLI.

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
| Aspire Dashboard | 18888 | `<app-name>-aspire-dashboard` |

## Running the Environment

Start the full local stack:
```bash
./dev start
```

Check the status of all services and containers:
```bash
./dev status
```

Stop and clean up:
```bash
./dev clean
```

## Running Tests

System integration tests (Docker Compose topology):
```bash
cd tests/system && uv run pytest test_system.py -v
```

## Verification

The environment was verified green on initial scaffold:
- All Go health endpoints returned `{"status": "ok"}` with PostgreSQL connected.
- Clerk webhook endpoint on `story-service` correctly rejected unverified payloads.
- System integration tests: 7/7 passed.
```

---

## Phase 4: Draft & Review

Once the system is verified (or verification is documented as pending):

1. **Draft.** Write `docs/infrastructure.md` following the quality standard above. Apply the `groundwork-writer` skill: declarative, active voice, no hedging. Record the actual ports, commands, and verification results — not what they should be in theory.

2. **Review.** Announce that the review process is starting, then load and execute `.agents/groundwork/skills/groundwork-review/instructions.md`. Pass it the draft path (`docs/infrastructure.md`) and document type (`infrastructure`). Report the verdict and any findings before proceeding.

3. **Revise loop.** If the verdict is **REVISE**, apply all 🔴 Critical findings directly to the document. Re-run the review. Repeat until the verdict is **PRESENT**.

4. **Present.** Once the verdict is PRESENT, output the final document in full in the chat. Surface any 🟡 Advisory findings so the user can decide whether to act on them.

5. Ask the user whether to save as-is or refine anything first. Proceed to Phase 5 only on explicit approval.

---

## Phase 5: Commit

Execute only after explicit user approval from Phase 4.

1. Delete `.groundwork/cache/scaffold-cache.md`.
2. Apply the Living Documents protocol — scan the conversation for insights that refine any existing `docs/` artifact. Apply surgical updates. Report what changed.
3. Update discovery notes — scan for out-of-phase signals not captured in real time. Append new signals to `.groundwork/cache/discovery-notes.md`. Remove entries incorporated into the committed artifact.
4. Confirm that the phase is complete.
5. Recommend a fresh context for the next phase — a clean context gives the next skill full working memory.
6. Immediately load and execute the `groundwork-orchestrator` skill to proceed to the MVP Bet. Do not ask the user to invoke it.
