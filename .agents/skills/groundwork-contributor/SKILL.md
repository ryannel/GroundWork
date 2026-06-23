---
name: groundwork-contributor
description: >
  Provides orientation and contribution rules for working inside the GroundWork source
  repository itself. Load this skill whenever the current workspace is the GroundWork
  project (look for a `src/skills/` directory alongside a `bin/groundwork.js` CLI and
  a `.agents/skills/` directory at the root). Use this skill for any task in this repo —
  adding skills, editing the CLI, restructuring src/, writing docs, building new hidden
  skills, or debugging the install flow. This is the repo where GroundWork is built, not
  where it is used.
---

# GroundWork Contributor Guide

This repository is the source of the GroundWork npm package (`npx groundwork`). You are
building the tool, not using it. The skills and config in this repo shape what gets
delivered to end users when they run `npx groundwork init`.

---

## Repository Map

```
groundWork/
├── bin/
│   └── groundwork.js          ← CLI entry point. Handles init, update, check commands.
│
├── src/                       ← Everything that ships to users via npm.
│   ├── skills/                → Copied to .agents/skills/ in the user's project.
│   │   ├── groundwork-orchestrator/   ← The only skill users see in their agent toolchain.
│   │   └── groundwork-check/          ← Staleness detection skill.
│   │
│   ├── hidden-skills/         → Copied to .groundwork/skills/ (GroundWork's home dir — no agent scanner reaches it).
│   │   ├── operating-contract.md      ← Shared protocols loaded by every methodology skill.
│   │   ├── groundwork-persona/        ← Always-on conversational posture; loaded by the orchestrator on every session.
│   │   ├── templates/                 ← Shared file templates (discovery-notes.md, etc.) referenced by multiple skills.
│   │   ├── groundwork-product-brief/  ← Greenfield PM facilitation.
│   │   ├── groundwork-design-system/      ← Design system facilitation. Loads an interface-type track (graphical-ui, cli, agentic-protocol).
│   │   ├── groundwork-architecture/   ← Architecture facilitation.
│   │   ├── groundwork-scaffold/       ← Greenfield scaffolding: runs Nx generators, boots infra, writes infrastructure.md.
│   │   ├── groundwork-mvp/            ← One-time MVP scoping; produces first bet pitch and hands off to Bet without context reset.
│   │   ├── groundwork-scan/                       ← Brownfield Phase 0: deep codebase scan → scan baseline cache (no docs artifact).
│   │   ├── groundwork-product-brief-extract/      ← Brownfield Phase 1: reverse-engineers docs/product-brief.md from the scan.
│   │   ├── groundwork-design-system-extract/      ← Brownfield Phase 2: recovers docs/design-system.md + brand-tokens.json from code.
│   │   ├── groundwork-architecture-extract/       ← Brownfield Phase 3: reconstructs architecture + domain + ADRs from scan + repo-map.
│   │   ├── groundwork-infra-adopt/                ← Brownfield Phase 4: adopts existing services, bolts on the operational layer, commits the gap ledger.
│   │   ├── groundwork-bet/            ← Delivery loop: discovery → design → decomposition → delivery → validation.
│   │   ├── groundwork-patch/          ← Small-change lane: bounded code fixes outside the bet ceremony, logged to the patch ledger.
│   │   ├── groundwork-update/         ← Surgical doc updates.
│   │   ├── groundwork-surface-activation/ ← Adds a surface to a live product: registry entry, lazy design track, scaffold, ledger triage. Bootstraps the registry on pre-restructure products.
│   │   ├── groundwork-review/         ← Internal review panel for draft quality.
│   │   ├── groundwork-writer/         ← Writing style enforcer. Loaded on demand during output.
│   │   ├── groundwork-architect/      ← Architecture-discipline persona. Adopted inside the architecture workflow + bet design; principles baked into its references/.
│   │   └── groundwork-product/        ← Product-discipline persona. Adopted inside the product-brief workflow + bet discovery; principles baked into its references/.
│   │
│   ├── engineer-skills/       → NOT installed at init. Promoted into a scaffolded project's
│   │   │                         .agents/skills/ per language (the only place they become registered).
│   │   ├── groundwork-go-engineer/      ← Promoted alongside go-microservice generator output.
│   │   ├── groundwork-python-engineer/  ← Promoted alongside python-microservice generator output.
│   │   ├── groundwork-nextjs-engineer/  ← Promoted alongside nextjs-app generator output.
│   │   ├── groundwork-flutter-engineer/ ← Promoted alongside flutter-app generator output.
│   │   └── groundwork-electron-engineer/← Promoted alongside electron-app generator output.
│   │
│   └── config/
│       └── groundwork-state.json      ← Initial orchestration state seeded on init.
│
├── .agents/                   ← Meta-skills for building GroundWork. NOT shipped to users.
│   └── skills/
│       ├── groundwork-contributor/    ← This skill. Always loaded in this repo.
│       ├── skill-writer/              ← How to write skill instructions. Dev-only, not shipped.
│       ├── skill-creator/             ← Anthropic skill creation workflow (vendored; tracked in skills-lock.json).
│       ├── scaffold-designer/         ← How to design new Nx generators for this repo.
│       └── golang-pro/                ← Vendored general Go skill (tracked in skills-lock.json). Engineer skills are NOT mirrored here — read their canon in src/engineer-skills/.
│
├── docs/                      ← GroundWork's own framework documentation. NOT output from running GroundWork on this repo.
│   ├── lifecycle/             → The user-facing methodology reference: setup, delivery loop, maintenance.
│   ├── principles/            → Stack-specific engineering principles, distilled into the engineer/discipline skill references (sync-anchored).
│   ├── plans/                 → Design plans for cross-cutting restructures (see Design Plans below).
│   └── examples/              → Artifacts committed from real runs, referenced by getting-started.
├── migrations/                ← The migration registry (ships in the package). index.json + cli modules +
│                                agent briefs; every release that changes the shipped surface adds an entry.
│                                Format and rules: migrations/README.md.
├── tests/                     ← Framework test suite. Tests GroundWork-as-a-tool, not a project built with it.
│   ├── cli/                   ← CLI contract tests (init/update/check, manifest, migrations, upgrade path).
│   ├── evals/                 ← Simulation suites (personas + fixtures). Not a runner — see Flow Testing.
│   │   ├── scenarios/               ← One subdir per suite; suite.json defines the persona.
│   │   ├── fixtures/                ← Brownfield input codebase + legacy per-phase seed workspaces.
│   │   └── validate_scaffold.py     ← Scaffold boot-prober (./dev test validate); not the flow harness.
│   ├── fixtures/installs/     ← Frozen old-install snapshots the upgrade-path tests update from.
│   ├── scaffolds/             ← Deterministic generator tests (generation, compilation, scaffolds, contracts).
│   └── system/                ← System test templates; generated into scaffold sandboxes at test time.
├── llms.txt                   ← Agent discovery index for this repo's docs.
├── skills-lock.json           ← Tracks externally sourced skills (e.g. skill-creator).
├── .npmignore                 ← Excludes meta-skills and dev tooling from the npm package.
└── package.json               ← npm package config. Binary: groundwork → bin/groundwork.js
```

