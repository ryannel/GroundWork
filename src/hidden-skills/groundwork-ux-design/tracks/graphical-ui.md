# Graphical UI Track

This track applies to products with a visual user interface: web apps, mobile apps, desktop applications, dashboards, and any product where humans interact through a screen.

---

## Default Stance

Be fluid. Adapt seamlessly to the user's preferences, product positioning, and purpose. The agent's role is to match the user's vision — not to impose a rigid aesthetic.

The default starting position is modern, high-end design trends and technical standards. Draw inspiration from trend-setting companies and applications (e.g., Linear, Vercel, Raycast, Arc, Apple). When the user has no strong preference, advocate for the following defaults:

**Technical defaults:**
- Sub-50ms interaction latency via optimistic UI execution and stale-while-revalidate (SWR) patterns.
- Keyboard-first navigation with a global command palette (Cmd+K) as the primary navigation and search surface.
- Strict accessibility (WCAG 2.1 AA minimum), semantic HTML, and zero-mouse navigability.
- Light and dark theme support as a default, with system-preference detection.
- Hardware-accelerated animation only (`transform`, `opacity`, `filter`). Respect `prefers-reduced-motion`.
- Perceptually uniform colour spaces (OKLCH). HEX and RGB are prohibited in the design system output.
- An 8-point spatial grid for all dimensions.

