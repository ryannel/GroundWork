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

This repository is the source of the GroundWork npm package (`groundwork-method`, invoked
via `npx groundwork-method`). You are building the tool, not using it. The skills and config
in this repo shape what gets delivered to end users when they run `npx groundwork-method init`.

---

## Repository Map

```
groundWork/
├── bin/groundwork.js   ← CLI entry point: init, update, check, repo-map. Self-copy guard
│                          (`isSelfCopy`) excludes this repo's own .agents/skills/.
├── lib/repo-map/       ← Deterministic tree-sitter code-map engine (`repo-map` command). Ships.
├── src/                ← Everything that ships to users via npm.
│   ├── skills/           → Copied to .agents/skills/: groundwork-orchestrator (the only
│   │                        skill users see) + groundwork-check.
│   ├── hidden-skills/    → Copied to .groundwork/skills/ (invisible to any agent scanner).
│   │                        operating-contract.md + templates/, plus ~20 skill dirs grouped:
│   │                        setup facilitation, brownfield extraction (scan + 3 extract skills,
│   │                        infra-adopt), delivery (bet, patch, doc-sync, update, ...), support
│   │                        (review, writer, persona), discipline personas. See Two-Layer below.
│   ├── engineer-skills/  → NOT installed at init — promoted per language (go, python, nextjs,
│   │                        flutter, electron) into a scaffolded project's .agents/skills/.
│   ├── generators/       → Nx generators that scaffold real projects — the code the hidden
│   │                        skills instruct agents to run.
│   ├── docs/             → GroundWork's own framework docs, seeded into user projects
│   │                        (principles/, ways-of-working/, llms.txt); sync-anchored into
│   │                        skill references/.
│   └── config/           → Seed files: groundwork-state.json, config.toml.
├── .agents/skills/     ← Meta-skills for building GroundWork itself. NOT shipped
│                          (.npmignore): this skill, skill-writer, scaffold-designer,
│                          skill-creator + golang-pro (vendored).
├── docs/               ← GroundWork's own framework documentation (lifecycle/, principles/,
│                          plans/, examples/) — NOT output from running GroundWork on this repo.
├── migrations/         ← The migration registry (ships): index.json + cli modules + agent
│                          briefs. Format and rules: migrations/README.md.
├── scripts/            ← Dev-only scripts backing ./dev (lint_skills.py,
│                          check_sync_anchors.py, seed_simulation.js, ...). Not shipped.
├── tests/              ← Framework test suite (cli/, evals/, fixtures/, scaffolds/, system/) —
│                          tests GroundWork-as-a-tool, not a project built with it. Not shipped.
└── llms.txt · skills-lock.json · .npmignore · package.json · generators.json
```

### Multi-phase skill layout

A hidden skill whose session moves through distinct modes splits its instruction body into per-mode files that `instructions.md` routes to — loading only the active mode keeps the conversation in one mode at a time. The directory name signals what drives the routing:

| Directory | Used by | One file per | Routed by |
|---|---|---|---|
| `workflows/` | groundwork-bet | bet lifecycle phase | pitch `status` frontmatter |
| `phases/` | groundwork-architecture, groundwork-scaffold | conversation phase | phase status in the skill's cache file |
| `tracks/` | groundwork-design-system | interface type (plus `_foundation.md`, the brand-level flow run once) | `interface_types` |

A single phase file can itself shard into a step-file spine when its routing is complex enough to earn it: `groundwork-bet`'s delivery phase splits `workflows/04-delivery.md` into a thin spine (driver model, restrictions, git workflow, a state→step router) plus per-step files under `workflows/delivery/` (`step-0N-*.md` run in order; `on-*.md` and `topologies.md` load only when their trigger fires). The reader loads one step fully, executes it, and follows its transition line to the next — the same JIT discipline `workflows/` applies across phases, one level deeper.

