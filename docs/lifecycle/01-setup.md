# 01. Greenfield Setup

Setup runs once per project. It establishes the vision, design system, service boundaries, scaffolded infrastructure, and the first bet pitch — then hands off to the Delivery Loop and is never invoked again.

Six phases, each with one skill and one canonical output document:

| Phase | Skill | Output | What it establishes |
|---|---|---|---|
| 1 | `groundwork-product-brief` | `docs/product-brief.md` | Vision, users, capabilities, domain constraints |
| 2 | `groundwork-design-system` | `docs/design-system.md` | Design system, NFRs, interaction patterns |
| 3 | `groundwork-architecture` | `docs/architecture.md` | Services, data flows, contracts, technology choices |
| 4 | `groundwork-scaffold` | `docs/infrastructure.md` | Running local environment, generator output, infrastructure topology |
| 5 | `groundwork-mvp` | `docs/bets/<slug>/pitch.md` | Scoped first bet with appetite, success signal, and explicit no-gos |
| 6 | `groundwork-bet` (Design Foundations onward) | First delivered feature | The first shipped value; enters the Delivery Loop afterwards |

Phases run in order. Each phase commits its document to disk, applies the Living Documents protocol against earlier documents, then hands off to the `groundwork-orchestrator`, which determines the next incomplete phase and routes to its skill.

## Why the order

Each phase constrains the next, and the constraints flow downhill:

- **Product Brief → Design System**: The brief establishes who the users are and what the product does. The Design System phase needs this to ground NFR decisions, target inspiration research, and inform design language.
- **Design System → Architecture**: The Design System phase captures NFRs (performance budgets, real-time needs, accessibility commitments). Architecture decisions must respect those constraints — a 50ms interaction budget eliminates entire infrastructure approaches.
- **Architecture → Scaffolding**: The architecture defines the service boundaries, technology choices, and capability decisions. Scaffolding maps those decisions to specific Nx generator invocations.
- **Scaffolding → MVP Planning**: The infrastructure is real before MVP scoping begins. The MVP can reference concrete services and capabilities rather than aspirational ones.
- **MVP Planning → First Bet**: MVP produces a pitch at `status: design`. The Bet skill picks up at Design Foundations and continues without re-doing discovery.

## How phases communicate

Two protocols carry information between phases. Both are defined in the Operating Contract:

- **Discovery Notes** (`.groundwork/cache/discovery-notes.md`) — When a phase surfaces a signal that belongs to a later phase (e.g., the user mentions an infrastructure preference during the product brief), the agent appends it under the matching section header (`## Architecture` for infrastructure signals, `## Bets` for sequencing instincts, etc.). The downstream phase reads its section at the start of its conversation and treats the entries as pre-discovered context.

- **Living Documents** — When a phase reveals information that refines an upstream document (e.g., architecture discovery reveals a new user type that should appear in the brief), the agent applies a surgical update directly to that document at commit time, without asking permission.

## The MVP→Bet exception

Every phase transition recommends a fresh context for the next phase — except the MVP→Bet handoff. The greenfield discovery surfaces a substantial amount of context the docs alone do not fully capture (the why behind each decision, the trade-offs that were considered, the user's recurring concerns). That context is needed by the first bet's Design Foundations phase to produce the right interface design and contracts.

To preserve it, the MVP commit step does not recommend a fresh context. The orchestrator routes to `groundwork-bet` in the same session, and the Bet skill picks up the pitch at `status: design` and routes into `02-design.md` without re-summarising. After the first bet ships, every subsequent bet runs in a fresh context using only `docs/*.md` and discovery notes as ground truth.

## Resumption

Every phase writes its in-flight work to a cache file under `.groundwork/cache/` as it progresses. If a session is interrupted, re-invoking the phase reads the cache, summarises which stages have completed, and asks the user whether to resume or start fresh. The cache file is deleted on successful commit.
