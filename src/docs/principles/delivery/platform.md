---
title: Platform
description: Internal developer platforms, self-service tooling, and the treatment of the dev CLI as a product in its own right.
status: active
last_reviewed: 2026-06-19
---
# Platform

## TL;DR

The platform is the substrate every application team builds on: the local stack, the CI/CD pipeline, the observability collector, the secrets manager, the IDP that fronts all of it. We treat the platform as a product — it has users (us), a backlog, a quality bar, and explicit investment. A good platform makes the right thing the easy thing. But product thinking cuts both ways: a platform with no market is overhead, and self-service that exposes every knob just relocates the pain. Pave the common path, leave the escape hatch open, and measure what developers actually feel.

## Why this matters

Every team in a multi-service organisation eventually arrives at the same realisation: the biggest drag on productivity is not the code the team writes, but the accumulated friction of the common plumbing every project has to assemble. A platform that handles the plumbing well turns that friction into a paved road. A platform that does not becomes a tax every project pays repeatedly. The quality of the platform is a direct multiplier on the output of every engineer on top of it — which also means a *premature* or *over-built* platform multiplies overhead just as efficiently.

## Our principles

### 1. Platform is a product — and you can build it too early

The people who build the platform have explicit users — the application engineers — and treat their work as a product: backlog, priorities, measurement, feedback. A platform maintained "when we have time" decays; a platform treated as product investment compounds.

The contested zone is *when*. The most expensive platform mistake is not under-investment — it is investing before the pain is real. A platform team stood up for two services is a cost centre with no one to amortise it against. Product thinking demands a market: if the "market" of internal teams is two engineers, you do not have a platform, you have speculative generality. The rule of three applies here as it does to abstractions — pave a path once the same plumbing pain recurs across multiple teams, not in anticipation of it.

Start with the **thinnest viable platform** (Skelton & Pais): the smallest set of tools, docs, and defaults that *measurably* accelerates the teams on top of it, and nothing more. Grow it from demonstrated friction, not from a roadmap of features no one has asked for.

### 2. Self-service — encapsulate the decision, do not expose the knobs

Every common task — spinning up a new service, requesting a secret, adding a dashboard, changing a feature flag — should be self-service. When an application team has to file a ticket and wait, the platform is the bottleneck. That much is settled.

The subtlety is *what* you serve. Self-service that exposes every underlying knob does not remove cognitive load — it relocates it from a ticket queue onto the developer, who now must understand Kubernetes, Terraform, and IAM to ship a service. That is the platform labyrinth. The opposite failure is the golden cage: full orchestration that handles everything until the one case it does not, with no way out.

The decision rule: self-service should **encapsulate the decision** — sane defaults, the 90% path one command away — *and* **provide an escape hatch** to the underlying tool for the cases the abstraction does not fit. Self-serve the common path; offer expert assist, not a ticket, for the rare and complex. The acid test is whether shipping the normal case requires understanding the substrate. It should not.

### 3. Golden paths over policy — paved road, not paved cage

We pave specific paths — how to create a service, how to deploy, how to observe — and we make those paths the easiest route. Policy documents without paved paths produce compliance in shape but drift in substance.

A golden path is optional with a visible cost, never mandatory. A path that is *enforced* is just policy with better tooling, and it rots the moment a legitimate case does not fit it. Pave the common route, make it the obvious default, and leave the off-ramp open — teams that take it carry the maintenance cost themselves (see principle 5). Optimise the path for the 80%; give the 20% a documented way to extend or override a part of it without abandoning the whole.

### 4. The dev CLI is the platform's front door

For local workflows, the dev CLI is the abstraction over every underlying tool: Docker, language runtimes, database clients, migration tools. The platform team maintains it; application teams use it without needing to know what is under it. The CLI must *wrap*, not *hide* — `dev db ...` for the 90%, with raw `psql` still available when the abstraction is in the way. See [DevEx](devex.md).

### 5. One paved-road CI pipeline

One pipeline definition for every service of the same type. Teams that deviate earn the cost of maintaining their own pipeline. This is how we prevent snowflake CI configurations from accumulating.

### 6. Observability is part of the platform

Traces, metrics, and logs flow through the same collector, into the same backend, onto the same dashboards. Observability set up by each team independently ([Observability](../quality/observability.md)) is observability broken in five different ways.

