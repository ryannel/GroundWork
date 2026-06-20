# gw-code-structure-rename — docs/principles/system-design/hexagonal-architecture.md → code-structure.md

The structural-design principle was reframed: the discipline (a pure core, dependencies
pointing inward, swappable edges, one obvious place for everything) is unchanged, but it is
no longer named after the "hexagonal / ports-and-adapters" framework. The principle now lives
at `docs/principles/system-design/code-structure.md` ("How We Structure Code"); the old
`hexagonal-architecture.md` is gone and every framework skill now reads and writes the new path.

An `update` refreshes pristine principle docs from the package and adds `code-structure.md`, but
it does not delete a file that vanished from the package — so older installs are left carrying an
orphaned `hexagonal-architecture.md` plus any live cross-references to it. This migration removes
the orphan and carries references forward.

## Detect

- **Applies** when `docs/principles/system-design/hexagonal-architecture.md` exists.
- **Already done** when it does not. If both files exist (the expected post-update state), the
  orphan is stale — remove it and fix references. If only `hexagonal-architecture.md` exists and
  `code-structure.md` does not (an install that has not run `update`), run `update` first so the
  new principle is present, then proceed.

## Transform

This is a delete + reference-carry, not a content move — `code-structure.md` is a fresh-slate
rewrite the package already ships, so nothing from the old file is preserved.

- Delete the orphaned `docs/principles/system-design/hexagonal-architecture.md`.
- Carry every live reference to the old path or the "hexagonal architecture" principle name
  forward to `code-structure.md` / "How We Structure Code" in: `docs/principles/index.md`
  (the manifesto + any belief line), `docs/llms.txt`, other `docs/` files, `AGENTS.md` /
  `CLAUDE.md` routing, `.groundwork/config/state.json`, `.groundwork/cache/` working files, and
  any project README sections that link the doc.
- If a project's `docs/architecture.md` or principle prose describes its own services as
  "hexagonal", that is the project's own wording — leave it; this migration only retires
  GroundWork's shipped principle file and its live links.
- Leave historical records alone: ADRs, changelogs, and bet documents that mention the old name
  describe the past truthfully.

**Invariant:** no live reference dangles; the principle is reachable only at its new path. The
old file survives only inside historical records.

## Accept

- `docs/principles/system-design/hexagonal-architecture.md` is gone;
  `docs/principles/system-design/code-structure.md` exists.
- Searching the repo for `hexagonal-architecture.md` finds only historical records (ADRs,
  changelog, closed bets) — no live link.
- The change is one commit, e.g.
  `chore(groundwork): retire hexagonal-architecture.md for code-structure.md (gw-code-structure-rename)`.