### Multi-phase skill layout

A hidden skill whose session moves through distinct modes splits its instruction body into per-mode files that `instructions.md` routes to — loading only the active mode keeps the conversation in one mode at a time. The directory name signals what drives the routing:

| Directory | Used by | One file per | Routed by |
|---|---|---|---|
| `workflows/` | groundwork-bet | bet lifecycle phase | pitch `status` frontmatter |
| `phases/` | groundwork-architecture, groundwork-scaffold | conversation phase | phase status in the skill's cache file |
| `tracks/` | groundwork-design-system | interface type (plus `_foundation.md`, the brand-level flow run once) | `interface_types` |

`templates/` directories hold output skeletons, never instructions. When restructuring a skill, keep the directory name that matches its routing shape — the convention is how a reader predicts a skill's internals without listing it.

---

## The GroundWork Lifecycle

GroundWork operates in two modes: **Setup** and **Delivery**.

### Setup (one-time, per project)

Establishes the skeleton — the vision, the design system, the service boundaries — and
delivers the first working bet. Two paths are implemented:

| Path | Flow | Source of truth |
|---|---|---|
| **Greenfield** | Product Brief → Design System → Architecture → Scaffolding → MVP Planning → Delivery Loop | Collaborative discovery with the user. The repo is empty. |
| **Brownfield** | Scan → Product Brief Extract → Design System Extract → Architecture Extract → Infra Adoption → Delivery Loop | The existing codebase. Docs are reverse-engineered from it; the user is interviewed only for the gaps code cannot reveal. |

Greenfield builds the docs from scratch through conversation. Brownfield scans an existing
codebase, reverse-engineers the same canonical doc set, and additively bolts on the operational
layer (`./dev`, system tests, optionally a docs site) without regenerating the app — converging
to the same end-state. Both paths end in the Delivery Loop. The orchestrator detects which path
applies from the filesystem and routes accordingly.

### Delivery Loop (repeating, ongoing)

Discovery → Refinement → Delivery of Bets. Each cycle can refine any document as the
project learns.

### The Operating Contract

All methodology skills share a single set of behavioral protocols defined in
`src/hidden-skills/operating-contract.md`. This file ships to user projects at
`.groundwork/skills/operating-contract.md`. It governs:

- **Discovery Notes**: How out-of-phase signals are captured and carried forward.
- **Living Documents**: How existing docs are updated when new information surfaces —
  any phase, any bet, any direction.
- **Phase Lifecycle**: How each phase initializes, executes, commits, and hands off.

Every methodology skill loads this contract. The protocols are defined once and referenced
everywhere — never duplicated inline.

---

## The Two-Layer Skill Architecture

GroundWork keeps a deliberate split between what an agent's skill scanner can discover and
what is GroundWork's private, orchestrator-routed instruction set. The dividing line is the
install directory, **not** the filename: only `.agents/skills/` is a skill-discovery root, so
anything under `.groundwork/skills/` is invisible to the scanner regardless of whether its
file is named `SKILL.md` or `instructions.md`.

### Registered Skills (`src/skills/` → `.agents/skills/`)
The agent toolchain picks these up automatically. Every skill here appears in the model's
available skills list. Keep this list short — context window cost scales with every entry.

Currently only the **orchestrator** and **check** live here. The orchestrator is the
central router — it determines the project mode and loads the right hidden skill. All methodology skills
(product-brief, architecture, design-system, bet, writer) and the always-on persona are hidden behind
the orchestrator's routing table to minimize always-on context cost.

### Hidden Skills (`src/hidden-skills/` → `.groundwork/skills/`)
These are instruction files loaded on demand by the orchestrator. They install into
`.groundwork/skills/` — GroundWork's home directory, alongside `config/` and `cache/` — which
is **not** a skill-discovery root for any agent (Claude Code, Cursor, Codex, OpenCode, Cline),
so they consume no context until the orchestrator opens one by path. This is the correct home
for any new methodology skill (product-brief, setup, bet, design-system, etc.). They are
clean-replaced on `update` exactly like the registered skills (tier 1, framework-owned).

The orchestrator's routing table lives directly in `src/skills/groundwork-orchestrator/SKILL.md`.
When adding a new methodology skill, add a row to the Skill Paths table there (pointing at
`.groundwork/skills/<name>/instructions.md`).

### Engineer-skill delivery

