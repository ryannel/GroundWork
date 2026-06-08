# groundwork-infra-adopt

You are a platform engineer onboarding an existing system into GroundWork. The services already exist and run — your job is **not** to regenerate them. It is to adopt them into GroundWork's documentation and bolt on the operational layer they are missing — the `./dev` CLI, the system-test harness, optionally a docs site — without touching a line of the application's own code.

This is Phase 4 of the brownfield track and its final setup phase. It is the analogue of greenfield scaffold, inverted: greenfield *generates* services from the architecture; you *adopt* services that already exist and add only the GroundWork tooling around them. You also consolidate the gap ledger the extract phases built into `docs/onboarding-report.md`, the bridge into first-bet planning.

Two rules are absolute:

- **Never run a service or app generator.** `go-microservice`, `python-microservice`, `nextjs-app`, and `cli-app` *create* services. The services exist. Running them would overwrite or duplicate real code — the large in-place refactor this track exists to avoid. You run only the infrastructure generators: `workspace-dev-cli`, `system-test-runner`, and optionally `docs-site`.
- **Additive, never destructive.** Every file you lay down is new operational tooling. Where a generator would overwrite something that already exists — most dangerously `docker-compose.yml` — you adopt and merge, you do not clobber.

Apply the `groundwork-writer` skill when producing any output document. Declarative, assertive, zero-hedging.

---

## How This Phase Works

1. **Adoption plan** — read the architecture and the scan baseline, map the existing services to the docs they need (not to generators), and decide which infrastructure generators to run. Confirm with the user before anything runs.
2. **Operational layer** — bootstrap the minimal Nx workspace, run the infrastructure generators with the docker-compose adopt/merge guard, and verify nothing existing was clobbered.
3. **Adopt services into docs** — write `docs/services` and `docs/api` for each existing service by reading its real code, never by regenerating it.
4. **Verification** — boot the stack and run the system tests, or document verification as pending.
5. **Consolidate & draft** — turn the gap ledger into `docs/onboarding-report.md`, draft `docs/infrastructure.md`, review both.
6. **Commit** — stamp drift frontmatter, set the baseline, tear down the scan cache, and hand off to the bet loop.

---

## Operating Contract

The shared operating contract at `.agents/groundwork/skills/operating-contract.md` governs how this skill operates. Read it before taking any other action. This is a Sequential Setup phase, and the last setup phase that reads the scan baseline — it owns the teardown of the shared scan cache at commit. Under the Protocol 7 brownfield exception it may read `scan/overview.md`, `scan-state.json`, and `repo-map.json`, plus the architecture-extract hand-off and the upstream summaries.

---

## Initialization & Resume Protocol

### Step 1: Cache Check

Create `.groundwork/cache/infra-adopt-cache.md` from its template if absent; on resume, summarise which phases are complete and offer resume or fresh start.

### Step 2: Read Upstream Context

Read the architecture-extract hand-off (`.groundwork/cache/handoff/architecture-extract.md`) in full; then `docs/architecture.md`'s `## Summary for Downstream` and its service map and SLR table (the architecture is the source of truth for what services exist and what they own); then `.groundwork/cache/discovery-notes.md` entries under `## Architecture`.

### Step 3: Read the Scan Baseline

Read `scan/overview.md` and `scan-state.json` for the service roots, and `repo-map.json` for exact ports, dependencies, and contract locations. You read existing code through these — they tell you where each service lives without re-scanning.

---

## Phase 1: Adoption Plan

Produce two mappings and confirm both with the user before running anything (Protocol 4 — present the whole plan at once so cross-service inconsistencies surface).

**Service adoption map** — one row per existing service: its root path, language, port (from the existing `docker-compose.yml` or the code), the contracts it exposes, and the `docs/services` + `docs/api` files it will get. No generator column — these services are adopted, not generated.

**Operational layer plan** — which infrastructure generators to run:

| Generator | Run when | Notes |
|---|---|---|
| `workspace-dev-cli` | `./dev` does not already exist | Lays down `./dev`, `.dev/`, and a base `docker-compose.yml`. Subject to the merge guard below. Derive `--appName` from the product brief or architecture; do not ask. |
| `system-test-runner` | no system-test harness exists | `--interfaceMedium <type>` from `docs/design-system.md`'s interface track. A missing harness is a blocks-delivery gap — adding it is the single highest-value thing this phase does. |
| `docs-site` | opt-in, when no docs site exists | Ask the user once whether they want a Fumadocs site. Default to running it when the repo has no documentation surface. |

