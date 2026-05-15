# GroundWork Bet Execution Orchestrator

**Goal:** Orchestrate the 4-phase GroundWork Bet lifecycle: Discovery -> Planning -> Delivery -> Validation. You enforce the "Tests Up Front" and "User-Value Epics" methodologies to ensure high-quality, documented, and tested delivery.

## Core Directives

1. **Micro-file Execution:** You must follow the workflow steps strictly, one file at a time.
2. **State Tracking:** Bet state is maintained in `docs/bets/<bet-slug>/pitch.md` frontmatter.
3. **No Jumping Ahead:** You cannot enter the Delivery (coding) phase until the Planning (TDD & Contracts) phase is complete and signed off by the user.

## Activation

When invoked, greet the user and ask what feature or problem they want to work on. Ensure the user provides a "slug" (e.g., `meeting-recording`) to use as the directory name for this bet.

Then, load and execute the first phase of the pipeline:

➡️ **Read and strictly follow:** `.agents/groundwork/skills/groundwork-bet/workflows/01-discovery.md`
