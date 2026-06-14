# Phase 2: Design Foundations (Surface Design, Data Flows, Contracts, Schema)

**Goal:** Produce the design contract this bet executes against — before any decomposition begins. The contract anchors everything downstream: surface milestone tests assert against the Surface Design subsections; slice capabilities trace to the Capability Design's API Contracts and Data Schema; the review loop verifies the chain is intact. Design that locks the contract before the surface designs are settled produces a contract shaped by guesswork about the experiences it must serve.

## Restrictions
⚠️ **CRITICAL CONSTRAINT:** You are FORBIDDEN from writing implementation code during this phase. You may only write design documentation, interface specifications, API contracts, and schemas.

## Operating Contract

This workflow operates under the protocols defined in `.agents/groundwork/skills/operating-contract.md` (contract v1; Continuous Bet mode: Protocols 1, 2, 4, 8, and 9 apply). Read it before taking any other action.

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

## Step 1.9: Adopt the architect persona

The Technical Design Document and the contract specs below are architecture work — service boundaries, contract shapes, data flows, consistency models — done at bet scope. Load `.agents/groundwork/skills/groundwork-architect/SKILL.md` and design as that persona for the rest of this phase.

Route to its `references/` by what this bet touches: `boundaries-and-hexagonal.md` if it adds or moves a boundary; `api-and-contracts.md` and `integration-patterns.md` for the API contracts and sync/async choices; `realtime-and-async.md` for any live path; `data-architecture.md` and `security-and-trust.md` for the schema, ownership, and trust decisions; `ai-native-architecture.md` for a model-in-the-loop feature. Apply the reference's reasoning and its antipatterns to the design.

The bet must fit inside the boundaries `docs/architecture.md` already committed. Where it cannot, the persona surfaces that explicitly — say the committed boundary is changing and why, and record it (`decision-records.md`); do not let the architecture drift one quiet bet at a time.

If a design decision changes what the bet delivers to its users — cutting a capability to fit the appetite, or expanding scope the pitch did not commit — that is a value/scope call, not a structural one: defer it to the product persona (`.agents/groundwork/skills/groundwork-product/SKILL.md`) rather than deciding it from the architecture seat. The architect owns feasibility; product owns whether the changed scope is still worth building.

## Step 2: Draft the Technical Design Document

Draft `docs/bets/<bet-slug>/technical-design.md` using the template at `.agents/groundwork/skills/groundwork-bet/templates/technical-design.md`.

The Technical Design Document covers the **entire bet** — not per-milestone. Write it before any decomposition into milestones or slices. The document carries two top-level sections whose order is the design's logic: **Surface Design** is drafted first, because the contract must serve the experiences — never the other way around; **Capability Design** (data flows, API contracts, data schema) is then written once beneath all of them, surface-neutral and headless.

**Surface Design:** One subsection per surface in the pitch's `surfaces:` frontmatter. Each subsection describes what that surface's users observe and interact with, organised by view, command, or interaction — not by feature or service. For each: the purpose, its states (loading, active, empty, error, degraded), and its key interactions. Write each subsection in the vocabulary of that surface's interface type, from its design track in `docs/design-system.md`: screens and states for `graphical-ui`, commands and output for `cli`, request/response turns for `agentic-protocol` — a bet spanning a web app and a CLI carries one subsection in each vocabulary. Each subsection is what that surface's milestone tests will assert against — it must be specific enough to make a test pass or fail unambiguously. When the project has no surface registry (`docs/surfaces.md` absent), the product has a single implicit surface: write one subsection for it in the project's interface medium and skip every other surface consideration in this workflow — the result is today's document with the headings one level deeper. A single-surface registry likewise produces exactly one subsection, with no added questions.

**Capability Design** is the headless core of the bet — everything in it must be designable, implementable, and provable with no surface running. Its three subsections:

**Data Flows:** Identify the key data paths this bet introduces or changes. For each path, describe what triggers it, which services handle it, what persists, and the key design decisions that shaped it. Skip trivial CRUD; focus on paths where timing, service boundaries, or failure modes are non-obvious.

**API Contracts:** For each service boundary touched by this bet, produce a fully specified endpoint design: full request shape with field types, full response shape with field types, all error cases with caller guidance, and design rationale for non-obvious decisions. Derive the specification from the pitch, upstream architecture, and the surface design and data flow sections above — the user provides intent and context; you produce the detailed contract. Where a detail is ambiguous, propose the best design and confirm the key decisions with the user rather than leaving the field unspecified. Vague shapes ("returns the entity") cannot drive correct implementation. The shapes themselves live in the spec files written in Step 2.2 — this section carries the purpose, error guidance, and design rationale the spec format cannot, and references the spec rather than restating field tables.

**The contract serves every in-scope surface and presumes none.** Designing the contract against all of its consumers at once is the cheapest moment to catch a web-shaped API a mobile client or CLI cannot use — a session assumption baked into a response, markup returned where data belongs, pagination sized to a viewport. Walk each surface's design against the contract before locking it. When only one surface is in scope, the latent agentic surface stands in as the second consumer: would a programmatic caller, with no UI and no session, find this contract complete? The review enforces this check.

