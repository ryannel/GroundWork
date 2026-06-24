---
name: groundwork-check
description: Analyzes GroundWork architecture docs for staleness against the codebase by checking git logs for `source_of_truth` paths since `last_reviewed`. Designed to run in CI.
---

# GroundWork Check Skill

The full staleness workflow lives in `instructions.md`, colocated with this file; load it when invoked.

## Doc-Type Behaviours

Different doc types have different drift semantics. Apply these rules when scanning `docs/`:

### `docs/principles/**` and `docs/ways-of-working/**`

These are project-stable docs not derived from code. Do **not** flag them for code drift. Do surface a low-severity advisory (not a build failure) for any file whose `last_reviewed` date is more than 12 months old. Advisory format: "Advisory: `<path>` has not been reviewed in over 12 months — consider a manual review pass."

### `docs/architecture/domain/<entity>.md`

Entity docs should reflect the domain as it appears in code. When discoverable (schema migration files, model definitions), compare entity names found in code against the names of files in `docs/architecture/domain/`. Flag two conditions as warnings:

- An entity file exists in `docs/architecture/domain/` but no corresponding code definition can be found — possible deletion or rename.
- A code definition exists but no entity file exists in `docs/architecture/domain/` — the architecture phase may have missed it, or a bet added it without documentation.

Do not fail the build on domain mismatches — these are advisory warnings requiring human judgement.

### `docs/architecture/decisions/NNNN-*.md`

ADRs are append-only historical records. Do **not** check for code drift. Do check:

- Numbering is sequential with no gaps (0001, 0002, 0003, ... with no missing integers).
- Every file's `status` frontmatter field is either `accepted` or begins with `superseded by`.

Report numbering gaps and invalid statuses as build failures — they indicate a corrupted ADR history.

### `docs/surfaces.md` and `.groundwork/surfaces.json`

The surface registry and capability ledger are twins: the prose doc and the JSON are projections of the same decisions, written by the same commits (contract: `.groundwork/skills/templates/surfaces.md`). Exclude `retired` surfaces from every staleness and backlog count below — a retired column is frozen history, never backlog.

Report as build failures:

- **Twin drift** — the doc and the JSON disagree on the surface set, a surface's status, or a cell's state. The twin rule exists so machine checks can stand in for the prose; a disagreement means a commit updated one projection and not the other, and neither can be trusted until they are reconciled.
- **Empty ledger cells** — a capability row missing a cell for a registry surface (retired columns included — they carry frozen history or auto-`n/a`), or a cell with no recognised state. An empty cell is the only illegal ledger state: bet validation fills every column or the bet does not close, so an empty cell means a bet closed past its gate.

Report as warnings:

- **Stale planned intent** — a `planned` cell older than three closed bets with no referencing pitch. Date the cell from the commit that introduced it in `.groundwork/surfaces.json`, count bets whose `.groundwork/bets/*/decomposition.json` carries a `created` date after that date, and search `docs/bets/` for a pitch that references the capability key or names the surface in its `surfaces:` frontmatter. The threshold is bets, not months, because ledger intent ages at the betting table: each closed bet is a table that passed on the cell, and three passes mark intent that no longer reflects a plan. The other staleness heuristics in this skill are calendar-based; capability work is not scheduled by the calendar.
- **Untested active surface** — an `active` surface absent from the system-test conftest's `surfaces` fixture mapping (`_SURFACE_SPECS` in `tests/conftest.py`), or carrying `testMedium: null`. `active` means shipped and tested; an active surface no test can reach is a claim without proof.

Report as an advisory (not a build failure):

- **No registry** — GroundWork docs exist but neither `docs/surfaces.md` nor `.groundwork/surfaces.json` does. This is a pre-restructure adoption, not drift. Point at `groundwork-surface-activation`, whose first move on such a product is to bootstrap the registry from `docs/architecture/index.md` and the existing scaffold.

### `docs/architecture/services/**`

Out of scope for the current check implementation.
