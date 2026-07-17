# Implementation Plan: Methodology-Twin Brownfield Adoption (Convergence, not a Parallel Stack)

**Status:** EXECUTED 2026-07-17 — all workstreams A–J landed on this branch, `./dev ci` green. Owed: the two driver-gated live proofs (§11) — a `methodology_twin` sim run and the acceptance run on the motivating local repo, each finding M1–M6 observed closed there.
**Audience:** An engineer or agent implementing or extending the brownfield convergence track. Each workstream names its files and acceptance check.
**Scope owner:** `groundwork-scan`, `groundwork-orchestrator`, the three extract skills, the new `groundwork-methodology-adopt` hidden skill, `bin/groundwork.js`, `lib/repo-map/`, and the sim harness — with coupled changes to `groundwork-infra-adopt`, `scripts/lint_skills.py`, and the lifecycle docs.

---

## 0. Read this first — the mental model

A brownfield repo can arrive already running its **own** delivery methodology: its own work-unit doc trees with lifecycle status, its own progress-test suites gated on unshipped work, its own scaffolder CLI, its own skill ecosystem with a sync pipeline, its own agent routing files, its doc canon possibly in a submodule. Running `init` + the brownfield track on such a repo today is file-safe but produces a **second parallel methodology** beside the incumbent one — two scaffolders, two canons, two routing entry points, and skills two pipelines fight over.

The fix is **not** a catalogue of incumbent formats with converters for each. Incumbent methodologies come in unbounded forms, and any signature list is stale the day it ships. Instead the track gives the agent four things:

1. **The goal** — setup ends with one clean, sane way of working: one entry point, one scaffolder, one proof-harness convention, one canonical doc home, in-flight work never fractured.
2. **The context** — GroundWork's target operating model, and why a parallel stack is the failure mode.
3. **A structured exploration** — the scan inventories the incumbent way of working along fixed dimensions, answered with evidence, producing a first-class findings artifact.
4. **The freedom to plan** — a convergence phase where the agent authors the migration plan itself (dispositions per incumbent element, sequenced at work-unit boundaries), the owner sanctions it in one structured-ruling pass, and only the sanctioned rows are ever executed.

