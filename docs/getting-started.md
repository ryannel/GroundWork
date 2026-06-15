---
owner: "@RNEL"
audience: "Humans, AI Agents"
last_reviewed: "2026-06-12"
---

# Getting Started

This guide walks one greenfield project from `npx groundwork-method init` to its first committed bet. Every quoted excerpt is verbatim from a real session — a simulation run where the facilitator built **Narrative**, a browser platform where creators author interactive story worlds and an AI engine generates each story beat live from a player's choices. The full setup took 31 conversational turns and ended with a booted two-service monorepo and a scoped first bet.

If your repository already contains an application, the same `init` applies — the orchestrator detects it and routes through the brownfield path instead ([lifecycle docs](lifecycle/01-setup.md) cover both).

## 1. Install

```bash
cd your-project
npx groundwork-method init
```

Init installs the orchestrator and registered skills into `.agents/skills/`, eighteen hidden methodology skills into `.agents/groundwork/skills/`, seeds `.groundwork/config/`, links `.claude → .agents` for Claude Code, and registers the Serena code-intelligence MCP server. It touches nothing else.

## 2. Start the conversation

Open your AI agent in the project and say something like *"run groundwork"* or *"what's next?"*. The orchestrator reads `.groundwork/config/state.json` and the filesystem, classifies the project, and routes:

> Project type set to `greenfield`. Now loading the **Product Brief** skill (phase 1).

## 3. Product Brief — facilitated discovery

The first phase is a structured conversation, not a form. The facilitator asks for the moments that matter and translates them into a brief:

> **Facilitator:** "Walk me through a single moment of play. I'm in a story, I hit a decision point. What do I actually see and do, and what happens next?"
>
> **User:** "Okay, so I'm in a story. Let's say it's a heist in a cyberpunk city. I get to a scene where I'm standing outside a heavily guarded building and the AI describes what I see: guards, cameras, a side entrance, the whole thing. Then it presents me with maybe three to five choices… I pick one. Then the engine doesn't just branch to a pre-written 'bribe path.' It generates what happens next."

Signals that belong to later phases (a design instinct, an infrastructure preference) are captured into discovery notes as they occur, so you never repeat yourself.

## 4. Every draft passes review before you see it

Each phase drafts its document, then sends it to an independent reviewer running in an isolated context. The gate is fail-closed — no parseable pass, no commit:

> **Facilitator:** **Review gate passed: `VERDICT: PRESENT`, no findings.** The independent reviewer confirmed internal coherence, a complete Summary for Downstream, and clean deferrals.
>
> Here is the final Product Brief draft, presented in full before I route it to the user for approval:

You approve, the doc commits to `docs/product-brief.md`, and the orchestrator routes to the next phase in a fresh context.

## 5. Design System and Architecture — proposals, not questionnaires

Downstream phases read the upstream summaries and arrive with positions. The facilitator is an expert peer: it proposes, explains why, and lets you redirect:

> **Facilitator:** "The defining tension for Narrative is that it's a *reading* experience powered by *live AI generation*. That splits latency into two layers, and I'm proposing we treat them differently:
>
> 1. **Performance — two budgets.**
>    - **UI responsiveness:** every interface action … feels instant — under ~50ms, optimistic.
>    - **Narrative generation:** the next beat *streams*. Target first words on screen in **≤1.5s** … We never show a Player a blank spinner — the stream is the experience."

Architecture ends with committed service boundaries, domain entity docs, and numbered ADRs — in this session, a two-service topology, five domain entities, and seven decision records. The commit also writes the surface registry (`docs/surfaces.md` with its machine twin `.groundwork/surfaces.json`): every surface the product ships through — a web app, a CLI, a mobile app — registered with its status and core-access path, plus the capability ledger that bet validation fills as capabilities reach each surface. A single-surface product like Narrative gets a one-entry registry and no added ceremony.

## 6. Scaffold — the design becomes a running system

The scaffold phase maps the architecture to generator invocations and boots the result:

> **Facilitator:** "Scaffold's built and verified… Everything runs through `./dev` (start, migrate, test, and the bet workflow). Good to commit the infrastructure doc?"

At this point the repo contains compiling services (here: a Next.js web app and a Python narrator service), a Docker Compose topology with health checks, generated system tests, and `docs/infrastructure.md` describing exactly what runs where.

## 7. MVP and the first bet

MVP planning scopes the smallest version that proves the product, and writes it as a bet pitch — problem, appetite, success signal, rabbit holes, no-gos:

> **User:** "Looks great, please commit it. The slug `core-story-loop` is perfect — it's clear and directly names the thing we're validating."
>
> **Facilitator:** Approved, slug confirmed. Executing **Phase 5: Commit**… Committing the first bet.

Setup is now over, permanently. From here the project lives in the [Delivery Loop](lifecycle/02-delivery-loop.md): bets with appetites, decomposed into contract-defined slices, validated against the documents — and the documents updated by every bet that ships.

## 8. Keeping it true

Two commands keep code and docs converged for the life of the project:

```bash
npx groundwork-method check    # CI drift detection: code changed after a doc's last_reviewed?
npx groundwork-method update   # refresh installed skills when the package updates
```

When `check` reports drift, ask your agent to run the `groundwork-update` skill — it maps the offending commits to surgical doc edits and gates them through the same review.

## Where everything lives

| Location | Contents |
|---|---|
| `docs/` | The living canonical documents — brief, design system, architecture, surface registry, infrastructure, domain entities, ADRs, bets |
| `.agents/` | Skills (the orchestrator and the hidden methodology set) |
| `.groundwork/config/` | Project state and settings |
| `.groundwork/cache/` | Transient working files — drafts, discovery notes, hand-offs; cleaned up as phases commit |

Run `npx groundwork-method help` for the full lifecycle map, or ask the orchestrator for help at any time — it knows where the project is and what comes next.
