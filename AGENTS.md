# CLAUDE.md

Authoritative guidance for this repo lives in `.agents/`. This file only routes.

## Required reading

Before doing any work in this repo, load:

- `.agents/skills/groundwork-contributor/SKILL.md` — repo orientation, architecture, lifecycle, test infrastructure, and contribution patterns. This is the always-on guide for working inside GroundWork.

## Skill routing

Other skills under `.agents/skills/` are loaded on demand by description. Match the task, then read the corresponding `SKILL.md`:

| Task | Skill |
|---|---|
| Write or edit a `SKILL.md` / instructions file in this repo | `.agents/skills/skill-writer/` |
| Create a new skill from scratch, or eval/optimize an existing one | `.agents/skills/skill-creator/` |
| Design a new Nx scaffold/generator (microservice, test runner, library) | `.agents/skills/scaffold-designer/` |
| Go implementation work (services, handlers, concurrency, gRPC) | `.agents/skills/groundwork-go-engineer/` |
| Python implementation work (services, FastAPI, async, ML pipelines) | `.agents/skills/groundwork-python-engineer/` |
| Next.js / React / frontend work | `.agents/skills/groundwork-nextjs-engineer/` |

## Rules

- `.agents/` is authoritative. If this file conflicts with a skill there, the skill wins.
- Exception: the three engineer skills (`groundwork-go-engineer`, `groundwork-python-engineer`, `groundwork-nextjs-engineer`) under `.agents/skills/` are read-only mirrors of their canon in `src/hidden-skills/`. Edit the canon and copy over the mirror — `./dev test contracts` fails on drift.
- Do not duplicate skill content here. Update the skill instead.
- `.agents/skills/` is dev-only and excluded from the npm package — never reference it as user-facing behavior.
