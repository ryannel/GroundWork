# 02. The Delivery Loop

After the first bet ships, the project enters the Delivery Loop — an indefinite cycle of bets that delivers all subsequent feature work. Each bet runs the same four-phase workflow.

The `groundwork-bet` skill orchestrates the loop. It activates either by detecting a pitch at `status: planning` (the case for the first bet handed off from MVP Planning) or by being invoked directly for a new feature (in which case it starts at Discovery).

## The Four Phases

| Phase | Goal | Workflow file |
|---|---|---|
| 1. Discovery | Shape the problem into a pitch with milestones, appetite, and explicit no-gos. | `workflows/01-discovery.md` |
| 2. Planning | Translate milestones into slices and Tests-Up-Front contracts. No implementation code. | `workflows/02-planning.md` |
| 3. Delivery | Implement strictly within the planning contracts. | `workflows/03-delivery.md` |
| 4. Validation | Verify the implementation, fold learnings back into upstream docs, seed the next bet. | `workflows/04-validation.md` |

Each phase updates the pitch's `status` frontmatter as it activates (`discovery` → `planning` → `delivery` → `validation` → `delivered`), so the orchestrator and any contributor can see where the bet sits at any moment.

## Phase 1: Discovery

Discovery establishes the boundary of the bet in terms of user value. The agent reads the upstream `docs/` artifacts (Product Brief, Architecture, Design System) to ground the conversation in the existing system, checks the `## Bets` section of discovery notes for sequencing instincts captured earlier, then collaborates with the user on:

- The core user problem
- The proposed solution at a high level (not technical)
- The appetite — how long the work is worth
- Rabbit holes and no-gos

The output is a pitch organised into Milestones — demonstrable states the product reaches, each visible in the UI behind a feature flag. Milestones organised by technical layer ("Build the API") are invalid; milestones organised by demonstrable outcome ("User can authenticate and reach their workspace") are valid. Dependencies between milestones are stated explicitly.

The committed `pitch.md` carries `status: discovery` until the user agrees to proceed to Planning.

## Phase 2: Planning (Tests-Up-Front)

⚠️ Implementation code is forbidden during this phase.

Planning translates milestones into slices and produces the structural contracts that Delivery will implement against. For each slice — a vertical cut through one tech stack component — the agent:

- Adds the required endpoints or models to the service's OpenAPI schema and runs the repository's client-generation script.
- Writes a failing integration test file bound to the newly generated API client.
- Defines any required database migration.
- Defines UI states and data bindings if UI is involved.

Discovery notes under `## Design Details` — the implementation details parked during the Architecture phase (async flows, callback patterns, contract format choices) — feed directly into the contracts written here. Entries consumed during planning are removed from the notes file so they don't get re-applied to a future bet.

The output is a populated TDD checklist at `docs/bets/<slug>/tdd/checklist.md` mapping every structural component. The bet may not enter Delivery until the user has approved the failing test suite and structural contracts as Proof of Work.

## Phase 3: Delivery

⚠️ Delivery is constrained to writing only the code required to make the planning-phase tests pass and satisfy the structural contracts.

Discovering a fundamental flaw in the contracts during delivery means pausing, reverting to Planning, updating the tests and contracts, and getting user approval — not improvising around the flaw. The Operating Contract remains in force; any cross-phase signal that surfaces gets captured in discovery notes for Phase 4's full Living Documents scan.

Cross-service communication must use the API clients generated in Planning. Manually constructed HTTP requests are forbidden — they bypass the contract that Planning approved.

## Phase 4: Validation

Validation is the back-feed mechanism that keeps upstream docs aligned with the system as it actually is. A bet that ships without updating upstream docs leaves the next bet operating against a stale map.

The phase runs seven steps:

1. Update pitch status to `validation`.
2. Run the full test suite. Verify contract integrity (no rogue HTTP calls, no manual schemas).
3. Review the delivery with the user.
4. **Apply the Living Documents protocol** — scan and surgically update `docs/architecture.md`, `docs/design-system.md`, `docs/product-brief.md`, and `docs/infrastructure.md` against what the bet delivered. Report each change.
5. **Update discovery notes** — append new `## Bets` entries for signals about future work; remove entries consumed during this bet.
6. Mark the pitch `status: delivered`.
7. Recommend a fresh context for the next bet. The rich delivery context has been compressed into doc updates and discovery notes.

The Validation workflow file includes a Quality Standard section showing concrete examples of shallow vs. deep handoff output — the standard is that every doc updated must be named, the change quoted, and the reasoning attached.

## Why each bet stands alone

After the first bet, every subsequent bet runs in a fresh context. The bet skills do not carry conversational memory from earlier bets — they read only the current state of `docs/*.md` and `.groundwork/cache/discovery-notes.md`. This is deliberate: any context worth preserving has been promoted into a living document or parked in discovery notes by the previous bet's Validation step.

The exception is the first bet, which inherits the MVP planning context in the same session. See `01-setup.md` for the MVP→Bet handoff rationale.
