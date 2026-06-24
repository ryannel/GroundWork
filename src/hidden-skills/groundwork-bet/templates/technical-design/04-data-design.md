## Schema & Data Design

*How this bet models and stores its data: the tables, collections, or stores it introduces or changes, the key fields with their types, and the lifecycle states for anything with a state machine. State the intent and the shape — why the data is modelled this way and what the fields are. The prose is the design commitment; Delivery derives the migration from it. Reference `docs/architecture/domain/` for canonical entity definitions rather than duplicating them; note the domain entity path and describe only what this bet adds or changes.*

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

**Key fields and constraints** carry their types, nullability, defaults, and the indexes that encode design intent, so Delivery derives the migration straight from this section — the prose is the schema commitment, not a separate DDL file.

---
*(Add a block for each entity or store introduced or significantly changed by this bet)*
