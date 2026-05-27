# Design System: Forge CLI

## 1. Product Personality

Forge is a **developer tool with a professional, no-nonsense character**. It communicates clearly and efficiently. It never wastes the developer's time with unnecessary output, never hides useful information behind flags you have to know to ask for, and never leaves you wondering whether a command worked.

Forge feels like a well-maintained Unix tool: opinionated, consistent, and composable with the rest of the shell environment.

Tone: Concise. Direct. Informative without being verbose. Slightly dry — not chatty.

## 2. Track: CLI

This design system follows the CLI track. There are no visual components. The interface is terminal output, exit codes, and command structure.

## 3. Non-Functional Requirements

- **Speed:** Every command that does not touch the network or disk heavily must respond in under 200ms. Scaffold generation must complete in under 10 seconds.
- **Scriptability:** All commands must be scriptable. `--json` flag available on every command that produces output. Exit codes must be stable and documented.
- **Composability:** Forge must not assume it owns the terminal. It must not clear the screen, use ANSI animations that leave residue, or block on user input unless it is explicitly an interactive command.
- **Idempotency:** `forge new service <name>` run twice in the same directory must be safe — it detects the existing service and exits with a clear error rather than partially overwriting.
- **No telemetry without consent:** No network calls on any command unless the command is explicitly about remote operations (template registry sync, update check). Telemetry is opt-in only.

## 4. Command Structure

**Pattern:** `forge <noun> <verb> [target] [flags]`

Examples:
- `forge service new my-service --lang go --auth clerk`
- `forge service update my-service`
- `forge template list`
- `forge workspace status`

**Aliases:** Common commands have short aliases. `forge svc new` == `forge service new`. Aliases are documented in `--help` output.

**Global flags:** `--dry-run`, `--json`, `--no-color`, `--quiet`, `--verbose`. All commands honour `FORGE_NO_COLOR`, `FORGE_QUIET`, `NO_COLOR` environment variables.

## 5. Output Conventions

**Normal operation:** One line of output per significant action. Prefix with a status symbol:
- `✔` success (green when colour enabled)
- `→` in-progress step (neutral)
- `!` warning (yellow)
- `✘` error (red)

Example scaffold output:
```
→ Resolving template: go-microservice@v1.4.2
✔ Created services/payment-service/
✔ Registered in nx.json
✔ Added to docker-compose.yml
→ Next: cd services/payment-service && go run ./cmd/api
```

**Dry run:** All lines prefixed with `[dry-run]`. Final line: `No files were written.`

**JSON output (`--json`):** A single JSON object to stdout. Always includes `{ "success": true|false, ... }`. On error, includes `{ "success": false, "error": { "code": "...", "message": "..." } }`. No ANSI codes in JSON mode.

**Quiet mode (`--quiet`):** Suppress all output except errors. Exit code still reflects success or failure.

## 6. Exit Codes

- `0` — success
- `1` — usage error (bad flags, missing required argument, unrecognised command)
- `2` — input error (service already exists, workspace not detected, template not found)
- `3` — system error (file permission denied, disk full, network timeout)

Exit codes are stable across minor versions. Changes are treated as breaking.

## 7. Prompts and Interactive Mode

Forge is non-interactive by default. When a required argument is missing, it exits with a usage error and suggests the correct form. Interactive prompts are only used for destructive operations (`forge service delete`) where confirmation is required. Prompts are always skippable with `--yes`.

## 8. Error Messages

Error messages must answer three questions: **what went wrong**, **why it went wrong** (if non-obvious), and **what to do next**.

Good:
```
✘ Service 'payment-service' already exists at services/payment-service/.
   To regenerate it, run: forge service new payment-service --force
```

Bad:
```
✘ Error: directory exists
```
