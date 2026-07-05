<!--
  Single source of truth for the simulation judge rubric.

  scripts/seed_simulation.js renders this file into the sandbox at
  .claude/commands/judge.md. Rendering rules:
    - this leading comment block is stripped
    - {{flowPath}} is replaced with "greenfield" or "brownfield"
    - {{#greenfield}}...{{/greenfield}} and {{#brownfield}}...{{/brownfield}}
      blocks are kept for the matching path and removed for the other
  Edit the rubric here; never inline it in the seeder.
-->
---
description: Assess the documents a GroundWork {{flowPath}} simulation produced (non-gating quality review).
---

You are a **fresh, independent reviewer**. You did NOT write these documents —
do not assume they are good. Read what is actually on disk and judge it honestly.

This is a **non-gating** quality review. Nothing depends on a passing verdict;
your job is to tell the human running the simulation whether the output is
genuinely good and where it is weak.

## What to read

1. Every file under `docs/` (product brief, design system, architecture,
   infrastructure, and any `bets/`).
2. `.groundwork/config/state.json` to confirm which phases the flow recorded.
{{#greenfield}}
3. The git log, so you can see the order documents were committed in.
{{/greenfield}}
{{#brownfield}}
3. The existing application source the docs were reverse-engineered from, so you can
   judge whether the docs match the real code (no invented services, no missed ones).
{{/brownfield}}

## How to judge

Do not check for file existence — a separate structural checklist already does
that. Judge **quality and coherence**:

- **Faithfulness** — does each document reflect what the simulated user actually
  said in the interview, or did the facilitator invent requirements?
- **Coherence across phases** — does the architecture follow from the design
  system, which follows from the product brief? Flag drift, especially the
  scaffold/architecture mismatch this flow is prone to.
- **Specificity** — is the content concrete and decision-bearing, or generic
  filler that would read the same for any product?
- **GroundWork tone** — declarative, assertive, no hedging (per groundwork-writer).
{{#brownfield}}
- **Grounding** — every service, endpoint, and token in the docs must trace to
  real code. Invented capabilities are the brownfield failure mode.
{{/brownfield}}

## Output

1. A one-line **verdict** per document: `strong` / `acceptable` / `weak`, with a reason.
2. The **single most important problem** across all the docs, with a fix.
3. Anything the simulated user said that the documents failed to capture.

## Durable output (required)

Run reference: $ARGUMENTS

Write the complete verdict — all three parts above — to the file
**`.simrun/verdict.md`** in this project (create the `.simrun/` directory if it
does not exist). Start the file with a `run:` line quoting the run reference above
(or `run: unattributed` if it is empty). Then present the same verdict in the
conversation. The file is the durable record — a verdict that lives only in this
chat evaporates.
