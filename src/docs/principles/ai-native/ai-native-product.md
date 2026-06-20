---
title: AI-Native Product
description: Product management for probabilistic systems — the continuous decision loop, evals as a product responsibility, dual success metrics, and the three AI cost layers.
status: active
last_reviewed: 2026-06-19
---
# AI-Native Product

## TL;DR

Building product on top of a probabilistic model changes the job. Success is no longer a feature that works the same way every time — it is an **outcome envelope** the model lands inside often enough, measured by **evals** the product team owns. We run product as a continuous decision loop fed by live signals rather than a staged lifecycle, we track **two** success metrics (product outcome *and* model quality), and we price work across **three cost layers** standard prioritization misses. AI capability is a product to be evaluated and steered, not a feature to be shipped and forgotten.

## Why this matters

A deterministic feature has a binary definition of done: it meets its spec or it does not. An AI feature does not — the same input can produce a good answer today and a poor one tomorrow, and "good" is a judgement across tone, relevance, and accuracy rather than a pass/fail. Product practice built for deterministic software breaks here in specific ways: acceptance criteria cannot be written as fixed assertions, a one-time launch metric misses the model drifting under you, and a prioritization framework that ignores inference and maintenance cost will greenlight a feature that is ruinous at scale. The teams shipping good AI product are not the ones with the most impressive demo — they are the ones who treat the model's behaviour as a measured, governed, continuously-steered product surface.

## Our principles

### 1. Own the outcome envelope, not the exact output

For a probabilistic feature, product does not specify a single correct output — it defines the **envelope** of acceptable behaviour and the rate at which the model must land inside it. The spec shifts from "the system returns X" to "the system returns something that satisfies these properties, at least this often, and fails safely the rest of the time." Designing the envelope — what good looks like, what unacceptable looks like, what the fallback is when the model misses — is the core product decision of an AI feature.

### 2. Evals are a first-class product responsibility — and only as honest as their calibration

The quality of an AI feature is whatever its **evals** measure — which is exactly why a careless eval is dangerous: it reports a confident number while measuring the wrong thing. Product owns what "good" means: the dimensions that matter (task completion, correctness, tone, safety), the cases that must pass, and the bar for shipping.

Build the suite from reality, not from intuition. Start with **error analysis** — read actual production traces, label the failures, and cluster them *before* writing a single automated check. Teams that skip straight to dashboards and LLM judges end up scoring noise. Then layer the measurement to the stakes of the decision: cheap deterministic checks for coverage, an **LLM-as-judge** for screening the fuzzy dimensions, and human review where correctness is load-bearing.

Treat the judge itself as a measurement instrument that must be validated, not as ground truth. LLM judges carry documented biases — verbosity, position, and self-preference among them — and agreement with a small human-labeled set is a point estimate, not a guarantee that the judge holds up on the inputs you have not seen. Decision rule: align the judge against human labels on a held-out sample, re-validate it whenever you change the rubric or swap the underlying model, and **promote failed production cases into the suite** so it grows from where the product actually breaks. A team that cannot say how it measures its AI feature's quality has a demo, not a product — and a team that trusts an unvalidated judge has a demo wearing a dashboard.

### 3. Track two success metrics, not one

An AI feature succeeds on two axes at once and we instrument both: the **product outcome** (did users get value — engagement, retention, task success) and the **model quality** (precision, recall, acceptable-response rate, latency). These two headline axes sit on top of distinct layers that can each pass or fail independently — the model, the system that serves it (latency, cost, reliability), the product experience, and the business result — so when the headline numbers diverge, locate which layer the divergence lives in before reacting. Strong model scores with weak product outcomes means we are solving the wrong problem well; strong product outcomes with mediocre model scores means the feature tolerates imperfection better than we feared and we should stop over-investing in raw model quality. Watching only one axis hides the other's story. This is the [success-metrics](../foundations/success-metrics.md) discipline extended: the model quality metric is itself instrumented, with its own counter-metrics.

### 4. Price the three cost layers — including the ones that recur

AI work has a cost structure standard feature prioritization does not model, and ignoring it ships features that are unaffordable at scale:

