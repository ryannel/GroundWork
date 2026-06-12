# Phase 1: Discovery (The Pitch)

**Goal:** Establish the boundary of the bet by generating the fat-marker Pitch — the problem, appetite, solution sketch, success signal, and explicit no-gos.

## Operating Contract

This workflow operates under the protocols defined in `.agents/groundwork/skills/operating-contract.md` (Continuous Bet mode: Protocols 1, 2, 4, 8, and 9 apply). Read it before taking any other action.

## Discovery Notes Check

Check if `.groundwork/cache/discovery-notes.md` exists and has entries under `## Bets`.

If entries exist, treat them as pre-discovered context — sequencing instincts, scope opinions, or feature priorities the user surfaced during earlier phases, and retrospective action items carrying stable IDs (`<bet-slug>-R<n>`) from the previous bet's validation. Some entries are `planned` capability-ledger cells cross-posted by a previous bet's validation — capabilities already committed to reach a named surface. These are discovery input: when one touches the problem the user brings, surface it as candidate scope for this bet rather than letting the commitment age in the parking lot. Carry all of it into the pitch conversation; an action item the new bet absorbs is cited in the pitch by its ID so the next retrospective's follow-through audit can close it. Re-asking signals the user has already given erodes trust in the process.

If the file does not exist or has no `## Bets` entries, skip this step.

## Patch Ledger Check

Read `docs/bets/patch-ledger.md` if it exists. Two or more patches in one area are a demand signal the user has already expressed in small pieces — surface the cluster as a candidate problem for this bet, citing the ledger rows. A bet that absorbs a patch cluster notes the rows in its pitch; the cluster is then settled and not re-raised.

## Maturity Roadmap Check

Read `docs/maturity.md` if it exists (the maturity model behind it is defined in `.agents/groundwork/skills/maturity-model.md`). Roadmap rows with status `open` and recommendation `fix-now` or `blocks-delivery` are candidate work for this bet — the system's own distance from the state where delivery runs well.

- When the user's chosen problem **is** an open gap, connect them explicitly: cite the row in the pitch's problem statement and mark the row `in-bet (<slug>)` at commit.
- When a `blocks-delivery` gap is open and the user proposes unrelated work, surface the trade-off once, concretely — what the gap costs *during this bet* (a missing system-test harness means delivery cannot prove its slices; a missing contract means design hand-derives the API surface) and what closing it buys every bet after. Propose absorbing it into the appetite or making it the bet. The user decides. If they decline, the row stays `open` — or moves to `accepted` if they say the gap is permanent — and is not raised again within this bet.
- Rows with status `accepted` are settled decisions. Do not re-propose them.

The roadmap is the steering mechanism, not a gate: a user who knowingly defers maturity work is exercising judgement, not failing a check.

## Context Inputs

Read the relevant `docs/` artifacts before opening the conversation:

- `docs/product-brief.md` — what the system is, who it serves, what it does not do.
- `docs/architecture.md` — service boundaries and capability decisions the bet must respect.
- `docs/design-system.md` — the design system and NFRs the bet must implement against.
- `docs/surfaces.md` — the surface registry and capability ledger, when the project has one. The bet's surface scope is chosen against this real registry, not from memory: which surfaces the capability reaches in this bet, which are deferred or omitted. The ledger's `planned` cells are commitments earlier bets already made — a `planned` cell this bet could deliver is candidate scope.

Arrive at the conversation already knowing what the system is and what the bet must fit inside. A discovery conversation that asks the user to re-explain the product is a discovery conversation that wastes the time it was meant to use.

**Surface scope degrades with the registry.** When `docs/surfaces.md` does not exist, the project has a single implicit surface: skip every surface-scope step in this workflow — the pitch carries no `surfaces:` frontmatter, the No-Gos carry no surface no-gos, and the conversation gains no surface questions. When the registry holds exactly one surface, scope is settled by inspection: write that one slug into `surfaces:` and ask nothing — there is no scope to choose.

## Instructions

### Setup

1. Ensure a directory exists for this bet at `docs/bets/<bet-slug>/`. Create it if it doesn't exist.
2. Read the `.agents/groundwork/skills/groundwork-bet/templates/pitch.md` template.

### Track Selection

Ask the user which discovery track fits their situation: thinking the problem through together — exploring the evidence, shaping the hypothesis, validating the approach before committing — or moving directly to capturing and executing an idea they already hold clearly.

- **Track 1 (Product-driven):** The user wants to explore and validate. Go through the Product-driven steps below.
- **Track 2 (Execution-focused):** The user has a clear idea. Go through the Execution-focused steps below.

Both tracks produce the same Pitch artifact and require the same review before committing. The difference is the front-end process.

---

### Track 1: Product-driven

Work through the following elements in sequence. Give each important question room to breathe — do not group questions that carry real trade-offs or downstream consequences. Converge toward a proposal once you have enough signal.

- **Problem:** Establish what problem users are experiencing and what evidence — usage data, support tickets, user feedback — shows it is real and worth solving.

  Push past symptoms to root causes. A problem like "users don't know about feature X" is a symptom; the problem might be "the first-run experience doesn't surface the workflow that leads users to feature X."

