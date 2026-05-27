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

## Cross-Phase Signal Capture

Design system conversations routinely surface signals that belong to a different phase — a performance target with infrastructure implications, an offline expectation that shapes data architecture, a sequencing instinct about which features matter first. As these signals arise during any phase, append them as bullets under the matching section header in `.groundwork/cache/discovery-notes.md` — `## Architecture` for infrastructure or technology opinions, `## Design Details` for async or schema implications, `## Bets` for feature sequencing, `## Product Brief` for vision-level refinements — then return to the current topic. Capturing them now means the downstream phase finds them instead of asking the user to repeat themselves.

---

## Phase 1: Non-Functional Requirements (NFR)

NFRs define the engineering envelope the design system must operate within. Performance budgets, accessibility baselines, sync requirements, and error tolerance all constrain design choices downstream — a design system that specifies 300ms transitions in a product with a 50ms interaction budget is internally contradictory.

Read `docs/product-brief.md`. Using the product brief and the track defaults above as your starting position, draft a complete NFR proposal immediately — do not open with questions.

Cover all relevant dimensions: performance and latency targets, accessibility baselines, multi-device and viewport requirements, real-time and sync needs, offline and error tolerance, session persistence, notification model, and security UX. Ground each decision in the product brief and apply the track defaults where applicable: sub-50ms perceived latency, WCAG 2.1 AA, 8-point grid, OKLCH, hardware-accelerated animation only. Skip dimensions that are clearly irrelevant to the product.

Present the proposed NFRs in full and invite the user to confirm, challenge, or adjust specific items. The proposal is the starting position — accept what the user confirms, revise what they challenge. Once approved, write the confirmed NFRs to the Phase 1 section of `.groundwork/cache/design-system-cache.md` and set its status to `done`. Proceed to Phase 2.

---

## Phase 2: Research

The inspiration library grounds the design conversation in concrete, existing products. Abstract aesthetic discussions ("make it premium") produce vague specs. Discussions anchored in specific examples ("Linear's command palette renders from local cache before the server responds") produce actionable design decisions.

Drawing on the product context and agreed NFRs from Phase 1, identify the 3–5 core design challenges this product faces (e.g., "async generation with delayed delivery," "multi-device intent capture," "media-heavy reading experience"). For each challenge, find 1–2 leading applications that solve it exceptionally well. Describe the **specific pattern or interaction** worth borrowing — not just the app's reputation. Aim for 5–8 references total. Breadth across challenges is more valuable than depth on one.

Present this Inspiration Library and ask for the user's reaction. Do they agree? Are there specific "vibes" or paradigms they want to adopt? Do not proceed until they have confirmed the direction.

Once approved, write to the Phase 2 section of `.groundwork/cache/design-system-cache.md` and set its status to `done`. Proceed to Phase 3.

---

## Phase 3: App Shell

The app shell is the structural container everything else lives inside — navigation, layout, context preservation, and system-level states. Getting this wrong means reworking every screen. Getting it right means every subsequent design decision has a home.

Define the structural skeleton using the layout paradigms from the Phase 2 inspiration library. The agent should explore and propose decisions across: global navigation and search patterns, layout skeleton, context preservation (how sub-tasks work without losing the main context), notification and presence surfaces, empty and loading states, and onboarding and first-run experience.

Guide the conversation with leading-edge structural trends. Propose the app shell based on the inspiration library, then ask the user to react and refine.

When a shell decision implies a backend capability — notifications, search, session state, presence, real-time delivery — append the implication as a bullet under `## Architecture` in `.groundwork/cache/discovery-notes.md` before continuing the shell conversation. The architecture phase finds these notes and skips re-deriving what was already decided here.

Once approved, write to the Phase 3 section of `.groundwork/cache/design-system-cache.md` and set its status to `done`. Proceed to Phase 4.

---

## Phase 4: Design Language

This phase captures the user's taste — the raw material the agent will translate into concrete CSS in Phase 5. The user should never need to think about specific values. The agent's job is to understand their aesthetic instincts deeply enough to derive every token, shadow, and easing curve autonomously.

Draw on the product brief for identity and audience context, and on the inspiration library from Phase 2 for concrete reference points. Cover design language in three focused clusters — grouping related decisions so the user can react to a coherent aesthetic stance rather than isolated individual choices. For each cluster, open with a cohesive proposal that reflects what the product brief and inspiration library suggest, then invite the user to react and redirect.

