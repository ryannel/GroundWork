---
owner: "@RNEL"
audience: "Humans, AI Agents"
last_reviewed: "2026-06-09"
---

# Host Agent Support

GroundWork installs skills, not a runtime — every behavior is an instruction file executed by whatever AI agent the user already works in. This page states exactly what GroundWork requires of that host, what degrades gracefully when a capability is missing, and which hosts are actually verified rather than merely plausible.

## What GroundWork requires of a host

| Capability | Used for | If missing |
|---|---|---|
| Loads registered skills from `.agents/skills/` (or `.claude/` — init symlinks them) with YAML `name`/`description` frontmatter | Discovering the orchestrator, check, and persona skills | **Required.** Without skill discovery there is no entry point beyond pasting instructions manually. |
| Reads arbitrary project files on demand | Loading the seventeen hidden methodology skills, the operating contract, templates | **Required.** The two-layer architecture is on-demand file reads. |
| Writes and edits files | Docs, caches, state | **Required.** |
| Executes shell commands | Generators, `./dev`, git-based drift checks, boot verification | Degrades: facilitation and doc phases work fully; scaffold/infra-adopt present a runbook for the user to execute instead (the skills handle this case explicitly), and verification is recorded as pending. |
| Dispatches isolated subagents (Claude Code: the `Task` tool) | The fail-closed review gate, brownfield scan fan-out | Degrades, fail-closed: reviews that cannot run **block commits** rather than silently passing (operating contract, Protocol 8); the orchestrator passes `fan_out: sequential` to the scan. An explicit user-authorised self-review fallback exists but never counts as a passed gate. |
| MCP server support | The depwire deterministic code map | Degrades: scan, check, and update fall back to LLM inference and path-based git checks — slower and less precise, never blocking. |

## Support matrix

| Host | Status | Evidence |
|---|---|---|
| **Claude Code** | **Verified** | The simulation harness runs real Claude Code sessions against the installed skills (greenfield end-to-end on record; transcripts in the repo's test infrastructure). The generator/boot harness runs in CI. All skill text uses Claude Code tool names where a concrete mechanism must be named, always alongside the environment-agnostic contract. |
| Cursor, Windsurf, Copilot Workspace, Codex CLI, other `AGENTS.md`-aware agents | Compatible in principle, **untested** | The skill format is plain markdown + frontmatter and init maintains the `AGENTS.md`/`CLAUDE.md` pairing, but no verified run exists. The subagent-isolation contract is the most likely friction point — hosts without isolated dispatch fall back to the blocking behavior above. |
| Plain LLM chat (no tools) | Not supported | GroundWork's output is a running system, not advice; a host without file and shell tools cannot execute the lifecycle. |

Verification means a recorded end-to-end run reviewed against the structural checklist and judge rubric — not "it probably works." Hosts move up this table by being run, and we say so when they have been.
