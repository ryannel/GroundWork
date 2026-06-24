## Schema & Data Design

*How this bet models and stores its data: the tables, collections, or stores it introduces or changes, the key fields, and the lifecycle states for anything with a state machine. State the intent and the shape — why the data is modelled this way, not just what columns exist. Reference `docs/architecture/domain/` for canonical entity definitions rather than duplicating them; note the domain entity path and describe only what this bet adds or changes. The machine-readable DDL lives in `contracts/schema.sql` — this section carries the design intent the DDL cannot.*

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

**Schema spec:** `contracts/schema.sql` (DDL sketch — the design commitment; Delivery derives the migration from it).
