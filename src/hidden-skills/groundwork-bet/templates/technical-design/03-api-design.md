## API Design

*The interfaces the bet introduces or changes — the headless contract surface, designed surface-neutral. The contract here serves every in-scope surface and presumes none; when only one surface is in scope, the latent agentic surface stands in as the second consumer: would a programmatic caller find this contract complete? The flows that exercise these interfaces live in `02-data-flows.md`; this file carries the interface design.*

*Each entry is a design commitment. The field shapes live in the machine-readable specs at `contracts/` (`openapi.yaml`, and `asyncapi.yaml` / `.proto` where the bet needs them) — this section carries what the spec format cannot: each interface's purpose, error-case guidance for callers, and the design rationale for non-obvious choices. Reference the spec; do not restate its field tables.*

*The specs are the source Decomposition writes tests against and Delivery implements against. If a field, flow, or error case is not in the spec, it will not be correctly implemented or tested.*

*Single-app or embedded-core bets:* *the "interface" may be a module's public API or a key component boundary rather than a network endpoint — the contract discipline is identical (purpose, signature in the spec, errors, rationale). For a single app with no cross-service API, focus this file on the key component interfaces the rest of the app depends on; if the bet introduces no meaningful interface boundary, say so in one line rather than padding it.*

#### [Service / Component / Boundary Name]

**`METHOD /path`** *(or the function/method signature for an embedded core)*

**Purpose:** [what this interface does and why it exists as a distinct boundary]

**Spec:** `contracts/openapi.yaml` → [operationId or path reference — request/response shapes live there] *(or `contracts/<core-api>` → symbol, for an embedded core)*

**Errors:**
- `4xx [reason]` — [when this fires and what the caller should do]
- `5xx [reason]` — [when this fires]

**Design rationale:** [key decisions — why this shape, why this boundary, tradeoffs accepted]

---
*(Add an entry for each interface introduced or changed by this bet)*

#### Quality standard for an API design entry

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

The shallow version has no purpose, no spec reference, no error cases, and no design rationale — it cannot drive a correct first-pass implementation. The deep version gives a developer everything needed to implement the interface correctly, and points at the spec for the field shapes rather than restating them.
