---
name: groundwork-infra-adopt
description: >
  Closes the brownfield track: writes `docs/architecture/services` and
  `docs/architecture/api` from the real code, publishes
  `docs/architecture/infrastructure.md` and the developer on-ramp, and
  consolidates the gap ledger into the living maturity roadmap at
  `docs/maturity.md`. Documents what exists; never runs a service generator.
---

# groundwork-infra-adopt

You are a platform engineer writing the record of a system that already runs. The operational layer is already in place — the ops-adoption phase bolted on `./dev`, the system-test harness, and the surface registry. Your job is to document the services as they actually are, publish the environment record, and turn every gap the track collected into a roadmap the bet loop can steer by.

This is the final brownfield setup phase. It is the documentation half of greenfield scaffold, inverted: greenfield *generates* services from the architecture and documents what it generated; you *read* services that already exist and document what you found. Nothing here regenerates code.

Two rules are absolute:

- **Never run a service or app generator.** `go-microservice`, `python-microservice`, `nextjs-app`, and `cli-app` *create* services. The services exist. Running them would overwrite or duplicate real code — the large in-place refactor this track exists to avoid. This phase runs no generators at all; the infrastructure generators already ran in ops adoption.
- **The code is the source, not the template.** Every port, dependency, environment variable, and endpoint you write is read from the real service. A generated-template assumption written as fact is worse than a gap, because nothing later re-checks it.

Apply the `groundwork-writer` skill when producing any output document. Declarative, assertive, zero-hedging.

---

## How This Phase Works

1. **Adoption plan** — map the existing services to the docs they need and confirm the map with the user.
2. **Adopt services into docs** — write `docs/architecture/services` and `docs/architecture/api` for each existing service by reading its real code.
3. **Verification record** — confirm the stack the ops phase laid down still boots, or carry its pending state forward honestly.
4. **Consolidate & draft** — assess the project against the maturity model, turn the gap ledger into `docs/maturity.md`, draft `docs/architecture/infrastructure.md` and the on-ramp, review both.
5. **Commit** — stamp drift frontmatter, set the baseline, tear down the setup caches, and hand off to the bet loop.

---

## Operating Contract

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) governs how this skill operates. Read it before taking any other action. This is a Sequential Setup phase and the terminal phase of the brownfield track — it owns the teardown of the shared scan cache at commit, in the cases where one exists. Under the Protocol 7 brownfield exception it may read `scan-state.json`, `repo-map.json`, and `scan/overview.md` when a deep scan wrote one, plus the architecture-extract hand-off and the upstream Downstream Context files. Open the phase — and precede every question that blocks on the user — with the Setup Progress Header (operating contract, Sequential Setup).

---

## Initialization & Resume Protocol

### Step 1: Cache Check

Create `.groundwork/cache/infra-adopt-cache.md` from its template if absent; on resume, summarise which phases are complete and offer resume or fresh start.

### Step 2: Read Upstream Context

Read the architecture-extract hand-off (`.groundwork/cache/handoff/architecture-extract.md`) in full; then the architecture's Downstream Context file `.groundwork/context/architecture-extract.md` and `docs/architecture/index.md`'s service map and SLR table (the architecture is the source of truth for what services exist and what they own); then the ops-adoption Downstream Context file `.groundwork/context/ops-adopt.md` — it carries the compose topology that phase merged and whether the boot was ever verified; then the surface registry `docs/surfaces.md`; then `.groundwork/cache/discovery-notes.md` entries under `## Architecture`.

### Step 3: Read the Structural Baseline

Read `scan-state.json` for the service roots and `repo-map.json` for exact ports, dependencies, and contract locations. Read `scan/overview.md` when a deep scan wrote one. You read existing code through these — they tell you where each service lives without re-scanning.

---

## Phase 1: Adoption Plan

Produce the service adoption map and confirm it with the user before writing anything (Protocol 4 — present the whole map at once so cross-service inconsistencies surface).

