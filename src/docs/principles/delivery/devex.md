---
title: Developer Experience
description: Golden paths, paved roads, inner-loop optimisation, and DORA metrics as the measure of whether the loop is healthy.
status: active
last_reviewed: 2026-05-26
---
# Developer Experience

## TL;DR

A team ships as fast as its feedback loop lets it. We invest deliberately in the inner loop — the seconds between a code change and the evidence that the change works — because every second saved there is paid back a thousand times over across the team. Your project's dev CLI is the golden path, DORA metrics are how we measure the loop, and friction in the loop is an engineering bug.

## Why this matters

The single largest predictor of a team's output, over months and years, is the quality of its feedback loop. A team that sees the result of a change in five seconds ships more and ships better than a team that sees it in five minutes — not because the individuals are smarter, but because the loop of hypothesis-and-test runs an order of magnitude more often. Developer experience is not a perk; it is an engineering lever.

## Our principles

### 1. The inner loop is sacred

The inner loop is the sequence from "I think this code will work" to "yes or no, here is the evidence." We invest in making this loop as short as it can be: incremental compilation, test selection, hot reload, one-command bootstrapping, fast linting. Every second shaved off the inner loop multiplies across every engineer, every day.

### 2. One entry point for local tasks

Every local task — start, stop, test, lint, migrate, deploy, generate — runs through a single dev CLI. One command to remember, one tool to teach a new engineer, one surface to improve. Proliferating ad-hoc scripts in `Makefile`, `package.json`, and `bin/` is how a developer experience becomes a treasure hunt.

### 3. Golden paths, not mandatory paths

The golden path is the well-trodden, well-supported way to do a common task. It is the default, and it is the path new engineers and agents follow by default. Deviation is allowed when a task genuinely does not fit, but the deviator pays the cost of their own tooling. Golden paths concentrate investment; mandatory paths breed resentment.

### 4. DORA metrics keep us honest

Deployment frequency, lead time for changes, change failure rate, mean time to recover — the four DORA metrics are how we measure whether the delivery system is healthy. We track them, surface them, and react to them. A regression in any one of the four is a signal to invest in the loop.

### 5. Onboarding time-to-first-value is a design target

A new engineer should reach their first local contribution — "I changed something and I can see the change" — in their first day. A new service should reach its first deploy in the first week. These are targets we hold ourselves to, and regressions here are treated as bugs.

### 6. Documentation is part of the loop

A command you cannot find is a command you do not use. Every CLI subcommand has a reference entry, every golden path has a guide, every service has a handbook. The documentation exists so the loop does not depend on tribal memory.

### 7. Local environments match production shape

The local stack uses the same database version, the same message broker contract, the same container runtime. "It works on my machine" is eliminated by eliminating the gap between the machines. Emulation over mocks ([Testing](../foundations/testing.md)) applies here too.

### 8. Friction is filed as a bug

If a process is painful, that pain is a bug. File it, prioritise it, fix it. "Everyone deals with it" is how chronic friction becomes chronic velocity loss. Whoever maintains the dev tooling owns the backlog the same way a product team owns its user-bug backlog.

## How we apply this

- [Platform](platform.md) — the broader internal platform the dev CLI is a part of.
- [Progressive Delivery](progressive-delivery.md) — the outer loop the inner loop feeds into.

## Anti-patterns we reject

- **"Follow the README and read between the lines."** Onboarding that depends on tacit knowledge is not onboarding.
- **Five CLIs for five tasks.** One unified CLI is the default. A second CLI earns its existence by solving a problem the first cannot.
- **Skip-the-test culture.** Fast-but-unreliable tests are worse than slow-reliable tests. The inner loop is made fast by honest investment, not by cheating.
- **DORA theatre.** Tracking the metric while not responding to it is worse than not tracking it at all.
- **Ignoring friction.** If you find a sharp edge, file the ticket. Do not route around it silently.

## Further reading

- *Accelerate*, Forsgren, Humble, Kim — the empirical foundation for DORA metrics.
- *The DevOps Handbook*, Kim et al. — the full treatment of the inner-and-outer loop view.
- *Team Topologies*, Skelton & Pais — the organisational side of platform and golden paths.
- *Developer Experience: Concept and Definition* (Fagerholm & Münch, 2012) — the academic framing that predates the modern DevEx term.
