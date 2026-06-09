---
owner: "@RNEL"
audience: "Humans, AI Agents"
last_reviewed: "2026-06-09"
---

# Example: A Greenfield Setup, End to End

This is what a completed GroundWork greenfield setup actually produces. Everything quoted below is a verbatim artifact from one real session — the simulation harness driving a live Claude Code run against the installed skills, with a simulated founder building **Verse**, a platform where readers play AI-generated interactive stories and creators author the worlds they run in. The session ran 31 user turns: Product Brief → Design System → Architecture → Scaffold → MVP Planning → first Bet, with every document passing the fail-closed independent review before commit.

The product domain is incidental — GroundWork built it the same way it builds a fintech dashboard or a CLI tool. What matters is the shape of the output: decisions with reasoning, constraints with teeth, and a bet that is honest about its own risks.

## What the session committed

| Artifact | Count / size |
|---|---|
| Canonical docs (`product-brief`, `design-system`, `architecture`, `infrastructure`) | 4, each led by a `## Summary for Downstream` |
| Domain entity docs (`docs/domain/`) | 5 — world, playthrough, beat, character-profile, reader-profile |
| Architectural decision records (`docs/decisions/`) | 9 |
| Running services | 2 — a Next.js web app and a Python/FastAPI generation engine, booted under Docker Compose with health checks |
| First bet | `docs/bets/core-story-loop/` pitch at `status: design` |

## The architecture summary, as committed

The first thing every downstream phase reads. Note the shape: decisions are committed (not surveyed), constraints are enforceable, deferrals name their resolving phase.

> ### Key Decisions
> - Two services: `web` (Next.js edge, no domain data) + `narrator` (Python/FastAPI, all domain + Postgres).
> - Generation model `claude-sonnet-4-6`; safety-gate model `claude-haiku-4-5`; both behind a model abstraction in narrator.
> - World bible is prompt-cached; beats stream over server-authoritative SSE; no WebSockets, no message broker.
> - Neon serverless Postgres; Cloud Run (narrator, min-instances 0) + Vercel (web) — scale-to-zero.
> - Clerk is the identity source of truth; narrator verifies the Clerk JWT and authorizes row ownership by `clerk_user_id`.
> - Generation is synchronous request→stream with atomic per-beat commit; no queues or background workers.
>
> ### Binding Constraints
> - Hard safety floor (no sexual content, no minors in peril, no hate) is moderated before any beat streams; enforcement is invisible — steer/regenerate, never a block screen.
> - ≤2s time-to-first-token is a **warm-path** promise; a cold start after idle is an explicit exception covered by the <30s cold-open budget.
> - A story or beat is never exposed to a non-owner (row ownership by `clerk_user_id`).

Each of those decisions traces to a numbered ADR with context, trade-offs, and alternatives — `0001-two-service-topology` through `0009-atomic-beat-commit-and-resume`. When a later bet overturns one, the Reversal Protocol supersedes the ADR and re-gates every dependent doc.

## The first bet, as committed

The pitch below is unedited. The Rabbit Holes section is the part most planning frameworks never produce: the named technical traps that could silently eat the six-week appetite, each with its guard.

> - **Problem:** Verse's entire thesis is unproven until one thing is true: that an AI-generated story can make a reader's choices feel *meaningful* — consequential, not random, and not railroaded onto a single canon path. […] We have a vision, a design, and a running skeleton, but no evidence that the loop itself is compelling. This bet gets that evidence.
> - **Appetite:** **6 weeks.** […] The hard cap is **three hand-seeded worlds**; if the scope strains the appetite, we cut worlds before we cut loop quality.
> - **Success Signal:** **≥60% of readers who start a story make at least 10 choices in their first session.** That depth is the real test — it says the loop is holding them and that choices feel worth making, rather than a novelty that wears off in three taps.
>
> **Rabbit Holes**
> - [ ] Risk: **Coherence over 10+ beats.** As the playthrough and memory grow, the story can drift or contradict itself — the exact failure that makes choices feel meaningless. Guard: keep memory structured and sparse […]; run a 15-beat coherence spike on one world in the first two weeks before tuning the rest.
> - [ ] Risk: **≤2s warm TTFT versus the safety gate.** The Haiku gate sits in the hot path; done naively it either blows the latency budget or, if rushed, leaks floor-violating content. Guard: budget the gate explicitly […]; spike gate latency early against the warm-path budget.
> - [ ] Risk: **Atomic commit while streaming.** Committing a beat as it streams risks partial writes or double-writes on reconnect/retry. Guard: commit on completion of a safety-cleared beat, made idempotent by `(playthrough_id, sequence)` […].
>
> **No-Gos**
> - [ ] **Studio / authoring** — creators will expect to build worlds; excluded. The team hand-seeds the worlds for this bet; the creator platform is a later bet.
> - [ ] **More than three worlds** — excluded as a discipline: worlds get cut before loop quality does.

## Why this is the bar

Every claim above survived an independent reviewer running in an isolated context with a fail-closed verdict — a draft that contradicted its upstream summary, hid a rabbit hole, or shipped an empty Summary for Downstream would not have committed. The conversation that produced it is excerpted in [Getting Started](../getting-started.md); the harness that ran it is described in the contributor guide's Flow Testing section.

A brownfield companion example (an existing codebase adopted, gap-by-gap, into this same end-state) lands after the brownfield simulation's deep run — it will be added here rather than invented.
