---
title: Product Engineering
description: Engineering in service of user outcomes — shaped work, appetite-based planning, and the refusal to ship the wrong thing faster.
status: active
last_reviewed: 2026-05-26
---
# Product Engineering

## TL;DR

We are product engineers before we are coders. Our job is to move user outcomes — not to ship tickets. Work is shaped before it is scheduled, scheduled against a fixed appetite rather than an estimate, and measured by the change it makes in user behaviour rather than the volume of code it produces.

## Why this matters

The dominant failure mode of engineering teams in 2026 is not technical debt — it is building the wrong thing well. Feature factories optimise cycle time and output velocity and end up with a product surface that grows faster than the value it delivers. Product engineering is the discipline of resisting that. It says the unit of work is a user outcome, the unit of planning is an appetite, and the test of a PR is whether a real user can feel it.

## Our principles

### 1. Outcomes over outputs

An "output" is a feature shipped, a ticket closed, a migration completed. An "outcome" is a change in what a user can do, how quickly they can do it, or how reliably the system supports them. We plan around outcomes and let outputs be whatever shape is required to deliver them. A sprint ending with three closed tickets and no user-visible outcome is a sprint of failed work.

### 2. Shape work before scheduling it

No work enters a sprint without having been *shaped*: the problem stated in user terms, the rough solution sketched, the boundaries drawn to exclude rabbit holes. Shaped work is expensive upfront and cheap downstream. Unshaped work is the single biggest source of mid-sprint drift, scope creep, and late-breaking discovery that the whole approach was wrong.

### 3. Appetite, not estimate

We set an *appetite* — a statement of how much a problem is worth solving, judged by opportunity cost — and then design a solution that fits inside it. If it cannot fit, we either reduce scope or reject the work. This inverts the usual flow: instead of estimating the cost of a fixed solution, we fix the worth and negotiate the solution. It forces the team to ask "what is the best version of this we can deliver for what it is worth?" and it kills the tendency of work to expand to fill the time available. We denominate appetite in worth, not effort, and not by default in calendar time — AI compresses execution unpredictably, so a fixed "two weeks" now anchors on the axis that just got cheap and noisy. How big a bet is, separately, is its *stakes* — what is at risk if we are wrong; see [prioritization-and-appetite](prioritization-and-appetite.md).

### 4. Kill your darlings

If a feature is not moving an outcome, we remove it. Deletion is the most under-used tool in a product engineer's kit. Every line of code, every page of docs, every dashboard tile, every CLI flag that does not pay for its maintenance cost should be cut. A smaller, sharper product is cheaper to operate and easier for the next engineer to understand.

### 5. Instrument everything you ship

A feature that is not measured does not exist from a product engineering point of view. We decide the signal *before* we ship — event, dashboard, success criterion — and we check the signal after release. If we cannot measure it, we negotiate the feature until we can.

## The product discipline

This page is the spine of a wider product corpus — the discipline of moving outcomes, expanded into its working parts:

- [Continuous Discovery](continuous-discovery.md) — mapping the problem space as a weekly habit, before choosing a solution.
- [Product Risks](product-risks.md) — the four risks (value, usability, feasibility, viability) a bet must clear, and who owns each.
- [Success Metrics](success-metrics.md) — designing the measure of an outcome: North Star, leading indicators, counter-metrics.
- [Requirements & Specs](requirements-and-specs.md) — turning validated needs into testable, evidence-grounded statements.
- [Prioritization & Appetite](prioritization-and-appetite.md) — the portfolio view: choosing and sequencing bets by opportunity cost.
- [AI-Native Product](../ai-native/ai-native-product.md) — product practice for probabilistic systems: evals, the outcome envelope, the three cost layers.

## How we apply this

- [Progressive Delivery](../delivery/progressive-delivery.md) — canaries and flags are the mechanism by which we measure outcomes safely.
- [Observability](../quality/observability.md) — the signal layer that makes outcome-based engineering possible.
- [Decisions](../../decisions/) — the record of shaping decisions that cost us real time.

## Anti-patterns we reject

- **Velocity-as-KPI.** Story points per sprint measure nothing about user outcomes. Optimising for it corrupts the team.
- **Estimate-driven planning.** Estimates anchor on how long the team thinks work will take, not on how much the work is worth. We use appetites instead.
- **"Build it and they will come."** Launching a feature without a measurement plan is a signal that no one owns the outcome.
- **Technical-debt-for-its-own-sake projects.** Refactors without a user-visible payoff are a smell; wrap them inside an outcome that demands them.

## Further reading

- *Shape Up*, Ryan Singer — the canonical treatment of shaped work and fixed appetites.
- *Inspired*, Marty Cagan — the product-engineering triad and its implications for how teams are built.
- *Escaping the Build Trap*, Melissa Perri — why feature-factory metrics corrupt outcomes.
