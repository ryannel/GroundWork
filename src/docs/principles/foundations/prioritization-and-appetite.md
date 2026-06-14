---
title: Prioritization & Appetite
description: Choosing and sequencing across the portfolio — appetite as opportunity-cost, the bet as the unit of commitment, and where scoring frameworks help and mislead.
status: active
last_reviewed: 2026-06-14
---
# Prioritization & Appetite

## TL;DR

Prioritization is the portfolio decision: of all the things worth doing, which do we commit to next, and how much is each worth? We fix an **appetite** — the amount of time and attention a problem deserves — and design the solution to fit it, rather than estimating a fixed solution and discovering the cost. The unit of commitment is the **bet**: a shaped, time-boxed wager on an opportunity, chosen by opportunity cost against everything else we could do instead. Scoring frameworks inform that judgement; they do not replace it.

## Why this matters

Two failure modes dominate how teams choose what to build. The first is estimate-driven planning: fix the scope, estimate the cost, watch the estimate balloon as the work expands to fill the time available, and ship late. The second is the prioritised backlog as decision-maker: a ranked list of features, scored by a formula, executed top-down with no fresh judgement about whether the top item is still the right bet. Both substitute mechanism for thinking. Appetite inverts the estimate so scope serves the budget; the bet keeps the unit of commitment small and reversible; opportunity-cost framing keeps the question "is this the best use of the next cycle?" alive instead of buried in a spreadsheet.

## Our principles

### 1. Appetite, not estimate

We set an appetite first — "this problem is worth about two weeks of one person's attention" — and then design the largest version of a good solution that fits inside it. This inverts the usual flow: instead of estimating the cost of a fixed solution, we fix the cost and negotiate the solution. The question becomes "what is the best outcome we can deliver in this budget?" rather than "how long will this take?" Appetite is a statement of how much the problem is worth, set before the solution exists to bias it.

### 2. The bet is the unit of commitment

We commit in **bets**: a shaped problem, a fixed appetite, a sketch of the solution, a success signal, and explicit no-gos. The bet is deliberately small and time-boxed so that a wrong call costs one cycle, not a quarter — and so that we re-decide frequently with fresh information rather than locking a long plan. Between bets we are free to change direction entirely; that freedom is the point. Big up-front roadmaps trade this optionality away for a false sense of certainty.

### 3. Prioritise the opportunity, then bound the solution

The first decision is *which opportunity* is most worth pursuing — by the size of the unmet need, how many target users feel it, and how well it serves the desired outcome. The second is how much appetite it earns. Separating these keeps the conversation honest: a large opportunity with a small appetite is a deliberate first slice; a small opportunity with a large appetite is a mistake the framing makes visible. Prioritising solutions directly skips the opportunity decision and smuggles the value question past review.

### 4. Opportunity cost is the real currency

Saying yes to a bet is saying no to everything else that cycle could have held. We judge each candidate against that alternative, not against an absolute bar — the question is never "is this worth doing?" (almost everything is) but "is this the *best* thing to do next?" Naming the opportunity cost out loud is what turns a backlog of good ideas into a sequence of defensible choices.

### 5. No-gos and the parking lot keep scope honest

A bet names what it is explicitly *not* building — the natural extensions a user would expect, each excluded for a stated reason and routed somewhere (a later bet, a permanent boundary, the parking lot). No-gos are how a fixed appetite stays fixed under pressure: the scope-cutting decision is made once, in the open, instead of relitigated every time the work gets hard. Parked ideas and prior sequencing instincts are inputs to the next prioritization, not commitments — appetite math that ignores them re-discovers decisions already made.

### 6. Scoring frameworks inform; they do not decide

Frameworks like RICE, weighted scoring, or opportunity scoring are useful for *structuring* a comparison — making the inputs explicit, exposing a wildly mis-ranked item, forcing a reach-vs-impact conversation. They mislead when their output is treated as the decision: the scores are estimates dressed as arithmetic, they flatten strategy into a single number, and they reward whatever is easy to quantify over whatever matters. We use them to inform judgement and surface disagreement, then decide with judgement. A roadmap that is the literal sort order of a scoring spreadsheet has outsourced the hardest product decision to a formula.

## How we apply this

- The opportunity a bet pursues comes from the [continuous-discovery](continuous-discovery.md) tree — prioritization chooses among its branches; appetite bounds the chosen one.
- Appetite is set against the [product risk](product-risks.md) a bet carries: a high-uncertainty bet earns a discovery spike before its delivery appetite is fixed, so we are not betting a large appetite on an untested assumption.
- Appetite and the bet are how [product engineering](product-engineering.md) schedules shaped work — this page is the portfolio view (choosing and sequencing bets); product engineering is the per-bet view (shaping one piece of work well).

## Anti-patterns we reject

- **Estimate-driven planning.** Fix the scope, estimate the cost, watch it balloon. Appetite exists because estimates anchor on effort, not on what the work is worth.
- **The backlog as autopilot.** A ranked list executed top-down with no fresh judgement about whether the top item is still the right bet.
- **Scoring-formula governance.** Treating a RICE or weighted-score sort as the decision rather than an input to it. The formula rewards the quantifiable, not the important.
- **Scope that expands to fill time.** No fixed appetite, so work grows until the deadline forces a messy cut nobody planned.
- **Ignoring the parking lot.** Re-deciding sequencing the user already settled because prior instincts and parked ideas were not carried into the prioritization.

## Further reading

- *Shape Up*, Ryan Singer — appetite, betting, and the fixed-time/variable-scope inversion.
- *Escaping the Build Trap*, Melissa Perri — why the feature-backlog-as-strategy fails and what replaces it.
- *Continuous Discovery Habits*, Teresa Torres — prioritising at the opportunity level rather than the solution level.
