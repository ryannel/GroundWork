---
name: groundwork-ops-adopt
description: >
  Bolts the GroundWork operational layer onto an existing repo right after the
  scan — the `./dev` CLI, the system-test harness provisioned from the confirmed
  surfaces, an optional docs site — and writes the surface registry
  (`docs/surfaces.md` + `.groundwork/surfaces.json`) the rest of the track builds on.
  Never runs a service or app generator.
---

# groundwork-ops-adopt

You are a platform engineer, and the repo you are standing in already runs. Your job is to give it the operating surface it is missing — one command to start it, one command to test it — and to put its surfaces on the record. You add tooling around the application; you never touch the application.

This phase runs immediately after the scan because its value does not depend on any document. `./dev` and a working test harness make every later phase cheaper and every future bet provable, so they ship first rather than last. The scan already confirmed the surface list with the user; you turn that list into the registry the whole product reads from and into the fixtures the harness provisions.

Three rules are absolute:

- **Never run a service or app generator.** `go-microservice`, `python-microservice`, `nextjs-app`, and `cli-app` *create* services. The services exist. Running them would overwrite or duplicate real code — the large in-place refactor this track exists to avoid. You run only the infrastructure generators: `workspace-dev-cli`, `system-test-runner`, and optionally `docs-site`.
- **Additive, never destructive.** Every file you lay down is new operational tooling. Where a generator would overwrite something that already exists — most dangerously `docker-compose.yml` — you adopt and merge, you do not clobber.
- **Unbranded is fine; wrong is not.** Brand the tooling from `.groundwork/config/brand-tokens.json` when it exists, and from Tier-1 defaults when it does not. The design phase re-brands later if it ever runs. A default-branded `./dev` that works beats a branded one that waited for a document.

Apply the `groundwork-writer` skill when producing the surface registry.

---

## How This Phase Works

1. **Read the confirmed inputs** — the scan's surface list, the code map, the existing compose topology.
2. **Operational layer plan** — which infrastructure generators to run, and what the compose merge will do. Confirm with the user before anything runs.
3. **Lay down the layer** — nx bootstrap, `workspace-dev-cli` under the compose merge guard, `system-test-runner` from the confirmed surfaces, optionally the docs site.
4. **Write the surface registry** — `docs/surfaces.md` and `.groundwork/surfaces.json`, from the surface list the scan confirmed.
5. **Verify** — boot the stack and run the harness, or record verification as pending.
6. **Commit** — the registry, the `llms.txt` entries, the gap-ledger rows, the hand-off.

---

## Operating Contract

The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) governs how this skill operates. Read it before taking any other action. This is a Sequential Setup phase. Under the Protocol 7 brownfield exception it may read `scan-state.json`, `scan/overview.md` when a deep scan wrote one, and `repo-map.json`. Open the phase — and precede every question that blocks on the user — with the Setup Progress Header (operating contract, Sequential Setup).

`docs/surfaces.md` has no review checklist type and is not review-gated; it is a projection of facts the user just confirmed, held to the contract at `.groundwork/skills/surfaces-contract.md` and gated by the present-and-approve step at commit — the same treatment the `docs/getting-started/` set receives.

---

## Initialization & Resume Protocol

### Step 1: Cache Check

Create `.groundwork/cache/ops-adopt-cache.md` from `.groundwork/skills/groundwork-ops-adopt/templates/ops-adopt-cache.md` if absent; on resume, summarise which steps are complete and offer resume or fresh start.

### Step 2: Read the Confirmed Inputs

Read, in this order:

1. **`.groundwork/cache/scan-state.json`** — the classification, the `core_deployment` value, and the `surfaces` array the scan confirmed with the user. This array is your source for the registry; it carries `slug`, `type`, `platform`, and `root` per surface.
2. **`.groundwork/cache/repo-map.json`** — exact module boundaries, dependency edges, and contract locations, for the ports and dependencies the plan needs.
3. **The existing operational surface** — `docker-compose.yml`, any `Makefile` or task runner, the CI workflow. What already exists decides what you must merge rather than write.
4. **`.groundwork/cache/discovery-notes.md`** entries under `## Architecture`.

If `scan-state.json` carries no `surfaces` array, the scan did not complete its confirmation. Do not infer the list from the code — route back to `groundwork-scan` rather than guessing a registry the whole product will resolve against.

---

## Step 1: Operational Layer Plan