**Cluster 1: Identity** — Aesthetic direction, colour psychology and mood, typography character. Propose the product's visual personality as a unified stance: what it feels like, what emotional register both themes carry, and what typographic character reinforces the identity.

**Cluster 2: Feel** — Surface and depth philosophy, motion and feedback, content density and readability. Propose how physical and tactile the UI should feel — layered or flat, animated or restrained, dense or spacious.

**Cluster 3: Craft** — Iconography and imagery weight, tone of voice and microcopy, data visualisation (if applicable). Propose the visual weight of icons and the personality of the UI's copy.

After each cluster proposal, invite the user to react and refine before advancing. Mark each cluster as covered in `.groundwork/cache/design-system-cache.md` as you go. Skip a dimension only when it is clearly irrelevant to the product.

### Synthesis Gate

Before caching, distill the entire Phase 4 conversation into a structured design direction and present it to the user for confirmation. Scattered conversation notes are not sufficient input for Phase 5 — the synthesis forces the agent to reconcile any contradictions and present a coherent vision.

The synthesis stays in the user's language. No CSS values, no OKLCH codes, no pixel dimensions. It captures the *decisions* the user made in terms they recognise and can confidently approve or correct:

- **Aesthetic identity**: A short characterisation of the overall feel.
- **Colour mood**: The emotional temperature for both themes.
- **Depth and surface**: How physical the UI feels and what techniques create that physicality.
- **Typography character**: The personality of the type, not the font name.
- **Motion philosophy**: How the UI responds to touch.
- **Voice and tone**: How the UI speaks.
- **Iconography feel**: The visual weight and style.

Present this as a clear summary the user can scan and approve in one read. Ask them to confirm or correct before proceeding.

Once confirmed, write the synthesis to the Phase 4 section of `.groundwork/cache/design-system-cache.md` and set its status to `done`. Proceed to Phase 5.

---

## Phase 5: Expert Translation & Guided Review

### 5a: Translation (Agent-Driven, Autonomous)

The user provided taste, instinct, and direction across Phases 1–4. The agent now translates that into a rigorous, CSS-level engineering specification — autonomously.

**Output location**: `.groundwork/cache/design-system-draft/` — a directory of per-section files. Each file stays bounded in size, so any later change (review revise, 5b re-flow) touches only the affected files instead of regenerating the whole spec in a single turn. Regenerating the whole spec at once exhausts the per-response output token budget on rich specs; the per-section layout makes that failure structurally impossible. Writing to `docs/design-system.md` is prohibited until Phase 6 (Commit) — on initial generation that file does not exist; do not attempt to read it.

**Write each section as a separate file.** Use one `write_file` call per section (the tool creates parent directories automatically):

| File | Content |
|---|---|
| `00-header.md` | Document title and the "implementation-ready specification" intro paragraph |
| `01-constraints.md` | Part 1 — performance budgets, a11y baselines, platform targets, sync, error tolerance |
| `02-shell.md` | Part 2 — navigation model, layout skeleton, empty/loading states, onboarding |
| `03-foundation.md` | Part 3 Cluster 1 — colour architecture (both themes), the full type scale, spacing tokens |
| `04-interaction.md` | Part 3 Cluster 2 — surface depth & shadow stacks, motion & easing, interaction states |
| `05-surface.md` | Part 3 Cluster 3 — scrollbars, toasts, error choreography, skeletons, borders, overflow, responsive grid, and any remaining engineering-craft sections from the target structure |

The numeric prefixes determine concatenation order at commit. Each file is a self-contained markdown section — start its top-level heading at H1 (`# Part 1 — Constraints`) or H2 (`## Colour Architecture`) as appropriate so the files compose cleanly when concatenated.

Compile the full design system document using the approved outputs stored in `.groundwork/cache/design-system-cache.md`. The document combines NFRs from Phase 1 with a comprehensive design system that the agent derives from the design language direction captured in Phase 4.

Apply the `groundwork-writer` skill to ensure the tone is declarative, assertive, and free of hedging. Structure it to read like a rigorous engineering specification that simultaneously serves as a powerful prompt for generative UI tools.

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

