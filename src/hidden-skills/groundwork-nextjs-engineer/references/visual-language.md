# Visual Language & Surfaces

This reference is about **technique** — how to consume the design system and how the surface layer composes depth. It carries **no fixed palette, type, or surface catalogue**. Every concrete value (colours, type scale, shadow stacks, blur radii, gradients, surface treatments) is a per-app decision that lives in `docs/design-system.md` and is projected from `.groundwork/config/brand-tokens.json` into `app/brand.css` and surfaced through `app/globals.css` as token utilities. Read the design system before any visual work; never invent values here.

## Where the values live

The nextjs-app generator projects the design system's `visual` block into `app/brand.css` (regenerated, never hand-edited). `app/globals.css` maps those values into Tailwind token utilities and surface classes. The chain:

| Layer | Owns | You touch |
|---|---|---|
| `docs/design-system.md` | The human source of truth — palette, type, elevation, surfaces, motion, at the depth standard | Read it |
| `.groundwork/config/brand-tokens.json` `visual` block | The machine projection of those decisions | Read it; never hand-edit |
| `app/brand.css` (generated) | `--gw-*` values + the shadcn structural vars, light and dark | Never hand-edit |
| `app/globals.css` | Token-utility mappings (`@theme`) + surface classes | Extend structure only, never bake values |
| Your components | Consume token utilities and surface classes | Here |

**Consume tokens, never literals.** A raw hex/length/shadow/blur/gradient in a component bypasses the design system and fails the token-conformance lint (`eslint.config.mjs`). If you need a raw value, reference the projected custom property (`var(--gw-shadow-mid)`, or the Tailwind var form `shadow-(--gw-shadow-mid)`) — never a literal recipe.

---

## Colour (OKLCH)

The design system defines colour in OKLCH — perceptually uniform lightness, so a colour at `L=0.7` reads equally bright across hues (unlike HSL). **Hex, RGB, and HSL literals are forbidden in components.**

Consume colour through the projected token utilities — `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border-border`, `bg-destructive`, the `chart-*` roles — all backed by the brand's palette in `brand.css`. The semantic role of each (which hue means success, error, accent) is the design system's call, recorded there; honour it rather than reaching for a generic "green."

**Dynamic opacity** — derive a translucent variant of any token without a new variable, via the relative colour function:

```css
/* technique, not a value: any projected colour var works */
background-color: oklch(from var(--background) l c h / 0.72);
```

This keeps one source of truth per colour while allowing per-surface translucency.

---

## Typography

The design system commits a full type scale (families, and per-role size, line-height, weight, tracking) at `docs/design-system.md`; the per-role micro is projected into `--gw-text-<role>-{size,line,weight,tracking}`. Consume the scale through the project's type utilities or those custom properties. Do not invent ad-hoc font sizes — if content does not fit a role, the layout needs adjustment, not a new size. Where figures must align in columns, use the projected tabular-numerals treatment rather than the proportional default.

---

## Spacing (8pt grid)

The design system's spacing scale derives from an 8px base (4px is the optical sub-grid). Consume it through the spacing-scale utilities (`p-4`, `gap-6`, `px-8`) — arbitrary length values (`p-[12px]`) fail lint. Reserve the 4px sub-grid step for optical alignment (icon centring, badge offsets, hairline adjustments), not general spacing. Related elements sit closer than unrelated ones: internal spacing is always tighter than the gap between groups.

---

## Surface depth — the technique

High-end surfaces read as modelled material, not flat boxes. Four techniques compose that depth. The design system decides the *values*; you apply them through the projected tokens and surface classes.

- **Multi-layer shadow.** A single drop shadow reads flat. Depth comes from stacking several shadows — a tight contact layer, a mid ambient layer, a wide diffuse layer — with alpha tapering as each widens, tinted toward the background rather than pure black. The stacks are projected as `--gw-shadow-low/mid/high` and surfaced as the `shadow-low/mid/high` utilities (theme-aware: the dark theme carries deeper variants).
- **Backdrop blur.** Translucent surfaces over content need `backdrop-filter: blur(...)` (always paired with the `-webkit-` prefix). Blur radii are projected as `--gw-blur-subtle/standard/heavy` and the `backdrop-blur-*` utilities.
- **Concentric radii.** When nesting rounded elements, keep curves harmonious: `inner radius = outer radius − padding`. Use the radius tokens (`rounded-lg`, `rounded-xl`), not literal pixel radii.
- **Ambient gradient.** A barely-perceptible mesh/aurora gradient (opacity well under ~0.15, fading to transparent, layered over a solid fallback) adds warmth to large surfaces. Recipes are projected as gradient tokens; the hero surface composes one.

### Surface utilities

The per-app surface vocabulary — the glass/elevated/hero treatments that used to be a fixed catalogue — is projected from the design system's `surface` tokens into composite classes in `globals.css`. Apply them; do not re-author the recipe:

| Class | For | Composes |
|---|---|---|
| `.surface-glass` | Regular content cards, panels, list items | standard blur + glass tint + hairline border + `shadow-mid` |
| `.surface-elevated` | Modals, dialogs, command palette, popovers | heavy blur + denser tint + border + `shadow-high` |
| `.surface-hero` | Dashboard hero metric, key insight, primary KPI | standard blur + hero tint + ambient gradient + `shadow-high` |

Need a surface the project has not defined? Compose it from the same tokens (`var(--gw-shadow-*)`, `var(--gw-blur-*)`, the palette vars) or add the treatment to the design system and regenerate — never hardcode a one-off stack in a component.
