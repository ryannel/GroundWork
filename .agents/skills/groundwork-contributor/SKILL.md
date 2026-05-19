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
│   │   ├── groundwork-setup/          ← Brownfield/greenfield architecture scan.
│   │   ├── groundwork-product-brief/  ← Greenfield PM facilitation.
│   │   ├── groundwork-architecture/   ← Architecture facilitation.
│   │   ├── groundwork-bet/            ← Bet/pitch shaping.
│   │   ├── groundwork-help/           ← What's-next orchestration.
│   │   ├── groundwork-update/         ← Surgical doc updates.
│   │   ├── groundwork-ux-design/      ← UX design facilitation.
│   │   ├── groundwork-review/         ← Internal review panel for draft quality.
│   │   └── groundwork-writer/         ← Writing style enforcer. Loaded on demand during output.
│   │
│   └── config/
│       └── groundwork-help.csv        ← Source copy of orchestration manifest.
│
├── .agents/                   ← Meta-skills for building GroundWork. NOT shipped to users.
│   └── skills/
│       ├── groundwork-contributor/    ← This skill. Always loaded in this repo.
│       ├── skill-writer/              ← How to write skill instructions. Dev-only, not shipped.
│       └── skill-creator/             ← Anthropic skill creation workflow.
│
├── BMAD/                      ← Reference BMAD installation used for inspiration/comparison.
├── docs/                      ← GroundWork's own framework documentation (methodology, lifecycle, concepts).
│                                 NOT output from running GroundWork on this repo.
├── tests/                     ← Framework test suite. Tests GroundWork-as-a-tool, not a project built with it.
│   ├── evals/                 ← Conversational evaluation harness for hidden skills.
│   │   ├── conversational_eval.py   ← Main harness runner.
│   │   ├── scenarios/               ← One subdirectory per suite; suite.json defines shared persona.
│   │   ├── cache/                   ← Persisted sandbox state per scenario (used by depends_on).
│   │   └── transcripts/             ← Timestamped run transcripts (never overwritten).
│   ├── scaffolds/             ← End-to-end scaffold generation and integration tests.
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
delivers the first working bet. Two paths depending on what exists:

| Path | Flow | Source of truth |
|---|---|---|
| **Greenfield** | Product Brief → UX Design → Architecture → MVP Bet | Collaborative discovery with the user. The repo is empty. |
| **Brownfield** | Repo Scan + User Interview → Brief, Design, Architecture docs → Next Bet | Automated repo analysis combined with user interview. |

Greenfield builds the docs from scratch through conversation. Brownfield reconstructs them —
the agent scans the repo to understand what's already built, then fills the gaps through
targeted questions with the user. Both paths converge: once the docs exist and the first
bet ships, the project enters the Delivery Loop.

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

Currently only the **orchestrator** and **check** live here. The orchestrator is the
central router — it determines the project mode and loads the right hidden skill. All
methodology skills (product-brief, architecture, ux-design, bet, writer) are hidden behind
the orchestrator's routing table to minimize always-on context cost.

### Hidden Skills (`src/hidden-skills/` → `.agents/groundwork/skills/`)
These are instruction files loaded on demand by the orchestrator. They are not registered
in the agent toolchain, so they consume no context until invoked. This is the correct home
for any new methodology skill (product-brief, setup, bet, ux-design, etc.).

The orchestrator maps user intents → hidden skill paths via `src/config/groundwork-help.csv`.
When adding a new methodology skill, update the CSV manifest.

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
│   ├── config.toml   # Project classification (greenfield/brownfield)
│   ├── state.json    # Orchestration phase tracking
│   └── help.csv      # Orchestration routing manifest
└── cache/            # Transient — working files deleted when a skill completes
    ├── ux-design-cache.md
    ├── product-brief-distillate.md
    └── scan-state.json