**Service adoption map** — one row per existing service: its root path, language, port (from `docker-compose.yml` or the code), the contracts it exposes, and the `docs/architecture/services` + `docs/architecture/api` files it will get. No generator column — these services are adopted, not generated.

Confirm the existing-service count against the architecture's service map before closing this phase. On a mismatch, halt: surface the disagreement to the user, ask which source is authoritative — the architecture doc or what the code shows — and append a row to `.groundwork/cache/gap-ledger.md` recording the discrepancy and its resolution before proceeding. Write the confirmed plan to the cache.

Through every phase of this skill, capture out-of-phase signals the user voices — product framing corrections (`## Product Brief`), design instincts (`## Design System`), delivery sequencing for the first bet (`## Bets`) — under their headers in `.groundwork/cache/discovery-notes.md` (Protocol 1).

---

## Phase 2: Adopt Services into Docs (no regeneration)

For each existing service, write `docs/architecture/services/<service-name>.md` and, where it exposes HTTP endpoints, `docs/architecture/api/<service-name>.md`. This is the inverse of greenfield scaffold's Phase 3: you populate these by **reading the real code**, never from generator flags (there were none).

Create `docs/architecture/services/` and `docs/architecture/api/` if absent. Use the document shape defined in `.groundwork/skills/groundwork-scaffold/phases/03-service-documentation-api-stubs.md` (the Service Document and API Stub skeletons), with these brownfield population rules:

- **Port** — from the merged `docker-compose.yml` or the service's own config. Do not guess.
- **Dependencies** — from `repo-map.json`'s dependency edges and the service's code: which services it calls and over what transport, which datastores and external providers it uses.
- **Environment variables** — from the service's real `.env.example` or config loader, read directly. The generated-template assumptions (a Go service reads `DATABASE_URL`; a Python service reads discrete `DB_*` vars) are heuristics — the existing code is ground truth.
- **Test command** — from the service's real tooling, not assumed by language.
- **API endpoints** — transcribe from the **pinned machine-readable contract** the architecture extract recorded (OpenAPI/AsyncAPI/proto). Mark these `status: live`, not `planned` — these endpoints already ship. When a service exposes routes with **no** machine-readable contract, document the health endpoint, leave the rest a placeholder, and ensure the missing-contract gap is in the ledger (the architecture phase should already have logged it at blocks-delivery severity).

Mark the service-adoption phase complete in the cache.

---

## Phase 3: Confirm the Verification Record

The ops-adoption phase laid the stack down and either verified it or recorded the verification as pending in its Downstream Context file. `docs/architecture/infrastructure.md` publishes that state, so establish it as fact before you write it.

**If execution tools are available:** boot the stack (`./dev start`), run any database migrations the existing services define, and run the system tests. Debug failures that stem from the operational layer — a port collision between the added database and an existing one, a network mismatch, a healthcheck the merged compose got wrong. Do **not** "fix" failures that stem from the existing application's own behaviour by changing its code — record those as gaps instead. The operational layer must boot cleanly; the application's own test posture is a finding, not your repair job.

**If execution tools are unavailable:** carry the pending state forward; `docs/architecture/infrastructure.md` must flag it explicitly rather than presenting ports and commands as verified.

**Offer the audit gate if ops adoption did not (additive, one decision).** `./dev audit` exists in the adopted CLI — dependency-vulnerability audit per service plus a gitleaks secret scan. An existing repo usually carries history a fresh scan would flag, so when the user accepts and gitleaks reports findings that predate the adoption, generate the acknowledgement baseline (`gitleaks git --report-path .dev/gitleaks-baseline.json --exit-code 0`, then commit the file) — the baseline acknowledges existing history while everything after it is gated. A finding that is a live credential is not baseline material: flag it for rotation in the gap ledger. If the user declines the audit, record that in the gap ledger too.

Mark the verification phase complete (or pending) in the cache.

---

## Phase 4: Consolidate the Gap Ledger & Draft

