---
title: Architecture Decisions
description: Architecture Decision Records as governed, re-evaluable commitments — lean, assumption-explicit, immutable as records, and readable by humans and agents alike.
status: active
last_reviewed: 2026-06-19
---
# Architecture Decisions

## TL;DR

We capture every significant architectural decision as a short record — the context that forced it, what we chose, the assumptions it rests on, and the trade-offs we accepted. The record is immutable; the decision is not. When the world changes we supersede the record rather than overwrite it, so the trail of *why* is preserved and re-evaluation is a check against named assumptions rather than a debate from scratch. A decision record is governance, not paperwork — and in an agent-led codebase it is the memory that keeps autonomous and human decisions consistent.

## Why this matters

The reasoning behind a decision is the first thing lost and the most expensive to reconstruct. Code shows *what* was built; it cannot tell you that a boundary sits where it does because of a constraint that no longer exists. A team without decision records relitigates the same choices every year, cannot tell "we considered this and rejected it" from "nobody thought of it," and discovers its load-bearing assumptions only when one of them breaks in production.

The discipline is cheap and the payoff compounds — but only if records stay *lean enough to write* and *governed enough to trust*. Twenty-field templates die unmaintained; bare records nobody can re-evaluate rot into folklore. The craft is the narrow middle: the few fields that make a decision both fast to capture and honest to revisit.

## Our principles

### 1. The reasoning is the record

An ADR captures *Context* (what forced the decision, what was on the table), *Decision* (what we chose), and *Trade-offs* (what we gave up, what risk we accepted). The why is the deliverable. A record of the outcome without the reasoning is half a record — it cannot stop the next person from quietly undoing the decision because its rationale was invisible.

### 2. Name the assumptions

Every decision rests on conditions that were true when it was made — a load profile, a team size, a vendor price, a regulatory boundary. We write them down. Assumptions are the linchpin of governance: a decision is valid exactly as long as the assumptions under it hold, and naming them turns "should we revisit this?" from a vibe into a check you can run.

### 3. Set a review trigger

Decisions expire against reality, not the calendar. Each significant record names the condition that should bring it back for review — "when we add a second region," "if write throughput passes 50k/s," or, when nothing better exists, a date. The trigger is what makes re-evaluation *proactive*: the decision resurfaces when its world shifts, instead of when someone happens to remember it.

A trigger is not free. An unmaintained trigger is the twenty-field template in another costume — a standing promise nobody keeps — and a stale log is worse than no log, because it reads with false confidence. So a named trigger is earned, not default: reserve it for decisions whose validity hinges on a fragile, measurable assumption (a throughput ceiling, a vendor term, a single-region bet). For everything else the assumption list and the supersession chain *are* the trigger — they let any later reader re-check on demand without anyone holding a vigil.

### 4. The record is immutable; the decision is not

Once accepted, a record's conclusions are not edited (fixing a typo or a dead link is fine). When a decision changes, we write a **new** record that supersedes the old one, and we link the two in both directions — the old marked `superseded by NNNN`, the new naming what it replaces. The original Context and Trade-offs stay true *for the world they were written in*; that is precisely why they are worth keeping. An immutable trail is what makes the set trustworthy enough to re-evaluate against. Some teams run ADRs as living documents instead, appending dated notes to the original; that is fine for anything that does not move the conclusion — a clarification, a fresh data point, a status change from proposed to accepted. The line is the conclusion itself: amend in place when the meaning holds, supersede when the meaning changes. Editing a *conclusion* in place is the single move that breaks the trail, because it rewrites history that other records and live code now depend on.

### 5. Re-evaluation is the goal, not the exception

Records exist to make changing our minds *productive*. When circumstances shift, the record lets us argue about what actually changed — does this assumption still hold? — rather than rebuilding the whole decision from memory. Re-deciding is healthy engineering; re-deciding *without recording it* is how a team loses its memory.

### 6. Keep it lean

