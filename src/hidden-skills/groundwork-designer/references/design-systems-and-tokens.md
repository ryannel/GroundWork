# Design Systems & Tokens

When you advise on the design system, treat it as the durable contract between design and engineering: semantic tokens as its wire format, components as its typed interfaces. The decisions that determine whether it holds are tiering tokens correctly and wiring the system to production so it is implemented, not decorated.

## Tokens are tiered; primitives are never consumed directly

A token system has three tiers. **Primitives** are context-free raw values — colour ramps, the spacing and radius scales, durations — with no usage intent. **Semantic** tokens alias primitives by role (`color.background.default`, `border.hairline`) and are the layer components bind to and themes remap. **Component** tokens are scoped overrides referencing the semantic tier, an escape hatch promoted only on real repeated need. A component never reads a primitive directly, because wiring it to `blue.500` makes theming a rewrite; cap indirection at roughly two hops. Name by intent, never by value — `color.feedback.error`, not `red-600` — because a value-named token lies the moment its value changes, and intent names are what make the system legible to both a human and an AI agent.

## Theme at the semantic tier; model axes as orthogonal overrides

Theming is a mapping swap at the semantic layer — the name stays, the primitive it points to changes per mode — so components and primitives stay theme-agnostic. Model every dimension (light/dark, contrast, brand, density) as an independent override set resolved by order, because orthogonal axes *add* while names that encode a dimension *multiply*, and only the additive model survives a fifth axis. Never precompute the full permutation matrix; author high-contrast or colourblind themes as thin diffs, not duplicate sets.

## Components are contracts

A component's public surface — props, slots, states, accessibility semantics — is designed like a typed signature and versioned like one: additions minor, renames and removals major with a deprecation window and codemod. Variant, state, size, and slot are orthogonal axes; each enumerable axis is one enum, not a pile of booleans, because an enum makes illegal states unrepresentable where boolean soup multiplies the test matrix. The same concept carries the same prop name everywhere — that consistency is what makes the system learnable. Prefer composition (compound components sharing state) over configuration, and separate a headless, ARIA-conformant behaviour core from visual decisions (semantic tokens) from product-specific recipes.

## The system is truth in code, wired to production

Tokens are the source of truth as version-controlled data, compiled into the styles the app actually serves; the design tool consumes this, it does not originate it. The system is *implemented, not decorative*, and the test is mechanical: change one semantic token and the running product moves — if it does not, it is a museum piece. Run it as a product with a central core team, add federated contribution gradually, and measure **adoption** (the share of production UI on the system), not contribution count, because most components built across teams do not belong in the core. Enforce the contract in CI: no raw hex or off-scale values, deprecated-token detection, visual regression.

## Make the system machine-legible

Author the system so an AI agent builds on it: intent-named tokens carrying usage descriptions and relationships, components with documented, discoverable APIs. A grounded agent reuses the system; an ungrounded one invents ad-hoc UI, and one reading value-named, undescribed tokens grabs the wrong one. Machine-legibility is an extension of naming-by-intent — but tokens are plumbing; the craft and architecture above them are where the value lives.

## Antipatterns to catch

- **Primitives in components.** `button { color: blue.500 }`, turning a theme change into a refactor.
- **Value-named semantics.** `neutral-80` used as if it meant something.
- **Theming the primitive layer.** Collapsing the indirection that makes theming possible.
- **Dimension-in-the-name.** Encoding mode/brand/density into names, multiplying the matrix.
- **The boolean trap.** `isPrimary`/`isLarge` where one enum belongs, permitting illegal states.
- **The decorative system.** A design-tool library reproduced by eye, with a parallel hand-kept token set.
- **Adoption by contribution count.** Measuring components added, not production on the system; promoting every snowflake.
