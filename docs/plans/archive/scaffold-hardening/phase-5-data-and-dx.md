# Phase 5 — Data, migrations & developer experience

**Prerequisite:** Phase 0 complete (provides `./dev migrate` and `./dev test integration`). Phase 0's `migrate` iterates app services and runs `services/<svc>/scripts/apply-schema.sh` for each service that has one. Phase 0's changes to `lifecycle.sh.template`, `quality.sh.template`, and `dev.template` (help) are **already in the executor's repo** but are NOT in the anchors below (those anchors were read from the pre-Phase-0 source). All edits in this phase are **additive** — add new functions and new help rows; never delete or rewrite Phase 0's `cmd_migrate` / `cmd_test integration`. If an anchor does not match verbatim because Phase 0 already edited around it, locate the nearest stable line quoted in the anchor and insert relative to it.

**Phase goal:** Make the generated `./dev` CLI a complete operational surface — full-cycle reset, real health polling, scoped log streaming, all-language linting, and a `doctor` that proves runtime connectivity (DB/Redis/Jaeger) instead of only checking that binaries exist. Bring Python data migrations to parity with Go (declarative `schema.sql` + `apply-schema.sh`, driven by `./dev migrate`). Harden the Next.js data edges (Zod response validation, WebSocket URL validation) and document Python configuration via `.env.example`.

**Phase acceptance gate (run after all tasks; regenerate the demo workspace per the harness block below):**
- `./dev doctor` with the stack **down** prints WARN/FAIL rows for DB, Redis, and Jaeger (not a silent pass) and exits non-zero.
- `./dev doctor` with the stack **up** (`./dev start --docker` + `./dev migrate`) prints green rows for DB, Redis, Jaeger.
- `./dev reset` runs stop → clean --hard → start → migrate without error and ends with the stack running.
- `./dev health` polls every app service health endpoint + Jaeger and prints a summary panel; down services show a red row, not a crash.
- `./dev logs <service>` streams only that service; `./dev logs` still streams everything.
- `./dev lint` runs golangci-lint (Go), eslint (Next.js), and ruff + black (Python) — all three when all three service types exist.
- A Python service migrates via `./dev migrate` (its `apply-schema.sh` applies `db/schema.sql`).
- `npm run build` succeeds after every `generator.ts` edit.

### Demo workspace harness (used by every Acceptance block)

```bash
GJSON=/Users/ryannel/Workspace/groundWork/generators.json
TMP=/Users/ryannel/Workspace/groundWork/.sandboxes/demo
rm -rf $TMP; mkdir -p $TMP/services; printf '{}' >$TMP/nx.json; printf '{"name":"demo"}' >$TMP/package.json
(cd $TMP && npx --yes nx g $GJSON:workspace-dev-cli --appName demo)
(cd $TMP && npx --yes nx g $GJSON:go-microservice --name api --auth service)
# For tasks that need Python and/or Next.js services, also run:
(cd $TMP && npx --yes nx g $GJSON:python-microservice --name worker --postgres true)
(cd $TMP && npx --yes nx g $GJSON:nextjs-app --name web --apiProxy true)
```

All `./dev` commands below run from `$TMP` (`cd $TMP && ./dev <cmd>`).

---

### Task 5.1 — `./dev reset` (full-cycle environment reset)

- **Files:**
  - `/Users/ryannel/Workspace/groundWork/src/generators/workspace-dev-cli/files/scripts/cli/lifecycle.sh.template` (EJS template — keep `.template` suffix; no EJS tags needed in this code)
  - `/Users/ryannel/Workspace/groundWork/src/generators/workspace-dev-cli/files/dev.template` (EJS template — register help row)
- **Depends on:** Phase 0 (`cmd_migrate`).
- **Goal:** One command that fully recycles the environment: stop everything, wipe volumes, start fresh, re-apply migrations.
- **Anchor (current code to find — `lifecycle.sh.template`, last function, ~lines 302–305):**
  ```bash
    local end_time=$(date +%s)
    local elapsed=$((end_time - start_time))
    print_success "Workspace clean complete. (${elapsed}s)"
  }
  ```
  This is the end of `cmd_clean`, the last function in the file. Append `cmd_reset` immediately after the final closing `}` of `cmd_clean`.
- **Change:** Add this new function at the very end of `lifecycle.sh.template`:
  ```bash

  function cmd_reset() {
    print_logo "Resetting Environment"
    print_info "Full cycle: stop → clean (wipe volumes) → start → migrate."
    echo ""

    cmd_stop
    cmd_clean --hard
    cmd_start "$@"

    # cmd_migrate is provided by Phase 0. Only run it if available.
    if declare -f cmd_migrate >/dev/null; then
      cmd_migrate
    else
      print_warn "cmd_migrate not found — skipping migration step (is Phase 0 applied?)."
    fi

    echo ""
    print_success "Environment reset complete."
  }
  ```
  Note: `cmd_reset` forwards `"$@"` to `cmd_start`, so `./dev reset --docker` cleanly recycles the Docker topology.

  Then register the help row in `dev.template`. Anchor (`dev.template`, ~lines 31–36, inside `show_help`):
  ```bash
    print_category "LIFECYCLE"
    print_cmd "start" "Spin up environment (--docker)"
    print_cmd "stop" "Tear down components"
    print_cmd "logs" "Tail output logs"
    print_cmd "status" "Print local endpoints (--json)"
    print_cmd "clean" "Deep teardown & wipe (--hard)"
  ```
  Replace with (adds `reset` and `health` rows — `health` is added in Task 5.2; if doing 5.1 alone, add only the `reset` row):
  ```bash
    print_category "LIFECYCLE"
    print_cmd "start" "Spin up environment (--docker)"
    print_cmd "stop" "Tear down components"
    print_cmd "reset" "Stop, wipe volumes, start & migrate"
    print_cmd "logs" "Tail output logs (logs <service> to filter)"
    print_cmd "status" "Print local endpoints (--json)"
    print_cmd "health" "Poll service health endpoints"
    print_cmd "clean" "Deep teardown & wipe (--hard)"
  ```
