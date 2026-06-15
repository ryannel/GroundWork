---
title: Prioritization & Appetite
description: Choosing and sizing across the portfolio — appetite as worth, stakes as the size that survives AI, and where scoring frameworks help and mislead.
status: active
last_reviewed: 2026-06-15
---
# Prioritization & Appetite

## TL;DR

Prioritization is the portfolio decision: of all the things worth doing, which do we commit to next, how much is each worth, and how much is at risk if we get it wrong? We size work on two axes that survive AI — **worth** (an *appetite*: how much the problem deserves, judged by opportunity cost) and **stakes** (blast radius × reversibility × the human review the work demands). The third historical axis, **effort/complexity**, is the one AI deflated: agents compress execution unpredictably, so estimating effort no longer sizes anything. The unit of commitment is the **bet**: a shaped wager carrying both an appetite and a stakes read. Scoring frameworks inform that judgement; they do not replace it.

## Why this matters

Work used to be sized on three axes that travelled together — how much it is worth, how much is at risk if it goes wrong, and how much effort it takes — and effort became the proxy for all three. Bigger estimate, bigger thing. AI broke that correlation. Agents compress *execution effort* dramatically and unpredictably: the boilerplate slog and the load-bearing change can now cost the same wall-clock, and neither is predictable up front. So the team that still sizes by effort — or by its cousin, complexity — is sizing by the axis that just got cheap and noisy.

Two axes survive, because they are bound by human judgement and consequence rather than by how fast the code gets written. **Worth** is what *appetite* has always measured — and appetite was never an estimate, so AI did not weaken it; if anything, when execution trends toward free, worth becomes the only thing left to argue about. **Stakes** is what is at risk if we are wrong, and a fast agent makes a wrong thing faster, not safer. Sizing by these two — and naming effort as the deflated axis it now is — is what keeps planning honest once the old proxy stops working.

## Our principles

### 1. Appetite, not estimate — worth, not effort

We set an **appetite** first — a statement of how much a problem is worth solving, fixed before the solution exists to bias it — and then design the largest version of a good solution that fits inside it. This inverts the usual flow: instead of estimating the cost of a fixed solution, we fix the worth and negotiate the solution. The question becomes "what is the best outcome we can deliver for what this is worth?" rather than "how long will this take?"

Appetite is denominated in **worth, judged by opportunity cost** — not in effort, and not by default in calendar time. "About two weeks of one person's attention" is one *optional* way to express an appetite, useful only where the binding constraint is genuinely human-coordination time (heavy review, cross-team work). It is a lens, not the unit: AI made calendar time an unstable proxy for worth, so leading with it re-imports the estimate we were trying to escape. If a solution cannot fit the appetite, cut scope or reject the work — never stretch the appetite to fit the solution.

### 2. Size is stakes, not effort

The size of a bet that matters is its **stakes**: how much is at risk if we get it wrong. Three things set it, and none of them shrink when the agent speeds up:

- **Blast radius** — how much surface the change touches, and how many users or systems feel it if it is wrong.
- **Reversibility** — how cheaply a wrong call can be undone. A one-way door is high-stakes at any size; a feature flag behind which we can iterate is low.
- **Review and judgement load** — how much a human must hold in their head to *vouch* for the work. This is the axis most specific to the AI-native shift: an agent can produce more correct-looking code than a human can actually verify, so the trust ceiling, not the typing speed, is the real bottleneck.

Stakes is what earns rigour — a high-stakes bet earns deeper discovery, tighter review, and a smaller validating increment, regardless of how little effort it takes to build. Effort and complexity are explicitly *not* the measure of size: they are the axis AI deflated, and a small-effort change to a payment path is high-stakes precisely where effort would have called it trivial. Worth says how much to invest; stakes says how carefully.

### 3. The bet is the unit of commitment

We commit in **bets**: a shaped problem, an appetite (its worth), a stakes read, a sketch of the solution, a success signal, and explicit no-gos. The bet is deliberately small and reversible so that a wrong call costs one cycle, not a quarter — and so that we re-decide frequently with fresh information rather than locking a long plan. Between bets we are free to change direction entirely; that freedom is the point. Big up-front roadmaps trade this optionality away for a false sense of certainty.

