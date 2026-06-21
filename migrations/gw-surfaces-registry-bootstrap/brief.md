# gw-surfaces-registry-bootstrap — seed the surface registry and capability ledger

The multi-surface restructure models every product as a headless capability core plus
zero or more surfaces, tracked in twin artifacts: `docs/surfaces.md` (prose) and
`.groundwork/surfaces.json` (machine). Products set up before the restructure have
neither, so bet validation cannot fill ledger rows and `groundwork-check`'s surface
signals stay dark.

## Detect

- **Applies** when GroundWork canonical docs exist (`docs/architecture.md` present)
  and neither `docs/surfaces.md` nor `.groundwork/surfaces.json` does.
- **Already done** when both twins exist.
- **N/A** when setup is incomplete (no `docs/architecture.md` yet) — the architecture
  phase writes the registry itself on first run.

## Transform

Do not invent a bootstrap procedure here. Load
`.groundwork/skills/groundwork-surface-activation/instructions.md` and run its
registry-bootstrap flow — bootstrapping pre-restructure products is that skill's
designed first move. It reads `docs/architecture.md` and the existing scaffold to
propose the surface set, writes both twins, and starts the ledger empty by stance.

**Invariant:** the registry describes what the product already is — bootstrapping
registers existing surfaces, it does not propose new ones.

## Accept

- `docs/surfaces.md` and `.groundwork/surfaces.json` both exist and agree (the twin
  rule in `groundwork-check`).
- Every surface listed corresponds to something real in the codebase or scaffold.
- One commit, referencing `gw-surfaces-registry-bootstrap`.