`templates/` directories hold output skeletons, never instructions. `briefs/` directories hold **dispatched subagent instruction sets** — a self-contained brief a worker loads when the skill's driver spawns it as an isolated subagent (e.g. `groundwork-bet/briefs/slice-worker.md`, dispatched once per slice by the delivery driver). A brief is not routed by skill state; it is invoked by another part of the same skill, the way Protocol 9 dispatches `groundwork-review`. When restructuring a skill, keep the directory name that matches its routing shape — the convention is how a reader predicts a skill's internals without listing it.

---

## The GroundWork Lifecycle

GroundWork operates in two modes. **Setup** (one-time, per project) establishes the vision, design system, architecture, and service boundaries, then delivers the first bet: greenfield builds the docs from scratch through conversation (Product Brief → Design System → Architecture → Scaffolding → MVP Planning); brownfield reverse-engineers the same doc set from an existing codebase (Scan → Product Brief Extract → Design System Extract → Architecture Extract → Infra Adoption), additively bolting on the operational layer without regenerating the app. Both paths converge into the **Delivery Loop** (repeating, ongoing): Discovery → Refinement → Delivery of Bets, where any phase can refine any earlier document as the project learns; the orchestrator detects which path applies from the filesystem. Every methodology skill shares one set of behavioral protocols — Discovery Notes, Living Documents, Phase Lifecycle, and more — defined once in `src/hidden-skills/operating-contract.md` (ships to `.groundwork/skills/operating-contract.md`) and referenced everywhere, never duplicated inline. Read it before writing any new methodology skill.

---

## The Two-Layer Skill Architecture

GroundWork splits what an agent's skill scanner can discover from GroundWork's private, orchestrator-routed instruction set. The dividing line is the install directory, **not** the filename: only `.agents/skills/` is a skill-discovery root, so anything under `.groundwork/skills/` is invisible to the scanner regardless of whether its file is named `SKILL.md` or `instructions.md`.

**Registered skills** (`src/skills/` → `.agents/skills/`) are always in the model's available-skills list — keep this list short, context cost scales with every entry. Today only `groundwork-orchestrator` (the central router) and `groundwork-check` live here. **Hidden skills** (`src/hidden-skills/` → `.groundwork/skills/`) load on demand by the orchestrator's routing table (`src/skills/groundwork-orchestrator/SKILL.md` Skill Paths table) and cost no context until opened by path — the home for any new methodology skill; add a row to the Skill Paths table when you add one.

**Engineer skills** (`src/engineer-skills/{go,python,nextjs,flutter,electron}-engineer/`) are product deliverables, never installed at the GroundWork root — `promoteEngineerSkill()` (`src/generators/shared/scaffold-helpers.ts`) copies the matching one into a scaffolded project's `.agents/skills/` per language, the only place one becomes registered. Read their canon under `src/engineer-skills/` for in-repo work. `./dev check sync-anchors` pins every principle hash referenced by `src/hidden-skills/*` and `src/engineer-skills/*`, forcing a skill review in the same commit as a principle edit; a hash re-stamp must land with a commit-message line naming what was reconciled, since the gate only proves the review happened and the note is what proves what it found.

**Discipline-expert personas** (the design-side equivalent, same anatomy: `SKILL.md` + `sync-anchor.md` + `references/`) and the engineer skills share one template rule and one settled split (D12):

| Family | Skills | Template rule |
|---|---|---|
| Backend engineer | go-engineer, python-engineer, node-engineer | Copy the newest sibling in the same family |
| Surface engineer | nextjs-, flutter-, electron-engineer | Copy the newest sibling in the same family |
| Discipline persona | architect (feasibility), product (value + viability), designer (usability) | *Adopted within* a setup workflow and the bet lifecycle at decision points — never routed to on its own |

**Personas are self-contained** — their principles are distilled into the skill's own `references/` for that persona's decision-time lens, because tier-1 canon must survive a user editing or deleting the `src/docs/principles/` corpus, and an essay is the wrong shape to reason from at a decision point. **Engineer skills and bet briefs may defer to the corpus by live path instead**, since that corpus ships into the same project they run in.

Vendored skills (`golang-pro`, `skill-creator`, tracked in `skills-lock.json` with a SHA-256) keep their upstream voice — do not restyle them; recompute the lock hash only when you deliberately change one.

