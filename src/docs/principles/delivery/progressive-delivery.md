---
title: Progressive Delivery
description: Feature flags, canaries, trunk-based development, and deployment strategies that let us move fast without breaking things.
status: active
last_reviewed: 2026-05-26
---
# Progressive Delivery

## TL;DR

Progressive delivery is how we decouple the act of deploying code from the act of releasing a feature. We ship to production multiple times a day from a single branch, but users see changes only when we open a flag, route a canary, or promote a cohort. The production environment is stable; the user experience is controlled independently.

## Why this matters

The reason most teams avoid shipping often is that shipping carries risk — a bad deploy can break production for every user at once. Progressive delivery breaks the link. A deploy puts the code into production. A release makes the code reach users. With the two decoupled, deploys become small, frequent, and boring; releases become observable, controllable, and reversible. That asymmetry is how modern teams sustain a fast release cadence without a proportional rate of incidents.

## Our principles

### 1. Trunk-based development with short-lived branches

Every change lands on `main` as soon as it is ready. Branches measured in days, not weeks. Long-lived branches are how integration bugs accumulate quietly; trunk-based development surfaces them constantly, which makes them cheap to fix.

### 2. Deploy on every merge

Main is always deployable, and we deploy from it continuously. A merged PR reaches production within the deploy window — not hours or days later. This is enforced by automation; a team that relies on a human "release engineer" has already lost the bet on cadence.

### 3. Feature flags separate deploy from release

A new feature is deployed behind a flag, defaulted off. The flag state decides who sees the feature — nobody, internal users, a cohort, everyone. A bad feature is disabled without a redeploy; a controversial feature is rolled to 1% before 100%. Flags are a core primitive, not a third-party dependency.

### 4. Canary before promote

Every release that could affect latency, reliability, or user experience goes through a canary — a small fraction of traffic for a bounded window — before promoting. Canary signals (error rate, p99 latency, user journey success) are automated comparisons, not eyeballs on a dashboard.

### 5. Release is reversible, cheaply

Every release has a rollback path that can be executed in a few minutes by any on-call engineer. Database migrations are designed reversibly; flags can be flipped; canaries can be re-routed. "We can't roll that back" is a red flag on the release itself.

### 6. Flag hygiene is continuous

Flags are an asset and a debt. A long-lived flag that nobody remembers the purpose of is a drag on every future change. Every flag has an owner, a purpose, and an expiry date; stale flags are removed in the normal course of work.

### 7. Observability defines "healthy"

A release is healthy when the relevant user-journey SLOs are within tolerance ([Reliability](../quality/reliability.md)). Not when CPU is low, not when memory is steady — when users' journeys are succeeding at the rate they did before. The canary is evaluated against SLO burn rates.

### 8. The release story is the same for every service

One rollout model, one flag system, one canary pattern. Different services with different release mechanics multiply cognitive load and reduce the effectiveness of the on-call engineer. Consistency is a force multiplier.

## How we apply this

- [DevEx](devex.md) — the inner loop that feeds into continuous delivery.
- [Reliability](../quality/reliability.md) — the SLO surface that gates canary promotion.
- [Observability](../quality/observability.md) — the signal layer for release health.

## Anti-patterns we reject

- **Release trains.** Batching up a month of changes and shipping them on Friday is how you get a huge, unreviewable deploy that breaks in ways nobody can localise.
- **Flags without expiry.** A flag that has been "temporary" for a year is permanent — and a permanent decision hidden inside a runtime config.
- **Canary-by-eyeball.** Promoting because the graph "looks fine" is a coin flip. Automate the comparison.
- **"We will test it in staging."** Staging has no users. A canary in production is the only test of production behaviour.
- **Commit-and-hope.** No canary, no flag, deploy to 100%. You will find out in the morning.

## Further reading

- *Accelerate*, Forsgren, Humble, Kim — the data on trunk-based development and its outcomes.
- *Continuous Delivery*, Humble & Farley — the canonical treatment of the release pipeline.
- James Governor, *Progressive Delivery* (RedMonk, 2018) — the essay that named the practice.
- *The Release It! Second Edition*, Michael Nygard — the stability-pattern view of rollout.
