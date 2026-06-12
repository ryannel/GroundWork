# Technical Design: [Bet Name]

*This document captures the design decisions behind this bet. It is written before implementation begins and carried into execution as the planning contract. The goal is reasoning, not enumeration — explain why each decision was made so that the agent executing this bet can make consistent choices when details are missing.*

---

## Interface Design

*Describe what the user observes and interacts with in this bet's interface medium. Organize by view, command, or interaction — not by feature or service. This section is the anchor milestones' interface-level tests will assert against.*

*Use the vocabulary appropriate to the project's interface track (from `docs/design-system.md`):*
- *`graphical-ui` — screens, views, regions, states (loading, active, empty, error, degraded)*
- *`cli` — commands, flags, output format, error messages, exit codes*
- *`agentic-protocol` — request/response turns, protocol states, expected response structure*

### [View / Command / Interaction Name]

**Purpose:** [what this interaction accomplishes for the user]

**States:**

| State | Trigger | What the user observes |
|-------|---------|------------------------|
| [state name] | [what causes this state] | [what the user sees, reads, or receives] |
| [state name] | [what causes this state] | [what the user sees, reads, or receives] |

**Key interactions:**
- [user action] → [system response and any state transition]
- [user action] → [system response]

---
*(Add a section for each view, command, or significant interaction introduced by this bet)*

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

*Each entry here is a design commitment. Include enough detail that a developer can implement the endpoint correctly without asking for clarification: full request shape with field types, full response shape with field types, all error cases, and the design rationale for any non-obvious choice.*

*This is the design contract. During Delivery, each entry becomes the source for the service's machine-readable API documentation (OpenAPI, protobuf, or AsyncAPI). If a field, flow, or error case is not captured here, it will not be correctly implemented or documented.*

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

## Data Schema

*Tables, collections, or stores this bet introduces or modifies. State key fields and lifecycle states for entities with state machines. Reference `docs/domain/` for canonical entity definitions rather than duplicating them — note the domain entity path and describe only what this bet adds or changes.*

### [Entity or Store Name]

**Owned by:** [service that owns this store]

**Key fields:**
| Field | Type | Description |
|-------|------|-------------|
| [field] | [type] | [what it represents] |

**Lifecycle states** (if applicable):

| State | Meaning | Transitions to |
|-------|---------|----------------|
| [state] | [what this state means] | [next states and triggers] |

**Domain reference:** `docs/domain/<entity>.md` — [what this bet adds beyond what is already documented]

---
*(Add a section for each entity or store introduced or significantly changed by this bet)*
