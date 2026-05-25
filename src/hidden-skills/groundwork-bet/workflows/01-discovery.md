# Phase 1: Discovery (The Pitch)

**Goal:** Establish the boundary of the bet by generating the Pitch and Milestone breakdown.

## Operating Contract

**Before proceeding, load and apply all protocols from `.agents/groundwork/skills/operating-contract.md`.** The Discovery Notes, Living Documents, and Phase Lifecycle protocols defined there govern how this workflow operates — including how to capture out-of-phase signals during the pitch conversation and how to refine upstream documents when discovery reveals something they don't yet say.

## Discovery Notes Check

Check if `.groundwork/cache/discovery-notes.md` exists and has entries under `## Bets`.

If entries exist, treat them as pre-discovered context — sequencing instincts, scope opinions, or feature priorities the user surfaced during earlier phases. Carry them into the pitch conversation. Re-asking signals the user has already given erodes trust in the process.

If the file does not exist or has no `## Bets` entries, skip this step.

## Context Inputs

Read the relevant `docs/` artifacts before opening the conversation:

- `docs/product-brief.md` — what the system is, who it serves, what it does not do.
- `docs/architecture.md` — service boundaries and capability decisions the bet must respect.
- `docs/ux-design.md` — design system and NFRs the bet must implement against.

Arrive at the conversation already knowing what the system is and what the bet must fit inside. A discovery conversation that asks the user to re-explain the product is a discovery conversation that wastes the time it was meant to use.

## Instructions

1. Ensure a directory exists for this bet at `docs/bets/<bet-slug>/`. Create it if it doesn't exist.
2. Read the `.agents/groundwork/skills/groundwork-bet/templates/pitch.md` template.
3. Collaborate with the user to fill out the pitch. Ask probing questions about:
   - The core user problem.
   - The proposed solution (at a high level, not technical).
   - The appetite (how long should this take?).
   - The rabbit holes and No-Gos (what are we explicitly NOT building for this bet?).
4. Organize the solution into **Milestones**.
   - *Constraint:* Milestones must represent demonstrable product states — visible in the UI behind a feature flag. They cannot be organized by technical layer (e.g., "Build the API" is invalid; "User can authenticate and reach their workspace" is valid). State dependencies between milestones explicitly.
   - Identify the tech stack components each Milestone touches — this surfaces which services will need slices in Planning.
5. Once the user approves the pitch and milestone breakdown, write it to `docs/bets/<bet-slug>/pitch.md`.
6. Ensure the `pitch.md` frontmatter contains `status: discovery`.

## Transition

Once `pitch.md` is saved and the user is satisfied with the milestone breakdown, prompt the user to continue to the Planning phase.

If they agree, read and follow: `.agents/groundwork/skills/groundwork-bet/workflows/02-planning.md`