The same standard applies across the entire specification:
- **Colour architecture**: Not just token names — full OKLCH values for both themes, semantic role definitions, alpha transparency rules, and the perceptual reasoning behind palette construction.
- **Type scale**: Not just font sizes — both font families with specific weights, all named steps from display through micro, line-heights calibrated to the spatial grid, and responsive fluid clamp values.
- **Spacing tokens**: Not just `--space-1` through `--space-8` — the grid base, how each step is derived, and which tokens apply at which level of the component hierarchy.
- **Surface classes**: Not just background colours — named classes with full CSS (background, border, shadow, backdrop-filter where applicable), usage rules defining when each class applies, and both theme variants.
- **Interaction states**: Not just hover colours — complete CSS for hover, active/press, focus-visible, disabled, and loading states including transforms, transitions, easing curves, and duration reasoning.
- **Component anatomy**: Not just "buttons have rounded corners" — full CSS for every button variant (primary, secondary, ghost, destructive) and every input variant, with padding derived from the spacing system and radii following the concentric radii rule.

#### Design System Target Structure

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

Update the Phase 5 section in `.groundwork/cache/design-system-cache.md` to `draft-complete`. **Do not present a summary and ask for blanket approval.** Proceed directly to the Independent Review pass.

### Independent Review (Pre-Walkthrough)

The user is about to see this draft in Phase 5b. Before they do, the draft passes through an independent review — `groundwork-review` checks the draft for silent invention, dropped commitments from Phase 4, and contradictions against the upstream Product Brief that the user is unlikely to catch during a CSS-level walkthrough. The CSS-precise design system is the most downstream-load-bearing artifact in the flow; catching these failures here is cheaper than catching them after `docs/design-system.md` becomes the source of truth for architecture and delivery.

1. **Announce** the shift — the agent is moving from translation into an independent review before presenting to the user.
2. **Assemble the draft for review.** Run `run_command("cat .groundwork/cache/design-system-draft/*.md > .groundwork/cache/design-system-draft.md")` to concatenate the section files into a single document. This is a shell operation, not a model emission — it does not consume output tokens regardless of spec size.
3. **Invoke the review subagent** with `document_path: .groundwork/cache/design-system-draft.md` and `document_type: design-system`. The subagent runs in an isolated context — via the `Task` tool in Claude Code or the `invoke_review` tool in the eval harness — and returns only `VERDICT: PRESENT | REVISE` and a findings list.
4. **Revise loop.** If the verdict is **REVISE**, apply every 🔴 Critical finding directly to the affected section file(s) under `.groundwork/cache/design-system-draft/` — rewrite only the files the finding implicates. After revisions, re-assemble with `cat` and run the review again. Repeat until the verdict is **PRESENT**.
5. **Clean up the assembled file.** Once the verdict is PRESENT, run `run_command("rm .groundwork/cache/design-system-draft.md")`. The section files in the draft directory remain the source of truth for Phase 5b and Phase 6.
6. **Carry advisory findings forward.** When the verdict is PRESENT, hold any 🟡 Advisory findings — they surface to the user during or after Phase 5b so the user can decide whether to act on them.

Once the review verdict is PRESENT, proceed to Phase 5b.

### 5b: Guided Review (Collaborative)

The draft is a proposal. Present it to the user as one — explicitly frame it as what the agent built from their direction.

**Do not ask the user to approve the full spec.** Do not present a summary of highlights and ask "does this look right?" Instead, walk through the spec in three focused clusters, each earning approval before advancing.

#### Cluster Walkthrough

Present the spec in three clusters. The cluster names here are deliberately distinct from the Phase 4 language clusters (Identity / Feel / Craft) — Phase 4 grouped *aesthetic decisions* the user owns; Phase 5b walks through *implementation specifics* the agent owns. Distinct names keep both schemes legible when both phases are referenced in the same conversation.

**Cluster 1: Foundation** — Colour tokens (both themes), the full type scale, and the spacing system.

These are the base primitives every later decision composes from. The user's taste is the primary input here, and wrong choices feel fundamentally off. Present the colour table, the type scale with sample text descriptions, and the spatial grid side by side. Teach the reasoning: why OKLCH over HEX, why this serif's x-height works at screen resolution, why the 8-point grid creates rhythm. Offer 2–3 alternative pairings that honour the same direction but shift the feel. Wait for the user's reaction before advancing.

**Cluster 2: Interaction** — Surface depth and shadows, motion and easing curves, interaction states (hover, press, focus).

These define how the product feels in the hand. The user cannot specify `cubic-bezier` values but will immediately sense if motion is too fast, too bouncy, or too flat. Present the shadow system, the easing curve, and the "press" transform as a connected system. Teach the trade-offs: snappy 150ms transitions feel efficient but clinical; weighted 300ms transitions feel premium but can add friction. Justify the specific choice against the user's Phase 4 direction. Offer alternatives. Wait for the user's reaction.

