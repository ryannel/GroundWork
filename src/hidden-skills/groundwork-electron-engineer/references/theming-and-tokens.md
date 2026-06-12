# Theming & Tokens — the Desktop Delta

This reference covers **only what the desktop shell adds** to theming. Tailwind composition rules, styling discipline, visual language, and accessibility are the web stack's, unchanged: `groundwork-nextjs-engineer/references/tailwind-and-styling.md` and `groundwork-nextjs-engineer/references/visual-language.md` (or `docs/principles/stack/typescript/frontend.md` when no web surface is installed).

## Table of Contents
- [The Projection Chain](#the-projection-chain)
- [The Generated brand.css](#the-generated-brandcss)
- [The @theme Mapping](#the-theme-mapping)
- [nativeTheme Sync (the Desktop Dark Mode)](#nativetheme-sync-the-desktop-dark-mode)
- [Evolving the Brand](#evolving-the-brand)

---

## The Projection Chain

The theme is **generated from the design system's brand tokens**, not authored in the app:

```
docs/design-system.md → .groundwork/config/brand-tokens.json (visual block)
                      → src/renderer/src/assets/brand.css      (GENERATED)
                      → @theme inline mapping in main.css       (static)
                      → Tailwind utilities in components
```

The same tokens drive every surface of the product (web, CLI, mobile, desktop), so cross-surface visual consistency is a build artifact, not a review hope. A hex literal in a component is a review finding — it forks the design system silently.

## The Generated brand.css

`brand.css` carries the projected values as CSS custom properties and is regenerated, never hand-edited:

- Palette roles in both themes: `--gw-primary`, `--gw-accent`, `--gw-surface`, `--gw-surface-alt`, `--gw-text-body`, `--gw-success`, `--gw-error`, `--gw-warning`, `--gw-info` — light values on `:root`, dark values on `:root[data-theme='dark']`.
- Typography: `--gw-font-display`/`--gw-font-body` (+ weights). Families render once they are bundled or system-available.
- Shape: `--gw-radius-base`.

Unlike the Dart projection (which resolves OKLCH at generation time), the renderer is CSS — token values pass through verbatim and Chromium resolves OKLCH natively. The file header records the projection source (`visual-block`, `identity-only`, or `default` — the three-tier fallback every token consumer implements).

## The @theme Mapping

`main.css` maps the custom properties into Tailwind v4 theme tokens once:

```css
@theme inline {
  --color-primary: var(--gw-primary);
  --color-surface: var(--gw-surface);
  --color-foreground: var(--gw-text-body);
  --font-display: var(--gw-font-display);
  --radius-base: var(--gw-radius-base);
  /* ... */
}
```

Components consume the utilities these tokens create (`bg-surface`, `text-primary`, `font-display`, `rounded-base`) and **never read `--gw-*` variables directly** — the mapping is the API, the variables are the projection artifact. Tailwind v4 is CSS-first: there is no `tailwind.config.js`; the plugin loads in the **renderer section** of `electron.vite.config.ts` and applies to the renderer only (main and preload have no styling surface). Needing a new semantic token means extending the `@theme` mapping from a `--gw-*` value — and if no token expresses the need, that is a design-system gap to raise, not a license to inline a value.

## nativeTheme Sync (the Desktop Dark Mode)

On desktop, the OS owns dark mode and **main is the source of truth** — this is the structural difference from the web stack's `next-themes` approach:

1. Main broadcasts `nativeTheme.shouldUseDarkColors` on the `theme:changed` push channel — once after `did-finish-load`, and on every `nativeTheme.on('updated')`.
2. The renderer's entry point subscribes via the bridge and mirrors the value onto `<html data-theme="dark|light">`.
3. `brand.css` resolves every `--gw-*` per theme from that attribute; utilities update without component involvement.

Implementation rules:

- Components never branch on theme to pick values — the custom properties already resolved per-theme. (Conditional *structure* via a `data-theme` selector is fine; conditional *colours* is the antipattern.)
- Every role carries light **and** dark values — a design-system commitment, not an option; verify visual changes in both themes (flip the OS setting, or `app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'dark'; })` in a smoke-side check).
- A user-facing theme override (light/dark/system menu) is implemented by setting `nativeTheme.themeSource` in main via an IPC channel — keeping main the single source of truth — never by writing `data-theme` directly from a component.

## Evolving the Brand

1. The design-system run updates `brand-tokens.json`.
2. Regenerate (or mechanically update) `brand.css` to match — the header marks it generated; keep the `:root` / `:root[data-theme='dark']` structure intact.
3. The `@theme` mapping and all components pick the change up for free. New palette roles need one new mapping line in `main.css`.

If a visual change cannot be expressed through tokens → brand.css → @theme → utilities, raise the design-system gap; do not hand-edit the projection.