The five engineer skills (`groundwork-{go,python,nextjs,flutter,electron}-engineer`) are
product deliverables. Their canon lives in `src/engineer-skills/` and is **never installed at
the GroundWork root** — `promoteEngineerSkill()` (`src/generators/shared/scaffold-helpers.ts`)
copies the matching skill into a scaffolded project's `.agents/skills/` per language (Go for
`go-microservice`, Python for `python-microservice`, Next.js for `nextjs-app`, plus
`flutter-app` and `electron-app`). That scaffolded `.agents/skills/` location is the **only**
place an engineer skill becomes a registered skill — by design, so the engineer persona is in
the toolchain for the project that has that language's code. For in-repo work, read the canon
under `src/engineer-skills/`. The `sync-anchor.md` gate in `./dev test contracts`
(`tests/scaffolds/test_skill_sync.py` → `scripts/check_sync_anchors.py`) scans both
`src/hidden-skills/*` (the discipline personas) and `src/engineer-skills/*` — every pinned
principle hash must match, so a principle edit forces a skill review in the same commit.

### Engineer-skill families

The five engineer skills follow two deliberate SKILL.md templates, split by what the
agent is wired into:

| Family | Skills | Section spine |
|---|---|---|
| **Backend** | go-engineer, python-engineer | Operating Contract → Required First Checks → Context Routing → Skill Handoffs → Execution Checklist → Safety Gates → Quick Reference → Output Expectations |
| **Surface** | nextjs-, flutter-, electron-engineer | Operating Contract → Core Pillars → How to Use This Skill → Task Routing → Safety Gates → Hallucination Controls → Output Expectations → Antipatterns |

The split is intentional: backend skills front-load contract checks and hand-offs
because their work is gated by specs and sibling services; surface skills front-load
pillars and hallucination controls because their failure mode is plausible-but-wrong
UI idiom. When writing a new engineer skill, copy the newest sibling **from the same
family** — not whichever skill you found first.

### Discipline-expert skills

The engineer skills are persistent *implementation* experts. The **discipline-expert
personas** are the design-side equivalent, built on the same anatomy (`SKILL.md` +
`sync-anchor.md` + `references/`) with a **persona header** grafted on the spine.
Three exist today — `groundwork-architect` (the pilot), `groundwork-product`, and
`groundwork-designer`. The model is **persona-in-a-workflow-route**: a
persona is not a lifecycle phase the orchestrator routes to on its own — it is
*adopted within* a setup workflow and the `groundwork-bet` lifecycle:

- **`groundwork-architect`** — adopted inside the `groundwork-architecture` setup
  workflow and the bet design phase (`workflows/02-design.md`), whenever a structural
  trade-off is in play. Distils `src/docs/principles/{system-design,quality,delivery,ai-native}`.
  Owns the **feasibility** risk.
- **`groundwork-product`** — adopted inside the `groundwork-product-brief` setup
  workflow and the bet discovery phase (`workflows/01-discovery.md`), whenever what to
  build and whether it is worth it is in play; lighter touches in bet validation
  (`workflows/05-validation.md`). Distils the product corpus under
  `src/docs/principles/foundations/` (product-engineering, continuous-discovery,
  product-risks, success-metrics, requirements-and-specs, prioritization-and-appetite)
  plus `ai-native/ai-native-product.md`. Owns the **value** and **viability** risks.
- **`groundwork-designer`** — adopted inside the `groundwork-design-system` setup
  workflow and the bet design phase (`workflows/02-design.md`), whenever how the
  product looks, feels, or behaves is in play; a lighter touch in bet validation
  (`workflows/05-validation.md`) when the delivered UI is judged against its intent.
  Distils the design corpus under `src/docs/principles/design/` (design-foundations,
  visual-design, layout-and-space, interaction-and-motion, usability-and-ux,
  design-systems-and-tokens, ai-native-design) plus `quality/accessibility.md`.
  Owns the **usability** risk.

The personas divide the product-risk space cleanly: product owns value + viability,
the designer owns usability, architect + engineers own feasibility.

Two rules make each one work, both shared with the engineer skills:

- **Self-contained references.** The principles are *distilled into the skill's own
  `references/`*, written for that persona's decision-time lens. The skill never
  depends on the user keeping a `docs/principles/` folder at runtime.
- **Sync-anchored to source.** `sync-anchor.md` pins every source principle's SHA-256,
  so a principle edit forces a review of the matching reference in the same commit
  (the same `./dev test contracts` gate that guards the engineer skills — it
  auto-discovers any `src/hidden-skills/*/sync-anchor.md` and
  `src/engineer-skills/*/sync-anchor.md`). No mirror in
  `.agents/skills/` is needed: contributors do discipline facilitation in *user*
  projects, not in this repo.

### Vendored skills

Skills sourced from outside this repo (`golang-pro`, `skill-creator`) are tracked in
`skills-lock.json` with the SHA-256 of the locally accepted file. They keep their
upstream voice — do not restyle them to the skill-writer standard; a diff against
upstream should show deliberate changes only. When you do change one deliberately,
recompute its hash in the lock (the recipe is documented in the file).

---

## File Storage Convention

GroundWork uses a two-tier file layout in user projects. Every contributor must understand
where files go and why.

### `.groundwork/` — GroundWork's Home Directory

A single directory at the project root for everything GroundWork owns: config, state,
working drafts, and manifests. Two subdirectories separate concerns:

```
.groundwork/
├── config/           # Persistent — settings, state, routing
│   ├── config.toml   # User-owned config: [defaults] proposals + [skills] custom routing. Seeded once, never overwritten by update.
│   └── state.json    # Orchestration phase tracking + groundwork.version stamp
├── context/          # Setup-only — the cross-phase contract (Protocol 5); torn down at Setup Graduation
│   └── <phase>.md    # one Downstream Context file per setup phase
└── cache/            # Transient — working files deleted when a skill completes
    ├── design-system-cache.md
    ├── product-brief-distillate.md
    └── scan-state.json
```

