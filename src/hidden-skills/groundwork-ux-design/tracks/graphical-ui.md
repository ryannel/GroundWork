# Graphical UI Track

This track applies to products with a visual user interface: web apps, mobile apps, desktop applications, dashboards, and any product where humans interact through a screen.

---

## Default Stance

Be fluid. Adapt seamlessly to the user's preferences, product positioning, and purpose. The agent's role is to match the user's vision — not to impose a rigid aesthetic.

The default starting position is modern, high-end design. When the user has no strong preference, advocate for the following defaults — and be ready to explain *why* each one matters:

**Technical defaults:**
- Sub-50ms interaction latency via optimistic UI execution and stale-while-revalidate (SWR) patterns. Perceived speed is the primary driver of product quality perception — a 200ms delay feels broken to users trained by Linear and Arc.
- Keyboard-first navigation with a global command palette (Cmd+K) as the primary navigation and search surface. Power users live in the keyboard; mouse-first design caps productivity.
- Strict accessibility (WCAG 2.1 AA minimum), semantic HTML, and zero-mouse navigability. Accessibility is structural quality, not a compliance checkbox — products that work for screen readers work better for everyone.
- Light and dark theme support with system-preference detection. Dual-theme is a baseline expectation, not a premium feature.
- Hardware-accelerated animation only (`transform`, `opacity`, `filter`). Animating layout properties (width, height, top) triggers reflow and drops frames. Respect `prefers-reduced-motion`.
- Perceptually uniform colour spaces (OKLCH). HEX and RGB produce unpredictable perceived brightness shifts across hue ranges — a blue and a yellow at the same HEX lightness value look wildly different to the human eye. OKLCH solves this by design.
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

## Stage 1: Non-Functional Requirements (NFR)

NFRs define the engineering envelope the design system must operate within. Performance budgets, accessibility baselines, sync requirements, and error tolerance all constrain design choices downstream — a design system that specifies 300ms transitions in a product with a 50ms interaction budget is internally contradictory.

Read `docs/product-brief.md` for product context. Then explore the user's values and priorities through a multi-turn conversation. Understand what they care about, what tradeoffs they'd accept, and what "broken" looks like to them.

The goal is to emerge with a clear picture of the product's non-functional constraints across these dimensions: performance and latency expectations, system vs user authority boundaries, multi-device and real-time requirements, accessibility standards, platform and viewport targets, offline and error tolerance, session persistence, notification model, and security UX. Not every dimension applies to every product — explore what's relevant, skip what isn't.

After exploring through dialogue, **propose** a comprehensive set of granular NFRs that synthesise the user's stated values with modern best practices. Present them and refine collaboratively. Once approved, write them to the Stage 1 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 2.

---

## Stage 2: Research

The inspiration library grounds the design conversation in concrete, existing products. Abstract aesthetic discussions ("make it premium") produce vague specs. Discussions anchored in specific examples ("Linear's command palette renders from local cache before the server responds") produce actionable design decisions.

Drawing on the product context and agreed NFRs from Stage 1, identify the 3–5 core UX challenges this product faces (e.g., "async generation with delayed delivery," "multi-device intent capture," "media-heavy reading experience"). For each challenge, find 1–2 leading applications that solve it exceptionally well. Describe the **specific pattern or interaction** worth borrowing — not just the app's reputation. Aim for 5–8 references total. Breadth across challenges is more valuable than depth on one.

Present this Inspiration Library and ask for the user's reaction. Do they agree? Are there specific "vibes" or paradigms they want to adopt? Do not proceed until they have confirmed the direction.

Once approved, write to the Stage 2 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 3.

---

## Stage 3: App Shell

The app shell is the structural container everything else lives inside — navigation, layout, context preservation, and system-level states. Getting this wrong means reworking every screen. Getting it right means every subsequent design decision has a home.

Define the structural skeleton using the layout paradigms from the Stage 2 inspiration library. The agent should explore and propose decisions across: global navigation and search patterns, layout skeleton, context preservation (how sub-tasks work without losing the main context), notification and presence surfaces, empty and loading states, and onboarding and first-run experience.

Guide the conversation with leading-edge structural trends. Propose the app shell based on the inspiration library, then ask the user to react and refine.

Once approved, write to the Stage 3 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 4.

---

## Stage 4: Design Language

This stage captures the user's taste — the raw material the agent will translate into concrete CSS in Stage 5. The user should never need to think about specific values. The agent's job is to understand their aesthetic instincts deeply enough to derive every token, shadow, and easing curve autonomously.

Draw on the product brief for identity and audience context, and on the inspiration library from Stage 2 for concrete reference points. Explore design dimensions through conversation — giving each design dimension the depth it needs (some dimensions warrant focused exploration, others can be covered quickly together):

