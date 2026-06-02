# Phase 1: Discovery (The Pitch)

**Goal:** Establish the boundary of the bet by generating the fat-marker Pitch — the problem, appetite, solution sketch, success signal, and explicit no-gos.

## Operating Contract

This workflow operates under the protocols defined in `.agents/groundwork/skills/operating-contract.md` (Continuous Bet mode: Protocols 1, 2, and 4 apply). Read it before taking any other action.

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

### Setup

1. Ensure a directory exists for this bet at `docs/bets/<bet-slug>/`. Create it if it doesn't exist.
2. Read the `.agents/groundwork/skills/groundwork-bet/templates/pitch.md` template.

### Track Selection

Ask the user which discovery track fits their situation:

> "Do you want to think through the problem together — explore the evidence, shape the hypothesis, and validate the approach before committing — or do you have a clear idea and want to move directly to capturing and executing it?"

- **Track 1 (Product-driven):** The user wants to explore and validate. Go through the Product-driven steps below.
- **Track 2 (Execution-focused):** The user has a clear idea. Go through the Execution-focused steps below.

Both tracks produce the same Pitch artifact and require the same review before committing. The difference is the front-end process.

---

### Track 1: Product-driven

Work through the following questions in sequence. Give each important question room to breathe — do not group questions that carry real trade-offs or downstream consequences. Converge toward a proposal once you have enough signal.

- **Problem:** "What problem are users experiencing? What evidence — usage data, support tickets, user feedback — tells you this is real and worth solving?"

  Push past symptoms to root causes. A problem like "users don't know about feature X" is a symptom; the problem might be "the first-run experience doesn't surface the workflow that leads users to feature X."

- **Hypothesis:** "What outcome would prove this problem is solved? Express it as a falsifiable signal — a measurable result you could observe in user behaviour or system data."

  Reject vague signals ("users are happier") and abstract metrics ("engagement improves"). The signal must be specific enough that a no-answer is just as informative as a yes-answer.

- **Solution sketch:** "What is your high-level proposed approach? What alternatives did you consider, and what makes this one the right choice? What is the single biggest risk in the solution?"

  Do not design the solution at this stage — that is Design Foundations. The sketch names the approach and its key assumption.

- **Appetite:** "How long is this problem worth? What scope fits inside that time boundary, and what scope must be cut to fit?"

  Frame appetite as an opportunity-cost judgment, not an estimate. The scope adjusts to fit the appetite — the appetite does not stretch to fit the scope.

- **No-gos:** "What are we explicitly not building in this bet? Name the natural extensions users would expect but that are out of scope, and explain why each one is excluded and where it belongs."

  Push past vague exclusions. "No mobile" is not a no-go; "No mobile push notifications — users expect these but they do not test the core in-app visibility hypothesis; separate bet" is.

Once all elements are captured, draft the Pitch. Weave in the success signal verbatim — it must appear explicitly in the Pitch, not be implied. Then continue to **Review and Commit** below.

---

### Track 2: Execution-focused

Capture the essential Pitch elements efficiently. The user knows what they want to build — your job is to ensure the Pitch is complete and internally consistent before it becomes the input to Design Foundations.

- **Problem and solution:** "What do you want to build, and what user problem does it solve?"

- **Success signal:** "How will you know this bet delivered its intended value? Give a specific, measurable outcome."

- **Appetite:** "How long should this take? What is in scope within that time, and what is explicitly out?"

- **No-gos:** "What are we not building — the natural extensions a user would expect that this bet explicitly excludes? For each, explain why it is excluded."

Before drafting, verify all elements are present and specific (falsifiable signal, no-gos with reasoning, appetite with scope boundary). Surface any gaps and fill them. Then continue to **Review and Commit** below.

---

### Review and Commit (both tracks)

3. Write the drafted Pitch to `.groundwork/cache/bet-pitch-draft.md`. The pitch is not yet committed — the draft passes through an independent review before becoming `docs/bets/<bet-slug>/pitch.md`. The pitch becomes the input to every downstream design and decomposition conversation; a silently dropped capability or invented constraint poisons the entire delivery loop.

4. Run the independent review:
   1. **Announce** the shift — the agent is moving from collaborative pitch-shaping into an independent review before committing the document.
   2. **Invoke the review subagent** with `document_path: .groundwork/cache/bet-pitch-draft.md` and `document_type: bet-pitch`. The subagent runs in an isolated context — via the `Task` tool in Claude Code or the `invoke_review` tool in the eval harness — and returns only `VERDICT: PRESENT | REVISE` and a findings list.
   3. **Revise loop.** If the verdict is **REVISE**, apply every 🔴 Critical finding directly to the draft — rewrite the affected sections rather than producing a list of suggestions. Write the revised draft back to `.groundwork/cache/bet-pitch-draft.md` and run the review again. Repeat until the verdict is **PRESENT**.
   4. **Carry advisory findings forward.** When the verdict is PRESENT, surface any 🟡 Advisory findings to the user along with the reviewed pitch so they can decide whether to act on them.

5. Present the reviewed pitch to the user. On explicit approval, promote `.groundwork/cache/bet-pitch-draft.md` to `docs/bets/<bet-slug>/pitch.md` by moving the file (the `move_file` tool, or `mv` via the shell) — do not read the draft and rewrite its contents.

6. Ensure the `pitch.md` frontmatter contains `status: discovery`.

## Quality Standard: What a Good Pitch Looks Like

A pitch that names features or lists milestones is a task list. The pitch must capture the reasoning: the problem with evidence of its impact, the signal that confirms it was solved, and the explicit cuts that keep the scope honest.

**Shallow (insufficient):**

```markdown
## The Pitch

- Problem: Users want better notifications.
- Appetite: 2 weeks.
- Solution: Add a notification system.

## Rabbit Holes & No-Gos

- Email
- Mobile push
```

**Deep (required standard):**

```markdown
## The Pitch

- **Problem:** Users have no visibility into long-running operations they trigger.
  They refresh manually to check for completion, miss failures for hours, and contact
  support with questions the system already knows the answer to.
- **Appetite:** 2 weeks. Bounded to in-app status updates for the three highest-volume
  operation types. Email notifications, mobile push, and notification preferences are
  excluded.
- **Solution:** Surface real-time status updates in the UI as operations progress through
  their lifecycle states, without requiring a manual refresh.
- **Success Signal:** Support tickets citing "I didn't know the operation failed" drop
  by ≥50% in the 30 days following launch. That signal confirms the visibility gap was
  the root cause, not an unrelated UX problem.

## Rabbit Holes & No-Gos

- [ ] Email notifications — users will expect these; excluded because the hypothesis is
  about in-app visibility, not channel coverage. A separate bet.
- [ ] Mobile push — excluded; the product's primary use case is desktop.
- [ ] Operation history / audit log — excluded; surfacing past state is a separate
  capability from surfacing current state.
- [ ] Notification preferences — excluded; a single status feed answers the hypothesis
  without customisation overhead.
```

The shallow version has no concrete problem evidence, no falsifiable success signal, and no-gos without reasoning. The deep version names the observable impact, bounds the appetite with explicit exclusions, and makes every no-go explicit about *why* it is excluded and where it belongs.

## Transition

Once `pitch.md` is saved and the user is satisfied with the pitch, prompt the user to continue to Design Foundations.

If they agree, read and follow: `.agents/groundwork/skills/groundwork-bet/workflows/02-design.md`
