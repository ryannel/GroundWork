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
work for a working session — surface it in your first reply, in one line: how many
framework update items are waiting and that saying "update groundwork" runs them.
Route to `groundwork-update` when the user agrees. Do not block other work on it.

**The `scan` marker is durable.** The scan phase produces no `docs/` artifact and its cache is purged before setup ends, so it cannot be reconciled by file existence. Treat `scan` in `state.completed` as authoritative — never add or remove it during reconciliation. Only `groundwork-scan` writes this marker, at its own completion. The `methodology-adopt` marker is durable on the same terms: that phase converges a way of working across too many files to reconcile from any one artifact, so only `groundwork-methodology-adopt` writes it, at its own completion.

**The phase-state register is authoritative.** `state.json`'s `phase_states` maps a setup phase name to an entry of exactly this shape — `{ "state": "deferred" | "collapsed" | "na", "note": "<one line: why; for collapsed, what was emitted>" }`. The `state` key is the contract: writers and readers use it exactly, because a drifted key silently reads as no entry. `deferred` means the user chose to run the phase later; `collapsed` means its micro-variant ran; `na` means it does not apply, with the reason in the note. Only the user's explicit choice at a routing point, or the phase's own skill, writes an entry.

**A phase carrying a register entry is settled, and the register outranks the files.** Skip such a phase in reconciliation and in the contract check below — the entry is the record, and re-deriving its state from disk is what would undo it. This is load-bearing on the brownfield track: scan-lite commits `docs/product-brief.md` and records `product-brief-extract` as `collapsed`, so a file-driven check would see a brief with no Downstream Context file and route back into the full extract over a document that already exists. Mode Detection routes on unsettled phases only; a `deferred` phase re-enters through Deferred Phases (below). When a deferred or collapsed phase's skill later commits the full artifact, it removes the entry in the same step — reconciliation then sees the artifact like any completed phase.

**Brownfield completion is a contract check, not an existence check.** For a phase with no register entry, its artifact counts only when it **carries the current GroundWork contract** — its Downstream Context file at `.groundwork/context/<phase>.md` (present until Setup Graduation tears the store down), plus `.groundwork/config/brand-tokens.json` for the design-system phase and `generation_mode` / `source_of_truth` frontmatter for code-coupled docs. A doc that exists but lacks the contract is either hand-authored or written against an older framework standard; do not mark its phase complete. Route to that phase's extract skill in **Adopt/Upgrade mode** (below) instead. (Once `setup_graduated: true`, the store is gone by design — completion is settled and this check no longer gates setup.)

### Adopt/Upgrade Mode

A brownfield repo may already hold docs — a hand-authored README-style brief, an ad-hoc architecture file, or canonical docs written against an older GroundWork standard. These must be brought forward, not overwritten, so existing projects come along when the framework improves. When an artifact exists but fails the contract check above, route to the phase's extract skill and signal Adopt/Upgrade mode. The skill ingests the existing doc as its primary source, fills the missing contract sections, re-stamps frontmatter, gates through review, and commits — preserving the user's content while raising it to the current standard.

---

## Routing

The tables in this section are the source for the generated `workflow-index.md` (same directory).

### Mode Detection

| State | Mode | Route to |
|---|---|---|
| Greenfield, any phase unsettled | **Greenfield Setup** | Next unsettled greenfield phase skill (see table below) |
| Brownfield, any phase unsettled | **Brownfield Setup** | Next unsettled brownfield phase skill (see table below) |
| All setup phases settled | **Delivery Loop** | `groundwork-bet` |

A phase is *settled* when it is complete or carries a `phase_states` entry (see State Resolution). Setup finishing with deferred phases is a legitimate end-state, not a shortcut — the deferred work stays visible and routable (Deferred Phases, below).

**You supply the position line.** A phase skill cannot know where it sits in the track — only your tables hold that. When routing into any setup phase, open with the Setup Progress Header's position half in the user's terms — phase N of M for this track, and what remains after it; the phase's own skill carries the rest of the header (what this phase asks of the user).

**Gate:** on the *first* transition into the Delivery Loop — all phases settled but `state.json` lacks `setup_graduated: true` — run **Setup Graduation** (below) before routing to `groundwork-bet`.

### Setup Graduation (the setup→delivery handoff)

Setup builds a temporary cross-phase store at `.groundwork/context/` (operating-contract Protocol 5). It is scaffolding, and the orchestrator dismantles it at the moment setup completes — once, before the first bet — so delivery starts against `docs/` as the single source of truth.