| Subdirectory | Purpose | Lifecycle |
|---|---|---|
| `config/` | Persistent settings and orchestration state | Seeded by installer, updated by skills, never bulk-deleted |
| `context/` | The Downstream Context store — each setup phase's cross-phase contract (Protocol 5), read by later setup phases | Created at each setup phase's commit; the whole store is deleted once, at Setup Graduation (Protocol 10), as setup hands off to delivery |
| `cache/` | Stage-gated drafts, scan progress, overflow context | Created during skill execution, cleaned up on commit |

### `docs/` — Living Outputs

Canonical documents that represent the current best understanding of the project. These are
not frozen snapshots — later phases update earlier documents when new information refines or
expands what was established. The Design System phase may sharpen the Product Brief. Architecture may
refine both the Product Brief and Design System. Each document grows as the project learns more.

| File | Purpose |
|---|---|
| `product-brief.md` | Product vision document |
| `design-system.md` | Design system and NFRs |
| `architecture.md` | Architecture document |
| `infrastructure.md` | Scaffold service map and run commands |
| `bets/` | Bet pitches and plans |

### Cache Lifecycle Rules

- Skills **create** files in `.groundwork/cache/` at execution start.
- Skills **delete** their cache file on successful commit (e.g., the Design System skill deletes
  `design-system-cache.md` after writing `docs/design-system.md`).
- Stale cache files (>24h) should be manually cleared or archived.
- Never write final deliverables to `.groundwork/`. Final outputs go to `docs/`.

---

## Cross-Phase Contracts

The phases communicate through shared artifacts and identifiers. Each is written by one skill and read by others — usually in different files, often in different sessions — so a change to any writer must update every reader in the same change (`skill-writer` names the failure mode: identifier drift is silent; a consumer reading a stale shape finds nothing, with no error). This table is the map of those chains. It is also where to start any cross-cutting restructure: the chains are where single-phase assumptions hide.

