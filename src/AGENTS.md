# AGENTS.md

GroundWork is installed in this project. This file is the **canonical instruction source**
for every AI coding agent that works here. Agent-specific files (e.g. `CLAUDE.md`) are
symlinks to this one — **edit `AGENTS.md`, never the symlinked copies.**

## Start here

Run the **`groundwork-orchestrator`** skill. It reads project state and routes to the next
step — greenfield discovery, brownfield scan, or the delivery (bet) loop. Everything in
GroundWork flows from the orchestrator; you do not need to memorize the lifecycle.

**This includes any request to build, add, change, or fix something.** "Add a delete button",
"fix the upload bug", "build the dashboard" — route it through the orchestrator first, not
straight to code. It sizes the work into a patch, a quick bet, or a bet and runs the right lane.
Implementing directly is the one thing that bypasses GroundWork — the process is how a change
gets designed, proven, and recorded.

This is also the entry point for **maintenance**: when you want to "update GroundWork",
"upgrade GroundWork", or bring this project up to date with the current framework, run the
orchestrator and it routes to the update lane. Do not go hunting for a CLI command or a
specific skill — the orchestrator is always the front door.

## Where things live

- **Registered skills** (auto-loaded): `.agents/skills/` — the orchestrator, `groundwork-check`,
  and any installed engineer personas.
- **Hidden methodology skills** (loaded on demand by the orchestrator): `.groundwork/skills/`.
- **Project docs**: `docs/` — product brief, architecture, lifecycle, bets, and principles.
- **Config & state**: `.groundwork/config/` — never hand-edit `state.json`.
- **Knowledge index**: `llms.txt` at the project root.

## Agent wiring

This project is set up to be agent-agnostic from a single source of truth:

- The content above lives once in `AGENTS.md` + `.agents/`.
- Each agent reads it through symlinks created by `npx groundwork-method init`
  (e.g. Claude Code: `CLAUDE.md → AGENTS.md`, `.claude → .agents`). AGENTS.md-native agents
  (Cursor, Codex, OpenCode, Cline) read `AGENTS.md` and `.agents/skills/` directly.
- Add another agent later with `npx groundwork-method init --agent <name>` — non-destructive.
  `AGENTS.md` never moves; only symlinks change.