**Detection.** Setup is complete but not yet graduated when every setup phase is settled — complete, `collapsed`, `na`, or `deferred` by the user's explicit choice — *and* `state.json` does not carry `setup_graduated: true`. (`.groundwork/context/` still holding files is the corroborating signal.) When that holds, do not route to `groundwork-bet` yet — run graduation first. Graduating with deferred phases is normal; Protocol 10's teardown spares the inputs preserved for them.

**Run it.** Load `.groundwork/skills/operating-contract.md` and execute Protocol 10 (Setup Graduation) in order; its fail-safe binds — never tear down if graduation could not complete.

**Record it.** On success, set `setup_graduated: true` in `state.json`, report what graduated (ADRs written, docs reconciled, store removed) and name any phases still deferred with the phrase that resumes each, then route to `groundwork-bet` for the first bet.

### Deferred Phases (re-entry)

Two brownfield phases sit outside the default track by design, and a third exists only on repos that arrive running their own way of working. They keep their skills, their standards, and their review gates; what changes is that nothing in the track waits for them.

| Phase | Skill | Completion signal | Default register state |
|---|---|---|---|
| Product Brief Extract | `groundwork-product-brief-extract` | `docs/product-brief.md` at full depth | `collapsed` — scan-lite committed the orientation shape of this file and recorded the entry itself. The full extract is the deeper pass, run when someone needs it. |
| Design System Extract | `groundwork-design-system-extract` | `docs/design-system.md` + `.groundwork/config/brand-tokens.json` | `deferred` — ops adoption ships the tooling unbranded and tolerates absent brand tokens. A headless repo collapses this phase instead (the skill's own variant). |
| Methodology Convergence | `groundwork-methodology-adopt` | `methodology-adopt` in `state.completed` (durable — see Reconciliation) | `deferred` — the scan's classify stage records the entry, with its detection note, **only when it saw an incumbent methodology**: skill trees the framework did not ship, agent instruction files, a hand-built work-unit or scaffolder convention. No entry means this repo has none and the phase does not exist here. |

Record the design-system deferral at the setup-entry hand-off, on the user's answer — never from silence. A user who wants the full document set up front runs that phase after ops adoption, where its brand tokens can re-brand the `./dev` CLI and its type sections give the registry's `design track` fields something to resolve to.

Any phase the user defers at an orchestrator routing point is recorded in `phase_states` at that moment. From then on the entry is a standing route, not a dead end. Route to the phase's skill on either trigger:

- **Work needs the artifact.** A lane step reads a canonical doc the deferred phase owns — the bet design step needs `docs/design-system.md`, discovery cites the brief — route to the deferred phase before that step proceeds, telling the user why in their terms: the postponed piece of setup is now the next step of the work they asked for.
- **The user asks.** A request to run the phase, or to finish setup, routes directly.
- **The two systems collide.** `groundwork-methodology-adopt` owns no artifact a lane step reads, so its trigger is friction instead: the user asks for one way of working, or a request lands on ground both systems claim — work that lives in the incumbent's own doc tree, a second scaffolder, a proof convention the harness does not know about. Name the collision, then route.

**Not every phase can wait.** A phase is deferrable only when nothing left in the default track consumes its output. On the brownfield track that is the two document extracts — `groundwork-product-brief-extract` and `groundwork-design-system-extract` — plus `groundwork-methodology-adopt` on the repos that have one; all three sit outside the default track already (below). The other three are not, each for its own reason:

- `groundwork-scan` opens the track. Every phase after it reads its code map and its confirmed surface list, and it commits the orientation page.
- `groundwork-ops-adopt` writes the surface registry and provisions the test harness. Surface slugs are the join key for design tracks, bet frontmatter, decomposition slices, and test fixtures; without the registry those references resolve to nothing.
- `groundwork-architecture-extract` writes the boundary rulings, budgets, and service-level requirements in `docs/architecture/index.md`. It no longer creates the surface registry — ops adoption does that now — but it remains non-deferrable because it is the only place those rulings exist: every bet's design step is judged against them, and the terminal phase documents services and scores maturity against them.

Decline a deferral ask on these with that reason and capture the ask instead (Protocol 1). Each track's terminal phase closes it and cannot wait. Greenfield phases are sequential producers for the phases after them: not deferrable.

A deferred phase invoked after Setup Graduation runs to the same standard as in setup — same interview, same review gate, same commit — with the post-graduation carve-outs the operating contract's Sequential Setup section defines (no Downstream Context file, no hand-off file). It regenerates its own scoped inputs at invocation rather than depending on a scan cache; where the user opted into a deep scan and its findings were preserved, it reads those instead, and the last deferred extract to commit deletes them — the teardown `groundwork-infra-adopt` skipped on their behalf.

### Greenfield Setup Phases

| Order | Phase | Skill | Artifact |
|---|---|---|---|
| 1 | Product Brief | `groundwork-product-brief` | `docs/product-brief.md` |
| 2 | Design System | `groundwork-design-system` | `docs/design-system.md` |
| 3 | Architecture | `groundwork-architecture` | `docs/architecture/index.md` |
| 4 | Scaffolding | `groundwork-scaffold` | `docs/architecture/infrastructure.md` |
| 5 | MVP Planning | `groundwork-mvp` | `docs/bets/<slug>/pitch.md` |

### Brownfield Setup Phases

The brownfield track pays the user early and reads the code late. The scan makes the repo legible and hands back a page describing it; ops adoption makes it runnable and testable with one command; the architecture extract records the rulings delivery is judged against; the terminal phase documents the services and turns every gap into a roadmap. There is no MVP phase — `groundwork-bet` cold-starts its own discovery, informed by that roadmap.

| Order | Phase | Skill | Completion signal |
|---|---|---|---|
| 0 | Codebase Scan | `groundwork-scan` | `scan` marker in `state.completed` (durable — see Reconciliation) + `docs/product-brief.md` |
| 1 | Ops Adoption | `groundwork-ops-adopt` | `docs/surfaces.md` + `.groundwork/surfaces.json` |
| 2 | Architecture Extract | `groundwork-architecture-extract` | `docs/architecture/index.md` |
| 3 | Service Docs & Maturity | `groundwork-infra-adopt` | `docs/architecture/infrastructure.md` + `docs/maturity.md` |

Ops adoption's headline output is the `./dev` launcher and a working test harness, but neither is its completion signal: the phase skips `workspace-dev-cli` when a `./dev` already exists, so its presence proves nothing about whether the phase ran. The surface registry twins do — the phase always writes them, they reconcile by file existence like every other row, and they are what the phases after it read.

The two document extracts are not in this table, and neither is Methodology Convergence. They sit outside the default track, deferred or collapsed by default and routable for the life of the project — Deferred Phases (above) holds their register states and their triggers.

### Anytime Skills
- `groundwork-doc-sync` — surgical updates to **project documents** after code changes (maps a diff to the docs it makes stale; the project's docs kept in sync with the project's own code)
- `groundwork-update` — brings the **project up to the current framework**: works the residual upgrade brief, then reconciles drifted artifact structure to current canonical, family by family. Route here for "update groundwork", "upgrade groundwork", "bring this project up to date", or whenever `.groundwork/cache/upgrade-brief.json` exists.
- `groundwork-check` — staleness detection
- `groundwork-elicit` — strengthens a weak draft section through structured elicitation, mid-phase while a draft is open
- `groundwork-patch` — bounded fix, no new capability, no contract change — the floor of the three lanes; sizing rules live in *User requests work*. Available in the Delivery Loop, and before setup completes in **provisional mode** (its instructions carry the reduced-context rules).
- `groundwork-surface-activation` — adds a surface to a live product (a mobile app, a CLI, a new client for an existing product): registers it, runs its type's design track if missing, scaffolds or records `scaffold: manual`, and triages the new capability-ledger column. Available only after setup completes.

When routing to `groundwork-scan` or `groundwork-update`, pass a `fan_out` hint: `parallel` when a sub-agent dispatch tool is available in this environment, `sequential` otherwise. This removes each skill's need to probe its own tool set — a misprobe on a constrained runtime would break the run. For `groundwork-update`, `parallel` lets its driver farm each brief item and reconcile family to a disposable sub-agent so its context stays lean; `sequential` advances each unit inline, one at a time.

### The additive policy layer

Resolve the team + personal policy during state resolution: `npx groundwork-method policy` prints the merged `.groundwork/config/policy.toml` + `policy.user.toml` as JSON (scalars — user wins; arrays — concatenate, team first). It is **additive only** — it adds rigor and context, and can never remove or weaken a built-in gate, lens, or review. Carry its resolved `[facts]` into your State Resolution context and append them to the **constraints slot of every capsule, pack, and setup facilitator you dispatch**, so an org fact ("all services log structured JSON", a `file:` pointer to a baseline doc) reaches the worker verbatim. The other sections are enacted where they apply: `[lenses]` in the review wave, `[checklists]` in `groundwork-review`, `[phases]` at phase init (Protocol 3). A broken policy file is a `groundwork check` failure, not a silent drop.

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
| `groundwork-ops-adopt` | `.groundwork/skills/groundwork-ops-adopt/instructions.md` |
| `groundwork-infra-adopt` | `.groundwork/skills/groundwork-infra-adopt/instructions.md` |
| `groundwork-methodology-adopt` | `.groundwork/skills/groundwork-methodology-adopt/instructions.md` |
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

### Opening-message dispatch

When a session's opening message maps unambiguously to one lane or skill — a concrete build/fix ask, a named phase, "update groundwork" — skip the introduction and route in the same turn; the act of routing is the reply. Introduce yourself only when the route is genuinely ambiguous, and then ask exactly one clarifying question rather than laying out options.

### User requests work — build, add, change, or fix something

The most common entry, and the one GroundWork exists to catch: the user asks to **build, add, implement, change, or fix** something — "add a button to delete an image", "fix the upload bug", "let's build the dashboard". This is a routing trigger, not a cue to start editing code. Size the work and route it; never implement directly from here.

**Before setup completes**, size the request first — the user's ask outranks the setup sequence. A request that passes `groundwork-patch`'s scope test routes to the patch lane in **provisional mode**: the user ships the fix now, and setup later absorbs the doc debt the patch recorded. Anything larger becomes the setup flow. The quick-bet and bet lanes stay Delivery Loop only — they build on contracts setup has not yet established.

**Entering the setup track never happens silently** — whether entry is immediate (the ask was larger than a patch) or the moment after a provisional patch ships and the user turns to setup. Before routing to the first phase, in the user's terms: confirm any outstanding ask was heard and will be the first piece of work once its lane opens; lay out the phases of the Brownfield Setup table and what each asks of them, with honest effort framing; name the two document phases the default track leaves for later and what running them now would add; then let them choose — proceed with the default track, add a deferred phase back in, or record the ask (Protocol 1, `## Bets`) and pick the moment. Record their answer in `phase_states` and route on it. A consent question alone ("want me to start the scan?") is not this hand-off — the road and the choices are what make the consent informed.

**If a lane is already active, continue it.** A non-`delivered` bet or quick-bet (its pitch carries an active `status:`) is in flight — route to `groundwork-bet`, which resumes it; do not re-triage a request that is really the next slice of work already under way. (A patch is atomic and carries no open state, so there is nothing to resume.)

**An incumbent lane counts too.** While `phase_states` carries a `methodology-adopt` entry, the repo still runs its own way of working alongside GroundWork's, and work belonging to one of that system's in-flight units continues there — do not re-triage it into a GroundWork lane, because splitting a unit across two systems mid-flight is exactly the fracture convergence exists to prevent. Say which system the ask belongs to and why, and offer the convergence phase as the way to stop having two. Once the phase has run, a unit the owner chose to finish natively is an open row in `docs/maturity.md` and continues natively until it closes.

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

### User asks for guidance — "what's next", "help", "where are we"

One procedure serves every orientation ask; state resolution has already run, so the state is in hand.

1. **Position report, snapshot-first.** In setup mode, name the mode and the current phase as "phase N of M", each completed phase's artifact checked off and the incomplete ones listed. In the Delivery Loop, this is exactly the moment the **full** checkpoint snapshot (operating contract) exists for — "where are we?" is the question it answers, so open the report with it rather than recalling the position from memory. Render it with `npx groundwork-method status` (composing by hand from the in-flight pitch's `status:` and `./dev bet status` only where the command is unavailable), then add the pending signals state resolution already surfaced, each spoken plainly with its source kept for your own reading — small fixes piling up in one area (patch-cluster trailers), a framework update waiting to be applied (an unconsumed `.groundwork/cache/upgrade-brief.json`), open maturity gaps (`docs/maturity.md` rows). The snapshot's queued section is the user's editable backlog: the bullets under `## Bets` in `.groundwork/cache/discovery-notes.md`, in order; reordering those bullets reorders the queue.
2. **One recommended next action.** Name the single highest-value next step and give the user the exact phrase that starts it — one action, never a menu. `.agents/skills/groundwork-orchestrator/workflow-index.md` (the generated route map, same directory) is the reference for what each route produces; read the current mode's table from it when the user wants the whole road, but never paste all four tables.
3. **General questions** — "how does X work", "why bets", "what is a surface" — are answered from `docs/` and `llms.txt`, never from memory; the index's General-questions row names that corpus.

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
