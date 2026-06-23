# ▲ GroundWork

**An installable delivery system for AI-driven software development.**

One command drops a complete product-development lifecycle into your repository: facilitated discovery that produces a Product Brief, Design System, and Architecture; code generators that scaffold the designed system as running, tested services; and a continuous Bet delivery loop that ships features against explicit contracts. The output of setup is not a stack of documents awaiting implementation — it is a booted, health-checked monorepo whose documentation and code were born from the same decisions.

```bash
npx groundwork-method init
```

Then ask your AI agent (Claude Code is the verified host) to run the **groundwork-orchestrator** skill. It reads project state, detects whether the repo is empty or already holds an application, and routes to the right next step. That's the whole interface — one command, one skill, and the orchestrator drives everything else.

> **Status:** pre-1.0. The methodology, generators, and brownfield adoption path are implemented and exercised by the test harness and live simulation runs; the operational surface (versioned releases, migration notes) is being hardened. Verified on Claude Code; the skill format is host-agnostic but untested elsewhere.

---

## Why

AI agents write code faster than teams can specify it. Without upfront structure, agent-built systems accumulate hidden defects: hallucinated boundaries, contradictory data models, undocumented decisions that evaporate when the context window does. Story-driven development makes it worse — every story re-derives architectural context from scratch.

GroundWork shifts the engineer's leverage point from writing code to designing boundaries. Data flows, API contracts, schemas, and tests exist as static artifacts before implementation begins, so agents execute inside constraints instead of inventing them. The plan is a guiding light, not Big Design Up Front: every delivered bet feeds back into the documents, and any phase can refine any upstream artifact when new information surfaces.

## How it works

**Setup** runs once and adapts to what it finds:

| Path | When | Flow |
|---|---|---|
| **Greenfield** | Empty repository | Product Brief → Design System → Architecture → Scaffold → MVP Planning → first Bet |
| **Brownfield** | Existing codebase | Scan → Product Brief Extract → Design System Extract → Architecture Extract → Infra Adoption → first Bet |

Greenfield builds the canonical documents through facilitated conversation with an expert-peer agent, then scaffolds the designed system with Nx generators — services that compile, boot under Docker Compose, and pass health checks out of the box. Brownfield reverse-engineers the same documents from your code (you are interviewed only for what code cannot reveal), then additively bolts on the operational layer without touching your application. Both paths converge and enter the same loop.

**Delivery** runs on **bets**, not sprints. A bet pairs a problem with an appetite — the time you're willing to spend — and moves through discovery, design, decomposition into contract-defined slices, delivery, and validation. Every draft document passes a fail-closed independent review before it commits; every completed bet updates the living docs so they describe the system as it is.

**Maintenance** keeps it true: `npx groundwork-method check` detects doc/code drift in CI, and the `groundwork-update` skill maps shipped changes to surgical doc edits. `check` exits `0` when docs are current, `1` on detected drift (or when it cannot run: no git repo, no `docs/`), and `2` when git history cannot be read — gate CI on any non-zero exit.

Run `npx groundwork-method help` for the full lifecycle map.

## What ships

| Layer | Contents |
|---|---|
| **Methodology** | An orchestrator skill that routes every lifecycle request, backed by eighteen hidden methodology skills loaded on demand — always-on context cost stays near zero |
| **Generators** | Nx generators for Go microservices, Python microservices, Next.js apps, CLI apps, a docs site, and a system-test runner |
| **Operations** | A zero-dependency `./dev` CLI bundled into every generated workspace, system tests generated into the boot topology, CI drift detection |
| **Code intelligence** | A deterministic code map (`npx groundwork-method repo-map`: tree-sitter import edges + PageRank centrality for Go/Python/TS/JS/Java/Dart, a symbol index for many more languages, and per-project language extension) gives a structural map of the codebase instead of LLM guesswork; the Serena MCP server (LSP-backed), registered at init, adds live symbol-level navigation, reference-based impact analysis, and symbolic editing |

GroundWork confines itself to three directories — `.agents/` for skills, `.groundwork/` for config and cache, `docs/` for living artifacts — and touches nothing else until you ask it to scaffold.

## Learn more

- **[Getting started](docs/getting-started.md)** — a real greenfield session, end to end, with transcript excerpts.
- **[What GroundWork is](docs/product.md)** — the product description.
- **[The lifecycle](docs/lifecycle/index.md)** — setup, the delivery loop, and maintenance in detail.
- **[GroundWork and BMAD](docs/groundwork-vs-bmad.md)** — how this differs from agile-AI process frameworks, and why it stays standalone.

## Contributing

This repo builds the tool; user projects consume it via npm. Start at `CLAUDE.md`, which routes to the contributor guide in `.agents/skills/groundwork-contributor/`. All authoritative contribution rules live there.