**Cluster 3: Surface** — Everything else: scrollbars, toasts, error choreography, loading and skeleton states, empty states, borders and dividers, text rendering, content overflow, responsive grids.

These are engineering craft — decisions the agent should own. Present the full set as a summary table: what was decided, in one line per topic. Call out any judgment calls the user might have an opinion on. Ask if anything feels wrong. Do not walk through each one individually unless the user flags a concern.

#### Re-flow Protocol

When the user requests a change in any cluster:

1. Acknowledge the change and confirm understanding.
2. Assess downstream impact — state explicitly which section files are affected, including any downstream files whose tokens or rules reference the change.
3. **Rewrite the affected section files.** Each section lives in its own file under `.groundwork/cache/design-system-draft/`. Use `write_file` to replace the implicated files in turn — for example, a typography change rewrites `03-foundation.md`, and may ripple into `05-surface.md` if surface components reference the type scale. Each `write_file` is bounded by the size of one section, never the whole spec.
4. Summarise the re-flow: list every section file that changed and what specifically shifted.
5. If a previously-approved cluster was affected substantively, re-present it before continuing.

A design system is a web of interconnected decisions. Changing typography affects spatial rhythm, which affects component anatomy, which affects motion timing. Propagate the change into every section file it implicates — file-by-file, never as a single full-spec rewrite. Isolated edits that ignore downstream effects create internal contradictions that surface during implementation; the propagation is mandatory, the file-at-a-time mechanic is what makes it safe.

#### Walkthrough Progress

Track which clusters have been reviewed in `.groundwork/cache/design-system-cache.md` under the Phase 5 checklist. Mark each cluster as complete when the user approves it. This enables session resumption — if the conversation is interrupted, the agent sees which clusters have been reviewed and resumes from the next unchecked item.

#### Completion Gate

The walkthrough is complete when all three clusters have been presented and approved. Only then does Phase 6 (Commit) execute.

Once approved, proceed to Phase 6: Commit.

---

## Phase 6: Commit

Execute **only** after Phase 5b has walked through every section of the draft and the user has explicitly approved the complete specification. Verify that all items in the Phase 5 walkthrough checklist in `.groundwork/cache/design-system-cache.md` are marked complete before proceeding.

Follow the Phase Lifecycle commit protocol from the Operating Contract:

1. **Verify the summary header.** Confirm the draft directory's `00-header.md` (or first section file) contains a `## Summary for Downstream` section populated per Protocol 5 of the operating contract — Key Decisions (the chosen colour space, typography family, motion personality), Binding Constraints (accessibility floors, performance budgets, responsive breakpoints), Deferred Questions, Out of Scope. If missing, apply `groundwork-writer` to add it before assembling.

2. **Assemble the final spec.** Concatenate the section files into the canonical location: `run_command("cat .groundwork/cache/design-system-draft/*.md > docs/design-system.md")`. The numeric prefixes guarantee the correct section order. This is a shell operation, not a model emission — it does not consume output tokens regardless of spec size.

3. **Write the hand-off file.** Copy `.agents/groundwork/skills/templates/handoff.md` to `.groundwork/cache/handoff/design-system.md` and fill in only the sections that have content: rejected aesthetic directions (e.g. typography pairings the user considered and ruled out), deferred design decisions (theming, internationalisation, future variants), user instincts about motion or interaction not yet committed, and any other context the architecture phase needs. Omit empty sections.

4. **Clean up caches.** Remove the draft directory, the design-system cache, and the consumed previous hand-off: `run_command("rm -rf .groundwork/cache/design-system-draft .groundwork/cache/design-system-cache.md .groundwork/cache/handoff/product-brief.md")`. Cache Isolation (Protocol 7) requires the previous hand-off to be deleted once consumed.

5. Apply the Living Documents protocol — scan the conversation for insights that refine any existing `docs/` artifact (e.g. `docs/product-brief.md`). Apply surgical updates and refresh affected summary headers. Report what changed.

6. Update discovery notes — scan for out-of-phase signals not captured in real time. Remove `## Design System` entries incorporated into `docs/design-system.md` or the hand-off file.

7. Confirm that the phase is complete.

8. Recommend a fresh context for the next phase — a clean context gives the next skill full working memory.

9. Immediately load and execute the `groundwork-orchestrator` skill to show the user what's next. Do not ask the user to invoke it — hand off automatically.
