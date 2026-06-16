---
owner: "@RNEL"
audience: "Humans, AI Agents"
last_reviewed: "2026-06-09"
---

# What GroundWork Is

GroundWork is an installable delivery system for AI-driven software development. One command — `npx groundwork-method init` — drops a complete product-development lifecycle into a repository: facilitated discovery that produces a Product Brief, Design System, and Architecture; code generators that scaffold the designed system as running, tested services; and a continuous Bet delivery loop that ships features against explicit contracts. The output of setup is not a stack of documents awaiting implementation — it is a booted, health-checked monorepo whose documentation and code were born from the same decisions.

## The problem it solves

AI agents write code faster than teams can specify it. Without upfront structure, agent-built systems accumulate hidden defects: hallucinated boundaries, contradictory data models, undocumented decisions that evaporate when the context window does. The common response — agile story-driven development with an AI in the loop — makes it worse: every story re-derives architectural context from scratch, and the decision fatigue compounds across sprints.

GroundWork shifts the engineer's leverage point from writing code to designing boundaries. Data flows, API contracts, schemas, and tests exist as static artifacts before implementation begins, so agents execute inside constraints instead of inventing them. The plan is a guiding light, not Big Design Up Front — every delivered bet feeds back into the documents, and any phase can refine any upstream artifact when new information surfaces.

## The lifecycle

GroundWork operates in two modes. **Setup** runs once per project and establishes the skeleton. **Delivery** repeats for the life of the project.

Setup adapts to what it finds:

| Path | When | Flow |
|---|---|---|
| **Greenfield** | Empty repository | Product Brief → Design System → Architecture → Scaffold → MVP Planning → first Bet |
| **Brownfield** | Existing codebase | Scan → Product Brief Extract → Design System Extract → Architecture Extract → Infra Adoption → first Bet |

Greenfield builds the canonical documents through facilitated conversation, then scaffolds the designed system with Nx generators. Brownfield reverse-engineers the same documents from the code itself — the user is interviewed only for what code cannot reveal (the why, the who, the success measure) — then additively bolts on the operational layer without regenerating the application. Both paths converge to the same end-state and enter the same Delivery Loop.

Delivery runs on **Bets**, not sprints. A bet pairs a problem with an appetite — how much solving it is worth, judged by opportunity cost rather than estimated effort — and a stakes read — what is at risk if it goes wrong — then moves through discovery, design, decomposition into contract-defined slices, delivery, and validation. Milestones are flag-gated internal proof points; slices define API surfaces that are testable before anything consumes them. Each completed bet updates the living documents, so the docs describe the system as it is, not as it was once imagined.

GroundWork is multi-surface by design. Every product is modelled as one headless **capability core** plus zero or more **surfaces** — web app, mobile app, CLI, MCP server — registered in `docs/surfaces.md` and tracked capability-by-capability in a parity ledger, so a feature that ships on web and deliberately skips the CLI is a recorded decision, not a silent gap (see `docs/principles/capability-core-and-surfaces.md`). A single-surface product pays zero ceremony for this: every phase degrades to its familiar behaviour when the registry holds one surface.

## What ships

| Layer | Contents |
|---|---|
| **Methodology** | An orchestrator skill that routes every lifecycle request, backed by eighteen hidden methodology skills (facilitation, extraction, review, writing) loaded on demand to keep always-on context cost near zero. All skills share one Operating Contract governing discovery-note capture, living-document updates, and phase lifecycle. |
| **Generators** | Nx generators for Go microservices, Python microservices, Next.js apps, CLI apps, a docs site, and a system-test runner — each producing services that compile, boot under Docker Compose, and pass health checks out of the box. |
| **Operations** | A zero-dependency `./dev` CLI bundled into every generated workspace, system tests generated into the boot topology, and `groundwork-check` for CI-time staleness detection between code and docs. |
| **Code intelligence** | The Serena MCP server (LSP-backed), registered at init, giving the scan and architecture phases symbol-level navigation and a structural map of the codebase instead of LLM guesswork. |

GroundWork confines itself to three directories — `.agents/` for skills, `.groundwork/` for config and cache, `docs/` for living artifacts — and touches nothing else until the user asks it to scaffold.

## Who it is for

- **Senior engineers** who work at the level of technical design and use AI agents to scale their impact past syntax.
- **AI agents**, the primary consumers of GroundWork's static contracts, executing implementation inside explicit, verifiable constraints.

## What it is not

GroundWork is not an ideation tool — it assumes a problem worth solving exists and focuses on the path from problem to shipped, verified software. It is not a code assistant — it never generates application code without a contract to generate against. And it is not a process veneer — if a phase cannot end in a committed artifact a downstream phase can rely on, the phase is not done.