- **Development** — the one-time build, as with any feature.
- **Inference at scale** — the per-call cost of running the model, paid on *every* use, forever. Do not anchor on today's token price: per-token cost has fallen roughly an order of magnitude a year, but agentic and reasoning workflows consume several times — sometimes orders of magnitude — more tokens per task, so total spend can climb even as unit prices collapse. Model token *volume* under realistic usage and reasoning depth, not the sticker price of a single call.
- **Adaptation and maintenance** — the recurring cost of keeping quality up as the world moves. In the foundation-model era this is rarely literal retraining: it is model-version churn (providers deprecate and silently re-tune the model under you), prompt and context upkeep, eval maintenance, and the escalation ladder when prompting stops being enough. Decision rule: start with prompting, escalate to retrieval when the gap is missing facts, and reach for fine-tuning only when behaviour must change and the volume justifies it — each rung up adds standing cost, and fine-tuning can multiply inference cost several-fold.

[Appetite](../foundations/prioritization-and-appetite.md) for an AI bet must account for all three; a framework that scores only build effort will systematically greenlight the wrong AI work.

### 5. Run product as a continuous decision loop

AI shortens the distance between a question and an answer — prototypes are hours not weeks, experiments run continuously, and signals from analytics, support, and behaviour arrive in real time. We exploit this by running product as a continuously-running decision system rather than a staged plan: reassess opportunities as signal arrives, prototype to learn rather than to ship, and let the loop tighten decision latency. Hold the line between building to learn and building to earn — a prototype that proves a point is not a feature, and the cheapness of generating one makes it dangerously easy to let a throwaway leak into production unmeasured. The same shortening makes [continuous discovery](../foundations/continuous-discovery.md) cheaper and therefore more obligatory.

### 6. Design for probabilistic experience and graceful failure

Because the model will sometimes be wrong, the experience is part of the product's correctness, not a polish layer. We design for the miss: visible uncertainty where it matters, easy correction and override, a safe fallback when confidence is low, and a [human review point](../system-design/identity-and-access.md) sized to the stakes of the action. Match friction to consequence — confirmations and checkpoints for high-stakes or irreversible actions, near-zero friction for cheap, reversible ones. Be deliberate about surfacing a confidence number: a model's self-reported confidence is usually poorly calibrated, and a precise-looking "87%" the model cannot back up erodes trust faster than honest hedging. Decision rule: show a numeric confidence only when it is calibrated against ground truth; otherwise express uncertainty by offering alternatives and making correction trivial. A probabilistic feature with a UX that assumes the model is always right is a feature that fails loudly the first time it is wrong.

### 7. Use AI to improve the product system, not to impress

The test of an AI capability is not how striking a single output looks — it is whether it improves the product system: better evidence, faster learning, clearer trade-offs, fewer repeated explanations, stronger decisions. We judge AI features by their effect on the loop, not by the wow of a cherry-picked prompt. A demo that dazzles and degrades the product system is a net loss disguised as innovation.

## How we apply this

- The eval suite is to an AI feature what [observability](../quality/observability.md) is to a service — the measurement substrate that makes steering possible — and shares the [agentic-systems](agentic-systems.md) discipline of tracing and scoring every run.
- Model quality, safety, and the human review point connect to [agent-native systems](agent-native-systems.md) and [AI engineering](ai-engineering.md) on the implementation side; product owns *what* to measure and *what bar* to hold, engineering owns *how*.
- The outcome envelope and dual metrics are [success-metrics](../foundations/success-metrics.md) applied to a non-deterministic core; the three cost layers extend [prioritization and appetite](../foundations/prioritization-and-appetite.md).

## Anti-patterns we reject

- **Demo-driven product.** Shipping on the strength of an impressive prompt, with no evals, no quality bar, and no plan for the median case.
- **Eval theater.** Trusting an LLM judge that was never validated against human labels, or a suite that grades style while the real failures go uncounted — confident numbers measuring the wrong thing.
- **Ship-and-forget.** Launching an AI feature and never measuring its quality again, so model drift degrades the product invisibly.
- **Single-metric AI.** Watching product engagement while ignoring model quality, or the reverse — missing the half of the story that explains the other.
- **Build-cost-only pricing.** Greenlighting an AI feature on build effort alone, then discovering inference at scale, version churn, or fine-tuning upkeep costs more than the feature earns.
- **Determinism cosplay.** Writing fixed pass/fail acceptance criteria for a probabilistic feature, designing a UX that assumes the model is never wrong, or showing a confidence score the model cannot actually back up.

## Further reading

- *AI Evals for Engineers & PMs* (Hamel Husain & Shreya Shankar) — error analysis, LLM-as-judge, and building eval suites as a product discipline.
- *Building effective agents* and *Effective context engineering*, Anthropic — the engineering substrate product steers.
- *AI Product Management* and *Product Discovery: build to learn vs. build to earn* (Marty Cagan / SVPG) — product judgement over probabilistic systems.
