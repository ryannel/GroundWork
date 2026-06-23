## Capability Design

*The headless core of the bet: API contracts and data schema — surface-neutral. The contract here serves every in-scope surface and presumes none. When only one surface is in scope, the latent agentic surface stands in as the contract's second consumer: would a programmatic caller find this contract complete? The data flows that frame this contract live in `00-overview.md`; this file carries the contract and schema narrative.*

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

#### Quality standard for an API contract entry

*The contract is a commitment, not an outline. Every entry must be specific enough that a developer implements from it without asking for clarification.*

**Shallow (insufficient):**

```markdown
#### Notification Service

**`GET /api/notifications`**
- Returns list of notifications for the authenticated user
- Requires auth token

**`POST /api/notifications/mark-read`**
- Marks notifications as read
```

**Deep (required standard):**

```markdown
#### Notification Service

**`GET /api/notifications`**

**Purpose:** Returns unread notifications for the authenticated user, ordered newest-first.
Used by the UI on initial load and by the polling fallback when the websocket is unavailable.

**Spec:** `contracts/openapi.yaml` → `getNotifications` (request/response field shapes live there:
the `limit` and `before_id` query params, the `Notification[]` response with `operation_id`,
`operation_type`, `status`, `message`, `read_at`, and the `has_more` cursor flag).

**Errors:**
- `401 Unauthorized` — missing or expired token; caller should redirect to login
- `429 Too Many Requests` — polling interval too short; caller must back off to 10s

**Design rationale:** Cursor-based pagination (`before_id`) rather than offset because
the feed changes frequently — offset pagination skips or duplicates items as new
notifications arrive between pages.
```

The shallow version has no purpose, no spec reference, no error cases, and no design rationale — it cannot drive a correct first-pass implementation. The deep version gives a developer everything needed to implement the endpoint correctly, and points at the spec for the field shapes rather than restating them.

### Data Schema

*Tables, collections, or stores this bet introduces or modifies. State key fields and lifecycle states for entities with state machines. Reference `docs/domain/` for canonical entity definitions rather than duplicating them — note the domain entity path and describe only what this bet adds or changes. The machine-readable DDL lives in `contracts/schema.sql`; this section carries the intent.*

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
