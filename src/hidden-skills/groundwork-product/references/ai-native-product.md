# AI-Native Product

Building product on top of a probabilistic model changes the job. Success is no longer a feature that behaves identically every time — it is an **outcome envelope** the model lands inside often enough, measured by evals the product team owns. When you advise on an AI feature, the model's behaviour is a measured, governed product surface, not a feature to ship and forget.

## Own the outcome envelope, not the exact output

Do not specify a single correct output — define the **envelope** of acceptable behaviour and the rate at which the model must land inside it. The spec shifts from "the system returns X" to "the system returns something satisfying these properties, at least this often, and fails safely the rest of the time." Designing that envelope — what good looks like, what unacceptable looks like, what the fallback is when the model misses — is the core product decision of an AI feature.

## Evals are a first-class product responsibility

The quality of an AI feature is whatever its **evals** measure, which makes eval design a product decision, not a hand-off. You own what "good" means: the dimensions that matter (task completion, correctness, tone, safety), the cases that must pass, the bar for shipping. Build evals from real usage — offline suites in CI, online measurement in production — and promote failed production cases into the eval set so the suite grows from reality. A team that cannot say how it measures its AI feature's quality has a demo, not a product. The engineering of the eval harness hands off to the engineer skills; the definition of quality stays with you.

## Track two success metrics, not one

An AI feature succeeds on two axes: the **product outcome** (did users get value — engagement, retention, task success) and the **model quality** (precision, recall, acceptable-response rate, latency). They diverge informatively: strong model scores with weak outcomes means solving the wrong problem well; strong outcomes with mediocre model scores means the feature tolerates imperfection better than feared. Watch both; each gets its own counter-metric.

## Price the three cost layers

AI work has a cost structure standard prioritization misses:

- **Development** — the one-time build, like any feature.
- **Inference at scale** — the per-call cost, paid on *every* use, forever. Cheap to build can be ruinous to run.
- **Retraining and maintenance** — the recurring cost of drift, data shift, and re-establishing the quality bar.

Set appetite for an AI bet against all three. A framework scoring only build effort will systematically greenlight the wrong AI work.

## Run product as a continuous decision loop

AI shortens the distance between a question and an answer — prototypes in hours, continuous experiments, real-time signal. Exploit it: reassess opportunities as signal arrives, prototype to learn rather than to ship, let the loop tighten decision latency. The same shortening makes continuous discovery cheaper and therefore more obligatory.

## Design for probabilistic experience and graceful failure

Because the model will sometimes be wrong, the experience is part of correctness, not polish. Design for the miss: visible uncertainty where it matters, easy correction and override, a safe fallback when confidence is low, and a human review point sized to the stakes of the action. A probabilistic feature whose UX assumes the model is always right fails loudly the first time it is wrong. Usability of that experience hands off to the designer; the *requirement* that it fail safely is yours.

## Judge by the system, not the demo

The test of an AI capability is not how striking a single output looks — it is whether it improves the product system: better evidence, faster learning, clearer trade-offs, fewer repeated explanations, stronger decisions. A demo that dazzles and degrades the system is a net loss disguised as innovation.

## Antipatterns to catch

- **Demo-driven product.** Shipping on an impressive prompt with no evals, no quality bar, no plan for the median case.
- **Ship-and-forget.** Never measuring quality again, so drift degrades the product invisibly.
- **Single-metric AI.** Watching engagement while ignoring model quality, or the reverse.
- **Build-cost-only pricing.** Greenlighting on build effort alone, then discovering inference at scale costs more than the feature earns.
- **Determinism cosplay.** Fixed pass/fail acceptance criteria for a probabilistic feature, or a UX that assumes the model is never wrong.
