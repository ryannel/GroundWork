# Design System: Forge CLI

CLI track. No GUI. Interface is terminal output, exit codes, and command structure.

## Key decisions

- **Track:** CLI
- **Command pattern:** `forge <noun> <verb> [target] [flags]`
- **Output symbols:** ✔ success, → step, ! warning, ✘ error (with ANSI colour, suppressible)
- **Flags:** `--dry-run`, `--json`, `--no-color`, `--quiet`, `--verbose` on all commands. Env vars: `NO_COLOR`, `FORGE_QUIET`.
- **JSON output:** Single JSON object, always `{ "success": true|false }`. No ANSI codes.
- **Exit codes:** 0 success, 1 usage error, 2 input error, 3 system error. Stable across minor versions.
- **Interactivity:** Non-interactive by default. Prompts only for destructive operations; skippable with `--yes`.
- **Error messages:** What went wrong + why + what to do next. No bare `Error: X` messages.

## App-shell architectural signals

- CLI binary with no persistent runtime → no services, no docker-compose, no health endpoints
- Template registry initially local → will need a remote registry (Git tag or OCI registry) for publishing
- Workspace mutation (nx.json, docker-compose.yml) → must read and write structured files safely (no string concatenation)
