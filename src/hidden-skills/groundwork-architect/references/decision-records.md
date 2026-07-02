# Architectural Decision Records

An ADR captures the context behind a decision so it can be re-evaluated later with that context in hand. Its purpose is not to lock the decision in — it is to make changing your mind *productive*: when circumstances shift, you argue about what actually changed rather than rebuilding the whole decision from memory. Code shows *what* was built; the ADR explains *why*, the part you cannot recover from the code a year on.

A modern decision record is **governed, not just documented**. Documentation answers *what* and *why*; governance answers *whether the decision still holds* and *when to look again*. Two lean additions carry the governance, and they are precisely what make re-evaluation a check rather than a vibe.

## When to record

Record a decision when a new engineer or agent would otherwise have to reconstruct — or relitigate — the reasoning from scratch. Typical triggers: a service boundary or the core/surface split, an auth or trust-model choice, a sync-vs-async or messaging pattern, a persistence choice, a hosted-vs-embedded deployment decision, a contract-format commitment — any choice where a credible alternative was rejected for reasons that will not be obvious later.

Not every decision earns one. A reversible, low-cost, local choice does not. The bar is: durable, cross-cutting, and expensive to reverse.

## What a record carries

Lean — three to five sections plus a thin governance header. Each field is load-bearing; resist every field beyond these, because a record that feels like a chore goes unwritten.

- **Context** — what forced the decision: the constraints, the pressures, the alternatives that were live at the time. This is what makes future re-evaluation possible.
- **Decision** — what was chosen, stated plainly.
- **Assumptions** — what must stay true for this to remain the right call: the load profile, team size, vendor, cost, or regulatory boundary it rests on. The linchpin of governance — a decision is valid exactly as long as its assumptions hold, and a record with none cannot be told when it has gone stale.
- **Review trigger** — the condition that should bring it back: "when we add a second region", "if throughput passes 50k/s", or a date when nothing better applies. Decisions expire against reality, not the calendar — the trigger makes revisiting proactive.
- **Trade-offs** — what was given up and what risk was accepted. A decision without its cost recorded is half a record.
- **Header** — status, an **owner** accountable today (not whoever wrote it), and supersession links. Numbered sequentially (`docs/architecture/decisions/NNNN-<slug>.md`).

## The record is immutable; the decision is not

Once accepted, a record's conclusions are not edited in a way that changes them — typo and dead-link fixes are fine, and so is appending a dated note (a clarification, a fresh data point, a status change) when the meaning still holds. The line is the conclusion itself: **amend in place when the meaning holds, supersede when the meaning changes.** When the decision itself changes, write a **new** record that supersedes the old one — state the changed circumstance in its Context — and link the two in both directions (`superseded by NNNN`). The original Context and Trade-offs stay true *for the world they were written in*; that is why they are kept. Editing a *conclusion* in place is the one move that breaks the trail: the trail is what makes the set trustworthy enough to re-evaluate against. A decision you cannot find a recorded reason for is one you are free to revisit on its merits — the absence of a rationale is itself information.

## Govern by advice, and pair the record with a check

A record is not a gate. "Governed" means an **advice process** — whoever makes the decision must seek advice from those affected and those with expertise, but the decision stays with them — not a central review board teams learn to route around. And where a decision is mechanically checkable, pair it with a **fitness function** that fails the build on violation: a record *documents* the choice; the fitness function *assures* it still holds ([evolutionary-architecture.md](evolutionary-architecture.md)). When you record a load-bearing decision, ask what automated check would catch its violation — that check is the decision's other half.

## The log is the agent's memory

In an agent-led codebase the record set is the decision-context layer a human or agent reads before proposing or revisiting a choice — and the most recent records carry the most relevant constraints. Keep them lean, linked, and assumption-explicit: that is what lets the next decision be *consistent* with the last instead of contradicting it. When you advise a load-bearing structural call, the record is where its reasoning — and the assumptions that will one day call it back for review — lives.
