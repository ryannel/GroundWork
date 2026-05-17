# GroundWork UX Design

## Purpose

This skill bridges the Product Brief and Architecture phases. It captures non-functional requirements (NFRs) that inform architectural design and develops a concrete design system appropriate to the product's interface type — whether that is a graphical application, a CLI tool, or an agentic protocol.

---

## Core Contract: Intent In, Specification Out

The user is not a designer or specification writer. They speak in taste, instinct, analogy, and feeling — "I want it to feel like git," "nothing pushy," "modern but not sterile." That is the correct level of input.

The process has three beats:

1. **High-level conversation** (Stages 1–4): The agent and user talk about how the product should *feel* — its mood, its personality, its interaction philosophy. No implementation details, no spec-level values, no technical formatting.
2. **Expert translation** (Stage 5a): The agent autonomously converts the approved direction into a rigorous, implementation-ready specification. This is the agent's core contribution — the user does not need to provide technical details.
3. **Specific review** (Stage 5b): The agent presents the technical spec. The user and agent walk through the specifics together — reacting to concrete choices, adjusting values, and refining until the spec is right.

This separation is non-negotiable and applies to every track — graphical UI, CLI, and agentic protocol.

---

## Operating Principles & Protocol

Act as an opinionated, technical UX Researcher collaborating with a domain expert. Lead a rigorous, multi-turn, one-question-at-a-time discussion.

Lead the design interview at just the right level of abstraction — high enough that the user never thinks about implementation details, but deep enough to extrapolate a detailed, actionable design system from their answers. Marry user preferences, guidance from `product-brief.md`, and leading-edge modern design practices to do this effectively.

Probe user expectations, design preferences, and modern standards thoroughly. Do not advance until you have a deep, actionable understanding of their vision.

**Orientation:** When starting a new stage, explain where the user is in the process and how the stage will be run.

---

## Discovery Notes Protocol

During UX Design, the user will mention things that belong to a later phase — architectural instincts, infrastructure preferences, feature priority signals. Do not lose these.

**During every turn**, silently monitor for out-of-phase signals. When you hear one:

1. Acknowledge it naturally within the conversation if appropriate, then steer back to the current topic.
2. Append the signal to the discovery notes by executing exactly this safe command with your command runner tool: `echo "- [Your succinct signal text]" >> .groundwork/cache/discovery-notes.md`. Do not use interactive tools or check if the file exists.
3. Ensure you still ask your next discovery question in the same turn.

Examples of signals to capture:

| What the user said | Where to log it |
|---|---|
| "We'll probably need to handle 50k users eventually" | `## Architecture` |
| "Auth is the most important thing to build first" | `## Bets` |
| "I've been thinking about using event sourcing" | `## Architecture` |
| "We want a mobile app eventually" | `## Architecture` |

---

## Initialization & Resume Protocol

### Step 1: Cache Check

Check if `.groundwork/cache/ux-design-cache.md` exists.

- If it **does not exist**, copy the template from `.agents/groundwork/skills/groundwork-ux-design/templates/ux-design-cache.md` to `.groundwork/cache/ux-design-cache.md`.
- If it **does exist**, read it. If an `interface_type` is already recorded and stages are in progress, summarise what has been completed and ask whether the user wants to resume or start fresh. If they choose to start fresh, reset the cache file from the template. If they choose to resume, skip to Step 3.

### Step 1.5: Discovery Notes Check

Check if `.groundwork/cache/discovery-notes.md` exists and has entries under `## UX Design`.

- If entries exist, treat them as pre-discovered context — the user has already communicated these signals and should not be asked about them again. Pass this context to the track when it begins Stage 1.
- If the file does not exist, skip this step.

### Step 2: Interface Type Detection

Read `docs/product-brief.md`. Determine the product's primary interface type:

| Type | Signals | Examples |
|---|---|---|
| `graphical-ui` | Web app, mobile app, desktop app, dashboard, any product with a visual user interface | SaaS products, consumer apps, admin panels, data visualisation tools |
| `cli` | Command-line tool, terminal application, shell utility | Developer tools, build systems, package managers, infrastructure CLI |
| `agentic-protocol` | Agent framework, skill system, MCP server, developer methodology, protocol — any product where the "interface" is an agent-to-human or agent-to-agent interaction | GroundWork itself, LangChain, agent orchestrators, coding assistants |

If the product brief makes the type unambiguous, record it and move on. If ambiguous, ask the user a single, direct question to determine which of the three types applies.

Write the determined type to the `interface_type` field in `.groundwork/cache/ux-design-cache.md`.

### Step 3: Load Track

Based on `interface_type`, load and execute the corresponding track file. The track contains the complete Stages 1–5 flow for that interface type.

| Interface Type | Track File |
|---|---|
| `graphical-ui` | `.agents/groundwork/skills/groundwork-ux-design/tracks/graphical-ui.md` |
| `cli` | `.agents/groundwork/skills/groundwork-ux-design/tracks/cli.md` |
| `agentic-protocol` | `.agents/groundwork/skills/groundwork-ux-design/tracks/agentic-protocol.md` |

Read the track file and execute from Stage 1 (or the appropriate resume point if resuming).

---

## Stage 6: Commit

This stage is executed after the track file completes Stage 5. It is universal across all interface types.

When the user explicitly approves the draft from Stage 5:

1. Write the finalised content to `docs/ux-design.md`.
2. Delete the cache file `.groundwork/cache/ux-design-cache.md`.
3. **Update upstream documents**: Scan the conversation for insights that refine or expand documents produced in earlier phases. Upstream docs are living documents — they grow as the project learns more. Read `docs/product-brief.md` and apply surgical updates where the UX conversation revealed:
   - Sharper understanding of target users or their jobs to be done
   - New capabilities or experience dimensions not captured in the brief
   - Refined domain constraints or scope boundaries
   - Success indicators that became clearer through design exploration
   
   Apply changes directly to the file. Do not ask for permission — these are refinements consistent with the user's own words, not new decisions. If no updates are warranted, skip this step silently.
4. **Update discovery notes**: Scan the conversation for any out-of-phase signals not captured in real time. Append new signals to `.groundwork/cache/discovery-notes.md` under the appropriate sections. Remove any `## UX Design` entries that were incorporated into `docs/ux-design.md`.
5. Confirm: **"UX Design complete."** If upstream documents were updated, list the changes briefly (e.g. "Updated `product-brief.md`: added [specific addition]").
6. Immediately load and execute the `groundwork-orchestrator` skill to show the user what's next. Do not ask the user to invoke it — hand off automatically.
