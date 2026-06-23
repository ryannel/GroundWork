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
| 3 | Architecture | `groundwork-architecture` | `docs/architecture.md` | `.groundwork/skills/groundwork-architecture/instructions.md` |
| 4 | Scaffolding | `groundwork-scaffold` | `docs/infrastructure.md` | `.groundwork/skills/groundwork-scaffold/instructions.md` |
| 5 | MVP Planning | `groundwork-mvp` | `docs/bets/<slug>/pitch.md` | `.groundwork/skills/groundwork-mvp/instructions.md` |

## Brownfield Setup (existing codebase)

The same canonical docs, reverse-engineered from the code. No MVP phase — the first bet cold-starts from the gap report.

| Order | Phase | Skill | Completion signal | Instructions |
|---|---|---|---|---|
| 0 | Codebase Scan | `groundwork-scan` | `scan` marker in `state.completed` (durable — see Reconciliation) | `.groundwork/skills/groundwork-scan/instructions.md` |
| 1 | Product Brief Extract | `groundwork-product-brief-extract` | `docs/product-brief.md` | `.groundwork/skills/groundwork-product-brief-extract/instructions.md` |
| 2 | Design System Extract | `groundwork-design-system-extract` | `docs/design-system.md` + `.groundwork/config/brand-tokens.json` | `.groundwork/skills/groundwork-design-system-extract/instructions.md` |
| 3 | Architecture Extract | `groundwork-architecture-extract` | `docs/architecture.md` | `.groundwork/skills/groundwork-architecture-extract/instructions.md` |
| 4 | Infra Adoption | `groundwork-infra-adopt` | `docs/infrastructure.md` + `docs/maturity.md` | `.groundwork/skills/groundwork-infra-adopt/instructions.md` |

## Delivery Loop (all setup phases complete)

| Skill | What it runs | Instructions |
|---|---|---|
| `groundwork-bet` | The five-phase bet workflow: discovery → design foundations → decomposition → delivery → validation | `.groundwork/skills/groundwork-bet/instructions.md` |

## Anytime

Available in any mode, on demand.

| Skill | Purpose | Instructions |
|---|---|---|
| `groundwork-update` | surgical updates to **project documents** after code changes | `.groundwork/skills/groundwork-update/instructions.md` |
| `groundwork-upgrade` | brings the **project up to the current framework version**: executes the upgrade brief `npx groundwork-method update` compiles (doc merges, migrations, scaffold reconciliation). Route here for "upgrade groundwork", "bring this project up to date", or whenever `.groundwork/cache/upgrade-brief.json` exists. Not the same as `groundwork-update`, which maintains the project's own docs. | `.groundwork/skills/groundwork-upgrade/instructions.md` |
| `groundwork-check` | staleness detection | `.agents/skills/groundwork-check/SKILL.md` |
| `groundwork-elicit` | strengthens a weak draft section through structured elicitation, mid-phase while a draft is open | `.groundwork/skills/groundwork-elicit/instructions.md` |
| `groundwork-patch` | bounded code changes that do not warrant a bet (a bug fix, a copy tweak, one small enhancement); available only after setup completes. Route here when the user asks for a small concrete change; route to `groundwork-bet` when the ask names a new capability, touches a contract, or arrives as the third patch in the same area (the patch ledger surfaces this). | `.groundwork/skills/groundwork-patch/instructions.md` |
| `groundwork-surface-activation` | adds a surface to a live product (a mobile app, a CLI, a new client for an existing product): registers it, runs its type's design track if missing, scaffolds or records `scaffold: manual`, and triages the new capability-ledger column. Also the route to bootstrap the surface registry on a pre-restructure product (GroundWork docs, no `docs/surfaces.md`). Available only after setup completes. | `.groundwork/skills/groundwork-surface-activation/instructions.md` |
| `groundwork-docs-uplift` | brings an existing documentation site to the current target state (brand theme, rendered diagrams, ordered nav, a real landing page) and gives the docs a reader-first pass. Route here for "fix / improve / refresh the docs site", or when a project predates the branded docs-site or its site has drifted. Available only after setup completes. | `.groundwork/skills/groundwork-docs-uplift/instructions.md` |
