---
owner: "@RNEL"
audience: "Humans, AI Agents"
last_reviewed: "2026-05-24"
---

# GroundWork Product Brief

GroundWork is an installable, AI-driven framework that enforces an Upfront Technical Delivery pipeline. A single `npx groundwork init` drops a rigorous lifecycle into a project — Product Brief, Design System, Architecture, Scaffolding, MVP Planning, and a continuous Bet delivery loop — ensuring software is designed, contracted, and verified before code is written.

## Target Audience
- **Senior Engineers**: Developers accustomed to working at the level of technical design, who use AI agents to abstract away syntax and scale their impact.
- **AI Agents**: The primary consumers of GroundWork's static contracts, executing implementation tasks within mathematically robust constraints.

## Core Capabilities
- **Contract-Driven Execution**: Shifts the developer's leverage point from writing code to designing robust boundaries — data flows, API contracts, schemas, and tests as proof of work.
- **Context Preservation**: Eliminates the decision fatigue and context collapse of story-driven development by defining the architecture upfront, preventing AI hallucinations and hidden defects during implementation.
- **Living Documentation**: All `docs/` artifacts update continuously through the Living Documents protocol. Any phase or bet can refine any upstream document when new information surfaces — surgically, without ceremony.
- **Iterative Validation**: Treats the upfront plan as a guiding light, not rigid Big Design Up Front. Teams assess and alter the plan iteratively after every delivered bet.

## Domain Constraints
- **Execution Over Ideation**: GroundWork assumes the problem is defined. It focuses strictly on the core delivery loop.
- **Contract First**: Agents cannot begin execution until the data flow, API schema, and test scaffolding exist as static contracts.
- **Bounded Footprint**: GroundWork is strictly confined to `.agents/`, `.groundwork/`, and `docs/` directories — `.agents/` for skills, `.groundwork/` for config and cache, `docs/` for living artifacts. No other directories are touched.
- **Agent-Native Surfaces**: All generated architecture is machine-readable and indexed (via `llms.txt`) to synchronise the map with the territory.

## Out of Scope
- Brainstorming, user research, and early-stage product ideation.
- Generating unverified application code without explicit technical contracts.
- **Brownfield initialisation** — running GroundWork against an existing codebase is on the roadmap (see `TODO.md`); the current implementation only supports greenfield projects.