- **Aesthetic direction** — the overall vibe and what it's trying to achieve
- **Content density and readability** — the balance between information and breathing room
- **Colour psychology and mood** — the emotional register across both themes
- **Surface and depth philosophy** — how physical the UI feels
- **Motion and feedback** — what role micro-animations play and how they should feel
- **Iconography and imagery** — visual weight and style
- **Tone of voice and microcopy** — how the UI speaks to the user
- **Data visualisation** — chart and metric styles (if applicable)

Mark each topic as covered in `.groundwork/cache/ux-design-cache.md` as you go. Skip a topic only when it is clearly irrelevant.

### Synthesis Gate

Before caching, distill the entire Stage 4 conversation into a structured design direction and present it to the user for confirmation. Scattered conversation notes are not sufficient input for Stage 5 — the synthesis forces the agent to reconcile any contradictions and present a coherent vision.

The synthesis stays in the user's language. No CSS values, no OKLCH codes, no pixel dimensions. It captures the *decisions* the user made in terms they recognise and can confidently approve or correct:

- **Aesthetic identity**: A short characterisation of the overall feel.
- **Colour mood**: The emotional temperature for both themes.
- **Depth and surface**: How physical the UI feels and what techniques create that physicality.
- **Typography character**: The personality of the type, not the font name.
- **Motion philosophy**: How the UI responds to touch.
- **Voice and tone**: How the UI speaks.
- **Iconography feel**: The visual weight and style.

Present this as a clear summary the user can scan and approve in one read. Ask them to confirm or correct before proceeding.

Once confirmed, write the synthesis to the Stage 4 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 5.

---

## Stage 5: Expert Translation & Guided Review

### 5a: Translation (Agent-Driven, Autonomous)

The user provided taste, instinct, and direction across Stages 1–4. The agent now translates that into a rigorous, CSS-level engineering specification — autonomously.

**Output location**: `.groundwork/cache/ux-design-draft.md`. Writing to `docs/ux-design.md` is prohibited until Stage 6 (Commit). The draft must survive the full 5b walkthrough before promotion. Do not attempt to read `docs/ux-design.md` during this stage — on initial generation, the file does not exist. Write the draft directly to the cache location.

Compile the full UX Design Guide using the approved outputs stored in `.groundwork/cache/ux-design-cache.md`. The document combines NFRs from Stage 1 with a comprehensive design system that the agent derives from the design language direction captured in Stage 4.

Apply the `groundwork-writer` skill to ensure the tone is declarative, assertive, and free of hedging. Structure it to read like a rigorous engineering specification that simultaneously serves as a powerful prompt for generative UI tools.

#### The Translation Mandate

This is where the agent earns its value. The user said "warm vellum" — the agent commits to `oklch(96% 0.008 60)`. The user said "physical, tactile press" — the agent specifies `transform: scale(0.98)` with `transition: 150ms cubic-bezier(0.2, 0, 0, 1)`. The user said "editorial serif" — the agent selects a specific font at specific weights and sizes across the full type scale. Every high-level preference from Stage 4 must be resolved into concrete, implementable values. If the cached direction is ambiguous, the agent makes the design call — that is the job.

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

The same standard applies across the entire specification:
- **Colour architecture**: Not just token names — full OKLCH values for both themes, semantic role definitions, alpha transparency rules, and the perceptual reasoning behind palette construction.
- **Type scale**: Not just font sizes — both font families with specific weights, all named steps from display through micro, line-heights calibrated to the spatial grid, and responsive fluid clamp values.
- **Spacing tokens**: Not just `--space-1` through `--space-8` — the grid base, how each step is derived, and which tokens apply at which level of the component hierarchy.
- **Surface classes**: Not just background colours — named classes with full CSS (background, border, shadow, backdrop-filter where applicable), usage rules defining when each class applies, and both theme variants.
- **Interaction states**: Not just hover colours — complete CSS for hover, active/press, focus-visible, disabled, and loading states including transforms, transitions, easing curves, and duration reasoning.
- **Component anatomy**: Not just "buttons have rounded corners" — full CSS for every button variant (primary, secondary, ghost, destructive) and every input variant, with padding derived from the spacing system and radii following the concentric radii rule.

#### UX Design Guide Target Structure

The spec must cover all of the following. Missing sections are not acceptable:

**Part 1 — Constraints**: Performance budgets, a11y baselines, platform targets, sync requirements, error tolerance.

**Part 2 — Shell**: Navigation model, layout skeleton, empty/loading states, onboarding.

**Part 3 — Design System** (each with exact CSS values at the depth standard above):
Colour architecture (OKLCH, both themes) · Type scale (all steps) · Spacing tokens · Surface class hierarchy · Elevation & shadow stacks · Background & texture · Interaction states (hover, press, focus) · Button & input anatomy · Skeleton shimmer · Scrollbars · Text selection & rendering · Toasts & notifications · Transition choreography · Borders & dividers · Overflow & truncation · Empty states · Error choreography · Responsive grid

---

