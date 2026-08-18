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
  `safeCss` and `composeShadow` decide what counts as a usable token at all. If
  the generator tightens or loosens one, the sheet must move with it — otherwise
  the sheet shows the owner a value the app will reject, or rejects one the app
  will happily compile. That is a lie in whichever direction it runs.

The two are not imported into one another on purpose: the generator is
TypeScript compiled into `dist/` (gitignored), and the CLI must run from a
published package with no build step. `lib/design-bundle/resolve.js` is plain
CommonJS with zero dependencies for that reason, like every other `lib/` module.

| Source file | SHA-256 | Last reviewed | Mirrored into |
|---|---|---|---|
| src/generators/shared/brand-tokens.ts | fd6a4f6bf987a7161817ae6d986a257b8df03994e920fabfed2a3733912f10a1 | 2026-08-18 | lib/design-bundle/resolve.js (validation floor: validColor, validLen, safeCss, composeShadow) |
