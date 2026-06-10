<!-- GENERATED FILE — do not edit by hand.
     Source: the routing tables in SKILL.md (same directory).
     Regenerate: npm run gen:workflow-index -->

# GroundWork Workflow Index

Every lifecycle route the orchestrator knows, in one map. The orchestrator decides which row applies by reading `.groundwork/config/state.json` and the filesystem — this index is for orientation, not for routing.

## Greenfield Setup (empty repository)

Phases run in order; each commits its artifact, then the orchestrator routes to the next.

| Order | Phase | Skill | Artifact | Instructions |
|---|---|---|---|---|
| 1 | Product Brief | `groundwork-product-brief` | `docs/product-brief.md` | `.agents/groundwork/skills/groundwork-product-brief/instructions.md` |
| 2 | Design System | `groundwork-design-system` | `docs/design-system.md` | `.agents/groundwork/skills/groundwork-design-system/instructions.md` |
| 3 | Architecture | `groundwork-architecture` | `docs/architecture.md` | `.agents/groundwork/skills/groundwork-architecture/instructions.md` |
| 4 | Scaffolding | `groundwork-scaffold` | `docs/infrastructure.md` | `.agents/groundwork/skills/groundwork-scaffold/instructions.md` |
| 5 | MVP Planning | `groundwork-mvp` | `docs/bets/<slug>/pitch.md` | `.agents/groundwork/skills/groundwork-mvp/instructions.md` |

## Brownfield Setup (existing codebase)

The same canonical docs, reverse-engineered from the code. No MVP phase — the first bet cold-starts from the gap report.

| Order | Phase | Skill | Completion signal | Instructions |
|---|---|---|---|---|
| 0 | Codebase Scan | `groundwork-scan` | `scan` marker in `state.completed` (durable — see Reconciliation) | `.agents/groundwork/skills/groundwork-scan/instructions.md` |
| 1 | Product Brief Extract | `groundwork-product-brief-extract` | `docs/product-brief.md` | `.agents/groundwork/skills/groundwork-product-brief-extract/instructions.md` |
| 2 | Design System Extract | `groundwork-design-system-extract` | `docs/design-system.md` + `.groundwork/config/brand-tokens.json` | `.agents/groundwork/skills/groundwork-design-system-extract/instructions.md` |
| 3 | Architecture Extract | `groundwork-architecture-extract` | `docs/architecture.md` | `.agents/groundwork/skills/groundwork-architecture-extract/instructions.md` |
| 4 | Infra Adoption | `groundwork-infra-adopt` | `docs/infrastructure.md` + `docs/maturity.md` | `.agents/groundwork/skills/groundwork-infra-adopt/instructions.md` |

## Delivery Loop (all setup phases complete)

| Skill | What it runs | Instructions |
|---|---|---|
| `groundwork-bet` | The five-phase bet workflow: discovery → design foundations → decomposition → delivery → validation | `.agents/groundwork/skills/groundwork-bet/instructions.md` |

## Anytime

Available in any mode, on demand.

| Skill | Purpose | Instructions |
|---|---|---|
| `groundwork-update` | surgical doc updates after code changes | `.agents/groundwork/skills/groundwork-update/instructions.md` |
| `groundwork-check` | staleness detection | `.agents/skills/groundwork-check/SKILL.md` |
| `groundwork-elicit` | strengthens a weak draft section through structured elicitation, mid-phase while a draft is open | `.agents/groundwork/skills/groundwork-elicit/instructions.md` |
| `groundwork-patch` | bounded code changes that do not warrant a bet (a bug fix, a copy tweak, one small enhancement); available only after setup completes. Route here when the user asks for a small concrete change; route to `groundwork-bet` when the ask names a new capability, touches a contract, or arrives as the third patch in the same area (the patch ledger surfaces this). | `.agents/groundwork/skills/groundwork-patch/instructions.md` |