---

## File Storage Convention

GroundWork uses a two-tier file layout in user projects: `.groundwork/` is GroundWork's home directory (config, state, working drafts), `docs/` holds the living canonical outputs (`product-brief.md`, `design-system.md`, `architecture.md`, `infrastructure.md`, `bets/`) that later phases refine as the project learns — the Design System phase may sharpen the Product Brief, Architecture may refine both.

| Subdirectory | Purpose | Lifecycle |
|---|---|---|
| `.groundwork/config/` | Persistent settings and orchestration state | Seeded by installer, updated by skills, never bulk-deleted |
| `.groundwork/context/` | Downstream Context store — each setup phase's cross-phase contract (Protocol 5), read by later setup phases | Created at each phase's commit; the whole store is deleted once, at Setup Graduation (Protocol 10) |
| `.groundwork/cache/` | Stage-gated drafts, scan progress, overflow context | Created at skill execution start, deleted on successful commit |

**Never write final deliverables to `.groundwork/`.** Final outputs go to `docs/`.

---

## Cross-Phase Contracts

The phases communicate through shared artifacts and identifiers, each written by one skill and read by others — usually in different files, often different sessions — so a change to any writer must update every reader in the same change (identifier drift is silent: a consumer reading a stale shape finds nothing, with no error). Before any cross-cutting restructure, read `references/cross-phase-contracts.md` — it is the full map of those chains and the place those assumptions hide.

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

> Everything in `tests/` tests GroundWork **as a framework**. The eval harness runs a
> hidden skill against a simulated user to verify it behaves correctly; the scaffold
> harness generates a project with GroundWork's generators and boots it to verify the
> output compiles and runs. Neither is a project being built _with_ GroundWork — both
> are automated probes of GroundWork itself.

The scaffold harness runs in layers — cheapest first, to fail fast:

| Layer | File | What it checks | Speed |
|---|---|---|---|
| **Generation** | `test_generation.py` | Every generator-option combination produces the right files and omits the wrong ones. No compilation. | Fast |
| **Contracts** | `test_contracts.py`, `test_brownfield_adopt.py` | Shipped `./dev` bundle is fresh vs its source; brownfield adopt/merge is idempotent. No Docker. | Fast |
| **Compilation** | `test_compilation.py` | Pairwise combos actually compile (`go build`, `pnpm tsc`, `uv sync`). | Minutes |
| **End-to-End** | `test_scaffolds.py` | Full DX loop: generate, boot Docker, health-check services, run inner system tests. | Slow (Docker) |

Run them in order: `./dev test generation`, `contracts`, `compilation`, `scaffolds`. The
**simulation harness** (`./dev sim`) is the fifth layer — real Claude Code sessions that
prove the methodology itself, driven end to end as `sim run → sim follow → sim assess →
grade findings.md`. Before driving or debugging one, read `references/testing.md` — the
driver loop, run records, the coverage matrix, checkpoints, and the suite/fixture layout
live there, alongside the scaffold harness's fuller mechanics.

---

## Dev CLI (`./dev`)

The repo ships a `./dev` bash script at the root for local development tasks. Run it from the repo root.

