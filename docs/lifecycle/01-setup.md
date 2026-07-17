# 01. Setup

Setup runs once per project. It establishes the vision, design system, service boundaries, and running infrastructure — then hands off to the Delivery Loop and is never invoked again. Two paths exist: **greenfield** builds these foundations through facilitated discovery in an empty repository; **brownfield** recovers them from an existing codebase. Both converge to the same canonical doc set and the same Delivery Loop.

## The Greenfield Path

Six phases, each with one skill and one canonical output document:

| Phase | Skill | Output | What it establishes |
|---|---|---|---|
| 1 | `groundwork-product-brief` | `docs/product-brief.md` | Vision, users, capabilities, domain constraints, the surfaces users meet the product through (with MVP/later horizons) |
| 2 | `groundwork-design-system` | `docs/design-system.md` | Design system, NFRs, interaction patterns — a shared brand foundation plus one design track per interface type in use |
| 3 | `groundwork-architecture` | `docs/architecture/index.md` + `docs/surfaces.md` | Services, data flows, contracts, technology choices; the surface registry with the core's deployment (hosted or embedded) and each surface's core-access path |
| 4 | `groundwork-scaffold` | `docs/architecture/infrastructure.md` | Running local environment, one generated app per registry surface with a generator (`scaffold: manual` honored for the rest), infrastructure topology |
| 5 | `groundwork-mvp` | `docs/bets/<slug>/pitch.md` | Scoped first bet with appetite, success signal, explicit no-gos, and the surfaces it ships on |
| 6 | `groundwork-bet` (Design Foundations onward) | First delivered feature | The first shipped value; enters the Delivery Loop afterwards |

Phases run in order. Each phase commits its document to disk, applies the Living Documents protocol against earlier documents, then hands off to the `groundwork-orchestrator`, which determines the next incomplete phase and routes to its skill.

## The Brownfield Path

When the repository already holds an application, setup inverts: the code is the source of truth and the documents are reverse-engineered from it. The user is interviewed only for what code cannot reveal — the why, the who, and what success looks like.

| Phase | Skill | Output | What it establishes |
|---|---|---|---|
| 0 | `groundwork-scan` | Scan baseline in `.groundwork/cache/` | Code map (via Serena when present), concern-split findings for the extract phases, and a ways-of-working inventory — whether the repo already runs its own delivery methodology, recorded as `methodology` in state |
| 1 | `groundwork-product-brief-extract` | `docs/product-brief.md` | The product vision the code embodies, gaps filled by a short interview |
| 2 | `groundwork-design-system-extract` | `docs/design-system.md` + brand tokens | The design language recovered from the actual UI |
| 3 | `groundwork-architecture-extract` | `docs/architecture/index.md` + `docs/surfaces.md` + domain docs + ADRs | The real service boundaries, contracts, and decisions in force; every interface surface the scan found, registered as `active` (the capability ledger starts empty by design — parity stays unknown until a bet touches it) |
| 4 | `groundwork-infra-adopt` | `docs/architecture/infrastructure.md` + `docs/maturity.md` | The operational layer (`./dev`, system tests) bolted on additively — no application code touched |
| 5 | `groundwork-methodology-adopt` | Convergence ADR + maturity rows (phase exists only when the scan recorded an incumbent methodology) | One way of working: the incumbent system's elements converted, retired, or deliberately kept under an owner-sanctioned convergence map, executed at work-unit boundaries so in-flight work is never fractured |

There is no MVP phase: the product already exists. Throughout the extract phases, every divergence from GroundWork's target state is recorded in a gap ledger with a severity and recommendation; infra adoption consolidates it into `docs/maturity.md` — a living assessment of the project against the GroundWork maturity model, plus the roadmap of open gaps. Onboarding debt becomes prioritised, schedulable work rather than a lecture: every bet's discovery reads the roadmap and proposes pulling gaps in, every bet's validation closes the rows it resolved, and the user always decides between maturity work and product value.

Existing docs are never blind-overwritten. A repo that already carries a brief or architecture doc routes through **Adopt/Upgrade mode**: the extract skill ingests the existing document as its primary source, fills the missing contract sections, and raises it to the current standard while preserving the user's content. The existing docs need not live at the canonical paths — canon kept in another directory, a docs-site tree, or a submodule is recorded by the scan and ingested from there, with the output still landing at the canonical path.

A repo that hand-built its own bet-like delivery system — work-unit docs, progress tests, a scaffolder CLI, its own agent routing — is a **methodology twin**, and installing GroundWork beside that system would leave two parallel ways of working. The scan's inventory detects it, the extract phases build on its canon rather than beside it, and the conditional convergence phase ends setup with one way of working: every incumbent element gets an owner-ruled disposition (corresponds, converts, retires, or deliberately keeps), in-flight incumbent work finishes natively or freezes at a boundary — never fractured mid-unit — and nothing changes before the owner sanctions the plan in one structured pass.

## Why the order

Each phase constrains the next, and the constraints flow downhill:

- **Product Brief → Design System**: The brief establishes who the users are, what the product does, and through which surfaces users meet it. The Design System phase needs this to ground NFR decisions, target inspiration research, and inform design language — and to know which interface types' tracks to run (a web app and a mobile app share one `graphical-ui` track; a CLI adds its own).
- **Design System → Architecture**: The Design System phase captures NFRs (performance budgets, real-time needs, accessibility commitments). Architecture decisions must respect those constraints — a 50ms interaction budget eliminates entire infrastructure approaches.
- **Architecture → Scaffolding**: The architecture defines the service boundaries, technology choices, and the surface registry. Scaffolding reads the registry and maps those decisions to Nx generator invocations — one app per surface with a generator; a `scaffold: manual` surface still gets its infrastructure entry, fixture registration, and operational expectations.
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
