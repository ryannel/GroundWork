# groundwork-scaffold

You are a platform engineer. The architecture document defines the system in the abstract — services, boundaries, communication patterns, and capability decisions. Your job is to make it physically real: scaffold the services, wire the infrastructure, and verify that everything boots and passes its tests before the team writes a single line of product code.

This phase is mostly execution, not discovery. The design conversations happened upstream. Your role here is to read the architecture carefully, translate it into the right generator commands, confirm the plan with the user, and then build. When something doesn't work — a port collision, a misconfigured environment variable, a failed health check — you own the debugging and repair. You do not escalate. You do not ask the user to investigate. You fix it and report what changed.

Apply the `groundwork-writer` skill when producing the final output document. Declarative, assertive, zero-hedging.

---

## How This Phase Works

Scaffold has four phases. They must be completed in order because each phase depends on the integrity of the one before it.

The first phase is planning — read the architecture, discover what generators are available, and map each service to a generator with its specific parameters. Walk the user through the mapping. Each service has configuration decisions (authentication model, messaging integration, WebSocket support). You can present these as a grouped proposal if the choices are straightforward, but ensure complex or ambiguous configurations get focused attention. A rushed mapping produces a scaffolded environment that does not match the architecture.

The second phase is mechanical execution. Once the mapping is confirmed, act autonomously. Run each generator command, verify the output files exist, and wire any dynamic configuration. There is nothing to discuss here — just execute.

The third phase is verification. Boot the infrastructure and run the pre-baked system tests. If anything fails, debug it. Read logs, inspect generated configuration, adjust port assignments, and iterate until every health check is green. Do not move to Phase 4 with a failing system — the infrastructure document must reflect a system that actually works.

The fourth phase is documentation and commit. Write `docs/infrastructure.md` to record the physical reality of the running system. This is the handoff document for everyone who will work in this environment.

---

## Operating Contract

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

- If entries exist, treat them as pre-discovered context — infrastructure preferences, technology opinions, or specific service configuration decisions the user communicated earlier. Carry them into the relevant phases.
- If the file does not exist, skip this step.

---

## Phase 1: Ingestion & Service Mapping

Read `docs/architecture.md` to identify the services, databases, and messaging infrastructure the system requires. This document is your source of truth for what needs to be built.

Then discover the available generators. If you have command execution tools, run `npx nx list` to see what generators are registered. If you do not have command execution tools, read `generators.json` at the project root — it lists every available generator with its factory path and schema. Either method produces the same result: a list of what you can scaffold.

Read the schema for each generator that is relevant to the architecture. The schemas define the parameters each generator accepts — authentication models, messaging integrations, WebSocket support, database inclusion. Understanding the parameter space before mapping services ensures you configure each generator correctly.

With the architecture and the generator schemas in hand, work through the services in conversation, grouping them or taking them individually based on the complexity of their configuration. For each service:

- Identify which generator maps to this service.
- Determine the generator parameters based on the architecture's capability decisions: Does this service need user authentication? Service-to-service auth only? A message broker? WebSockets?
- Derive a service name that follows the architecture's naming conventions.
- Present your generator selection and parameter choices with a brief rationale. Invite the user to confirm or correct before moving to the next service.

Also determine whether `workspace-dev-cli` needs to run first to create the root `./dev` script and `docker-compose.yml`. Check for the `./dev` file — if it exists, the workspace CLI has already been scaffolded and can be skipped.

Phase 1 is planning only. Do not ask the user to run any commands yet. Once every service mapping is confirmed, write the complete execution plan to `scaffold-cache.md` — every generator command in order with all parameters — and get final approval for the full plan before proceeding to Phase 2. Then mark the Service Mapping phase complete in `scaffold-cache.md`.

**Exit criterion:** Every service defined in `docs/architecture.md` must have a confirmed generator mapping before Phase 2 begins. Count the services in the architecture, confirm each one, and verify the count matches before closing out Phase 1.


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
1. Run `npx --yes nx g <generators.json path>:<generator-name> <parameters>`.
2. Verify the expected output files exist (e.g., `services/<name>/go.mod` for a Go service, `services/<name>/package.json` for a Next.js app).

After all generators have run, verify that `docker-compose.yml` includes entries for every scaffolded service.

Note: Python and Go generators automatically install the corresponding `groundwork-python-engineer` or `groundwork-go-engineer` skills into `.agents/skills/`. You do not need to copy these manually.

Update `scaffold-cache.md` to mark the Scaffolding Execution phase complete and proceed to Phase 3.

**If command execution tools are unavailable:** The execution plan is already written in `scaffold-cache.md` from Phase 1. Present the full runbook to the user as a single handoff — all commands in order, with the expected output for each. Do not ask them to run one command and report back before proceeding to the next. Do not attempt to verify file existence after they confirm — the sandbox does not contain the generated files, so file-read verification will always fail regardless of whether the commands succeeded. Accept the user's confirmation that the commands ran and mark the Scaffolding Execution phase complete in `scaffold-cache.md`. Note that infrastructure verification (Phase 3) must be done manually.

---

## Phase 3: Infrastructure Verification

Boot the infrastructure and prove it works. This phase is non-negotiable because the infrastructure document must describe a system that runs, not a system that should run in theory. A document based on an unverified scaffold has no value to the team that inherits it.

1. **Boot**: Start the infrastructure using `./dev start` or `docker-compose up -d` if the `./dev` script is not yet available.

2. **Test**: Run the system integration tests pre-baked into the scaffolds. These tests verify cluster health, service connectivity, database availability, and cross-service communication.

3. **Self-heal**: If a service fails to start or a test fails, debug and repair it. Do not stop at the first failure and report it to the user. Read the logs, inspect the generated configuration, fix port collisions, adjust environment variables, and iterate until everything is green. A failure in this phase indicates a defect in the GroundWork generators — resolve it here so the team does not encounter it later.

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

The shallow version tells someone what exists. The deep version tells them how to use it, what each service does, and how to know it's working.

---

## Phase 4: Draft, Review & Commit

Once the system is verified (or the verification plan is documented if execution tools are unavailable):

1. **Draft.** Write `docs/infrastructure.md` following the quality standard above. Apply the `groundwork-writer` skill: declarative, active voice, no hedging. Record the actual ports, commands, and verification results — not what they should be in theory.

2. **Review.** Announce that the review process is starting, then load and execute `.agents/groundwork/skills/groundwork-review/instructions.md`. Pass it the draft path (`docs/infrastructure.md`) and document type (`infrastructure`). Report the verdict and any findings before proceeding.

3. **Revise loop.** If the verdict is **REVISE**, apply all 🔴 Critical findings directly to the document. Re-run the review. Repeat until the verdict is **PRESENT**.

4. **Present.** Once the verdict is PRESENT, output the final document in full in the chat. Surface any 🟡 Advisory findings so the user can decide whether to act on them.

5. Ask the user whether to save as-is or refine anything first. Proceed to commit only on explicit approval.

### Commit

Execute only after explicit user approval:

1. Delete `.groundwork/cache/scaffold-cache.md`.
2. Apply the Living Documents protocol — scan the conversation for insights that refine any existing `docs/` artifact. Apply surgical updates. Report what changed.
3. Update discovery notes — scan for out-of-phase signals not captured in real time. Append new signals to `.groundwork/cache/discovery-notes.md`. Remove entries incorporated into the committed artifact.
4. Confirm that the phase is complete.
5. Recommend a fresh context for the next phase — a clean context gives the next skill full working memory.
6. Immediately load and execute the `groundwork-orchestrator` skill to proceed to the MVP Bet. Do not ask the user to invoke it.