| Command | Description |
|---|---|
| `./dev sim run <name> [--path=…] [--suite=…] [--model=<m>] [--until=<phase>] [--attended]` | Provision + launch a flow simulation in a detached background session — `references/testing.md` |
| `./dev sim follow <name>` | Block until the session finishes; print a digest (phases, commits, conversation tail) |
| `./dev sim assess <name>` | Produce the review bundle: transcript + bound-aware checklist + judge verdict + findings scaffold |
| `./dev sim status <name>` / `list` / `stop <name>` | Recorded runs + live sessions (`--json`) / latest run per sandbox / stop a session |
| `./dev sim judge <name>` / `suites` | Fresh-context `/judge` session by itself / scenario suites with last-run info |
| `./dev sim checkpoint capture <name> --as <label>` / `list` | Snapshot a green run (corpus-stamped); `list` flags stale checkpoints |
| `./dev sandbox [name] [--brownfield\|--repo=owner/repo[@ref]] [--simulate[=suite]] [--from=<label>] [--refresh]` | Provision a sandbox by itself (called by `sim run`) — `references/testing.md` |
| `./dev sandbox review <name>` | Mechanical-only review (transcript + checklist); `sim assess` supersedes it for sim runs |
| `./dev ci` | Reproduce the required CI build locally — run before every release, `references/releasing.md` |
| `./dev test nx` | Run Nx workspace unit tests |
| `./dev test generation` | Generator structural tests (fast, all combinations) |
| `./dev test contracts` | Scaffold contract tests (fast: bundle freshness, adopt-merge idempotency) |
| `./dev test cli` | groundwork CLI contract tests (init/update/check in scratch repos) |
| `./dev test compilation` | Generator compilation tests (pairwise, go build / tsc / uv sync) |
| `./dev test scaffolds` | End-to-end scaffold boot tests (Docker, health checks, inner system tests) |
| `./dev test validate <suite>` | Manually probe a generated scaffold workspace |
| `./dev lint skills` | Mechanical skill conformance (frontmatter, contract refs, review gates, headers, routing, llms links, doc pairs, index, writer refs) |
| `./dev check sync-anchors` | Verify engineer/persona sync anchors match principle file hashes |

---

## Design Plans (`docs/plans/`)

Cross-cutting restructures are designed in a plan document before any slice executes. A plan is the unit of repo evolution the way a bet is the unit of product delivery — past plans are the design rationale for the repo's current shape, so read the plan that shaped a subsystem before reworking it. Active plans live in `docs/plans/`; once delivered, a plan moves to `docs/plans/archive/` (see that folder's README) as the rationale record, not deleted.

Every plan follows the house format (`docs/plans/archive/contract-grade-delivery.md` is the reference example): header block (**Status**, **Audience**, **Scope owner**); §0 mental model first; a findings table with stable IDs the workstreams reference; lettered workstreams (WS-A…) of slices, each naming its files and an acceptance check; a decisions table split settled/open; sequencing and the gates that define "done".

Two rules keep plans trustworthy: **verify the Status header against the working tree before executing** (headers have gone stale repeatedly — the tree is the truth, the header a claim), and **update the Status line in the same commit that executes slices**.

---

## Shipping a Change That Touches Installed Projects

A GroundWork install is a deployment of the framework into a project, and `npx
groundwork-method update` is how that deployment tracks its source (design:
`docs/plans/archive/framework-upgrade-path.md`). Every installed artifact has an owner, recorded
per file in the project's `.groundwork/config/manifest.json`:

| Tier | What | Carry-forward rule |
|---|---|---|
| 1 | Framework-owned: `.agents/skills/`, `.groundwork/skills/`, `generators.json`, the `./dev` bundle + launcher | Clean-replaced on `update` — never edit these in a project |
| 2 | Framework-seeded, user-editable: `src/docs/` → `docs/`, `AGENTS.md`, `llms.txt` | Hash-classified on `update`: pristine → auto-refresh; edited → queued for the `groundwork-update` skill to merge (Phase A) |
| 3 | Generator-produced: compose injections, `tests/system/`, `.dev/dev.config.json` | Provenance-recorded (`recordGeneratorProvenance` in `src/generators/shared/provenance.ts`); the `groundwork-update` skill regenerates with recorded options and reconciles |
| 4 | Project-owned, shape-versioned: `state.json`, `surfaces.json`, doc shapes, bet shapes | Never overwritten — advanced in place by the `groundwork-update` skill's reconcile pass (Family Index), or a `cli` migration for a mechanical shape bump |

**When your change needs a migration — or a reconcile family.** Skills are exempt
(clean-copy carries them). Everything else that ships into projects — `src/docs/`,
`src/config/`, generator templates, `cli-src/`, schema shapes, canonical doc shapes —
needs one of:

- **A `cli` migration** (`migrations/<id>.js`) when the carry-forward is mechanical: a
  file to seed, a key to add, a JSON shape to bump, a dead artifact to delete. Runs inside
  `update`. Register it in `migrations/index.json` and reference its id from the changelog
  line — `[migration] … (gw-your-id)`.
