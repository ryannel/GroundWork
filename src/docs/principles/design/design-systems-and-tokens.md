---
title: Design Systems & Tokens
description: The token contract, components as contracts, and the design system as the durable, machine-readable interface between design and engineering.
status: active
last_reviewed: 2026-06-20
---
# Design Systems & Tokens

## TL;DR

A design system is the durable contract between design and engineering: semantic tokens as its wire format, components as its typed interfaces, usage rules as its documentation. Tokens are tiered — primitives feed semantics feed the occasional component override — and components bind only to the semantic layer. The system is the source of truth in code, wired to production so a single token change moves the running product, and it is run as a product, measured by adoption rather than by how many components were contributed.

## Why this matters

The design system is the mechanism by which design survives contact with the codebase. Without it, every screen re-decides colour, spacing, and component behaviour, and the carefully authored design drifts into a thousand local variations. With a *decorative* system — a design-tool library reproduced by hand in code — the drift is just slower. The systems that hold are the ones built as a contract: tokens as version-controlled data, components as published APIs, both wired to production and enforced in CI. That contract is now also what lets AI tooling generate on-system UI instead of inventing ad-hoc interfaces, which makes its machine-legibility a first-class concern.

## Our principles

### 1. Tokens are tiered, and primitives are never consumed directly

A token system has three tiers. **Primitives** (options) are context-free raw values — full colour ramps, the spacing and radius scales, durations — carrying no usage intent. **Semantic** tokens (decisions) alias primitives by role — `color.background.default`, `color.text.primary`, `border.hairline` — and this is the layer components bind to and the layer themes remap. **Component** tokens are scoped overrides that reference the semantic tier, an escape hatch promoted only on genuine repeated need, not the norm. Components never read a primitive directly, because a component wired to `blue.500` makes theming a rewrite; indirection is capped at roughly two hops so the system stays traceable.

### 2. Name by intent, not by value

A token is named for what it means, never for what it currently is — `border.hairline`, not `neutral-80`; `color.feedback.error`, not `red-600` — because a value-named token used semantically lies the moment the value changes, and because intent names are what make the system legible to a human and usable by an AI agent reading it. Theme and mode are orthogonal axes, each an explicit modifier, never positions baked into one name.

### 3. Theme at the semantic tier; model axes as orthogonal overrides

Theming is a mapping swap at the semantic layer — the token name stays stable, the primitive it points to changes per mode — so components and primitives stay theme-agnostic and a dark theme is a remap, not a parallel set of components. Every theming dimension (light/dark, contrast, brand, density) is modelled as an independent override set resolved by order, because orthogonal axes *add* while names that encode a dimension *multiply* — and only the additive model survives a fifth axis. We never precompute the full permutation matrix, and high-contrast or colourblind themes are authored as thin diffs over the base, not full duplicate sets.

### 4. Components are contracts

A component's public surface — props, slots, states, accessibility semantics — is a contract designed like a typed signature and versioned like one: additions are minor, renames and removals are major with a deprecation window and a codemod. Variant, state, size, and slot are four orthogonal axes; each enumerable axis is a single enum rather than a pile of booleans, because an enum makes illegal states unrepresentable where boolean soup multiplies the test matrix and permits nonsense combinations. The same concept carries the same prop name across every component, because that consistency is what makes the system learnable.

### 5. Compose over configure; separate behaviour from style

We prefer composition to configuration — compound components that share state and let the consumer own structure — because configuration scales linearly into a swamp of props while composition expresses infinite arrangements from a small, stable API. Behaviour, accessibility, focus, and keyboard handling live in a headless core that conforms to the ARIA Authoring Practices Guide; visual decisions live in semantic tokens; product-specific assemblies live as recipes in the product, not the system. This separation is what lets a component be re-themed without touching product code and re-styled without reimplementing behaviour.

### 6. The system is truth in code, wired to production

Tokens are the source of truth as version-controlled data — diffable, reviewable, semver'd — compiled by a build step into the styles the application actually serves; the design tool consumes this, it does not originate it, and component behaviour is truth in the code closest to the user. The system is *implemented, not decorative*, and the test is mechanical: change one semantic token's value and the running product changes. If it does not, the system is a museum piece and the design was never delivered. Documentation is executable — prop tables generated from types, stories that double as test fixtures, accessibility checked in the same surface.

### 7. Run it as a product: centralise the core, measure adoption

A design system is run as a product with a roadmap and consumers, owned by a central core team — federated contribution is added gradually once the foundations are stable, never adopted as the starting model, because pure federation has no owner and decays. The success metric is **adoption** — the share of production UI built from the system — not the count of components contributed, because most components made across teams do not belong in the system and contribution volume measures effort, not value. The contract is enforced in CI: linting that forbids raw hex and off-scale values, deprecated-token detection, and visual regression, because a contract a machine cannot check is a contract that drifts.

### 8. Make the system machine-legible

The system is authored so an AI agent can build on it: semantic, intent-named tokens carrying usage descriptions and relationships, and components with discoverable, documented APIs. An agent grounded in the system reuses its components; an ungrounded agent invents ad-hoc UI, and an agent reading value-named, undescribed tokens grabs the wrong one. Machine-legibility is therefore an extension of naming-by-intent, not a separate feature — but tokens remain plumbing, and the craft and architecture above them are still where the value lives.

## How we apply this

- [Visual Design](visual-design.md) — the colour, type, and depth decisions that become the token values.
- [Surface Architecture](../system-design/surface-architecture.md) — the design system as a contract spanning surfaces, and the core/surface seam.
- [AI-Native Design](ai-native-design.md) — grounding generative UI in the system's tokens and component contracts.

## Anti-patterns we reject

- **Primitives in components.** `button { color: blue.500 }` — turning a theme change into a six-month refactor.
- **Value-named semantics.** `neutral-80` used as if it meant something, lying the moment its value moves.
- **Theming the primitive layer.** Remapping primitives instead of semantics, collapsing the indirection that makes theming possible.
- **Dimension-in-the-name.** Encoding mode/brand/density into token names, multiplying the matrix until a fifth axis is unmanageable.
- **The boolean trap.** `isPrimary`, `isLarge` booleans where one enum belongs, permitting illegal states and exploding the test matrix.
- **The decorative system.** A design-tool library reproduced by eye in code, with a parallel hand-kept token set that drifts immediately.
- **Adoption by contribution count.** Measuring how many components were added rather than how much of production is actually on the system; promoting every snowflake into the core.

## Further reading

- Nathan Curtis / EightShapes — *Naming Tokens*, *Tokens in Design Systems*, *The Fallacy of Federated Design Systems*.
- Brad Frost — *Creating Themeable Design Systems* and *Components, Recipes, and Snowflakes*.
- Martin Fowler / Adam Woznica — *Design Token-Based UI Architecture*.
- W3C Design Tokens Community Group — the DTCG format as the vendor-neutral token contract.
