---
title: Progressive Delivery
description: Feature flags, canaries, trunk-based development, and deployment strategies that let us move fast without breaking things.
status: active
last_reviewed: 2026-06-19
---
# Progressive Delivery

## TL;DR

Progressive delivery is how we decouple the act of deploying code from the act of releasing a feature. We ship to production multiple times a day from a single branch, but users see changes only when we open a flag, route a canary, or promote a cohort. The production environment is stable; the user experience is controlled independently.

## Why this matters

The reason most teams avoid shipping often is that shipping carries risk — a bad deploy can break production for every user at once. Progressive delivery breaks the link. A deploy puts the code into production. A release makes the code reach users. With the two decoupled, deploys become small, frequent, and boring; releases become observable, controllable, and reversible. That asymmetry is how modern teams sustain a fast release cadence without a proportional rate of incidents — the throughput-without-instability result that DORA has reproduced year over year.

## Our principles

### 1. Trunk-based development with short-lived branches

Every change lands on `main` as soon as it is ready. Branches measured in days, not weeks. Long-lived branches are how integration bugs accumulate quietly; trunk-based development surfaces them constantly, which makes them cheap to fix.

Trunk-based is a claim about integration frequency, not about the absence of branches. Committing directly to trunk and merging a one-day PR branch are both trunk-based; the line is integration within a day. The thing it rules out is the multi-week feature branch that diverges from `main` until the merge is its own project. If a change is too big to integrate in a day, it ships dark behind a flag (principle 3) — the branch stays short even when the feature is long.

### 2. Always deployable; deploy on every merge

`main` is always deployable, and we deploy from it continuously. A merged PR reaches production within the deploy window — not hours or days later. This is enforced by automation.

The non-negotiable is *continuous delivery*: `main` is always in a releasable state and the path to production is fully automated. *Continuous deployment* — an automatic production push on every merge — is the default we reach for, but it is not universal. The bottleneck worth killing is the human "release engineer" who manually assembles, blesses, and ships builds; that role is a cap on cadence and a single point of failure. A deliberate, push-button promotion gate is a different thing and is legitimate — for blast-radius control, regulatory sign-off, or business timing — provided the pipeline up to that gate is fully automated and the gate is a click, not a project. DORA's throughput result tracks small batches and end-to-end automation, not literally auto-deploying every commit.

### 3. Feature flags separate deploy from release

A new feature is deployed behind a flag, defaulted off. The flag state decides who sees the feature — nobody, internal users, a cohort, everyone. A bad feature is disabled without a redeploy; a controversial feature is rolled to 1% before 100%.

Flags are a first-class capability, not an afterthought — but "build vs buy" is a real choice, and the honest split is between the two halves of a flag system. Flag *evaluation* must be a local, in-process primitive: it evaluates against locally cached rules, returns in microseconds, adds no network hop to the request path, and fails safe to an explicit known-good default when the control plane is unreachable. That part we own and never put behind a synchronous network call. The flag *management plane* — targeting UI, audit log, rule distribution — is fair game for a vendor (LaunchDarkly, Unleash, Flagsmith) or an in-house service; it is not on the hot path and its outage must not take down evaluation. OpenFeature (principle 9) is what lets both be true: a standard evaluation API in the code, a swappable provider behind it.

### 4. Canary before promote

Every release that could affect latency, reliability, or user experience goes through a canary — a small fraction of traffic for a bounded window — before promoting. Canary signals (error rate, p99 latency, user journey success) are automated comparisons, not eyeballs on a dashboard.

Canary is not the universal rollout primitive, and treating it as one is a mistake. A canary needs enough traffic to produce a statistically meaningful comparison inside its window; a low-traffic service, a long-session or stateful workload, or a change whose blast radius is a single tenant cannot canary honestly — you promote on noise. Pick the mechanism by what you can actually observe and reverse:

- **High-volume stateless service, gradual blast radius** → canary with automated analysis against SLOs.
- **Low traffic, or you need instant whole-population rollback** → blue-green; cut over and cut back in one move.
- **Per-user or per-cohort exposure, kill-switch granularity, experimentation** → feature flag.

These compose rather than compete: deploy the binary via canary or blue-green, then gate the user-visible feature behind a flag. The deployment strategy controls which code runs; the flag controls who sees it.

### 5. Release is reversible, cheaply

Every release has a rollback path that can be executed in a few minutes by any on-call engineer. Flags can be flipped; canaries can be re-routed; blue-green can be cut back. "We can't roll that back" is a red flag on the release itself.

