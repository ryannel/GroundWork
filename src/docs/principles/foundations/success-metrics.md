---
title: Success Metrics
description: Designing the measure of an outcome — North Star and inputs, leading vs lagging, counter-metrics, and deciding the signal before you ship.
status: active
last_reviewed: 2026-06-19
---
# Success Metrics

## TL;DR

A feature that is not measured does not exist as an outcome. We design the measure before we build the thing: a small number of metrics that represent real user value, paired with the counter-metrics that stop us from gaming them, and chosen so a *no* answer is as informative as a *yes*. Metric design is a product skill distinct from the telemetry that implements it — deciding *what* to measure and *what target* means success is the hard part; the dashboard is the easy part.

## Why this matters

Teams measure what is easy to count and then optimise their way into the wrong product. Signups, page views, story points shipped — vanity and output metrics feel like progress while the actual outcome stagnates or regresses. Worse, a single metric pursued without a counterbalance reliably produces a degraded product: optimise engagement and you get dark patterns; optimise speed and you get a product that does the wrong thing faster. Designing the measure well — before launch, with the counter-metrics in place — is what turns "we shipped it" into "we know whether it worked." The measure is part of the design, not a reporting afterthought.

## Our principles

### 1. Decide the signal before you ship

The success signal is a design decision made *before* the work starts, not a question asked after launch. Before building, we name the metric that will move, the direction, and the rough magnitude that would count as success. Deciding it upfront does two things: it forces honesty about whether the feature has a theory of impact at all, and it pre-commits us to a verdict so we cannot rationalise any result as a win after the fact. If we cannot name how we would measure it, we do not yet understand the outcome well enough to build it.

### 2. A North Star, supported by inputs

We anchor on a **North Star** that captures the core value the product delivers to *users* — the one number that, if it moves the right way sustainably, means the product is winning. It must be a value metric, not an activity or revenue proxy. Engagement North Stars (sessions, time-on-site) optimise for the product's interest over the user's and decay into dark patterns; revenue North Stars measure extraction, not value delivered, and can climb while the product rots. Beneath the North Star sit a handful of **input metrics**: the leading indicators a team can actually move week to week, whose causal link to the North Star is earned by trial and error, not assumed. Amazon's *Working Backwards* calls these *controllable input metrics* and steers by them precisely because output metrics like revenue report too late and too diffusely to act on.

The single North Star is genuinely contested, and the objection is fair: one number cannot represent a two-sided marketplace, a multi-product portfolio, or segments with materially different value. Forced onto those, a single metric either flattens real trade-offs or hums along green while the business bleeds — the North Star is never a substitute for business viability. The answer is not a wall of dashboards. **Decision rule:** a focused product with one dominant value loop gets one North Star. A marketplace, platform, or portfolio gets a North Star *strategy* — a one-sentence statement of the value being created — plus a small constellation (roughly one metric per side or segment) that together evidence it. Either way the count stays small and every metric is acted on. One lighthouse's worth of focus, a few levers — not literally one number when the product has two sides.

### 3. Distinguish leading from lagging

Lagging metrics (retention, revenue, churn) confirm whether value landed but report too late to steer by. Leading metrics (activation, first-week usage of a key feature, time-to-value) move early and predict the lagging ones. We instrument both and act on the leading ones — a team that can only see lagging metrics is driving by the rear-view mirror. The skill is choosing leading indicators that genuinely predict the outcome rather than merely correlating with activity.

### 4. Counter-metrics are as load-bearing as primaries

Every primary metric we optimise gets a **counter-metric** that guards against winning it the wrong way. This is Goodhart's Law made operational: when a measure becomes a target it ceases to be a good measure, because people optimise the number rather than the value behind it — and the more weight the metric carries, the harder it gets gamed (Campbell's Law). Optimising for time-on-task? Counter with task-completion, so we do not reward confusion. Optimising for adoption? Counter with retention, so we do not reward a one-time spike. The counter-metric — what the experimentation world calls a *guardrail* — names the most likely way the primary gets gamed and makes that failure visible. A primary metric without a counter-metric is an invitation to optimise the product into a corner.

### 5. The metric must produce a falsifiable verdict

A good success metric is specific enough that a *no* is as informative as a *yes*. "Users are happier" cannot be falsified; "support tickets citing the confusion drop by at least half within 30 days" can. We reject vague sentiment and abstract aggregates ("engagement improves") in favour of signals tied to a concrete user behaviour and a threshold. The test of a metric is whether a disappointing result would actually change our minds.

### 6. Match the rigour to the stakes

Metric design scales with the bet. A load-bearing product decision earns a North Star, instrumented inputs, and a pre-registered target. A small change earns a single observable signal and a glance after release. Demanding a full metric tree for every minor feature is as much a failure as shipping a major bet with no measure at all — the discipline is proportion.

## How we apply this

- The success signal a metric defines is the falsifiable outcome a bet's hypothesis commits to — the same signal named in [continuous discovery](continuous-discovery.md) and carried verbatim into the pitch.
- Metrics are the measure of [product engineering's](product-engineering.md) "instrument everything you ship" — this page is the *design* of the signal; [observability](../quality/observability.md) is the telemetry layer that *captures* it.
- For AI features, product metrics pair with model-quality metrics — see [AI-native product](../ai-native/ai-native-product.md) for the dual-metric discipline.

## Anti-patterns we reject

- **Vanity metrics.** Totals that only ever go up — cumulative signups, total page views — and say nothing about whether the product delivers ongoing value.
- **Single-metric tyranny.** One number optimised without a counter-metric, which reliably degrades the product along the axis nobody is watching.
- **Output as outcome.** Counting features shipped or story points burned as if delivery were the goal. Output is the cost, not the result.
- **The retrospective metric.** Deciding how to measure success only after launch, when any result can be spun into a win.
- **The unfalsifiable goal.** "Improve the experience" with no behaviour, no threshold, and therefore no possible disconfirmation.

## Further reading

- *Escaping the Build Trap*, Melissa Perri — why output metrics corrupt product teams and how outcome metrics fix it.
- *Lean Analytics*, Croll & Yoskovitz — the One Metric That Matters and choosing it by stage.
- Amplitude's *North Star Playbook* — the North Star and its input metrics as an operating model.
- *Working Backwards*, Colin Bryar & Bill Carr — controllable input metrics vs. output metrics, Amazon's operating model for steering by leading indicators.
- Goodhart's Law (Charles Goodhart) and Campbell's Law (Donald Campbell) — the foundations of why a measure-as-target gets gamed, and why counter-metrics are non-optional.
- Ravi Mehta, *Your product team doesn't need a North Star Metric* — the case for a North Star strategy over a single number when one metric cannot capture the value.
