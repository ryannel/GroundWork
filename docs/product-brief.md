---
owner: "@RNEL"
audience: "Humans, AI Agents"
last_reviewed: "2026-05-14"
---

# GroundWork Product Brief

GroundWork is an installable, AI-driven architectural framework that enforces an Upfront Technical Delivery pipeline. It enables engineering teams to drop a rigorous execution loop—Product Brief, UX Design, Architecture Documentation, and Work Delivery—directly into existing projects, ensuring that software is designed, contracted, and verified before code is written.

## Target Audience
- **Senior Engineers**: Developers accustomed to working at the level of technical design, who use AI agents to abstract away syntax and scale their impact.
- **AI Agents**: The primary consumers of GroundWork's static contracts, executing implementation tasks within mathematically robust constraints.

## Core Capabilities
- **Contract-Driven Execution**: Shifts the developer's leverage point from writing code to designing robust boundaries (data flows, API contracts, schemas, and tests as proof of work).
- **Context Preservation**: Eliminates the decision fatigue and context collapse of story-driven development by defining the architecture upfront, preventing AI hallucinations and hidden defects during implementation.
- **Iterative Validation**: Treats the upfront plan as a guiding light, not rigid "Big Design Up Front" (BDUF). Teams assess and alter the plan iteratively after every delivered service slice.
- **Brownfield Portability**: Packages the discovery, planning, and execution phases so they can be seamlessly initialized and executed within any existing codebase, regardless of the underlying language or framework.

## Domain Constraints
- **Execution Over Ideation**: GroundWork assumes the problem is defined. It focuses strictly on the core delivery loop.
- **Contract First**: Agents cannot begin execution until the data flow, API schema, and test scaffolding exist as static contracts.
- **Minimal Footprint**: GroundWork is strictly confined to the `.agents/` and `docs/` directories to guarantee zero friction and intrusion in existing codebases.
- **Agent-Native Surfaces**: All generated architecture must be machine-readable and indexed (via `llms.txt` and MCP) to synchronize the map with the territory.

## Out of Scope
- Brainstorming, user research, and early-stage product ideation.
- Generating unverified application code without explicit technical contracts.
