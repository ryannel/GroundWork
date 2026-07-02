# Brand Tokens Contract

`brand-tokens.json` is the machine-readable projection of the design system's branding decisions. The prose in `docs/design-system.md` is the human source of truth; this file is what automation reads. Both are written at the Design System commit; they never disagree because the tokens are derived from the same approved decisions.

**Location:** `.groundwork/config/brand-tokens.json` — the persistent config home, alongside `config.toml` and `state.json`. It is not a draft and it is not deleted on cache cleanup.

**Why it exists:** one brand, many renderers. The scaffolded `./dev` control plane reads these tokens to brand itself; a CLI product's own starter reads the same tokens through the same render layer; a graphical product's app generator reads them to seed its theme. The framework wears the brand it helps design.

---

## Tier 1 plus per-type Tier 2 blocks

Every project gets a `./dev` CLI regardless of what it is building, so **every product emits Tier 1** — the singular `identity` block, because identity is brand-level. **Tier 2 is a set of per-type blocks**, keyed by name at the top level of the JSON: each interface type whose design track produces a machine-projectable treatment contributes one block, so a product with several types in use carries several blocks side by side.

| Block | Emitted by | Carries | Read by |
|---|---|---|---|
| `identity` (Tier 1) | every product, exactly once | name, wordmark glyph, primary/accent colour, voice | `./dev`, lightly — and every Tier 2 consumer as the fallback root |
| `terminal` (Tier 2) | the `cli` track | colour role table, symbol vocabulary, splash, typography | `./dev` richly + the product CLI, via the shared render layer |
| `visual` (Tier 2) | the `graphical-ui` track | semantic palette (both themes), typography (with per-role micro), shape, density, motion (with interaction profiles), elevation, blur, gradients, surface treatments, optional `platform` ergonomics | graphical app generators, to seed the surface theme (Tailwind today; other theme projections as surface generators land) |

The `agentic-protocol` track contributes no Tier 2 block — a protocol has no terminal or visual treatment to project.

Tier 2 blocks are **additive** over Tier 1 and over each other. Consumers read the block they need **by key**, tolerate its absence (falling back to a theme derived from `identity`), and ignore blocks they do not know. Never reshape Tier-1 fields to add a block; only append.

The `tier` field reads as a capability summary: `1` means identity only; `2` means the file carries at least one Tier 2 block. Consumers must not branch on `tier` to locate blocks — presence of the block key is the only reliable signal, and existing consumers already work this way.

---

## Field reference

### Tier 1 — `identity` (required, every product)

| Field | Type | Meaning |
|---|---|---|
| `appName` | string | Product name as shown in CLI headers and help. |
| `wordmark` | string | A short glyph or mark rendered before the name (e.g. `◢◤`). One to three characters. Empty string for none. |
| `primary` | string `#rrggbb` | The brand's primary accent colour. Drives the CLI's primary chrome (logo, active markers, step headers). |
| `accent` | string `#rrggbb` | A secondary accent for emphasis and selection. |
| `voice` | string | A short descriptor of the product's tone (e.g. `"terse, Unix-traditional"`). Informs default verbosity and microcopy. |

### Tier 2 — `terminal` (cli track)

- `colorRoles` — a map of semantic role → resolution across colour depths. Roles: `success`, `error`, `warning`, `info`, `muted`, `accent`, `header`, `key`, `value`. Each role carries `truecolor` (`#rrggbb` or `null`), `ansi256` (0–255 or `null`), and `noColor` (the bold/dim/underline/case treatment used when colour is stripped). The render layer resolves truecolor → ansi256 → noColor → plain by terminal capability. Roles with `null` colour fields (e.g. `header`) are expressed by `noColor` treatment at every depth.
- `symbols` — a map of marker → `{ unicode, ascii }`. The render layer uses `unicode` on capable terminals and `ascii` otherwise. Markers: `success`, `error`, `warning`, `info`, `step`, `substep`, `active`.
- `splash` — `{ style, tagline }`. `style` is one of `wordmark-line` (the mark + name on one line), `banner` (a multi-line header), or `none`. `tagline` is optional.
- `typography` — treatment per content tier: `header`, `title`, `body`, `muted`. Values are treatment descriptors (`"bold + UPPERCASE"`, `"bold + primary"`, `"plain"`, `"dim"`).

