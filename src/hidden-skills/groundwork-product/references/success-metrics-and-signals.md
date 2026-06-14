# Success Metrics and Signals

A feature that is not measured does not exist as an outcome. Design the measure before the thing — deciding *what* to measure and *what target* means success is the hard part; the dashboard is the easy part. When you advise, the success signal is part of the design, not a reporting afterthought.

## Decide the signal before you ship

Name the metric that will move, the direction, and the rough magnitude that would count as success — *before* the work starts. Deciding it upfront forces honesty about whether the feature has a theory of impact at all, and pre-commits a verdict so no result can be rationalised into a win after the fact. If you cannot name how you would measure it, the outcome is not yet understood well enough to build.

## A North Star, supported by inputs

Anchor on a single **North Star** that captures the core value delivered to users — the one number that, moving the right way sustainably, means the product is winning. Beneath it sit a handful of **input metrics**: leading indicators the team can actually influence week to week, which roll up into the North Star. One lighthouse, a few levers — not a wall of dashboards nobody acts on.

## Leading vs lagging

Lagging metrics (retention, revenue, churn) confirm whether value landed but report too late to steer by. Leading metrics (activation, first-week use of a key feature, time-to-value) move early and predict the lagging ones. Instrument both; act on the leading ones. A team that can only see lagging metrics is driving by the rear-view mirror. The skill is choosing leading indicators that genuinely *predict* the outcome rather than merely correlating with activity.

## Counter-metrics are as load-bearing as primaries

Every primary metric you optimise gets a **counter-metric** that guards against winning it the wrong way. Optimising time-on-task? Counter with task-completion, so you do not reward confusion. Optimising adoption? Counter with retention, so you do not reward a one-time spike. The counter-metric names the most likely way the primary gets gamed and makes that failure visible. A primary without a counter-metric is an invitation to optimise the product into a corner.

## Make the verdict falsifiable

A good signal is specific enough that a *no* is as informative as a *yes*. "Users are happier" cannot be falsified; "support tickets citing the confusion drop by at least half within 30 days" can. Reject vague sentiment and abstract aggregates ("engagement improves") in favour of a concrete user behaviour and a threshold. The test of a metric is whether a disappointing result would actually change the team's mind.

## Scale the rigour to the stakes

A load-bearing decision earns a North Star, instrumented inputs, and a pre-registered target. A small change earns a single observable signal and a glance after release. Demanding a full metric tree for every minor feature is as much a failure as shipping a major bet with no measure at all.

## Antipatterns to catch

- **Vanity metrics.** Totals that only go up — cumulative signups, total views — saying nothing about ongoing value.
- **Single-metric tyranny.** One number optimised without a counter, degrading the product along the axis nobody watches.
- **Output as outcome.** Counting features shipped or points burned as if delivery were the goal.
- **The retrospective metric.** Deciding how to measure only after launch, when any result can be spun.
- **The unfalsifiable goal.** "Improve the experience" with no behaviour, no threshold, no possible disconfirmation.

> The measurement *mechanism* — events, traces, dashboards, alerting — is the engineering layer, and you hand its implementation to the architect and engineer skills. You own *what* the signal is and *what bar* means success.