```

| Subdirectory | Purpose | Lifecycle |
|---|---|---|
| `config/` | Persistent settings, orchestration state, routing manifest | Seeded by installer, updated by skills, never bulk-deleted |
| `cache/` | Stage-gated drafts, scan progress, overflow context | Created during skill execution, cleaned up on commit |

### `docs/` — Living Outputs

Canonical documents that represent the current best understanding of the project. These are
not frozen snapshots — later phases update earlier documents when new information refines or
expands what was established. UX Design may sharpen the Product Brief. Architecture may
refine both the Product Brief and UX Design. Each document grows as the project learns more.

| File | Purpose |
|---|---|
| `product-brief.md` | Product vision document |
| `ux-design.md` | Design system and NFRs |
| `architecture/` | Architecture docs (brownfield) |
| `bets/` | Bet pitches and plans |

### Cache Lifecycle Rules

- Skills **create** files in `.groundwork/cache/` at execution start.
- Skills **delete** their cache file on successful commit (e.g., UX Design deletes
  `ux-design-cache.md` after writing `docs/ux-design.md`).
- Stale cache files (>24h) are auto-archived by the setup skill.
- Never write final deliverables to `.groundwork/`. Final outputs go to `docs/`.

---

## How `npx groundwork init` Works

The CLI copies skills and seeds the `.groundwork/` directory:

| Source | Destination | What it contains |
|---|---|---|
| `src/skills/*` | `.agents/skills/` | Agent-registered skills |
| `src/hidden-skills/*` | `.agents/groundwork/skills/` | On-demand methodology instructions |
| `src/config/groundwork-help.csv` | `.groundwork/config/help.csv` | Orchestration routing manifest |
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

### Evaluation Harness

GroundWork ships a conversational evaluation harness at `tests/evals/`. It simulates
real user conversations against any hidden skill and verifies that the agent produces
the correct file outputs in an isolated sandbox.

### How It Works

The harness spins up two LLM agents per run:

| Agent | Role |
|---|---|
| **Skill Agent** | Runs the hidden skill under test. Has file tools (`read_file`, `write_file`, `append_file`, `list_directory`) scoped to the sandbox. |
| **User Agent** | Simulates the human. Driven by `user_persona` and `user_goal` from the suite config. Has no tools. |

The agents alternate turns. File operations by the Skill Agent are executed against
the live sandbox. At the end of the run, the sandbox state is preserved and copied
to `cache/` so later scenarios can depend on it.

### Directory Layout

```
tests/evals/
├── conversational_eval.py       ← Harness entry point
├── scenarios/
│   └── <suite-name>/
│       ├── suite.json            ← Shared user_persona and user_goal for all scenarios in this suite
│       ├── 01_product_brief.json ← Scenario 1
│       ├── 02_ux_design.json     ← Scenario 2 (depends_on: 01_product_brief)
│       └── ...                   ← Additional scenarios
├── cache/
│   └── <suite-name>/
│       └── <scenario-name>/      ← Sandbox snapshot saved after each run
└── transcripts/
    └── <suite-name>/
        └── <scenario>_<timestamp>.json   ← Timestamped; accumulates across runs

.sandboxes/evals/                 ← Live sandbox; wiped at run start, preserved after
```

### Scenario File Format

Each scenario is a JSON file:

```json
{
  "skill_name": "groundwork-product-brief",
  "skill_path": "src/hidden-skills/groundwork-product-brief/instructions.md",
  "turns": 35,
  "depends_on": "01_product_brief",
  "success_files": ["docs/product-brief.md"]
}
```

| Field | Required | Description |
|---|---|---|
| `skill_name` | Yes | Display name for logging |
| `skill_path` | Yes | Path to the `instructions.md` file, relative to repo root |
| `turns` | No | Max conversation turns (safety ceiling). Wins over `--turns` CLI flag. Hard-capped at `ABSOLUTE_MAX_TURNS` (50) in the harness to prevent cost blowouts. |
| `depends_on` | No | Scenario name whose cache to seed the sandbox with before running |
| `user_persona` | No | Overrides the suite-level persona for this scenario only |
| `user_goal` | No | Overrides the suite-level goal for this scenario only |
| `success_files` | No | List of file paths (relative to sandbox root) that signal task completion. The run stops as soon as all files exist — `turns` is only a safety ceiling. |

### Suite Config (`suite.json`)

Defines the shared user identity for all scenarios in the suite. Scenario files can
override both fields if a specific scenario needs a different persona.

```json
{
  "user_persona": "You are the Client/User building <product>. You are cooperative.",
  "user_goal": "Answer questions with short, natural responses. When the agent presents a draft, respond: 'Looks great, please commit it.'"
}
```

### Sandbox Lifecycle

1. **Wipe** — the `.sandboxes/evals/` directory is deleted at the start of every run.
2. **Init** — `groundwork init` runs inside the sandbox, installing the latest skills.
3. **Seed** — if `depends_on` is set, the named scenario's cache is copied in (excluding `.agents/` to preserve fresh skills).
4. **Run** — the Skill Agent and User Agent converse. The run ends when all `success_files` exist or the `turns` ceiling is reached.
5. **Preserve** — the sandbox is left intact after the run for debugging.
6. **Cache** — the sandbox is copied to `cache/<suite>/<scenario>/` for downstream scenarios.

### Running the Harness

Use the `./dev` CLI from the repo root. The `GEMINI_API_KEY` must be set in a `.env`
file at the repo root — the CLI sources it automatically.

```bash
./dev eval run <suite>             # Run all scenarios in a suite sequentially
./dev eval run <suite> <scenario>  # Run one specific scenario
./dev eval clean                   # Wipe cache and sandbox
```

**Example:**
```bash
./dev eval run storytelling_engine 02_ux_design
```

### Adding a New Scenario

1. Create a JSON file in `tests/evals/scenarios/<suite-name>/`.
2. Follow the scenario file format above.
3. Set `depends_on` if the scenario requires a prior phase's output to be present.
4. Set `turns` as a safety ceiling — high enough for the skill to complete its full flow including draft, review, and commit. Use `success_files` to end the run early when the expected outputs exist.
5. Run `./dev eval run <suite> <scenario>` and confirm the expected output files appear in `.sandboxes/evals/`.

### Adding a New Suite

1. Create `tests/evals/scenarios/<suite-name>/`.
2. Add `suite.json` with a `user_persona` and `user_goal` describing the project context and how the simulated user behaves.
3. Add scenario files numbered sequentially (`01_`, `02_`, etc.) to control execution order when using `--all`.
4. The `user_goal` must instruct the simulated user to respond `'Looks great, please commit it.'` when a draft is presented, so the commit step executes.

---

### Scaffold Test Harness

GroundWork uses an end-to-end scaffold harness to ensure generated projects correctly compile, initialize, and execute under real conditions.

### How It Works

The scaffold harness creates a fresh sandbox, uses the Nx generators to build a multi-service monorepo, and then stands up the entire local infrastructure via Docker Compose and native binary runners.

It operates in two layers:
1. **The Outer Harness (`tests/scaffolds/test_scaffolds.py`)**: Uses `pytest` to invoke the workspace generators, compile the code, scaffold the `.sandboxes/scaffolds/testloop` environment, and boot up the native services via the `./dev` CLI. It verifies they reach a healthy state and connect to PostgreSQL.
2. **The Inner System Tests (`src/generators/system-test-runner/files/test_system.py`)**: Generated directly into the scaffolded environment. These tests run inside the sandbox topology to verify cluster health, webhook rejection, load shedding, and cross-service communication.

### Running the Harness

Use the `./dev` CLI from the repo root to execute the scaffold test suite. 

```bash
./dev test scaffolds
```

This will run the full suite. To inspect the generated environment, you can temporarily comment out the teardown method in `test_scaffolds.py` so the sandbox persists at `.sandboxes/scaffolds/testloop/`.

---

## Dev CLI (`./dev`)

The repo ships a `./dev` bash script at the root for local development tasks. Run it
from the repo root. It sources `.env` automatically, so set `GEMINI_API_KEY` there.

| Command | Description |
|---|---|
| `./dev eval run <suite>` | Run all scenarios in a suite sequentially |
| `./dev eval run <suite> <scenario>` | Run one specific scenario |
| `./dev eval clean` | Wipe all eval caches and the sandbox |
| `./dev test nx` | Run Nx workspace unit tests |
| `./dev test scaffolds` | Run the end-to-end scaffold generation and integration harness |

**`.env` setup** — create a `.env` file at the repo root:
```
GEMINI_API_KEY=your-key-here
```

The CLI sources this file before every command. Do not commit `.env`.

---

## Contribution Patterns

### Adding a new methodology skill
1. Create `src/hidden-skills/<skill-name>/` with at minimum `SKILL.md` and `instructions.md`.
2. Add a reference to load `operating-contract.md` at the top of the skill's instructions.
3. Add the skill to `src/config/groundwork-help.csv` so the orchestrator can route to it.
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
| UX Design | ✅ Stage 5 compilation |
| Setup | ✅ Guidelines section |
| Bet | ✅ Core directives |
| Update | ✅ Top-level mandate |

When adding a new skill, add the writer reference before submitting.

---

## Writing Standards

All documentation and skill files in this repo follow the writing standard defined in
`.agents/skills/skill-writer/SKILL.md`. Load that skill before writing or editing any
skill instruction file, contributor guide, or methodology document.