Everything before the convergence phase stays additive (`groundwork-infra-adopt`'s rules are unchanged). The convergence phase is the single place convert/retire authority lives, and it is granted per-plan by the owner, never assumed.

---

## 1. Findings this plan responds to

| ID | Finding | Where verified |
|---|---|---|
| M1 | Project-type detection is binary (greenfield/brownfield); no state for "brownfield with an incumbent delivery methodology", and the scan never inventories the way of working | `groundwork-orchestrator/SKILL.md` Project Type Detection; `groundwork-scan/instructions.md` |
| M2 | Adopt/Upgrade sees only canonical root paths; incumbent canon in another tree or a docs-site submodule is invisible, so extracts derive fresh root docs beside it | Extract skills' Step 1 mode detection; orchestrator Adopt/Upgrade Mode |
| M3 | In-flight foreign work units are invisible to Work Intake, which reads only `docs/bets/<slug>/pitch.md` frontmatter; no path for finishing/freezing them in native format | Orchestrator *User requests work* |
| M4 | The additive guarantees deny migration freedom: no skill holds sanctioned, owner-approved authority to convert or retire incumbent methodology artifacts | `groundwork-infra-adopt/instructions.md` two absolute rules |
| M5 | init/repo-map/Serena are submodule-blind: no `.gitmodules` awareness at setup time (delivery already models submodule topology in `workflows/delivery/topologies.md`) | `bin/groundwork.js` `getPaths`/`initGroundWork`; `lib/repo-map/index.js` file discovery |
| M6 | Routing/skill-pipeline collisions unhandled: init correctly refuses to overwrite a real `AGENTS.md` but nothing merges orchestrator routing in, and nothing detects a repo-owned skill-sync pipeline that will fight installed skills | `bin/groundwork.js` `linkOne` / `installRegisteredSkills` |

The acceptance instance for all six is a real local repo (a monorepo with five submodules including a docs-canon submodule and a skill-factory submodule, a bash `./dev` bet scaffolder, skip-gated bet-progress pytest suites, its own agent handbook routing, and one bet mid-milestone). Per the Sandbox Problem rule it calibrates fixtures and the live proof only — nothing in skill prose may reflect its specific shape.

---

## 2. Workstream A — Scan: Ways-of-Working Inventory (M1, M2 groundwork, M3 groundwork)

Files: `src/hidden-skills/groundwork-scan/instructions.md`, `references/digest-schema.md`, new `templates/methodology-findings.md`, `templates/overview.md`.

- **A1 — Stage 1.6.** New autonomous stage between the structural map and scope confirmation: explore the repo's way of working along six dimensions (how work is defined and decided; how progress is proven; what process automation the team owns; how agents and humans are guided in; where canonical knowledge lives, including submodules; what is in flight and how its progress is actually computed). Questions answered with evidence paths, never signature matching. Verdict `incumbent`/`none` framed as a judgment call against the collision goal. Findings to `.groundwork/cache/scan/methodology-findings.md` from the new template. *Accept:* stage present; verdict rule references no named product or format.
- **A2 — Cheap signals.** Stage 1 classification includes `.gitmodules` among the structure signals; repo shape includes submodule topology. *Accept:* one integrated line, no new section.
- **A3 — Scope confirmation.** Stage 2 confirms a third thing when the verdict is `incumbent`, in owner language: what was found and that setup will end with a convergence phase. *Accept:* the "exactly two things" framing rewritten in place.
- **A4 — Findings routing.** Findings Layout row for `methodology-findings.md` → consumer `groundwork-methodology-adopt`; digest schema gains optional `ways_of_working` field routed there; `templates/overview.md` gains the canon-location note all three extracts share. *Accept:* Protocol 7 single-consumer discipline holds.
- **A5 — State verdict.** Stage 5 writes `methodology: "incumbent" | "none"` to `state.json` beside the `scan` marker. Writers/readers: written only by scan; read by the orchestrator and `groundwork-methodology-adopt`. *Accept:* identifier listed here and in the orchestrator durable-marker rule.

## 3. Workstream B — Orchestrator routing (M1, M3)

File: `src/skills/groundwork-orchestrator/SKILL.md` (+ `npm run gen:workflow-index`).

- **B1** — Durable-markers paragraph covers `methodology` (scan-derived, never reconciled from files).
- **B2** — Adopt/Upgrade Mode: existing canon may live outside `docs/` (recorded in `scan/overview.md`); extracts ingest from there, output still lands canonical.
- **B3** — Brownfield Setup Phases: intro sentence + conditional row `5 | Methodology Convergence | groundwork-methodology-adopt` (exists only when `methodology: "incumbent"`; completion = durable `methodology-adopt` marker).
- **B4** — Work Intake: before convergence completes, work belonging to an in-flight incumbent unit continues in the incumbent's own system; after convergence, a finish-native unit is an open `docs/maturity.md` row and continues natively until it closes.
- **B5** — Skill Paths row for the new skill; workflow-index regenerated.

*Accept:* `./dev lint skills` routing check green; additions stay within the registered-skill budget (sentences, not sections).

## 4. Workstream C — Extracts ingest canon wherever it lives (M2)

Files: the three extract skills' Step 1 + Ingest stages. When `scan/overview.md` records incumbent canon elsewhere (another directory, a docs-site tree, a submodule), enter Adopt/Upgrade with it as primary source; output still lands at the canonical path. *Accept:* a few integrated lines per skill; no new sections; mirrors the existing "authored under another framework" posture.

## 5. Workstream D — `groundwork-methodology-adopt` (M4, M6, M3)

New hidden skill: `instructions.md` (mental model → end-state properties → operating contract → Phase 1 Absorb & Explore → Phase 2 Convergence Map with one Protocol 13 sanction pass → Phase 3 Execute, driver/worker, one unit one commit, at work-unit boundaries → Phase 4 Prove & Close with ADR + maturity rows + durable marker), `briefs/convergence-worker.md` (tight worker contract, `reconcile-worker` report vocabulary), `templates/convergence-map.md` (disposition table + in-flight register). Dispositions: corresponds / converts / retires / keeps. Consistency edits in `groundwork-infra-adopt`: the authority cross-reference sentence in the two-rules block, and the teardown preserve clause for `scan/methodology-findings.md`.

*Accept:* lint green (frontmatter, contract ref, review gate, writer ref, routing); no incumbent-format catalogue anywhere in the tree — workers receive target forms by pointer to live canon.

## 6. Workstream E — Lint wiring

`scripts/lint_skills.py`: `groundwork-methodology-adopt` added to `METHODOLOGY`; its `instructions.md` added to `COMMITTING_FILES`. *Accept:* `./dev lint skills` exercises the new skill and passes.

## 7. Workstream F — CLI submodule guardrails (M5)

`bin/groundwork.js`: `detectSubmodules()` parses `.gitmodules` directly (zero-dep); init prints a topology notice and writes `topology: { submodules: [paths] }` into the state it seeds (the `src/config` seed file is untouched — no migration; absent field on old installs = unknown, computed live); `check` gains one advisory line. Serena registration unchanged: `--project .` indexes the working tree, which includes checked-out submodule contents — the LSP sees them regardless of gitlinks.

## 8. Workstream G — repo-map submodule enumeration (M5)

`lib/repo-map/index.js` emits `submodules: [{path, url, initialized}]`; `src/hidden-skills/repo-map-schema.md` documents the key and the caveat that submodule **contents are not indexed** (`git ls-files` does not descend; scan agents and Serena read submodule working trees directly). Cross-root symbol/centrality traversal is deliberately out of scope — backlog, see §11.

## 9. Workstream H — Tests

- New `tests/cli/test_submodules.py`: init with a real submodule (`git -c protocol.file.allow=always submodule add`), init with a hand-written `.gitmodules` (uninitialized-clone case), init without submodules, and the `check` advisory — asserting the notice, the `topology` state field, and an otherwise unchanged install contract.
- `tests/cli/test_repo_map.py`: submodule enumeration case.
- `tests/cli/test_cli.py::test_init_installs_the_contract`: the new skill's `instructions.md` and the scan's `methodology-findings.md` template join the asserted install set.

*Accept:* `./dev test cli` green.

## 10. Workstream I — Sim coverage

- New suite `tests/evals/scenarios/methodology_twin/` — `suite.json` (tech-lead persona with a hand-built bet-like system; goal: one way of working at the end, in-flight work unfractured) + a **generic** twin `fixture/` (stub bash `./dev` with new/archive/test verbs; skip-gated `tests/bets/` milestone files; a work-docs tree outside root `docs/` with one unit mid-milestone; `AGENTS.md` → own handbook skill; two fake incumbent skills; a `.gitmodules` naming an uninitialized submodule).
- Wiring: the sandbox brownfield path prefers a suite-owned `fixture/` when present (falls back to the shared brownfield fixture); `seed_simulation.js` accepts optional `start_state` / `mode_note` overrides from `suite.json`.
- Registered in the contributor testing reference's coverage matrix.

*Accept:* `./dev sandbox twin --brownfield --simulate=methodology_twin` provisions the fixture and seeds the harness. Live runs are driver-gated (§11).

## 11. Workstream J — Docs, changelog, and what stays owed

- `docs/lifecycle/01-setup.md`: brownfield table gains the inventory (Phase 0) and the conditional convergence phase (Phase 5); Adopt/Upgrade paragraph covers non-root canon.
- `CHANGELOG.md` under Unreleased, both `[no-migration]` (skills ship by clean-copy; `bin/` + `lib/` sit outside the named surface groups; the config seed is untouched).
- **Owed after merge (driver-gated):** live `methodology_twin` sim (run → follow → assess → judge) and the real acceptance run against the motivating local repo — each finding M1–M6 observed closed there.
- **Backlog (deliberately not in this plan):** repo-map cross-submodule traversal; any automatic (non-sanctioned) conversion of incumbent artifacts.

---

## 12. Decisions

| # | Decision | Status |
|---|---|---|
| D1 | Twin signal is a `methodology` state field written by the scan; `project_type` stays binary | Settled |
| D2 | One conditional Phase 5 holding plan+execution internally (absorb → map+sanction → execute → prove); no separate pre-extract planning phase | Settled |
| D3 | No per-format converters or verb tables — workers receive target canonical forms by pointer to `.groundwork/skills/` canon | Settled |
| D4 | infra-adopt stays additive; all convert/retire authority lives in Phase 5 behind one Protocol 13 pass | Settled |
| D5 | Durable record = ADR (map + verbatim rulings) + maturity rows + `methodology-adopt` completion marker; no new document species | Settled |
| D6 | Extracts ingest from the recorded canon location; relocating/retiring the old home is a sanctioned Phase 5 unit — the engine is not parameterized on a movable docs root | Settled |
| D7 | repo-map enumerates submodules only; contents un-indexed and documented as such | Settled |
| D8 | In-flight foreign work continues natively until dispositioned at a boundary; finish-native survivors live as open maturity rows | Settled |

## 13. Sequencing and gates

Order: A → B → C → D+E → F → G → H → I → J. Gates: `./dev lint skills` green after every skill-touching workstream; `npm run gen:workflow-index` in the same change as B; `./dev test cli` green after H; `./dev ci` green before the branch merges. Done = all workstreams landed + the two owed live proofs recorded here when they run.
