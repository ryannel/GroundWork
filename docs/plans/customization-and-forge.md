# Customization & Forge — landing well when we go off-script

**Status:** EXECUTED — 2026-06-21. All workstreams A–G landed. Gates green: `./dev test generation`, `./dev test contracts` (incl. workflow-index freshness, bundle freshness, migration cross-check), the new `tests/scaffolds/test_dev_cli_extensions.py` (5 tests), and `scripts/lint_skills.py`. **Owed (human-run, per repo convention):** the `forge_native_desktop` live simulation under Opus — automated tests cover the composable-`./dev` mechanism, but the forge is an agent-run skill whose end-to-end output (a real Swift/AppKit engineer skill + seed registered as a runner with a test medium) is only verifiable by a live sim run. Version bump for release also owed (CHANGELOG entry is staged under `## [Unreleased]`).

Per-workstream:
- **WS-A** — `src/docs/principles/delivery/day-2-operational-baseline.md` + shipped llms.txt entry + scaffold-designer repointed to cite it as canon.
- **WS-B** — customization wording in `groundwork-scaffold` (Adapt the Starting Point + Extending `./dev` in the infra template) and `groundwork-bet` 04-delivery, both pointing at the baseline rule.
- **WS-C** — composable `./dev`: `cli-src/src/util/extensions.ts` + registry merge/shadow + dynamic help/completion + loud empty-stack degrade; bundle rebuilt; generator preserves the config `commands` block.
- **WS-D** — CHANGELOG `[no-migration]` entry; project command layer documented as project-owned in `framework-upgrade-path.md` D1.5.
- **WS-E** — `groundwork-stack-forge` skill + `references/authoring-engineer-skills.md`; orchestrator routing row + note; scaffold Phase 1 three-option branch; Phase 6 handoff fold-in; `forged` surface value.
- **WS-F** — `groundwork-mvp` reads the Forged Stack Checklist and scopes Day-2 items as tracked operational depth, not cuttable features.
- **WS-G** — `tests/scaffolds/test_dev_cli_extensions.py` (discovery, dir-commands, shadowing, completion, loud degrade) + `tests/evals/scenarios/forge_native_desktop/` sim suite.
**Audience:** GroundWork contributors working on the scaffold flow, the `./dev` CLI, the update path, and methodology skills.
**Scope owner:** customization + forge capability.

---

## 0. Mental model

GroundWork's whole value is a **high-quality starting point**. Today that starting point is a fixed menu: the architecture lands on a stack, the scaffold either has a generator for it or it doesn't. When it does, the user gets a Day-2-grade service. When it doesn't, the scaffold offers a passive shrug — reverse the architecture, mark the surface `manual`, or pick a different technology (`groundwork-scaffold/phases/01-ingestion-service-mapping.md:61-63`). Nothing *helps the user build the unsupported thing well*.

The same fixedness shows up one level down, inside a supported project. A real run exposed it: the shipped `./dev` CLI is Docker-Compose-shaped, the project had no Compose, so `./dev start` did nothing — and the agent, instead of adapting the tooling, **left the empty command inert and built a parallel CLI beside it.** Both moves are defects. The starting point was treated as a fixed artifact to accept-or-bypass, not a foundation to adapt.

This plan makes GroundWork adapt. One thesis, three principles:

> **Even when we go off the paved path, GroundWork does everything it can to land the user in a good place.**

- **Off-script still lands well.** A stack with no generator is not a dead end — it earns a researched engineer skill and a Day-2 seed.
- **We don't roll empty capabilities.** Every affordance we materialize — a `./dev` verb, a health endpoint, a test medium — must have real backing. An inert command is a defect, not a placeholder.
- **GroundWork seeds, the project owns and grows.** Shipped artifacts are a foundation to build on, not a managed dependency to leave untouched. The `./dev` toolkit especially is meant to accrue every developer convenience the project needs over its life.

Two capabilities realize the thesis, plus two enablers both depend on:

| | What | Touch |
|---|---|---|
| **Capability 1 — Customize** | Fit isn't quite right → adapt the shipped skills/scaffolds, now or later. Encouraged by light, woven wording; never a heavy machine. | Light |
| **Capability 2 — Forge** | No fit at all → research the stack, author a high-quality engineer skill in the project, build a Day-2 seed, steer the MVP to build the rest. | Heavy — the bar-raiser |
| **Enabler A — Composable `./dev`** | The `./dev` toolkit becomes pluggable: a clean-replaced core offering commands as options/ideas, plus a project-owned command layer that adds or shadows any verb. | Structural |
| **Enabler B — The Day-2 + DX baseline** | A stack-agnostic, *shippable* articulation of "things every project should have on Day 2" — the checklist the forge carries and the MVP scopes against. | New artifact |

The two failure modes from the real run — inert tooling and a duplicate CLI — are the acceptance test for the whole plan. When it lands, neither can happen: the agent is told to adapt, the tooling is built to be adapted, and the unsupported case has a real path.

---

## Findings

| ID | Finding | Source |
|---|---|---|
| F1 | The scaffold's unsupported-stack branch is entirely passive: reverse the architecture, `scaffold: manual`, or pick a supported tech. No "build the unsupported thing well" path exists. | `groundwork-scaffold/phases/01-ingestion-service-mapping.md:61-63` |
| F2 | The `./dev` command set is hardcoded in the compiled bundle (`COMMANDS` array). A project has **no** mechanism to add or override a verb without rebuilding the bundle. Runners manage *processes*, not *commands*. | `workspace-dev-cli/cli-src/src/registry.ts:16-136`; `shared/scaffold-helpers.ts:141-181` |
| F3 | `./dev start` silently no-ops when topology is empty (no Compose services, no runners). "Empty capability" is not a named defect class anywhere in the skills, so the agent didn't recognize the inert command as wrong. | observed run; `cli-src/src/commands/lifecycle.ts` |
| F4 | The Day-2 + DX bar exists only as two per-generator checklists inside the **dev-only** `scaffold-designer` skill. There is no stack-agnostic, shippable articulation, and nothing feeds it into MVP scoping. | `.agents/skills/scaffold-designer/SKILL.md:21-55` |
| F5 | `update` treats the `./dev` bundle + launcher as Tier-1 clean-replace; a customized *launcher* already routes to a collaborative `tier1-custom` upgrade-brief item, but there is no model for a project-owned *command set*, and no "ship the thinking" brief for capability-level improvements. | `bin/groundwork.js:435-450`; `groundwork-upgrade/instructions.md`; `docs/plans/framework-upgrade-path.md:24-29` |
| F6 | `skill-writer` and `skill-creator` are dev-only `.agents/skills/` and never ship. No runtime authoring standard exists for forging a skill inside a user project. | `CLAUDE.md`; `.agents/skills/skill-{writer,creator}/` |
| F7 | Engineer skills follow a strict two-family anatomy (Backend / Surface) and are sync-anchored to in-repo principles. A forged skill must match the anatomy but be **self-contained** — there is no in-repo principle source to pin at runtime in a user project. | `groundwork-contributor/SKILL.md` (Engineer-skill families); `*/sync-anchor.md` |

---

## Workstreams

### WS-A — The stack-agnostic Day-2 + DX baseline (Enabler B)

The "things to think about" checklist the forge carries and the MVP scopes against. Today this lives only per-generator in the dev-only `scaffold-designer` skill (F4); it must become a shippable artifact.

- Extract a **stack-agnostic** baseline from the existing Backend/Frontend checklists + `src/docs/principles/`: config loaded-and-validated at startup, structured error handling, a **debugging entrypoint** (how to attach/launch in debug), observability hooks, graceful shutdown, layered core/shell, a test harness, and `./dev` integration. Each item states *what* and *why*, not a Go/Python/Next-specific *how*.
- Name the two principles the run exposed: **no empty capabilities** and **off-script still lands well**.
- Home: a shipped reference the forge and MVP both read (candidate `src/docs/principles/delivery/day2-operational-baseline.md`, mirrored to `docs/` on init like other Tier-2 principles). The dev-only `scaffold-designer` checklists become *stack-specific elaborations* that cite this baseline as canon.
- **Acceptance:** a shipped doc exists; `scaffold-designer` references it rather than duplicating it; the forge skill (WS-E) and MVP (WS-F) read it by path.

### WS-B — The customization contract (Capability 1, light)

Light, intent-driven wording — not a machine — woven where the agent decides whether to adapt shipped output.