Three to five sections plus a thin governance header is the whole of it. The fields earn their place because each is load-bearing — Context and Trade-offs carry the reasoning; Assumptions and the review trigger carry the governance; status, owner, and supersession links carry the history. We resist every field beyond these. A template that feels like a chore is a template that goes unwritten, and an unwritten decision is the most expensive kind.

### 7. Owned, not orphaned

Every standing decision has a current owner — the person or team accountable for it today, who is not necessarily whoever wrote it. An orphaned decision is one nobody will revisit when its assumptions break, which is the same as having no governance at all.

### 8. The decision log is the agent's memory

In an agent-led codebase, the record set is not just human documentation — it is the decision-context layer an agent reads before proposing or revisiting a choice. Relevance is governed by assumption-overlap and supersession status, not recency — a foundational record from the first month can bind a choice more tightly than last week's, and an agent that simply weights the newest records will miss it. So we keep the set lean, linked, assumption-explicit, and *current*, and that is what lets a human or an agent make a *consistent* next decision instead of contradicting one made last quarter. A stale log misleads an agent faster than it misleads a human: the agent reads it at full confidence and propagates a constraint that no longer holds. Records are written to be machine-consumable for the same reason every other interface is ([Agent-Native Systems](../ai-native/agent-native-systems.md)).

### 9. Govern by advice, and pair the record with a check

A record is not a gate. "Governed" means an **advice process** — the decider seeks advice from everyone meaningfully affected *and* everyone with relevant expertise, then keeps the decision — not a central review board teams route around. The advice is mandatory; consensus is not. That trade buys speed with trust and accountability: it degrades the moment deciders skip the advice or escape the consequences of a bad call, and it presumes systems loosely coupled enough that the affected set stays small. A standing review gate is still the right tool for the rare decision that is irreversible *and* cross-cutting *and* externally constrained — a regulated boundary, a one-way data-retention choice — so reserve gates for those rather than making them the default. And where a decision is mechanically checkable, we pair it with a **fitness function** that fails the build on violation: the record documents the choice, the fitness function assures it still holds ([Evolutionary Architecture](evolutionary-architecture.md)).

## How we apply this

Records live in `docs/architecture/decisions/NNNN-<slug>.md`, numbered sequentially. We record at the moment of the decision, not as after-the-fact paperwork — the cheapest time to capture the context is while it is still in the room. The significance test: would a new engineer or agent otherwise have to reconstruct, or relitigate, the reasoning from scratch? A reversible, low-cost, local choice does not earn a record; a durable, cross-cutting, expensive-to-reverse one does.

- [How We Structure Code](code-structure.md) — the boundary decisions most often worth recording.
- [Agent-Native Systems](../ai-native/agent-native-systems.md) — why records are written to be read by agents.

## Anti-patterns we reject

- **Frozen decisions.** "That was decided, we don't revisit it." The record exists to make revisiting *tractable*, not to forbid it.
- **Decisions without assumptions.** A record that omits what it depended on cannot tell you when it has gone stale. It will go stale anyway — silently.
- **Overwriting a record in place.** Editing the conclusion erases the trail that made the current state trustworthy. Supersede; never rewrite.
- **The twenty-field template.** A form so heavy nobody fills it produces exactly zero records. Lean beats complete.
- **Orphaned decisions.** No owner means no one will notice when the trigger fires.
- **Paperwork after the fact.** A record written a month later, from memory, has lost the context that was the point.
- **Relitigating from scratch.** If the conversation rebuilds the whole decision instead of testing what changed, the record is not being used.

## Further reading

- *Architecture Decision Record*, Michael Nygard (the original 2011 post) — the lightweight format everything here descends from.
- *MADR* ([adr.github.io](https://adr.github.io/)) — the modern Markdown ADR template and status lifecycle, built on Nygard's five-part structure (title, status, context, decision, consequences).
- *Facilitating Software Architecture*, Andrew Harmel-Law (O'Reilly, 2024) — the architecture advice process: decentralized, advice-bound, accountable decision-making.
- *Context Matters: Evaluating Context Strategies for Automated ADR Generation Using LLMs* (2026) — evidence that recent decision records are a high-leverage context layer for agents.
