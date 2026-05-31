# Phase 2: Design Foundations (Interface, Data Flows, Contracts, Schema)

**Goal:** Produce the design contract this bet executes against — before any decomposition begins. The contract anchors everything downstream: milestone interface-tests assert against the Interface Design; slice capabilities trace to the API Contracts and Data Schema; the review loop verifies the chain is intact. Design that skips to data flows before the interface is settled produces contracts the milestones cannot prove.

## Restrictions
⚠️ **CRITICAL CONSTRAINT:** You are FORBIDDEN from writing implementation code during this phase. You may only write design documentation, interface specifications, API contracts, and schemas.

## Operating Contract

Standard assistant behaviour — covering too much ground per turn, rushing to draft before the conversation has earned its conclusions, and treating documents as static after committing them — undermines collaborative design. These are the failure modes this process is built to prevent.

The shared operating contract at `.agents/groundwork/skills/operating-contract.md` defines how to manage conversational pacing, discovery notes, living documents, and phase lifecycles. Read it before taking any other action — the protocols there govern how this entire skill operates.

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

**API Contracts:** For each service boundary touched by this bet, define the endpoints with request/response shapes and the reasoning behind each design decision. The goal is a document a developer can pick up during Delivery and make consistent implementation choices from — explain the why, not just the what.

**Data Schema:** For each table, collection, or store this bet introduces or changes, define key fields and any lifecycle state machines. Reference `docs/domain/` rather than duplicating it — note the domain entity path and describe only what this bet adds or changes.

Write the draft to `docs/bets/<bet-slug>/technical-design.md`. This document is a commitment — it should reflect the actual design decisions, not a placeholder.

## Step 2.5: Independent Review of the Technical Design

The technical design is the contract Decomposition and Delivery execute against. A silently invented constraint, a dropped capability from the pitch, or a contradiction against the upstream architecture compounds into every milestone test and every line of implementation code. The review pass catches what the agent missed before the design hardens.

1. **Announce** the shift — the agent is moving from drafting into an independent review of the technical design before handing off to Decomposition.
2. **Invoke the review subagent** with `document_path: docs/bets/<bet-slug>/technical-design.md` and `document_type: technical-design`. The subagent runs in an isolated context — via the `Task` tool in Claude Code or the `invoke_review` tool in the eval harness — and returns only `VERDICT: PRESENT | REVISE` and a findings list.
3. **Revise loop.** If the verdict is **REVISE**, apply every 🔴 Critical finding directly to the technical design — rewrite the affected sections rather than producing a list of suggestions. Write the revised technical design back to `docs/bets/<bet-slug>/technical-design.md` and run the review again. Repeat until the verdict is **PRESENT**.
4. **Carry advisory findings forward.** When the verdict is PRESENT, hold any 🟡 Advisory findings — they surface during the Decomposition review so the user can decide whether to act on them.

## Transition

Once the technical design has passed review, present it to the user as the design contract for this bet. Walk through the Interface Design first — that is where the user's mental model of the bet lives — then the data flows, API contracts, and schema.

On approval:

1. Update `docs/bets/<bet-slug>/pitch.md` frontmatter to `status: decomposition` — the design is locked and the bet advances to the Decomposition phase.
2. ➡️ Read and follow: `.agents/groundwork/skills/groundwork-bet/workflows/03-decomposition.md`