**Data Schema:** For each table, collection, or store this bet introduces or changes, define key fields and any lifecycle state machines. Reference `docs/domain/` rather than duplicating it — note the domain entity path and describe only what this bet adds or changes.

Write the draft to `docs/bets/<bet-slug>/technical-design.md`. This document is a commitment — it should reflect the actual design decisions, not a placeholder.

## Step 2.2: Emit machine-readable contract specs

A contract that exists only as prose cannot generate a client, validate a response, or fail a drift check — it becomes executable only when someone re-types it, and every re-typing is a chance to diverge. Write the contract's shapes as spec files at design time so Decomposition writes tests against the same artifact Delivery implements against.

The spec format follows the capability core's deployment as recorded in `docs/surfaces.md` (when no registry exists, the project predates it — treat the core as hosted HTTP, today's behaviour). Write to `docs/bets/<bet-slug>/contracts/`:

- **Hosted core, HTTP boundaries** — **`openapi.yaml`**: every HTTP boundary this bet introduces or changes, as OpenAPI 3.x: paths, methods, request/response schemas with field types, error responses. One file covering all touched services, with `tags` naming the owning service. This is the common case and is unchanged.
- **Hosted core, events/messaging/websockets** — **`asyncapi.yaml`**: channels, message schemas, delivery semantics.
- **Hosted core, gRPC boundaries** — **`.proto`** files: services, messages, field types.
- **Embedded core** — a typed public API definition in the project's own language (e.g. a `.d.ts`, a Go interface file, a Python protocol/stub file): every exported function, type, and error the core's surface consumes, with full signatures. The contract discipline is identical to OpenAPI's — only the format speaks the language the core is linked in.
- **`schema.sql`** — whenever the bet introduces or alters persistent state, regardless of deployment: DDL sketches for each table or store change (`CREATE TABLE` / `ALTER TABLE` with types, constraints, and indexes that carry design intent). This is the design commitment, not the migration file — Delivery derives migrations from it.

The spec files and the prose sections describe one contract. Field shapes live in the specs; purpose, error-case guidance, and rationale live in the prose; neither restates the other. The invariant holds across every format: a shape that exists only in prose is an unfinished contract.

## Step 2.5: Independent Review of the Technical Design

The technical design is the contract Decomposition and Delivery execute against. A silently invented constraint, a dropped capability from the pitch, or a contradiction against the upstream architecture compounds into every milestone test and every line of implementation code. The review pass catches what the agent missed before the design hardens.

1. **Announce** the shift — the agent is moving from drafting into an independent review of the technical design before handing off to Decomposition.
2. **Invoke the review subagent** (Protocol 9) with `document_path: docs/bets/<bet-slug>/technical-design.md` and `document_type: technical-design`. The gate is fail-closed (Protocol 8): proceed only on a parseable `VERDICT: PRESENT`; a review that errors, hangs, or returns no verdict follows Protocol 9's failure path.
3. **Revise loop.** If the verdict is **REVISE**, apply every 🔴 Critical finding directly to the technical design — rewrite the affected sections rather than producing a list of suggestions. Write the revised technical design back to `docs/bets/<bet-slug>/technical-design.md` and run the review again. The revise cap is a hard stop, not a target to push past: after 3 REVISE verdicts, stop, surface remaining 🔴 findings as 🟡 Advisory, and disclose that the review did not reach **PRESENT** (Protocol 8).
4. **Carry advisory findings forward.** When the verdict is PRESENT, hold any 🟡 Advisory findings — they surface during the Decomposition review so the user can decide whether to act on them.

## Quality Standard: What a Good Technical Design Section Looks Like

The technical design is a contract, not an outline. Every section must be specific enough that a developer can implement from it without asking for clarification. Surface states, data flows, and API shapes must be explicit — not gestured at.

**Shallow (insufficient):**

```markdown
### API Contracts

#### Notification Service

**`GET /api/notifications`**
- Returns list of notifications for the authenticated user
- Requires auth token

**`POST /api/notifications/mark-read`**
- Marks notifications as read
```

**Deep (required standard):**

```markdown
### API Contracts

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

**Design rationale:** Cursor-based pagination (before_id) rather than offset because
the feed changes frequently — offset pagination skips or duplicates items as new
notifications arrive between pages.
```

The shallow version has no request shapes, no response field types, no error cases, and no design rationale. The deep version gives a developer everything needed to implement the endpoint correctly on the first pass.

## Transition

Once the technical design has passed review, present it to the user as the design contract for this bet. Walk through the Surface Design first, subsection by subsection — that is where the user's mental model of the bet lives — then the Capability Design: data flows, API contracts, and schema. When the user wants to push a section deeper — or a section reads thin against the quality standard above — load `.agents/groundwork/skills/groundwork-elicit/instructions.md` and follow it.

On approval:

1. Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: decomposition` — the design is locked and the bet advances to the Decomposition phase.
2. ➡️ Read and follow: `.agents/groundwork/skills/groundwork-bet/workflows/03-decomposition.md`
