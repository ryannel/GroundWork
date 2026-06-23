## Surface Design

*One subsection per surface in the pitch's `surfaces:` scope. Each subsection describes what that surface's users observe and interact with, in the vocabulary of the surface's interface type (from its design track in `docs/design-system.md`):*
- *`graphical-ui` — screens, views, regions, states (loading, active, empty, error, degraded)*
- *`cli` — commands, flags, output format, error messages, exit codes*
- *`agentic-protocol` — request/response turns, protocol states, expected response structure*

*Organize each subsection by view, command, or interaction — not by feature or service. Each subsection is the anchor that surface's milestone interface-tests will assert against.*

*When the project has no surface registry (`docs/surfaces.md` absent), the product has a single implicit surface: write one subsection for it in the project's interface medium and skip all other surface ceremony. A single-surface registry likewise produces exactly one subsection.*

### Surface: [surface-slug]

#### [View / Command / Interaction Name]

**Purpose:** [what this interaction accomplishes for the user]

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
