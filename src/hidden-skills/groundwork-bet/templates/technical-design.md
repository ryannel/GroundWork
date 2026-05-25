# Technical Design: [Bet Name]

*This document captures the design decisions behind this bet. It is written before implementation begins and carried into execution as the planning contract. The goal is reasoning, not enumeration — explain why each decision was made so that the developer executing this bet can make consistent choices when details are missing.*

---

## Data Flows

*Describe how data moves through the system to deliver this bet. Cover each significant path: what triggers it, what services handle it, what persists. Omit trivial CRUD flows — focus on paths where timing, ordering, or service boundaries are non-obvious.*

### [Flow Name]

**Trigger:** [what initiates this flow — user action, scheduled job, upstream event]

**Path:**
1. [step — who, what, to where]
2. [step]
3. [step — what persists and where]

**Key decisions:** [what design choices shape this flow and why — sync vs async, cache strategy, fallback behaviour]

---
*(Add a section for each significant data path in the bet)*

---

## API Contracts

*Each entry here is a design commitment. Include enough reasoning that a developer understands the intent behind the shape — not just what the contract is, but why it was designed this way. Machine-readable schemas (OpenAPI, AsyncAPI) can live alongside this doc; this section carries the narrative.*

### [Service or Boundary Name]

**`METHOD /path`**

**Purpose:** [what this endpoint does and why it exists as a distinct endpoint]

**Request:**
```
field: type — description
field: type — description
```

**Response:**
```
field: type — description
field: type — description
```

**Errors:**
- `4xx [reason]` — [when this fires and what the caller should do]
- `5xx [reason]` — [when this fires]

**Design rationale:** [key decisions — why this shape, why this boundary, tradeoffs accepted]

---
*(Add an entry for each endpoint introduced by this bet)*

---

## UX Design

*Screens and interaction states specific to this bet. References the global `docs/ux-design.md` for design system and visual language — do not repeat those rules here. Focus on what is new: the states each screen can be in, what triggers transitions between them, and what data drives each state.*

### [Screen or Flow Name]

**Purpose:** [what this screen accomplishes for the user]

**States:**

| State | Trigger | What the user sees |
|-------|---------|-------------------|
| Loading | [trigger] | [skeleton / spinner / placeholder] |
| Success | [trigger] | [populated content description] |
| Empty | [trigger] | [empty state — what to show when there is nothing] |
| Error | [trigger] | [error message, recovery action] |

**Interactions:**
- [user action] → [system response and any state transition]
- [user action] → [system response]

**Data bindings:**
- [UI element] ← [data source — endpoint, local state, session storage]

---
*(Add a section for each screen or significant interaction introduced by this bet)*
