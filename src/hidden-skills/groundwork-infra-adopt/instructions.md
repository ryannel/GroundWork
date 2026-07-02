---
name: groundwork-infra-adopt
description: >
  Adopts an existing system into GroundWork without touching its application
  code: bolts on the `./dev` CLI and system-test harness, writes `docs/architecture/services`
  and `docs/architecture/api` from the real code, and consolidates the gap ledger into the
  living maturity roadmap at `docs/maturity.md`. Runs as the final brownfield
  setup phase and never runs a service generator.
---

# groundwork-infra-adopt

You are a platform engineer onboarding an existing system into GroundWork. The services already exist and run — your job is **not** to regenerate them. It is to adopt them into GroundWork's documentation and bolt on the operational layer they are missing — the `./dev` CLI, the system-test harness, optionally a docs site — without touching a line of the application's own code.

This is Phase 4 of the brownfield track and its final setup phase. It is the analogue of greenfield scaffold, inverted: greenfield *generates* services from the architecture; you *adopt* services that already exist and add only the GroundWork tooling around them. You also consolidate the gap ledger the extract phases built into `docs/maturity.md` — the living assessment of the project against the GroundWork maturity model and the roadmap the bet loop steers by.

Two rules are absolute:

- **Never run a service or app generator.** `go-microservice`, `python-microservice`, `nextjs-app`, and `cli-app` *create* services. The services exist. Running them would overwrite or duplicate real code — the large in-place refactor this track exists to avoid. You run only the infrastructure generators: `workspace-dev-cli`, `system-test-runner`, and optionally `docs-site`.
- **Additive, never destructive.** Every file you lay down is new operational tooling. Where a generator would overwrite something that already exists — most dangerously `docker-compose.yml` — you adopt and merge, you do not clobber.

Apply the `groundwork-writer` skill when producing any output document. Declarative, assertive, zero-hedging.

---

## How This Phase Works

1. **Adoption plan** — read the architecture and the scan baseline, map the existing services to the docs they need (not to generators), and decide which infrastructure generators to run. Confirm with the user before anything runs.
2. **Operational layer** — bootstrap the minimal Nx workspace, run the infrastructure generators with the docker-compose adopt/merge guard, and verify nothing existing was clobbered.
3. **Adopt services into docs** — write `docs/architecture/services` and `docs/architecture/api` for each existing service by reading its real code, never by regenerating it.
4. **Verification** — boot the stack and run the system tests, or document verification as pending.
5. **Consolidate & draft** — assess the project against the maturity model, turn the gap ledger into `docs/maturity.md`, draft `docs/architecture/infrastructure.md`, review both.
6. **Commit** — stamp drift frontmatter, set the baseline, tear down the scan cache, and hand off to the bet loop.

---

## Operating Contract

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) governs how this skill operates. Read it before taking any other action. This is a Sequential Setup phase, and the last setup phase that reads the scan baseline — it owns the teardown of the shared scan cache at commit. Under the Protocol 7 brownfield exception it may read `scan/overview.md`, `scan-state.json`, and `repo-map.json`, plus the architecture-extract hand-off and the upstream Downstream Context files.

---

## Initialization & Resume Protocol

### Step 1: Cache Check

Create `.groundwork/cache/infra-adopt-cache.md` from its template if absent; on resume, summarise which phases are complete and offer resume or fresh start.

### Step 2: Read Upstream Context

Read the architecture-extract hand-off (`.groundwork/cache/handoff/architecture-extract.md`) in full; then the architecture's Downstream Context file `.groundwork/context/architecture-extract.md` and `docs/architecture/index.md`'s service map and SLR table (the architecture is the source of truth for what services exist and what they own); then the surface registry `docs/surfaces.md` (the active surfaces and the test mediums the harness must serve); then `.groundwork/cache/discovery-notes.md` entries under `## Architecture`.

### Step 3: Read the Scan Baseline

Read `scan/overview.md` and `scan-state.json` for the service roots, and `repo-map.json` for exact ports, dependencies, and contract locations. You read existing code through these — they tell you where each service lives without re-scanning.

---

## Phase 1: Adoption Plan

Produce two mappings and confirm both with the user before running anything (Protocol 4 — present the whole plan at once so cross-service inconsistencies surface).

**Service adoption map** — one row per existing service: its root path, language, port (from the existing `docker-compose.yml` or the code), the contracts it exposes, and the `docs/architecture/services` + `docs/architecture/api` files it will get. No generator column — these services are adopted, not generated.