### 4. Prioritise the opportunity, then bound the solution

The first decision is *which opportunity* is most worth pursuing — by the size of the unmet need, how many target users feel it, and how well it serves the desired outcome. The second is how much appetite it earns. Separating these keeps the conversation honest: a large opportunity with a small appetite is a deliberate first slice; a small opportunity with a large appetite is a mistake the framing makes visible. Prioritising solutions directly skips the opportunity decision and smuggles the value question past review.

### 5. Opportunity cost is the real currency

Saying yes to a bet is saying no to everything else that cycle could have held. We judge each candidate against that alternative, not against an absolute bar — the question is never "is this worth doing?" (almost everything is) but "is this the *best* thing to do next?" Naming the opportunity cost out loud is what turns a backlog of good ideas into a sequence of defensible choices.

### 6. No-gos and the parking lot keep scope honest

A bet names what it is explicitly *not* building — the natural extensions a user would expect, each excluded for a stated reason and routed somewhere (a later bet, a permanent boundary, the parking lot). No-gos are how a fixed appetite stays fixed under pressure: the scope-cutting decision is made once, in the open, instead of relitigated every time the work gets hard. Parked ideas and prior sequencing instincts are inputs to the next prioritization, not commitments — appetite math that ignores them re-discovers decisions already made.

### 7. Scoring frameworks inform; they do not decide

Frameworks like RICE, weighted scoring, or opportunity scoring are useful for *structuring* a comparison — making the inputs explicit, exposing a wildly mis-ranked item, forcing a reach-vs-impact conversation. They mislead when their output is treated as the decision: the scores are estimates dressed as arithmetic, they flatten strategy into a single number, and they reward whatever is easy to quantify over whatever matters. We use them to inform judgement and surface disagreement, then decide with judgement. A roadmap that is the literal sort order of a scoring spreadsheet has outsourced the hardest product decision to a formula.

## How we apply this

- The opportunity a bet pursues comes from the [continuous-discovery](continuous-discovery.md) tree — prioritization chooses among its branches; appetite bounds the chosen one.
- Stakes set how much [product risk](product-risks.md) work a bet earns: a high-stakes bet earns a discovery spike before its appetite is fixed, so we are not betting worth on an untested assumption — and `product-risks.md` §6 ("low stakes earn a lighter pass") is the same axis, governing discovery depth.
- Appetite and the bet are how [product engineering](product-engineering.md) schedules shaped work — this page is the portfolio view (choosing and sizing bets); product engineering is the per-bet view (shaping one piece of work well).

## Anti-patterns we reject

- **Estimate-driven planning.** Fix the scope, estimate the cost, watch it balloon. Appetite exists because estimates anchor on effort, not on what the work is worth — and AI made effort the least stable thing to anchor on.
- **Sizing by complexity.** Treating "how hard is this to build" as the measure of how big a thing is. Complexity is the axis AI deflated; it now mis-sizes high-stakes/low-effort work as trivial and low-stakes/high-effort work as major.
- **The backlog as autopilot.** A ranked list executed top-down with no fresh judgement about whether the top item is still the right bet.
- **Scoring-formula governance.** Treating a RICE or weighted-score sort as the decision rather than an input to it. The formula rewards the quantifiable, not the important.
- **Scope that expands to fill time.** No fixed appetite, so work grows until the deadline forces a messy cut nobody planned.
- **Ignoring the parking lot.** Re-deciding sequencing the user already settled because prior instincts and parked ideas were not carried into the prioritization.

## Further reading

- *Shape Up*, Ryan Singer — appetite, betting, and the fixed-worth/variable-scope inversion (here re-denominated from time to worth, and paired with stakes).
- *Escaping the Build Trap*, Melissa Perri — why the feature-backlog-as-strategy fails and what replaces it.
- *Continuous Discovery Habits*, Teresa Torres — prioritising at the opportunity level rather than the solution level.