1. **Consolidate `docs/maturity.md`.** Read the maturity model at `.groundwork/skills/maturity-model.md`, then write `docs/maturity.md` from the template at `.groundwork/skills/templates/maturity.md` — a clean published doc with no summary section. Two parts:

   - **Assessment** — score the project against the nine dimensions (mapping: `.groundwork/skills/maturity-model.md`), with evidence from what this track actually produced: the booted stack and harness ops adoption added, the registered code map, the contracts the architecture extract pinned or found missing, the surface registry. Brownfield projects usually land 🟡/🔴 on several dimensions — score honestly; the roadmap is where the distance becomes work.
   - **Roadmap** — read `.groundwork/cache/gap-ledger.md` (the running ledger every phase of the track appended to) and convert each entry to a roadmap row: gap, dimension (D1–D9), severity, recommendation, status `open`, evidence. Blocks-delivery gaps first. Mark gaps the track *closed* as `closed (setup)` — most importantly, if ops adoption added the system-test harness, that blocks-delivery gap is resolved and the roadmap says so. Append one stance row of your own before converting: the capability ledger in `docs/surfaces.md` starts **empty at adoption by design** — a scanned ledger is confidently wrong where an empty one is honestly unknown. Dimension **D8**, gap "surface parity unmeasured — ledger empty at adoption by design", severity `cosmetic`, recommendation `defer`, evidence `docs/surfaces.md`. The row puts the empty ledger on record as a decision — no future reader mistakes it for a missed extraction step — and keeps the unmeasured parity aging at bet discovery until the ledger's first real triage fills it. A phase the user deferred is a roadmap row too: dimension **D1**, naming the canonical doc it would produce and the phrase that runs it. Seed `## History` with one line recording this initial assessment.

   This document is what `groundwork-bet` reads when planning every bet — it is the mechanism by which onboarding debt becomes prioritised, schedulable work that the user steers, never a forced march. Apply `groundwork-writer`.

2. **Draft `docs/architecture/infrastructure.md`** following greenfield scaffold's quality standard: the environment overview, the service table with ports and health endpoints, the infrastructure components, the "What `./dev start` does" boot model, the canonical run/test/migrate commands with a pointer to the getting-started on-ramp, and the verification results (or the pending-verification flag). Apply `groundwork-writer`.

2b. **Author the `docs/getting-started/` on-ramp** — `index.md`, `setup.md`, `dev-cli-reference.md` — to greenfield scaffold's standard ("The developer on-ramp"). For a brownfield adoption, `setup.md`'s prerequisites and install commands come from the existing services' real toolchains (read their manifests — `go.mod`, `package.json`, `pyproject.toml`), and `dev-cli-reference.md` is derived from `./dev help`. These are the docs the docs-site landing page routes a fresh-clone developer to. Apply `groundwork-writer`. They have no separate review type; the present-and-approve step gates them. Seed the section's sidebar order if absent: write `docs/getting-started/meta.json` as `{ "pages": ["index", "setup", "dev-cli-reference", "..."] }`.

3. **Review infrastructure and maturity.** Invoke the review subagent (Protocol 9) once per document: `docs/architecture/infrastructure.md` with `document_type: infrastructure`, and `docs/maturity.md` with `document_type: maturity`. (The getting-started docs from step 2b carry no review type — they are gated by present-and-approve.) The gate is fail-closed; on REVISE, apply all 🔴 findings and re-review — Protocol 8's revise cap and hard-stop rule apply. The maturity review checks that every row carries a valid dimension, severity, and status, and that the assessment does not contradict the docs this setup just committed. The domain stubs are not re-reviewed here — the architecture phase reviewed them at its commit, and they re-enter review only when a reconciliation in this phase mutates one (Protocol 2).

4. **Present** the two reviewed documents and summarise the `docs/getting-started/` set, surface 🟡 Advisory findings from the reviews, and walk the user through the maturity roadmap — each gap, the dimension it blocks, what leaving it open costs, and the recommendation. Invite the user to re-rank or to mark gaps `accepted` where they consciously disagree; record their reasoning in the row. Proceed to commit only on explicit user approval of both documents.

