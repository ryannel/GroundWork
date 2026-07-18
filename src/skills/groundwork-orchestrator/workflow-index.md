<!-- GENERATED FILE — do not edit by hand.
     Source: the routing tables in SKILL.md (same directory).
     Regenerate: npm run gen:workflow-index -->

# GroundWork Workflow Index

Every lifecycle route the orchestrator knows, in one map. The orchestrator decides which row applies by reading `.groundwork/config/state.json` and the filesystem — this index is for orientation, not for routing.

## Greenfield Setup (empty repository)

Phases run in order; each commits its artifact, then the orchestrator routes to the next.

| Order | Phase | Skill | Artifact | Instructions |
|---|---|---|---|---|
| 1 | Product Brief | `groundwork-product-brief` | `docs/product-brief.md` | `.groundwork/skills/groundwork-product-brief/instructions.md` |
| 2 | Design System | `groundwork-design-system` | `docs/design-system.md` | `.groundwork/skills/groundwork-design-system/instructions.md` |
| 3 | Architecture | `groundwork-architecture` | `docs/architecture/index.md` | `.groundwork/skills/groundwork-architecture/instructions.md` |
| 4 | Scaffolding | `groundwork-scaffold` | `docs/architecture/infrastructure.md` | `.groundwork/skills/groundwork-scaffold/instructions.md` |
| 5 | MVP Planning | `groundwork-mvp` | `docs/bets/<slug>/pitch.md` | `.groundwork/skills/groundwork-mvp/instructions.md` |

## Brownfield Setup (existing codebase)

The same canonical docs, reverse-engineered from the code. No MVP phase — the first bet cold-starts from the gap report.

| Order | Phase | Skill | Completion signal | Instructions |
|---|---|---|---|---|
| 0 | Codebase Scan | `groundwork-scan` | `scan` marker in `state.completed` (durable — see Reconciliation) | `.groundwork/skills/groundwork-scan/instructions.md` |
| 1 | Product Brief Extract | `groundwork-product-brief-extract` | `docs/product-brief.md` | `.groundwork/skills/groundwork-product-brief-extract/instructions.md` |
| 2 | Design System Extract | `groundwork-design-system-extract` | `docs/design-system.md` + `.groundwork/config/brand-tokens.json` | `.groundwork/skills/groundwork-design-system-extract/instructions.md` |
| 3 | Architecture Extract | `groundwork-architecture-extract` | `docs/architecture/index.md` | `.groundwork/skills/groundwork-architecture-extract/instructions.md` |
| 4 | Infra Adoption | `groundwork-infra-adopt` | `docs/architecture/infrastructure.md` + `docs/maturity.md` | `.groundwork/skills/groundwork-infra-adopt/instructions.md` |
| 5 | Methodology Convergence | `groundwork-methodology-adopt` | `methodology-adopt` marker in `state.completed` (durable) — phase exists only when `methodology: "incumbent"` | `.groundwork/skills/groundwork-methodology-adopt/instructions.md` |

## Delivery Loop (all setup phases complete)

| Skill | What it runs | Instructions |
|---|---|---|
| `groundwork-bet` | The five-phase bet workflow: discovery → design foundations → decomposition → delivery → validation | `.groundwork/skills/groundwork-bet/instructions.md` |

Every build/change/fix request is sized into one of three lanes at intake (the Work Intake triage). Resolve a borderline ask to the lighter lane and name the escalation trigger.

| Lane | Scope test | Route |
|---|---|---|
| **patch** | Does it pass groundwork-patch's scope test — one user-facing goal, no new capability, no API or schema change, not the third patch clustering in one area — and does it leave every queued bet's own premises and dependencies untouched? | `groundwork-patch` |
| **quick bet** | Is it one small new capability — a single user-visible step, deliverable in one sitting, touching at most a local, non-structural contract delta? | `groundwork-bet` |
| **bet** | Does it span more than one demonstrable milestone, or change a contract structurally or across services? | `groundwork-bet` |

## General questions (not a route)

Questions about the framework — what a phase produces, why the method works this way, what a term means — are answered from the shipped corpus, never from memory.

| Ask | Answer corpus |
|---|---|
| "How does X work?", "why bets?", "what is a surface?" | `docs/` (framework docs seeded into the project) + `llms.txt` (the machine-readable map) |

## Anytime

Available in any mode, on demand.

| Skill | Purpose | Instructions |
|---|---|---|
| `groundwork-doc-sync` | surgical updates to **project documents** after code changes (maps a diff to the docs it makes stale; the project's docs kept in sync with the project's own code) | `.groundwork/skills/groundwork-doc-sync/instructions.md` |
| `groundwork-update` | brings the **project up to the current framework**: works the residual upgrade brief, then reconciles drifted artifact structure to current canonical, family by family. Route here for "update groundwork", "upgrade groundwork", "bring this project up to date", or whenever `.groundwork/cache/upgrade-brief.json` exists. | `.groundwork/skills/groundwork-update/instructions.md` |
| `groundwork-check` | staleness detection | `.agents/skills/groundwork-check/SKILL.md` |
| `groundwork-elicit` | strengthens a weak draft section through structured elicitation, mid-phase while a draft is open | `.groundwork/skills/groundwork-elicit/instructions.md` |
| `groundwork-patch` | bounded fix, no new capability, no contract change — the floor of the three lanes; sizing rules live in *User requests work*. Available only after setup completes. | `.groundwork/skills/groundwork-patch/instructions.md` |
| `groundwork-surface-activation` | adds a surface to a live product (a mobile app, a CLI, a new client for an existing product): registers it, runs its type's design track if missing, scaffolds or records `scaffold: manual`, and triages the new capability-ledger column. Available only after setup completes. | `.groundwork/skills/groundwork-surface-activation/instructions.md` |
