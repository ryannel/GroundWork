# Implementation Plan: Bet Lifecycle Restructure (Milestones, Slices, Tests-as-Proof)

**Status:** COMPLETE — all workstreams A–I shipped (Half 2 closed via the `./dev new bet|milestone|slice` scaffolding and test templates; Docker gate closed via `./dev test scaffolds`). Superseded for further delivery-loop work by `contract-grade-delivery.md`.
**Audience:** An engineer or agent implementing this change. Written to be executed step-by-step without judgment calls — every file path, edit, and acceptance check is explicit.
**Scope owner:** `groundwork-bet` skill, with coupled changes to `groundwork-mvp`, shared templates, eval scenarios, and framework lifecycle docs.

## Current progress

**Half 1 (Workstreams A–D) — COMPLETE.** All methodology-layer changes are shipped and §14 static gates pass.

What was done:
- `src/hidden-skills/groundwork-bet/`: `instructions.md` rewritten (five-phase lifecycle, updated activation routing). Workflows: `01-discovery.md` updated (no milestones), `02-design.md` created (sets `status: decomposition` at transition), `03-decomposition.md` created, `04-delivery.md` renumbered + bet-progress test rollout step, `05-validation.md` renumbered + archive step. Templates: `pitch.md` (no milestones, strengthened No-Gos), `technical-design.md` (Interface Design first, Data Schema added), `tdd-checklist.md` deleted, `decomposition.md` and `bet-progress-test.md` created.
- `src/hidden-skills/groundwork-mvp/`: Phase 3 (Milestone Definition) removed, Quality Standard updated (no milestones, explicit prohibition added), `status: design` handoff, `templates/mvp-cache.md` stripped.
- Workstream C: status flow is now `discovery → design → decomposition → delivery → validation → delivered`. Zero stale references remain.
- Workstream D: `docs/lifecycle/02-delivery-loop.md` rewritten to five phases. `index.md`, `llms.txt`, `01-setup.md`, contributor `SKILL.md` all updated. `06_bet_planning.json` renamed to `06_bet_design.json` and rewritten. `07_bet_decomposition.json` created.
- Eval gate: `06_bet_design` ✅, `07_bet_decomposition` ✅ (19 test files, reviewed PRESENT). `05_mvp` re-run was cut short by credit exhaustion mid-conversation — one more re-run needed to confirm the no-milestones prohibition sticks. Command: `./dev eval run storytelling_engine 05_mvp --workspace-from run_20260528_155659`.

**Half 2 (Workstreams E–I) — NOT STARTED.** Start here. Load `.agents/skills/scaffold-designer/SKILL.md` before editing any generator.

---

## 0. Read this first — the mental model

We are restructuring how a bet moves from concept to proven delivery. The change has one organizing idea:

> **The pitch decides *what* and *why*. The design decides *how*. Milestones and slices decide *the order of work and how we prove it* — and they are derived from an already-locked design, not invented alongside it.**

Today the bet lifecycle is four phases — Discovery → Planning → Delivery → Validation — and **milestones are born in the pitch** (in `groundwork-bet` discovery, and in `groundwork-mvp` Phase 3 for the first bet). Planning then does design *and* test-checklist authoring in one pass.

We are changing it to **five phases**, splitting the overloaded Planning phase and moving milestone definition downstream:

| # | Phase | Workflow file | Status | Primary artifact |
|---|---|---|---|---|
| 1 | Discovery | `01-discovery.md` | `discovery` | `pitch.md` — fat-marker, **no milestones** |
| 2 | Design Foundations | `02-design.md` | `design` | `technical-design.md` — interface design → data flows → API contracts → data schema |
| 3 | Decomposition | `03-decomposition.md` | `decomposition` | `decomposition.md` + runnable bet-progress tests in `tests/bets/<slug>/` |
| 4 | Delivery | `04-delivery.md` | `delivery` | Implementation that turns bet-progress tests green; permanent tests rolled out as slices complete |
| 5 | Validation | `05-validation.md` | `validation` → `delivered` | Validation report; bet-progress suite archived; upstream docs updated |

**This is a SPLIT, not an invention.** Phases 2 and 3 are the current `02-planning.md` cut in half. The design half (data flows, API contracts, screen states, plus the existing review loop and domain-entity reconciliation) becomes Design Foundations. The test-authoring half (milestones, slices, test cases) becomes Decomposition. **Nothing in the current planning workflow gets dropped — every step is reassigned to phase 2 or phase 3 by name in §3 below.**

### The two test populations (this is the heart of the change)

There are **two distinct populations of tests** with different lifecycles. A reader will be tempted to merge them — do not. The overlap is intentional.

| Population | What it is | Where it lives | When written | Lifecycle |
|---|---|---|---|---|
| **Bet-progress tests** | Macro proof-of-work. Big-ticket, user-visible. The single source of truth for "is this milestone/slice done?" Red = work to do, green = proven. This is where the *user* spends review time. | `tests/bets/<slug>/` | **Up front**, during Decomposition (phase 3), before any implementation | **Temporary** — archived to `tests/bets/_archive/<slug>/` when the bet is delivered |
| **Permanent best-practice tests** | Thorough, lasting coverage: interface (UI) tests, HTTP API system tests, honeycomb service-perimeter tests, unit tests for complex logic, contract tests. | Service repos / `tests/system/` | **During** the build, rolled out as each slice completes (phase 4) | **Permanent** — stays in the codebase forever |

**Milestone proof is two complementary layers** (both bet-progress tests):
- **Interface-level tests** — assert what the *user observes* in the product's interface medium. It is not enough for the API to return 200; the user-visible outcome must be proven. The medium is chosen from the project's interface track (see §0.1).
- **API-level system tests** — end-to-end HTTP against the running services. When the interface test goes red, the API test localizes the failure: frontend problem vs API problem. The two complement each other.

