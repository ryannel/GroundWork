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
| `visual` (Tier 2) | the `graphical-ui` track | semantic palette (both themes), typography, shape, density, motion, optional `platform` ergonomics | graphical app generators, to seed the surface theme (Tailwind today; other theme projections as surface generators land) |

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
- `typography` — `{ display, body, scale }`. `display` and `body` are `{ family, weight }` for the heading and body families. `scale` is a short descriptor of the type-scale treatment (e.g. `"1.25 modular from 16px, fluid clamp"`), enough for a generator to reconstruct the scale's character without re-deriving every step — the full scale lives in the document.
- `shape` — `{ radiusBase, character }`. `radiusBase` is the base corner radius (e.g. `"8px"`); `character` is a one-line descriptor of the shape language (e.g. `"soft, concentric nesting"`).
- `density` — a one-line spacing/density descriptor carrying the grid base (e.g. `"comfortable, 8pt grid"`).
- `motion` — `{ easeStandard, durationBaseMs, personality }`. `easeStandard` is the standard easing curve (`"cubic-bezier(0.2, 0, 0, 1)"`), `durationBaseMs` the base duration, `personality` a one-word register (`"snappy"`, `"weighted"`, `"restrained"`).
- `references` — optional; the machine-readable form of the design system's `## Design References` record. An array of `{ name, admired }` objects (e.g. `{ "name": "Linear", "admired": "command-palette density, backdrop blur, restraint with colour" }`), naming the market-leading products the design drew from and the specific qualities admired. The Tier-3 visual-fidelity review reads it to know which references to research live as calibration; present when the design system committed a reference record. Sub-objects keyed by platform dimension; each theme projection reads the sub-object it serves and ignores the rest. Web needs no sub-object — the fields above are the web baseline, and one visual block serves every platform.
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
      "scale":   "1.25 modular from 16px, fluid clamp"
    },
    "shape": { "radiusBase": "8px", "character": "soft, concentric nesting" },
    "density": "comfortable, 8pt grid",
    "motion": {
      "easeStandard": "cubic-bezier(0.2, 0, 0, 1)",
      "durationBaseMs": 150,
      "personality": "snappy"
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