**Operational layer plan** — which infrastructure generators to run:

| Generator | Run when | Notes |
|---|---|---|
| `workspace-dev-cli` | `./dev` does not already exist | Lays down `./dev`, `.dev/`, and a base `docker-compose.yml`. Subject to the merge guard below. Derive `--appName` from the product brief or architecture; do not ask. |
| `system-test-runner` | no system-test harness exists | Run once with `--surfaces` (invocation contract: `.groundwork/skills/surfaces-contract.md`; the JSON array in Phase 2 step 3). A missing harness is a blocks-delivery gap — adding it is the single highest-value thing this phase does. |
| `docs-site` | opt-in, when no docs site exists | Ask the user once whether they want a Fumadocs site. Default to running it when the repo has no documentation surface. |

Confirm the existing-service count against the architecture's service map before closing this phase. On a mismatch, halt: surface the disagreement to the user, ask which source is authoritative — the architecture doc or what the code shows — and append a row to `.groundwork/cache/gap-ledger.md` recording the discrepancy and its resolution before proceeding. Write the confirmed plan to the cache.

Through every phase of this skill, capture out-of-phase signals the user voices — product framing corrections (`## Product Brief`), design instincts (`## Design System`), delivery sequencing for the first bet (`## Bets`) — under their headers in `.groundwork/cache/discovery-notes.md` (Protocol 1).

---

## Phase 2: Lay Down the Operational Layer

**If command execution tools are available**, execute in this order:

1. **Bootstrap the minimal Nx workspace.** If `nx.json` does not exist at the repo root, write `nx.json` containing `{}` — the minimal file the infrastructure generators need to run. **If `nx.json` already exists, leave it untouched** — the repo is already an Nx workspace and overwriting its config would break it.

2. **Run `workspace-dev-cli` with the docker-compose adopt/merge guard.** This generator writes `docker-compose.yml` from a template and would overwrite an existing one — the core hazard of this phase. When `docker-compose.yml` already exists:
   1. Copy it to `docker-compose.yml.bak`.
   2. Run `workspace-dev-cli` (`npx --yes nx g "$(pwd)/.groundwork/config/generators.json:workspace-dev-cli" --appName <app-name>`). The generated compose is the **base** — it carries the `db`, the Jaeger trace backend, and the `groundwork-net` network the system tests assert against.
   3. **Merge structurally** — parse both documents and carry over every service in the backup that the generated file lacks, attaching `groundwork-net` to its networks; never re-emit YAML through the model (the same mechanism the `docs-site` generator uses to inject a service). Write the merged document back.
   4. Keep `docker-compose.yml.bak` as the safety net and report the merge to the user: which services were carried over and that the GroundWork base (db, jaeger, network) was added.

   When no `docker-compose.yml` exists, run `workspace-dev-cli` normally — there is nothing to merge.

3. **Run `system-test-runner --surfaces`** — one JSON entry per `active` surface in `.groundwork/surfaces.json` (shape and `reach` rules: `.groundwork/skills/surfaces-contract.md` § `--surfaces` Invocation Contract), `reach` only when a surface has a static base URL or launch command the compose topology cannot discover — and, if opted in, **`docs-site --name <slug>`**. Apply the same detect-and-adopt caution to any file these would overwrite.

4. **Verify nothing existing was clobbered.** Confirm the merged `docker-compose.yml` contains every previously-existing service plus the GroundWork base, and that no application source changed.

**If command execution tools are unavailable**, present the full runbook as a single handoff — the nx.json bootstrap, the generator commands, and the compose-merge steps in order — and note that verification (Phase 4) must be done manually.

Mark the operational-layer phase complete in the cache.

---

## Phase 3: Adopt Services into Docs (no regeneration)

For each existing service, write `docs/architecture/services/<service-name>.md` and, where it exposes HTTP endpoints, `docs/architecture/api/<service-name>.md`. This is the inverse of greenfield scaffold's Phase 3: you populate these by **reading the real code**, never from generator flags (there were none).

Create `docs/architecture/services/` and `docs/architecture/api/` if absent. Use the document shape defined in `.groundwork/skills/groundwork-scaffold/phases/03-service-documentation-api-stubs.md` (the Service Document and API Stub skeletons), with these brownfield population rules:

- **Port** — from the adopted `docker-compose.yml` or the service's own config. Do not guess.
- **Dependencies** — from `repo-map.json`'s dependency edges and the service's code: which services it calls and over what transport, which datastores and external providers it uses.
- **Environment variables** — from the service's real `.env.example` or config loader, read directly. The generated-template assumptions (a Go service reads `DATABASE_URL`; a Python service reads discrete `DB_*` vars) are heuristics — the existing code is ground truth.
- **Test command** — from the service's real tooling, not assumed by language.
- **API endpoints** — transcribe from the **pinned machine-readable contract** the scan captured (OpenAPI/AsyncAPI/proto). Mark these `status: live`, not `planned` — these endpoints already ship. When a service exposes routes with **no** machine-readable contract, document the health endpoint, leave the rest a placeholder, and ensure the missing-contract gap is in the ledger (the architecture phase should already have logged it at blocks-delivery severity).

Mark the service-adoption phase complete in the cache.

---

## Phase 4: Verification

**If execution tools are available:** boot the stack (`./dev start`), run any database migrations the existing services define, and run the system tests the harness scaffolded. Debug failures that stem from the operational layer you added — a port collision between the GroundWork `db` and an existing one, a network mismatch, a healthcheck the merged compose got wrong. Do **not** "fix" failures that stem from the existing application's own behaviour by changing its code — record those as gaps instead. The operational layer must boot cleanly; the application's own test posture is a finding, not your repair job.

**If execution tools are unavailable:** record verification as pending; `docs/architecture/infrastructure.md` must flag this explicitly rather than presenting ports and commands as verified.

Mark the verification phase complete (or pending) in the cache.

---

## Phase 5: Consolidate the Gap Ledger & Draft

1. **Consolidate `docs/maturity.md`.** Read the maturity model at `.groundwork/skills/maturity-model.md`, then write `docs/maturity.md` from the template at `.groundwork/skills/templates/maturity.md` — a clean published doc with no summary section. Two parts:

   - **Assessment** — score the project against the nine dimensions (mapping: `.groundwork/skills/maturity-model.md`), with evidence from what this phase just observed: the booted stack, the harness it added, the registered code map, the contracts the scan pinned or found missing, the registry the architecture extract wrote. Brownfield projects usually land 🟡/🔴 on several dimensions — score honestly; the roadmap is where the distance becomes work.
   - **Roadmap** — read `.groundwork/cache/gap-ledger.md` (the running ledger the extract phases appended to) and convert each entry to a roadmap row: gap, dimension (D1–D9), severity, recommendation, status `open`, evidence. Blocks-delivery gaps first. Mark the gaps this phase *closed* as `closed (infra-adopt)` — most importantly, if it added the system-test harness, that blocks-delivery gap is resolved and the roadmap says so. Append one stance row of this phase's own before converting: the capability ledger in `docs/surfaces.md` starts **empty at adoption by design** — same stance the architecture extract recorded (Stage 5 step 4: "a scanned ledger is confidently wrong where an empty one is honestly unknown"). Severity `cosmetic`, recommendation `defer`, evidence `docs/surfaces.md`. The row puts the empty ledger on record as a decision, so no future reader mistakes it for a missed extraction step. Seed `## History` with one line recording this initial assessment.

   This document is what `groundwork-bet` reads when planning every bet — it is the mechanism by which onboarding debt becomes prioritised, schedulable work that the user steers, never a forced march. Apply `groundwork-writer`.

2. **Draft `docs/architecture/infrastructure.md`** following greenfield scaffold's quality standard: the environment overview, the service table with ports and health endpoints, the infrastructure components, the "What `./dev start` does" boot model, the canonical run/test/migrate commands with a pointer to the getting-started on-ramp, and the verification results (or the pending-verification flag). Apply `groundwork-writer`.

2b. **Author the `docs/getting-started/` on-ramp** — `index.md`, `setup.md`, `dev-cli-reference.md` — to greenfield scaffold's standard ("The developer on-ramp"). For a brownfield adoption, `setup.md`'s prerequisites and install commands come from the existing services' real toolchains (read their manifests — `go.mod`, `package.json`, `pyproject.toml`), and `dev-cli-reference.md` is derived from `./dev help`. These are the docs the docs-site landing page routes a fresh-clone developer to. Apply `groundwork-writer`. They have no separate review type; the present-and-approve step gates them. Seed the section's sidebar order if absent: write `docs/getting-started/meta.json` as `{ "pages": ["index", "setup", "dev-cli-reference", "..."] }`.

