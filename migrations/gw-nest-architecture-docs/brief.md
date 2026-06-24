# gw-nest-architecture-docs — nest the architecture docs under docs/architecture/

The canonical architecture documentation used to sit flat at the `docs/` root:
`architecture.md`, `infrastructure.md`, and the `domain/`, `services/`, `api/`, and
`decisions/` folders were all siblings of the product brief and design system. They now
nest under a single `docs/architecture/` section so the docs-site sidebar reads as a
product-learning journey — brief → design-system → **architecture** (one expandable
section) → ways-of-working → getting-started → bets — instead of a flat wall of
top-level entries. `architecture.md` becomes the section's `index.md`.

Projects set up before this change carry the flat layout. This migration relocates the
files, rewrites the sidebar ordering, and carries live cross-references forward. It does
**not** author the new `docs/getting-started/` on-ramp — that is net-new skill-written
content, not a move; an upgraded project gains it by re-running the relevant setup skill
or `groundwork-docs-uplift`, and the docs-site landing page renders its on-ramp card
only once the doc exists.

## Detect

- **Applies** when any of the flat architecture docs exist at the `docs/` root:
  `docs/architecture.md`, `docs/infrastructure.md`, or the `docs/domain/`,
  `docs/services/`, `docs/api/`, `docs/decisions/` directories.
- **Already done** when `docs/architecture/index.md` exists and none of those flat files
  or directories remain at the root.
- **N/A** when the project has no `docs/` tree, or none of the listed paths are present
  (a docs-light or pre-architecture project).

## Transform

Relocate with history-preserving moves (`git mv` where the tree is a git repo), creating
`docs/architecture/` first:

- `docs/architecture.md` → `docs/architecture/index.md`
- `docs/infrastructure.md` → `docs/architecture/infrastructure.md`
- `docs/domain/` → `docs/architecture/domain/`
- `docs/services/` → `docs/architecture/services/`
- `docs/api/` → `docs/architecture/api/`
- `docs/decisions/` → `docs/architecture/decisions/`

Move only the paths that exist — a project missing one (e.g. no `api/`) skips it.

Then:

1. **Rewrite the sidebar order.** Set `docs/meta.json` to the canonical top level
   (`product-brief`, `design-system`, `architecture`, `ways-of-working`,
   `getting-started`, `bets`, `...`, `principles`), and seed
   `docs/architecture/meta.json` (`index`, `infrastructure`, `domain`, `services`, `api`,
   `decisions`, `...`). Preserve any project-specific entries the existing meta carried —
   reorder, do not discard. If the project never had a `docs/meta.json`, the docs-site
   generator seeds it on the next regeneration; writing it here is still correct.
2. **Carry live cross-references forward.** Update references to the moved paths in other
   `docs/` files, `.groundwork/config/state.json` (drift `source_of_truth` / baseline
   entries), `AGENTS.md`, and project READMEs — anything that links a reader or a tool to
   the old flat path. Frontmatter `source_of_truth` that points at *code* is unaffected;
   only doc-path references move.
3. **Leave historical records alone.** Closed bets under `docs/bets/`, changelog entries,
   and existing ADR bodies that reference where a decision *was* recorded are history —
   do not rewrite them.

Delegate any doc body edit to `groundwork-writer` so wording stays in house tone.

**Invariant:** every architecture document survives the move with its content intact and
its live inbound references repointed — no doc is orphaned at the old path and no link is
left dangling at the new one.

## Accept

- `docs/architecture/index.md` exists and none of the flat architecture files or
  directories remain at the `docs/` root.
- `docs/meta.json` and `docs/architecture/meta.json` reflect the nested order.
- A repo search for the old flat paths (`docs/infrastructure.md`, `docs/domain/`,
  `docs/services/`, `docs/api/`, `docs/decisions/`, `docs/architecture.md`) finds only
  historical records — no live link or tool reference.
- One commit, referencing `gw-nest-architecture-docs`.
