---
title: Platform
description: Internal developer platforms, self-service tooling, and the treatment of the dev CLI as a product in its own right.
status: active
last_reviewed: 2026-05-26
---
# Platform

## TL;DR

The platform is the substrate every application team builds on: the local stack, the CI/CD pipeline, the observability collector, the secrets manager, the IDP that fronts all of it. We treat the platform as a product — it has users (us), a backlog, a quality bar, and explicit investment. A good platform makes the right thing the easy thing.

## Why this matters

Every team in a multi-service organisation eventually arrives at the same realisation: the biggest drag on productivity is not the code the team writes, but the accumulated friction of the common plumbing every project has to assemble. A platform that handles the plumbing well turns that friction into a paved road. A platform that does not becomes a tax every project pays repeatedly. The quality of the platform is a direct multiplier on the output of every engineer on top of it.

## Our principles

### 1. Platform is a product, with users and a roadmap

The people who build the platform have explicit users — the application engineers — and treat their work as a product: backlog, priorities, measurement, feedback. A platform maintained "when we have time" decays; a platform treated as product investment compounds.

### 2. Self-service is the goal

Every common task — spinning up a new service, requesting a secret, adding a dashboard, changing a feature flag — should be self-service. When an application team has to file a ticket and wait for the platform team, the platform is the bottleneck. Self-service is the acid test.

### 3. Golden paths over policy

We pave specific paths — how to create a service, how to deploy, how to observe — and we make those paths the easiest route. Policy documents without paved paths produce compliance in shape but drift in substance.

### 4. The dev CLI is the platform's front door

For local workflows, the dev CLI is the abstraction over every underlying tool: Docker, language runtimes, database clients, migration tools. The platform team maintains it; application teams use it without needing to know what is under it. See [DevEx](devex.md).

### 5. One paved-road CI pipeline

One pipeline definition for every service of the same type. Teams that deviate earn the cost of maintaining their own pipeline. This is how we prevent snowflake CI configurations from accumulating.

### 6. Observability is part of the platform

Traces, metrics, and logs flow through the same collector, into the same backend, onto the same dashboards. Observability set up by each team independently ([Observability](../quality/observability.md)) is observability broken in five different ways.

### 7. The platform gets the same scrutiny as the product

Platform code is reviewed, tested, versioned, and deployed the same way product code is. A broken platform release can hurt every team at once, so the bar is actually higher. "It is just tooling, ship it" is how a platform becomes an obstacle.

### 8. Measure what the users feel

Platform success is measured by the application teams' outcomes — DORA metrics, onboarding time, number of tickets filed against the platform. Not by the platform team's own output metrics, which can be excellent while the users are miserable.

## How we apply this

- [DevEx](devex.md) — the developer-facing experience the platform enables.
- [Observability](../quality/observability.md) — the centralised telemetry substrate.
- [Progressive Delivery](progressive-delivery.md) — the CI/CD pipeline as a platform service.

## Anti-patterns we reject

- **Platform-as-gatekeeper.** A platform that says "no" more than it says "self-serve" is a bottleneck, not a platform.
- **Five ways to do one thing.** Historical pipelines that nobody cleaned up. The platform should consolidate.
- **Tooling that only the platform team can use.** If the API requires insider knowledge, the tool is incomplete.
- **"Platform investment later."** The platform is either invested in or decaying; there is no steady state.
- **Metrics for the platform's sake.** Measuring "tickets closed by platform team" without measuring application-team outcomes misses the point.

## Further reading

- *Team Topologies*, Skelton & Pais — the canonical framing of platform teams and enabling teams.
- *Platform Engineering on Kubernetes*, Mauricio Salatino — the practical engineering view.
- *The DevOps Handbook*, Kim et al. — the broader cultural context the platform sits inside.
- *Backstage documentation* ([backstage.io](https://backstage.io)) — the archetype of an internal developer portal.
