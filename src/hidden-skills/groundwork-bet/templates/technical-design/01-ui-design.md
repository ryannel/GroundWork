## UI Design

*One subsection per in-scope surface, in that surface's interface-type vocabulary — drafting guidance and the per-type ceremony (single-surface fallback, no-wireframe surfaces) live in `workflows/02-design.md` Step 2.*

### Surface: [surface-slug]

#### [View / Command / Interaction Name]

**Purpose:** [what this interaction accomplishes for the user]

**Wireframe** *(graphical-ui only — low-fidelity ASCII, structure and hierarchy not pixels; one per key view, a second frame for a state that changes the layout materially; the source of truth even when a real mockup also exists):*

```
┌─ [View title] ──────────────────┐
│ [region / control]      [action]│
├─────────────────────────────────┤
│ [primary content area]          │
│                                  │
│ [secondary panel or list]       │
└─────────────────────────────────┘
```

*Optional supplement:* `![<view> — <state>](./wireframes/<surface>-<view>.png)`.

**States:**

| State | Trigger | What the user observes |
|-------|---------|------------------------|
| [state name] | [what causes this state] | [what the user sees, reads, or receives] |
| [state name] | [what causes this state] | [what the user sees, reads, or receives] |

**Key interactions:**
- [user action] → [system response and any state transition]
- [user action] → [system response]

**Micro-polish spec** *(graphical-ui only — token-traceable, never adjectives; all three layers required — `workflows/02-design.md` Step 1.95):*
- *Motion:* [the motion profile or `{duration, easing, transform}` per interaction/state transition — `hover`, `press`, `enter`/`exit`, `stagger`]
- *Atmosphere / material:* [surface treatment token — `surface-glass`/`surface-elevated`/`surface-hero`, or an explicit blur/tint/border/elevation/gradient composition — plus any glow or grain]
- *Static micro:* [elevation token (`shadow-low/mid/high`), spacing steps, type roles with line-height/tracking, colour roles, optical-alignment and crisp-rendering obligations]

---
*(Add a view/command/interaction block for each significant interaction this bet introduces on this surface; add a `### Surface:` subsection for each in-scope surface)*