### Tier 2 — `visual` (graphical-ui track)

- `palette` — a map of semantic role → `{ light, dark }` CSS colour strings (OKLCH or `#rrggbb`), the machine form of the colour architecture in `docs/design-system.md`. Roles: `primary`, `accent`, `surface`, `surfaceAlt`, `textBody`, `success`, `error`, `warning`, `info`. Both theme values are required for every role — the design system commits to dual-theme palettes, so the projection carries both.
- `typography` — `{ display, body, scale }`. `display` and `body` are `{ family, weight }` for the heading and body families. `scale` is a short descriptor of the type-scale treatment (e.g. `"1.25 modular from 16px, fluid clamp"`), enough for a generator to reconstruct the scale's character without re-deriving every step — the full scale lives in the document. Optionally carries `roles` — a map of type role (`display`, `title`, `body`, `caption`, `label`) → `{ size, lineHeight, weight, tracking }`, the concrete per-role micro (line-height and tracking) that separates considered type from framework defaults — and `numeric` (e.g. `"tabular-nums"`) where columns of figures must align.
- `shape` — `{ radiusBase, character }`. `radiusBase` is the base corner radius (e.g. `"8px"`); `character` is a one-line descriptor of the shape language (e.g. `"soft, concentric nesting"`).
- `density` — a one-line spacing/density descriptor carrying the grid base (e.g. `"comfortable, 8pt grid"`).
- `motion` — `{ easeStandard, durationBaseMs, personality }`. `easeStandard` is the standard easing curve (`"cubic-bezier(0.2, 0, 0, 1)"`), `durationBaseMs` the base duration, `personality` a one-word register (`"snappy"`, `"weighted"`, `"restrained"`). Optionally carries `interactions` — a map of context (`hover`, `press`, `enter`, `exit`, `stagger`) → `{ durationMs, ease, transform }`, the per-context motion profiles a surface spec references so feedback timing is a token rather than an ad-hoc value invented per component.
- `elevation` — optional; a map of level name → an ordered array of shadow layers, each `{ y, blur, spread?, color }` (CSS length plus an OKLCH/`#rrggbb` colour, alpha tapering as the layer widens). The machine form of the design system's depth model: a level is a *stack* — several layers reading as one modelled shadow — not a single drop shadow. Name levels by role (`low`, `mid`, `high`) or by the product's own vocabulary. The geometry serves both themes; carry theme-specific tinting in the layer colour where the design system calls for it.
- `blur` — optional; a map of level name → CSS length (e.g. `"subtle": "8px"`, `"standard": "12px"`, `"heavy": "20px"`), the backdrop-blur radii the surface treatments draw on.
- `gradients` — optional; a map of name → a CSS gradient string (the mesh/aurora recipe, e.g. a layered `radial-gradient`), or `{ light, dark }` when the recipe differs by theme. The machine form of the design system's ambient-texture decisions.
- `surface` — optional; a map of named surface treatment → a composition of the tokens above: `{ blur?, tint?, border?, elevation?, gradient?, noise? }`, where `blur`/`elevation`/`gradient` name an entry in those maps (or carry a literal value) and `tint`/`border` are CSS colours with alpha. This is the per-app surface vocabulary — the glass/elevated/hero treatments a product composes once and reuses — and it is the home for surface recipes that must never be baked into an engineer skill. A generator projects each treatment into one utility class.
- `references` — optional; the machine-readable form of the design system's `## Design References` record. An array of `{ name, admired }` objects (e.g. `{ "name": "Linear", "admired": "command-palette density, backdrop blur, restraint with colour" }`), naming the market-leading products the design drew from and the specific qualities admired. It is the machine index of the technique library — it informs the atmosphere and motion tokens and the per-surface micro-polish spec at bet design; present when the design system committed a reference record.
- `platform` — optional; sub-objects keyed by platform dimension. Each theme projection reads the sub-object it serves and ignores the rest. Web needs no sub-object — the fields above are the web baseline, and one visual block serves every platform.
  - `platform.touch` (mobile surfaces) — `{ targetMin, durationScale }`. `targetMin` is the minimum interactive dimension (e.g. `"48dp"`); the mobile theme projection enforces it in tap-target sizing. `durationScale` (optional, default 1) multiplies `durationBaseMs` for touch surfaces, where full-screen transitions span more distance than pointer micro-interactions.
  - `platform.desktop` (desktop surfaces) — `{ titleBar, menuStyle, density }`. `titleBar` is the window-chrome treatment: `"native"`, `"hidden-inset"` (content extends beneath the platform's window controls), or `"custom"`. `menuStyle` is `"native"` (OS menu bar) or `"in-window"`. `density` (optional) overrides the top-level `density` descriptor for pointer-precision layouts. The desktop shell owns these fields; its renderer reads the shared fields unchanged.

---

## Annotated example — a product carrying both Tier 2 blocks

A web app, a mobile app, and a desktop shell plus an admin CLI: the graphical-ui track emitted one `visual` block for all three graphical surfaces — with `platform` ergonomics for mobile and desktop — the cli track emitted `terminal`, and every projection carries the same brand.

```json
{
  "schema": "groundwork.brand-tokens",
  "version": 1,
  "tier": 2,
  "identity": {
    "appName": "Acme",
    "wordmark": "◢◤",
    "primary": "#5fafff",
    "accent": "#d7afff",
    "voice": "terse, Unix-traditional"
  },
  "visual": {
    "palette": {
      "primary":    { "light": "oklch(55% 0.18 250)", "dark": "oklch(70% 0.15 250)" },
      "accent":     { "light": "oklch(70% 0.15 300)", "dark": "oklch(75% 0.13 300)" },
      "surface":    { "light": "oklch(98% 0.005 250)", "dark": "oklch(18% 0.01 250)" },
      "surfaceAlt": { "light": "oklch(95% 0.008 250)", "dark": "oklch(22% 0.012 250)" },
      "textBody":   { "light": "oklch(25% 0.01 250)", "dark": "oklch(90% 0.005 250)" },
      "success":    { "light": "oklch(60% 0.13 160)", "dark": "oklch(70% 0.12 160)" },
      "error":      { "light": "oklch(55% 0.18 25)",  "dark": "oklch(68% 0.16 25)" },
      "warning":    { "light": "oklch(70% 0.14 85)",  "dark": "oklch(78% 0.13 85)" },
      "info":       { "light": "oklch(60% 0.14 250)", "dark": "oklch(72% 0.12 250)" }
    },
    "typography": {
      "display": { "family": "Instrument Sans", "weight": 600 },
      "body":    { "family": "Inter", "weight": 400 },
      "scale":   "1.25 modular from 16px, fluid clamp",
      "roles": {
        "display": { "size": "2.5rem",   "lineHeight": 1.1,  "weight": 600, "tracking": "-0.02em" },
        "title":   { "size": "1.5rem",   "lineHeight": 1.25, "weight": 600, "tracking": "-0.01em" },
        "body":    { "size": "1rem",     "lineHeight": 1.6,  "weight": 400, "tracking": "0" },
        "caption": { "size": "0.875rem", "lineHeight": 1.5,  "weight": 400, "tracking": "0.01em" }
      },
      "numeric": "tabular-nums"
    },
    "shape": { "radiusBase": "8px", "character": "soft, concentric nesting" },
    "density": "comfortable, 8pt grid",
    "motion": {
      "easeStandard": "cubic-bezier(0.2, 0, 0, 1)",
      "durationBaseMs": 150,
      "personality": "snappy",
      "interactions": {
        "hover":   { "durationMs": 150, "ease": "cubic-bezier(0, 0, 0.2, 1)", "transform": "translateY(-1px)" },
        "press":   { "durationMs": 100, "ease": "cubic-bezier(0.4, 0, 1, 1)", "transform": "scale(0.97)" },
        "enter":   { "durationMs": 200, "ease": "cubic-bezier(0, 0, 0.2, 1)", "transform": "scale(0.98)" },
        "stagger": { "durationMs": 30,  "ease": "linear",                     "transform": "none" }
      }
    },
    "elevation": {
      "low":  [ { "y": "1px", "blur": "2px", "color": "oklch(0% 0 0 / 0.06)" } ],
      "mid":  [ { "y": "1px", "blur": "2px", "color": "oklch(0% 0 0 / 0.06)" },
                { "y": "4px", "blur": "8px", "color": "oklch(0% 0 0 / 0.04)" } ],
      "high": [ { "y": "1px",  "blur": "2px",  "color": "oklch(0% 0 0 / 0.06)" },
                { "y": "4px",  "blur": "8px",  "color": "oklch(0% 0 0 / 0.04)" },
                { "y": "12px", "blur": "24px", "color": "oklch(0% 0 0 / 0.03)" } ]
    },
    "blur": { "subtle": "8px", "standard": "12px", "heavy": "20px" },
    "gradients": {
      "aurora": "radial-gradient(60% 60% at 30% 20%, oklch(70% 0.15 300 / 0.18), transparent 70%)"
    },
    "surface": {
      "glass":    { "blur": "standard", "tint": "oklch(98% 0.005 250 / 0.72)", "border": "oklch(100% 0 0 / 0.08)", "elevation": "mid" },
      "elevated": { "blur": "heavy",    "tint": "oklch(98% 0.005 250 / 0.82)", "border": "oklch(100% 0 0 / 0.12)", "elevation": "high" },
      "hero":     { "blur": "standard", "tint": "oklch(98% 0.005 250 / 0.65)", "border": "oklch(100% 0 0 / 0.10)", "elevation": "high", "gradient": "aurora" }
    },
    "platform": {
      "touch":   { "targetMin": "48dp", "durationScale": 1.25 },
      "desktop": { "titleBar": "hidden-inset", "menuStyle": "native", "density": "compact, 8pt grid" }
    }
  },
  "terminal": {
    "colorRoles": {
      "success": { "truecolor": "#5faf87", "ansi256": 72,  "noColor": "bold" },
      "error":   { "truecolor": "#d75f5f", "ansi256": 167, "noColor": "bold" },
      "warning": { "truecolor": "#d7af5f", "ansi256": 179, "noColor": "bold" },
      "info":    { "truecolor": "#5fafff", "ansi256": 75,  "noColor": "dim" },
      "muted":   { "truecolor": "#8a8a8a", "ansi256": 245, "noColor": "dim" },
      "accent":  { "truecolor": "#d7afff", "ansi256": 183, "noColor": "underline" },
      "header":  { "truecolor": null,      "ansi256": null, "noColor": "bold+upper" },
      "key":     { "truecolor": "#5fafff", "ansi256": 75,  "noColor": "plain" },
      "value":   { "truecolor": "#d0d0d0", "ansi256": 252, "noColor": "plain" }
    },
    "symbols": {
      "success": { "unicode": "✔", "ascii": "OK" },
      "error":   { "unicode": "✖", "ascii": "x" },
      "warning": { "unicode": "⚠", "ascii": "!" },
      "info":    { "unicode": "●", "ascii": "*" },
      "step":    { "unicode": "▶", "ascii": ">" },
      "substep": { "unicode": "↳", "ascii": "-" },
      "active":  { "unicode": "❯", "ascii": ">" }
    },
    "splash": { "style": "wordmark-line", "tagline": "" },
    "typography": {
      "header": "bold + UPPERCASE",
      "title":  "bold + primary",
      "body":   "plain",
      "muted":  "dim"
    }
  }
}
```

A CLI-only product is the same object without the `visual` block; a web-only product, without the `terminal` block — and without `platform`, which appears only when a mobile or desktop surface shares the visual block. A Tier-1 file (`"tier": 1`) carries neither block — `identity` only.

---

## Rules

- **Derive, never invent.** Every value traces to an approved Design System decision. `terminal.colorRoles` is the machine form of the CLI section's colour architecture; `visual.palette` is the machine form of the graphical section's colour architecture — block and document must carry the same values.
- **Tier 1 is always derivable.** For products with no cli track, project the brand's primary palette colour to `identity.primary`, pick a secondary as `accent`, and take the product name and voice from the brief. This is a mechanical projection, not a new design conversation.
- **One block per type, one writer per block.** Each type's track emits its own block at the single Design System commit (or at lazy activation, when a type's track runs later). Blocks never share or override each other's fields.
- **Versioned contract.** `version` is bumped only when the shape of an existing field changes. Adding a block kind, or an optional field or sub-object within a block (e.g. `visual.platform`), is additive — `version` stays 1. Consumers ignore unknown fields and unknown blocks, and tolerate any missing Tier 2 block or optional field.
- **Many readers, by key.** The `workspace-dev-cli` generator, the shared CLI render layer, and the `cli-app` product generator read `terminal`; graphical app generators read `visual`; none of them write, and none locate a block through the `tier` field.