- In `groundwork-scaffold`, the engineer skills, and the `./dev` guidance: state that shipped artifacts are a **starting point to adapt** to the project, at scaffold time or later, and that adaptation is encouraged.
- Name the two prohibited outcomes explicitly: **shipped tooling left inert** and **a parallel/duplicate built alongside it**. The `./dev start` story is the worked example.
- Keep it generic — no sandbox product names (the GroundWork-is-a-generic-framework rule).
- **Acceptance:** wording present in the named skills; passes the generic-not-sandbox read; reviewed via `groundwork-review` where it lands in shipped skills.

### WS-C — Composable `./dev` (Enabler A)

Make `./dev` a pluggable, reference-grade toolkit the project owns and grows (F2, F3).

- **Project-owned command layer.** The core bundle discovers project commands declared in `.dev/dev.config.json` (a `commands` block) and/or a `.dev/commands/` directory, merges them into the dispatch table, and wires them into `help` + completion. Project commands run as subprocesses (preserving the zero-dependency core), and a project command **shadows** a core verb of the same name — so a project can redefine `start` without touching the bundle.
- **No empty capabilities.** A core verb whose backing is absent (e.g. `start` with no Compose and no runners) degrades loudly with a one-line "nothing registered — here's how to wire this app as a runner/command," never a silent no-op. The seeded command set is framed in the generated output as **composable options and ideas** ("here's how to build a top-tier dev CLI; use these or riff on them"), not a fixed contract.
- The render/theme layer is already self-contained (`cli-src/src/theme/`); reuse it for project commands' output so extensions look native.
- **Acceptance:** a project adds a working command without rebuilding the bundle; a project command shadows a core verb; an empty core verb degrades loudly; `tests/scaffolds` covers discovery + shadowing.

### WS-D — Update-as-collaboration for owned artifacts

Generalize the existing agent-brief path so framework improvements to project-owned artifacts arrive as collaboration, not replacement (F5).

- The project-owned command layer (`.dev/commands/`, the config `commands` block) is **Tier-4 project-owned** — `update` never overwrites it. The core bundle stays Tier-1 clean-replace (plumbing the user never needs to fork).
- Framework improvements to `./dev` capabilities ship as **agent migrations** whose brief carries *the thinking behind the change and how it was applied to GroundWork's reference `./dev`*; `groundwork-upgrade` walks the user through adopting or adapting it to their customized toolkit. This is the existing Detect/Transform/Accept brief mechanism, used for capability-level uplift rather than only mechanical backfills.
- Document the model in `framework-upgrade-path.md` and `migrations/README.md`: owned-and-grown artifacts update by collaboration; the brief ships the intent.
- **Acceptance:** a worked example agent brief for a `./dev` capability uplift; `groundwork-upgrade` handles it; the manifest/`update` path provably never touches `.dev/commands/`.

### WS-E — The forge skill (Capability 2, heavy)

A new hidden methodology skill — working name `groundwork-stack-forge` — that turns the passive unsupported-stack branch (F1) into an active "build it well" path.

- **Trigger.** Add it as the fourth option at `01-ingestion-service-mapping.md:61-63` and a routing row in the orchestrator's Skill Paths table. Offered when no generator can honor the chosen stack and the user wants to build it properly rather than reverse or hand-roll.
- **Pipeline:**
  1. **Classify** the target (backend service / surface / native daemon) to pick the nearest engineer-skill family template (F7).
  2. **Deep-research** the stack via the `deep-research` skill — build/run cycle, debugging, error handling, observability, graceful shutdown, idiomatic project layout.
  3. **Author a self-contained engineer skill** in `.agents/skills/groundwork-<stack>-engineer/`, applying a **distilled** skill-writer house style + skill-creator's eval-before-accept loop (carried inside the forge, since neither ships — F6), the nearest-family anatomy, and the existing go/python/nextjs skills as worked examples. Self-contained `references/`; no `sync-anchor.md` (nothing to pin at runtime).
  4. **Build a Day-2 seed** by *adopting that freshly-authored skill* — dogfooding it. The seed is a skeleton that clears the WS-A baseline for what applies to this target, not a finished app.
  5. **Wire the seed into `./dev`** (a runner + a composable command via WS-C), `surfaces.json`, and a `system-test-runner` medium — so it's a first-class citizen, and `./dev start` actually runs it.
  6. **Hand off to MVP**: write the WS-A checklist (stack-specialized) into the scaffold→MVP handoff so the first bets build the rest.
