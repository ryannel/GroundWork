## Schema & Data Design

*The tables, collections, or stores this bet introduces or changes — key fields with types, lifecycle states, and modelling rationale. The prose is the design commitment; Delivery derives the migration from it. Reference `docs/architecture/domain/` rather than duplicating it — note the domain entity path and describe only what this bet adds or changes.*

#### [Entity or Store Name]

**Owned by:** [service that owns this store]

**Purpose:** [what this store holds and why it is modelled as its own table/collection — the design decision, not a restatement of the fields]

**Key fields:**
| Field | Type | Description |
|-------|------|-------------|
| [field] | [type] | [what it represents] |

**Lifecycle states** (if applicable):

| State | Meaning | Transitions to |
|-------|---------|----------------|
| [state] | [what this state means] | [next states and triggers] |

**Design rationale:** [non-obvious modelling choices — normalisation vs embedding, why this index, why this key, consistency boundary]

**Domain reference:** `docs/architecture/domain/<entity>.md` — [what this bet adds beyond what is already documented]

---
*(Add a block for each entity or store introduced or significantly changed by this bet)*
