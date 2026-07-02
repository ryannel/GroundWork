# Graphical UI Track

This track applies to products with a visual user interface: web apps, mobile apps, desktop applications, dashboards, and any product where humans interact through a screen.

The shared foundation flow (`tracks/_foundation.md`) owns the session spine: it runs the brand-level Phases 1, 2, and 4 once for the whole product, drawing this track's contributions from the Foundation Contributions section below, and it runs this track's Phase 3 and Phase 5 at the right points. Its Cross-Phase Signal Capture rule stays in force throughout every phase of this track.

---

## Default Stance

Be fluid. Adapt seamlessly to the user's preferences, product positioning, and purpose. The agent's role is to match the user's vision — not to impose a rigid aesthetic.

The default starting position is modern, high-end design. When the user has no strong preference, advocate for the following defaults — and be ready to explain *why* each one matters:

**Technical defaults:**
- Sub-50ms interaction latency via optimistic UI execution and stale-while-revalidate (SWR) patterns. Perceived speed is the primary driver of product quality perception — a 200ms delay feels broken to users trained by Linear and Arc.
- Keyboard-first navigation with a global command palette (Cmd+K) as the primary navigation and search surface. Power users live in the keyboard; mouse-first design caps productivity.
- Strict accessibility (WCAG 2.1 AA minimum), semantic HTML, and zero-mouse navigability. Accessibility is structural quality, not a compliance checkbox — products that work for screen readers work better for everyone.
- Light and dark theme support with system-preference detection. Dual-theme is a baseline expectation, not a premium feature.
- Hardware-accelerated animation only (`transform`, `opacity`, `filter`), respecting `prefers-reduced-motion`. Animating layout properties (width, height, top) triggers reflow and drops frames.
- Perceptually uniform colour spaces (OKLCH). HEX lightness is not perceptual — equal steps look unequal across hues; OKLCH solves this by design.
- An 8-point spatial grid for all dimensions. Consistent spacing creates visual rhythm; arbitrary pixel values accumulate into visual noise.

