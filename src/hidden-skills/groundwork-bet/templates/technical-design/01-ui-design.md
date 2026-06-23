## UI Design

*The user-facing design of each surface this bet delivers to — what the user sees, the states it must cover, and how they interact. One subsection per surface in the pitch's `surfaces:` scope, written in the vocabulary of the surface's interface type (from its design track in `docs/design-system.md`):*
- *`graphical-ui` — screens, views, regions, states (loading, active, empty, error, degraded), with a wireframe per key view*
- *`cli` — commands, flags, output format, error messages, exit codes (no wireframe — the output sketch stands in)*
- *`agentic-protocol` — request/response turns, protocol states, expected response structure (no wireframe)*

*Organize each subsection by view, command, or interaction — not by feature or service. Each subsection is the anchor that surface's milestone interface-tests will assert against.*

*When the project has no surface registry (`docs/surfaces.md` absent), the product has a single implicit surface: write one subsection for it in the project's interface medium and skip all other surface ceremony. A single-surface registry likewise produces exactly one subsection.*

### Surface: [surface-slug]

#### [View / Command / Interaction Name]

**Purpose:** [what this interaction accomplishes for the user]

**Wireframe** *(graphical-ui only):*

*An ASCII sketch of the view's layout — the regions, their arrangement, and the key controls. Low-fidelity on purpose: it fixes structure and hierarchy, not pixels. One sketch per key view; annotate the notable states inline or sketch a second frame when a state changes the layout materially (empty vs populated, error). The ASCII is the source of truth and is always present — a reader and an agent both build the layout from it.*

```
┌─ [View title] ──────────────────┐
│ [region / control]      [action]│
├─────────────────────────────────┤
│ [primary content area]          │
│                                  │
│ [secondary panel or list]       │
└─────────────────────────────────┘
```

*Optional — when a real mockup exists:* `![<view> — <state>](./wireframes/<surface>-<view>.png)`. *A linked or embedded design image supplements the ASCII; it never replaces it (an image is not diffable and an agent cannot read layout intent from it).*

**States:**

| State | Trigger | What the user observes |
|-------|---------|------------------------|
| [state name] | [what causes this state] | [what the user sees, reads, or receives] |
| [state name] | [what causes this state] | [what the user sees, reads, or receives] |

**Key interactions:**
- [user action] → [system response and any state transition]
- [user action] → [system response]

**Micro-polish spec** *(graphical-ui only — token-traceable, not adjectives):*
- *Motion:* [the motion profile or `{duration, easing, transform}` per interaction/state transition — `hover`, `press`, `enter`/`exit`, `stagger`]
- *Atmosphere / material:* [surface treatment token — `surface-glass`/`surface-elevated`/`surface-hero`, or an explicit blur/tint/border/elevation/gradient composition — plus any glow or grain]
- *Static micro:* [elevation token (`shadow-low/mid/high`), spacing steps, type roles with line-height/tracking, colour roles, optical-alignment and crisp-rendering obligations]

---
*(Add a view/command/interaction block for each significant interaction this bet introduces on this surface; add a `### Surface:` subsection for each in-scope surface)*
