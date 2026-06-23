# Phase 1: Context Ingestion

**This phase is silent preparation — do not speak to the user.**

Read upstream context in the order the Operating Contract Protocol 3.2 prescribes — hand-off first, then Downstream Context files, then full body only when a specific decision requires it. Pre-loading the full upstream docs into context wastes the working memory you need for the architectural decisions ahead.

Read in this order:

1. **Hand-off file (full)** — `.groundwork/cache/handoff/design-system.md` if it exists. Carries the design system phase's rejected directions, deferred decisions, and user instincts that did not fit in `docs/design-system.md`. Read in full.
2. **Downstream Context files (Protocol 5)** — read the upstream phases' context files from `.groundwork/context/`:
   - `.groundwork/context/product-brief.md` — Key Decisions, Binding Constraints, Deferred Questions
   - `.groundwork/context/design-system.md` — non-functional requirements, performance and interaction budgets, accessibility floors
3. **Discovery notes** — `.groundwork/cache/discovery-notes.md`, only entries under `## Architecture`.
4. **Full body sections — lazy** — read a section from the body of an upstream `docs/*.md` only when a specific decision in Phases 2–5 requires detail the Downstream Context file does not carry. Do not pre-load the full body.

The orchestrator guarantees the upstream docs and their Downstream Context files exist before this skill is invoked — if a file is missing, proceed without it and note the gap internally. The hand-off file is optional; if absent, the previous phase had nothing to drop.

Arrive at Phase 2 already knowing as much about the system as the Downstream Context files and hand-off can tell you, with the body available for lazy reads when specific decisions demand it.
