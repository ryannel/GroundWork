---
title: Developer Experience
description: Golden paths, paved roads, inner-loop optimisation, and a measurement stack — DORA for the system, DevEx for the human — that tells us whether the loop is healthy.
status: active
last_reviewed: 2026-06-19
---
# Developer Experience

## TL;DR

A team ships as fast as its feedback loop lets it. We invest deliberately in the inner loop — the seconds between a code change and the evidence that the change works — because every second saved there is paid back a thousand times over across the team. Your project's dev CLI is the golden path, the measurement stack (DORA for the delivery system, DevEx for the human in it) is how we tell whether the loop is healthy, and friction in the loop is an engineering bug.

## Why this matters

The single largest predictor of a team's output, over months and years, is the quality of its feedback loop. A team that sees the result of a change in five seconds ships more and ships better than a team that sees it in five minutes — not because the individuals are smarter, but because the loop of hypothesis-and-test runs an order of magnitude more often.

But the feedback loop is only one of three things that govern how it actually feels to build here. The research that named the field — *DevEx: What Actually Drives Productivity* (Noda, Storey, Forsgren & Greiler, ACM Queue, 2023) — isolates three dimensions: **feedback loops** (how fast and reliable the answers are), **cognitive load** (how much you must hold in your head to make a change), and **flow state** (whether you can stay in deep work without being yanked out of it). Optimising the loop while ignoring the other two buys a fast loop nobody can think straight inside. Developer experience is not a perk; it is an engineering lever, and it has more than one handle.

## Our principles

### 1. The inner loop is sacred

The inner loop is the sequence from "I think this code will work" to "yes or no, here is the evidence." We invest in making this loop as short as it can be: incremental compilation, test selection, hot reload, one-command bootstrapping, fast linting. Every second shaved off the inner loop multiplies across every engineer, every day.

The loop's centre of gravity has moved. When a coding agent can produce a plausible change in seconds, generation stops being the bottleneck and verification becomes it — the 2024 DORA report found AI adoption correlated with *lower* delivery throughput and stability, because machine-speed output floods a system built for human-speed review. So the inner loop we optimise is no longer "edit → compile"; it is "propose → prove." Fast, trustworthy local verification — a test suite the author and the agent can both run in seconds and believe — is now the highest-leverage second to shave. A loop that generates fast but verifies slowly is a regression dressed as progress.

### 2. One entry point for local tasks — a facade, not a build system

Every local task — start, stop, test, lint, migrate, deploy, generate — runs through a single dev CLI. One command to remember, one tool to teach a new engineer, one surface to improve. Proliferating ad-hoc scripts across `Makefile`, `package.json`, and `bin/` is how a developer experience becomes a treasure hunt.

The value is the single discoverable surface, not custom machinery behind it. The dev CLI is a thin facade that delegates to the right standard tool — the monorepo task graph (Nx, Turborepo), a command runner (Task, just, Make), the package manager — never a bespoke build system reimplementing what those already do well. The failure mode is the opposite of fragmentation: a 4,000-line homegrown CLI that nobody but its author can change, with worse caching and worse error messages than the tools it wraps. Decision rule: wrap, don't reinvent. The CLI owns *discoverability and consistency*; the underlying tools own *execution*. If a subcommand contains real build logic rather than orchestration, that logic belongs in the task runner, not the wrapper.

### 3. Golden paths, not mandatory paths

The golden path is the well-trodden, well-supported way to do a common task. It is the default, and it is the path new engineers and agents follow without thinking. Deviation is allowed when a task genuinely does not fit, but the deviator pays the cost of their own tooling. Golden paths concentrate investment; mandatory paths breed resentment and shadow tooling built to evade them.

The trap is freezing the path. A golden path that stops absorbing the cases people actually hit becomes a mandatory path by neglect — everyone deviates, and the "default" is fiction. The path stays golden only if the escape hatches are watched: a deviation that recurs is a signal the path is too narrow, and the fix is to widen the path, not to scold the deviators.

### 4. Measure the system with DORA, the human with DevEx — and never the individual

The four DORA keys — deployment frequency, lead time for changes, change failure rate, time to recover — measure the health of the *delivery system*. A fifth, operational reliability, measures whether what you ship stays up. We track them, surface them, and treat a regression in any one as a signal to invest in the loop.

