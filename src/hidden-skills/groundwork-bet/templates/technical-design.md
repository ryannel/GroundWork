# Technical Design: [Bet Name]

*This document captures the design decisions behind this bet. It is written before implementation begins and carried into execution as the planning contract. The goal is reasoning, not enumeration — explain why each decision was made so that the agent executing this bet can make consistent choices when details are missing.*

---

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

---
*(Add a view/command/interaction block for each significant interaction this bet introduces on this surface; add a `### Surface:` subsection for each in-scope surface)*

---

## Capability Design

*The headless core of the bet: data flows, API contracts, and data schema — surface-neutral. The contract here serves every in-scope surface and presumes none. When only one surface is in scope, the latent agentic surface stands in as the contract's second consumer: would a programmatic caller find this contract complete?*

### Data Flows

*Describe how data moves through the system to deliver this bet. Cover each significant path: what triggers it, what services handle it, what persists. Omit trivial CRUD flows — focus on paths where timing, ordering, or service boundaries are non-obvious.*

#### [Flow Name]

**Trigger:** [what initiates this flow — user action, scheduled job, upstream event]

**Path:**
1. [step — who, what, to where]
2. [step]
3. [step — what persists and where]

**Key decisions:** [what design choices shape this flow and why — sync vs async, cache strategy, fallback behaviour]

---
*(Add a block for each significant data path in the bet)*

### API Contracts

*Each entry here is a design commitment. The field shapes live in the machine-readable specs at `contracts/` (`openapi.yaml`, and `asyncapi.yaml` / `schema.sql` where the bet needs them) — this section carries what the spec format cannot: each endpoint's purpose, error-case guidance for callers, and the design rationale for non-obvious choices. Reference the spec; do not restate its field tables.*

*The specs are the source Decomposition writes tests against and Delivery implements against. If a field, flow, or error case is not in the spec, it will not be correctly implemented or tested.*

#### [Service or Boundary Name]

**`METHOD /path`**

**Purpose:** [what this endpoint does and why it exists as a distinct endpoint]

**Spec:** `contracts/openapi.yaml` → [operationId or path reference — request/response shapes live there]

**Errors:**
- `4xx [reason]` — [when this fires and what the caller should do]
- `5xx [reason]` — [when this fires]

**Design rationale:** [key decisions — why this shape, why this boundary, tradeoffs accepted]

---
*(Add an entry for each endpoint introduced by this bet)*

### Data Schema

*Tables, collections, or stores this bet introduces or modifies. State key fields and lifecycle states for entities with state machines. Reference `docs/domain/` for canonical entity definitions rather than duplicating them — note the domain entity path and describe only what this bet adds or changes.*

#### [Entity or Store Name]

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
*(Add a block for each entity or store introduced or significantly changed by this bet)*
