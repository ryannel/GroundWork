# BMAD-Bar Quality Uplift

This plan closes the gap between GroundWork's current state and the operational quality bar set by BMAD-METHOD (v6.x, cloned at `BMAD/` for reference). It is written to survive a context reset — a fresh chat with zero prior context can open this file and execute the next slice without further setup.

The companion analysis lives in `docs/groundwork-vs-bmad.md`. Its conclusion is locked: **GroundWork stays standalone** and adopts BMAD's operational mechanics, not its runtime or its agile methodology. Do not re-open that decision inside this plan.

---

## 1. Resume Instructions (read this first)

1. **Read this entire document.** It is self-contained.
2. **Load the skill-writer skill** before editing any skill file: `.agents/skills/skill-writer/SKILL.md`.
3. **Load the operating contract** at `src/hidden-skills/operating-contract.md` before touching any methodology skill.
4. **All directional decisions are locked** (§4). If one must change, surface the trade-off explicitly and update this file before proceeding.
5. **Find the next open slice in the [Task Tracker](#6-task-tracker).** Slices are ordered by dependency within each priority band. Do not jump bands unless every earlier band is complete or explicitly blocked.
6. **Check a slice off only when its Verify block passes.**
7. **One slice = one commit.** Update the tracker in the same commit.

---

## 2. The quality bar, decomposed

BMAD's quality is not one thing. Audit of the clone plus its public ecosystem decomposes it into seven dimensions, scored against GroundWork today:

| # | Dimension | BMAD has | GroundWork has | Gap |
|---|---|---|---|---|
| Q1 | **Truthfulness** — everything advertised works | 42 working skills, stubs absent | `groundwork-update` skill is pseudo-code; CLI `update`/`check` commands print placeholders; `groundwork-persona` is registered but hollow; `docs/product-brief.md` still declares brownfield out of scope | 🔴 |
| Q2 | **Front door** — a stranger can start in minutes | Docs site, user guide, `bmad-help` skill, `module-help.csv` workflow index | No README, no getting-started, no help surface beyond the orchestrator's one-line "explain GroundWork" intent | 🔴 |
| Q3 | **Release engineering** — versioned, upgradable, changelogged | Semver, 36+ releases, changelog, installer with remembered answers + CI mode, clean upgrade path | Hardcoded `1.0.0`, no changelog, no upgrade command, no version stamp in installed projects, unversioned operating contract | 🔴 |
| Q4 | **Internal consistency** — every skill enacts every shared protocol | Standardized skill format (SKILL.md + customize.toml + steps), uniform across 42 skills | Review gates, discovery-notes capture, and Adopt/Upgrade mode implemented in some skills and silent in siblings; 18 of 21 hidden skills lack SKILL.md frontmatter | 🟡 |
| Q5 | **Quality gates** — shipped checklists, not reviewer vibes | 12 checklists wired into workflows (story, sprint, dev, readiness, code review) | One review panel skill (`groundwork-review`); no shipped per-document checklists; MVP commit and bet planning skip review entirely | 🟡 |
| Q6 | **Customization & extensibility** — reshape without forking | 3-tier TOML override hierarchy; module system; builder module | Hardcoded routing table; no user config surface; no template overrides; forking is the only customization | 🟡 |
| Q7 | **Verified behavior** — the framework's own claims are tested | Community-scale usage as de-facto test | Strong generator/boot harness; simulation harness exists but brownfield path never run end-to-end; zero tests for CLI and orchestrator routing | 🟡 |

GroundWork's existing advantages (generator/boot test harness, two-layer context economy, brownfield reverse-engineering, living documents) are not in scope — this plan closes gaps, it does not redesign strengths.

---

## 3. Findings

Evidence behind each gap. File references are to this repo.

| # | Finding | Dimension | Severity |
|---|---|---|---|
| F1 | `src/hidden-skills/groundwork-update/instructions.md` is 42 lines of pseudo-XML with no mapping protocol from code changes to doc edits, no review gate, no discovery-notes handling | Q1 | 🔴 |
| F2 | `bin/groundwork.js` `update` and `check` commands print `Triggering groundwork-update...` placeholders (~lines 269–276) while the help text advertises them | Q1 | 🔴 |
| F3 | `src/skills/groundwork-persona/` is registered into every user project but is a stub | Q1 | 🔴 |
| F4 | `docs/product-brief.md` lists brownfield as out of scope; brownfield shipped (see `TODO.md` follow-up dated 2026-05-24) | Q1 | 🔴 |
| F5 | No root `README.md`; npm page and GitHub landing are empty surfaces; first-run guidance ends at "run the orchestrator" | Q2 | 🔴 |
| F6 | No workflow index. BMAD's `module-help.csv` maps every workflow to phase, prerequisites, and outputs; GroundWork's equivalent knowledge exists only inside the orchestrator's routing tables | Q2 | 🟡 |
| F7 | `package.json` pinned at `1.0.0`; no `CHANGELOG.md`; no release workflow in `.github/workflows/` | Q3 | 🔴 |
| F8 | No version stamp anywhere in an installed project: `src/config/groundwork-state.json` has no `version` field; `operating-contract.md` has no version; a 1.1 framework cannot detect a 1.0 install | Q3 | 🔴 |
| F9 | Re-running `npx groundwork init` is the only refresh path; it is skill-copy idempotent but has no migration notes and no awareness of what changed | Q3 | 🟡 |
| F10 | 18 of 21 hidden skills have `instructions.md` with no SKILL.md frontmatter — no canonical name/description for tooling to parse | Q4 | 🟡 |
| F11 | Review-gate non-conformance: `groundwork-mvp` commits its pitch without invoking `groundwork-review`; `groundwork-update` never references review. Contrast `groundwork-product-brief-extract`, which gates fail-closed | Q4 | 🔴 |
| F12 | Discovery-notes non-conformance: `groundwork-bet/instructions.md` and `groundwork-mvp` are silent on the capture protocol the operating contract mandates | Q4 | 🟡 |
| F13 | Adopt/Upgrade mode is implemented only in `groundwork-product-brief-extract`; `groundwork-design-system-extract` and `groundwork-architecture-extract` will overwrite pre-existing docs the orchestrator routes to them for upgrading | Q4 | 🔴 |
| F14 | No shipped checklists. BMAD ships 12 (story validation alone is 80+ lines of named failure modes); GroundWork's review panel improvises its rubric per run | Q5 | 🟡 |
| F15 | No readiness gate between bet planning and delivery — BMAD's `check-implementation-readiness` has no GroundWork analog | Q5 | 🟡 |
| F16 | Routing table hardcoded in `src/skills/groundwork-orchestrator/SKILL.md`; users cannot register a custom methodology skill without editing installed files that the next init overwrites | Q6 | 🟡 |
| F17 | No user config surface: stack preferences, default model choices, generator defaults are re-asked or hardcoded; `.groundwork/config/config.toml` exists but carries only project classification | Q6 | 🟡 |
| F18 | Brownfield simulation never run end-to-end in real Claude Code (`TODO.md`, standing follow-up); the path's protocol conformance has never been observed live | Q7 | 🔴 |
| F19 | Zero automated tests for `bin/groundwork.js` (init, symlinks, depwire registration, self-copy guard) and zero for orchestrator state resolution/reconciliation logic | Q7 | 🟡 |
| F20 | Skill ↔ doc drift is unchecked (`TODO.md` deferred item): a skill and its lifecycle doc can silently disagree | Q7 | 🟡 |
| F21 | The npm name `groundwork` is held by an unrelated package (aniftyco/groundwork, since 2023) — `npx groundwork` resolves to someone else's CLI. Publishing requires a name decision: scope (`@rnel/groundwork`), rename, or attempt a transfer. Release workflow stays `--dry-run` until resolved. **User decision required.** | Q3 | 🔴 |

---

## 4. Locked Directional Decisions

**D1 — Standalone, adopt mechanics.** GroundWork does not become a BMAD module. It adopts BMAD's operational mechanics (release engineering, checklists, help index, customization tiers) re-expressed in GroundWork's idiom. Rationale: `docs/groundwork-vs-bmad.md`.

**D2 — No persona troupe.** The `TODO.md` persona backlog (`groundwork-pm`, `groundwork-architect`, …) is superseded. The single expert-peer facilitator stays. Persona-like specialization is allowed only as labels on isolated subagent dispatches (review panel, scan fan-out).

**D3 — Checklists ship as files, not prose.** Each quality gate becomes a checklist file under `src/hidden-skills/groundwork-review/checklists/<document-type>.md`, loaded by the review skill per document type. Mirrors BMAD's most effective pattern while keeping GroundWork's isolated-subagent review architecture.

**D4 — Versioning is three-point.** (a) npm semver + `CHANGELOG.md`; (b) a `groundwork.version` field written into `.groundwork/config/state.json` at init/update; (c) a `version` field in `operating-contract.md` frontmatter. The CLI warns on mismatch between (a) and (b).

**D5 — Customization follows the BMAD tier model, scoped down.** One file: `.groundwork/config/config.toml` gains `[defaults]` (stack, model, generator flags) and `[skills]` (extra routing entries). No third personal tier until demand exists.

**D6 — `groundwork-persona` either earns its registration or moves.** If its conversational-posture content is real, write it fully; if not, fold it into the orchestrator and delete the registered stub. Decide in S3, do not leave it hollow.

**D7 — Help is generated, not hand-maintained.** The workflow index (S6) is derived from the orchestrator routing tables by a script, so it cannot drift from the actual routes.

**D8 — Maturity is steered, not forced (user directive, 2026-06-09).** GroundWork carries an explicit maturity model — the named dimensions of its target state (current docs, machine-readable contracts, operational layer, system-test harness, code intelligence, CI doc-currency, delivery discipline) — and every project gets a living `docs/maturity.md` that assesses the project against it and tracks the roadmap toward it. The framework informs and guides: each gap names the dimension it blocks and the cost of leaving it open; the bet loop *proposes* pulling maturity work into bets and the user decides. `docs/maturity.md` supersedes the one-shot `docs/onboarding-report.md` — the gap ledger consolidates into a tracked roadmap that the bet loop closes against and `groundwork-check` re-assesses, instead of a report that freezes at the end of setup.

---

## 5. Workstreams and slices

### Band P0 — Truthfulness and the front door

**S1 — Build the update engine (F1).** Rewrite `groundwork-update` to full standard: mental-model opening, mapping protocol (changed source files → affected doc sections, using depwire when present, git diff otherwise), surgical-edit rules under the Living Documents protocol, review gate before commit, cache lifecycle.
*Verify:* skill matches sibling structure (compare `groundwork-product-brief`); every operating-contract protocol is enacted at a named step; dry-run in a sandbox: change a service file, invoke update, observe a correct surgical doc edit gated through review.

**S2 — Real CLI `update` and `check` (F2).** `update`: re-copy skills/hidden-skills idempotently, preserve `.groundwork/config/`, print a versioned summary of what changed (reads CHANGELOG once S7 lands; until then, file-level diff summary). `check`: print instructions for invoking the `groundwork-check` skill in CI, or run its deterministic glob/git-log portion directly.
*Verify:* run both commands in a scratch repo; no placeholders remain; `update` on an already-current install is a no-op that says so.

**S3 — Resolve `groundwork-persona` (F3, D6).** Write it fully or fold and delete.
*Verify:* either a complete SKILL.md meeting skill-writer standards, or the directory is gone from `src/skills/` and the contributor guide's registered-skill list is updated.

**S4 — Refresh `docs/product-brief.md` (F4).** Remove the stale brownfield exclusion, fold brownfield into capabilities, re-stamp `last_reviewed`. Closes the standing `TODO.md` follow-up.
*Verify:* no document in `docs/` contradicts the shipped brownfield path; `TODO.md` item checked off.

**S5 — Root README + Getting Started (F5).** README: what GroundWork is (draw from `docs/product.md`), install, the 60-second first run, lifecycle diagram, links into `docs/`. A `docs/getting-started.md` walks one greenfield session end-to-end with real command/transcript excerpts from a simulation run.
*Verify:* a reader who has never seen the repo can state, from the README alone, what `npx groundwork init` installs and what happens next; npm `files` includes the README.

**S6 — Help surface (F6, D7).** Script `scripts/generate_workflow_index.js` derives `src/skills/groundwork-orchestrator/workflow-index.md` (phase, skill, prerequisites, artifact, mode) from the routing tables; orchestrator's help intent loads it; CLI `npx groundwork help` prints the same map.
*Verify:* index regenerates deterministically; CI fails if committed index is stale (same pattern as the dev-cli bundle freshness contract test).

### Band P1 — Release engineering and conformance

**S7 — Semver + changelog + release workflow (F7).** Adopt semver from `0.x` honestly (the framework is pre-1.0 by its own audit). Add `CHANGELOG.md` (Keep-a-Changelog format), a `.github/workflows/release.yml` publishing on tag, and a release checklist in the contributor skill.
*Verify:* a tagged release publishes to npm dry-run; CHANGELOG carries entries for S1–S6.

**S8 — Version stamping (F8, D4).** `init`/`update` write `groundwork.version` into state.json; `operating-contract.md` gains frontmatter `version`; every skill that loads the contract names the major version it expects; CLI warns on mismatch.
*Verify:* fresh init stamps correctly; simulated old install triggers the warning; contract-version expectation appears in every methodology skill header.

**S9 — Migration notes in `update` (F9).** `update` compares stamped vs package version and prints the CHANGELOG slice between them, flagging entries marked `[migration]`.
*Verify:* scripted test: stamp 0.1.0, run update at 0.2.0 with a `[migration]` entry, observe it surfaced.

**S10 — SKILL.md frontmatter sweep (F10).** Every hidden skill gets SKILL.md frontmatter (name, description) — as the front matter of its existing instruction file or a thin SKILL.md that routes to it; pick one shape and apply it to all 21 (skill-writer's structural-consistency rule).
*Verify:* a parser finds name+description for every skill under `src/hidden-skills/`; `./dev lint skills` (S13) asserts it.

**S11 — Review-gate conformance (F11).** Add fail-closed `groundwork-review` invocations (isolated subagent, parseable VERDICT) to `groundwork-mvp` Phase 4 and to `groundwork-update` (from S1). Audit every other committing skill against the same pattern; align wording across siblings.
*Verify:* grep for the review-invocation block across all committing skills returns structurally identical sections; simulation transcript shows the MVP pitch passing through review.

**S12 — Discovery-notes conformance (F12).** `groundwork-bet` and `groundwork-mvp` enact capture and read-back of `.groundwork/cache/discovery-notes.md` at the contract's defined points.
*Verify:* per skill-writer's shared-contract rule, list every contract step and confirm each skill performs it at the right lifecycle point; headers match the template exactly (identifier-drift rule).

**S13 — `./dev lint skills` (F10–F13 guard).** Mechanical conformance checker: frontmatter present; operating-contract reference with version; review-gate section present in committing skills; discovery-notes section headers match the shared template strings; routing table ↔ filesystem agreement; llms.txt links resolve.
*Verify:* lint passes on the repo; seeded violations (missing gate, drifted header) fail with named findings; wired into CI.

**S14 — Adopt/Upgrade mode in remaining extract skills (F13).** Port `groundwork-product-brief-extract`'s Step-1 mode detection (Absent → Extract; present-without-contract → Adopt/Upgrade: ingest, fill contract sections, re-stamp, review, commit) into `groundwork-design-system-extract` and `groundwork-architecture-extract`.
*Verify:* brownfield sandbox seeded with a hand-authored `docs/architecture.md`: the extract preserves its content, adds the Summary for Downstream contract, and never blind-overwrites. Also covers BMAD-artifact ingestion (a BMAD PRD/architecture doc is exactly this shape) — the interop move from `docs/groundwork-vs-bmad.md`.

### Workstream M — Maturity steering (D8; priority equal to P1)

**M1 — Author the maturity model.** A shared reference at `src/hidden-skills/maturity-model.md`: the named dimensions of GroundWork's target state, why each matters (the concrete failure it prevents), and the mechanical signal that assesses it where one exists. A `templates/maturity.md` template for the living doc. `groundwork-review` gains `document_type: maturity` with type-specific checks (every gap row carries dimension, severity, recommendation, status; every assessment claim carries evidence).
*Verify:* the model is generic (no sandbox-product leakage); every dimension names its failure mode and its assessment signal; review skill accepts the new type.

**M2 — Infra-adopt consolidates into `docs/maturity.md`.** Phase 5 writes the living maturity doc (model assessment + roadmap from the gap ledger) in place of `docs/onboarding-report.md`. Orchestrator completion signal, lifecycle docs, and sim checklist references updated in the same slice.
*Verify:* no reference to `onboarding-report.md` remains anywhere in `src/` or `docs/`; the brownfield completion signal names `docs/maturity.md`.

**M3 — Bet-loop steering.** Bet discovery reads the maturity roadmap and proposes — never forces — pulling open fix-now/blocks-delivery items into the bet, framing the trade-off (value now vs. capability that compounds). Bet validation marks gaps the bet closed, updates their status and closing bet slug, and re-stamps the doc.
*Verify:* discovery instructions present maturity items as proposals with the cost of deferral; validation updates roadmap rows; wording follows the operating contract's pacing protocol.

**M4 — Continuous assessment.** `groundwork-check` re-assesses the mechanical dimensions (contracts present, harness present, docs current, depwire registered) and flags `docs/maturity.md` rows that disagree with observed state. `groundwork-update`'s semantic mapping gains a maturity row (new service without a contract → new gap row). Greenfield scaffold writes the initial `docs/maturity.md` at commit, so maturity is a framework-wide concept, not a brownfield artifact.
*Verify:* check flags a seeded disagreement (gap marked closed while signal says open); greenfield scaffold output includes a mostly-green maturity doc.

### Band P2 — Quality gates, customization, verification

**S15 — Shipped checklists (F14, D3).** Author `src/hidden-skills/groundwork-review/checklists/{product-brief,design-system,architecture,infrastructure,pitch,update}.md` in BMAD's named-failure-mode style (concrete violations, not virtues); `groundwork-review` loads the matching checklist by `document_type` and reports per-item.
*Verify:* review of a seeded-defect draft cites checklist items by name; every committing skill's `document_type` has a checklist file.

**S16 — Implementation-readiness gate (F15).** A readiness check inside `groundwork-bet` between decomposition and delivery: contracts exist for every slice, test scaffolding present, no open discovery-note contradictions, upstream docs current. Fail-closed, checklist-backed (S15 pattern).
*Verify:* simulation transcript shows the gate running before the first slice is implemented; a seeded missing contract blocks delivery with a named finding.

**S17 — User config surface (F17, D5).** `[defaults]` in `.groundwork/config/config.toml` (stack, model provider/model, generator flags). Architecture and scaffold skills read defaults as the proposed starting position — propose, never silently apply.
*Verify:* set a default, run the phase in a sandbox, observe it proposed instead of re-asked; absent config behaves exactly as today.

**S18 — Custom skill registration (F16, D5).** `[skills]` table in config.toml maps intent → instruction path; orchestrator merges it into routing after its built-in table; `init`/`update` never touch user entries.
*Verify:* register a toy skill, invoke through the orchestrator; re-run `update`, entry survives.

**S19 — Brownfield simulation end-to-end (F18).** Run `./dev sandbox --brownfield --simulate` through all five phases in real Claude Code; assess via `./dev sandbox review` + `/judge`; file findings as new slices. Re-run after S14 to observe Adopt/Upgrade live. Closes the standing `TODO.md` gate.
*Verify:* checklist green for durable artifacts; judge report committed under `docs/plans/`; defects triaged into this tracker.

**S20 — CLI and orchestrator tests (F19).** `tests/cli/test_cli.py`: init in scratch dir (files, symlinks, state seed), idempotent re-init, self-copy guard, update preserves config. Orchestrator state-resolution table-tests: reconciliation cases including durable `scan` marker and contract-aware brownfield completion, executed against fixture filesystems.
*Verify:* `./dev test` includes both; reconciliation cases cover add, remove, scan-durability, and contract-failure → Adopt/Upgrade routing.

**S21 — Skill ↔ doc drift check (F20).** Extend `groundwork-check`'s git-based drift logic to declared skill↔doc pairs (orchestrator tables ↔ lifecycle docs, contract ↔ contributor guide). Closes the deferred `TODO.md` item.
*Verify:* mutate a routing table without its lifecycle doc; check flags the pair.

### Band P3 — Reach (start only when P0–P2 are done)

**S22 — Adversarial simulation suites.** Personas: ambiguous, contradictory, terse, mid-flow-reversal. The cooperative suites prove the harness; these probe the skills.
**S23 — Multi-tool support statement.** Document what `.agents/` requires of a host agent and what is verified where; honest support matrix (Claude Code: verified; others: compatible/untested) rather than silence.
**S24 — Dogfood the docs-site generator** to publish `docs/` as GroundWork's site — the BMAD docs-site analog, built with GroundWork's own generator.
**S25 — Examples and showcase.** One harvested greenfield transcript and one brownfield adoption, edited into `docs/examples/`.

---

## 6. Task Tracker

| Slice | Band | Title | Depends on | Status |
|---|---|---|---|---|
| S1 | P0 | Build the update engine | — | ✅ |
| S2 | P0 | Real CLI `update`/`check` | S1 | ✅ |
| S3 | P0 | Resolve `groundwork-persona` | — | ✅ (stays registered; editorial pass to skill-writer standard) |
| S4 | P0 | Refresh product brief | — | ✅ (brief + lifecycle docs; TODO item closed) |
| S5 | P0 | Root README + getting started | docs/product.md (done) | ✅ |
| S6 | P0 | Help surface | — | ✅ |
| S7 | P1 | Semver + changelog + release | S1–S6 | ✅ (publish dry-run pending F21 name decision) |
| S8 | P1 | Version stamping | S7 | ✅ |
| S9 | P1 | Migration notes in update | S2, S8 | ✅ |
| S10 | P1 | SKILL.md frontmatter sweep | — | ✅ |
| S11 | P1 | Review-gate conformance | S1 | ✅ (audit found gates present; wording aligned, review skill routed) |
| S12 | P1 | Discovery-notes conformance | — | ✅ (4 capture/init gaps fixed: product-brief, design-system, infra-adopt, bet 03) |
| S13 | P1 | `./dev lint skills` | S10–S12 | ✅ |
| S14 | P1 | Adopt/Upgrade in extract skills | — | ✅ (F13 was already fixed upstream; added BMAD-artifact interop naming to all three extracts) |
| M1 | P1 | Maturity model + review type | — | ✅ |
| M2 | P1 | Infra-adopt writes maturity.md | M1 | ✅ |
| M3 | P1 | Bet-loop maturity steering | M1 | ✅ |
| M4 | P1 | Continuous maturity assessment | M1, S2 | ✅ |
| S15 | P2 | Shipped checklists | S11 | ☐ |
| S16 | P2 | Implementation-readiness gate | S15 | ☐ |
| S17 | P2 | User config surface | — | ✅ |
| S18 | P2 | Custom skill registration | S17 | ✅ |
| S19 | P2 | Brownfield sim end-to-end | S14 | ☐ |
| S20 | P2 | CLI + orchestrator tests | S2 | ✅ (CLI: 9 tests incl. self-copy guard — which was a real latent bug, fixed. Orchestrator reconciliation is model-executed prose: mechanically covered by lint routing↔fs; behaviorally by sim runs S19/S22) |
| S21 | P2 | Skill ↔ doc drift check | — | ✅ (lint doc-pairs check; closes the TODO deferred item) |
| S22 | P3 | Adversarial suites | S19 | ✅ authored (ambiguous, terse, reversal, scope-creep) — live runs pend S19's human session |
| S23 | P3 | Multi-tool support statement | — | ✅ (docs/host-support.md) |
| S24 | P3 | Dogfood docs site | S5 | ☐ |
| S25 | P3 | Examples & showcase | S19 | 🟡 greenfield half done (docs/examples/greenfield-verse.md, harvested from the real run); brownfield half pends S19 |

**Definition of done for the plan:** every P0–P2 slice verified; `./dev lint skills` and the test suite green in CI; a stranger can go from the README to a delivered first bet without reading this repo's source; and a release exists whose CHANGELOG describes all of it.