- **Hypothesis:** Pin down the outcome that would prove the problem solved, expressed as a falsifiable signal — a measurable result observable in user behaviour or system data.

  Reject vague signals ("users are happier") and abstract metrics ("engagement improves"). The signal must be specific enough that a no-answer is just as informative as a yes-answer.

- **Solution sketch:** Surface the high-level proposed approach, the alternatives considered and what makes this one the right choice, and the single biggest risk in the solution.

  Do not design the solution at this stage — that is Design Foundations. The sketch names the approach and its key assumption.

- **Appetite:** Establish how long the problem is worth, what scope fits inside that time boundary, and what scope must be cut to fit.

  Frame appetite as an opportunity-cost judgment, not an estimate. The scope adjusts to fit the appetite — the appetite does not stretch to fit the scope.

- **No-gos:** Name what this bet is explicitly not building — the natural extensions users would expect but that are out of scope, why each one is excluded, and where it belongs.

  Push past vague exclusions. "No mobile" is not a no-go; "No mobile push notifications — users expect these but they do not test the core in-app visibility hypothesis; separate bet" is.

Once all elements are captured, draft the Pitch. Weave in the success signal verbatim — it must appear explicitly in the Pitch, not be implied. Then continue to **Review and Commit** below.

---

### Track 2: Execution-focused

Capture the essential Pitch elements efficiently. The user knows what they want to build — your job is to ensure the Pitch is complete and internally consistent before it becomes the input to Design Foundations.

- **Problem and solution:** What the user wants to build, and what user problem it solves.

- **Success signal:** How they will know the bet delivered its intended value — a specific, measurable outcome.

- **Appetite:** How long it should take, what is in scope within that time, and what is explicitly out.

- **No-gos:** What is not being built — the natural extensions a user would expect that this bet explicitly excludes, with the reason each is excluded.

Before drafting, verify all elements are present and specific (falsifiable signal, no-gos with reasoning, appetite with scope boundary). Surface any gaps and fill them. Then continue to **Review and Commit** below.

---

### Surface scope (both tracks — multi-surface registries only)

When the registry holds two or more surfaces, the no-gos conversation includes surface scope: which registry surfaces does this bet deliver to, and for each surface it does not reach, is that a deferral (with intent) or an omission (with rationale)? Appetite is the natural frame — each additional surface costs a surface milestone, so reaching fewer surfaces is the same scope-cutting move as cutting a feature. The dispositions land in the pitch: in-scope slugs in the `surfaces:` frontmatter, the rest as surface no-gos. Validation writes the ledger from exactly these decisions, so a surface the conversation never decided becomes a cell the bet cannot close.

---

### Review and Commit (both tracks)

3. Write the drafted Pitch to `.groundwork/cache/bet-pitch-draft.md`. The pitch is not yet committed — the draft passes through an independent review before becoming `docs/bets/<bet-slug>/pitch.md`. The pitch becomes the input to every downstream design and decomposition conversation; a silently dropped capability or invented constraint poisons the entire delivery loop.

4. Run the independent review:
   1. **Announce** the shift — the agent is moving from collaborative pitch-shaping into an independent review before committing the document.
   2. **Invoke the review subagent** (Protocol 9) with `document_path: .groundwork/cache/bet-pitch-draft.md` and `document_type: bet-pitch`. The gate is fail-closed (Protocol 8): proceed only on a parseable `VERDICT: PRESENT`; a review that errors, hangs, or returns no verdict follows Protocol 9's failure path.
   3. **Revise loop.** If the verdict is **REVISE**, apply every 🔴 Critical finding directly to the draft — rewrite the affected sections rather than producing a list of suggestions. Write the revised draft back to `.groundwork/cache/bet-pitch-draft.md` and run the review again. The revise cap is a hard stop, not a target to push past: after 3 REVISE verdicts, stop, surface remaining 🔴 findings as 🟡 Advisory, and disclose that the review did not reach **PRESENT** (Protocol 8).
   4. **Carry advisory findings forward.** When the verdict is PRESENT, surface any 🟡 Advisory findings to the user along with the reviewed pitch so they can decide whether to act on them.

5. Present the reviewed pitch to the user. On explicit approval, promote `.groundwork/cache/bet-pitch-draft.md` to `docs/bets/<bet-slug>/pitch.md` by moving the file (the `move_file` tool, or `mv` via the shell) — do not read the draft and rewrite its contents.

6. Ensure the `pitch.md` frontmatter contains `status: discovery` — and, when the project has a surface registry, `surfaces:` listing the registry slugs this bet delivers to. Every registry surface outside that list appears under the No-Gos as a surface no-go, marked deferred or omitted. When no registry exists, the frontmatter carries no `surfaces:` key at all.

7. If the bet absorbed or became a maturity-roadmap gap, update the affected rows in `docs/maturity.md` to `in-bet (<bet-slug>)` and append a line to its `## History` section.

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