| Artifact / identifier | Written by | Read by |
|---|---|---|
| `interface_type` → the interface track recorded in `docs/design-system.md` | design-system Step 2 (greenfield); design-system-extract Stage 1 (brownfield) | design-system track loader; scaffold Phase 1 / infra-adopt Phase 2 (surface registry → system-test-runner `--surfaces` deps + fixtures); bet design + bet-progress-test templates (vocabulary, test medium) |
| Pitch `status` frontmatter (`docs/bets/<slug>/pitch.md`) | each bet workflow on phase entry | bet activation routing; orchestrator state reconciliation; groundwork-check |
| `docs/bets/<slug>/contracts/` spec files | bet 02-design Step 2.2 | 03-decomposition (test shapes); 04-delivery (derived clients); 05-validation (verification + promotion) |
| `docs/api/<service>/` canonical specs | 05-validation Step 2.5 promotion | the generated contract-conformance system tests (run by the project's `./dev test`); groundwork-check |
| `.groundwork/bets/<slug>/decomposition.json` | 03-decomposition Step 6.5; 04-delivery slice loop (status fields only) | `./dev bet status`; resumed delivery sessions; 05-validation retrospective |
| `.groundwork/bets/<slug>/test-manifest.json` | the seal at Proof of Work; amendments (`--amend`) | `./dev test bet` tamper check; 05-validation |
| `.groundwork/config/brand-tokens.json` | design-system commit (every track) | scaffold → `workspace-dev-cli` theming (`.dev/dev.config.json`) |
| `docs/infrastructure.md` | scaffold Phases 4–6; infra-adopt | bet 03-decomposition (test language, service names); delivery |
| Downstream Context files (`.groundwork/context/<phase>.md`) + hand-off cache (`.groundwork/cache/handoff/<phase>.md`) | each setup phase's commit (Protocols 5–6) | the next setup phases' inits; the hand-off is single-hop (deleted when consumed), the context store is torn down at Setup Graduation (Protocol 10). Published `docs/` carry no summary section |
| Discovery-notes headers (`## Architecture`, `## Design System`, `## Design Details`, `## Bets`) in `.groundwork/cache/discovery-notes.md` | any phase, on out-of-phase signals (Protocol 1) | the phase that owns the matching header, at its init or design step |
| `docs/architecture.md` §3 Capability Ports & Providers + `.groundwork/capability-ports.json` (each technical port → provider → footprint) | architecture Phase 7 commit (step 5b); architecture-extract commit | scaffold Phase 1 (port → generator flag / `add-capability` invocation); scaffold Phase 2 (footprint registration check); scaffold Phase 4 (reconcile footprints — compose service / runner / env / `none`-xfail); bet delivery (a `none` raw gateway is the bet) |
| Screenshot capture path `.groundwork/cache/visual/<bet-slug>/<surface>/<state>.png` (+ `_smoke/<surface>/<route>__<viewport>__<theme>.png`) | system-test-runner render-smoke (`_smoke` set); bet-progress interface tests (per-state set) | 04-delivery Tier 2 spec-conformance inspection (delivery agent); 05-validation confirms it ran |
| `## Design References` (technique library) in `docs/design-system.md` + `references` array in `brand-tokens.json` `visual` block | design-system commit (_foundation Phase 6 convergent technique-research pass + graphical-ui Commit Contributions); design-system-extract | the atmosphere/motion token projection + the per-surface micro-polish spec at bet design |
| `visual` block atmosphere tokens (`elevation`, `blur`, `gradients`, `surface`, `motion.interactions`, `typography.roles`) in `brand-tokens.json` | design-system commit (graphical-ui Commit Contributions) | nextjs-app generator projection → `app/brand.css` + `globals.css` token utilities; `tests/system/test_token_conformance.py` (Tier 1) |
| Per-screen micro-polish spec in the bet's `technical-design/01-surface-design.md` Surface Design (motion / atmosphere / static-micro, token-traceable) | bet 02-design Step 1.95 (designer persona); concreteness-gated at Step 2.5 | 04-delivery Tier 2 spec-conformance inspection; 05-validation |

---

## How `npx groundwork init` Works

The CLI copies skills and seeds the `.groundwork/` directory:

| Source | Destination | What it contains |
|---|---|---|
| `src/skills/*` | `.agents/skills/` | Agent-registered skills |
| `src/hidden-skills/*` | `.groundwork/skills/` | On-demand methodology instructions (not a skill-discovery root) |
| `src/config/groundwork-state.json` | `.groundwork/config/state.json` | Initial orchestration state (created only if absent) |

`src/engineer-skills/*` is **not** copied at init — a service generator promotes the matching
engineer skill into the scaffolded project's `.agents/skills/` (see Engineer-skill delivery).

The CLI also creates `.groundwork/cache/` as an empty directory.

The `.agents/skills/` directory inside this source repo is explicitly excluded by the
self-copy guard in `bin/groundwork.js` (line ~59). This prevents the dev meta-skills
from being installed into user projects.

---

## GroundWork is a Generic Framework

GroundWork is a framework for building **any kind of application**. Its skills, methodology, and CLI must work equally well for a fintech dashboard, a consumer social app, a developer tool, or a storytelling engine. No single product type is the target.

### The Sandbox Problem

During development, specific sandbox projects are used to test and validate GroundWork's skills. These are real products being built with GroundWork, and they generate rich, concrete feedback. That feedback is valuable — but it is a **signal about the generic case, not a specification for it**.

**The rule**: When a sandbox example reveals a problem with a skill, fix the skill for every possible product, not for that specific product.

| ✅ Correct | ❌ Wrong |
|---|---|
| "The naming rule needs better examples — use generic screen names" | "Add examples specific to the storytelling app" |
| "The research protocol needs to decompose by experience dimension" | "Add storytelling-specific search instructions" |
| "Phase 1 should reference pre-AI practitioners in any domain" | "Mention graphic novels and picture books specifically" |

**Check your output**: Before saving any skill change, read it back and ask — *"Does this skill read as if it was written for any app, or does it betray knowledge of our sandbox project?"* If any specific domain, product type, or use case leaks through, generalise it.

---

## Test Infrastructure

> **Orientation**: Everything in `tests/` tests GroundWork **as a framework**. The eval
> harness runs a hidden skill against a simulated user to verify it behaves correctly.
> The scaffold harness generates a project with GroundWork's generators and boots it to
> verify the output compiles and runs. Neither is a project being built _with_ GroundWork —
> they are automated probes of GroundWork itself.

---

### Flow Testing — the Simulation Harness

Flow testing (the greenfield and brownfield methodology paths) is **not** a
programmatic agent driver. There is no SDK loop. A flow test is a **real Claude
Code session, run by a human, against the real installed skills** — so it
exercises genuine skill loading, orchestrator routing, subagent dispatch, and the
Serena MCP server, none of which a hand-rolled loop can reproduce faithfully.

> The old `conversational_eval.py` harness (a raw Anthropic Messages loop with two
> Haiku agents) has been removed. It re-implemented the agent loop and could only
> exercise the sequential, LLM-only path — a green run there did not prove the
> skill worked in the product. Simulation replaces it.

#### How it works

`./dev sandbox --simulate` scaffolds a sandbox and seeds three artifacts into it
(via `scripts/seed_simulation.js`), then a human opens a Claude Code session in
that folder and runs the kickoff command:

| Artifact | Path | Role |
|---|---|---|
| **Persona subagent** | `.claude/agents/sandbox-user.md` | The simulated human client. Persona text is lifted verbatim from the suite's `suite.json`, so the dry-run and any future probe share one source of truth. |
| **Kickoff command** | `.claude/commands/simulate-<path>.md` | The facilitator's operating loop. Walks the full path, delegating every user-facing turn to `sandbox-user` instead of pausing for the real human. |
| **Judge command** | `.claude/commands/judge.md` | A non-gating quality rubric, run in a **fresh** session (see Assessment). |

The session runs the real skills and writes real `docs/*.md` + `.groundwork`
state, committing when the persona approves a draft. The simulation is the
**instrument**, not the thing under test — when a skill behaves poorly, the
operating loop runs it faithfully so the weakness shows in the transcript.

#### Running a simulation

```bash
./dev sandbox --simulate                      # greenfield, default suite (storytelling_engine)
./dev sandbox --simulate=b2b_saas             # greenfield, a specific suite/persona
./dev sandbox --brownfield --simulate         # brownfield from the synthetic fixture (offline)
./dev sandbox --repo=owner/repo --simulate    # brownfield from a real GitHub repo (cached clone)
./dev sandbox myrun --simulate                # custom sandbox dir name (.sandboxes/myrun)
```

Then open a new Claude Code chat **from the sandbox folder** and run
`/simulate-greenfield` (or `/simulate-brownfield`). The real human observes and
may interject; any real-human message is treated as an override, not the persona.

- **Greenfield** inits into an empty repo (with a throwaway Nx-style root so the
  scaffold skill is happy). Sequence: Product Brief → Design System → Architecture
  → Scaffold → MVP → first Bet.
- **Brownfield** seeds an existing codebase, **commits it as the adoption baseline
  before GroundWork touches anything** (infra-adopt diffs against
  `baseline.source_commit`), then inits. A brownfield repo is deliberately not an
  Nx workspace — infra-adopt bootstraps `nx.json` itself. Sequence: Scan → Product
  Brief Extract → Design System Extract → Architecture Extract → Infra Adoption →
  first Bet.

The brownfield codebase comes from one of two sources:

| Source | Flag | What it is |
|---|---|---|
| **Synthetic fixture** (default) | `--brownfield` | `tests/evals/fixtures/brownfield_monorepo/00_codebase` — a tiny two-service repo. Offline, deterministic, fast. Proves the flow runs; too small to stress the scan phase. |
| **Real GitHub repo** | `--repo=owner/repo[@ref]` | Any repo, cloned **once** into a gitignored cache at `.sandboxes/.cache/repos/<slug>` (recursing submodules) and reused across runs — `--refresh` re-pulls, `./dev test clean` clears it. The first clone of a large monorepo is slow (~1 min); subsequent runs reuse the cache in seconds. Requires `gh` auth (works for private repos + private submodules). Not reproducible for anyone without repo access → they fall back to the fixture. `@ref` pins the umbrella commit (and, via gitlinks, its submodules) for determinism. |

> A real multi-service monorepo (4 services, ~1600 files) scanned by a live Opus
> session across scan + four extract phases is a long, expensive run — reserve it
> for deliberate deep runs, not casual iteration.

> **Pin the model before a review run.** Set Opus (`/model`) before kicking off a flow
> you intend to assess — a Sonnet run grinds the review loop harder (weaker first drafts →
> more revise cycles) and muddies whether a defect is a skill weakness or a model weakness.
> `render_transcript.py` records the model that actually ran in the review header, so check
> it there before drawing conclusions from a transcript.

Every sandbox carries a `CLAUDE.md` boundary file asserting it is a user project,
not the framework repo — without it, a chat opened in the nested sandbox would
inherit this repo's contributor skill and think it is building GroundWork. (When
seeding from a real repo, this boundary file replaces any `CLAUDE.md` the source
carried.)

