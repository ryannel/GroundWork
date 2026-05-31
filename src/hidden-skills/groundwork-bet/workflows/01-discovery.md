# Phase 1: Discovery (The Pitch)

**Goal:** Establish the boundary of the bet by generating the fat-marker Pitch — the problem, appetite, solution sketch, success signal, and explicit no-gos.

## Operating Contract

Standard assistant behaviour — covering too much ground per turn, rushing to draft before the conversation has earned its conclusions, and treating documents as static after committing them — undermines collaborative design. These are the failure modes this process is built to prevent.

The shared operating contract at `.agents/groundwork/skills/operating-contract.md` defines how to manage conversational pacing, discovery notes, living documents, and phase lifecycles. Read it before taking any other action — the protocols there govern how this entire skill operates.

## Discovery Notes Check

Check if `.groundwork/cache/discovery-notes.md` exists and has entries under `## Bets`.

If entries exist, treat them as pre-discovered context — sequencing instincts, scope opinions, or feature priorities the user surfaced during earlier phases. Carry them into the pitch conversation. Re-asking signals the user has already given erodes trust in the process.

If the file does not exist or has no `## Bets` entries, skip this step.

## Context Inputs

Read the relevant `docs/` artifacts before opening the conversation:

- `docs/product-brief.md` — what the system is, who it serves, what it does not do.
- `docs/architecture.md` — service boundaries and capability decisions the bet must respect.
- `docs/design-system.md` — the design system and NFRs the bet must implement against.

Arrive at the conversation already knowing what the system is and what the bet must fit inside. A discovery conversation that asks the user to re-explain the product is a discovery conversation that wastes the time it was meant to use.

## Instructions

1. Ensure a directory exists for this bet at `docs/bets/<bet-slug>/`. Create it if it doesn't exist.
2. Read the `.agents/groundwork/skills/groundwork-bet/templates/pitch.md` template.
3. Collaborate with the user to fill out the pitch. Ask probing questions about:
   - The core user problem.
   - The proposed solution (at a high level, not technical).
   - The appetite (how long should this take?).
   - The success signal (what observable outcome confirms this bet delivered its intended value?).
   - The rabbit holes and no-gos — what are we explicitly NOT building? Push past vague exclusions to name natural extensions users would expect but that are out of scope, and why. These prevent scope creep and stop reviewers from raising excluded items as gaps.
4. Once the user is satisfied with the pitch, write the draft to `.groundwork/cache/bet-pitch-draft.md`. The pitch is not yet committed — the draft passes through an independent review before becoming `docs/bets/<bet-slug>/pitch.md`. The pitch becomes the input to every downstream design and decomposition conversation; a silently dropped capability or invented constraint poisons the entire delivery loop, so the review pass catches what a collaborative conversation alone cannot.

5. Run the independent review:
   1. **Announce** the shift — the agent is moving from collaborative pitch-shaping into an independent review before committing the document.
   2. **Invoke the review subagent** with `document_path: .groundwork/cache/bet-pitch-draft.md` and `document_type: bet-pitch`. The subagent runs in an isolated context — via the `Task` tool in Claude Code or the `invoke_review` tool in the eval harness — and returns only `VERDICT: PRESENT | REVISE` and a findings list.
   3. **Revise loop.** If the verdict is **REVISE**, apply every 🔴 Critical finding directly to the draft — rewrite the affected sections rather than producing a list of suggestions. Write the revised draft back to `.groundwork/cache/bet-pitch-draft.md` and run the review again. Repeat until the verdict is **PRESENT**.
   4. **Carry advisory findings forward.** When the verdict is PRESENT, surface any 🟡 Advisory findings to the user along with the reviewed pitch so they can decide whether to act on them.

6. Present the reviewed pitch to the user. On explicit approval, promote `.groundwork/cache/bet-pitch-draft.md` to `docs/bets/<bet-slug>/pitch.md` by moving the file (the `move_file` tool, or `mv` via the shell) — do not read the draft and rewrite its contents.

7. Ensure the `pitch.md` frontmatter contains `status: discovery`.

## Transition

Once `pitch.md` is saved and the user is satisfied with the pitch, prompt the user to continue to Design Foundations.

If they agree, read and follow: `.agents/groundwork/skills/groundwork-bet/workflows/02-design.md`
