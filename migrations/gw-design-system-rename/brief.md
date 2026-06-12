# gw-design-system-rename — docs/ux-design.md → docs/design-system.md

The UX Design phase was reframed as the Design System phase: same document, a wider
mandate (design tokens, interface-type tracks, NFRs — not only screens). Projects set
up before the rename still carry `docs/ux-design.md`, and every framework skill now
reads and writes `docs/design-system.md`.

## Detect

- **Applies** when `docs/ux-design.md` exists.
- **Already done** when it does not. If both files exist, the project has a manual
  half-migration: treat the rename as done, but check whether `docs/ux-design.md`
  holds content missing from `docs/design-system.md` before deleting it — ask the
  user when the two have diverged.

## Transform

Rename, then carry every reference forward:

- `git mv docs/ux-design.md docs/design-system.md`. The content is not rewritten —
  this is a rename, not a redesign. (If a heading literally titles the doc "UX
  Design", retitle it "Design System"; change nothing else.)
- Update cross-references to the old path or name in: other `docs/` files,
  `.groundwork/config/state.json` (completed-phase names), `.groundwork/cache/`
  working files, `AGENTS.md`, and any project README sections that link the doc.
- Leave historical records alone: ADRs, changelogs, and bet documents that mention
  the old name describe the past truthfully.

**Invariant:** no content is lost; only the path and live references move.

## Accept

- `docs/ux-design.md` is gone; `docs/design-system.md` exists with the same content.
- Searching the repo for `ux-design` finds only historical records (ADRs, changelog,
  closed bets) — no live reference.
- The change is one commit, e.g. `chore(groundwork): rename ux-design.md to design-system.md (gw-design-system-rename)`.