The hard case is schema. A migration that drops or renames in place is a one-way door — the old code can no longer read the database the instant it lands, so the deploy and the rollback are coupled and neither is safe. We use expand/contract (parallel change): first expand — add the new column or table and write to both shapes while reading the old; deploy and bake; then migrate readers; only after the new shape is proven do we contract and remove the old. Each step is independently deployable and independently reversible, so a rollback is never blocked on a schema state that no running version understands.

### 6. Flag hygiene is continuous

Flags are an asset and a debt. A long-lived flag that nobody remembers the purpose of is a drag on every future change, and a stale flag with live targeting rules is a latent incident — dead code paths that can still be switched on. Every flag has an owner, a purpose, and an expiry date; release flags are removed in the normal course of work once fully rolled out. Distinguish the lifetimes: a *release* flag is born to die at 100%, while an *operational* kill-switch or a long-running *experiment/permission* flag is meant to persist — give it a different label and review cadence rather than letting it masquerade as temporary forever.

### 7. Observability defines "healthy"

A release is healthy when the relevant user-journey SLOs are within tolerance ([Reliability](../quality/reliability.md)). Not when CPU is low, not when memory is steady — when users' journeys are succeeding at the rate they did before. The canary is evaluated against SLO burn rates, with a window long enough to clear startup and warm-cache noise before the verdict.

### 8. The release story is the same for every service

One rollout model, one flag system, one canary pattern. Different services with different release mechanics multiply cognitive load and reduce the effectiveness of the on-call engineer. Consistency is a force multiplier — the rollout and rollback steps should be muscle memory regardless of which service paged.

### 9. Standard flags, GitOps-driven rollout

Feature flags use the vendor-neutral **OpenFeature** standard (a CNCF incubating project) so the management plane stays swappable behind a stable evaluation API. The progressive-delivery engine follows the GitOps tool and owns traffic weighting and automated canary analysis: **Argo Rollouts** in an ArgoCD shop, **Flagger** in a Flux shop. Both are CNCF projects and production-viable; the lean is Argo Rollouts when you want explicit, step-based control with approval gates between stages, and Flagger when you want hands-off, metric-driven promotion with minimal manifest change. Either way the rollout machinery is declarative and lives in the repository, not in a console someone clicks.

### 10. The bet contract's front-door proof is a stronger gate than a flag

This page teaches the general technique: ship dark behind a flag, then release deliberately. GroundWork's bet delivery contract asks for more than that — a milestone closes only once a slice has been proven by driving the real product through its real front door for a named consumer, so a trunk merge requires no feature flag to be safe; the proof *is* the release gate. Flags stay available as a team-optional tool *inside* that guarantee — reach for one for staged exposure, a kill switch, or cohort rollout — but the bet contract does not depend on them the way general progressive-delivery practice does.

## How we apply this

- [DevEx](devex.md) — the inner loop that feeds into continuous delivery.
- [Reliability](../quality/reliability.md) — the SLO surface that gates canary promotion.
- [Observability](../quality/observability.md) — the signal layer for release health.

## Anti-patterns we reject

- **Release trains.** Batching up a month of changes and shipping them on Friday is how you get a huge, unreviewable deploy that breaks in ways nobody can localise.
- **Flags without expiry.** A flag that has been "temporary" for a year is permanent — and a permanent decision hidden inside a runtime config.
- **Canary-by-eyeball.** Promoting because the graph "looks fine" is a coin flip. Automate the comparison — and on a low-traffic service, don't pretend a canary means anything; use blue-green or a flag cohort instead.
- **"We will test it in staging."** Staging has no users. A canary in production is the only test of production behaviour.
- **Flag evaluation on the network hot path.** A flag check that makes a synchronous call to a vendor — and blocks or errors the request when that vendor blips — has turned a release tool into an availability dependency. Evaluate locally, fail safe to a default.
- **Commit-and-hope.** No canary, no flag, deploy to 100%. You will find out in the morning.

## Further reading

- *Accelerate*, Forsgren, Humble, Kim — the data on trunk-based development and its outcomes.
- *Continuous Delivery*, Humble & Farley — the canonical treatment of the release pipeline.
- James Governor, *Progressive Delivery* (RedMonk, 2018) — the essay that named the practice.
- *Release It!*, Second Edition, Michael Nygard — the stability-pattern view of rollout.
- *DORA / State of DevOps* reports — the ongoing evidence base for delivery throughput and stability moving together.
