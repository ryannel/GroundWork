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
│       └── groundwork-help.csv        ← Orchestration manifest. Maps intents → skill files.
│
├── .agents/                   ← Meta-skills for building GroundWork. NOT shipped to users.
│   └── skills/
│       ├── groundwork-contributor/    ← This skill. Always loaded in this repo.
│       ├── groundwork-writer/         ← Dev writing guide (diverges from src/ version over time).
│       └── skill-creator/             ← Anthropic skill creation workflow.
│
├── BMAD/                      ← Reference BMAD installation used for inspiration/comparison.
├── docs/                      ← GroundWork's own architecture docs (dogfooding).
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

## How `npx groundwork init` Works

The CLI copies three things from this repo into the user's project:

| Source | Destination | What it contains |
|---|---|---|
| `src/skills/*` | `.agents/skills/` | Agent-registered skills |
| `src/hidden-skills/*` | `.agents/groundwork/skills/` | On-demand methodology instructions |
| `src/config/groundwork-help.csv` | `.agents/config/groundwork-help.csv` | Orchestration routing manifest |

The `.agents/skills/` directory inside this source repo is explicitly excluded by the
self-copy guard in `bin/groundwork.js` (line ~59). This prevents the dev meta-skills
from being installed into user projects.

---

## Contribution Patterns

### Adding a new methodology skill
1. Create `src/hidden-skills/<skill-name>/` with at minimum `SKILL.md` and `instructions.md`.
2. Add the skill to `src/config/groundwork-help.csv` so the orchestrator can route to it.
3. Test the full install flow: run `npx groundwork init` in a separate test repo and verify the skill appears in `.agents/groundwork/skills/`.

### Adding a new registered skill
Only do this if the skill genuinely needs to be always visible in the agent toolchain.
The default answer is: it should be a hidden skill instead.
If it must be registered, add it to `src/skills/` and test that it appears in `.agents/skills/` after init.

### Updating the CLI
The CLI is a single file at `bin/groundwork.js`. Keep it simple. The CLI's job is file
copying and user messaging — methodology and intelligence belong in skills, not scripts.

### Dev-time skills vs. product skills
The `.agents/skills/` directory in this repo holds skills that help build GroundWork —
they are not part of the product. The `src/skills/` directory holds skills that are the
product. These diverge over time.

- `groundwork-writer` in `.agents/skills/` → guides Antigravity when editing this repo
- `groundwork-writer` in `src/skills/` → ships to users, guides their agents

Do not conflate them. Changes to one do not automatically apply to the other.

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