**Aesthetic bar** (examples of the premium standard we target — adapt to the user's chosen direction):
- Dual-theme design with considered light and dark palettes — not an afterthought toggle.
- Multi-layered depth systems (e.g., shadow stacks, glassmorphism, neumorphism) — not flat, single-layer surfaces.
- Ambient surface treatments that break visual monotony on large canvases.
- Tactile micro-interactions: scale-on-press, spring physics, and subtle state transitions that make the UI feel physical.
- Considered layout systems (e.g., bento-box grids, focused single-column) with generous whitespace and clear visual hierarchy.
- Fluid typography that responds to viewport width.

---

## Stage 1: Non-Functional Requirements (NFR)

Begin by understanding the user's values and high-level expectations for how their product should feel and behave. Read `docs/product-brief.md` for product context. Do not walk through a granular checklist or present a wall of questions — instead, conduct a higher-level, **strictly one-question-at-a-time** conversation that captures their priorities, values, and instincts.

Pick **one** of the following topics to start with, ask a single question, and wait for the user's response before moving to the next:
- What does "fast" mean to them? What does "broken" look like?
- How important is multi-device continuity? Real-time collaboration?
- What is the primary platform and context of use?
- How do they think about accessibility and inclusivity?
- What are their instincts around offline behaviour, error tolerance, and session persistence?

After you have explored these areas through a multi-turn dialogue, **propose** a comprehensive set of granular NFRs that align with the user's stated values, modern best practices, and the product context. Cover:

1. **Performance & Latency**: Interaction budgets, optimistic execution, skeleton screens, progressive loading.
2. **System vs. User Authority**: What happens instantly on the client vs. what requires a server round-trip.
3. **Multi-Device & Real-Time Sync**: State propagation across devices, WebSocket/SSE requirements, conflict resolution.
4. **Accessibility (A11y)**: WCAG compliance level, zero-mouse navigability, semantic HTML, screen reader integrity.
5. **Platform & Viewports**: Primary consumption environment, responsive degradation strategy.
6. **Offline & Error Tolerance**: Optimistic queuing vs. blocking, graceful error handling.
7. **Session Persistence & State**: Resume mid-task across sessions and devices.
8. **Notification & Alerting Model**: In-app toasts, badge counts, push notifications, or silent sync.
9. **Security UX**: Authentication flows, session timeout behaviour, re-authentication, sensitive data handling.

Present the proposed NFRs and refine collaboratively. Once the user approves, write the agreed NFRs to the Stage 1 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 2.

---

## Stage 2: Research

Drawing on the product context and agreed NFRs from Stage 1, build a targeted pool of inspiration.

1. Gather a list of leading applications, websites, or physical experiences that exemplify modern, high-end design. Prioritise apps that solve similar UX problems to the ones this product faces and are trend-leading in how they do it.
2. Present this Inspiration Library to the user, describing exactly what each example does well and how it applies to our product.
3. **STOP and ask the user:** Ask for their thoughts. Do they agree with the references? Are there specific "vibes" or paradigms from this list they want to adopt? Do not proceed until they have confirmed the direction.

Once the user approves, write the agreed inspiration library to the Stage 2 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 3.

---

## Stage 3: App Shell

Define the structural container of the application using the layout paradigms from the Stage 2 inspiration library. Provide just enough detail for a generative AI tool (e.g., Vercel v0) to scaffold the basic shell.

Guide the user with leading-edge structural trends. Discuss and define:

- **Global Navigation & Search**: Suggest modern patterns like a unified command palette (Cmd+K) that handles both navigation and search, floating docks, or collapsible sidebars instead of traditional top-navs.
- **Layout Skeleton**: Suggest layouts based on the data type (e.g., bento-box grids for dashboards, focused single-column for content, multi-pane for complex tools).
- **Context Preservation**: Suggest slide-over drawers, bottom sheets, or popovers to handle sub-tasks without navigating away from the core context.
- **Notification & Presence**: Where do system notifications, background events, and user presence indicators live within the shell?
- **Empty & Loading States**: How does each major area of the shell look before content arrives? Propose skeleton screens, shimmer effects, or progressive disclosure patterns.
- **Onboarding & First-Run**: What does the shell look like on first launch with no user data? Suggest guided flows, contextual hints, or progressive feature reveal.

Propose the app shell based on the inspiration library and these modern trends. Ask the user to react and refine.

Once the user approves, write the agreed app shell definition to the Stage 3 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 4.

---

## Stage 4: Design Language

Lead a high-level design conversation. The user should never need to think about specific values — your job is to understand their taste, instincts, and priorities deeply enough to extrapolate the concrete system yourself. Draw on the product brief for identity and audience context, and on the inspiration library from Stage 2 for concrete reference points.

Discuss the following with the user:

- **Aesthetic Direction**: What is the overall vibe? Premium translucency (Dark 2.0 + glassmorphism), brutalist minimalism, warm tactile, editorial, or something else? Reference specific apps from the inspiration library.
- **Content Density & Readability**: Is this content-heavy (prioritise fluid typography, generous line-height, and whitespace) or data-heavy (prioritise compact layouts, dense tables, and information packing)?
- **Colour Psychology & Mood**: What emotional register does the product need? Clinical precision, creative warmth, playful energy, or corporate trust? How do semantic colours (success, error, warning) feel — muted and sophisticated or bold and urgent?
- **Surface & Depth Philosophy**: How much depth does the UI use? Flat with sharp borders, or layered with frosted glass, ambient shadows, and inset lighting? Discuss how the inspiration apps handle depth.
- **Motion & Feedback**: What role do micro-animations play? Discuss spring physics for interactive elements, transition speed (snappy 150ms or smooth 300ms), and whether motion conveys state or is purely decorative.
- **Iconography & Imagery**: Outlined, filled, or duotone icons? Geometric or organic? What about illustrations — are they part of the brand expression or absent entirely?
- **Tone of Voice & Microcopy**: How does the UI speak to the user? Terse and functional (Linear-style), warm and conversational (Notion-style), or technical and precise?
- **Data Visualisation**: If the product includes charts or metrics, what style? Minimal sparklines, rich interactive charts, or ambient data visualisation?

### Synthesis Gate

Before caching, distill the entire Stage 4 conversation into a structured design direction and present it to the user for confirmation. This is mandatory — scattered conversation notes are not sufficient input for Stage 5.

The synthesis stays in the user's language. No CSS values, no OKLCH codes, no pixel dimensions. It captures the *decisions* the user made in terms they recognise and can confidently approve or correct:

- **Aesthetic identity**: A short characterisation of the overall feel (e.g., "Modern premium artifact — the soul of a physical book rendered in a digital medium").
- **Colour mood**: The emotional temperature for both themes (e.g., "Dark mode feels like a nocturnal library; light mode feels like warm sunlit vellum").
- **Depth and surface**: How physical the UI feels and what techniques create that physicality (e.g., "Heavy matte surfaces with ambient shadows — objects rest on the page, not float above it. No glassmorphism.").
- **Typography character**: The personality of the type, not the font name (e.g., "Narrative text has an editorial, printed-book quality; UI controls are clean and modern").
- **Motion philosophy**: How the UI responds to touch (e.g., "Tactile and physical — elements press down when tapped, transitions feel weighted, nothing bounces or overshoots").
- **Voice and tone**: How the UI speaks (e.g., "Warm and encouraging but never verbose — the product gets out of the way").
- **Iconography feel**: The visual weight and style (e.g., "Solid, weighted shapes that feel stamped — not thin wireframe icons").

Present this as a clear summary the user can scan and approve in one read. Ask them to confirm or correct before proceeding.

Once the user confirms the direction, write this synthesis to the Stage 4 section of `.groundwork/cache/ux-design-cache.md` and set its status to `done`. Proceed to Stage 5.

---

## Stage 5: Expert Translation & Review

Stage 5 has two distinct phases. The first is autonomous work by the agent. The second is a collaborative conversation about the specifics.

### 5a: Translation (Agent-Driven)

The user provided taste, instinct, and direction across Stages 1–4. The agent now translates that into a rigorous, CSS-level engineering specification — autonomously.

Compile the full UX Design Guide using the approved outputs stored in `.groundwork/cache/ux-design-cache.md`. The document combines NFRs from Stage 1 with a comprehensive design system that the agent derives from the design language direction captured in Stage 4.

Apply the `groundwork-writer` skill to ensure the tone is declarative, assertive, and free of hedging. Structure it to read like a rigorous engineering specification that simultaneously serves as a powerful prompt for generative UI tools.

**The Translation Mandate**: The user said "warm vellum" — the agent commits to `oklch(96% 0.008 60)`. The user said "physical, tactile press" — the agent specifies `transform: scale(0.98)` with `transition: 150ms cubic-bezier(0.2, 0, 0, 1)`. The user said "editorial serif" — the agent selects Playfair Display at specific weights and sizes. Every high-level preference from Stage 4 must be resolved into concrete, implementable values. If the cached direction is ambiguous, the agent makes the design call — that is the job.

**Critical**: Generative UI tools (v0, Lovable) consistently fail to produce truly premium output without deeply specified CSS. The design system must go beyond naming colours and fonts — it must prescribe exact shadow stacks, surface treatments, ambient textures, and a clear class/token hierarchy that tells the implementer exactly when and where to use each treatment.

### UX Design Guide Target Structure

#### Part 1: The Constraints (Non-Functional Requirements)
Concrete behavioural rules derived from Stage 1. Performance budgets, accessibility baselines, platform targets, multi-device sync requirements, and offline/error tolerance.

#### Part 2: UX Principles & App Shell
Interaction pillars (e.g., flow-state entry, frictionless inline editing, context preservation). Global navigation model, search, and layout skeleton from Stage 3. Empty states, loading patterns, and onboarding.

#### Part 3: Design System

Translate the user's high-level design preferences into concrete, mathematical foundations. Each section must be deeply specified:

##### Colour Architecture (OKLCH)
- Define all colours exclusively in the **OKLCH** colour space for perceptual uniformity. HEX and RGB values are prohibited.
- Define semantic colour roles as CSS variables: canvas (lowest z-layer), surface (elevated containers), text-primary, text-muted, accent (primary actions and focus rings), success, warning, error.
- For each colour: specify the OKLCH value, its application context (where and when to use it), and both light and dark theme variants.
- Define rules for dynamic alpha transparency.

##### Typographic Scaling
- Specify the font stack: a primary UI font and a monospace font for data/code.
- Define a complete type scale with named steps: display, section header, body, UI control, micro/caption.
- For each step: specify size (rem), weight, line-height, and letter-spacing/tracking.
- Tracking must decrease as size increases to maintain optical tightness at display sizes.

##### Spatial Architecture
- Define a base grid (e.g., 8-point) that all dimensions (margins, padding, heights, gaps) must snap to.
- Provide named spacing tokens (e.g., `--space-1` through `--space-8`) with their pixel values.
- State the rule: no arbitrary pixel values outside the grid.

##### Surface Treatments & Depth

This is the section that separates a premium application from a generic SaaS product. Generative UI tools will not produce this level of polish without explicit, CSS-level guidance. Whatever aesthetic direction was chosen in Stage 4, the design system must define it at this depth.

Specify the following, adapted to the chosen aesthetic:

- **Elevation & Shadow System**: Define how the UI communicates depth. This could be multi-layered shadow stacks (ambient occlusion, direct shadow, penumbra, diffuse scatter, rim light), hard-edged brutalist borders, or soft neumorphic insets — but it must be a deliberate, multi-tier system with exact CSS for each elevation level. Single-layer `box-shadow` is never acceptable.
- **Surface Differentiation**: Define how surfaces at different z-levels are visually distinguished. Specify the exact CSS treatments (backgrounds, borders, blurs, opacity) for each tier. Differentiate between surfaces resting on the canvas, chrome elements (sticky headers, sidebars), and floating overlays (command palettes, modals, dropdowns).
- **Background & Texture Treatments**: Define how large, empty surfaces are treated to prevent visual monotony. This could be ambient gradient washes, subtle noise textures, or deliberate blankness — but the choice must be explicit, with CSS-level rules (gradient directions, colour stops, opacity, fallback layers).
- **Active & Focus State Treatments**: Define how interactive elements communicate state beyond simple colour changes. Specify glow effects, ring treatments, scale transforms, or border transitions — with exact CSS values. These micro-details are what make a UI feel alive and responsive.

##### Surface Class Hierarchy
Define a clear hierarchy of named surface/utility classes and specify exactly when to use each one. Each class must have:
- A name and its CSS definition.
- A rule for when and where to apply it (e.g., "use for standard cards resting on the canvas" vs. "reserve strictly for floating overlays").
- An explanation of how it relates to the other tiers in the hierarchy.

This hierarchy prevents arbitrary mixing of depth treatments and ensures optical consistency across the entire application.

##### Atomic Component Anatomy
- **Buttons**: Standard heights, border-radius, variant rules (primary, secondary, ghost), and interaction states (hover scale, active press, disabled). Provide exact CSS for each variant.
- **Inputs**: Heights matching buttons for horizontal alignment. Border states for rest, focus, and error. Focus ring specification (colour, spread, opacity). Provide exact CSS.
- **Concentric Radii Rule**: Inner radius = outer radius − padding. Prevents visual clipping of nested elements.
- **Interaction Micro-Details**: Define the small tactile details — hover transitions, active-state transforms, focus ring animations — that compound into a premium feel. Specify timing functions, durations, and transform values.

##### Loading & Skeleton States
Spinners are a last resort. Premium applications show shimmer skeletons that mirror the exact shape of the content they replace.
- Define skeleton gradient animation: direction, speed, and colour (e.g., a subtle left-to-right sweep using the surface colour at varying opacity).
- State the rule: skeleton shapes must match the content layout — rectangular blocks for text, circles for avatars, card outlines for cards. Generic grey boxes are not acceptable.
- Specify the transition from skeleton to content: cross-fade timing and whether content appears all at once or progressively.

##### Scrollbar Styling
Default browser scrollbars break premium aesthetics. Define custom scrollbar treatments:
- Width (thin, e.g., 6–8px), track transparency, thumb colour matched to the text-muted token.
- Auto-hide behaviour (visible on scroll, fade after inactivity).
- Consistent treatment across WebKit and Firefox (`::-webkit-scrollbar` and `scrollbar-width`/`scrollbar-color`).

##### Text Selection & Cursor
Most implementations neglect these immediately visible details:
- `::selection` background and foreground colours matched to the accent palette.
- Cursor treatments for interactive elements (e.g., `cursor: grab` on draggable items, `cursor: pointer` on clickable non-link elements).

##### Text Rendering
Font rendering affects perceived quality more than font choice:
- Specify `-webkit-font-smoothing: antialiased` and `-moz-osx-font-smoothing: grayscale` as global defaults.
- Define `text-rendering` hints (e.g., `optimizeLegibility` for headings).

##### Toast & Notification Anatomy
Transient UI must receive the same level of polish as persistent UI:
- Entry and exit animations (e.g., slide-in from edge with spring easing, fade-out on dismiss).
- Positioning (e.g., bottom-right, top-center) and stacking behaviour when multiple toasts fire.
- Auto-dismiss timing (e.g., 4 seconds for informational, persistent for errors until acknowledged).
- Maximum visible count before older toasts are collapsed or queued.
- Visual variants: informational, success, warning, error — each with distinct colour and icon treatments.

##### Transition Choreography
Individual element transitions are not enough. Define how groups of elements animate together:
- **Staggered Entry**: When a list or grid of items appears, each item enters with a small incremental delay (e.g., 30–50ms per item) to create a cascading reveal.
- **Coordinated State Changes**: When a view changes state (e.g., loading → loaded, collapsed → expanded), define the sequence — which elements move first, which fade, which scale.
- **Page/View Transitions**: Define how the UI transitions between major views — cross-fade, slide, or shared-element transitions. Specify duration and easing.

##### Border & Divider Strategy
Inconsistent use of borders, spacing, and shadows to separate content is a common source of visual noise:
- Define when to use a border (e.g., between list items), when to use spacing alone (e.g., between card groups), and when to use a shadow (e.g., for elevated surfaces).
- Specify border colour and opacity (typically a low-opacity version of the text colour, not a hard grey).
- State whether dividers are full-bleed or inset, and by how much.

##### Content Overflow & Truncation
Uncontrolled text overflow breaks layouts and feels unfinished:
- Define the truncation strategy: single-line ellipsis, multi-line clamp (`-webkit-line-clamp`), or gradient fade-out.
- Specify expand-on-hover or expand-on-click behaviour where applicable.
- Define how overflowing lists handle their edges — gradient fade at the scroll boundary vs. hard cut.

##### Empty States
Blank screens with placeholder text are the most common premium killer:
- Every major view must have a designed empty state that guides the user towards their first action.
- Define the visual treatment: illustration or icon, heading, supporting text, and a primary action button.
- Specify the tone (encouraging, not apologetic) and ensure it aligns with the product's voice from Stage 4.

##### Error State Choreography
"Red border on the input" is not error design. Define the full error experience:
- **Inline Validation Timing**: When does validation fire — on blur, on submit, or after a debounce delay while typing?
- **Error Message Entry**: How do error messages appear — slide-down, fade-in, or instant? Specify animation duration and easing.
- **Attention Effects**: Define shake, pulse, or highlight effects that draw the user's eye to the problem without being aggressive.
- **Recovery Guidance**: Error messages must state what went wrong and what to do next, not just flag the error.

##### Responsive Degradation
- Define the grid system per breakpoint (e.g., 12-column desktop, 8-column tablet, 4-column mobile).
- Specify how key components transform at smaller viewports (e.g., tables → stacked cards, sidebars → bottom sheets).

---

Before presenting the draft, run this self-check: **every section must contain committed, implementable values — not echoes of the user's words**.

The user's vocabulary must be fully translated:
- "Warm vellum" → a specific OKLCH value for the canvas token.
- "Editorial serif" → a named font at specific weights and sizes across the full type scale.
- "Physical, tactile" → exact `transform`, `transition`, and `box-shadow` CSS for each interaction state.
- "Generous whitespace" → concrete spacing tokens on an 8-point grid.
- "Ambient shadows" → multi-layer `box-shadow` definitions for each elevation tier.

If any section still reads like a design brief rather than a build specification, the translation is incomplete. Derive the missing values from the approved direction — do not go back to the user. Making these calls is the agent's core contribution.

### 5b: Review (Collaborative)

Present the complete draft to the user. This is the first time the user sees technical specifics — actual colour values, font selections, shadow definitions, timing functions.

The user's role shifts from providing direction to reacting to choices. They will say things like "that font doesn't feel right," "the shadows are too heavy," or "I love that colour palette." Walk through the spec together and adjust.

Do not rush this. The user has earned a say in the details by providing clear direction earlier. If they push back on a choice, propose alternatives that still honour the original intent. If they approve, move on.

Refine iteratively until the user is satisfied with the full specification.

Once approved, return to `instructions.md` and execute Stage 6: Commit.