But DORA measures throughput and stability; it is silent on whether the work is sustainable or the engineers are drowning. That is the DevEx layer — feedback loops, cognitive load, flow state — which the four keys cannot see. The lineage matters: DORA (2018) → SPACE (2021) → DevEx (2023) → DX Core 4 (Tacho & Noda, 2024), which folds all three into one balanced scorecard across speed, effectiveness, quality, and impact. Use the system metrics to find *where* delivery hurts and the human metrics to find *why*. Two non-negotiable guardrails: never reduce these to a single number, and never attribute any of them to an individual. The moment a metric becomes a performance target it gets gamed (Goodhart's law) — deploy frequency inflates with trivial commits, change-failure rate drops because nobody logs incidents. Metrics are instruments for the team to steer by, not a stick to measure people with.

### 5. Onboarding time-to-first-value is a measured target

A new engineer should reach their first local contribution — "I changed something and I can see the change" — fast, and a new service should reach its first deploy early. We set explicit targets (a first contribution inside the first day, a first deploy inside the first week are good defaults) and we *measure against them* rather than assume them. The number is calibrated to the domain: a CRUD service and a system with deep regulatory or numerical complexity will not share a target, and pretending otherwise just makes the metric a lie. What is universal is the discipline — the target is written down, the actual time is observed, and a regression is treated as a bug in the onboarding system, not a failing of the new hire.

### 6. Documentation is part of the loop

A command you cannot find is a command you do not use. Every CLI subcommand has a reference entry, every golden path has a guide, every service has a handbook. Documentation lives next to the thing it documents and is generated from the source of truth wherever possible — `--help` output, schema, config — because prose that drifts from reality is worse than no prose: it actively misleads. The test is not "does a doc exist" but "can a new engineer, or an agent, find and trust it without asking a human."

### 7. Match the production shapes that bite — not the whole topology

The gaps that cause "it works on my machine" are specific: a different database engine or version, a message broker with different ordering and delivery semantics, an auth contract that behaves differently, a different container runtime. Close *those* — same engine, same contract, same semantics — and the class of bug disappears. Emulation over mocks ([Testing](../foundations/testing.md)) applies: emulate a dependency you own the contract with; mock only at the seam of a dependency you do not.

Full production *shape* is not full production *scale or topology*, and chasing the latter locally is a losing trade — you cannot run a hundred-node cluster, real traffic, or every downstream service on a laptop, and the attempt produces a brittle, slow local stack that drifts anyway. When fidelity costs more than a laptop can pay, the answer is to move the environment, not fake it: ephemeral preview environments and cloud development environments (Codespaces, Gitpod, Coder) give real production shape on real infrastructure, at the price of network latency in the inner loop. Decision rule: reproduce locally the contracts and semantics that produce correctness bugs; reproduce in a remote or ephemeral environment the scale and topology that produce systemic bugs; do not try to do either in the wrong place.

### 8. Cognitive load is the hidden tax

The slowest part of a change is often not compiling or testing — it is the time spent figuring out *where* the change goes and *what else* it touches. Extraneous cognitive load (sprawling configuration, leaky abstractions, ten ways to do one thing, knowledge that lives only in someone's head) is a direct, compounding tax on every change, and it is invisible in delivery metrics until it surfaces as slow lead times and burnout. We treat it as a design constraint: consistent project shape, one obvious way to do common things, generated scaffolding so the structure is given rather than rediscovered, and ruthless deletion of the second and third way to do anything. Protecting flow is the same discipline applied to time — batched reviews, asynchronous defaults, and CI that does not demand babysitting keep engineers in deep work instead of context-switching out of it.

### 9. Friction is filed as a bug

If a process is painful, that pain is a bug. File it, prioritise it, fix it. "Everyone deals with it" is how chronic friction becomes chronic velocity loss. Whoever maintains the dev tooling owns that backlog the same way a product team owns its user-bug backlog — because the developers are the users, and the dev platform is the product.

## How we apply this

- [Platform](platform.md) — the broader internal platform the dev CLI is a part of.
- [Progressive Delivery](progressive-delivery.md) — the outer loop the inner loop feeds into.

## Anti-patterns we reject

- **"Follow the README and read between the lines."** Onboarding that depends on tacit knowledge is not onboarding.
- **Five CLIs for five tasks — or one CLI that reinvents the build.** One unified facade is the default. A second CLI earns its existence by solving a problem the first cannot; a homegrown build system hiding behind the facade is the same fragmentation wearing a disguise.
- **Skip-the-test culture.** Fast-but-unreliable tests are worse than slow-reliable ones: a flaky suite teaches the team to ignore red, which is strictly worse than a slow suite they trust. The inner loop is made fast by honest investment, not by cheating — and a verification loop nobody trusts is no loop at all.
- **DORA theatre.** Tracking the metric while not responding to it is worse than not tracking it. Ranking individuals by it is worse still.
- **The frozen golden path.** A default that no longer fits the work people do is a mandatory path everyone routes around. Watch the deviations; widen the path.
- **Ignoring friction.** If you find a sharp edge, file the ticket. Do not route around it silently.

## Further reading

- *Accelerate*, Forsgren, Humble, Kim — the empirical foundation for the DORA metrics.
- *The DevOps Handbook*, Kim et al. — the full treatment of the inner-and-outer loop view.
- *DevEx: What Actually Drives Productivity*, Noda, Storey, Forsgren & Greiler (ACM Queue, 2023) — the feedback-loops / cognitive-load / flow-state model.
- *The DX Core 4* (Tacho & Noda, 2024) — the unified scorecard folding DORA, SPACE, and DevEx into one framework.
- *Team Topologies*, Skelton & Pais — the organisational side of platform and golden paths.
- *Developer Experience: Concept and Definition* (Fagerholm & Münch, 2012) — the academic framing that predates the modern DevEx term.
