## API Design

*The interfaces the bet introduces or changes — the contract beneath the surfaces, designed surface-neutral. The contract here serves every in-scope surface and presumes none; when only one surface is in scope, the latent agentic surface stands in as the second consumer: would a programmatic caller find this contract complete? The flows that exercise these interfaces live in `02-data-flows.md`; this file carries the interface design.*

*Each entry is a design commitment, and it carries the shapes at design fidelity: the full request shape with field types, the full response shape with field types, the error cases with caller guidance, and the design rationale for non-obvious choices. The prose is the contract — Decomposition writes its prose proofs against these shapes, and Delivery implements against them and generates the real machine-readable contract (OpenAPI/AsyncAPI/proto) from the running code. A field, flow, or error case that is not specified here will not be correctly implemented or tested.*

*Single-app or embedded-core bets:* *the "interface" may be a module's public API or a key component boundary rather than a network endpoint — the contract discipline is identical (purpose, full signature, errors, rationale). For a single app with no cross-service API, focus this file on the key component interfaces the rest of the app depends on; if the bet introduces no meaningful interface boundary, say so in one line rather than padding it.*

#### [Service / Component / Boundary Name]

**`METHOD /path`** *(or the function/method signature for an embedded core)*

**Purpose:** [what this interface does and why it exists as a distinct boundary]

**Request:**
```
[full request shape — headers, params, body fields, each with its type, nullability, and allowed values where they matter]
```

**Response:**
```
[full response shape — every field with its type; enums spelled out; cursors and identifiers typed]
```

**Errors:**
- `4xx [reason]` — [when this fires and what the caller should do]
- `5xx [reason]` — [when this fires]

**Design rationale:** [key decisions — why this shape, why this boundary, tradeoffs accepted]

---
*(Add an entry for each interface introduced or changed by this bet)*

#### Quality standard for an API design entry

*The contract is a commitment, not an outline. Every entry must carry its full shapes with field types — specific enough that a developer implements from it without asking for clarification, and Delivery's generated contract matches it exactly.*

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

**Request:**
```
Authorization: Bearer <token>   — required
?limit: integer                 — max results (default 20, max 100)
?before_id: uuid                — cursor; returns notifications older than this id
```

**Response:**
```
notifications: Notification[]
  id: uuid
  operation_id: uuid            — links to the triggering operation
  operation_type: enum(export, import, sync)
  status: enum(in_progress, completed, failed)
  message: string               — human-readable current state description
  created_at: timestamp
  read_at: timestamp | null     — null if unread
has_more: boolean               — true if older notifications exist past this page
```

**Errors:**
- `401 Unauthorized` — missing or expired token; caller should redirect to login
- `429 Too Many Requests` — polling interval too short; caller must back off to 10s

**Design rationale:** Cursor-based pagination (`before_id`) rather than offset because
the feed changes frequently — offset pagination skips or duplicates items as new
notifications arrive between pages.
```

The shallow version has no purpose, no shapes, no error cases, and no design rationale — it cannot drive a correct first-pass implementation. The deep version gives a developer everything needed to implement the interface correctly, and the field shapes are right here in the design rather than deferred to a separate spec file.
