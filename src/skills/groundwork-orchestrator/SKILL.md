---
name: groundwork-orchestrator
description: 'The GroundWork Orchestrator. Run this skill for ANY GroundWork lifecycle task (what''s next, run a specific step), for "update groundwork" / "upgrade groundwork" / "bring this project up to date with the framework", AND — before writing any code — whenever the user asks to build, add, implement, change, or fix something in this project: it sizes the work into a patch, quick bet, or bet and runs the right lane. It owns all lifecycle knowledge, reads project state, and routes to the correct skill. Run it before implementing any code change.'
---

# GroundWork Orchestrator

You own lifecycle routing. Read state, determine the mode, load the right skill. No other skill makes lifecycle decisions. The shared operating contract at `.groundwork/skills/operating-contract.md` (contract v1) governs every methodology phase — you route, the phases enforce protocol.

---

## Persona

Before your first user-facing reply in any session, load and apply `.groundwork/skills/groundwork-persona/instructions.md`. This governs your conversational posture for the entire session — do not wait for a methodology skill to invoke it.

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

**An unconsumed upgrade brief outranks routine routing.** When
`.groundwork/cache/upgrade-brief.json` exists with pending items, the framework left
work for a working session — surface it in your first reply (one line: "N framework
update items are pending — say 'update groundwork' when you want to run them") and
route to `groundwork-update` when the user agrees. Do not block other work on it.

**The `scan` marker is durable.** The scan phase produces no `docs/` artifact and its cache is purged before setup ends, so it cannot be reconciled by file existence. Treat `scan` in `state.completed` as authoritative — never add or remove it during reconciliation. Only `groundwork-scan` writes this marker, at its own completion.

**Brownfield completion is a contract check, not an existence check.** A brownfield phase counts as complete only when its artifact exists **and carries the current GroundWork contract** — its Downstream Context file at `.groundwork/context/<phase>.md` (present until Setup Graduation tears the store down), plus `.groundwork/config/brand-tokens.json` for the design-system phase and `generation_mode` / `source_of_truth` frontmatter for code-coupled docs. A doc that exists but lacks the contract is either hand-authored or written against an older framework standard; do not mark its phase complete. Route to that phase's extract skill in **Adopt/Upgrade mode** (below) instead. (Once `setup_graduated: true`, the store is gone by design — completion is settled and this check no longer gates setup.)

### Adopt/Upgrade Mode

A brownfield repo may already hold docs — a hand-authored README-style brief, an ad-hoc architecture file, or canonical docs written against an older GroundWork standard. These must be brought forward, not overwritten, so existing projects come along when the framework improves. When an artifact exists but fails the contract check above, route to the phase's extract skill and signal Adopt/Upgrade mode. The skill ingests the existing doc as its primary source, fills the missing contract sections, re-stamps frontmatter, gates through review, and commits — preserving the user's content while raising it to the current standard.

---

## Routing

The tables in this section are the source for the generated `workflow-index.md` (same directory).

### Mode Detection

| State | Mode | Route to |
|---|---|---|
| Greenfield, setup incomplete | **Greenfield Setup** | Next greenfield phase skill (see table below) |
| Brownfield, setup incomplete | **Brownfield Setup** | Next brownfield phase skill (see table below) |
| All setup phases complete | **Delivery Loop** | `groundwork-bet` |

**Gate:** on the *first* transition into the Delivery Loop — setup complete but `state.json` lacks `setup_graduated: true` — run **Setup Graduation** (below) before routing to `groundwork-bet`.

### Setup Graduation (the setup→delivery handoff)

Setup builds a temporary cross-phase store at `.groundwork/context/` (operating-contract Protocol 5). It is scaffolding, and the orchestrator dismantles it at the moment setup completes — once, before the first bet — so delivery starts against `docs/` as the single source of truth.

**Detection.** Setup is complete but not yet graduated when all setup phases are done *and* `state.json` does not carry `setup_graduated: true`. (`.groundwork/context/` still holding files is the corroborating signal.) When that holds, do not route to `groundwork-bet` yet — run graduation first.

**Run it.** Load `.groundwork/skills/operating-contract.md` and execute Protocol 10 (Setup Graduation) in order; its fail-safe binds — never tear down if graduation could not complete.

**Record it.** On success, set `setup_graduated: true` in `state.json`, report what graduated (ADRs written, docs reconciled, store removed), then route to `groundwork-bet` for the first bet.

### Greenfield Setup Phases

| Order | Phase | Skill | Artifact |
|---|---|---|---|
| 1 | Product Brief | `groundwork-product-brief` | `docs/product-brief.md` |
| 2 | Design System | `groundwork-design-system` | `docs/design-system.md` |
| 3 | Architecture | `groundwork-architecture` | `docs/architecture/index.md` |
| 4 | Scaffolding | `groundwork-scaffold` | `docs/architecture/infrastructure.md` |
| 5 | MVP Planning | `groundwork-mvp` | `docs/bets/<slug>/pitch.md` |

### Brownfield Setup Phases

The brownfield track reverse-engineers the same canonical artifacts from an existing codebase, then bolts on the missing GroundWork operational layer without regenerating the app. It converges to the same end-state as greenfield and enters the same Delivery Loop. There is no MVP phase — `groundwork-bet` cold-starts its own discovery, informed by the gap ledger that infra adoption commits.

| Order | Phase | Skill | Completion signal |
|---|---|---|---|
| 0 | Codebase Scan | `groundwork-scan` | `scan` marker in `state.completed` (durable — see Reconciliation) |
| 1 | Product Brief Extract | `groundwork-product-brief-extract` | `docs/product-brief.md` |
| 2 | Design System Extract | `groundwork-design-system-extract` | `docs/design-system.md` + `.groundwork/config/brand-tokens.json` |
| 3 | Architecture Extract | `groundwork-architecture-extract` | `docs/architecture/index.md` |
| 4 | Infra Adoption | `groundwork-infra-adopt` | `docs/architecture/infrastructure.md` + `docs/maturity.md` |

### Anytime Skills
- `groundwork-doc-sync` — surgical updates to **project documents** after code changes (maps a diff to the docs it makes stale; the project's docs kept in sync with the project's own code)
- `groundwork-update` — brings the **project up to the current framework**: works the residual upgrade brief, then reconciles drifted artifact structure to current canonical, family by family. Route here for "update groundwork", "upgrade groundwork", "bring this project up to date", or whenever `.groundwork/cache/upgrade-brief.json` exists.
- `groundwork-check` — staleness detection
- `groundwork-elicit` — strengthens a weak draft section through structured elicitation, mid-phase while a draft is open
- `groundwork-patch` — bounded fix, no new capability, no contract change — the floor of the three lanes; sizing rules live in *User requests work*. Available only after setup completes.
- `groundwork-surface-activation` — adds a surface to a live product (a mobile app, a CLI, a new client for an existing product): registers it, runs its type's design track if missing, scaffolds or records `scaffold: manual`, and triages the new capability-ledger column. Available only after setup completes.

When routing to `groundwork-scan` or `groundwork-update`, pass a `fan_out` hint: `parallel` when a sub-agent dispatch tool is available in this environment, `sequential` otherwise. This removes each skill's need to probe its own tool set — a misprobe on a constrained runtime would break the run. For `groundwork-update`, `parallel` lets its driver farm each brief item and reconcile family to a disposable sub-agent so its context stays lean; `sequential` advances each unit inline, one at a time.

### Custom Skills (user-registered)

Read `.groundwork/config/config.toml` during state resolution. Each entry in its `[skills]` table maps an intent to an instruction file path; merge these into routing after the built-in tables — a built-in route wins any conflict. The file is user-owned: never write to it. When a configured path does not exist on disk, tell the user the route is broken instead of silently skipping it.

### Skill Paths

| Skill | Instruction file |
|---|---|
| `groundwork-product-brief` | `.groundwork/skills/groundwork-product-brief/instructions.md` |
| `groundwork-design-system` | `.groundwork/skills/groundwork-design-system/instructions.md` |
| `groundwork-architecture` | `.groundwork/skills/groundwork-architecture/instructions.md` |
| `groundwork-scaffold` | `.groundwork/skills/groundwork-scaffold/instructions.md` |
| `groundwork-stack-forge` | `.groundwork/skills/groundwork-stack-forge/instructions.md` |
| `groundwork-mvp` | `.groundwork/skills/groundwork-mvp/instructions.md` |
| `groundwork-scan` | `.groundwork/skills/groundwork-scan/instructions.md` |
| `groundwork-product-brief-extract` | `.groundwork/skills/groundwork-product-brief-extract/instructions.md` |
| `groundwork-design-system-extract` | `.groundwork/skills/groundwork-design-system-extract/instructions.md` |
| `groundwork-architecture-extract` | `.groundwork/skills/groundwork-architecture-extract/instructions.md` |
| `groundwork-infra-adopt` | `.groundwork/skills/groundwork-infra-adopt/instructions.md` |
| `groundwork-bet` | `.groundwork/skills/groundwork-bet/instructions.md` |
| `groundwork-doc-sync` | `.groundwork/skills/groundwork-doc-sync/instructions.md` |
| `groundwork-update` | `.groundwork/skills/groundwork-update/instructions.md` |
| `groundwork-patch` | `.groundwork/skills/groundwork-patch/instructions.md` |
| `groundwork-surface-activation` | `.groundwork/skills/groundwork-surface-activation/instructions.md` |
| `groundwork-elicit` | `.groundwork/skills/groundwork-elicit/instructions.md` |
| `groundwork-review` | `.groundwork/skills/groundwork-review/instructions.md` |
| `groundwork-check` | `.agents/skills/groundwork-check/SKILL.md` |
| `groundwork-writer` | `.groundwork/skills/groundwork-writer/SKILL.md` |
| `groundwork-persona` | `.groundwork/skills/groundwork-persona/instructions.md` |
| `groundwork-architect` | `.groundwork/skills/groundwork-architect/SKILL.md` |
| `groundwork-product` | `.groundwork/skills/groundwork-product/SKILL.md` |
| `groundwork-designer` | `.groundwork/skills/groundwork-designer/SKILL.md` |

> `groundwork-stack-forge` — not a lifecycle route; adopted from within the scaffold phase when Phase 1 maps to a stack no generator can produce.
> `groundwork-architect` — not a lifecycle route; adopted within the architecture workflow and the bet design phase.
> `groundwork-product` — not a lifecycle route; adopted within the product-brief workflow and the bet discovery phase.
> `groundwork-designer` — not a lifecycle route; adopted within the design-system workflow, the bet design phase, and (lighter touch) bet validation.

---

## Intent Handling

### User requests work — build, add, change, or fix something

The most common entry, and the one GroundWork exists to catch: the user asks to **build, add, implement, change, or fix** something — "add a button to delete an image", "fix the upload bug", "let's build the dashboard". This is a routing trigger, not a cue to start editing code. Size the work and route it; never implement directly from here.

**Before setup completes**, a build request is the setup flow itself — route to the next setup phase (Mode Detection above), not a delivery lane. The three lanes below are available only in the Delivery Loop.

**If a lane is already active, continue it.** A non-`delivered` bet or quick-bet (its pitch carries an active `status:`) is in flight — route to `groundwork-bet`, which resumes it; do not re-triage a request that is really the next slice of work already under way. (A patch is atomic and carries no open state, so there is nothing to resume.)

**Otherwise size the request — the Work Intake triage.** Three signals, each resolved against a lane's own definition rather than re-judged here:

1. Does it pass `groundwork-patch`'s scope test — one user-facing goal, no new capability, no API or schema change, not the third patch clustering in one area — **and does it leave every queued bet's own premises and dependencies untouched?** A change that would invalidate an assumption a queued pitch already depends on is not a patch no matter how small it looks in isolation; route it as discovery input to that bet instead. → **patch**.
2. Is it one small new capability — a single user-visible step, deliverable in one sitting, touching at most a local, non-structural contract delta? → **quick bet**.
3. Does it span more than one demonstrable milestone, or change a contract structurally or across services? → **bet**.

Resolve a tie or a borderline ask to the **lighter** lane and name the escalation trigger out loud — over-ceremony is the costlier error, and a quick bet promotes to a bet (or a patch to a quick bet) the moment reality proves it bigger. **Propose** the lane with a one-line rationale and let the user confirm or override (an override is recorded in the lane's own artifact). Then route:

- **patch** → `groundwork-patch`.
- **quick bet** → `groundwork-bet`, signalling the quick-bet lane (`lane: quick-bet`); its activation opens the quick-bet track (`workflows/00-quick.md`).
- **bet** → `groundwork-bet` for full discovery.

### User requests a specific skill
Match intent to a skill. Briefly introduce it, then load and execute the instruction file.

### User asks "what's next?"
1. Identify the first incomplete phase for the current mode.
2. Briefly introduce it — one sentence.
3. Load and execute immediately.

### User asks for help
Read `.agents/skills/groundwork-orchestrator/workflow-index.md` — the generated map of every lifecycle route. Answer with: what GroundWork is (one paragraph), which mode and phase this project is in (from state resolution), what the next step produces, and the index table for the current mode so the user can see the whole road. Do not paste all four tables — the current mode's table plus the Anytime table is the useful subset.

### User asks what GroundWork can scaffold
A capability question — "can we scaffold a docs site?", "what can GroundWork generate?", "is there a Go service generator?" — is answered from the **shipped generator catalog**, never from memory and never by entering the scaffold flow to find out.

1. Read `.groundwork/config/generators.json` (the deployed Nx generator registry). Every entry's `name` + `description` is the catalog of what can be scaffolded — backend services, surfaces (Next.js, Flutter, Electron, CLI), the **docs site**, the system-test runner, the dev CLI. Answer the "is there a generator for X?" question directly from it. If the file is absent (a pre-config install), fall back to the package's `generators.json`.
2. For **flag-level** detail — auth modes, messaging backends, LLM providers, the docs-site engine, etc. — the single source of truth is the generator-availability and capability→flag tables in `.groundwork/skills/groundwork-scaffold/phases/01-ingestion-service-mapping.md`. Read that file read-only to answer; do not duplicate its contents here, and do not execute the scaffold phase just to quote it.
3. Knowing a capability exists is not the same as adding it. If the user wants to actually scaffold it, route to the work: greenfield Setup phase 4 (`groundwork-scaffold`), or after setup the `groundwork-scaffold` / `groundwork-surface-activation` lane. State which, then proceed.

---

## Rules
- Always load the instruction file — it encodes the phase protocol, which you cannot reproduce from memory.
- Derive the next step from mode + state every time — `state.json` is the source of truth, not assumptions cached earlier in the session.
- Write state.json back on every change — downstream skills depend on reading current state.
