# Brand Tokens Contract

`brand-tokens.json` is the machine-readable projection of the design system's branding decisions. The prose in `docs/design-system.md` is the human source of truth; this file is what automation reads. Both are written at the Design System commit; they never disagree because the tokens are derived from the same approved decisions.

**Location:** `.groundwork/config/brand-tokens.json` — the persistent config home, alongside `config.toml` and `state.json`. It is not a draft and it is not deleted on cache cleanup.

**Why it exists:** one brand, two terminals. The scaffolded `./dev` control plane reads these tokens to brand itself, and — when the product being built is a CLI — the product's own CLI starter reads the *same* tokens through the *same* render layer. The framework wears the brand it helps design.

---

## Two tiers

Every project gets a `./dev` CLI regardless of what it is building, so **every design-system track emits Tier 1**. Only the CLI track produces the full terminal treatment, so **the CLI track emits Tier 2** (Tier 1 plus the `terminal` block).

| Tier | Emitted by | Carries | Brands |
|---|---|---|---|
| **Tier 1 — Identity** | every track (graphical-ui, cli, agentic-protocol) | name, wordmark glyph, primary/accent colour, voice | `./dev`, lightly |
| **Tier 2 — Terminal** | the CLI track only | Tier 1 + colour role table, symbol vocabulary, splash, typography | `./dev` richly + the product CLI |

Tier 2 is **additive** over Tier 1 — the `terminal` block is the only addition. A consumer reading a Tier-1 file simply finds no `terminal` block and falls back to a derived default theme. Never reshape Tier-1 fields to add Tier 2; only append.

---

## Field reference

### Tier 1 — `identity` (required, every track)

| Field | Type | Meaning |
|---|---|---|
| `appName` | string | Product name as shown in CLI headers and help. |
| `wordmark` | string | A short glyph or mark rendered before the name (e.g. `◢◤`). One to three characters. Empty string for none. |
| `primary` | string `#rrggbb` | The brand's primary accent colour. Drives the CLI's primary chrome (logo, active markers, step headers). |
| `accent` | string `#rrggbb` | A secondary accent for emphasis and selection. |
| `voice` | string | A short descriptor of the product's tone (e.g. `"terse, Unix-traditional"`). Informs default verbosity and microcopy. |

### Tier 2 — `terminal` (CLI track only)

- `colorRoles` — a map of semantic role → resolution across colour depths. Roles: `success`, `error`, `warning`, `info`, `muted`, `accent`, `header`, `key`, `value`. Each role carries `truecolor` (`#rrggbb` or `null`), `ansi256` (0–255 or `null`), and `noColor` (the bold/dim/underline/case treatment used when colour is stripped). The render layer resolves truecolor → ansi256 → noColor → plain by terminal capability. Roles with `null` colour fields (e.g. `header`) are expressed by `noColor` treatment at every depth.
- `symbols` — a map of marker → `{ unicode, ascii }`. The render layer uses `unicode` on capable terminals and `ascii` otherwise. Markers: `success`, `error`, `warning`, `info`, `step`, `substep`, `active`.
- `splash` — `{ style, tagline }`. `style` is one of `wordmark-line` (the mark + name on one line), `banner` (a multi-line header), or `none`. `tagline` is optional.
- `typography` — treatment per content tier: `header`, `title`, `body`, `muted`. Values are treatment descriptors (`"bold + UPPERCASE"`, `"bold + primary"`, `"plain"`, `"dim"`).

---

## Annotated example (Tier 2)

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

A Tier-1 file is the same object with `"tier": 1` and no `terminal` block.

---

## Rules

- **Derive, never invent.** Every value traces to an approved Design System decision. The `terminal.colorRoles` table is the machine form of the colour architecture in `docs/design-system.md` — they must carry the same values.
- **Tier 1 is always derivable.** For graphical-ui and agentic-protocol products, project the brand's primary palette colour to `identity.primary`, pick a secondary as `accent`, and take the product name and voice from the brief. This is a mechanical projection, not a new design conversation.
- **Versioned contract.** `version` is bumped only when the shape changes. Consumers ignore unknown fields and tolerate a missing `terminal` block. Keep changes additive.
- **One writer, many readers.** Only the Design System commit writes this file. The `workspace-dev-cli` generator, the shared CLI render layer, and the `cli-app` product generator read it; none of them write it.
