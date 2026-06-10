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
│   ├── hidden-skills/         → Copied to .agents/groundwork/skills/ (not agent-registered).
│   │   ├── operating-contract.md      ← Shared protocols loaded by every methodology skill.
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
│   │   ├── groundwork-review/         ← Internal review panel for draft quality.
│   │   ├── groundwork-writer/         ← Writing style enforcer. Loaded on demand during output.
│   │   ├── groundwork-go-engineer/    ← Auto-installed alongside go-microservice generator output.
│   │   ├── groundwork-python-engineer/← Auto-installed alongside python-microservice generator output.
│   │   └── groundwork-nextjs-engineer/← Auto-installed alongside nextjs-app generator output.
│   │
│   └── config/
│       └── groundwork-state.json      ← Initial orchestration state seeded on init.
│
├── .agents/                   ← Meta-skills for building GroundWork. NOT shipped to users.
│   └── skills/
│       ├── groundwork-contributor/    ← This skill. Always loaded in this repo.
│       ├── skill-writer/              ← How to write skill instructions. Dev-only, not shipped.
│       └── skill-creator/             ← Anthropic skill creation workflow.
│
├── docs/                      ← GroundWork's own framework documentation (methodology, lifecycle, concepts).
│                                 NOT output from running GroundWork on this repo.
├── tests/                     ← Framework test suite. Tests GroundWork-as-a-tool, not a project built with it.
│   ├── evals/                 ← Simulation suites (personas + fixtures). Not a runner — see Flow Testing.
│   │   ├── scenarios/               ← One subdir per suite; suite.json defines the persona.
│   │   ├── fixtures/                ← Brownfield input codebase + legacy per-phase seed workspaces.
│   │   └── validate_scaffold.py     ← Scaffold boot-prober (./dev test validate); not the flow harness.
│   ├── scaffolds/             ← Deterministic generator tests (generation, compilation, scaffolds, contracts).
│   └── system/                ← System test templates; generated into scaffold sandboxes at test time.
├── llms.txt                   ← Agent discovery index for this repo's docs.
├── skills-lock.json           ← Tracks externally sourced skills (e.g. skill-creator).
├── .npmignore                 ← Excludes meta-skills and dev tooling from the npm package.
└── package.json               ← npm package config. Binary: groundwork → bin/groundwork.js
```

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
`.agents/groundwork/skills/operating-contract.md`. It governs:

- **Discovery Notes**: How out-of-phase signals are captured and carried forward.
- **Living Documents**: How existing docs are updated when new information surfaces —
  any phase, any bet, any direction.
- **Phase Lifecycle**: How each phase initializes, executes, commits, and hands off.

Every methodology skill loads this contract. The protocols are defined once and referenced
everywhere — never duplicated inline.

---

## The Two-Layer Skill Architecture

GroundWork uses a deliberate split between what users see and what the agent sees.

### Registered Skills (`src/skills/` → `.agents/skills/`)
The agent toolchain picks these up automatically. Every skill here appears in the model's
available skills list. Keep this list short — context window cost scales with every entry.

Currently the **orchestrator**, **check**, and **persona** live here. The orchestrator is the
central router — it determines the project mode and loads the right hidden skill. `groundwork-persona`
is an always-on conversational-posture skill (applied on every interaction) and is deliberately not in
the routing table. All methodology skills (product-brief, architecture, design-system, bet, writer) are
hidden behind the orchestrator's routing table to minimize always-on context cost.

### Hidden Skills (`src/hidden-skills/` → `.agents/groundwork/skills/`)
These are instruction files loaded on demand by the orchestrator. They are not registered
in the agent toolchain, so they consume no context until invoked. This is the correct home
for any new methodology skill (product-brief, setup, bet, design-system, etc.).

The orchestrator's routing table lives directly in `src/skills/groundwork-orchestrator/SKILL.md`.
When adding a new methodology skill, add a row to the Skill Paths table there.

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
└── cache/            # Transient — working files deleted when a skill completes
    ├── design-system-cache.md
    ├── product-brief-distillate.md
    └── scan-state.json
```

| Subdirectory | Purpose | Lifecycle |
|---|---|---|
| `config/` | Persistent settings and orchestration state | Seeded by installer, updated by skills, never bulk-deleted |
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

## How `npx groundwork init` Works

The CLI copies skills and seeds the `.groundwork/` directory:

| Source | Destination | What it contains |
|---|---|---|
| `src/skills/*` | `.agents/skills/` | Agent-registered skills |
| `src/hidden-skills/*` | `.agents/groundwork/skills/` | On-demand methodology instructions |
| `src/config/groundwork-state.json` | `.groundwork/config/state.json` | Initial orchestration state (created only if absent) |

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
depwire MCP server, none of which a hand-rolled loop can reproduce faithfully.

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

## Releasing

GroundWork versions with semver from `0.x`. Three version points must agree (decision D4 in
`docs/plans/bmad-quality-uplift.md`): the npm package version, the `groundwork.version` stamp
the CLI writes into installed projects' `state.json`, and the operating contract's
`version` frontmatter (bumped only on breaking protocol changes).

Release checklist:

1. Move the `## [Unreleased]` content in `CHANGELOG.md` under a new `## [X.Y.Z] - <date>` heading.
   Prefix any entry that requires action in an existing installation with `[migration]` —
   `npx groundwork update` surfaces those lines to users when it detects a version jump.
   Keep each `[migration]` entry on a single line; the CLI extracts the line, not the paragraph.
2. Bump `package.json` (`npm version <minor|patch> --no-git-tag-version`). Bump the operating
   contract's `version` frontmatter only if a protocol changed incompatibly, and add a
   `[migration]` changelog entry when you do.
3. Run the cheap gates locally: `./dev test generation && ./dev test contracts`.
4. Commit, tag `vX.Y.Z`, push the tag. `.github/workflows/release.yml` verifies tag ↔
   package.json ↔ CHANGELOG agreement, runs the gates, and publishes.

> The npm name `groundwork` is currently held by an unrelated package (aniftyco/groundwork).
> The release workflow publishes with `--dry-run` until the name is resolved — scope, rename,
> or transfer is an open product decision.

---

## Contribution Patterns

### Adding a new methodology skill
1. Create `src/hidden-skills/<skill-name>/` with a single `instructions.md` as the canonical instruction file, opening with YAML frontmatter carrying `name` (the directory name, exactly) and `description`. Do not add a separate `SKILL.md` — only registered skills and the engineer/writer skills use `SKILL.md` as their canonical file.
2. Add a reference to load `operating-contract.md` at the top of the skill's instructions, naming the contract major version: `(contract v1)` appended to the path reference.
3. Add the skill to the Skill Paths table in `src/skills/groundwork-orchestrator/SKILL.md` so the orchestrator can route to it.
4. Add a `groundwork-writer` reference to the skill's instructions (see Writer Enforcement below).
5. If the skill produces working files, write them to `.groundwork/cache/` and delete on commit.
6. If the skill produces final deliverables, write them to `docs/`.
7. Test the full install flow: run `npx groundwork init` in a separate test repo and verify the skill appears in `.agents/groundwork/skills/`.

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
| MVP Planning | ✅ Phase 4 draft |
| Bet | ✅ Core directives |
| Update | ✅ Top-level mandate |

When adding a new skill, add the writer reference before submitting.

---

## Writing Standards

All documentation and skill files in this repo follow the writing standard defined in
`.agents/skills/skill-writer/SKILL.md`. Load that skill before writing or editing any
skill instruction file, contributor guide, or methodology document.
