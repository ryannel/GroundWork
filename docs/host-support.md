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
| Loads registered skills from `.agents/skills/` (or `.claude/`, `.windsurf/` — init symlinks them to the canonical `.agents/`) with YAML `name`/`description` frontmatter | Discovering the orchestrator, check, and persona skills | **Required.** Without skill discovery there is no entry point beyond pasting instructions manually. |
| Reads arbitrary project files on demand | Loading the eighteen hidden methodology skills, the operating contract, templates | **Required.** The two-layer architecture is on-demand file reads. |
| Writes and edits files | Docs, caches, state | **Required.** |
| Executes shell commands | Generators, `./dev`, git-based drift checks, boot verification | Degrades: facilitation and doc phases work fully; scaffold/infra-adopt present a runbook for the user to execute instead (the skills handle this case explicitly), and verification is recorded as pending. |
| Dispatches isolated subagents (Claude Code: the `Task` tool) | The fail-closed review gate, brownfield scan fan-out | Degrades, fail-closed: reviews that cannot run **block commits** rather than silently passing (operating contract, Protocol 8); the orchestrator passes `fan_out: sequential` to the scan. An explicit user-authorised self-review fallback exists but never counts as a passed gate. |
| MCP server support — plus `uv` on the host, which the Serena server's `uvx` launch needs | Serena's live layer — per-symbol navigation, reference-based impact analysis, and symbolic editing | Degrades: without MCP support or `uv`, impact analysis falls back to the cached code map and path-based git checks — slower and less precise, never blocking. The deterministic code map itself does **not** need `uv` (see next row). |
| Node — `npx groundwork-method repo-map` (vendored tree-sitter grammars, no network at run time) | The deterministic code map (`repo-map.json`): import edges + PageRank centrality for Go/Python/TS/JS/Java/Dart, a symbol index for many more languages, and per-project language extension | Degrades: a language present but not mapped is listed in `unmapped` (enable it in-repo via `.groundwork/config/repo-map.languages.js`); where the generator cannot run at all, the scan infers the map's missing parts via LLM in the same shape. Refresh is detect-and-lazy; a git hook is opt-in only. |

## Support matrix

| Host | Status | Evidence |
|---|---|---|
| **Claude Code** | **Verified** | The simulation harness runs real Claude Code sessions against the installed skills (greenfield end-to-end on record; transcripts in the repo's test infrastructure). The generator/boot harness runs in CI. All skill text uses Claude Code tool names where a concrete mechanism must be named, always alongside the environment-agnostic contract. |
| Cursor, Codex, OpenCode, Cline (the `AGENTS.md`-native cluster) | Compatible, explicitly wired, **untested** | `init` generates the canonical `AGENTS.md` and these hosts read it plus `.agents/skills/` directly — no symlink needed. The wiring is offered by name at install (detect + prompt + `--agent`), but no verified end-to-end run exists yet. The subagent-isolation contract is the most likely friction point — hosts without isolated dispatch fall back to the blocking behavior above. |
| Windsurf, Copilot Workspace, other `AGENTS.md`-aware agents | Compatible in principle, **untested** | The skill format is plain markdown + frontmatter and `AGENTS.md` is canonical, but these hosts are not yet in the `init` wiring registry — wire them by hand (e.g. symlink their instruction file to `AGENTS.md`). |
| Plain LLM chat (no tools) | Not supported | GroundWork's output is a running system, not advice; a host without file and shell tools cannot execute the lifecycle. |

Verification means a recorded end-to-end run reviewed against the structural checklist and judge rubric — not "it probably works." Hosts move up this table by being run, and we say so when they have been.

## Agent wiring

GroundWork keeps a **single source of truth** — `AGENTS.md` (instructions) and `.agents/` (skills) — and wires each agent tool to it with symlinks, never copies, so there is no second copy to drift. `AGENTS.md` is always the real file; agent-specific files (`CLAUDE.md`, …) are symlinks pointing at it, so adding or switching agents never moves or orphans the canonical.

`init` decides what to wire in this order:

1. `--agent <name>` flags (repeatable, comma-friendly) — wire exactly those, no prompt.
2. `--yes`/`-y` — non-interactive: wire the auto-detected agents (or Claude Code if none detected).
3. Otherwise, in a TTY, prompt with detected agents pre-selected; non-TTY installs fall back to the detected set (or Claude Code).

Supported agent keys: `claude-code`, `cursor`, `codex`, `opencode`, `cline`. Claude Code gets `.claude → .agents` and `CLAUDE.md → AGENTS.md`; the `AGENTS.md`-native cluster reads the canonical files directly. The selection is recorded in `.groundwork/config/state.json` so `update` self-heals the same links. Add an agent later with `npx groundwork-method init --agent <name>` — non-destructive.
