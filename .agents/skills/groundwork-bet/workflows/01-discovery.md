# Phase 1: Discovery (The Pitch)

**Goal:** Establish the boundary of the bet in terms of User Value by generating the Pitch and Epic design.

## Instructions

1. Ensure a directory exists for this bet at `docs/bets/<bet-slug>/`. Create it if it doesn't exist.
2. Read the `templates/pitch.md` template.
3. Collaborate with the user to fill out the pitch. Ask probing questions about:
   - The core user problem.
   - The proposed solution (at a high level, not technical).
   - The appetite (how long should this take?).
   - The rabbit holes and No-Gos (what are we explicitly NOT building?).
4. Organize the solution into **Epics**. 
   - *Constraint:* Epics must represent standalone, dependency-free slices of user value. They cannot be organized by technical layers (e.g., "Build the API" is invalid; "User Authentication flow" is valid).
   - Identify the cross-service boundaries for these Epics (e.g., "This will require updating the `core-api` OpenAPI schema").
5. Once the user approves the pitch and epic breakdown, write it to `docs/bets/<bet-slug>/pitch.md`.
6. Ensure the `pitch.md` frontmatter contains `status: discovery`.

## Transition

Once `pitch.md` is saved and the user is satisfied with the epic breakdown, prompt the user to continue to the Planning phase.

If they agree, read and follow: `./02-planning.md`