#### Personas — the coverage knob

Personas live in `tests/evals/scenarios/<suite>/suite.json` (`user_persona` +
`user_goal`). The simulated user is the test's input oracle: a bland
"looks great, commit it" persona makes a test that always passes. The current
suites are **cooperative** by design while the harness is shaken out; adversarial
variants (ambiguous, contradictory, terse) are the lever for deeper coverage and
are added as additional suites.

#### Assessment

There is no automated pass/fail — the verdict is a human reading two surfaces:

```bash
./dev sandbox review <name>      # → .sandboxes/<name>-review/
```

1. **`conversation.md`** — the rendered transcript (`scripts/render_transcript.py`).
2. **`checklist.md`** — a structural checklist (`scripts/sandbox_checklist.py`):
   a non-gating mechanical check of **durable** artifacts only — canonical
   `docs/*.md` present/non-empty/titled, `state.json` `project_type` + completed
   phases, and git commits. It deliberately ignores `.groundwork/cache/*` (deleted
   on commit — checking it reports false failures in a full-flow run) and
   frontmatter (GroundWork doc templates carry none).

For a **quality** verdict, open a *fresh* Claude Code chat in the sandbox and run
`/judge`. A fresh context is a genuine critic; a judge sharing the context that
wrote the docs would only rubber-stamp its own work. The judge is non-gating —
it tells you whether the output is good and where it is weak.

#### Checkpoints — resume mid-flow

A full flow is expensive to re-run when you only want to debug one phase.
Checkpoints snapshot a successful run's durable workspace (`docs/` +
`.groundwork/`, never `.agents/` — skills are always re-installed fresh) so a new
sandbox can be seeded to resume from that point:

```bash
./dev sandbox checkpoint capture <name> --as <label>   # snapshot a green run
./dev sandbox checkpoint list                           # list captured checkpoints
./dev sandbox <newname> --from=<label> --simulate       # resume from a checkpoint
```

Checkpoints are a **cache of the last green run**, not a frozen golden — when a
phase's output format changes, re-harvest the downstream checkpoints from a fresh
green run.

#### Suites and fixtures

| Path | Contents |
|---|---|
| `tests/evals/scenarios/<suite>/suite.json` | Persona + goal (the single source of truth, read by `seed_simulation.js`). |
| `tests/evals/scenarios/<suite>/NN_*.json` | Per-phase descriptors (skill path, durable `success_files`) — a phase-list hint. |
| `tests/evals/fixtures/brownfield_monorepo/00_codebase` | The existing codebase the brownfield path adopts. |
| `tests/evals/fixtures/<suite>/<phase>/` | Pre-baked per-phase workspaces (legacy seeds). |

> Note: `tests/evals/validate_scaffold.py` is **not** part of the flow harness —
> it is a scaffold boot-prober (a sibling of the scaffold tests). Run it via
> `./dev test validate`.

### Scaffold Test Harness

GroundWork uses an end-to-end scaffold harness to ensure generated projects correctly compile, initialize, and execute under real conditions.

### How It Works

The scaffold harness creates a fresh sandbox, uses the Nx generators to build a multi-service monorepo, and then stands up the entire local infrastructure via Docker Compose and native binary runners.

It operates in layers — run them cheapest-first to fail fast:

| Layer | File | What it checks | Speed |
|---|---|---|---|
| **Generation** | `test_generation.py` | Every combination of generator options produces the correct files and omits the correct ones. No compilation. | Fast (seconds) |
| **Contracts** | `test_contracts.py`, `test_brownfield_adopt.py` | Generator contracts beyond file shape: shipped `./dev` bundle is fresh vs its source, brownfield adopt/merge is idempotent and preserves existing app source + compose services. No Docker. | Fast (seconds) |
| **Compilation** | `test_compilation.py` | Pairwise subset of combos actually compile (`go build`, `pnpm tsc`, `uv sync`). Catches import/type errors. | Minutes |
| **End-to-End** | `test_scaffolds.py` | Full DX loop: generate, boot Docker, health-check services, run inner system tests. | Slow (requires Docker) |

The **Inner System Tests** (`src/generators/system-test-runner/files/test_system.py`) are generated into the sandbox and run inside the boot topology to verify cluster health, webhook rejection, load shedding, and cross-service communication.

### Running the Harness

Use the `./dev` CLI from the repo root. Run layers in order — generation first to catch structural regressions cheaply.

```bash
./dev test generation   # Fast: structural checks for every option combination
./dev test contracts    # Fast: bundle freshness + adopt-merge idempotency (no Docker)
./dev test compilation  # Medium: pairwise compile checks (go build / tsc / uv sync)
./dev test scaffolds    # Slow: full Docker boot + health checks + inner system tests
```

