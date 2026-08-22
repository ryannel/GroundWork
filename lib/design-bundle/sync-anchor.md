# Sync Anchor

This module pins the source it deliberately mirrors. When the listed file
changes, this module must be reviewed in the same commit. CI verifies the hash
matches (`scripts/check_sync_anchors.py`, run by `./dev test contracts`).

`resolve.js` is the SIBLING of `resolveVisual()` in the generator below, not a
copy of it, and the distinction matters when reviewing a mismatch:

- **The projection SHAPE is meant to differ.** The generator projects the token
  file onto shadcn's structural variable names because its consumers are app
  generators. The sheet projects onto the design system's own role names,
  because the owner has to recognise what they are approving. Divergence here
  is the design.
- **The validation FLOOR is meant to match.** `validColor`, `validLen`,
  `safeCss`, `composeShadow` and `resolveElevationLevel` decide what counts as a
  usable token at all — including which SHAPES a token may take, which is why
  `resolveElevationLevel` belongs here: it is what accepts `{light, dark}`
  elevation alongside a flat layer array. If
  the generator tightens or loosens one, the sheet must move with it — otherwise
  the sheet shows the owner a value the app will reject, or rejects one the app
  will happily compile. That is a lie in whichever direction it runs.

The two are not imported into one another on purpose: the generator is
TypeScript compiled into `dist/` (gitignored), and the CLI must run from a
published package with no build step. `lib/design-bundle/resolve.js` is plain
CommonJS with zero dependencies for that reason, like every other `lib/` module.

| Source file | SHA-256 | Last reviewed | Mirrored into |
|---|---|---|---|
| src/generators/shared/brand-tokens.ts | 3e80d8aa1315c62efa7186384ea6f93a460c464bb92adebd764e6c49388b3f41 | 2026-08-18 | lib/design-bundle/resolve.js (validation floor: validColor, validLen, safeCss, composeShadow, resolveElevationLevel) |
