---
title: Prioritization & Appetite
description: Choosing and sizing across the portfolio — appetite as worth, stakes as the size that survives AI, and where scoring frameworks help and mislead.
status: active
last_reviewed: 2026-06-19
---
# Prioritization & Appetite

## TL;DR

Prioritization is the portfolio decision: of all the things worth doing, which do we commit to next, how much is each worth, and how much is at risk if we get it wrong? We size work on two axes that survive AI — **worth** (an *appetite*: how much the problem deserves, judged by opportunity cost) and **stakes** (blast radius × reversibility × the human review the work demands). The third historical axis, **effort/complexity**, is the one AI destabilized: agents change how long execution takes unpredictably — and distort our felt sense of it — so an effort estimate no longer sizes anything reliably. The unit of commitment is the **bet**: a shaped wager carrying both an appetite and a stakes read. Scoring frameworks inform that judgement; they do not replace it.

## Why this matters

Work used to be sized on three axes that travelled together — how much it is worth, how much is at risk if it goes wrong, and how much effort it takes — and effort became the proxy for all three. Bigger estimate, bigger thing. AI broke that correlation. Agents change *execution effort* unpredictably and in both directions: the boilerplate slog and the load-bearing change can now cost the same wall-clock, and which one an agent accelerates is rarely knowable up front. Worse, the signal can no longer be read from the inside — in a 2025 randomized trial, experienced open-source developers completed familiar tasks 19% *slower* with AI tooling while believing they had worked faster (METR). So the team that still sizes by effort — or by its cousin, complexity — is anchoring on the one axis that became both noisy and untrustworthy to the gut.

Two axes survive, because they are bound by human judgement and consequence rather than by how fast the code gets written. **Worth** is what *appetite* has always measured — and appetite was never an estimate, so AI did not weaken it; if anything, when the cost of execution becomes unreadable, worth becomes the most stable thing left to argue about. **Stakes** is what is at risk if we are wrong, and a fast agent makes a wrong thing faster, not safer. Sizing by these two — and naming effort as the deflated axis it now is — is what keeps planning honest once the old proxy stops working.

## Our principles

### 1. Appetite, not estimate — worth, not effort

We set an **appetite** first — a statement of how much a problem is worth solving, fixed before the solution exists to bias it — and then design the largest version of a good solution that fits inside it. This inverts the usual flow: instead of estimating the cost of a fixed solution, we fix the worth and negotiate the solution. The question becomes "what is the best outcome we can deliver for what this is worth?" rather than "how long will this take?"

Appetite is denominated in **worth, judged by opportunity cost** — not in effort. But worth is squishy, and an appetite that stays an abstraction never bites: scope creeps to fill "worth a lot." So worth must resolve to a *hard ceiling* — one fixed, unforgeable budget the work may not exceed without an explicit re-bet. The distinction that matters is **ceiling versus estimate**, not time versus worth: a budget you design *within* is a circuit breaker (this is exactly why Shape Up caps its appetites in time — time is unforgeable), while a budget *derived from* an effort estimate is the trap AI sprung. Convert worth into whatever the binding constraint actually is — a cycle count, a headcount, a spend, or calendar time where human coordination dominates (heavy review, cross-team work) — then let that ceiling, not the solution, win every argument. If a solution cannot fit the appetite, cut scope or reject the work — never stretch the appetite to fit the solution.

### 2. Size is stakes, not effort

The size of a bet that matters is its **stakes**: how much is at risk if we get it wrong. Three things set it, and none of them shrink when the agent speeds up:

- **Blast radius** — how much surface the change touches, and how many users or systems feel it if it is wrong.
- **Reversibility** — how cheaply a wrong call can be undone (Bezos's one-way versus two-way doors). A one-way door — a published API, a data migration, a pricing change — is high-stakes at any size; a feature flag behind which we can iterate is low, and the real cost there is treating it as if it were one-way and moving too slowly.
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

Frameworks like RICE, weighted scoring, or opportunity scoring are useful for *structuring* a comparison — making the inputs explicit, exposing a wildly mis-ranked item, forcing a reach-vs-impact conversation. They mislead when their output is treated as the decision: the scores are estimates dressed as arithmetic, they flatten strategy into a single number, and they reward whatever is easy to quantify over whatever matters. We use them to inform judgement and surface disagreement, then decide with judgement. The payoff is real where the inputs are real: many comparable candidates, a mature product with usage data to ground reach and impact, and stakes low enough that a mis-rank is cheap to correct. It inverts in early-stage or data-poor work, where reach and impact are guesses, and on a short slate of high-stakes bets, where ranking 1.7 against 1.3 lends false precision to a call that turns on judgement anyway. A roadmap that is the literal sort order of a scoring spreadsheet has outsourced the hardest product decision to a formula.

## How we apply this

- The opportunity a bet pursues comes from the [continuous-discovery](continuous-discovery.md) tree — prioritization chooses among its branches; appetite bounds the chosen one.
- Stakes set how much [product risk](product-risks.md) work a bet earns: a high-stakes bet earns a discovery proof of concept before its appetite is fixed, so we are not betting worth on an untested assumption — and `product-risks.md` §6 ("low stakes earn a lighter pass") is the same axis, governing discovery depth.
- Appetite and the bet are how [product engineering](product-engineering.md) schedules shaped work — this page is the portfolio view (choosing and sizing bets); product engineering is the per-bet view (shaping one piece of work well).

## Anti-patterns we reject

- **Estimate-driven planning.** Fix the scope, estimate the cost, watch it balloon. Appetite exists because estimates anchor on effort, not on what the work is worth — and AI made effort the least stable thing to anchor on.
- **Sizing by complexity.** Treating "how hard is this to build" as the measure of how big a thing is. Complexity is the axis AI destabilized; it now mis-sizes high-stakes/low-effort work as trivial and low-stakes/high-effort work as major.
- **The backlog as autopilot.** A ranked list executed top-down with no fresh judgement about whether the top item is still the right bet.
- **Scoring-formula governance.** Treating a RICE or weighted-score sort as the decision rather than an input to it. The formula rewards the quantifiable, not the important.
- **Scope that expands to fill time.** No fixed appetite, so work grows until the deadline forces a messy cut nobody planned.
- **Ignoring the parking lot.** Re-deciding sequencing the user already settled because prior instincts and parked ideas were not carried into the prioritization.

## Further reading

- *Shape Up*, Ryan Singer — appetite, betting, and the fixed-worth/variable-scope inversion (here re-denominated from time to worth, and paired with stakes).
- *Escaping the Build Trap*, Melissa Perri — why the feature-backlog-as-strategy fails and what replaces it.
- *Continuous Discovery Habits*, Teresa Torres — prioritising at the opportunity level rather than the solution level.
- *Amazon 1997 Letter to Shareholders*, Jeff Bezos — one-way vs. two-way door decisions: reserve heavyweight rigour for the irreversible.
- *Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity*, METR (2025) — the randomized trial behind the claim that the effort signal is now both noisy and badly mis-perceived.