- **A reconcile family** in the `groundwork-update` skill's Family Index when the
  carry-forward needs judgment: a doc rename, a new required section, a structural
  relocation, a registry bootstrap. Do **not** author a per-change migration — add or
  extend a family (owner → legacy signal → advance), and the skill's Phase B reconcile
  advances legacy instances against the current canonical. Annotate the changelog line
  `[no-migration]` (the reconcile is not a registry migration).
- **A plain `[no-migration]` annotation** on the changelog line when the change is additive
  and old installs genuinely need nothing (new generator, new optional doc). Tier-2 content
  changes never qualify — the refresh/merge path is how they propagate, but they still
  need the changelog line.

For a `cli` migration, start from `migrations/_template/cli-migration.js`; the format and
rules live in `migrations/README.md`. Prove it against a fixture under
`tests/fixtures/installs/`. The migration-coverage gate in `./dev test contracts` fails
when a shipped-surface change has neither a registry entry nor a `[no-migration]`
annotation, and the changelog↔registry cross-check fails when either side of an id
reference is missing.

---

## Releasing

Releasing has a checklist — read `references/releasing.md` before cutting a version.

---

## Contribution Patterns

### Adding a new methodology skill
1. Create `src/hidden-skills/<skill-name>/` with a single `instructions.md` as the canonical file, opening with YAML frontmatter (`name` = the directory name, exactly; `description`). No separate `SKILL.md` — only registered and engineer/writer skills use that filename.
2. Reference `operating-contract.md` at the top of the instructions, naming the contract major version: `(contract v1)`.
3. Add the skill to the Skill Paths table in `src/skills/groundwork-orchestrator/SKILL.md`.
4. If the skill produces a document, reference `groundwork-writer` at the point it produces output — every document-producing hidden skill must reference it somewhere in its tree (canonical file or a dispatched brief). Mechanical, not a judgment call: `./dev lint skills` fails the build otherwise.
5. Working files go to `.groundwork/cache/`, deleted on commit; final deliverables go to `docs/`.
6. Test the full install flow: run `npx groundwork-method init` in a separate test repo and verify the skill appears in `.groundwork/skills/`.

### Adding a new registered skill
Only if it genuinely needs to be always visible in the agent toolchain — the default
answer is a hidden skill instead. Add it to `src/skills/` and test that it appears in
`.agents/skills/` after init.

### Updating the CLI
The CLI is a single file at `bin/groundwork.js`. Keep it simple. The CLI's job is file
copying and user messaging — methodology and intelligence belong in skills, not scripts.

### Updating the scaffolded `./dev` CLI
It's a TypeScript program under `src/generators/workspace-dev-cli/cli-src/`, bundled by
esbuild into `cli-src/dist/dev-bundle.js`, which the `workspace-dev-cli` generator copies
in verbatim. **After editing anything in `cli-src/`, rebuild the bundle** —
`npm run build:dev-cli` — or the committed (and shipped) bundle goes stale.

### The two writer skills

Two writer skills, not interchangeable — edit only the one matching your current task:

| Skill | Location | Purpose | Ships? |
|---|---|---|---|
| **`skill-writer`** | `.agents/skills/skill-writer/` | How to **design skill instructions** — pacing, intent vs scripts, mental models, expert peer stance | ❌ Dev-only |
| **`groundwork-writer`** | `src/hidden-skills/groundwork-writer/` | How to **write output documents** — tone, structure, frontmatter, llms.txt | ✅ Ships as hidden skill |

Writing or improving a skill's `instructions.md`/`SKILL.md`? → `skill-writer`. Improving
how GroundWork output docs read in user projects? → `groundwork-writer`. They diverge
intentionally; if a change belongs in both, apply it explicitly to both and note it in the commit.

---

## Writing Standards

All documentation and skill files in this repo follow the writing standard defined in
`.agents/skills/skill-writer/SKILL.md`. Load that skill before writing or editing any
skill instruction file, contributor guide, or methodology document.
