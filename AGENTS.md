# CLAUDE.md

Authoritative guidance for this repo lives in `.agents/`. This file only routes.

## Required reading

Before doing any work in this repo, load:

- `.agents/skills/groundwork-contributor/SKILL.md` — repo orientation, architecture, lifecycle, test infrastructure, and contribution patterns. This is the always-on guide for working inside GroundWork.

## Skill routing

Other skills are loaded on demand by description. Match the task, then read the corresponding `SKILL.md` at the path shown:

| Task | Skill |
|---|---|
| Write or edit a `SKILL.md` / instructions file in this repo | `.agents/skills/skill-writer/` |
| Create a new skill from scratch, or eval/optimize an existing one | `.agents/skills/skill-creator/` |
| Design a new Nx scaffold/generator (microservice, test runner, library) | `.agents/skills/scaffold-designer/` |
| Go implementation work (services, handlers, concurrency, gRPC) | `src/engineer-skills/groundwork-go-engineer/` |
| Python implementation work (services, FastAPI, async, ML pipelines) | `src/engineer-skills/groundwork-python-engineer/` |
| Next.js / React / frontend work | `src/engineer-skills/groundwork-nextjs-engineer/` |
| Flutter / mobile work | `src/engineer-skills/groundwork-flutter-engineer/` |
| Electron / desktop work | `src/engineer-skills/groundwork-electron-engineer/` |

## Rules

- `.agents/` is authoritative. If this file conflicts with a skill there, the skill wins.
- Engineer-skill canon lives in `src/engineer-skills/` — the contributor guide's Two-Layer Skill Architecture covers how it ships.
- Do not duplicate skill content here. Update the skill instead.
- `.agents/skills/` is dev-only and excluded from the npm package — never reference it as user-facing behavior.