Produce the plan and confirm it with the user before running anything (Protocol 4 — present the whole plan at once so inconsistencies surface together).

| Generator | Run when | Notes |
|---|---|---|
| `workspace-dev-cli` | `./dev` does not already exist | Lays down `./dev`, `.dev/`, and a base `docker-compose.yml`. Subject to the merge guard below. Derive `--appName` from the repo's own manifest or directory name; do not ask. |
| `system-test-runner` | no system-test harness exists | Run once with `--surfaces` (invocation contract: `.groundwork/skills/surfaces-contract.md`; the JSON array in Step 2). A missing harness is a blocks-delivery gap — adding it is the single highest-value thing this phase does. |
| `docs-site` | opt-in, when no docs site exists | Ask the user once whether they want a Fumadocs site. Default to running it when the repo has no documentation surface. |

State the branding you will apply: `.groundwork/config/brand-tokens.json` when it exists, Tier-1 defaults otherwise, and that the design phase re-brands the CLI if and when it runs.

Write the confirmed plan to the cache. Through every step of this skill, capture out-of-phase signals the user voices — product framing corrections (`## Product Brief`), design instincts (`## Design System`), delivery sequencing for the first bet (`## Bets`) — under their headers in `.groundwork/cache/discovery-notes.md` (Protocol 1).

---

## Step 2: Lay Down the Operational Layer

**If command execution tools are available**, execute in this order:

1. **Bootstrap the minimal Nx workspace.** If `nx.json` does not exist at the repo root, write `nx.json` containing `{}` — the minimal file the infrastructure generators need to run. **If `nx.json` already exists, leave it untouched** — the repo is already an Nx workspace and overwriting its config would break it.

2. **Run `workspace-dev-cli` with the docker-compose adopt/merge guard.** This generator writes `docker-compose.yml` from a template and would overwrite an existing one — the core hazard of this phase. When `docker-compose.yml` already exists:
   1. Copy it to `docker-compose.yml.bak`.
   2. Run `workspace-dev-cli` (`npx --yes nx g "$(pwd)/.groundwork/config/generators.json:workspace-dev-cli" --appName <app-name>`). The generated compose is the **base** — it carries the `db`, the Jaeger trace backend, and the `groundwork-net` network the system tests assert against.
   3. **Merge structurally** — parse both documents and carry over every service in the backup that the generated file lacks, attaching `groundwork-net` to its networks; never re-emit YAML through the model (the same mechanism the `docs-site` generator uses to inject a service). Write the merged document back.
   4. Keep `docker-compose.yml.bak` as the safety net and report the merge to the user: which services were carried over, and that the shared database, tracing, and network the tooling needs were added.

   When no `docker-compose.yml` exists, run `workspace-dev-cli` normally — there is nothing to merge.

3. **Run `system-test-runner --surfaces`** — one JSON entry per confirmed surface (shape and `reach` rules: `.groundwork/skills/surfaces-contract.md` § `--surfaces` Invocation Contract), `reach` only when a surface has a static base URL or launch command the compose topology cannot discover — and, if opted in, **`docs-site --name <slug>`**. Apply the same detect-and-adopt caution to any file these would overwrite.

4. **Verify nothing existing was clobbered.** Confirm the merged `docker-compose.yml` contains every previously-existing service plus the additions above, and that no application source changed.

**If command execution tools are unavailable**, present the full runbook as a single handoff — the nx.json bootstrap, the generator commands, and the compose-merge steps in order — and note that verification (Step 4) must be done manually.

Mark the operational-layer step complete in the cache.

---

## Step 3: Write the Surface Registry

`docs/surfaces.md` and `.groundwork/surfaces.json` are the join point for the rest of the product: design tracks, bet frontmatter, decomposition slices, and test fixtures all resolve against a surface slug. This phase authors them because the harness it just provisioned is built from the same list. Follow the contract at `.groundwork/skills/surfaces-contract.md` — it is the one statement of both files' shape.

Project the confirmed facts, and mark what is not yet known:

- **Capability Core** — what the core owns, its `core_deployment` as confirmed at the scan, and where its contracts live (the contract index in `repo-map.json`).
- **One Surface Registry entry per confirmed surface**, `status: active` — these ship today. Per entry: `type` and `platform` from the scan's list; `scaffold: manual`, because an adopted surface was not generated and `manual` is first-class; `test medium` as the fixture family the type and platform imply (`playwright` for a web `graphical-ui`, `subprocess-cli` for a `cli`, `protocol-client` for an `agentic-protocol`); `design track` pointing at the matching type section of `docs/design-system.md`, which the design phase writes if and when it runs.
- **`core access` and `auth`** — write what the compose topology and config plainly show. Where the code does not show them, record them as recovered at architecture extract rather than guessing: that phase reads the real call paths and **enriches** this registry, and a guess written here is a fact everything downstream inherits.
- **Capability Ledger** — the table header with **no rows**, and an empty `capabilities` array in the machine twin. A scanned ledger is confidently wrong where an empty one is honestly unknown; rows grow per bet as validation touches capabilities.

Write both files in the same step — they are projections of the same decisions and never disagree. Write the registry even for a single-surface repo; downstream phases read it either way.

---

## Step 4: Verification

**If execution tools are available:** boot the stack (`./dev start`), run any database migrations the existing services define, and run the system tests the harness scaffolded. Debug failures that stem from the operational layer you added — a port collision between the added database and an existing one, a network mismatch, a healthcheck the merged compose got wrong. Do **not** "fix" failures that stem from the existing application's own behaviour by changing its code — record those as gaps instead. The operational layer must boot cleanly; the application's own test posture is a finding, not your repair job.

**If execution tools are unavailable:** record verification as pending. The terminal setup phase writes `docs/architecture/infrastructure.md` and must flag this explicitly rather than presenting ports and commands as verified — and it is two phases downstream, so the pending state travels in this phase's Downstream Context file, not its single-hop hand-off.

**Offer the audit gate (additive, one decision).** `./dev audit` now exists in the adopted CLI — dependency-vulnerability audit per service plus a gitleaks secret scan. An existing repo usually carries history a fresh scan would flag, so when the user accepts and gitleaks reports findings that predate the adoption, generate the acknowledgement baseline (`gitleaks git --report-path .dev/gitleaks-baseline.json --exit-code 0`, then commit the file) — the baseline acknowledges existing history while everything after it is gated. A finding that is a live credential is not baseline material: flag it for rotation in the gap ledger. If the user declines the audit, record that in the gap ledger too.

Mark verification complete (or pending) in the cache.

---

## Step 5: Commit

Execute **only** after explicit user approval of the registry (Protocol 3.4):

1. **Present and approve.** Walk the user through the registry — each surface, its test medium, and what is still marked for recovery at architecture extract — and through what `./dev` now does. Proceed only on explicit approval.

2. **Write the Downstream Context file** to `.groundwork/context/ops-adopt.md` (Protocol 5) via `groundwork-writer`: the four subsections (Key Decisions, Binding Constraints, Deferred Questions, Out of Scope), ≤200 words, derived from the committed registry. The surface set, the core deployment, and the compose topology you merged are Key Decisions; anything left for architecture extract to recover is a Deferred Question naming that phase, and an unverified boot is a Deferred Question naming the terminal setup phase, which must publish it rather than present the stack as proven.

3. Add an `llms.txt` entry for `docs/surfaces.md` and for the docs site's landing page when one was generated.

4. **Append gaps to the ledger** at `.groundwork/cache/gap-ledger.md` (create from `.groundwork/skills/templates/gap-ledger.md` if absent): what verification could not confirm, any declined audit, and any surface whose test medium the harness could not provision.

5. **Write the hand-off** to `.groundwork/cache/handoff/ops-adopt.md` from `.groundwork/skills/templates/handoff.md`: the verification state, what the compose merge carried over, the registry fields left for architecture extract to recover, and user instincts about the operational layer. Omit empty sections (Protocol 6).

6. **Delete the phase cache** `.groundwork/cache/ops-adopt-cache.md`. Delete `docker-compose.yml.bak` only after confirming the merged compose boots; otherwise leave it for the user. Leave `scan-state.json`, `repo-map.json`, and anything under `.groundwork/cache/scan/` — later phases still read them.

7. Update discovery notes — remove `## Architecture` entries now captured.

8. **Report what the user can now do**: one command starts the whole project, one command runs its tests against every surface, and the surfaces are on the record. Then recommend a fresh context and immediately load and execute the `groundwork-orchestrator` skill. Do not ask the user to invoke it. Record nothing in `state.json` — the orchestrator reconciles this phase's completion from its committed artifacts.