---

## Phase 5: Commit

Execute **only** after explicit user approval (Protocol 3.4):

1. **Write the Downstream Context file** to `.groundwork/context/infra-adopt.md` (Protocol 5), derived from the committed `docs/architecture/infrastructure.md` and `docs/maturity.md`: the four subsections (Key Decisions, Binding Constraints, Deferred Questions, Out of Scope), ≤200 words, via `groundwork-writer`. The published docs — including the `docs/getting-started/` set — are clean reference documentation with no summary section. This is the last setup phase, so its context file is short-lived — Setup Graduation (Protocol 10) tears the whole `.groundwork/context/` store down. Add a one-line `llms.txt` entry for each newly created doc — the `docs/getting-started/` files and `docs/maturity.md` included.

2. **Stamp drift-baseline frontmatter** on the code-coupled docs this phase wrote: each `docs/architecture/services/<name>.md` and `docs/architecture/api/<name>.md` gets `generation_mode: extracted`, `source_of_truth:` (the service's code paths and contract files), and `last_reviewed:` (today's date). The architecture phase already stamped `docs/architecture/index.md` and the domain docs.

3. **Set the baseline in state.json.** Write `baseline: { source_commit: <current git SHA>, scanned_at: <iso> }` into `.groundwork/config/state.json`. This anchors drift detection — `groundwork-check` compares the code's git history against `source_commit` for extracted docs. Add nothing to the `completed` array — the orchestrator reconciles this phase's completion from its committed artifacts (its Brownfield Setup table is the source of truth).

4. **Tear down the scan cache (this phase owns it).** Under the default track there is no `.groundwork/cache/scan/` tree at all — scan-lite writes none, and a deferred extract regenerates its own scoped inputs at invocation rather than reading one. Delete what exists: `.groundwork/cache/scan/` when a deep scan wrote it, `.groundwork/cache/scan-state.json`, and the consumed architecture-extract hand-off. The one exception: when a deep scan ran *and* any phase carries a `deferred` entry in `state.json`'s `phase_states` — an extract, or `methodology-adopt` — leave `.groundwork/cache/scan/` and `scan-state.json` standing; that pass was paid for, and the deferred phase reads it rather than re-reading the repo. **Preserve `.groundwork/cache/repo-map.json`** in every case — it is a first-class artifact `groundwork-check` and the bet loop reuse for impact analysis, regenerable on demand by `npx groundwork-method repo-map`. Delete `docker-compose.yml.bak` only after confirming the merged compose boots; otherwise leave it for the user.

5. **Delete the phase cache** `.groundwork/cache/infra-adopt-cache.md`. Delete the gap ledger working file `.groundwork/cache/gap-ledger.md` now that its entries live in `docs/maturity.md`.

6. Apply the Living Documents protocol. If reading the services surfaced a contradiction with `docs/architecture/index.md` (a port, a dependency, a service the architecture misdescribed), reconcile it — and refresh the architecture's live Downstream Context file `.groundwork/context/architecture-extract.md` if the change touched a Key Decision, Binding Constraint, or Deferred Question. A change that overturns an architecture Key Decision or Binding Constraint is a reversal (Protocol 2) — reconcile the body and dependent docs, write the superseding ADR, and re-review every mutated doc.

7. Update discovery notes — remove `## Architecture` entries now captured.

8. Confirm the brownfield setup is complete. State plainly what exists now: the committed docs, the operational layer, and the maturity roadmap with its prioritised gaps — and name any phase the user deferred, with the phrase that runs it.

9. Recommend a fresh context, then immediately load and execute the `groundwork-orchestrator` skill. **Route through the orchestrator — do not load `groundwork-bet` directly**: skipping the hop leaves the phase unreconciled, so a later resume re-routes into setup. With every setup phase settled, the orchestrator runs Setup Graduation and then routes to `groundwork-bet` for the first bet — whose discovery reads `docs/maturity.md` to weigh closing a blocks-delivery gap against pursuing value elsewhere. Do not ask the user to invoke it.
