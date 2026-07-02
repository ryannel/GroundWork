# Authoring an Engineer Skill (runtime standard)

This reference is how the forge writes an engineer skill that holds up. It distils the
two dev-time skills GroundWork builds with — `skill-writer` (how a skill should read) and
`skill-creator` (how a skill is tested before it is trusted) — into a standard you apply
inside a user's project, where neither of those skills is installed. Treat it as the bar:
a forged engineer skill that does not meet it is not finished.

## What you are building

An engineer skill is a **persistent implementation expert for one stack**, delivered into
the project at `.agents/skills/groundwork-<stack>-engineer/` so the team's agent loads it
on every relevant task. It is not documentation about the stack — it is the senior
engineer's judgement, written so an agent makes the calls a senior engineer would: where
code goes, what to never do, how to verify, which idiom is right and which is plausible
but wrong.

It mirrors the three engineer skills GroundWork ships (`groundwork-go-engineer`,
`groundwork-python-engineer`, `groundwork-nextjs-engineer`). Read the nearest one in the
project (or, if scaffolding has not run, the closest sibling you can find) as a worked
example before you write — match its shape, not its content.

## Pick the family

Engineer skills come in two shapes. Choose by what the engineer is wired into, then keep
that family's section order so a reader predicts the skill's internals.

| Family | Use for | Section spine |
|---|---|---|
| **Backend** | services, daemons, CLIs, anything gated by specs and sibling components | Operating Rules → Required First Checks → Context Routing → Skill Handoffs → Execution Checklist → Safety Gates → Quick Reference → Output Expectations |
| **Surface** | desktop, mobile, native UI, anything whose failure mode is plausible-but-wrong UI idiom | Operating Rules → Core Pillars → How to Use This Skill → Task Routing → Safety Gates → Hallucination Controls → Output Expectations → Antipatterns |

A native macOS AppKit app is **Surface**. A Rust HTTP service is **Backend**. A headless
sync daemon is **Backend**. When a target straddles both (a desktop app with a real local
backend), pick by the larger risk and fold the other family's concerns into a section.

## The anatomy

```
groundwork-<stack>-engineer/
├── SKILL.md          # the spine above; frontmatter name + a pushy description
└── references/       # 8–14 files, each a decision-time lens on one area
```

- **`SKILL.md`** carries the spine, kept tight — it routes to references, it does not inline
  them. Its body is paid once per task load, so it holds only what changes behaviour on most
  tasks in this stack; a fact needed for one decision belongs in `references/` instead. Its
  frontmatter `description` is the one part paid in *every* session — the only thing a router
  sees before deciding whether to load the skill at all. Write it as the trigger phrases an
  engineer would actually say, plus the boundary of what this skill is not for; never write it
  as a summary of the body — the router never opens the file to check.
- **`references/`** are written for that stack's decision points — its project layout, its
  error model, its concurrency/event model, its build/debug loop, its test harness, its
  idiomatic libraries, its packaging. Each file is a lens an engineer reaches for mid-task and
  is paid once per lookup: front-load the identifier, keep entries parallel, never narrate —
  it is a decision-time distillation, not a tutorial.
- **No `sync-anchor.md`.** The shipped engineer skills pin GroundWork's in-repo principle
  files by hash; a forged skill lives in a user project with no such source to pin, so it is
  **self-contained** — its references stand on their own. Do not fabricate a sync-anchor.

## How it must read (the house style)

These are the `skill-writer` rules, distilled for a skill an engineer *consults mid-task* —
not a conversation the engineer runs. That register matters: `SKILL.md` and `references/`
are a tight, cold-read contract, not a facilitation script — state the call, explain it in one
clause when the reason changes what the engineer does, and stop. Hold to these:

- **Write intent, not scripts.** Never quote phrases for the agent to repeat. "Verify the
  build is green before opening a slice," not a canned sentence to print.
- **Explain why in one clause, not an essay.** A constraint with its reason is adopted; one
  imposed is worked around — but the reason is a clause, not a paragraph. "Keep view state out
  of the model layer — it makes the model untestable and ties redraws to business logic," not
  "don't put state in the model," and not three sentences of justification either.
- **No hedging.** Drop "should," "typically," "you might want to." State the call or cut it.
- **Lead with the belief, not the rejection.** Say what the right idiom is and why, before
  what to avoid.
- **One idea per unit.** A sentence, bullet, or table row carries one idea — the reader should
  never have to decompress a dash-stapled run-on to find the actual rule.
- **Calibrate with examples, not adjectives.** Show a shallow handling next to the deep one.
  Agents match examples; they cannot match "be idiomatic."
- **Front-load the mental model.** Open the skill with the stack's shape — its core
  abstraction, its golden path — so every later rule lands against a frame.
- **Expert peer stance.** The skill proposes and explains; it does not bark orders. This
  governs tone, not length — the explanation is still the one clause above, not a case built
  for a reader who might push back, because there is no conversation here to push back in.

## Earn the skill before you trust it (the eval loop)

This is the `skill-creator` discipline, adapted for runtime: a skill you wrote and never
tested is a draft, not an expert. Before you accept a forged engineer skill, prove it.

1. **Draft** the SKILL.md and references against the family and the house style.
2. **Pose 2–3 realistic tasks** the skill will face — the first real bets for this stack
   (e.g. "add a window that lists records from the local store," "handle a failed network
   call without crashing the UI"). These are the test, kept small for speed; do not overfit
   the skill to them.
3. **Run each task against the skill** — actually reason through how an agent loaded with the
   skill would do it. Judge the output against two yardsticks: the **Day-2 baseline**
   (`docs/principles/delivery/day-2-operational-baseline.md` — config, errors, debugging,
   observability, shutdown, pure core, tests, `./dev`) and **stack idiom** (would a senior
   practitioner in this stack recognise it as right, not just compiling?).
4. **Find the gaps and generalise.** Where the skill let the task drift shallow or off-idiom,
   fix the skill — but fix the *general* rule, not the specific case, since the skill runs on
   tasks you did not test. Integrate the fix into the section that already owns the concern;
   do not append a new bullet or heading next to it. An appended fix is a queued fix, not a
   finished one — the next reader cannot tell which of two adjacent passages is current.
5. **Re-run and repeat** until the tasks come out senior-grade and the user agrees the skill
   reads like an expert. Then accept it.

## What "good" looks like

A forged engineer skill is done when:

- A reader who knows the stack would say "yes, that is how you build this here" — not "that is
  a reasonable summary."
- It names the **plausible-but-wrong** idioms specific to this stack (the traps a strong
  general model falls into) and rules them out with reasons.
- Its references cover the Day-2 baseline in this stack's idiom — including the build/run/debug
  loop and the test harness, the two affordances a seed lives or dies by.
- It is self-contained: nothing it needs lives only in your head or only in `docs/principles/`.
- It would still be right for the tenth bet, not just the first — the rules are general, the
  examples concrete.