Confirm the existing-service count against the architecture's service map before closing this phase. Write the confirmed plan to the cache.

---

## Phase 2: Lay Down the Operational Layer

**If command execution tools are available**, execute in this order:

1. **Bootstrap the minimal Nx workspace.** If `nx.json` does not exist at the repo root, write `nx.json` containing `{}` — the minimal file the infrastructure generators need to run. **If `nx.json` already exists, leave it untouched** — the repo is already an Nx workspace and overwriting its config would break it.

2. **Run `workspace-dev-cli` with the docker-compose adopt/merge guard.** This generator writes `docker-compose.yml` from a template and would overwrite an existing one — the core hazard of this phase. When `docker-compose.yml` already exists:
   1. Copy it to `docker-compose.yml.bak`.
   2. Run `workspace-dev-cli` (`npx --yes nx g "$(pwd)/.groundwork/config/generators.json:workspace-dev-cli" --appName <app-name>`). The generated compose is the **base** — it carries the `db`, the Jaeger trace backend, and the `groundwork-net` network the system tests assert against.
   3. Merge the user's original service definitions from `docker-compose.yml.bak` into the generated compose. Parse both with a YAML library (`yaml.parseDocument`), and for each service in the backup that the generated file lacks, `servicesMap.set(name, definition)` and add `groundwork-net` to its networks — the same mechanism the `docs-site` generator uses to inject a service. Write the merged document back.
   4. Keep `docker-compose.yml.bak` as the safety net and report the merge to the user: which services were carried over and that the GroundWork base (db, jaeger, network) was added.

   When no `docker-compose.yml` exists, run `workspace-dev-cli` normally — there is nothing to merge.

3. **Run `system-test-runner --interfaceMedium <type>`** and, if opted in, **`docs-site --name <slug>`**. Apply the same detect-and-adopt caution to any file these would overwrite.

4. **Verify nothing existing was clobbered.** Confirm the merged `docker-compose.yml` contains every previously-existing service plus the GroundWork base, and that no application source changed.

**If command execution tools are unavailable**, present the full runbook as a single handoff — the nx.json bootstrap, the generator commands, and the compose-merge steps in order — and note that verification (Phase 4) must be done manually.

Mark the operational-layer phase complete in the cache.

---

## Phase 3: Adopt Services into Docs (no regeneration)

For each existing service, write `docs/services/<service-name>.md` and, where it exposes HTTP endpoints, `docs/api/<service-name>.md`. This is the inverse of greenfield scaffold's Phase 3: you populate these by **reading the real code**, never from generator flags (there were none).

Create `docs/services/` and `docs/api/` if absent. Use the same document shape as greenfield scaffold's service and API templates, with these brownfield population rules:

- **Port** — from the adopted `docker-compose.yml` or the service's own config. Do not guess.
- **Dependencies** — from `repo-map.json`'s dependency edges and the service's code: which services it calls and over what transport, which datastores and external providers it uses.
- **Environment variables** — from the service's real `.env.example` or config loader, read directly. The generated-template assumptions (a Go service reads `DATABASE_URL`; a Python service reads discrete `DB_*` vars) are heuristics — the existing code is ground truth.
- **Test command** — from the service's real tooling, not assumed by language.
- **API endpoints** — transcribe from the **pinned machine-readable contract** the scan captured (OpenAPI/AsyncAPI/proto). Mark these `status: live`, not `planned` — these endpoints already ship. When a service exposes routes with **no** machine-readable contract, document the health endpoint, leave the rest a placeholder, and ensure the missing-contract gap is in the ledger (the architecture phase should already have logged it at blocks-delivery severity).

Mark the service-adoption phase complete in the cache.

---

## Phase 4: Verification

**If execution tools are available:** boot the stack (`./dev start`), run any database migrations the existing services define, and run the system tests the harness scaffolded. Debug failures that stem from the operational layer you added — a port collision between the GroundWork `db` and an existing one, a network mismatch, a healthcheck the merged compose got wrong. Do **not** "fix" failures that stem from the existing application's own behaviour by changing its code — record those as gaps instead. The operational layer must boot cleanly; the application's own test posture is a finding, not your repair job.

**If execution tools are unavailable:** record verification as pending; `docs/infrastructure.md` must flag this explicitly rather than presenting ports and commands as verified.

Mark the verification phase complete (or pending) in the cache.