Before presenting the draft, run this self-check:
1. **Does every section contain committed, implementable CSS values?** If a section reads like a design brief ("use warm colours with generous whitespace"), the translation is incomplete.
2. **Does every CSS block have multi-value depth?** Single-property definitions (just a background colour, just a border radius) are insufficient. Each design concept requires the full property set — background, border, shadow, padding, transition, and theme variant.
3. **Would a developer implementing this need to make any design decisions?** If yes, the spec is underspecified. Make the call — that is the agent's core contribution.

Update the Stage 5 section in `.groundwork/cache/ux-design-cache.md` to `draft-complete`. **Do not present a summary and ask for blanket approval.** Proceed directly to Stage 5b.

### 5b: Guided Review (Collaborative)

The draft is a proposal. Present it to the user as one — explicitly frame it as what the agent built from their direction.

**Do not ask the user to approve the full spec.** Do not present a summary of highlights and ask "does this look right?" Instead, walk through the spec in three focused clusters, each earning approval before advancing.

#### Cluster Walkthrough

Present the spec in three clusters. Each cluster groups related decisions so the user can react to them as a coherent design choice, not as isolated CSS values.

**Cluster 1: Identity** — Colour palette (both themes), typography pairing, and surface texture.

These are the "soul" decisions — the user's taste is the primary input, and wrong choices here feel fundamentally off. Present the colour table, the font pairing with sample text descriptions, and the texture approach side by side. Teach the reasoning: why OKLCH over HEX, why this serif's x-height works at screen resolution, how the texture opacity was calibrated. Offer 2–3 alternative pairings that honour the same direction but shift the feel. Wait for the user's reaction before advancing.

**Cluster 2: Touch** — Surface depth and shadows, motion and easing curves, interaction states (hover, press, focus).

These define how the product feels in the hand. The user cannot specify `cubic-bezier` values but will immediately sense if motion is too fast, too bouncy, or too flat. Present the shadow system, the easing curve, and the "press" transform as a connected system. Teach the trade-offs: snappy 150ms transitions feel efficient but clinical; weighted 300ms transitions feel premium but can add friction. Justify the specific choice against the user's Stage 4 direction. Offer alternatives. Wait for the user's reaction.

**Cluster 3: Polish** — Everything else: scrollbars, toasts, error choreography, loading and skeleton states, empty states, borders and dividers, text rendering, content overflow, responsive grids.

These are engineering craft — decisions the agent should own. Present the full set as a summary table: what was decided, in one line per topic. Call out any judgment calls the user might have an opinion on. Ask if anything feels wrong. Do not walk through each one individually unless the user flags a concern.

#### Re-flow Protocol

When the user requests a change in any cluster:

1. Acknowledge the change and confirm understanding.
2. Assess downstream impact — state explicitly which other sections are affected.
3. **Regenerate the full spec** with the change applied cohesively. Write the updated draft to `.groundwork/cache/ux-design-draft.md`, replacing the previous version.
4. Summarise the re-flow: list every section that changed and what specifically shifted.
5. If a previously-approved cluster was affected substantively, re-present it before continuing.

A design system is a web of interconnected decisions. Changing typography affects spatial rhythm, which affects component anatomy, which affects motion timing. Full regeneration with a clear change summary is the correct approach — isolated edits create internal contradictions that surface during implementation.

#### Walkthrough Progress

Track which clusters have been reviewed in `.groundwork/cache/ux-design-cache.md` under the Stage 5 checklist. Mark each cluster as complete when the user approves it. This enables session resumption — if the conversation is interrupted, the agent sees which clusters have been reviewed and resumes from the next unchecked item.

#### Completion Gate

The walkthrough is complete when all three clusters have been presented and approved. Only then does Stage 6 (Commit) execute.

Once approved, proceed to Stage 6: Commit.

---

## Stage 6: Commit

Execute **only** after Stage 5b has walked through every section of the draft and the user has explicitly approved the complete specification. Verify that all items in the Stage 5 walkthrough checklist in `.groundwork/cache/ux-design-cache.md` are marked complete before proceeding.

Follow the Phase Lifecycle commit protocol from the Operating Contract:

1. Write the finalised spec to `docs/ux-design.md` by promoting it from `.groundwork/cache/ux-design-draft.md`.
2. Delete the cache files `.groundwork/cache/ux-design-cache.md` and `.groundwork/cache/ux-design-draft.md`.
3. Apply the Living Documents protocol — scan the conversation for insights that refine any existing `docs/` artifact (e.g. `docs/product-brief.md`). Apply surgical updates. Report what changed.
4. Update discovery notes — scan for out-of-phase signals not captured in real time. Remove `## UX Design` entries incorporated into `docs/ux-design.md`.
5. Confirm that the phase is complete.
6. Recommend a fresh context for the next phase — a clean context gives the next skill full working memory.
7. Immediately load and execute the `groundwork-orchestrator` skill to show the user what's next. Do not ask the user to invoke it — hand off automatically.

