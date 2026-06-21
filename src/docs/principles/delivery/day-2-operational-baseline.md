---
title: The Day-2 Operational Baseline
description: The stack-agnostic bar every project clears to be operable, debuggable, and safe to change on day two — config validation, typed errors, a debug entry point, observability, graceful shutdown, a pure core, a fast test, and dev-CLI integration — plus the two rules that keep an off-script app honest.
status: active
last_reviewed: 2026-06-21
---
# The Day-2 Operational Baseline

## TL;DR

A project that boots on day one is not the same as a project a team can operate, debug, and change on day two. The gap between the two is a small, **stack-agnostic** set of properties — load-and-validate config, typed errors, a way to attach a debugger, telemetry, clean shutdown, a pure core, a test that runs in seconds, and integration with the project's dev CLI. A web service in Go, a native desktop app, and an embedded daemon owe every item on this list; they differ only in *how* each one is honoured, never in *whether*. This baseline is the bar a generated scaffold already clears, the checklist a forged stack is held to, and the work a first bet scopes in.

## Why this matters

GroundWork's value is a high-quality starting point. The paved-road generators bake this baseline in — clean architecture, a composition root, graceful shutdown, observability, a test harness — so a developer who runs one never has to think about it. The risk is everything *off* the paved road: a stack with no generator, or a generated project adapted past its template. The temptation there is to ship something that boots and call it done. A thing that boots but cannot be debugged, observed, or shut down cleanly is not a starting point — it is a liability handed over with a green checkmark.

So the baseline is written stack-agnostic on purpose. It is the answer to "what does *good* mean when there is no template to copy?" — and the bar does not drop just because the road ran out.

## The two rules

These two rules are why the baseline exists, and they outrank convenience every time.

### No empty capabilities

Every affordance a project materialises must have real backing. A `./dev start` that starts nothing, a `/health` endpoint that always returns `ok`, a test medium with no surface behind it, a config flag nothing reads — each one reads as "covered" while covering nothing, and the next person trusts it. An inert capability is worse than an absent one, because absence is honest.

The rule has a sharp edge for adapted tooling: when a shipped affordance does not fit the project (the classic case — a Docker-shaped `./dev start` in a project with no containers), the fix is to **adapt it to do something real or remove it**, never to leave it wired to nothing and never to build a parallel thing beside it. If a capability has no backing yet, say so plainly rather than shipping the hollow shell.

### Off-script still lands well

When the chosen stack has no paved path, the operational bar is unchanged. The baseline below is the contract: a native macOS app, a Rust daemon, and a Next.js frontend all owe config validation, typed errors, a debug entry point, telemetry, graceful shutdown, a fast test, and dev-CLI integration. Each honours them in its own idiom — `os_log` is not OpenTelemetry, `lldb` is not Delve — but "this stack does it differently" is never "this stack skips it."

## The baseline

Each item states what the property is and why it earns its place. Most are universal; a few are conditional, and the condition is named. Where an item is genuinely not applicable, that is a valid answer — but it must be a *reasoned* answer recorded alongside the others, not a silent omission.

1. **Configuration is loaded and validated at startup.** The process reads its configuration once, validates it, and refuses to boot with a clear message naming the missing or invalid value. *Why:* a process that starts with half a configuration fails later, deep inside a request or a job, where the cause is buried. Fail at the door, not in the dark.

2. **Errors are typed and handled at the boundary.** The core raises meaningful, matchable errors; the thin shell maps them to the surface's vocabulary — an HTTP status, a process exit code, a user-facing dialog. No bare strings thrown as control flow, no failures swallowed into silence. *Why:* an error you cannot pattern-match is one you cannot handle, test, or alert on.

3. **There is a debugging entry point.** A documented, one-command way to run the app under a debugger or with verbose diagnostic output, and logs a human can read at a glance. *Why:* the first thing a developer does on day two is reproduce a defect. If attaching a debugger is undiscovered territory, every investigation starts from cold — this is the single highest-leverage developer-experience affordance a seed can ship.

4. **Observability is wired from the first commit.** Structured logs always; distributed traces and metrics where the target is networked or long-running. *Why:* you cannot operate what you cannot see, and retrofitting telemetry means re-touching every code path you already wrote. Observability is a design-time concern, not a later sprint. (Conditional: a pure local one-shot tool needs structured logs, not a tracing pipeline.) See [Observability](../quality/observability.md).

5. **Shutdown is graceful.** The process traps termination signals, stops accepting new work, drains what is in flight, releases resources and long-lived connections, and exits cleanly. *Why:* a process killed mid-flight corrupts state and leaks connections — and the inner loop restarts the process constantly. (Conditional: a stateless one-shot command that holds no resources has nothing to drain; record that as the reason, not the omission.)

6. **A pure core wrapped in a thin shell.** Decision logic carries no I/O; concrete dependencies sit behind abstractions the core owns, and no implementation detail leaks inward. *Why:* the core stays testable without infrastructure and swappable as the app grows, and there is one obvious place for every kind of code. See [How We Structure Code](../system-design/code-structure.md).

7. **A test harness exists and runs in seconds.** The first test proves the wired-together app does something real — against the real dependency where it runs locally, not a mock of it — and the author or an agent runs it with one command. *Why:* verification, not generation, is now the inner loop's bottleneck; a seed with no fast, trustworthy test is a seed nobody can safely change. See [Testing](../foundations/testing.md).

8. **The app is a first-class citizen of the dev CLI.** `start`, `stop`, `logs`, and `test` operate on it through the project's `./dev` CLI — registered as a managed service or runner, never a side process a developer starts by hand. *Why:* the golden path is one command to learn and one surface to improve; an app that lives outside it is friction every developer pays every day. See [Developer Experience](devex.md) and [Platform](platform.md).

## How to apply it

When scoping a new app — and especially a forged, off-script one — walk the baseline once and, for each item, record one of: *satisfied by the seed*, *scoped into a bet*, or *N/A because …*. The applicable, not-yet-built items become the first bets' work, so the project converges on the full baseline through the normal delivery loop rather than trying to land it all in the scaffold. The seed proves the shape; the delivery loop earns the depth.

This document is the canon. The per-stack Day-2 checklists that scaffold and engineer skills carry are *elaborations* of this baseline in a specific idiom — when they and this page disagree, this page wins, and the checklist is the one to fix.
