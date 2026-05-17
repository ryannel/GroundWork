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
│   │   ├── groundwork-check/          ← Staleness detection skill.
│   │   └── groundwork-writer/         ← Writing style enforcer for user projects.
│   │
│   ├── hidden-skills/         → Copied to .agents/groundwork/skills/ (not agent-registered).
│   │   ├── groundwork-setup/          ← Brownfield/greenfield architecture scan.
│   │   ├── groundwork-product-brief/  ← Greenfield PM facilitation.
│   │   ├── groundwork-bet/            ← Bet/pitch shaping.
│   │   ├── groundwork-help/           ← What's-next orchestration.
│   │   ├── groundwork-update/         ← Surgical doc updates.
│   │   └── groundwork-ux-design/      ← UX design facilitation.
│   │
│   └── config/
│       └── groundwork-help.csv        ← Source copy of orchestration manifest.
│
├── .agents/                   ← Meta-skills for building GroundWork. NOT shipped to users.
│   └── skills/
│       ├── groundwork-contributor/    ← This skill. Always loaded in this repo.
│       ├── groundwork-writer/         ← Dev writing guide (diverges from src/ version over time).
│       └── skill-creator/             ← Anthropic skill creation workflow.
│
├── BMAD/                      ← Reference BMAD installation used for inspiration/comparison.
├── docs/                      ← Final output documents only (product-brief.md, ux-design.md, etc.).
├── llms.txt                   ← Agent discovery index for this repo's docs.
├── skills-lock.json           ← Tracks externally sourced skills (e.g. skill-creator).
├── .npmignore                 ← Excludes meta-skills and dev tooling from the npm package.
└── package.json               ← npm package config. Binary: groundwork → bin/groundwork.js
```

---

## The Two-Layer Skill Architecture

GroundWork uses a deliberate split between what users see and what the agent sees.

### Registered Skills (`src/skills/` → `.agents/skills/`)
The agent toolchain picks these up automatically. Every skill here appears in the model's
available skills list. Keep this list short — context window cost scales with every entry.

Currently only the **orchestrator** and **writer** live here. All methodology skills are
hidden behind the orchestrator's routing table.

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

## Contribution Patterns

### Adding a new methodology skill
1. Create `src/hidden-skills/<skill-name>/` with at minimum `SKILL.md` and `instructions.md`.
2. Add the skill to `src/config/groundwork-help.csv` so the orchestrator can route to it.
3. Add a `groundwork-writer` reference to the skill's instructions (see Writer Enforcement below).
4. If the skill produces working files, write them to `.groundwork/cache/` and delete on commit.
5. If the skill produces final deliverables, write them to `docs/`.
6. Test the full install flow: run `npx groundwork init` in a separate test repo and verify the skill appears in `.agents/groundwork/skills/`.

### Adding a new registered skill
Only do this if the skill genuinely needs to be always visible in the agent toolchain.
The default answer is: it should be a hidden skill instead.
If it must be registered, add it to `src/skills/` and test that it appears in `.agents/skills/` after init.

### Updating the CLI
The CLI is a single file at `bin/groundwork.js`. Keep it simple. The CLI's job is file
copying and user messaging — methodology and intelligence belong in skills, not scripts.

### Dev-time skills vs. product skills

This repo contains two separate writer skills with the same name. They serve different
purposes and must never be conflated.

| File | Purpose | Who uses it |
|---|---|---|
| `.agents/skills/groundwork-writer/SKILL.md` | Guides Antigravity when **building this repo** | Antigravity only, during contributor work |
| `src/skills/groundwork-writer/SKILL.md` | Ships to users via `npx groundwork init` | Users' agents in their projects |

**Rule: edit only the file that matches your current task.**

- Working on GroundWork's own docs, skills, or architecture? → `.agents/skills/groundwork-writer/`
- Improving the writer skill that users get in their projects? → `src/skills/groundwork-writer/`

Changes to one do not automatically apply to the other. They diverge intentionally over
time. If a change clearly belongs in both, apply it explicitly to both and note it in the
commit message.

**When in doubt:** if the task is "improve GroundWork the product," the answer is `src/`.
The `.agents/skills/` files are internal tools — touch them only when working on
GroundWork's own development experience.


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

All documentation and skill files in this repo follow the GroundWork writing standard:
assertive, declarative, zero-hedging. See `.agents/skills/groundwork-writer/SKILL.md`
for the full style guide.

Key rules:
- State facts. Do not hedge.
- Active voice. Actor → action → target.
- Inverted pyramid. Conclusion first, detail below.
- Prefer tables and lists over prose.