To inspect the generated environment after a full run, comment out the teardown in `test_scaffolds.py` — the sandbox persists at `.sandboxes/scaffolds/testloop/`.

---

## Dev CLI (`./dev`)

The repo ships a `./dev` bash script at the root for local development tasks. Run it
from the repo root. It sources `.env` automatically, so set `CLAUDE_API_KEY` there.

| Command | Description |
|---|---|
| `./dev sandbox [name] [--brownfield\|--repo=owner/repo[@ref]] [--simulate[=suite]] [--from=<label>] [--refresh]` | Scaffold a simulation sandbox (see Flow Testing) |
| `./dev sandbox review <name>` | Render transcript + structural checklist into `.sandboxes/<name>-review/` |
| `./dev sandbox checkpoint capture <name> --as <label>` / `list` | Snapshot a green run to resume from later |
| `./dev test nx` | Run Nx workspace unit tests |
| `./dev test generation` | Run generator structural tests (fast, all combinations) |
| `./dev test contracts` | Run scaffold contract tests (fast: bundle freshness, adopt-merge idempotency) |
| `./dev test compilation` | Run generator compilation tests (pairwise, go build / tsc / uv sync) |
| `./dev test scaffolds` | Run end-to-end scaffold boot tests (Docker, health checks, inner system tests) |
| `./dev test validate <suite>` | Manually probe a generated scaffold workspace (boots + health checks) |

**`.env` setup** — create a `.env` file at the repo root:
```
CLAUDE_API_KEY=your-key-here
```

The CLI sources this file before every command. Do not commit `.env`.

---

## Design Plans (`docs/plans/`)

Cross-cutting restructures are designed in a plan document before any slice executes. A plan is the unit of repo evolution the way a bet is the unit of product delivery — past plans are the design rationale for the repo's current shape, so read the plan that shaped a subsystem before reworking it. Active plans live directly in `docs/plans/`; once delivered, a plan moves to `docs/plans/archive/` (see that folder's README) — it stays as the rationale record rather than being deleted.

Every plan follows the house format (`docs/plans/archive/contract-grade-delivery.md` is the reference example):

- A header block: **Status** (PROPOSED, or EXECUTED with date and what remains), **Audience**, **Scope owner**.
- §0 mental model first — the thesis or reframe, before any task list.
- A findings table with stable IDs the workstreams reference.
- Lettered workstreams (WS-A…) of slices, each naming its files and an acceptance check.
- A decisions table, split into settled (with rationale) and open.
- Sequencing, and the gates that define "done".

Two rules keep plans trustworthy:

- **Verify the Status header against the working tree before executing from a plan.** Headers have gone stale repeatedly — slices were delivered without the header moving. The tree is the truth; the header is a claim.
- **Update the Status line in the same commit that executes slices**, so the next reader inherits a true claim.

---

## Shipping a Change That Touches Installed Projects

A GroundWork install is a deployment of the framework into a project, and `npx
groundwork-method update` is how that deployment tracks its source (design:
`docs/plans/archive/framework-upgrade-path.md`). Every installed artifact has an owner, recorded
per file in the project's `.groundwork/config/manifest.json`:

| Tier | What | Carry-forward rule |
|---|---|---|
| 1 | Framework-owned: `.agents/skills/`, `.groundwork/skills/`, `generators.json`, the `./dev` bundle + launcher | Clean-replaced on `update` — never edit these in a project |
| 2 | Framework-seeded, user-editable: `src/docs/` → `docs/`, `AGENTS.md`, `llms.txt` | Hash-classified on `update`: pristine → auto-refresh; edited → queued for the `groundwork-upgrade` skill to merge |
| 3 | Generator-produced: compose injections, `tests/system/`, `.dev/dev.config.json` | Provenance-recorded (`recordGeneratorProvenance` in `src/generators/shared/provenance.ts`); the upgrade skill regenerates with recorded options and reconciles |
| 4 | Project-owned, shape-versioned: `state.json`, `surfaces.json`, doc shapes, bet shapes | Never overwritten — carried forward by migrations |

**When your change needs a migration.** Skills are exempt (clean-copy carries them).
Everything else that ships into projects — `src/docs/`, `src/config/`, generator
templates, `cli-src/`, schema shapes, canonical doc shapes — needs one of:

- **A `cli` migration** (`migrations/<id>.js`) when the carry-forward is mechanical: a
  file to seed, a key to add, a JSON shape to bump. Runs inside `update`.
- **An `agent` migration** (`migrations/<id>/brief.md`, Detect/Transform/Accept) when it
  needs judgment: a doc rename, a new required section, a registry bootstrap. Executed by
  the `groundwork-upgrade` skill from the upgrade brief `update` compiles.
- **A `[no-migration]` annotation** on the changelog line when the change is additive and
  old installs genuinely need nothing (new generator, new optional doc). Tier-2 content
  changes never qualify — the refresh/merge path is how they propagate, but they still
  need the changelog line.

Start from `migrations/_template/`; the format and rules live in `migrations/README.md`.
Register the entry in `migrations/index.json` at the unreleased version, reference its id
from the changelog line — `[migration] … (gw-your-id)` — and prove it against a fixture
under `tests/fixtures/installs/`. The migration-coverage gate in `./dev test contracts`
fails when a shipped-surface change has neither a registry entry nor an annotation, and
the changelog↔registry cross-check fails when either side of the id reference is missing.

---

## Releasing

GroundWork versions with semver from `0.x`. Three version points must agree (decision D4 in
`docs/plans/archive/bmad-quality-uplift.md`): the npm package version, the `groundwork.version` stamp
the CLI writes into installed projects' `state.json`, and the operating contract's
`version` frontmatter (bumped only on breaking protocol changes).

Release checklist:

1. Move the `## [Unreleased]` content in `CHANGELOG.md` under a new `## [X.Y.Z] - <date>` heading.
   Prefix any entry that requires action in an existing installation with `[migration]` —
   `npx groundwork update` surfaces those lines to users when it detects a version jump.
   Keep each `[migration]` entry on a single line ending with its registry id in parens
   (see Shipping a Change That Touches Installed Projects); purely additive changes that
   old installs don't need carry `[no-migration]` instead.
2. Bump `package.json` (`npm version <minor|patch> --no-git-tag-version`). Bump the operating
   contract's `version` frontmatter only if a protocol changed incompatibly, and add a
   `[migration]` changelog entry when you do.
3. Rebuild the dev bundle: `npm run build:dev-cli`. The bundle embeds the package version
   (`./dev --version`), so every version bump changes it — a stale committed bundle fails
   the freshness contract test.
4. Verify every new `migrations/index.json` entry is exercised by a fixture under
   `tests/fixtures/installs/` (add the pre-change shape if no existing fixture covers it).
5. Run the cheap gates locally: `./dev test generation && ./dev test contracts && ./dev test cli`.
   Contracts includes the migration-coverage gate and the changelog↔registry cross-check.
6. Commit, tag `vX.Y.Z`, push the tag. `.github/workflows/release.yml` verifies tag ↔
   package.json ↔ CHANGELOG agreement, runs the gates, and publishes.

> The package publishes as `groundwork-method` (the bare npm name `groundwork` is held by an
> unrelated package — aniftyco/groundwork). The release workflow publishes **for real** and
> requires the `NPM_TOKEN` repository secret; there is no dry-run gate.

---

## Contribution Patterns

### Adding a new methodology skill
1. Create `src/hidden-skills/<skill-name>/` with a single `instructions.md` as the canonical instruction file, opening with YAML frontmatter carrying `name` (the directory name, exactly) and `description`. Do not add a separate `SKILL.md` — only registered skills and the engineer/writer skills use `SKILL.md` as their canonical file.
2. Add a reference to load `operating-contract.md` at the top of the skill's instructions, naming the contract major version: `(contract v1)` appended to the path reference.
3. Add the skill to the Skill Paths table in `src/skills/groundwork-orchestrator/SKILL.md` so the orchestrator can route to it.
4. Add a `groundwork-writer` reference to the skill's instructions (see Writer Enforcement below).
5. If the skill produces working files, write them to `.groundwork/cache/` and delete on commit.
6. If the skill produces final deliverables, write them to `docs/`.
7. Test the full install flow: run `npx groundwork init` in a separate test repo and verify the skill appears in `.groundwork/skills/`.

### Adding a new registered skill
Only do this if the skill genuinely needs to be always visible in the agent toolchain.
The default answer is: it should be a hidden skill instead.
If it must be registered, add it to `src/skills/` and test that it appears in `.agents/skills/` after init.

### Updating the CLI
The CLI is a single file at `bin/groundwork.js`. Keep it simple. The CLI's job is file
copying and user messaging — methodology and intelligence belong in skills, not scripts.

### Updating the scaffolded `./dev` CLI
The `./dev` CLI that ships into generated projects is a TypeScript program under
`src/generators/workspace-dev-cli/cli-src/`, bundled by esbuild into a single
zero-dependency file at `cli-src/dist/dev-bundle.js`. The `workspace-dev-cli` generator
copies that bundle in verbatim (raw `tree.write`, never through EJS) alongside a `dev`
launcher and a `.dev/dev.config.json` projected from `.groundwork/config/brand-tokens.json`.

**After editing anything in `cli-src/`, rebuild the bundle** — `npm run build:dev-cli` (also
run as part of `npm run build` and `prepublishOnly`). The committed bundle is what ships, so
a stale bundle ships stale behavior. The render/theme layer in `cli-src/src/theme/` is a
deliberately self-contained module (it consumes brand tokens and nothing project-specific)
so it can be shared with a future `cli-app` product generator.

### The two writer skills

This repo has two writer skills with different names, audiences, and purposes.
They are not interchangeable.

| Skill | Location | Purpose | Ships? |
|---|---|---|---|
| **`skill-writer`** | `.agents/skills/skill-writer/` | How to **design skill instructions** — pacing, intent vs scripts, mental models, expert peer stance | ❌ Dev-only |
| **`groundwork-writer`** | `src/hidden-skills/groundwork-writer/` | How to **write output documents** — tone, structure, frontmatter, llms.txt | ✅ Ships as hidden skill |

**Rule: edit only the file that matches your current task.**

- Writing or improving a skill's `instructions.md` or `SKILL.md`? → `skill-writer`
- Improving how GroundWork output docs read in user projects? → `groundwork-writer`

Changes to one do not apply to the other. They diverge intentionally.
If a change belongs in both, apply it explicitly to both and note it in the commit.


---

## Writer Enforcement

Every skill that produces a document **must** reference the `groundwork-writer` skill.
This ensures consistent tone, structure, and agent-native scaffolding across all outputs.

**How to add it:** Place a single directive at the point where the skill produces its
output file. Example:

> Apply the `groundwork-writer` skill when producing any output document. All generated
> docs must follow GroundWork tone: declarative, assertive, zero-hedging.

**Current enforcement status:**

| Skill | Writer Reference |
|---|---|
| Product Brief | ✅ Stage 3 drafting |
| Design System | ✅ Stage 5 compilation |
| Architecture | ✅ Phase 6 draft |
| Scaffold | ✅ Phase 4 draft |
| MVP Planning | ✅ Phase 3 draft |
| Bet | ✅ Core directives |
| Update | ✅ Top-level mandate |
| Surface Activation | ✅ Top-level mandate |
| Docs Uplift | ✅ Content pass (Step 3) |

When adding a new skill, add the writer reference before submitting.

---

## Writing Standards

All documentation and skill files in this repo follow the writing standard defined in
`.agents/skills/skill-writer/SKILL.md`. Load that skill before writing or editing any
skill instruction file, contributor guide, or methodology document.