### 7. The platform gets the same scrutiny as the product

Platform code is reviewed, tested, versioned, and deployed the same way product code is. A broken platform release can hurt every team at once, so the bar is actually higher. "It is just tooling, ship it" is how a platform becomes an obstacle.

### 8. Measure what the users feel — and know what your metrics cannot tell you

Platform success is measured by the application teams' outcomes, not by the platform team's own output metrics, which can look excellent while the users are miserable. But the standard yardsticks have known blind spots, and using them naively is its own failure.

DORA's four keys measure **software-delivery performance**, not productivity and not platform value — Nicole Forsgren, who created them, says this directly. So pair delivery metrics with developer-experience signal: periodic perception surveys (the SPACE framework, or DX Core 4, which folds DORA, SPACE, and DevEx into counterbalanced dimensions), time-to-first-meaningful-PR for onboarding, and tickets filed against the platform as a friction proxy.

Two traps to name explicitly. **Vanity adoption** — logins, registered services, command invocations — inflates the moment adoption is mandated and tells you nothing about value. **Gamed output** — diffs or PRs per engineer — rewards quantity over outcome. The honest signal is counterfactual: would teams choose this platform if it were optional? Build for that answer.

### 9. Name the substrate; buy the platform when it pays

Infrastructure-as-code is a deliberate choice, not a default: **Terraform** (the deepest ecosystem, source-available under the BSL 1.1 licence — not OSI-approved), **OpenTofu** (the OSI-approved, CNCF-hosted fork, now genuinely diverging in features — check compatibility before assuming it is a silent drop-in), **Pulumi** (real general-purpose languages instead of HCL). Pick on licence-risk tolerance and lock-in, not vibes.

The platform itself is build-vs-buy, and a self-hosted developer portal is the sharpest case. "Free and open source" Backstage is not free: a production install means several dedicated engineers and ongoing operational cost to keep it alive and adopted. The crossover where building can pay off sits well into the low hundreds of engineers *and* requires genuinely unique needs the market does not serve. Below that, a managed portal (Port, Cortex, hosted Backstage, Spotify Portal) usually wins; buying trades customisation for lock-in to someone else's data model, which is a real cost when you outgrow it. Treat the decision as product strategy with an honest total cost of ownership, not a reflex.

## How we apply this

- [DevEx](devex.md) — the developer-facing experience the platform enables.
- [Observability](../quality/observability.md) — the centralised telemetry substrate.
- [Progressive Delivery](progressive-delivery.md) — the CI/CD pipeline as a platform service.

## Anti-patterns we reject

- **The premature platform.** A platform team and bespoke tooling stood up before there are enough teams to amortise them. Overhead wearing the costume of leverage.
- **Platform-as-gatekeeper.** A platform that says "no" more than it says "self-serve" is a bottleneck, not a platform.
- **The golden cage.** Full orchestration with no escape hatch — fluent until the first case it does not handle, then a wall the team cannot get past.
- **The platform labyrinth.** "Self-service" that exposes every underlying knob, so shipping the normal case still requires understanding the whole substrate. Load moved, not removed.
- **Five ways to do one thing.** Pipelines and tools nobody consolidated. The platform should converge them.
- **Tooling that only the platform team can use.** If the API requires insider knowledge, the tool is incomplete.
- **"Platform investment later."** The platform is either invested in or decaying; there is no steady state.
- **Vanity metrics.** Measuring "tickets closed" or login counts without measuring application-team outcomes and developer experience misses the point — and mandated adoption makes the numbers lie.

## Further reading

- *Team Topologies*, Skelton & Pais — the canonical framing of platform teams, enabling teams, and the thinnest viable platform.
- *Platform Engineering on Kubernetes*, Mauricio Salatino — the practical engineering view.
- *The DevOps Handbook*, Kim et al. — the broader cultural context the platform sits inside.
- *CNCF Platforms White Paper* (CNCF App Delivery TAG) — vendor-neutral definitions of platforms, capabilities, and maturity.
- *DX Core 4* (Noda, Forsgren, Storey et al., getdx.com) — a multi-dimensional model for measuring developer productivity without the single-metric traps.
- *Backstage documentation* ([backstage.io](https://backstage.io)) — the archetype of an internal developer portal.
