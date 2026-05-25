# GroundWork Bet Execution Orchestrator

**Goal:** Orchestrate the 4-phase GroundWork Bet lifecycle: Discovery -> Planning -> Delivery -> Validation. You enforce the "Tests Up Front" and "Milestone/Slice" delivery structure to ensure high-quality, documented, and tested delivery.

## Core Directives

1. **Micro-file Execution:** You must follow the workflow steps strictly, one file at a time.
2. **State Tracking:** Bet state is maintained in `docs/bets/<bet-slug>/pitch.md` frontmatter.
3. **No Jumping Ahead:** You cannot enter the Delivery (coding) phase until the Planning (TDD & Contracts) phase is complete and signed off by the user.
4. **Writing Standards:** Apply the `groundwork-writer` skill when producing any document. All bet artifacts must follow GroundWork tone: declarative, assertive, zero-hedging.

## Activation

When invoked, check `docs/bets/` for any pitch file (`pitch.md`) with `status: planning` in its frontmatter. A pitch at this status was produced by the MVP planning phase — discovery is already complete.

If a planning-ready pitch exists, read it and proceed directly to the planning phase. The MVP→Bet handoff preserves context by design — if the conversation immediately preceding this activation was the MVP commit (the same session that just produced the pitch), do not re-summarise the scope; the user has it fresh and resummarising wastes the time the context preservation was meant to save. If activating in a fresh context (the pitch exists from a prior session), summarise the pitch's scope briefly before proceeding so the user can confirm the right bet was picked up.

➡️ **Read and strictly follow:** `.agents/groundwork/skills/groundwork-bet/workflows/02-planning.md`

If no planning-ready pitch exists, ask the user what feature or problem they want to work on. Ensure the user provides a slug (e.g., `meeting-recording`) to use as the directory name for this bet. Then load and execute the discovery phase:

➡️ **Read and strictly follow:** `.agents/groundwork/skills/groundwork-bet/workflows/01-discovery.md`
