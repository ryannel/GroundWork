---
name: groundwork-orchestrator
description: 'The GroundWork Orchestrator. Run this skill when the user wants to execute ANY GroundWork lifecycle task (what''s next, run a specific step). It owns all lifecycle knowledge, reads project state, and routes to the correct skill.'
---

# GroundWork Orchestrator

## Purpose
You are the GroundWork Orchestrator. You own the full lifecycle map for every project type. You read state, reconcile it against the filesystem, and either route to the next skill or report current status. No other skill makes lifecycle decisions.

---

## Lifecycle Map

### Greenfield Path
A greenfield project is one where the repo contains no application code — only config directories (`.git`, `.agents`, `docs`, `README.md`).

| Order | Phase | Skill | Artifact produced |
|-------|-------|-------|-------------------|
| 1 | Product Brief | `groundwork-product-brief` | `docs/product-brief.md` |
| 2 | UX Design | `groundwork-ux-design` | `docs/ux-design.md` |
| 3 | Architecture | `groundwork-architecture` | `docs/architecture.md` |
| 4 | Bet | `groundwork-bet` | `docs/bets/<name>.md` |

### Brownfield Path
A brownfield project is one where the repo contains application code (`src/`, `package.json`, `main.py`, etc.).

_Brownfield lifecycle is not yet defined. Treat brownfield projects as unsupported for now._

### Anytime (available regardless of phase)
- `groundwork-update` — surgical doc updates after code changes
- `groundwork-check` — staleness detection

---

## Skill Instruction Paths
| Skill | Instruction file |
|-------|-----------------|
| `groundwork-product-brief` | `.agents/groundwork/skills/groundwork-product-brief/instructions.md` |
| `groundwork-ux-design` | `.agents/groundwork/skills/groundwork-ux-design/instructions.md` |
| `groundwork-architecture` | `.agents/groundwork/skills/groundwork-architecture/instructions.md` |
| `groundwork-bet` | `.agents/groundwork/skills/groundwork-bet/instructions.md` |
| `groundwork-review` | `.agents/groundwork/skills/groundwork-review/instructions.md` |
| `groundwork-update` | `.agents/groundwork/skills/groundwork-update/instructions.md` |
| `groundwork-check` | `.agents/groundwork/skills/groundwork-check/instructions.md` |

---

## State Resolution

Run this on every invocation, before doing anything else. Execute these **in a single parallel tool call turn**:

1. `list_dir` on the project root — detect project type and validate artifact existence.
2. Read `.groundwork/config/state.json` — load recorded completed phases and project type.

### Project Type Detection
- If `project_type` in `.groundwork/config/state.json` is `null`: detect from the filesystem (greenfield vs brownfield) and write it back.
  - **Greenfield**: The repository contains no application code — only config directories (`.git`, `.agents`, `docs`, `README.md`).
  - **Brownfield**: The repository contains application files (`src/`, `package.json`, `main.py`, etc.).
- If already set: use the recorded value.

### Reconciliation
For each phase in the current project type's path:
- Check whether its artifact file exists on disk.
- If the artifact **exists** but the phase is **not** in `state.completed` → add it and write state.json back.
- If the artifact **does not exist** but the phase **is** in `state.completed` → remove it and write state.json back.

`.groundwork/config/state.json` is always kept accurate. It is the source of truth.

---

## Routing

After state resolution:

### User requests a specific skill
Match their intent to a skill in the Lifecycle Map. Briefly introduce the phase in a sentence or two, then load and execute the instruction file.

### User asks "what's next?" or "what should I do?"
1. Identify the first phase in the current project type's path that is **not** in `state.completed`.
2. Briefly introduce the phase — what it is and what it produces — in a sentence or two.
3. Load and execute the instruction file immediately.

### User asks for help or explanation
Explain GroundWork's methodology directly: the lifecycle phases, what each produces, and how they connect. Use the Lifecycle Map above as the source of truth.

---

## Critical Rules
- Never guess. Always load the instruction file for the target skill.
- Never hardcode a next step in a response. Derive it from the Lifecycle Map and current state every time.
- Write state.json back whenever it changes. Never leave it stale.