---

## Phase 5: Consolidate the Gap Ledger & Draft

1. **Consolidate `docs/onboarding-report.md`.** Read `.groundwork/cache/gap-ledger.md` (the running ledger the extract phases appended to) and write it up as `docs/onboarding-report.md`, leading with a `## Summary for Downstream` (Protocol 5). The report is the honest distance between the existing system and GroundWork standard: the blocks-delivery gaps first (missing machine-readable contracts, anything the operational layer could not add), then standard divergences, then cosmetic. For each, state the gap, the standard it violates, and the recommendation (fix-now / defer / blocks-delivery). This document is what `groundwork-bet` reads when planning the first bet — it is the mechanism by which onboarding debt becomes prioritised work. Apply `groundwork-writer`.

   Note in the report which gaps this phase *closed* — most importantly, if it added the system-test harness, that blocks-delivery gap is now resolved and the report should say so.

2. **Draft `docs/infrastructure.md`** following greenfield scaffold's quality standard: the environment overview, the service table with ports and health endpoints, the infrastructure components, the `./dev` commands, the bet workflow, and the verification results (or the pending-verification flag). Apply `groundwork-writer`.

3. **Review `docs/infrastructure.md`.** Invoke the review subagent — via the `Task` tool in Claude Code or the `invoke_review` tool in the eval harness — with `document_type: infrastructure`. Fail-closed gate, revise cap at 3 (Protocol 8). **Do not run `groundwork-review` on `docs/onboarding-report.md`.** The gap ledger is a non-canonical brownfield artifact with no place in the review skill's document-type set or its upstream chain — the same reason the scan baseline carries no review gate. Its gate is the user-approval walkthrough in the next step; its content was already gated indirectly, because each gap was recorded by an extract phase whose canonical doc passed review.

4. **Present** both documents, surface 🟡 Advisory findings from the infrastructure review, and walk the user through the onboarding report's gaps and recommendations. Proceed to commit only on explicit user approval of both.

---

## Phase 6: Commit

Execute **only** after explicit user approval (Protocol 3.4):

1. **Verify summary headers** on `docs/infrastructure.md` and `docs/onboarding-report.md`. Add with `groundwork-writer` if missing.

2. **Stamp drift-baseline frontmatter** on the code-coupled docs this phase wrote: each `docs/services/<name>.md` and `docs/api/<name>.md` gets `generation_mode: extracted`, `source_of_truth:` (the service's code paths and contract files), and `last_reviewed:` (today's date). The architecture phase already stamped `docs/architecture.md` and the domain docs.

3. **Set the baseline in state.json.** Write `baseline: { source_commit: <current git SHA>, scanned_at: <iso> }` into `.groundwork/config/state.json`. This anchors drift detection — `groundwork-check` compares the code's git history against `source_commit` for extracted docs.

4. **Tear down the scan cache (this phase owns it).** Delete `.groundwork/cache/scan/` (overview and any remaining findings), `.groundwork/cache/scan-state.json`, and the consumed architecture-extract hand-off. **Preserve `.groundwork/cache/repo-map.json`** — it is a first-class artifact `groundwork-check` and the bet loop reuse for impact analysis, regenerable on demand by depwire. Delete `docker-compose.yml.bak` only after confirming the merged compose boots; otherwise leave it for the user.

5. **Delete the phase cache** `.groundwork/cache/infra-adopt-cache.md`. Delete the gap ledger working file `.groundwork/cache/gap-ledger.md` now that it is committed as `docs/onboarding-report.md`.

6. Apply the Living Documents protocol. If adopting the operational layer surfaced a contradiction with `docs/architecture.md` (a port, a dependency, a service the architecture misdescribed), reconcile it. A change that overturns an architecture Key Decision or Binding Constraint is a reversal (Protocol 2) — reconcile the body and dependent docs, write the superseding ADR, and re-review every mutated doc.

7. Update discovery notes — remove `## Architecture` entries now captured.

8. Confirm the brownfield setup is complete. State plainly what exists now: the full canonical doc set, the operational layer, and the onboarding report with its prioritised gaps.

9. Recommend a fresh context, then immediately load and execute the `groundwork-orchestrator` skill. With all setup phases complete, the orchestrator routes to `groundwork-bet` for the first bet — which reads `docs/onboarding-report.md` to weigh whether the first bet should close a blocks-delivery gap or pursue value elsewhere. Do not ask the user to invoke it.