- **Acceptance:**
  ```bash
  # regenerate demo workspace (harness block above; go service is enough)
  npm run build   # not strictly needed — no generator.ts change — but harmless
  cd $TMP && ./dev reset --docker
  # Expect: logo "Resetting Environment", then Stopping → Cleaning (Volumes wiped)
  #         → Starting → migrate output → "Environment reset complete."
  cd $TMP && ./dev help | grep -E "reset|health"   # both rows present
  ```
- **Guardrails:** Do not reimplement stop/clean/start/migrate — call the existing functions. Do not add a `down -v` here; `cmd_clean --hard` already wipes volumes. Keep the `print_*` UX consistent with the file. No EJS interpolation in this function.

---

### Task 5.2 — `./dev health` (poll every app service + Jaeger)

- **Files:**
  - `/Users/ryannel/Workspace/groundWork/src/generators/workspace-dev-cli/files/scripts/cli/lifecycle.sh.template` (EJS template)
  - `/Users/ryannel/Workspace/groundWork/src/generators/workspace-dev-cli/files/dev.template` (help row — already added in Task 5.1's replacement block)
- **Depends on:** 5.1 (shares the help-block edit) — otherwise none.
- **Goal:** Actively HTTP-poll each app service's health endpoint and Jaeger's query API, printing a pass/fail panel. FAIL LOUD: a down service is a red row, never a silent skip.
- **Background (verified facts — do not re-derive):**
  - Go service health endpoint: `GET /health` (from `internal/entrypoints/api/health_handler.go`).
  - Python service health endpoint: `GET /health` (and `/healthz`) (from `src/main.py`).
  - Next.js app health endpoint: `GET /api/healthz` (from `app/api/healthz/route.ts`).
  - Jaeger query/health API: `GET http://localhost:16686/api/services` (from `docker-compose.yml.template`, container exposes `16686`).
  - Per-service native port lives in: Go → `services/<svc>/.env` line `PORT=<n>`; Next.js → `services/<svc>/package.json` `"dev": "next dev --port <n>"`; Python → `services/<svc>/src/provider/config.py` `server_port: int = <n>`. (Python has no `.env`.) These markers are also how `cmd_start` and `generator.ts` detect each service type.
- **Anchor (current code to find — `lifecycle.sh.template`, ~lines 173–190, `cmd_logs`):**
  ```bash
  function cmd_logs() {
    print_logo "Streaming Logs (Ctrl+C to stop)"
  ```
  Insert the helper `_svc_port` and `cmd_health` **immediately before** `function cmd_logs() {`.
- **Change:** Insert this block before `cmd_logs`:
  ```bash

  # Resolve a service's HTTP port from its language marker file.
  # Echoes the port number, or nothing if it can't be determined.
  _svc_port() {
    local svc="$1"
    local dir="$ROOT_DIR/services/$svc"
    if [ -f "$dir/.env" ]; then
      grep -E '^(PORT|SERVER_PORT)=' "$dir/.env" | head -n1 | sed -E 's/^[^=]+=([0-9]+).*/\1/'
      return
    fi
    if [ -f "$dir/package.json" ]; then
      grep -Eo 'next dev --port [0-9]+' "$dir/package.json" | grep -Eo '[0-9]+' | head -n1
      return
    fi
    if [ -f "$dir/src/provider/config.py" ]; then
      grep -E 'server_port: int =' "$dir/src/provider/config.py" | grep -Eo '[0-9]+' | head -n1
      return
    fi
  }

  # Resolve a service's health endpoint path. Next.js apps expose /api/healthz;
  # Go and Python services expose /health.
  _svc_health_path() {
    local svc="$1"
    if [ -f "$ROOT_DIR/services/$svc/package.json" ]; then
      echo "/api/healthz"
    else
      echo "/health"
    fi
  }

  function cmd_health() {
    print_logo "Service Health"

    print_panel_start "App Services"
    local any=false
    local unhealthy=0
    for svc in $(_get_app_services); do
      any=true
      local port
      port=$(_svc_port "$svc")
      if [ -z "$port" ]; then
        print_panel_row "${YELLOW}${ICON_WARN}${NC} $svc" "unknown port" "skipped"
        unhealthy=$((unhealthy + 1))
        continue
      fi
      local path
      path=$(_svc_health_path "$svc")
      local url="http://localhost:${port}${path}"
      local code
      code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$url" 2>/dev/null || echo "000")
      if [ "$code" = "200" ]; then
        print_panel_row "${GREEN}${ICON_SUCCESS}${NC} $svc" "healthy" ":${port}"
      else
        print_panel_row "${RED}${ICON_ERROR}${NC} $svc" "down (${code})" ":${port}"
        unhealthy=$((unhealthy + 1))
      fi
    done
    if [ "$any" = false ]; then
      print_panel_row "${DIM}No app services${NC}" "" ""
    fi
    print_panel_end
    echo ""

    print_panel_start "Observability"
    local jcode
    jcode=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://localhost:16686/api/services" 2>/dev/null || echo "000")
    if [ "$jcode" = "200" ]; then
      print_panel_row "${GREEN}${ICON_SUCCESS}${NC} Jaeger" "healthy" ":16686"
    else
      print_panel_row "${RED}${ICON_ERROR}${NC} Jaeger" "down (${jcode})" ":16686"
      unhealthy=$((unhealthy + 1))
    fi
    print_panel_end
    echo ""

    if [ "$unhealthy" -eq 0 ]; then
      print_success "All services healthy."
    else
      print_error_card "$unhealthy endpoint(s) unhealthy." "Run './dev start' (or './dev start --docker') and retry."
      return 1
    fi
  }
  ```
- **Acceptance:**
  ```bash
  # regenerate demo workspace with go + python + nextjs services (full harness block)
  cd $TMP && ./dev start --docker && ./dev migrate
  cd $TMP && ./dev health
  # Expect: "App Services" panel with one green row per service (e.g. api :4000 healthy),
  #         "Observability" panel with green Jaeger :16686, then "All services healthy."
  cd $TMP && ./dev stop && ./dev health; echo "exit=$?"
  # Expect: red rows for each service + Jaeger, an error card, and exit=1.
  ```
- **Guardrails:** Reuse `print_panel_start/_row/_end`, `print_success`, `print_error_card`, the `ICON_*` and color vars from `_ui.sh` — do not invent new formatting. Use `--max-time 3` so a hung port can't block the loop. Discover services via `_get_app_services` (the existing helper that does `ls services`). Do not require the stack to be up — down endpoints must render as rows, not errors.

---

### Task 5.3 — `./dev logs <service>` filtering

- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/workspace-dev-cli/files/scripts/cli/lifecycle.sh.template` (EJS template)
- **Depends on:** none.
- **Goal:** Allow `./dev logs <service>` to stream just one service's output (native log file or Docker container), while `./dev logs` with no arg keeps streaming everything.
- **Anchor (current code to find — `lifecycle.sh.template`, ~lines 173–190):**
  ```bash
  function cmd_logs() {
    print_logo "Streaming Logs (Ctrl+C to stop)"

    local native_logs=()
    for svc in $(_get_app_services); do
      if _svc_running "$svc"; then
        native_logs+=("$LOG_DIR/$svc.log")
      fi
    done

    if [ ${#native_logs[@]} -gt 0 ]; then
      tail -f "${native_logs[@]}" &
      local TAIL_PID=$!
      trap "kill $TAIL_PID 2>/dev/null" EXIT
    fi

    $COMPOSE logs -f
  }
  ```
- **Change:** Replace the entire `cmd_logs` function with:
  ```bash
  function cmd_logs() {
    local target="$1"

    if [ -n "$target" ]; then
      print_logo "Streaming Logs: $target (Ctrl+C to stop)"

      # Native service: stream its log file if it has one.
      local native_log="$LOG_DIR/$target.log"
      if [ -f "$native_log" ]; then
        tail -f "$native_log"
        return 0
      fi

      # Otherwise treat it as a Docker container service.
      if $COMPOSE config --services 2>/dev/null | grep -qw "$target"; then
        $COMPOSE logs -f "$target"
        return 0
      fi

      print_error_card "Unknown service: $target" "Run './dev status' to list known services."
      return 1
    fi

    print_logo "Streaming Logs (Ctrl+C to stop)"

    local native_logs=()
    for svc in $(_get_app_services); do
      if _svc_running "$svc"; then
        native_logs+=("$LOG_DIR/$svc.log")
      fi
    done

    if [ ${#native_logs[@]} -gt 0 ]; then
      tail -f "${native_logs[@]}" &
      local TAIL_PID=$!
      trap "kill $TAIL_PID 2>/dev/null" EXIT
    fi

    $COMPOSE logs -f
  }
  ```
- **Acceptance:**
  ```bash
  cd $TMP && ./dev start --docker
  cd $TMP && timeout 3 ./dev logs api    # streams only the 'api' container/native log
  cd $TMP && timeout 3 ./dev logs        # streams everything (unchanged behaviour)
  cd $TMP && ./dev logs nosuch; echo "exit=$?"   # error card + exit=1
  ```
- **Guardrails:** Preserve the no-arg path byte-for-byte (it is the existing behaviour). Use `$COMPOSE config --services` (the same discovery `_get_infra_services` uses) to validate a container name. Do not break the `EXIT` trap in the no-arg branch.

---

### Task 5.4 — Lint all languages (Go + Next.js + Python)

- **Files:**
  - `/Users/ryannel/Workspace/groundWork/src/generators/workspace-dev-cli/files/scripts/cli/quality.sh.template` (EJS template)
  - `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/pyproject.toml.template` (EJS template — add ruff + black to `[dev]` deps; companion edit so the linters exist)
- **Depends on:** none.
- **Goal:** `./dev lint` runs the right linter for every service, detected by marker file: golangci-lint for Go (`.golangci.yml`), eslint for Next.js (`package.json`), ruff + black for Python (`pyproject.toml`). FAIL LOUD: a missing linter binary is a warning, not a silent skip.
- **Anchor (current code to find — `quality.sh.template`, ~lines 24–38, full `cmd_lint`):**
  ```bash
  function cmd_lint() {
    print_logo "Running Linters"

    for svc in $(ls "$ROOT_DIR/services" 2>/dev/null || true); do
      local svc_dir="$ROOT_DIR/services/$svc"

      if [ -f "$svc_dir/.golangci.yml" ]; then
        print_step "Linting Go Service: $svc"
        (cd "$svc_dir" && golangci-lint run)
      fi
    done

    echo ""
    print_success "Linting complete."
  }
  ```
- **Change:** Replace the entire `cmd_lint` function with:
  ```bash
  function cmd_lint() {
    print_logo "Running Linters"

    for svc in $(ls "$ROOT_DIR/services" 2>/dev/null || true); do
      local svc_dir="$ROOT_DIR/services/$svc"

      # Go
      if [ -f "$svc_dir/.golangci.yml" ]; then
        print_step "Linting Go Service: $svc"
        if command -v golangci-lint >/dev/null 2>&1; then
          (cd "$svc_dir" && golangci-lint run)
        else
          print_warn "golangci-lint not installed — skipping $svc. Install: https://golangci-lint.run"
        fi
      # Next.js / Node
      elif [ -f "$svc_dir/package.json" ]; then
        print_step "Linting Next.js Service: $svc"
        (cd "$svc_dir" && npm run lint)
      # Python
      elif [ -f "$svc_dir/pyproject.toml" ]; then
        print_step "Linting Python Service: $svc"
        (cd "$svc_dir" && uv run ruff check . && uv run black --check .)
      fi
    done

    echo ""
    print_success "Linting complete."
  }
  ```
  Then add ruff + black to the Python `[dev]` deps. Anchor (`pyproject.toml.template`, ~lines 35–41):
  ```toml
  [project.optional-dependencies]
  dev = [
      "pytest>=8.0.0",
      "pytest-asyncio>=0.23.0",
      "testcontainers[postgres,redis]>=3.7.1",
      "httpx>=0.27.0"
  ]
  ```
  Replace with:
  ```toml
  [project.optional-dependencies]
  dev = [
      "pytest>=8.0.0",
      "pytest-asyncio>=0.23.0",
      "testcontainers[postgres,redis]>=3.7.1",
      "httpx>=0.27.0",
      "ruff>=0.6.0",
      "black>=24.0.0"
  ]
  ```
- **Acceptance:**
  ```bash
  # regenerate demo workspace with go + python + nextjs services (full harness block)
  cd $TMP && ./dev lint
  # Expect three "Linting ... Service:" steps — Go (golangci-lint), Next.js (npm run lint),
  #         Python (ruff check + black --check) — then "Linting complete."
  # If golangci-lint is absent locally, expect a WARN row for the Go service (not silent).
  grep -A8 'optional-dependencies' src/generators/python-microservice/files/pyproject.toml.template  # ruff + black present
  ```
- **Guardrails:** Detection order matters — `.golangci.yml` first (Go services also have no `package.json`/`pyproject.toml`), then `package.json`, then `pyproject.toml`; use `elif` so a service matches exactly one linter. Match `cmd_test`'s `uv run` convention for Python (not `uvx`, not bare `ruff`). Do not change `cmd_test`. No `npm install`/`uv sync` here — assume deps are installed (lint, not bootstrap).

---

### Task 5.5 — Doctor runtime connectivity checks

- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/workspace-dev-cli/files/scripts/cli/doctor.sh.template` (EJS template — note: this file currently contains **no** EJS tags; keep it tag-free)
- **Depends on:** 5.6 (the Python-migration tool the doctor checks for). If 5.6 standardises Python on `pg-schema-diff` like Go, doctor's "Go toolchain" check below covers it; if 5.6 chose alembic instead, swap that one check per the note. This phase's 5.6 chooses **pg-schema-diff** (see 5.6), so the Go-toolchain check is correct as written.
- **Goal:** Beyond "binary exists," prove the running stack is reachable: DB accepts connections, Redis answers PING, Jaeger query API responds. Warn loudly if a `services/` dir exists but the stack is down. A down dependency is a FAIL/WARN row + non-zero exit, never a silent green.
- **Anchor (current code to find — `doctor.sh.template`, ~lines 92–100, end of `cmd_doctor`):**
  ```bash
    print_panel_end
    echo ""

    if [ "$issues" -eq 0 ]; then
      print_success "Your environment is ready!"
    else
      print_error_card "Found $issues missing dependencies." "Please install them to run this workspace."
    fi
  }
  ```
- **Change:** Insert a new "Runtime Connectivity" panel **between** `print_panel_end` (end of the Service Dependencies panel) and the final `if [ "$issues" -eq 0 ]` block. The block below also adds a `pg-schema-diff` toolchain check gated on a Python service existing (Task 5.6 makes Python use it). Replace the anchor with:
  ```bash
    print_panel_end
    echo ""

    # ==========================================
    # RUNTIME CONNECTIVITY (FAIL LOUD)
    # ==========================================
    local has_services=false
    if [ -d "$ROOT_DIR/services" ] && [ -n "$(ls "$ROOT_DIR/services" 2>/dev/null)" ]; then
      has_services=true
    fi

    # Is any compose service actually running?
    local stack_up=false
    if [ -n "$($COMPOSE ps -q 2>/dev/null)" ]; then
      stack_up=true
    fi

    print_panel_start "Runtime Connectivity"

    if [ "$has_services" = true ] && [ "$stack_up" = false ]; then
      print_panel_row "${YELLOW}${ICON_WARN}${NC} Stack" "down" "run './dev start'"
      issues=$((issues + 1))
    fi

    # Postgres: real connection, not just a binary.
    if $COMPOSE config --services 2>/dev/null | grep -qw "db"; then
      if $stack_up && $COMPOSE exec -T db pg_isready -U postgres >/dev/null 2>&1; then
        print_panel_row "${GREEN}${ICON_SUCCESS}${NC} Postgres" "reachable" ":5432"
      else
        print_panel_row "${RED}${ICON_ERROR}${NC} Postgres" "unreachable" "db not accepting connections"
        issues=$((issues + 1))
      fi
    fi

    # Redis: PING must return PONG.
    if $COMPOSE config --services 2>/dev/null | grep -qw "redis"; then
      if $stack_up && $COMPOSE exec -T redis redis-cli ping 2>/dev/null | grep -qi "PONG"; then
        print_panel_row "${GREEN}${ICON_SUCCESS}${NC} Redis" "reachable" ":6379"
      else
        print_panel_row "${RED}${ICON_ERROR}${NC} Redis" "unreachable" "no PONG from redis"
        issues=$((issues + 1))
      fi
    fi

    # Jaeger: query API must answer.
    if $COMPOSE config --services 2>/dev/null | grep -qw "jaeger"; then
      local jcode
      jcode=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "http://localhost:16686/api/services" 2>/dev/null || echo "000")
      if [ "$jcode" = "200" ]; then
        print_panel_row "${GREEN}${ICON_SUCCESS}${NC} Jaeger" "reachable" ":16686"
      else
        print_panel_row "${RED}${ICON_ERROR}${NC} Jaeger" "unreachable" "query API returned ${jcode}"
        issues=$((issues + 1))
      fi
    fi

    print_panel_end
    echo ""

    # Python services use pg-schema-diff (Go toolchain) to apply migrations.
    if $needs_python; then
      print_panel_start "Migration Tooling"
      if command -v go >/dev/null 2>&1; then
        print_panel_row "${GREEN}${ICON_SUCCESS}${NC} Go (pg-schema-diff)" "available" "for Python migrate"
      else
        print_panel_row "${RED}${ICON_ERROR}${NC} Go (pg-schema-diff)" "missing" "Python './dev migrate' needs Go"
        issues=$((issues + 1))
      fi
      print_panel_end
      echo ""
    fi

    if [ "$issues" -eq 0 ]; then
      print_success "Your environment is ready!"
    else
      print_error_card "Found $issues issue(s)." "Install missing tools and run './dev start' before retrying."
      return 1
    fi
  }
  ```
- **Acceptance:**
  ```bash
  # regenerate demo workspace (go + python recommended so the Migration Tooling panel shows)
  cd $TMP && ./dev stop
  cd $TMP && ./dev doctor; echo "exit=$?"
  # Expect: "Runtime Connectivity" panel — WARN "Stack down", and RED Postgres/Redis/Jaeger
  #         (unreachable). error card. exit=1.
  cd $TMP && ./dev start --docker && ./dev doctor; echo "exit=$?"
  # Expect: green Postgres/Redis/Jaeger rows; "Your environment is ready!"; exit=0.
  ```
- **Guardrails:** Use compose **service** names (`db`, `redis`, `jaeger`) — NOT `<%= projectPrefix %>` container names. doctor.sh has no EJS context for project vars; keep it tag-free. `$COMPOSE` is exported by `lifecycle.sh` and sourced before `doctor.sh` in `dev.template`, so it is in scope. The `-T` flag on `exec` is required (no TTY in non-interactive runs). `$needs_python` is already computed earlier in `cmd_doctor` (the service-scan loop) — reuse it; do not recompute. Do not remove or alter the existing System/Service Dependencies panels.

---

### Task 5.6 — Python migrations baseline (declarative schema + apply-schema.sh)

- **Decision (1 line):** Standardise Python on the same declarative `db/schema.sql` + `scripts/apply-schema.sh` (pg-schema-diff) approach as Go — it is idempotent (declarative diff survives `./dev reset` re-running migrate), already the direction Python's `schema.sql` comment names, and makes Phase 0's `migrate` (which runs `services/<svc>/scripts/apply-schema.sh`) work uniformly across both languages with zero special-casing.
- **Files:**
  - NEW: `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/db/schema.sql.template` (move the existing root `schema.sql.template` into `db/` so pg-schema-diff's `--schema-dir ./db` finds it)
  - DELETE the old location: `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/schema.sql.template`
  - NEW: `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/scripts/apply-schema.sh.template`
  - EDIT: `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/generator.ts` (update the `!postgres` deletion path; ensure `apply-schema.sh` is executable)
- **Depends on:** none (Phase 0's `migrate` consumes the output). Task 5.5's doctor checks for the Go toolchain this script needs.
- **Anchor 1 (current Python `schema.sql.template`, full file, root location):**
  ```sql
  -- Declarative Schema definition
  -- Use a diffing engine (e.g. pg-schema-diff or atlas) to apply this to the database.

  CREATE TABLE examples (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT
  );

  CREATE TABLE idempotency_keys (
      key VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL,
      response_code INT,
      response_body TEXT,
      response_headers TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  ```
- **Anchor 2 (Go's `apply-schema.sh.template` — the pattern to mirror, full file):**
  ```bash
  #!/usr/bin/env bash
  set -e

  # Loads environment variables if .env exists
  if [ -f .env ]; then
      export $(cat .env | xargs)
  fi

  # Ensure database URL is available
  DB_URL=${DATABASE_URL:-"postgres://postgres:postgres@localhost:5432/<%= name %>?sslmode=disable"}

  echo "Applying declarative schema to database..."

  # Uses Stripe's pg-schema-diff to declaratively migrate the database
  # to match the state defined in db/schema.sql
  go run github.com/stripe/pg-schema-diff/cmd/pg-schema-diff apply \
      --dsn "$DB_URL" \
      --schema-dir ./db \
      --allow-destructive-changes

  echo "Schema applied successfully!"
  ```
- **Anchor 3 (Python `generator.ts`, ~lines 183–187, the `!postgres` deletion):**
  ```typescript
    if (!options.postgres) {
      tree.delete(`${projectRoot}/src/provider/database.py`);
      tree.delete(`${projectRoot}/src/provider/database_repository.py`);
      tree.delete(`${projectRoot}/schema.sql`);
    }
  ```
- **Change:**
  1. **Move the schema** into `db/`. Create `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/db/schema.sql.template` with the exact contents of Anchor 1, then delete the old `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/schema.sql.template`. (Content is unchanged; only the path moves so `--schema-dir ./db` resolves.)
  2. **Create** `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/scripts/apply-schema.sh.template` — identical to Go's (Anchor 2). Note: Python has no `.env`; the script falls back to the `DATABASE_URL` default, whose DB name `<%= name %>` matches the per-service Postgres database. Verbatim:
     ```bash
     #!/usr/bin/env bash
     set -e

     # Loads environment variables if .env exists
     if [ -f .env ]; then
         export $(cat .env | xargs)
     fi

     # Ensure database URL is available
     DB_URL=${DATABASE_URL:-"postgres://postgres:postgres@localhost:5432/<%= name %>?sslmode=disable"}

     echo "Applying declarative schema to database..."

     # Uses Stripe's pg-schema-diff to declaratively migrate the database
     # to match the state defined in db/schema.sql
     go run github.com/stripe/pg-schema-diff/cmd/pg-schema-diff apply \
         --dsn "$DB_URL" \
         --schema-dir ./db \
         --allow-destructive-changes

     echo "Schema applied successfully!"
     ```
  3. **Update `generator.ts`.** Replace the `!postgres` deletion (Anchor 3) so it removes the new schema path and the apply script when postgres is off:
     ```typescript
       if (!options.postgres) {
         tree.delete(`${projectRoot}/src/provider/database.py`);
         tree.delete(`${projectRoot}/src/provider/database_repository.py`);
         tree.delete(`${projectRoot}/db`);
         tree.delete(`${projectRoot}/scripts/apply-schema.sh`);
       }
     ```
  4. **Make `apply-schema.sh` executable.** Inspect how the Go generator sets the executable bit (search `go-microservice/generator.ts` for `apply-schema` / `chmod` / `0o755`). Mirror it exactly in `python-microservice/generator.ts`. If the Go generator does NOT set a mode (Phase 0's `migrate` likely invokes `bash apply-schema.sh` rather than `./apply-schema.sh`), do nothing here — match Go's actual behaviour. Add the equivalent only AFTER `generateFiles(...)` and only if Go does it.
- **Acceptance:**
  ```bash
  npm run build
  # regenerate: python service WITH postgres
  rm -rf $TMP; mkdir -p $TMP/services; printf '{}' >$TMP/nx.json; printf '{"name":"demo"}' >$TMP/package.json
  (cd $TMP && npx --yes nx g $GJSON:workspace-dev-cli --appName demo)
  (cd $TMP && npx --yes nx g $GJSON:python-microservice --name worker --postgres true)
  test -f $TMP/services/worker/db/schema.sql && echo "schema in db/ OK"
  test -f $TMP/services/worker/scripts/apply-schema.sh && echo "apply-schema OK"
  test ! -f $TMP/services/worker/schema.sql && echo "old root schema removed OK"
  cd $TMP && ./dev start --docker && ./dev migrate
  # Expect Phase 0 migrate to run worker/scripts/apply-schema.sh → "Schema applied successfully!"
  # Negative: postgres off removes both
  (cd $TMP && npx --yes nx g $GJSON:python-microservice --name nopg --postgres false)
  test ! -d $TMP/services/nopg/db && test ! -f $TMP/services/nopg/scripts/apply-schema.sh && echo "no-postgres cleanup OK"
  ```
- **Guardrails:** Do NOT introduce alembic (leave the unused `alembic` dep in pyproject alone for this phase — removing it is out of scope). Keep schema.sql contents byte-identical to the current file; only the directory changes. The apply script must be byte-identical to Go's so `./dev migrate` treats both languages the same. Do not edit Phase 0's `cmd_migrate`. `npm run build` is mandatory after the `generator.ts` edit.

---

### Task 5.7 — Python `.env.example`

- **Files:** NEW `/Users/ryannel/Workspace/groundWork/src/generators/python-microservice/files/.env.example.template` (EJS template)
- **Depends on:** none.
- **Goal:** Document every `Settings` field so a developer knows what to put in `.env`. (Confirmed: the Python generator currently emits **no** `.env`/`.env.example` at all.)
- **Anchor (current `config.py.template` Settings — the source of truth for every field, ~lines 4–36):**
  ```python
  class Settings(BaseSettings):
      model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

      server_port: int = <%= assignedPort %>
  <% if (postgres) { %>
      db_host: str = "localhost"
      db_port: int = 5432
      db_user: str = "postgres"
      db_password: str = "postgres"
      db_name: str = "<%= fileName %>"
  <% } %>
  <% if (messaging === 'redis' || websockets) { %>
      redis_url: str = "redis://localhost:6379"
  <% } %>
  <% if (messaging === 'kafka') { %>
      kafka_brokers: str = "localhost:9092"
  <% } %>
  <% if (messaging === 'gcp-pubsub') { %>
      pubsub_project_id: str = "local-project"
  <% } %>
  <% if (llm) { %>
      llm_api_key: Optional[str] = None
      llm_base_url: Optional[str] = None
      llm_model: str = "gpt-4o"
  <% } %>
  ```
  Also: `OTEL_EXPORTER_OTLP_ENDPOINT` is consumed by Phase 3's OTel setup (the OTLP exporter env var; same one Go's `.env.template` and docker-compose inject). Settings uses `extra='ignore'`, so OTEL vars are read from the environment by the OTel SDK directly, not via `Settings` — document them anyway.
- **Change:** Create `.env.example.template` with EJS guards mirroring `config.py.template` field-for-field (pydantic-settings reads UPPER-CASE env names case-insensitively, matching the snake_case attribute names):
  ```bash
  # Environment Configuration
  # Copy this file to .env and adjust values for your local setup.

  # HTTP server port for this service.
  SERVER_PORT=<%= assignedPort %>
  <% if (postgres) { %>
  # Postgres connection (database_url is derived from these).
  DB_HOST=localhost
  DB_PORT=5432
  DB_USER=postgres
  DB_PASSWORD=postgres
  DB_NAME=<%= fileName %>
  <% } %>
  <% if (messaging === 'redis' || websockets) { %>
  # Redis connection URL.
  REDIS_URL=redis://localhost:6379
  <% } %>
  <% if (messaging === 'kafka') { %>
  # Kafka bootstrap brokers (comma-separated).
  KAFKA_BROKERS=localhost:9092
  <% } %>
  <% if (messaging === 'gcp-pubsub') { %>
  # GCP Pub/Sub project id (use the emulator project locally).
  PUBSUB_PROJECT_ID=local-project
  <% } %>
  <% if (llm) { %>
  # LLM gateway credentials.
  LLM_API_KEY=
  LLM_BASE_URL=
  LLM_MODEL=gpt-4o
  <% } %>
  # OpenTelemetry — consumed by the OTel SDK (Phase 3), not by Settings.
  # OTLP collector endpoint (Jaeger gRPC ingest).
  OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
  OTEL_SERVICE_NAME=<%= fileName %>
  ```
- **Acceptance:**
  ```bash
  # regenerate: python service with postgres + redis + llm to exercise the guards
  (cd $TMP && npx --yes nx g $GJSON:python-microservice --name worker --postgres true --messaging redis --llm true)
  cat $TMP/services/worker/.env.example
  # Expect: SERVER_PORT, DB_* block, REDIS_URL, LLM_* block, OTEL_* lines.
  # No generator.ts change → no npm run build required (but harmless).
  ```
- **Guardrails:** This is a static-content `.template` (EJS guards only mirror `config.py`'s `<% if %>` blocks — same conditions, same option names: `postgres`, `messaging`, `websockets`, `llm`). Do not add fields that aren't in `Settings`. Use `<%= assignedPort %>` and `<%= fileName %>` exactly as `config.py.template` does. The DB OTLP endpoint port is `4317` (gRPC) to match Go's `.env.template`. Do not create an actual `.env` (only `.env.example`).

---

### Task 5.8 — Next.js Zod schema + response validation

- **Files:**
  - `/Users/ryannel/Workspace/groundWork/src/generators/nextjs-app/files/lib/schemas/index.ts` (**STATIC file — no `.template` suffix; do NOT add EJS tags**)
  - `/Users/ryannel/Workspace/groundWork/src/generators/nextjs-app/files/lib/api/fetcher.ts.template` (EJS template)
- **Depends on:** none. (`zod ^3.24.1` is already in the Next.js `package.json`.)
- **Goal:** Provide an example Zod schema and a `customFetch` variant that validates the response body against a schema, throwing a typed error on mismatch instead of returning unchecked `unknown`.
- **Anchor 1 (current `lib/schemas/index.ts`, full file — empty barrel):**
  ```typescript
  /**
   * Zod schemas barrel export.
   *
   * Define your domain schemas in this directory and re-export them here.
   * Components import from `@/lib/schemas` — never from individual files.
   *
   * Example:
   *   export { userSchema, type User } from './user';
   *   export { itemSchema, type Item } from './item';
   */
  ```
- **Anchor 2 (current `fetcher.ts.template`, ~lines 53–95 — `customFetch` + `swrFetcher`):**
  ```typescript
  export async function customFetch<T = unknown>(
    path: string,
    init?: RequestInit
  ): Promise<T> {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}${path}`;
  ```
  (…through the end of the file, `swrFetcher`.)
- **Change:**
  1. **Replace `lib/schemas/index.ts`** (static file) with a domain-neutral example schema + the barrel guidance. Keep it generic — no sandbox/product-specific names:
     ```typescript
     import { z } from "zod";

     /**
      * Zod schemas barrel.
      *
      * Define domain schemas in this directory and re-export them here so
      * components import from `@/lib/schemas` — never from individual files.
      *
      * The example below is a generic health/status payload. Replace it with
      * your real domain schemas (e.g. `export { userSchema, type User } from './user';`).
      */

     /** Example schema: a generic API status/health envelope. */
     export const statusSchema = z.object({
       status: z.string(),
       timestamp: z.string().optional(),
     });

     export type Status = z.infer<typeof statusSchema>;
     ```
  2. **Add a validating fetch** to `fetcher.ts.template`. Add a `zod` import at the top of the file (after the file's doc comment, before `export class ApiError`):
     ```typescript
     import type { ZodType } from "zod";
     ```
     Then add a `ValidationError` class immediately after the `ApiError` class (after its closing `}`):
     ```typescript

     /** Thrown when an API response fails schema validation. */
     export class ValidationError extends Error {
       public readonly issues: unknown;

       constructor(path: string, issues: unknown) {
         super(`Response from ${path} failed schema validation`);
         this.name = "ValidationError";
         this.issues = issues;
       }
     }
     ```
     Then add a `validatedFetch` function immediately after `customFetch` (before `swrFetcher`):
     ```typescript

     /**
      * Like `customFetch`, but validates the response body against a Zod schema.
      * Returns the parsed, typed value. Throws {@link ValidationError} on mismatch
      * and {@link ApiError} on non-2xx — fail loud, never return unchecked data.
      *
      * @param path - API path (e.g. `/v1/items`)
      * @param schema - Zod schema describing the expected response shape
      * @param init - Standard RequestInit options
      */
     export async function validatedFetch<T>(
       path: string,
       schema: ZodType<T>,
       init?: RequestInit
     ): Promise<T> {
       const raw = await customFetch<unknown>(path, init);
       const result = schema.safeParse(raw);
       if (!result.success) {
         throw new ValidationError(path, result.error.issues);
       }
       return result.data;
     }
     ```
- **Acceptance:**
  ```bash
  # regenerate: nextjs service
  (cd $TMP && npx --yes nx g $GJSON:nextjs-app --name web --apiProxy true)
  cd $TMP/services/web && npm install && npx tsc --noEmit
  # Expect: no type errors. lib/schemas/index.ts exports statusSchema/Status;
  #         lib/api/fetcher.ts exports validatedFetch + ValidationError.
  cd $TMP/services/web && npm run lint   # eslint clean
  ```
- **Guardrails:** `lib/schemas/index.ts` is a STATIC file (no `.template`) — write plain TS, no EJS. `fetcher.ts.template` IS EJS but contains no EJS tags currently — do not introduce any. Keep the example schema domain-neutral (CLAUDE.md forbids leaking any specific product domain). Do not change the existing `customFetch`/`swrFetcher`/`ApiError`/`getBaseUrl` behaviour — only add. Import `ZodType` as a `type` import to keep it erasable.

---

### Task 5.9 — Next.js WebSocket-config URL validation

- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/nextjs-app/files/app/api/config/route.ts.template` (EJS template — currently contains no EJS tags; keep it tag-free)
- **Depends on:** none.
- **Goal:** Validate `API_URL` before transforming it to a `ws://`/`wss://` URL. Malformed config must return HTTP 500 with a clear message, not silently emit a broken WebSocket URL.
- **Anchor (current `route.ts.template`, full file):**
  ```typescript
  import { NextResponse } from "next/server";

  /**
   * Exposes runtime configuration to the client.
   *
   * This is how the browser discovers the WebSocket URL without any
   * NEXT_PUBLIC_ build-time variables. The single API_URL env var
   * drives both the HTTP proxy and this config endpoint.
   */
  export function GET() {
      const apiUrl = process.env.API_URL ?? "http://localhost:4000";
      const wsUrl = apiUrl.replace(/^http/, "ws") + "/ws";

      return NextResponse.json({ wsUrl });
  }
  ```
- **Change:** Replace the entire file with a version that parses and validates `API_URL` before transforming it:
  ```typescript
  import { NextResponse } from "next/server";

  /**
   * Exposes runtime configuration to the client.
   *
   * This is how the browser discovers the WebSocket URL without any
   * NEXT_PUBLIC_ build-time variables. The single API_URL env var
   * drives both the HTTP proxy and this config endpoint.
   *
   * API_URL is validated before transforming http(s) → ws(s). A malformed
   * value fails loud with a 500 rather than emitting a broken WebSocket URL.
   */
  export function GET() {
      const apiUrl = process.env.API_URL ?? "http://localhost:4000";

      let parsed: URL;
      try {
          parsed = new URL(apiUrl);
      } catch {
          return NextResponse.json(
              { detail: "API_URL is not a valid URL" },
              { status: 500 }
          );
      }

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return NextResponse.json(
              { detail: "API_URL must use http or https" },
              { status: 500 }
          );
      }

      // http → ws, https → wss (anchored to the protocol, not a blind replace).
      const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
      parsed.protocol = wsProtocol;
      const wsUrl = `${parsed.origin}/ws`;

      return NextResponse.json({ wsUrl });
  }
  ```
- **Acceptance:**
  ```bash
  cd $TMP/services/web && npx tsc --noEmit   # no type errors
  cd $TMP/services/web && npm run lint       # eslint clean
  # Manual reasoning to confirm: API_URL=https://api.example.com → {"wsUrl":"wss://api.example.com/ws"};
  #   API_URL="not a url" → 500 {"detail":"API_URL is not a valid URL"};
  #   default http://localhost:4000 → {"wsUrl":"ws://localhost:4000/ws"} (unchanged happy path).
  ```
- **Guardrails:** Use the `URL` constructor for parsing (`URL.origin` drops any trailing slash/path, which is the desired normalisation). Use 500 (server-side misconfiguration of an env var) — the task allows 400/handle; 500 is correct here because the fault is server config, not client input. Keep it a static-style TS file (the `.template` carries no EJS — do not add any). Preserve the `/ws` suffix and the `{ wsUrl }` response shape so the client config contract is unchanged.

---

## Definition of done for Phase 5

- [ ] **5.1** `cmd_reset` added to `lifecycle.sh.template`; `reset` row in `dev.template` help. `./dev reset --docker` cycles stop → clean --hard → start → migrate cleanly.
- [ ] **5.2** `cmd_health` (+ `_svc_port`, `_svc_health_path`) added; `health` row in help. `./dev health` polls every app service + Jaeger, prints a panel, exits 1 when anything is down.
- [ ] **5.3** `cmd_logs` accepts an optional `<service>` arg (native log file or compose container); no-arg behaviour unchanged; unknown service errors with exit 1.
- [ ] **5.4** `cmd_lint` runs golangci-lint / eslint / ruff + black by marker detection; `ruff` + `black` added to Python `pyproject.toml` `[dev]`; missing golangci-lint warns loudly.
- [ ] **5.5** `cmd_doctor` adds a Runtime Connectivity panel proving Postgres/Redis/Jaeger reachability + a stack-down WARN + a pg-schema-diff (Go) tooling check for Python; exits 1 on any issue. Uses compose service names, not container names.
- [ ] **5.6** Python schema moved to `db/schema.sql`; `scripts/apply-schema.sh` (pg-schema-diff, identical to Go) added; `generator.ts` deletes both when `--postgres false`; `./dev migrate` applies the Python schema. `npm run build` green.
- [ ] **5.7** `python-microservice/files/.env.example.template` documents every `Settings` field (guarded by the same EJS conditions as `config.py`) plus the Phase 3 OTLP endpoint.
- [ ] **5.8** `lib/schemas/index.ts` exports a domain-neutral example Zod schema; `fetcher.ts` adds `validatedFetch` + `ValidationError`; `tsc --noEmit` and `npm run lint` clean.
- [ ] **5.9** `app/api/config/route.ts` validates `API_URL` (URL parse + http/https protocol guard), returns 500 on malformed config, and maps http→ws / https→wss; happy path unchanged.
- [ ] Full phase acceptance gate (top of doc) passes end-to-end on a regenerated demo workspace.
- [ ] `npm run build` run after every `generator.ts` edit (Tasks 5.6).
