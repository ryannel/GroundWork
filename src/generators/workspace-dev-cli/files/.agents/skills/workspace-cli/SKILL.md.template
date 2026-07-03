---
name: workspace-cli
description: "The primary toolkit for managing local services and the bet delivery workflow in this workspace. Use for start/stop/status, running tests, scaffolding bet/milestone/slice stubs, and archiving delivered bet-progress suites."
---

# Workspace CLI Skill

You are operating in a workspace that uses a custom `./dev` CLI to manage its local development environment and bet delivery workflow.
Whenever the user asks you to start, stop, or check the status of the local services, or to scaffold a bet/milestone/slice, run bet-progress tests, or archive a delivered bet, you MUST use this CLI.

## Capabilities

The `./dev` CLI is an executable Node program in the root directory — a thin launcher over a prebuilt, zero-dependency bundle in `.dev/`. It needs no `npm install`; it runs on the Node the workspace already requires. It provides the following commands:

### Lifecycle

- `./dev start`: Starts all services. It automatically handles spinning up infrastructure (like databases) in Docker, and booting application code natively.
- `./dev start --docker`: Forces ALL services, including application code, to run inside Docker.
- `./dev stop`: Gracefully kills all native processes and shuts down Docker containers.
- `./dev reset` / `./dev reset --docker`: Full-cycle recycle — stop, wipe volumes (`clean --hard`), start, then migrate. Use to recover from a corrupted local environment.
- `./dev status`: Displays a human-readable table of running Docker and native processes.
- `./dev status --json`: Returns JSON `{ "docker": [{service,status,ports}], "native": [{service,status,pid}] }` on stdout. **Always use this flag when you need to programmatically determine what is running** — never guess ports.
- `./dev status --watch`: A live, self-refreshing dashboard for humans (TTY only; press `q` to exit). Do not call from a tool — use `--json` instead.
- `./dev logs`: Prints the recent tail of native and Docker logs, then exits. Safe to run non-interactively.
- `./dev logs <service>`: Filters to a single service — its native log file if it has one, otherwise its Docker container. An unknown name fails loud (exit 1).
- `./dev logs --follow`: Streams logs continuously (TTY only). Do not run this from a tool call — it will not return.
- `./dev health` / `./dev health --json`: Actively HTTP-polls every app service's health endpoint plus Jaeger and prints a pass/fail panel. Exits 1 when any endpoint is down — safe to run non-interactively.
- `./dev doctor` / `./dev doctor --json`: Verify the local environment. Dependency checks are advisory, but runtime-connectivity failures (DB/Redis/Jaeger unreachable, stack down, missing migration tooling) gate the exit code (non-zero).
- `./dev completion bash|zsh|fish`: Print a shell completion script.

### Testing

- `./dev test`: Run system tests against the already-running stack (fast inner loop).
- `./dev test integration`: Boot the dev stack, run system tests with FAIL-LOUD flags, then tear down. Requires Docker — flag before running.
- `./dev test bet <slug>`: Run a bet-progress suite at `tests/bets/<slug>/` against the already-running stack.
- `./dev test bet <slug> --integration`: Boot the dev stack, run the bet-progress suite, then tear down. Requires Docker — flag before running.
- `./dev audit`: Dependency-vulnerability audit per service (govulncheck / npm audit / pip-audit / osv-scanner) plus a gitleaks secret scan over the repo. Exits non-zero on findings; a missing scanner binary is a loud skip with its pinned install line, never a silent pass. Safe to run non-interactively.

### Bet Workflow

The bet workflow commands scaffold and manage bet-progress tests — the red, up-front proof-of-work suite written during Decomposition. Two test populations exist: **bet-progress tests** (temporary, in `tests/bets/<slug>/`, archived at delivery) and **permanent best-practice tests** (in service repos and `tests/system/`, stay forever).

- `./dev new bet <slug>`: Create `docs/bets/<slug>/` and `tests/bets/<slug>/` directories for a new bet. `<slug>` must be lowercase kebab-case.
- `./dev new milestone <bet-slug> <milestone-slug>`: Scaffold a red milestone test stub at `tests/bets/<bet-slug>/test_milestone_<N>_<milestone-slug>.py`. `N` is auto-incremented.
- `./dev new slice <bet-slug> <milestone-slug> <service> <slice-slug>`: Scaffold a red slice test stub at `tests/bets/<bet-slug>/test_slice_<N>_<service>_<slice-slug>.py`. `N` is auto-incremented.
- `./dev archive bet <slug>`: Archive a delivered bet's progress suite — `git mv tests/bets/<slug>/ tests/bets/_archive/<slug>/`.

### Layout

```
tests/bets/<slug>/                     # Active bet-progress suite (Phases 3–4)
├── test_milestone_<N>_<slug>.py       # Milestone proof: interface-level + API-level
└── test_slice_<N>_<service>_<slug>.py # Slice proof, bounded by parent milestone

tests/bets/_archive/<slug>/            # Archived at Phase 5 (delivery); permanent tests take over
```

Shared fixtures (`cluster`, `api_client`, `pure_state_reset`, `frontend_base_url`) are auto-discovered from `tests/conftest.py` — no explicit import needed in bet test files.

## Best Practices for Agents

1. **Service Discovery**: Do not guess what ports services are running on. Run `./dev status --json` to get the ground truth.
2. **Log Reading**: `./dev logs` prints the recent tail and exits — safe to call. Only `./dev logs --follow` streams and will hang a tool call; never use `--follow` from `run_command`. For deeper history, read the per-service files in `.dev/logs/*.log`.
3. **Idempotency**: `./dev start`, `./dev stop`, and `./dev new bet` are fully idempotent. It is safe to run them multiple times.
4. **Bet test stubs**: After `./dev new milestone` or `./dev new slice`, fill in the `pytest.fail(...)` stub with the target-state assertion before starting Delivery. The stub is intentionally red — it should stay red until the implementation exists.
5. **Docker gates**: `./dev test integration` and `./dev test bet <slug> --integration` boot Docker. Do not run these commands unless Docker is available and the user expects the boot cost.

## Non-interactive behavior (the agent contract)

The CLI never blocks an agent. `--json` and any non-TTY invocation skip all spinners, live rendering, and prompts — output is plain and the command always returns.

- `./dev status --json` and `./dev doctor --json` emit machine-readable JSON to stdout; all human chrome goes to stderr, so the JSON is pipe-clean.
- `./dev new bet|milestone|slice` with all arguments supplied runs fully non-interactively — always safe. (When run in a terminal with arguments omitted, it may prompt; supply the arguments to avoid that.)
- `./dev logs` is non-streaming by default. Only `./dev logs --follow` streams, and it requires a TTY — never call it from a tool.
- Exit codes: `0` success, `1` failure, `2` usage error (unknown command / bad arguments), `130` on interrupt.
