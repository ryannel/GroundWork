# Phase 2: Design Foundations (Interface, Data Flows, Contracts, Schema)

**Goal:** Produce the design contract this bet executes against — before any decomposition begins. The contract anchors everything downstream: milestone interface-tests assert against the Interface Design; slice capabilities trace to the API Contracts and Data Schema; the review loop verifies the chain is intact. Design that skips to data flows before the interface is settled produces contracts the milestones cannot prove.

## Restrictions
⚠️ **CRITICAL CONSTRAINT:** You are FORBIDDEN from writing implementation code during this phase. You may only write design documentation, interface specifications, API contracts, and schemas.

## Operating Contract

This workflow operates under the protocols defined in `.agents/groundwork/skills/operating-contract.md` (Continuous Bet mode: Protocols 1, 2, and 4 apply). Read it before taking any other action.

## Discovery Notes Check

Check if `.groundwork/cache/discovery-notes.md` exists and has entries under `## Design Details`.

If entries exist, treat them as pre-discovered context — implementation decisions parked during the architecture phase that this design step is responsible for translating into contracts and schemas. Carry them into the relevant sections. After incorporating a `## Design Details` entry, remove it from the notes file so it is not re-applied to a future bet.

If the file does not exist or has no `## Design Details` entries, skip this step.

## Step 1: Update pitch status

Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: design`.

## Step 1.5: Reconcile domain entities

Read `docs/domain/` if it exists. Identify whether this bet introduces any new domain entities or adds new lifecycle states to existing ones. This is the Living Documents protocol applied to `docs/domain/`.

- If the bet introduces a **new entity** (a noun a service will own that does not yet have a file in `docs/domain/`), create a stub at `docs/domain/<entity-name>.md` using the template at `.agents/groundwork/skills/templates/domain-entity.md`. Fill in what the bet already implies — ownership, core fields, and lifecycle states as far as they are known. Stubs are explicitly incomplete.
- If the bet adds **new lifecycle states** to an existing entity, update the relevant `docs/domain/<entity-name>.md` file in place.

Confirm any domain doc changes with the user before proceeding to Step 2. Skip this step entirely if the bet introduces no new entities or state transitions.

## Step 2: Draft the Technical Design Document

Draft `docs/bets/<bet-slug>/technical-design.md` using the template at `.agents/groundwork/skills/groundwork-bet/templates/technical-design.md`.

The Technical Design Document covers the **entire bet** — not per-milestone. Write it before any decomposition into milestones or slices. The sections are ordered so each one provides the foundation the next depends on: the interface is what the user sees; data flows describe how the system produces it; API contracts specify the service boundaries; data schema grounds the contracts in persistent state.

**Interface Design:** Describe what the user observes and interacts with in this bet's interface medium. Organise by view, command, or interaction — not by feature or service. For each: the purpose, its states (loading, active, empty, error, degraded), and its key interactions. Use the vocabulary from the project's interface track in `docs/design-system.md`: screens and states for `graphical-ui`, commands and output for `cli`, request/response turns for `agentic-protocol`. This section is what milestone interface-tests will assert against — it must be specific enough to make a test pass or fail unambiguously.

**Data Flows:** Identify the key data paths this bet introduces or changes. For each path, describe what triggers it, which services handle it, what persists, and the key design decisions that shaped it. Skip trivial CRUD; focus on paths where timing, service boundaries, or failure modes are non-obvious.

**API Contracts:** For each service boundary touched by this bet, produce a fully specified endpoint design: full request shape with field types, full response shape with field types, all error cases with caller guidance, and design rationale for non-obvious decisions. Derive the specification from the pitch, upstream architecture, and the interface and data flow sections above — the user provides intent and context; you produce the detailed contract. Where a detail is ambiguous, propose the best design and confirm the key decisions with the user rather than leaving the field unspecified. Vague shapes ("returns the entity") cannot drive correct implementation. This section is the source from which Delivery will produce machine-readable API documentation (OpenAPI, protobuf, or AsyncAPI) — what is not here will not be in the implementation.

**Data Schema:** For each table, collection, or store this bet introduces or changes, define key fields and any lifecycle state machines. Reference `docs/domain/` rather than duplicating it — note the domain entity path and describe only what this bet adds or changes.

Write the draft to `docs/bets/<bet-slug>/technical-design.md`. This document is a commitment — it should reflect the actual design decisions, not a placeholder.

## Step 2.5: Independent Review of the Technical Design

The technical design is the contract Decomposition and Delivery execute against. A silently invented constraint, a dropped capability from the pitch, or a contradiction against the upstream architecture compounds into every milestone test and every line of implementation code. The review pass catches what the agent missed before the design hardens.

1. **Announce** the shift — the agent is moving from drafting into an independent review of the technical design before handing off to Decomposition.
2. **Invoke the review subagent** with `document_path: docs/bets/<bet-slug>/technical-design.md` and `document_type: technical-design`. The subagent runs in an isolated context — via the `Task` tool in Claude Code — and returns only `VERDICT: PRESENT | REVISE` and a findings list. The gate is fail-closed (Protocol 8): proceed only on a parseable `VERDICT: PRESENT`; if the reviewer errors, returns `REVIEW_UNAVAILABLE`, or returns no parseable verdict, the review has not run — do not commit, report the failure, and pause.
3. **Revise loop.** If the verdict is **REVISE**, apply every 🔴 Critical finding directly to the technical design — rewrite the affected sections rather than producing a list of suggestions. Write the revised technical design back to `docs/bets/<bet-slug>/technical-design.md` and run the review again. Repeat until the verdict is **PRESENT**. After 3 REVISE verdicts, apply the revise cap defined in Protocol 8.
4. **Carry advisory findings forward.** When the verdict is PRESENT, hold any 🟡 Advisory findings — they surface during the Decomposition review so the user can decide whether to act on them.

## Quality Standard: What a Good Technical Design Section Looks Like

The technical design is a contract, not an outline. Every section must be specific enough that a developer can implement from it without asking for clarification. Interface states, data flows, and API shapes must be explicit — not gestured at.

**Shallow (insufficient):**

```markdown
## API Contracts

### Notification Service

**`GET /api/notifications`**
- Returns list of notifications for the authenticated user
- Requires auth token

**`POST /api/notifications/mark-read`**
- Marks notifications as read
```

**Deep (required standard):**

```markdown
## API Contracts

### Notification Service

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

**Design rationale:** Cursor-based pagination (before_id) rather than offset because
the feed changes frequently — offset pagination skips or duplicates items as new
notifications arrive between pages.
```

The shallow version has no request shapes, no response field types, no error cases, and no design rationale. The deep version gives a developer everything needed to implement the endpoint correctly on the first pass.

## Transition

Once the technical design has passed review, present it to the user as the design contract for this bet. Walk through the Interface Design first — that is where the user's mental model of the bet lives — then the data flows, API contracts, and schema.

On approval:

1. Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: decomposition` — the design is locked and the bet advances to the Decomposition phase.
2. ➡️ Read and follow: `.agents/groundwork/skills/groundwork-bet/workflows/03-decomposition.md`