- Forged skills stay in the user project; **no upstream contribution loop** (explicitly out of scope — a later feature request).
- **Acceptance:** orchestrator routes to it; the scaffold branch offers it; a run produces a self-contained engineer skill + a wired seed + a handoff checklist entry; covered by a sim suite (WS-G).

### WS-F — MVP consumes the checklist

Close the loop so the seed's skeleton becomes a Day-2 app through the normal delivery loop.

- `groundwork-mvp` already reads `.groundwork/cache/handoff/scaffold.md`. Add light guidance: when the handoff carries a forged Day-2/DX checklist, scope the first bet(s) to build the applicable items (config validation, error handling, debugging, observability, graceful shutdown), deferring the rest with a reason.
- **Acceptance:** MVP instructions reference the forged checklist; a sim shows the first pitch pulling applicable items into scope.

### WS-G — Tests + simulation

- **Sim suite.** A new generic persona whose chosen stack has no generator (generic, *not* AppKit-specific — the sandbox rule). Exercises the forge end-to-end and the MVP hand-off.
- **Structural contracts** in `tests/scaffolds`: a forged seed registers a runner + surface + test medium; composable-command discovery + shadowing; an empty core verb degrades loudly.
- **Acceptance:** `./dev test generation` + `./dev test contracts` green; the sim runs end-to-end under Opus.

---

## Decisions

### Settled

| Decision | Rationale |
|---|---|
| `./dev` is project-owned-and-grown, not a config-only tweak. | The user's call: every developer convenience belongs in `./dev`; config-first was too thin. Realized as a clean-replaced core + a Tier-4 project-owned command layer (WS-C/WS-D). |
| Update of owned artifacts is collaborative, never mechanical merge. | "Here's the thinking, here's how we applied it to GroundWork, let's bring it to your app." Reuses the existing agent-brief path (WS-D). |
| Distill skill-writer/skill-creator into the forge; don't ship them. | They're dev-only; shipping bloats every user's context and blurs the dev/prod boundary (F6). |
| No upstream contribution loop. | Out of scope by explicit decision — a later feature request. Build nothing for it. |
| Engineer skills extend-not-edit; forged skills are self-contained, no sync-anchor. | Shipped engineer skills are Tier-1 + sync-anchored; a forged skill lives in the user project with no in-repo principle to pin (F7). |
| The seed is a skeleton; the MVP carries the Day-2 build-out. | Matches the user's "that should be part of the MVP." The forge seeds quality scaffolding; the delivery loop builds the app. |
| "No empty capabilities" is a named defect class. | The root cause of the `./dev start` story; stated in WS-A and enforced in WS-C. |

### Open

| Question | Lean |
|---|---|
| Name of the forge skill. | `groundwork-stack-forge` — descriptive, matches the house naming. |
| Home of the WS-A baseline doc. | `src/docs/principles/delivery/` (mirrored to `docs/`), so it travels the existing Tier-2 path. Confirm vs a hidden-skill reference. |
| Whether project commands live in `.dev/commands/` modules, a config `commands` block, or both. | Both — a config block for declared subprocess commands, a directory for richer ones; settle during WS-C. |

---

## Sequencing & gates

```
WS-A (Day-2 baseline) ──┬── WS-C (composable ./dev) ──┬── WS-E (forge) ── WS-F (MVP) ── WS-G (tests/sim)
                        └── WS-B (customization contract)         │
                                          WS-D (update-as-collaboration) ┘
```

- **WS-A first** — both the forge and the MVP read it.
- **WS-B and WS-C in parallel** — the contract is wording; the composable CLI is the structural enabler. WS-C carries the concrete `./dev start` fix.
- **WS-D** depends on WS-C (it governs how the new owned layer updates).
- **WS-E** depends on WS-A + WS-C (it authors against the baseline and wires the seed through the composable CLI). **WS-F** then **WS-G**.

**Done when:** `./dev test generation` + `./dev test contracts` are green; the new sim suite runs end-to-end under Opus; the two failure modes from the originating run — an inert `./dev` command and a parallel duplicate CLI — are both structurally prevented; every new shipped skill file passes `groundwork-review` and the generic-not-sandbox read.