**Slice proof tests** are set up front during Decomposition and are *informed by / bounded by* the milestone tests above them — a slice's tests prove the vertical capability that contributes to its parent milestone.

### 0.1 The generic-framework rule — RE-READ AT EVERY TEST STEP

GroundWork builds **any kind of application**. The reference material that inspired this work (`wordloop-platform`'s "How We Work" doc) is saturated with one product's nouns — `test_core`, `test_ml`, `test_app`, GCS, meetings, ML pipelines, `core/ml/app` domains. **None of those may appear in GroundWork's skills or templates.** Every test-authoring instruction in this plan must:

1. **Parameterize test locations by the project's actual services** — discovered from `docs/infrastructure.md` and the generated `docker-compose.yml`, never hardcoded.
2. **Pick the interface-test medium from `docs/design-system.md`'s interface track:**
   - `graphical-ui` → browser-driven UI test
   - `cli` → terminal/PTY-driven test
   - `agentic-protocol` → protocol-transcript test
3. **Never hardcode domain names.** A slice belongs to a service; the service name comes from the project, not from this plan.

Before saving any skill or template edit, apply the contributor check from `.agents/skills/groundwork-contributor/SKILL.md`: *"Does this read as if it was written for any app, or does it betray knowledge of a specific product?"* If a specific domain or product type leaks through, generalize it.

---

## 1. Scope

This plan covers **two layers**, executed in two halves with two different verification stories. Both are in scope.

### Half 1 — Methodology layer (Workstreams A–D)
The skills, workflows, and templates that express the new lifecycle, plus the references that point at them. **Self-contained and fully testable through the eval harness** because the skill writes test files directly to disk; it does not depend on any project CLI existing. The skill **writes bet-progress test files directly** to `tests/bets/<slug>/` (the way today's planning writes Python tests to `docs/bets/<slug>/tdd/`), and **uses the Golden Path CLI commands when they exist** (the agent runs in a generated project that has them), falling back to writing files directly otherwise.

- `groundwork-bet` skill: instructions + 5 workflow files + templates.
- `groundwork-mvp` skill: remove milestone definition; change handoff status.
- Shared templates and the eval scenarios that exercise these skills.

### Half 2 — Generator layer (Workstreams E–I)
The runnable tooling that makes the bet-progress suite real in a *generated user project*. **Verified by the scaffold harness** (`./dev test generation/compilation/scaffolds`), not the eval harness. This half **depends on a real scaffold existing** and ships after Half 1.

- **Workstream E** — `tests/bets/` layout + shared-fixture hoist (extends `system-test-runner`).
- **Workstream F** — Golden Path CLI: `./dev new bet|milestone|slice`, `./dev test bet <slug>`, `./dev archive bet <slug>` (extends `workspace-dev-cli`).
- **Workstream G** — Interface-proof test harness: browser automation (net-new — **there is no Playwright/Cypress/Selenium in the repo today**) plus the cli/agentic-protocol patterns.
- **Workstream H** — scaffold-harness coverage for the new generator output.
- **Workstream I** — framework docs + the generated-project `workspace-cli` skill.

> **Generator decision recorded — single-runner pytest for the bet-progress suite.** All bet-progress tests (interface-level *and* API-level, across all interface mediums) are **pytest** tests, run by one command (`./dev test bet`), reusing the existing service-discovery fixtures. This looks surprising for browser tests ("Python drives the browser"), so the rationale is explicit: bet-progress tests are *temporary, black-box proof scaffolding* the agent writes and archives — they hit a running frontend/CLI/endpoint from the outside, so **runner consistency beats frontend-engineer ergonomics, and language-independence is correct for end-to-end proof.** The *permanent* UI tests (the other population, §0) stay in the project's own frontend stack (e.g. Playwright-TS inside the Next service) and are **not** part of the harness changes here.

**Two layers, kept consistent:** the file paths and naming the skill writes (§2) MUST equal what `./dev new milestone/slice` produce. Workstreams A and F share one layout contract.

### Out of scope
- Permanent best-practice tests' own tooling beyond noting where they live (they use each stack's native test runner, already scaffolded — Vitest for Next, pytest for Python, `go test` for Go).
- Brownfield. This plan is greenfield-path only, matching current capability.

---

## 2. Target artifacts and file layout

After this change, a bet directory looks like:

```
docs/bets/<slug>/
├── pitch.md                 # Phase 1. Fat-marker. NO milestones.
├── technical-design.md      # Phase 2. Interface design → data flows → API contracts → data schema.
└── decomposition.md         # Phase 3. Milestones (ordered, user-visible) + slices (vertical specs) + test plan.

tests/bets/<slug>/           # Phase 3. Runnable bet-progress tests (written red, up front).
├── test_milestone_<n>_<slug>.<ext>   # milestone proof: interface-level + API-level
└── test_slice_<n>_<service>_<slug>.<ext>   # slice proof, bounded by parent milestone

tests/bets/_archive/<slug>/  # Phase 5. Where the suite moves at delivery.
```

`<ext>` is the project's test language (`.py`, `.go`, `.ts`) — discovered from the scaffold, never assumed.

**Relocation note:** bet-progress tests move from today's `docs/bets/<slug>/tdd/` to a runnable `tests/bets/<slug>/`. The `docs/bets/<slug>/tdd/` directory and `tdd/checklist.md` artifact are **retired**.

---

## 3. The partition — every current planning step gets a home

`src/hidden-skills/groundwork-bet/workflows/02-planning.md` has these steps today. Each one is reassigned. **Use this table as the checklist for the split so nothing is lost:**

| Current `02-planning.md` step | Goes to | Notes |
|---|---|---|
| Operating Contract preamble | **Both** 02-design and 03-decomposition | Each workflow keeps the standard contract block. |
| Discovery Notes Check (`## Design Details`) | **02-design** | Design Details feed contracts/schema design. |
| Step 1: Update pitch status → `planning` | **Split**: 02-design sets `design`; 03-decomposition sets `decomposition` | Status renamed (see §6). |
| Step 1.5: Reconcile domain entities (`docs/domain/`) | **02-design** | Domain reconciliation is a design concern. |
| Step 2: Draft Technical Design (data flows, API contracts, design states) | **02-design** | Restructured — lead with Interface Design. See §4.2. |
| Step 2.5: Independent Review of the Technical Design | **02-design** | Review loop unchanged; `document_type: technical-design`. |
| Step 3: Build TDD checklist milestone by milestone | **03-decomposition** | Replaced by milestone/slice/test authoring. See §4.3. |
| Gate — All Phases Required | **03-decomposition** | Rewritten as the decomposition gate. |
| Transition → delivery | **03-decomposition** | Now transitions to `04-delivery.md`. |

---

## 4. Workstream A — `groundwork-bet` skill restructure

> Apply the `skill-writer` skill's standards when editing any of these files (declarative, intent-over-script, expert-peer stance). Apply the `groundwork-writer` reference at every artifact-producing step.

### 4.1 `instructions.md` — lifecycle table, activation, status

File: `src/hidden-skills/groundwork-bet/instructions.md`

1. **Mental Model section (lines ~9–20):** rewrite the four-phase description into five phases. Keep the existing prose style. The new framing: Discovery establishes *what/why* (pitch, fat-marker, no milestones). Design Foundations establishes the *contract* (interface design, data flows, API contracts, data schema). Decomposition establishes *the order of work and the proof* (milestones, slices, bet-progress tests written up front). Delivery turns bet-progress tests green and rolls out permanent tests. Validation confirms and archives.
2. **Lifecycle Overview table (lines ~26–31):** replace with the five-row table from §0 of this plan. Fix the existing bug while here: row 4 currently says `status: complete` but `04-validation.md` actually sets `status: delivered` — use `delivered`.
3. **Activation (lines ~46–55):** the activation check currently reads `status: planning`. Change the routing logic to:
   - A pitch at `status: design` → MVP handoff just completed; read it and proceed directly to `02-design.md`.
   - A pitch at `status: decomposition` → design is done; proceed to `03-decomposition.md`.
   - A pitch at `status: delivery` → proceed to `04-delivery.md`.
   - A pitch at `status: validation` → proceed to `05-validation.md`.
   - No pitch / new feature request → ask for a slug, then `01-discovery.md`.
   - Update the `➡️ Read and follow:` pointers accordingly.

### 4.2 `02-design.md` — Design Foundations (rename of `02-planning.md`)

1. **Rename** `src/hidden-skills/groundwork-bet/workflows/02-planning.md` → `02-design.md`.
2. **Title:** `# Phase 2: Design Foundations (Interface, Data Flows, Contracts, Schema)`.
3. **Goal:** produce the design contract the bet executes against — *before* any decomposition. Lead with what the user sees.
4. **Restrictions block:** keep the "FORBIDDEN from writing implementation code" constraint.
5. **Keep:** Operating Contract block, Discovery Notes Check (`## Design Details`), domain-entity reconciliation (old Step 1.5), the Technical Design draft step, and the independent review loop (old Step 2.5).
6. **Step: Update pitch status** → set `status: design`.
7. **Restructure the Technical Design draft** so its sections are, in order:
   1. **Interface Design** (the user-visible anchor — FIRST). Organized by screen/view/command/interaction, not by feature. For each: layout/regions, states (loading, active, empty, error, degraded), key interactions. Pick terminology by interface track (§0.1): screens for `graphical-ui`, commands/output for `cli`, request/response turns for `agentic-protocol`. This section is what milestone interface-tests will assert against.
   2. **Data Flows** (existing content).
   3. **API Contracts** (existing content).
   4. **Data Schema** (NEW — the template currently lacks this). Tables/collections/stores this bet introduces or changes, key fields, state machines for entities with lifecycle states. Reference `docs/domain/` rather than duplicating it.
8. **Transition:** on approval, set up for phase 3 and `➡️ Read and follow: 03-decomposition.md`.
9. Update the corresponding template — see §4.5.

### 4.3 `03-decomposition.md` — Decomposition (NEW workflow)

Create `src/hidden-skills/groundwork-bet/workflows/03-decomposition.md`. This is the phase the user cares most about. Structure:

1. **Title:** `# Phase 3: Decomposition (Milestones, Slices, Proof of Work)`.
2. **Goal:** with the design locked, break the bet into the order of work and author the tests that prove each step — *fast, agent-led, then reviewed*. The agent proposes the breakdown and writes the tests; the user reviews sequencing and tests. No implementation code.
3. **Operating Contract** block (standard).
4. **Step: Update pitch status** → `decomposition`.
5. **Step — Propose milestones (agent-led, then review):**
   - Read `technical-design.md`. The agent **itself** decomposes the bet into **milestones**: each milestone is a point of **user-visible value** — a demonstrable state in the product's interface, ordered by integration value. The first milestone is the simplest end-to-end flow that proves the architecture works; later milestones add richness.
   - **Constraints (state these in the workflow):** milestones are ordered by integration value; each is independently shippable (a user gets value from milestone 1 even if milestone 2 never ships); dependencies flow forward only; **never** horizontal ("build all the tables" is not a milestone). 2–5 milestones is the healthy range.
   - Present the milestone list and **sequencing rationale** to the user for review. The review focus is **ordering + that each milestone names user-visible value** — not implementation detail.
6. **Step — Author milestone bet-progress tests (up front, red):**
   - For each approved milestone, write its proof to `tests/bets/<slug>/test_milestone_<n>_<slug>.<ext>`. Two complementary layers (§0): **interface-level** (assert the user-visible outcome in the project's interface medium) **and** **API-level system** (end-to-end HTTP). Tests describe the *target state* and are **red** because the implementation does not exist yet.
   - Test locations and language come from the scaffold (§0.1) — never hardcoded.
   - **Use the Golden Path CLI when present.** If `./dev new milestone <bet> <slug>` exists in the project (Workstream F), run it to scaffold the stub at the correct path, then fill it in. If it does not exist (e.g. the eval sandbox), write the file directly to `tests/bets/<slug>/`. Either way the path and naming are identical (§2).
7. **Step — Decompose milestones into slices:**
   - For each milestone, the agent breaks it into **vertical slices** — the smallest independently buildable and testable units. A slice may cross services (e.g. a full path through several services) or sit within one service, but it must be **independently deployable and verifiable**. **Never slice horizontally** (no "all schemas, then all APIs, then all UI").
   - **The vertical-slice test:** *can this slice be deployed and verified without any future slice existing?* If yes, vertical. If it needs a downstream slice to be useful, it is too thin or horizontal.
   - Each slice spec contains: owner/service, complexity (S/M/L), prerequisite (exact prior merge gate), a one-paragraph intro linking it to its milestone, **Required Capabilities** (falsifiable behaviour statements, each tracing to a contract/schema in `technical-design.md`), and a **Test Cases** table (`Test | Location | Assertion`) with specific falsifiable assertions.
8. **Step — Author slice bet-progress tests (up front, red):**
   - For each slice, write `tests/bets/<slug>/test_slice_<n>_<service>_<slug>.<ext>`. Slice tests are **informed by / bounded by** the parent milestone's tests — they prove the vertical capability that contributes to that milestone. Red, target-state, system-level.
9. **Step — Write `decomposition.md`:** the human-readable, reviewed artifact at `docs/bets/<slug>/decomposition.md`. Contains: the ordered milestone map (goal = user-visible value, sequencing rationale, acceptance criteria, links to milestone test files), and under each milestone its slices (vertical specs + Test Cases tables linking to slice test files). Apply `groundwork-writer`.
10. **Step — Independent review (focus: sequencing + tests):** invoke the review subagent with `document_path: docs/bets/<slug>/decomposition.md` and `document_type: decomposition`. The review verifies the document-chain integrity (§4.6): milestones trace to the pitch's value and the design; slices are vertical not horizontal; slice capabilities trace to contracts/schemas; test cases trace to milestone acceptance criteria. Revise on 🔴 Critical until `PRESENT`; carry 🟡 Advisory forward.
11. **Decomposition Gate (rewrite of the old gate):** before transition, verify — every milestone has a user-visible goal and a milestone test file; every slice is vertical, has falsifiable capabilities, and a slice test file; every bet-progress test is red (fails because implementation is absent); `decomposition.md` is complete. A partial decomposition is not Proof of Work.
12. **Transition:** present the milestone map + the red bet-progress suite as Proof of Work; on approval `➡️ Read and follow: 04-delivery.md`.

### 4.4 `04-delivery.md` and `05-validation.md` — renumber + augment

1. **Rename** `03-delivery.md` → `04-delivery.md`. Update its internal transition pointer to `05-validation.md`. Add a step: **as each slice's bet-progress tests go green, roll out the permanent best-practice tests** for that slice (interface, API system, honeycomb service-perimeter, unit for complex logic) per the project's testing strategy — these live in the service repos / `tests/system/`, not in `tests/bets/`. Keep the contract-enforcement and no-large-refactors constraints.
2. **Rename** `04-validation.md` → `05-validation.md`. Add a step (after the test suite passes): **archive the bet-progress suite** — move `tests/bets/<slug>/` → `tests/bets/_archive/<slug>/`. State that the permanent tests remain in place and are what cover the feature going forward. Keep the Living Documents scan, discovery-notes update, ADR step, and the deep-output quality standard. Update status steps: this workflow sets `status: validation` then `status: delivered`.

### 4.5 Templates

Directory: `src/hidden-skills/groundwork-bet/templates/`

1. **`pitch.md`:** **remove the `## Milestones` section** (lines ~22–31). The pitch is now fat-marker only: Problem, Appetite, Solution sketch, Success Signal, Rabbit Holes, No-Gos. Strengthen No-Gos guidance to include *natural extensions users would expect but that are excluded*. `status: discovery` stays.
2. **`technical-design.md`:** reorder/extend sections to: **Interface Design** (new, first) → Data Flows → API Contracts → **Data Schema** (new). Use interface-track-neutral language; do not assume screens.
3. **Retire `tdd-checklist.md`.** Replace with **`decomposition.md`** template: milestone map (per milestone: user-visible goal, "why this comes now" sequencing rationale, acceptance criteria, milestone test file links) + per-milestone slice specs (the six-part slice anatomy + Test Cases table). Add a short **Test Plan** header explaining the two populations and that bet-progress tests are written red, up front, and archived at delivery.
4. **New `bet-progress-test.md`** template (language-neutral guidance, not code): how to write a milestone test (interface layer + API layer) and a slice test (bounded by parent milestone), the target-state principle ("write the test as if the feature exists"), system-level only (no importing app code, no mocks), and the file-naming convention from §2.

### 4.6 Document-chain integrity (the review backbone)

Add a short **Document Chain Integrity** subsection to `03-decomposition.md` (and reference it from the review). Generalized from the reference — each artifact consumes upstream and produces for downstream:

| Document | Upstream check | Downstream check |
|---|---|---|
| Pitch | Solves the stated problem within appetite | Design covers the pitched solution |
| Technical Design | Every interface element/flow traces to the pitch | Milestones can be derived from it |
| Milestones | Each goal is user-visible value traceable to the design | Every slice belongs to exactly one milestone |
| Slices | Capabilities trace to contracts/schemas | Test cases trace to milestone acceptance criteria |

---

## 5. Workstream B — `groundwork-mvp` coupling

File: `src/hidden-skills/groundwork-mvp/instructions.md` (+ `templates/mvp-cache.md`)

The MVP skill produces the first bet's pitch and **currently also defines 2–4 milestones** (Phase 3, lines ~99–110) and uses them to surface slices. Under the new model the pitch is fat-marker and milestones are produced later by `03-decomposition.md`. Changes:

1. **Remove Phase 3 "Milestone Definition"** (lines ~99–110) and the `## Milestones` blocks from the embedded pitch examples (lines ~128+, ~163+). The MVP still chooses the starting scope and writes the fat-marker pitch (Problem, Appetite, Solution sketch, Success Signal, Rabbit Holes, No-Gos).
2. **Change the handoff status** (line ~187): set the pitch to `status: design` (not `status: planning`). Update the explanatory text and the orchestrator-handoff note (line ~217) so the bet picks up at `status: design` and routes into `02-design.md`.
3. **Update `templates/mvp-cache.md`:** remove the `## Milestone Definition` section (line ~11).
4. **Hand-off file note (line ~203):** keep capturing user instincts about *sequencing* — but those instincts now feed Decomposition (phase 3), not the pitch. Adjust the wording.
5. Re-check the MVP scenario `user_goal`s (§7) for milestone references.

---

## 6. Workstream C — status string migration

The status flow changes from `discovery → planning → delivery → validation → delivered` to:

```
discovery → design → decomposition → delivery → validation → delivered
```

**Enumerate every site BEFORE editing** (do not edit blind):

```bash
cd /Users/ryannel/Workspace/groundWork
grep -rn "status: planning\|status: discovery\|status: design\|status: decomposition\|status: delivery\|status: validation\|status: delivered\|status: complete" src/ tests/ docs/
```

Known sites to update (verify against the grep):
- `src/hidden-skills/groundwork-bet/instructions.md` — activation check (`planning`), lifecycle table (`complete`→`delivered`).
- `src/hidden-skills/groundwork-bet/workflows/02-design.md` — sets `design` (was `planning`).
- `src/hidden-skills/groundwork-bet/workflows/03-decomposition.md` — sets `decomposition` (new).
- `src/hidden-skills/groundwork-bet/workflows/04-delivery.md` — sets `delivery` (unchanged value, file renamed).
- `src/hidden-skills/groundwork-bet/workflows/05-validation.md` — sets `validation` then `delivered`.
- `src/hidden-skills/groundwork-mvp/instructions.md` — handoff sets `design` (was `planning`).

---

## 7. Workstream D — reference propagation (the #1 source of breakage)

Renaming workflow files, adding `03-decomposition.md`, retiring `tdd/checklist.md`, and renaming statuses scatter references across the repo. **Enumerate, then fix.** Run these greps and fix every hit:

```bash
cd /Users/ryannel/Workspace/groundWork
# old workflow filenames + transition pointers
grep -rn "02-planning\|03-delivery\.md\|04-validation\.md\|workflows/0" src/ docs/ tests/ llms.txt
# retired artifact paths
grep -rn "tdd/checklist\|/tdd/\|tdd-checklist" src/ docs/ tests/ llms.txt
# the doc artifact name change (technical-design stays; decomposition is new)
grep -rn "technical-design\|decomposition\.md" src/ docs/ tests/ llms.txt
```

Specific known sites:

1. **Internal workflow transitions** — each workflow's `➡️ Read and follow:` pointer (01→02→03→04→05).
2. **Eval scenario `06_bet_planning.json`** (`tests/evals/scenarios/storytelling_engine/`): currently pins `success_files: [docs/bets/core-story-loop/technical-design.md, docs/bets/core-story-loop/tdd/checklist.md]`, references "5 Epics", and expects pickup at `status: planning`. Rewrite/split it:
   - Update the pickup status to `design`.
   - Split into a **design scenario** (success file `docs/bets/core-story-loop/technical-design.md`) and a **decomposition scenario** (`depends_on` the design scenario; success files `docs/bets/core-story-loop/decomposition.md` and at least one `tests/bets/core-story-loop/test_milestone_*` file).
   - Rewrite the `user_goal` to match the new two-phase flow (approve design first; then approve milestones + review the red bet-progress tests). Remove the "TDD checklist / Service Slices" language; replace with milestone-map + bet-progress-tests language. The user still withholds "Looks great, please commit it" until the full set is presented.
3. **MVP eval scenarios** (`05_mvp.json` in `storytelling_engine`, `ai_agent_tool`, `developer_cli`, `b2b_saas`): `success_files` is just `docs/bets/<slug>/pitch.md` so file-existence still passes, but check each `user_goal` for milestone references and remove them (the MVP pitch no longer contains milestones). Confirm none assert `status: planning`.
4. **Framework lifecycle docs:** `docs/lifecycle/02-delivery-loop.md`, `docs/lifecycle/index.md`, `docs/lifecycle/01-setup.md`, and `llms.txt` — update any description of the bet phases, the four-phase lifecycle, or milestones-in-the-pitch. `docs/product-brief.md` (GroundWork's own) — check for lifecycle claims.
5. **Contributor skill** `.agents/skills/groundwork-contributor/SKILL.md` — the lifecycle table (line ~88) lists "Delivery Loop" generically; verify nothing names the old four phases.

---

## 8. Workstream E — `tests/bets/` layout + shared-fixture hoist (`system-test-runner`)

> Half 2 begins here. Load `.agents/skills/scaffold-designer/SKILL.md` before editing any generator. Generator files are EJS templates (`<%= var %>`, `<% if (cond) { %>`), `.template` stripped on emit, `tmpl: ''` passed to disable Nx's own interpretation.

Directory: `src/generators/system-test-runner/`

The generator currently writes `tests/pyproject.toml` (testpaths `["system"]`) + `tests/system/conftest.py` + `tests/system/test_system.py`. The bet-progress suite needs to live at `tests/bets/<slug>/` and **reuse the same service-discovery and state-reset fixtures**. So the fixtures move up one level to a shared `tests/conftest.py`.

1. **Hoist shared fixtures** from `files/tests/system/conftest.py.template` to a NEW `files/tests/conftest.py.template`: move the module constants (`WORKSPACE_ROOT`, `COMPOSE_PATH`, `SERVICES_DIR`, `PG_*`, `JAEGER_URL`, `REQUIRE_SERVICES`), the helpers (`_infer_type`, `_health_path_for`, `_discover_services`, `_base_url`), and the fixtures (`services_manifest`, `cluster`, `trace_id`, `api_client`, `pure_state_reset`).
   - **Path fix:** the file is now at `tests/conftest.py`, one level up from `tests/system/`. Change `WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent` → `...parent.parent` (drop one `.parent`).
2. **CRITICAL regression mitigation — do not skip.** `files/tests/system/test_system.py.template` does `from conftest import JAEGER_URL, _base_url, _discover_services`. After the hoist that name no longer lives in `tests/system/conftest.py`. Pytest inserts the rootdir on `sys.path`, so the parent `tests/conftest.py` is importable — but verify it. Keep a **thin shim** at `files/tests/system/conftest.py.template`:
   ```python
   # Re-export shared fixtures so tests/system keeps working after the hoist.
   from conftest import *  # noqa: F401,F403
   from conftest import JAEGER_URL, _base_url, _discover_services  # noqa: F401
   ```
   Prefer the shim over rewriting `test_system.py`'s import — less churn, and any other `from conftest import` in the system suite keeps resolving. **Acceptance gate (§15): `./dev test integration` still green after the hoist.**
   - Note: `pure_state_reset` is `autouse` — it now also runs before every **bet** test, truncating each discovered service's tables. This is intended (bet tests want clean state) but state it so it isn't a surprise during debugging.
3. **Create the bet dirs** so a fresh scaffold has them: `files/tests/bets/.gitkeep` and `files/tests/bets/_archive/.gitkeep`.
4. **Testpaths:** in `files/tests/pyproject.toml.template`, change `testpaths = ["system"]` → `testpaths = ["system", "bets"]`.
5. **Generator option** (shared with Workstream G): add `interfaceMedium` to `generator.ts` `SystemTestRunnerGeneratorSchema` and `schema.json` — enum `'graphical-ui' | 'cli' | 'agentic-protocol'`, default `'graphical-ui'`. Pass it into `generateFiles` options. Used by G to conditionally include browser deps.

---

## 9. Workstream F — Golden Path CLI commands (`workspace-dev-cli`)

Directory: `src/generators/workspace-dev-cli/files/`

The `./dev` CLI dispatches `cmd_<verb>` from sourced `scripts/cli/*.sh` modules (`dev.template` lines 71–83). Add a bet-workflow module and extend the test command. **The paths and naming below MUST match Workstream A / §2 exactly.**

1. **New module `scripts/cli/bet.sh.template`** with two functions:
   - **`cmd_new()`** — dispatch on the noun in `$1`:
     - `bet <slug>` (`$2`=slug): validate `$2` is lowercase kebab-case; `mkdir -p docs/bets/<slug>` and `tests/bets/<slug>` (idempotent); print success.
     - `milestone <bet-slug> <milestone-slug>` (`$2`,`$3`): compute `N` = (count of existing `tests/bets/<bet-slug>/test_milestone_*` files) + 1; copy `scripts/cli/templates/milestone-test.pytmpl` → `tests/bets/<bet-slug>/test_milestone_${N}_<milestone-slug>.py`; `sed`-substitute tokens (step 4).
     - `slice <bet-slug> <milestone-slug> <service> <slice-slug>` (`$2`–`$5`): compute `N` similarly for `test_slice_*`; copy `slice-test.pytmpl` → `tests/bets/<bet-slug>/test_slice_${N}_<service>_<slice-slug>.py`; `sed`-substitute.
     - Use `_ui.sh` helpers (`print_logo`, `print_step`, `print_success`, `fail`). `fail` with usage text on missing args.
   - **`cmd_archive()`** — dispatch on `$1`: `bet <slug>` → `mkdir -p tests/bets/_archive` then `git mv tests/bets/<slug> tests/bets/_archive/<slug>` (fall back to `mv` if not a git repo). Guard if already archived.
2. **Extend `cmd_test()`** in `scripts/cli/quality.sh.template` with a `bet` mode. Current `cmd_test` reads `MODE="$1"` and branches on `integration`. Add: if `MODE == "bet"`, take `SLUG="$2"`; default runs against the **already-running stack** (fast inner loop): `cd "$ROOT_DIR/tests" && uv run pytest "bets/$SLUG/"`. With `--integration` flag, boot + migrate + `GROUNDWORK_REQUIRE_SERVICES=1` then run, mirroring the existing integration branch. This matches the existing default-vs-integration split — fast red→green locally, fail-loud in CI.
3. **Register** in `dev.template`: add `source "${ROOT_DIR}/scripts/cli/bet.sh"` alongside the other `source` lines (after line 73). In `show_help()` add a category:
   ```
   print_category "BET WORKFLOW"
   print_cmd "new" "Scaffold bet/milestone/slice + red test stubs"
   print_cmd "test bet" "Run a bet's progress suite (--integration to boot)"
   print_cmd "archive" "Archive a delivered bet's progress suite"
   ```
4. **Stub templates** under `scripts/cli/templates/` (new dir; `generateFiles` copies recursively): `milestone-test.pytmpl.template` and `slice-test.pytmpl.template`. Constraints:
   - Use **`@@SLUG@@`, `@@MILESTONE@@`, `@@SERVICE@@`, `@@N@@` placeholder tokens — NOT EJS `<%= %>`** — so Nx leaves them verbatim at generation time and the CLI does runtime `sed` substitution.
   - `.pytmpl` extension (follow the repo's `.template`-strip convention so the emitted file is `*.pytmpl`) so **pytest never collects the template itself**.
   - Content: a docstring naming the milestone/slice and its parent, a **red** placeholder (`def test_<name>_pending(): pytest.fail("bet-progress test not yet implemented")`), and commented scaffolding showing the two layers — an interface-level test (uses the `page` fixture for graphical-ui / `subprocess` for cli) and an API-level test (uses the shared `api_client` + `cluster` fixtures from `tests/conftest.py`). No imports beyond `pytest`; shared fixtures come from the parent conftest automatically.
5. **generator.ts:** no schema change needed (commands are static). Confirm `generateFiles` recurses into `scripts/cli/templates/`.

---

## 10. Workstream G — Interface-proof test harness (`system-test-runner` + scaffold skill)

This delivers the **net-new** browser capability and specifies the cli/agentic patterns. It builds on the `interfaceMedium` option added in Workstream E.

1. **Conditional browser dependency.** In `files/tests/pyproject.toml.template`, gate the browser dep on the medium:
   ```
   <% if (interfaceMedium === 'graphical-ui') { %>    "pytest-playwright>=0.5",
   <% } %>
   ```
   `pytest-playwright` provides the `page` fixture automatically. **Do NOT** add `playwright install` (browser binaries) to generation or to the compilation test layer — `uv sync` only needs the package importable. Binaries install on demand: add a guard in `cmd_test`'s bet/integration path that runs `playwright install chromium` once if a browser test is present (or document it as a `./dev doctor` check). Keep `playwright install` out of `./dev test compilation` (§15).
2. **Frontend base-URL fixture.** In the shared `tests/conftest.py` (Workstream E), add a `frontend_base_url` fixture that filters `_discover_services()` for `type == "next"` and returns `http://localhost:<host_port>`. Graphical-ui interface tests point the `page` at this. Skip/parametrize cleanly when no `next` service exists.
3. **Scaffold skill wiring.** Update `src/hidden-skills/groundwork-scaffold/` where it invokes the `system-test-runner` generator: pass `interfaceMedium` read from `docs/design-system.md`'s interface track (graphical-ui / cli / agentic-protocol). This is the single point that decides whether browser tooling ships.
4. **cli + agentic-protocol patterns — specify, don't fully build.** These interface proofs drive the entrypoint directly: a pytest test that spawns the CLI binary via `subprocess`/`pexpect` (cli), or sends a protocol request to the running endpoint (agentic-protocol). They do **not** use the `cluster` / `_discover_services` fixtures, which assume an HTTP service answering `/health`.
   - **Known gap — flag it, don't paper over it.** The shared discovery/cluster fixtures are HTTP-centric. The API-level layer of milestone proof still works for any product with an HTTP API. But there is **no shared fixture for driving a CLI binary or a protocol endpoint** yet — the skill writes those tests against bare `subprocess`/HTTP. Genericity claim, stated honestly: **browser is supported concretely now; cli/agentic interface proofs are pattern-only with a known fixture gap.** Building those fixtures is open question #3.

---

## 11. Workstream H — Scaffold-harness coverage

Directory: `tests/scaffolds/`

1. **`test_generation.py`** — assert the new generated files exist and the omissions are correct:
   - Present: `tests/conftest.py`, `tests/system/conftest.py` (shim), `tests/bets/.gitkeep`, `tests/bets/_archive/.gitkeep`, `scripts/cli/bet.sh`, `scripts/cli/templates/milestone-test.pytmpl`, `scripts/cli/templates/slice-test.pytmpl`.
   - `tests/pyproject.toml` testpaths include `bets`.
   - **Conditional:** with `interfaceMedium='graphical-ui'`, `tests/pyproject.toml` contains `pytest-playwright`; with `cli`/`agentic-protocol`, it does **not**. Add option combinations to the generation matrix.
2. **`test_compilation.py`** — confirm `uv sync` at `tests/` still resolves with the new (possibly browser) deps. **Do not** add `playwright install`.
3. **`test_scaffolds.py`** (optional, Docker, slow) — smoke step: `./dev new bet smoke && ./dev new milestone smoke first`, assert `tests/bets/smoke/test_milestone_1_first.py` exists and is **collected red** by `./dev test bet smoke` against a booted stack. Mark slow; gate behind the existing Docker requirement.

---

## 12. Workstream I — Framework docs + generated-project skill

1. **`src/generators/workspace-dev-cli/files/.agents/skills/workspace-cli/SKILL.md.template`** — document the new commands so the agent **in a generated project** knows the workflow exists: `./dev new bet|milestone|slice`, `./dev test bet <slug>` (default vs `--integration`), `./dev archive bet <slug>`, the `tests/bets/<slug>/` layout, and the two test populations (§0). This is the bridge that lets Workstream A's "use the CLI when present" actually fire.
2. **Framework lifecycle docs** — `docs/lifecycle/02-delivery-loop.md` and `docs/lifecycle/index.md`: document the five-phase bet lifecycle, the two test populations, and the bet-progress CLI surface as user-facing capability. Update `llms.txt` index entries.
3. **`groundwork-scaffold` skill / `infrastructure.md` output** — add the bet-progress CLI commands to the generated run-commands section so they are discoverable in the project's own docs.

---

## 13. Execution order — two halves

**Half 1 (Workstreams A–D) ships first and stands alone.** It is verified by the eval harness with no generated project. Load `.agents/skills/skill-writer/SKILL.md`.

1. A.5 templates → 2. A.2 `02-design.md` → 3. A.3 `03-decomposition.md` → 4. A.4 renumber `04`/`05` → 5. A.1 `instructions.md` → 6. Workstream B (`groundwork-mvp`) → 7. Workstream C (status migration) → 8. Workstream D (reference propagation, eval scenarios) → 9. **Verification Part 1 (§14).**

**Half 2 (Workstreams E–I) requires a real scaffold** and is verified by the scaffold harness. Load `.agents/skills/scaffold-designer/SKILL.md` (CLAUDE.md routes generator work there).

10. Workstream E (layout + fixture hoist) → 11. Workstream F (CLI) → 12. Workstream G (browser harness + patterns) → 13. Workstream H (scaffold tests) → 14. Workstream I (docs) → 15. **Verification Part 2 (§15).**

The halves share one contract: the `tests/bets/<slug>/` paths and test-file names the skill writes (A/§2) must equal what `./dev new` produces (F). Check them against each other before declaring Half 2 done.

---

## 14. Verification — Part 1: methodology layer (Workstreams A–D)

**Static checks (must all pass):**
- `grep -rn "02-planning\|03-delivery\.md\|04-validation\.md\|tdd/checklist\|tdd-checklist\|status: planning\|status: complete" src/ docs/ tests/ llms.txt` returns **zero hits**.
- Every workflow's `➡️ Read and follow:` pointer resolves to a file that exists.
- `src/hidden-skills/groundwork-bet/workflows/` contains exactly: `01-discovery.md`, `02-design.md`, `03-decomposition.md`, `04-delivery.md`, `05-validation.md`.
- No product-specific nouns: `grep -rni "test_core\|test_ml\|test_app\|core/ml/app" src/hidden-skills/` returns zero.

**Eval checks (the acceptance gate for Half 1):**
- `./dev eval run storytelling_engine 05_mvp` — fat-marker `pitch.md`, **no milestones**, `status: design`.
- design scenario — `docs/bets/core-story-loop/technical-design.md` leads with Interface Design, includes Data Schema.
- decomposition scenario — `docs/bets/core-story-loop/decomposition.md` (milestones + slices) and ≥1 red bet-progress test under `tests/bets/core-story-loop/`.
- Repeat the MVP scenario on `developer_cli` (CLI) and `ai_agent_tool` (agentic-protocol) — confirm no browser assumption leaks into a non-graphical project.

**Turn budgets:** splitting planning into two phases may raise the turn count. If a scenario hits the ceiling, raise its `turns` (capped at `ABSOLUTE_MAX_TURNS`, currently 65).

---

## 15. Verification — Part 2: generator layer (Workstreams E–I)

Run the scaffold harness (cheapest-first):

- `./dev test generation` — all Workstream H assertions pass; conditional browser dep correct; testpaths include `bets`.
- `./dev test compilation` — `uv sync` resolves at `tests/`; **no `playwright install` in this layer**.
- **CRITICAL regression gate:** `./dev test integration` (the existing system suite) is **still green after the conftest hoist** — proves the shim/import (Workstream E.2) didn't break `from conftest import ...`. If this is red, the hoist regressed the system suite; fix before proceeding.
- `./dev test scaffolds` (optional, Docker) — `./dev new` + `./dev test bet` smoke (Workstream H.3).

**Cross-half consistency check:** generate a scaffold, then confirm a path the bet skill would write (e.g. `tests/bets/<slug>/test_milestone_1_<slug>.py`) is byte-for-byte the path `./dev new milestone <slug> <m>` produces.

---

## 16. Open questions (resolve during execution, flag if blocking)

1. **Slice spec granularity** — one `decomposition.md` holding all slices (chosen, fewer files for review) vs per-slice files under `docs/bets/<slug>/slices/`. Default to the single doc; revisit if a real decomposition gets unwieldy.
2. **Permanent-test rollout depth in Delivery** — this plan states the *intent* (roll out interface/API/honeycomb/unit as slices complete). The exact per-slice completion gate can be added to `04-delivery.md` as a refinement once the spine is in place.
3. **cli/agentic interface fixtures (known gap, Workstream G.4)** — browser is supported concretely; CLI/protocol interface proofs are pattern-only with no shared fixture. Decide whether to schedule a follow-up adding subprocess/PTY (cli) and protocol-client (agentic) fixtures to `tests/conftest.py`.
4. **Generator option naming** — `interfaceMedium` enum (chosen — future-proofs cli/agentic harness off one option) vs `includeBrowserTests` boolean (simpler). Defaulted to the enum.
```
