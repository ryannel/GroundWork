# Project the atmosphere token layer into existing Next.js apps

A Next.js app scaffolded before the per-app token projection wears a hardcoded
`app/globals.css` (its `:root`/`.dark` palette written inline) and has no
`app/brand.css`. The design system's atmosphere — elevation stacks, blur, gradients,
surface treatments, motion profiles, type-role micro — therefore cannot reach the UI,
and the deterministic token-conformance gate is absent. This migration brings the app
to the generated token layer: a regenerated `app/brand.css`, a restructured
`app/globals.css` that owns structure (mappings + surface utilities) while `brand.css`
owns values, and `tests/system/test_token_conformance.py`.

This is judgment work because `globals.css` is Tier-3 generator output the project may
have hand-edited; the structure is replaced but project-authored rules must be carried
forward, not clobbered.

## Detect

`pending` when **all** hold; otherwise `n/a`:

- A `nextjs-app` surface exists — a `services/*/app/globals.css` is present (provenance
  records the `nextjs-app` generator), and
- that `globals.css` does **not** already `@import "./brand.css"` (the marker of the new
  structure), or no sibling `app/brand.css` exists.

`done` once every `nextjs-app` service imports `brand.css` and carries a `brand.css`
sibling. Detection is read-only.

## Transform

For each `nextjs-app` service:

1. **Regenerate `app/brand.css`** from `.groundwork/config/brand-tokens.json` exactly as
   the generator does — the full shadcn structural palette (light `:root` + `.dark`)
   plus the `--gw-*` atmosphere layer (blur, elevation stacks, hero gradient, surface
   tints/borders, type-role and motion custom properties), projecting the `visual` block
   where present and the neutral defaults where absent. If no `visual` block exists, emit
   the neutral starter so the file is always valid.
2. **Restructure `app/globals.css`** to the new shape: keep the Tailwind/`tw-animate-css`
   imports, add `@import "./brand.css";`, keep the `@theme inline` mappings and **add** the
   atmosphere mappings (`--shadow-*`, `--blur-*`) and the semantic `--color-success/warning/info`
   rows, keep the dark `@custom-variant` and `@layer base`, and add the `.surface-glass` /
   `.surface-elevated` / `.surface-hero` component classes. **Remove** the now-duplicated
   inline `:root`/`.dark` palette blocks (they live in `brand.css`). **Preserve** any
   project-authored rules the user added to `globals.css` — move them below the imports
   intact; never silently drop a hand-written rule.
3. **Add `tests/system/test_token_conformance.py`** for the graphical surface(s) from the
   `system-test-runner` template, matching the project's single-surface or surface-registry mode.

## Accept

- Every `nextjs-app` `globals.css` imports `./brand.css`; a sibling `app/brand.css` exists
  carrying both the structural palette and the `--gw-*` atmosphere variables for light and dark.
- `globals.css` exposes the atmosphere token mappings and the three `.surface-*` classes; no
  duplicated inline palette remains; project-authored rules are intact.
- `tests/system/test_token_conformance.py` is present for each graphical surface.
- The app still builds and the system suite collects.
