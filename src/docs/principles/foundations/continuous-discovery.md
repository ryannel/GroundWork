---
title: Continuous Discovery
description: Discovery as a weekly habit, not a phase — mapping the problem space with an opportunity-solution tree before committing to a solution.
status: active
last_reviewed: 2026-06-14
---
# Continuous Discovery

## TL;DR

Discovery is not the phase before delivery — it is a habit that runs alongside it. We stay in regular contact with the people we build for, we map the **problem space** before we choose a solution, and we connect every solution we consider back to a desired outcome through an opportunity-solution tree. The goal is not more research; it is a shorter loop between a decision and the evidence that should inform it.

## Why this matters

The most expensive mistake in software is building the wrong thing well, and it is almost always made at the moment a team jumps from a vague problem straight to a specific solution. Discovery done as a one-time upfront phase cannot prevent this: the assumptions it validated go stale the moment the world moves, and by the time delivery reveals the gap, the cost of the miss is a shipped feature instead of a discarded sketch. Teams that ship the right thing repeatedly are not the ones who research hardest once — they are the ones who keep a continuous, low-friction connection to their users and let it steer decisions every week. Discovery is continuous because the problem space is never finished revealing itself.

## Our principles

### 1. Discovery is a continuous habit, not a gate

We treat customer contact as a recurring rhythm — a weekly touchpoint, not a quarterly study. The unit is small and frequent: one conversation, one observed session, one assumption tested. Continuous contact keeps the team's mental model of the user current, surfaces problems while they are still cheap to act on, and means no single decision rests on research that is months old. A team that only talks to users at the start of a project is navigating by a map it drew once and never updated.

### 2. Map the problem space before choosing a solution

The first move is never "what should we build?" — it is "what is the user actually trying to accomplish, and where does that break down?" We hold the problem space open deliberately, naming the distinct opportunities (unmet needs, pain points, desires) before collapsing toward any one solution. A solution chosen before the problem space is understood is a guess dressed as a plan; the discipline is to resist the collapse until the opportunities are explicit.

### 3. The opportunity-solution tree keeps work connected to outcomes

We structure discovery as a tree: a desired **outcome** at the root, branching into the **opportunities** that could move it, branching into candidate **solutions**, branching into the **assumptions** each solution rests on. The tree is the single artifact that makes the reasoning visible — every solution traces back to an opportunity and an outcome, and any solution that cannot is a feature looking for a justification. The tree is living: it evolves every week as evidence comes in, not a diagram drawn once for a kickoff.

### 4. Compare opportunities instead of debating solutions

When a team argues about which feature to build, it is usually arguing about solutions to different problems without realising it. The tree reframes the debate: decide which *opportunity* is most worth pursuing first, and the solution conversation becomes tractable. Prioritising at the opportunity level — by the size of the unmet need, how many users feel it, and how well it serves the target outcome — beats prioritising a backlog of solutions whose value is asserted rather than reasoned.

### 5. Seek evidence, and guard against the loudest voice

Discovery grounds decisions in evidence, but evidence is easy to skew: the loudest customer, the most recent complaint, the most senior stakeholder's hunch. We weight signal by how representative it is of the target users and the target outcome, not by how forcefully it arrived. Structured contact across the user base — rather than reacting to whoever escalated last — is what keeps the opportunity space honest.

### 6. The team discovers together

The people who will build the thing hear the problem firsthand. When product, design, and engineering all sit in (or watch) customer contact, the team shares one mental model and the handoff loss between "what the user said" and "what we built" collapses. Discovery filtered through a single person and relayed as a requirements document loses exactly the texture that would have changed the design. Firsthand exposure is a force multiplier on every downstream decision.

## How we apply this

- The desired outcome at the root of the tree is a [success metric](success-metrics.md), not a feature count — discovery steers toward a measurable change in behaviour.
- Each candidate solution carries the [product risks](product-risks.md) it must clear; discovery is where we test the riskiest assumption before delivery, not after.
- When discovery converges on a bet, its problem, hypothesis, and no-gos are framed against [prioritization and appetite](prioritization-and-appetite.md) — the opportunity chosen sets the appetite.

## Anti-patterns we reject

- **Big-bang discovery.** A single upfront research phase that produces a backlog and then ends. The map goes stale and nothing updates it.
- **Solution-first thinking.** Jumping to "let's build X" before the opportunity X serves is named. The problem space never gets mapped, so the solution can never be wrong — which means it can never be right either.
- **The feature factory's roadmap.** A prioritised list of solutions with no visible link to outcomes. Without the tree, "why this and not that?" has no defensible answer.
- **Loudest-customer steering.** Letting the most recent escalation set the agenda. Reactive discovery optimises for the squeakiest wheel, not the target user.
- **Discovery by proxy.** One person talks to users and relays a document to the team. The texture that would have changed the design is lost in translation.

## Further reading

- *Continuous Discovery Habits*, Teresa Torres — the canonical treatment of the weekly habit and the opportunity-solution tree.
- *Inspired* and *Empowered*, Marty Cagan — discovery as the core competency of a product team.
- *The Mom Test*, Rob Fitzpatrick — how to talk to users without leading them toward the answer you want to hear.
