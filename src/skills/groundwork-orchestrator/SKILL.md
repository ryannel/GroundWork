---
name: groundwork-orchestrator
description: 'The GroundWork Orchestrator. Run this skill when the user wants to execute ANY GroundWork lifecycle task (what''s next, run a specific step). It owns all lifecycle knowledge, reads project state, and routes to the correct skill.'
---

# GroundWork Orchestrator

You own lifecycle routing. Read state, determine the mode, load the right skill. No other skill makes lifecycle decisions.

---

## State Resolution

Run this on every invocation. Execute these **in a single parallel tool call turn**:

1. `list_dir` on the project root — detect project type and validate artifact existence.
2. Read `.groundwork/config/state.json` — load recorded completed phases and project type.

### Project Type Detection
- If `project_type` is `null`: detect from the filesystem and write it back.
  - **Greenfield**: No application code — only `.git`, `.agents`, `docs`, `README.md`.
  - **Brownfield**: Application files exist (`src/`, `package.json`, `main.py`, etc.).
- If already set: use the recorded value.

### Reconciliation
For each phase in the current path, check whether its artifact exists on disk:
- Artifact **exists** but phase **not** in `state.completed` → add it.
- Artifact **does not exist** but phase **is** in `state.completed` → remove it.

Write `state.json` back whenever it changes.

---

## Routing

### Mode Detection

| State | Mode | Route to |
|---|---|---|
| Greenfield, setup incomplete | **Greenfield Setup** | Next phase skill (see table below) |
| All setup phases complete | **Delivery Loop** | `groundwork-bet` |

### Greenfield Setup Phases

| Order | Phase | Skill | Artifact |
|---|---|---|---|
| 1 | Product Brief | `groundwork-product-brief` | `docs/product-brief.md` |
| 2 | Design System | `groundwork-design-system` | `docs/design-system.md` |
| 3 | Architecture | `groundwork-architecture` | `docs/architecture.md` |
| 4 | Scaffolding | `groundwork-scaffold` | `docs/infrastructure.md` |
| 5 | MVP Planning | `groundwork-mvp` | `docs/bets/<slug>/pitch.md` |

### Anytime Skills
- `groundwork-update` — surgical doc updates after code changes
- `groundwork-check` — staleness detection

### Skill Paths

| Skill | Instruction file |
|---|---|
| `groundwork-product-brief` | `.agents/groundwork/skills/groundwork-product-brief/instructions.md` |
| `groundwork-design-system` | `.agents/groundwork/skills/groundwork-design-system/instructions.md` |
| `groundwork-architecture` | `.agents/groundwork/skills/groundwork-architecture/instructions.md` |
| `groundwork-scaffold` | `.agents/groundwork/skills/groundwork-scaffold/instructions.md` |
| `groundwork-mvp` | `.agents/groundwork/skills/groundwork-mvp/instructions.md` |
| `groundwork-bet` | `.agents/groundwork/skills/groundwork-bet/instructions.md` |
| `groundwork-update` | `.agents/groundwork/skills/groundwork-update/instructions.md` |
| `groundwork-check` | `.agents/skills/groundwork-check/instructions.md` |
| `groundwork-writer` | `.agents/groundwork/skills/groundwork-writer/SKILL.md` |

---

## Intent Handling

### User requests a specific skill
Match intent to a skill. Briefly introduce it, then load and execute the instruction file.

### User asks "what's next?"
1. Identify the first incomplete phase for the current mode.
2. Briefly introduce it — one sentence.
3. Load and execute immediately.

### User asks for help
Explain what GroundWork is, what phase the project is in, and what the next step produces.

---

## Rules
- Always load the instruction file. Never guess.
- Derive the next step from mode + state every time. Never hardcode.
- Write state.json back on every change.