**Aesthetic bar** (examples of the premium standard the agent targets — adapt to the user's direction):
- Dual-theme design with considered light and dark palettes — not an afterthought toggle.
- Multi-layered depth systems (shadow stacks, glassmorphism, neumorphism) — not flat, single-layer surfaces.
- Ambient surface treatments that break visual monotony on large canvases.
- Tactile micro-interactions: scale-on-press, spring physics, and subtle state transitions that make the UI feel physical.
- Considered layout systems (bento-box grids, focused single-column) with generous whitespace and clear visual hierarchy.
- Fluid typography that responds to viewport width.

Draw inspiration from trend-setting companies: Linear, Vercel, Raycast, Arc, Apple. These set the bar the agent calibrates against.

---

## Foundation Contributions

The shared foundation flow pulls these sections into its brand-level phases.

### Envelope (foundation Phase 1)

Cover all relevant dimensions of the graphical envelope: performance and latency targets, accessibility baselines, multi-device and viewport requirements, real-time and sync needs, offline and error tolerance, session persistence, notification model, and security UX. Ground each decision in the product brief and apply the track defaults where applicable: sub-50ms perceived latency, WCAG 2.1 AA, 8-point grid, OKLCH, hardware-accelerated animation only.

### Type language (foundation Phase 4)

Fold these dimensions into the foundation's language clusters:

- **Cluster 1: Identity** — Aesthetic direction, colour psychology and mood, typography character. Propose the product's visual personality as a unified stance: what it feels like, what emotional register both themes carry, and what typographic character reinforces the identity.
- **Cluster 2: Feel** — Surface and depth philosophy, motion and feedback, content density and readability. Propose how physical and tactile the UI should feel — layered or flat, animated or restrained, dense or spacious.
- **Cluster 3: Craft** — Iconography and imagery weight, tone of voice and microcopy, data visualisation (if applicable). Propose the visual weight of icons and the personality of the UI's copy.

This type's Synthesis Gate expression fields:

- **Colour mood**: The emotional temperature for both themes.
- **Depth and surface**: How physical the UI feels and what techniques create that physicality.
- **Typography character**: The personality of the type, not the font name.
- **Motion philosophy**: How the UI responds to touch.
- **Iconography feel**: The visual weight and style.

---

## Phase 3: App Shell

*Runs inside the foundation flow's Phase 3 step — once for this type, per the shared skeleton it defines.*

The app shell is the structural container everything else lives inside — navigation, layout, context preservation, and system-level states.

Decision dimensions: global navigation and search patterns, layout skeleton, context preservation (how sub-tasks work without losing the main context), notification and presence surfaces, empty and loading states, and onboarding and first-run experience.

When the product's graphical-ui surfaces span beyond web, settle the skeleton per platform — a tab-and-stack scaffold on a phone and a multi-pane window on desktop are different structures, not renderings of one web shell. Phase 5's Platform Dimension section states how the platform set is read and which vocabulary each platform's translation uses.

Capture examples for the Architecture discovery-notes bullet: notifications, search, session state, presence, real-time delivery.

---

## Phase 5: Expert Translation & Guided Review

*The foundation flow runs this phase once per active type, after the brand language direction (foundation Phase 4) is confirmed. The agent's job here is to derive every token, shadow, and easing curve autonomously from that direction.*

### Platform Dimension

This track designs for the type; a product can express it through web, mobile, and desktop surfaces sharing this one run. Before translating, resolve which platforms the product's graphical-ui surfaces target: when `docs/surfaces.md` exists (lazy activation, brownfield), read each graphical-ui entry's platform field; pre-registry — the normal greenfield case, because architecture writes the registry after this phase — read the surface set carried in the product brief's Downstream Context file `.groundwork/context/product-brief.md` (Protocol 5). Translate for the platforms of the surfaces in this run's scope; a platform arriving at a later horizon gains its guidance when `groundwork-surface-activation` births its surface.

The platform dimension changes vocabulary and ergonomics, never the brand: one Phase 4 direction, one Tier 2 visual block, one spec — with each platform's content written in that platform's language. Platform content folds into the existing draft section files (platform targets into the constraints file, per-platform shell expression into the shell file, ergonomics and motion into the interaction file); the file layout, review pass, and walkthrough clusters keep their shape regardless of the platform set.

#### Web (baseline)

Everything in this track is written in web vocabulary — CSS tokens, viewports, hover states, scrollbars, responsive grids. That content is the web baseline, not one platform's appendix: a product whose graphical-ui surfaces are web-only runs the phase exactly as written, and the mobile and desktop subsections below never enter the conversation.

#### Mobile (Flutter idiom)

When a mobile surface is in scope, its content in the spec speaks Flutter's language — the app is widgets composed into screens, and a spec that prescribes hover states and scrollbar styling for a phone forces the implementer to translate twice.

- **Navigation is stacks and tabs, not URLs.** Express the shell as navigation stacks, tab scaffolds, and modal presentations in go_router idiom: typed routes, a tab scaffold with per-tab navigation state (`StatefulShellRoute`), and deep links that fall out of every declared route — which makes the route structure a first-class state container worth designing deliberately. The shell content states which journeys live on which tab, what pushes onto a stack versus presents modally, and where deep links land.
- **Touch ergonomics replace pointer precision.** Every interactive element meets the 48dp tap-target minimum. Hover does not exist on touch — specify pressed, focused, and disabled states instead. Gestures the product relies on need visible affordances, because an undiscoverable gesture is a missing feature to the user who never finds it. Place recurring primary actions within thumb reach — the bottom half of the screen on one-handed phones.
- **Material is the base system.** Specify the mobile UI as a token-themed expression of Material, not a parallel from-scratch component language — component anatomy describes how the tokens restyle Material parts. This keeps the generated theme module the single styling authority and the brand consistent with the web surface at the token level.
- **Motion respects mobile attention.** Full-screen transitions span more distance than pointer micro-interactions and read slower; mobile sessions are short and interruption-driven, so motion must inform without delaying. The type scale must survive the platform's dynamic type — large accessibility text scales cannot break layouts, and contrast floors hold through the token palette exactly as on web.
- **Tokens project into a generated theme.** The conversation still produces token values — OKLCH palette, type scale, radii, durations — and the visual block carries them; the Flutter app's theme module is generated from those tokens into `ThemeData` and semantic theme extensions, and widgets consume the theme, never literals. Write the spec at token level; never prescribe Dart or widget code. Where mobile ergonomics need token support — the tap-target minimum, a touch motion scale — record them in the visual block's `platform.touch` fields per the brand-tokens contract: the same shared block web reads, extended, never a per-platform fork.

#### Desktop (Electron idiom)

A desktop surface is the web design running inside a desktop shell: the renderer reuses the web design wholesale — components, styling, accessibility, and theme contents come from the web baseline unchanged. This subsection owns only what the shell adds; never respecify the web content for desktop.

- **Windows and chrome.** Decide the title-bar treatment — native platform chrome, hidden-inset content that sits beneath the platform's window controls (macOS traffic lights), or fully custom — and hold it consistent across every window the product opens.
- **Menus and keyboard-first interaction.** Desktop users expect an application menu and OS-level keyboard accelerators; the baseline's command-palette stance deepens here into native menu conventions. Specify the menu structure and the shortcut vocabulary alongside the palette, not as an afterthought to it.
- **Multi-window and multi-pane layouts.** A desktop shell earns persistent multi-pane layouts and secondary windows that a browser tab does not. Specify what content justifies a pane versus a second window, and how the layout behaves when windows resize or multiply.
- **Density for pointer precision.** Pointer input tolerates denser layouts and smaller targets than touch; when the desktop surface warrants tighter spacing than the baseline, record the override in the visual block's `platform.desktop.density` field rather than forking the spacing system.
- **Theme follows the OS.** Light/dark sync comes from `nativeTheme` in the shell's main process, broadcast to the renderer and mapped onto the document — the spec states that the OS preference drives the theme; the mechanism belongs to the generator. What the theme contains is the baseline's dual-theme palette, unchanged.

Where desktop chrome needs token support — title-bar treatment, menu style, density — record it in the visual block's `platform.desktop` fields per the brand-tokens contract.

### 5a: Translation (Agent-Driven, Autonomous)

The agent translates the approved direction into a rigorous, CSS-level engineering specification. This track's file table (below) feeds the foundation flow's 5a mechanics — output location, one `write_file` per section, the self-check before presenting.

**This track's section files:**

| File | Content |
|---|---|
| `00-header.md` | The document title and the "implementation-ready specification" intro paragraph. No summary section — the Downstream Context (Protocol 5) is written separately to `.groundwork/context/design-system.md` at commit, not concatenated into the spec |
| `01-constraints.md` | Part 1 — performance budgets, a11y baselines, platform targets, sync, error tolerance |
| `02-shell.md` | Part 2 — navigation model, layout skeleton, empty/loading states, onboarding |
| `03-foundation.md` | Part 3 Cluster 1 — colour architecture (both themes), the full type scale, spacing tokens |
| `04-interaction.md` | Part 3 Cluster 2 — surface depth & shadow stacks, motion & easing, interaction states |
| `05-surface.md` | Part 3 Cluster 3 — scrollbars, toasts, error choreography, skeletons, borders, overflow, responsive grid, and any remaining engineering-craft sections from the target structure |

Each file is a self-contained markdown section — start its top-level heading at H1 (`# Part 1 — Constraints`) or H2 (`## Colour Architecture`) as appropriate so the files compose cleanly when concatenated. The foundation flow's Draft Layout rule governs how this table adapts when several types are active.

#### Base Token Resolution

Before writing any section of the spec, resolve these base tokens from the Phase 4 direction. Fill in every blank — these are the roots from which the entire design system grows. If you cannot commit to a specific value for any entry, return to Phase 4, gather more information, and resolve it before proceeding.

```css
/* === RESOLVE BEFORE DRAFTING === */

/* Colour — light theme */
--color-primary:      oklch(__ __ __);  /* primary action */
--color-surface:      oklch(__ __ __);  /* page background */
--color-surface-alt:  oklch(__ __ __);  /* card / panel background */
--color-text-body:    oklch(__ __ __);  /* body text */
--color-accent:       oklch(__ __ __);  /* accent / highlight */

/* Colour — dark theme */
[data-theme="dark"] {
  --color-primary:      oklch(__ __ __);
  --color-surface:      oklch(__ __ __);
  --color-text-body:    oklch(__ __ __);
}

/* Shadow — Tier 1 (resting cards and containers) */
--shadow-resting:
  0 __px __px oklch(0% 0 0 / 0.__),   /* contact shadow */
  0 __px __px oklch(0% 0 0 / 0.__);   /* ambient shadow */

/* Typography */
--font-display: "__";           /* heading family, weight */
--font-body:    "__";           /* body family, weight */
--text-base:    __px / __  "__"; /* base step: size / line-height */
--text-lg:      __px / __  "__";
--text-sm:      __px / __  "__";

/* Motion */
--ease-standard: cubic-bezier(__, __, __, __);
--duration-base: __ms;
```

#### The Translation Mandate

This is where the agent earns its value. The user said "warm vellum" — the agent commits to `oklch(96% 0.008 60)`. The user said "physical, tactile press" — the agent specifies `transform: scale(0.98)` with `transition: 150ms cubic-bezier(0.2, 0, 0, 1)`. The user said "editorial serif" — the agent selects a specific font at specific weights and sizes across the full type scale. Every high-level preference from Phase 4 must be resolved into concrete, implementable values. If the cached direction is ambiguous, the agent makes the design call — that is the job.

Generative UI tools (v0, Lovable) consistently fail to produce truly premium output without deeply specified CSS. The design system must go beyond naming colours and fonts — it must prescribe exact shadow stacks, surface treatments, ambient textures, and a clear class/token hierarchy.

#### Quality Standard: Deep vs. Shallow

The difference between a useful design system and a shallow one is specificity. Every section must contain enough detail that a developer (or an AI tool) can implement it without making any design decisions of their own.

**Shallow output (unacceptable):**
```css
/* Elevation */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.1);
--shadow-md: 0 4px 6px rgba(0,0,0,0.1);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
```

**Deep output (required standard):**
```css
/* Elevation — multi-layer shadow stacks for naturalistic depth.
   Each tier combines a tight, sharp shadow (contact shadow simulating 
   surface contact) with a diffuse ambient shadow (environmental light).
   Opacity calibrated against --surface-primary in both themes. */

/* Tier 1: Resting — cards, containers, default interactive elements */
--shadow-resting:
  0 1px 1px oklch(0% 0 0 / 0.04),     /* contact: tight, near-surface */
  0 2px 4px oklch(0% 0 0 / 0.03),     /* ambient: soft environmental */
  0 0 0 1px oklch(0% 0 0 / 0.02);     /* edge: subtle border reinforcement */

/* Tier 2: Raised — hover states, active cards, popovers */
--shadow-raised:
  0 2px 2px oklch(0% 0 0 / 0.04),
  0 4px 8px oklch(0% 0 0 / 0.05),
  0 8px 16px oklch(0% 0 0 / 0.03),
  0 0 0 1px oklch(0% 0 0 / 0.02);

/* Tier 3: Floating — modals, command palette, dropdowns */
--shadow-floating:
  0 4px 4px oklch(0% 0 0 / 0.04),
  0 8px 16px oklch(0% 0 0 / 0.06),
  0 16px 32px oklch(0% 0 0 / 0.05),
  0 24px 48px oklch(0% 0 0 / 0.03);

/* Dark theme — shadows are deeper and higher contrast because 
   dark surfaces absorb ambient light */
[data-theme="dark"] {
  --shadow-resting:
    0 1px 1px oklch(0% 0 0 / 0.12),
    0 2px 4px oklch(0% 0 0 / 0.10),
    0 0 0 1px oklch(100% 0 0 / 0.03);
  /* ... */
}
```

The shallow version gives a developer three variables. The deep version gives them a complete elevation system with design rationale, multi-layer composition, theme variants, and usage rules. **Every section of the design system must hit this depth.**

#### Design System Target Structure

The spec must cover all of the following, each at the depth standard above. Missing sections are not acceptable.

**Part 1 — Constraints**: Performance budgets, a11y baselines, platform targets, sync requirements, error tolerance.

**Part 2 — Shell**: Navigation model, layout skeleton, empty/loading states, onboarding.

**Part 3 — Design System**:
- **Colour architecture** (OKLCH, both themes) — not just token names: full OKLCH values for both themes, semantic role definitions, alpha transparency rules, and the perceptual reasoning behind palette construction.
- **Type scale** (all steps) — not just font sizes: both font families with specific weights, all named steps from display through micro, line-heights calibrated to the spatial grid, and responsive fluid clamp values.
- **Spacing tokens** — not just `--space-1` through `--space-8`: the grid base, how each step is derived, and which tokens apply at which level of the component hierarchy.
- **Surface class hierarchy** — not just background colours: named classes with full CSS (background, border, shadow, backdrop-filter where applicable), usage rules defining when each class applies, and both theme variants.
- **Elevation & shadow stacks** — the worked example above sets the depth bar.
- **Background & texture**
- **Interaction states** (hover, press, focus) — not just hover colours: complete CSS for hover, active/press, focus-visible, disabled, and loading states including transforms, transitions, easing curves, and duration reasoning.
- **Button & input anatomy** — not just "buttons have rounded corners": full CSS for every button variant (primary, secondary, ghost, destructive) and every input variant, with padding derived from the spacing system and radii following the concentric radii rule.
- **Skeleton shimmer**
- **Scrollbars**
- **Text selection & rendering**
- **Toasts & notifications**
- **Transition choreography**
- **Borders & dividers**
- **Overflow & truncation**
- **Empty states**
- **Error choreography**
- **Responsive grid**

Update this type's Phase 5 entry in `.groundwork/cache/design-system-cache.md` to `draft-complete`. **Do not present a summary and ask for blanket approval.** Proceed directly to the Independent Review pass.

### Independent Review (Pre-Walkthrough)

The user is about to see this draft in Phase 5b. Before they do, the draft passes through an independent review — `groundwork-review` checks it for silent invention, dropped Phase 4 commitments, and contradictions against the upstream Product Brief that the user is unlikely to catch during a CSS-level walkthrough. The CSS-precise design system is the most downstream-load-bearing artifact in the flow; catching these failures here is cheaper than catching them after `docs/design-system.md` becomes the source of truth for architecture and delivery.

Assemble the draft — a shell operation, not a model emission, so it costs no output tokens regardless of spec size: `run_command("cat .groundwork/cache/design-system-draft/*.md > .groundwork/cache/design-system-draft.md")`. Then dispatch `groundwork-review` per Protocol 9 with `document_path: .groundwork/cache/design-system-draft.md` and `document_type: design-system`. The gate is fail-closed and the revise cap is Protocol 8's, not restated here: on REVISE, apply every 🔴 Critical finding directly to the affected section file(s) under `.groundwork/cache/design-system-draft/` only, re-assemble with the same `cat` command, and re-dispatch until PRESENT. Once PRESENT, remove the assembled file (`rm .groundwork/cache/design-system-draft.md`; the section files remain the source of truth for Phase 5b and Phase 6) and carry any 🟡 Advisory findings forward into Phase 5b.

Proceed to Phase 5b only once the verdict is PRESENT.

### 5b: Guided Review (Collaborative)

#### Cluster Walkthrough

**Cluster 1: Foundation** — Colour tokens (both themes), the full type scale, and the spacing system.

These are the base primitives every later decision composes from. The user's taste is the primary input here, and wrong choices feel fundamentally off. Present the colour table, the type scale with sample text descriptions, and the spatial grid side by side. Teach the reasoning: why OKLCH over HEX, why this serif's x-height works at screen resolution, why the 8-point grid creates rhythm. Offer 2–3 alternative pairings that honour the same direction but shift the feel. Wait for the user's reaction before advancing.

**Cluster 2: Interaction** — Surface depth and shadows, motion and easing curves, interaction states (hover, press, focus).

These define how the product feels in the hand. The user cannot specify `cubic-bezier` values but will immediately sense if motion is too fast, too bouncy, or too flat. Present the shadow system, the easing curve, and the "press" transform as a connected system. Teach the trade-offs: snappy 150ms transitions feel efficient but clinical; weighted 300ms transitions feel premium but can add friction. Justify the specific choice against the user's Phase 4 direction. Offer alternatives. Wait for the user's reaction.

**Cluster 3: Surface** — Everything else: scrollbars, toasts, error choreography, loading and skeleton states, empty states, borders and dividers, text rendering, content overflow, responsive grids.

These are engineering craft — decisions the agent should own. Present the full set as a summary table: what was decided, in one line per topic. Call out any judgment calls the user might have an opinion on. Ask if anything feels wrong. Do not walk through each one individually unless the user flags a concern.

The Re-flow Protocol, Walkthrough Progress tracking, and Completion Gate that govern this walkthrough are the foundation flow's Phase 5 machinery — this track's cluster content is what they operate on.

---

## Commit Contributions

Phase 6 runs once for the whole design system, in the foundation flow. This track contributes:

- **Document section:** the `# Graphical UI` section files assembled into `docs/design-system.md`.
- **Design References** (the canonical spec for this record — other writers and readers point here rather than restating it): a `## Design References` section in the assembled spec, built from one **convergent research pass** run now that the aesthetic direction is settled — not a restatement of the Phase 2 inspiration library, which was divergent (it explored directions). Find the named, high-end products that are best-in-class at *this specific* settled aesthetic, and for each extract the concrete techniques at the parameter level — surface treatment (blur radius, tint opacity, border), the elevation stack, motion timing and easing, type and spacing rhythm — never stored imagery (the reviewer researches current imagery live). Record per product its name, the specific qualities admired and the technique behind them (e.g. "Linear's command palette: ~12px backdrop blur, a 1px top highlight, restrained accent on under 5% of surface"), and the design challenge it answers — naming at least three products. This is a **technique library, not a mood board**: borrow the rigour, never the signature look. It feeds two consumers — the `visual` block's `references` array below (this same commit) and the per-surface micro-polish spec at bet design — so a technique admired but never written here evaporates with the rest of the inspiration cache at cleanup. The inspiration cache is deleted at commit; this section is the only durable record of the visual North Star, and the Tier-3 fidelity critique grades the delivered UI against it.
- **Brand tokens:** the Tier 2 `visual` block — semantic palette (both themes), typography (with per-role `roles` micro and `numeric`), shape, density, and motion descriptors (with the per-context `interactions` profiles), plus the atmosphere layer the depth standard above already prescribed in CSS — `elevation` (named multi-layer shadow stacks), `blur` (backdrop radii), `gradients` (mesh/ambient recipes), and `surface` (the named glass/elevated/hero treatments composing those tokens) — and the `references` array mirroring the `## Design References` record, per the contract at `.groundwork/skills/groundwork-design-system/templates/brand-tokens.md`, plus the optional `platform` sub-object when a mobile or desktop surface is in scope (the Platform Dimension subsections name its fields) — projected mechanically from the colour architecture, type scale, elevation, surface, motion, and references sections just written into the document. The atmosphere tokens are the machine form of the elevation/surface/texture CSS the document commits to; they exist so the app generator projects the brand's surfaces, and no engineer skill carries a fixed catalogue. Graphical app generators read it to seed their theme (Tailwind today; other theme projections as surface generators land).
- **Summary key decisions:** the chosen colour space, typography family, motion personality; binding constraints include accessibility floors, performance budgets, responsive breakpoints.
- **Hand-off content:** rejected aesthetic directions (e.g. typography pairings the user considered and ruled out), deferred design decisions (theming, internationalisation, future variants), user instincts about motion or interaction not yet committed.
