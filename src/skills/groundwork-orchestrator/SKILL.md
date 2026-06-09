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

**The `scan` marker is durable.** The scan phase produces no `docs/` artifact and its cache is purged before setup ends, so it cannot be reconciled by file existence. Treat `scan` in `state.completed` as authoritative — never add or remove it during reconciliation. Only `groundwork-scan` writes this marker, at its own completion.

**Brownfield completion is a contract check, not an existence check.** A brownfield phase counts as complete only when its artifact exists **and carries the current GroundWork contract** — a `## Summary for Downstream` section, plus `.groundwork/config/brand-tokens.json` for the design-system phase and `generation_mode` / `source_of_truth` frontmatter for code-coupled docs. A doc that exists but lacks the contract is either hand-authored or written against an older framework standard; do not mark its phase complete. Route to that phase's extract skill in **Adopt/Upgrade mode** (below) instead.

### Adopt/Upgrade Mode

A brownfield repo may already hold docs — a hand-authored README-style brief, an ad-hoc architecture file, or canonical docs written against an older GroundWork standard. These must be brought forward, not overwritten, so existing projects come along when the framework improves. When an artifact exists but fails the contract check above, route to the phase's extract skill and signal Adopt/Upgrade mode. The skill ingests the existing doc as its primary source, fills the missing contract sections, re-stamps frontmatter, gates through review, and commits — preserving the user's content while raising it to the current standard.

---

## Routing

The tables in this section are the source for the generated `workflow-index.md` (same directory) — after editing any of them, regenerate it with `npm run gen:workflow-index` in the GroundWork source repo. Keep the table shapes parseable.

### Mode Detection

| State | Mode | Route to |
|---|---|---|
| Greenfield, setup incomplete | **Greenfield Setup** | Next greenfield phase skill (see table below) |
| Brownfield, setup incomplete | **Brownfield Setup** | Next brownfield phase skill (see table below) |
| All setup phases complete | **Delivery Loop** | `groundwork-bet` |

### Greenfield Setup Phases

| Order | Phase | Skill | Artifact |
|---|---|---|---|
| 1 | Product Brief | `groundwork-product-brief` | `docs/product-brief.md` |
| 2 | Design System | `groundwork-design-system` | `docs/design-system.md` |
| 3 | Architecture | `groundwork-architecture` | `docs/architecture.md` |
| 4 | Scaffolding | `groundwork-scaffold` | `docs/infrastructure.md` |
| 5 | MVP Planning | `groundwork-mvp` | `docs/bets/<slug>/pitch.md` |

### Brownfield Setup Phases

The brownfield track reverse-engineers the same canonical artifacts from an existing codebase, then bolts on the missing GroundWork operational layer without regenerating the app. It converges to the same end-state as greenfield and enters the same Delivery Loop. There is no MVP phase — `groundwork-bet` cold-starts its own discovery, informed by the gap ledger that infra adoption commits.

| Order | Phase | Skill | Completion signal |
|---|---|---|---|
| 0 | Codebase Scan | `groundwork-scan` | `scan` marker in `state.completed` (durable — see Reconciliation) |
| 1 | Product Brief Extract | `groundwork-product-brief-extract` | `docs/product-brief.md` |
| 2 | Design System Extract | `groundwork-design-system-extract` | `docs/design-system.md` + `.groundwork/config/brand-tokens.json` |
| 3 | Architecture Extract | `groundwork-architecture-extract` | `docs/architecture.md` |
| 4 | Infra Adoption | `groundwork-infra-adopt` | `docs/infrastructure.md` + `docs/maturity.md` |

When routing to `groundwork-scan`, pass a `fan_out` hint: `parallel` when a sub-agent dispatch tool is available in this environment, `sequential` otherwise. This removes the skill's need to probe its own tool set — a misprobe on a constrained runtime would break the scan.

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
| `groundwork-scan` | `.agents/groundwork/skills/groundwork-scan/instructions.md` |
| `groundwork-product-brief-extract` | `.agents/groundwork/skills/groundwork-product-brief-extract/instructions.md` |
| `groundwork-design-system-extract` | `.agents/groundwork/skills/groundwork-design-system-extract/instructions.md` |
| `groundwork-architecture-extract` | `.agents/groundwork/skills/groundwork-architecture-extract/instructions.md` |
| `groundwork-infra-adopt` | `.agents/groundwork/skills/groundwork-infra-adopt/instructions.md` |
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
Read `.agents/skills/groundwork-orchestrator/workflow-index.md` — the generated map of every lifecycle route. Answer with: what GroundWork is (one paragraph), which mode and phase this project is in (from state resolution), what the next step produces, and the index table for the current mode so the user can see the whole road. Do not paste all four tables — the current mode's table plus the Anytime table is the useful subset.

---

## Rules
- Always load the instruction file. Never guess.
- Derive the next step from mode + state every time. Never hardcode.
- Write state.json back on every change.
