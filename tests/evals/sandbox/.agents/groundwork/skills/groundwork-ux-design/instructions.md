# GroundWork UX Design

## Purpose

This skill bridges the Product Brief and Architecture phases. It captures non-functional requirements (NFRs) that inform architectural design and develops a concrete design system appropriate to the product's interface type — whether that is a graphical application, a CLI tool, or an agentic protocol.

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

Based on `interface_type`, load and execute the corresponding track file. The track contains the complete Stages 1–6 flow for that interface type, as well as the Core Contract, Operating Principles, and Discovery Notes Protocol.

| Interface Type | Track File |
|---|---|
| `graphical-ui` | `.agents/groundwork/skills/groundwork-ux-design/tracks/graphical-ui.md` |
| `cli` | `.agents/groundwork/skills/groundwork-ux-design/tracks/cli.md` |
| `agentic-protocol` | `.agents/groundwork/skills/groundwork-ux-design/tracks/agentic-protocol.md` |

Read the track file and execute from Stage 1 (or the appropriate resume point if resuming). DO NOT retain these initialization instructions in context once the track is loaded. The track file is the single source of truth for the remainder of the session.