3. **Review infrastructure and maturity.** Invoke the review subagent (Protocol 9) once per document: `docs/architecture/infrastructure.md` with `document_type: infrastructure`, and `docs/maturity.md` with `document_type: maturity`. (The getting-started docs from step 2b carry no review type — they are gated by present-and-approve.) The gate is fail-closed; on REVISE, apply all 🔴 findings and re-review — Protocol 8's revise cap and hard-stop rule apply. The maturity review checks that every row carries a valid dimension, severity, and status, and that the assessment does not contradict the docs this setup just committed. The domain stubs are not re-reviewed here — the architecture phase reviewed them at its commit, and they re-enter review only when a reconciliation in this phase mutates one (Protocol 2).

4. **Present** the two reviewed documents and summarise the `docs/getting-started/` set, surface 🟡 Advisory findings from the reviews, and walk the user through the maturity roadmap — each gap, the dimension it blocks, what leaving it open costs, and the recommendation. Invite the user to re-rank or to mark gaps `accepted` where they consciously disagree; record their reasoning in the row. Proceed to commit only on explicit user approval of both documents.

---

## Phase 6: Commit

Execute **only** after explicit user approval (Protocol 3.4):

1. **Write the Downstream Context file** to `.groundwork/context/infra-adopt.md` (Protocol 5), derived from the committed `docs/architecture/infrastructure.md` and `docs/maturity.md`: the four subsections (Key Decisions, Binding Constraints, Deferred Questions, Out of Scope), ≤200 words, via `groundwork-writer`. The published docs — including the `docs/getting-started/` set — are clean reference documentation with no summary section. This is the last setup phase, so its context file is short-lived — Setup Graduation (Protocol 10) tears the whole `.groundwork/context/` store down. Add a one-line `llms.txt` entry for each newly created doc — the `docs/getting-started/` files and `docs/maturity.md` included.

2. **Stamp drift-baseline frontmatter** on the code-coupled docs this phase wrote: each `docs/architecture/services/<name>.md` and `docs/architecture/api/<name>.md` gets `generation_mode: extracted`, `source_of_truth:` (the service's code paths and contract files), and `last_reviewed:` (today's date). The architecture phase already stamped `docs/architecture/index.md` and the domain docs.

3. **Set the baseline in state.json.** Write `baseline: { source_commit: <current git SHA>, scanned_at: <iso> }` into `.groundwork/config/state.json`. This anchors drift detection — `groundwork-check` compares the code's git history against `source_commit` for extracted docs. Add nothing to the `completed` array — the orchestrator reconciles this phase's completion from its committed artifacts (its Brownfield Setup table is the source of truth).

4. **Tear down the scan cache (this phase owns it).** Delete `.groundwork/cache/scan/` (overview and any remaining findings), `.groundwork/cache/scan-state.json`, and the consumed architecture-extract hand-off. **Preserve `.groundwork/cache/repo-map.json`** — it is a first-class artifact `groundwork-check` and the bet loop reuse for impact analysis, regenerable on demand by `npx groundwork-method repo-map`. Delete `docker-compose.yml.bak` only after confirming the merged compose boots; otherwise leave it for the user.

5. **Delete the phase cache** `.groundwork/cache/infra-adopt-cache.md`. Delete the gap ledger working file `.groundwork/cache/gap-ledger.md` now that its entries live in `docs/maturity.md`.

6. Apply the Living Documents protocol. If adopting the operational layer surfaced a contradiction with `docs/architecture/index.md` (a port, a dependency, a service the architecture misdescribed), reconcile it — and refresh the architecture's live Downstream Context file `.groundwork/context/architecture-extract.md` if the change touched a Key Decision, Binding Constraint, or Deferred Question. A change that overturns an architecture Key Decision or Binding Constraint is a reversal (Protocol 2) — reconcile the body and dependent docs, write the superseding ADR, and re-review every mutated doc.

7. Update discovery notes — remove `## Architecture` entries now captured.

8. Confirm the brownfield setup is complete. State plainly what exists now: the full canonical doc set, the operational layer, and the maturity roadmap with its prioritised gaps.

9. Recommend a fresh context, then immediately load and execute the `groundwork-orchestrator` skill. **Route through the orchestrator — do not load `groundwork-bet` directly**: skipping the hop leaves `state.completed` missing `infra-adopt`, so a later resume re-routes into setup. With all setup phases complete, the orchestrator routes to `groundwork-bet` for the first bet — whose discovery reads `docs/maturity.md` to weigh closing a blocks-delivery gap against pursuing value elsewhere. Do not ask the user to invoke it.
