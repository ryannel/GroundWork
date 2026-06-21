# Phase 0 — Verification harness + CI

**Phase goal:** Convert the generated system-test suite from stubs into a real, service-discovery-driven integration harness that runs against the dev stack, and add a `./dev migrate` command plus a GitHub Actions CI pipeline. Every check must FAIL LOUD when run in CI (via `GROUNDWORK_REQUIRE_*` env flags) instead of silently skipping to green. This phase is the spine that all later phases depend on for verification.

**Phase acceptance gate:** All of the following must pass.

```bash
# 0. Build generators (always after editing any generator.ts)
cd /Users/ryannel/Workspace/groundWork && npm run build

# 1. Fast structural meta-test still passes
cd /Users/ryannel/Workspace/groundWork && ./dev test generation

# 2. Regenerate a sample workspace with a Go service (validated pattern)
GJSON=/Users/ryannel/Workspace/groundWork/generators.json
TMP=/Users/ryannel/Workspace/groundWork/.sandboxes/demo
rm -rf $TMP; mkdir -p $TMP/services; printf '{}' > $TMP/nx.json; printf '{"name":"demo"}' > $TMP/package.json
(cd $TMP && npx --yes nx g $GJSON:workspace-dev-cli --appName demo)
(cd $TMP && npx --yes nx g $GJSON:go-microservice --name api --auth service)

# 3. End-to-end harness run against the dev stack (Go service "api" on port 4000)
cd $TMP && ./dev start && ./dev migrate && \
  GROUNDWORK_REQUIRE_TRACES=1 GROUNDWORK_REQUIRE_SERVICES=1 ./dev test integration
cd $TMP && ./dev clean --hard
```

Expected results:
- `npm run build`: exits 0.
- `./dev test generation`: exits 0 (159 cases pass; no references to the deleted `docker-compose.test.yml`).
- Regeneration: both generators exit 0; `$TMP/tests/system/conftest.py` and `$TMP/docker-compose.yml` exist; `$TMP/tests/system/docker-compose.test.yml` does **not** exist.
- `./dev start`: boots infra (db/redis/pubsub/jaeger via docker) + the Go `api` service natively via `air`.
- `./dev migrate`: creates database `api` and applies its schema.
- `./dev test integration`: ALL system tests PASS. Specifically `test_every_service_is_healthy[api]` passes (200, `status == "ok"`, `checks.db == "ok"`), and `test_instrumented_get_exports_span[api]` PASSES — a span with `serviceName == "api"` is found in jaeger via the query API. Python/Next span tests, if any service of that type is present, are `xfail` (expected-fail), not errors.

**Verified facts this phase relies on (do not re-derive):**
- The Go `.env.template` already sets `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317`. The dev-stack jaeger maps `4317:4317` to the host, so a **natively-run** Go service exports spans to host `localhost:4317` → jaeger successfully. The Go span assertion is therefore expected to PASS in Phase 0.
- The Go OTel service name comes from `otelhttp.NewMiddleware("<%= name %>", …)` in `router.go.template`. For all kebab/lowercase service names, Nx `names(name).fileName === name`, and the docker-compose service **key** is `fileName`. Therefore `otel_name == compose service key`. This is the discriminator the harness uses.
- The Go health endpoint returns `{"status":"ok","checks":{"db":"ok"}}` when healthy.
- The Python health endpoint (`/health`, `/healthz`) returns `{"status":"alive"}` with **no** `checks` field. The harness must NOT demand `status == "ok"` for Python.
- The Python `.env` has **no** OTLP endpoint, so Python trace export is unverifiable until Phase 3. The span test must `xfail` non-Go services.
- There is **no** `./dev up` command. The lifecycle command is `./dev start` (`cmd_start`). Use `./dev start` everywhere.
- `apply-schema.sh` exists only for Go services (`services/<svc>/scripts/apply-schema.sh`) and uses `go run github.com/stripe/pg-schema-diff` (needs Go on the host). Python services have no `apply-schema.sh`; `migrate` only creates their DB.

---

### Task 0.1 — Delete the parallel test-compose file

- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/system-test-runner/files/tests/system/docker-compose.test.yml.template`
- **Depends on:** none
- **Goal:** Remove the parallel infra-only test stack; the harness will run against the dev stack instead.
- **Anchor (current code to find):** the file `docker-compose.test.yml.template` begins:
  ```yaml
  # src/generators/system-test-runner/files/tests/system/docker-compose.test.yml.template, line 1
  version: '3.8'

  services:
    db:
      image: ankane/pgvector:v0.5.0
      container_name: <%= projectPrefix %>-db-test
  ```
- **Change:** Delete the file entirely.
  ```bash
  rm /Users/ryannel/Workspace/groundWork/src/generators/system-test-runner/files/tests/system/docker-compose.test.yml.template
  ```
- **Acceptance:**
  ```bash
  test ! -f /Users/ryannel/Workspace/groundWork/src/generators/system-test-runner/files/tests/system/docker-compose.test.yml.template && echo OK
  ```
  Expect `OK`.
- **Guardrails:** Do NOT touch the dev-stack `docker-compose.yml.template` in `workspace-dev-cli` — that is the real stack. Only delete the `*.test.yml.template`.

---

### Task 0.2 — Drop pytest-docker, add PyYAML to test deps

- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/system-test-runner/files/tests/pyproject.toml.template`
- **Depends on:** none
- **Goal:** Remove the now-unused `pytest-docker` dependency and add `PyYAML` (used by conftest to parse the workspace compose file).
- **Anchor (current code to find):**
  ```toml
  # pyproject.toml.template, lines 6-14
  dependencies = [
      "pytest>=8.0.0",
      "pytest-asyncio>=0.23.0",
      "pytest-docker>=3.1.1",
      "pytest-timeout>=2.3.1",
      "httpx>=0.27.0",
      "tenacity>=8.2.3",
      "psycopg[binary]>=3.1.18",
  ]
  ```
- **Change:** Replace that `dependencies` block with:
  ```toml
  dependencies = [
      "pytest>=8.0.0",
      "pytest-asyncio>=0.23.0",
      "pytest-timeout>=2.3.1",
      "httpx>=0.27.0",
      "tenacity>=8.2.3",
      "psycopg[binary]>=3.1.18",
      "PyYAML>=6.0",
  ]
  ```
- **Acceptance:**
  ```bash
  grep -q "PyYAML" /Users/ryannel/Workspace/groundWork/src/generators/system-test-runner/files/tests/pyproject.toml.template && \
  ! grep -q "pytest-docker" /Users/ryannel/Workspace/groundWork/src/generators/system-test-runner/files/tests/pyproject.toml.template && echo OK
  ```
  Expect `OK`.
- **Guardrails:** Do NOT change `[tool.pytest.ini_options]` (keep `asyncio_mode = "auto"` and `testpaths = ["system"]`). Keep version pins in the same `>=` style.

---

### Task 0.3 — Rewrite conftest.py: service discovery + health-gated cluster + generic state reset

- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/system-test-runner/files/tests/system/conftest.py.template`
- **Depends on:** 0.1, 0.2
- **Goal:** Replace pytest-docker fixtures and the no-op `cluster` with: a `services_manifest` session fixture that discovers app services from the workspace `docker-compose.yml`; a health-gated `cluster` fixture; and a generic, per-DB `pure_state_reset`.
- **Anchor (current code to find):** the whole file currently is (conftest.py.template, lines 1-89):
  ```python
  import os
  import uuid
  import pytest
  import httpx
  import psycopg
  from tenacity import retry, stop_after_delay, wait_exponential

  @pytest.fixture(scope="session")
  def docker_compose_file(pytestconfig):
      """Path to the root docker-compose file."""
      return os.path.join(os.path.dirname(__file__), "docker-compose.test.yml")

  @pytest.fixture(scope="session")
  def docker_compose_project_name():
      """Prefix for the compose project."""
      return "<%= projectPrefix %>-tests"

  @pytest.fixture(scope="session")
  def cluster(docker_ip, docker_services):
      """
      Ensure the docker-compose stack is up and healthy.
      """
      os.environ["COMPOSE_PROFILES"] = "all"
      ...
  @pytest.fixture(scope="function", autouse=True)
  def pure_state_reset():
      ...
      dsn = "postgresql://postgres:postgres@localhost:5433/<%= projectPrefix %>"
      tables = [
          # List tables in dependency order
      ]
      ...
      yield
  ```
- **Change:** Replace the ENTIRE contents of `conftest.py.template` with the block below. (The only EJS interpolation that survives is none — discovery is fully dynamic; do not reintroduce `<%= projectPrefix %>`.)
  ```python
  """Shared fixtures for the system test suite.

  This suite runs against the DEV STACK (`./dev start`), not a parallel
  test-compose. Services and their ports/DBs are DISCOVERED at runtime by
  parsing the workspace ../../docker-compose.yml — there are no hardcoded
  ports and no manifest file. Adding a service to the workspace automatically
  brings it under test.

  FAIL LOUD, NOT SILENT: when GROUNDWORK_REQUIRE_SERVICES=1 (set by CI and by
  `./dev test integration`), an unreachable service is a FAILURE. Locally
  (flag unset) the same condition skips, so the inner loop stays ergonomic.
  """

  import os
  import uuid
  from pathlib import Path

  import httpx
  import psycopg
  import pytest
  import yaml
  from tenacity import RetryError, retry, stop_after_delay, wait_exponential

  # system/ -> tests/ -> workspace root
  WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
  COMPOSE_PATH = WORKSPACE_ROOT / "docker-compose.yml"
  SERVICES_DIR = WORKSPACE_ROOT / "services"

  # Postgres on the dev stack is published to host localhost:5432.
  PG_HOST = "localhost"
  PG_PORT = 5432
  PG_USER = "postgres"
  PG_PASSWORD = "postgres"

  # Jaeger query API (UI + /api/services + /api/traces) on the dev stack.
  JAEGER_URL = os.environ.get("TRACE_BACKEND_URL", "http://localhost:16686")

  REQUIRE_SERVICES = os.environ.get("GROUNDWORK_REQUIRE_SERVICES") == "1"


  def _infer_type(name: str) -> str:
      """Infer service type from on-disk markers under services/<name>/."""
      svc = SERVICES_DIR / name
      if (svc / "go.mod").exists():
          return "go"
      if (svc / "pyproject.toml").exists():
          return "python"
      if (svc / "package.json").exists():
          return "next"
      return "unknown"


  def _health_path_for(svc_type: str) -> str:
      if svc_type == "next":
          return "/api/healthz"
      # Go (huma) and Python (FastAPI) both expose /health.
      return "/health"


  def _discover_services() -> list[dict]:
      """Parse the workspace docker-compose.yml and return APP services only.

      Discriminator: an APP service has `build.context` starting with
      `./services/`; infra services use `image:` and are skipped.
      """
      if not COMPOSE_PATH.exists():
          return []
      doc = yaml.safe_load(COMPOSE_PATH.read_text()) or {}
      services = doc.get("services", {}) or {}
      discovered: list[dict] = []
      for name, spec in services.items():
          spec = spec or {}
          build = spec.get("build")
          context = build.get("context") if isinstance(build, dict) else None
          if not (isinstance(context, str) and context.startswith("./services/")):
              continue  # infra (image:-based) service

          # host_port = left side of the first "X:Y" ports mapping.
          host_port = None
          for mapping in spec.get("ports", []) or []:
              left = str(mapping).split(":")[0]
              if left.isdigit():
                  host_port = int(left)
                  break

          # db_name from environment DB_NAME (supports list or dict form),
          # default to the service key.
          db_name = name
          env = spec.get("environment")
          env_pairs: dict[str, str] = {}
          if isinstance(env, list):
              for item in env:
                  if "=" in str(item):
                      k, v = str(item).split("=", 1)
                      env_pairs[k] = v
          elif isinstance(env, dict):
              env_pairs = {k: str(v) for k, v in env.items()}
          if "DB_NAME" in env_pairs:
              # value may be "${DB_NAME:-svc}"; take the default after :- if present.
              raw = env_pairs["DB_NAME"]
              if ":-" in raw:
                  db_name = raw.split(":-", 1)[1].rstrip("}")
              elif not raw.startswith("$"):
                  db_name = raw

          svc_type = _infer_type(name)
          discovered.append(
              {
                  "name": name,
                  "host_port": host_port,
                  "db_name": db_name,
                  # otel_name == compose service key == Go otelhttp.NewMiddleware name.
                  "otel_name": name,
                  "health_path": _health_path_for(svc_type),
                  "type": svc_type,
              }
          )
      return discovered


  @pytest.fixture(scope="session")
  def services_manifest() -> list[dict]:
      """Discovered APP services. Empty list is allowed (no services yet)."""
      return _discover_services()


  def _base_url(svc: dict) -> str:
      return f"http://localhost:{svc['host_port']}"


  @pytest.fixture(scope="session")
  def cluster(services_manifest):
      """Health-gate the dev stack: poll every discovered service's health
      endpoint plus the jaeger query API. FAIL if REQUIRE_SERVICES and anything
      is unreachable after the timeout; otherwise skip (local inner loop)."""

      @retry(stop=stop_after_delay(120), wait=wait_exponential(multiplier=1, min=1, max=8))
      def _wait():
          unreachable = []
          for svc in services_manifest:
              if svc["host_port"] is None:
                  continue
              url = f"{_base_url(svc)}{svc['health_path']}"
              try:
                  r = httpx.get(url, timeout=2.0)
                  if r.status_code != 200:
                      unreachable.append(url)
              except httpx.HTTPError:
                  unreachable.append(url)
          try:
              j = httpx.get(f"{JAEGER_URL}/api/services", timeout=2.0)
              if j.status_code != 200:
                  unreachable.append(f"{JAEGER_URL}/api/services")
          except httpx.HTTPError:
              unreachable.append(f"{JAEGER_URL}/api/services")
          if unreachable:
              raise RuntimeError(f"unreachable: {unreachable}")

      try:
          _wait()
      except (RetryError, RuntimeError) as exc:
          if REQUIRE_SERVICES:
              pytest.fail(
                  f"dev stack not healthy and GROUNDWORK_REQUIRE_SERVICES=1: {exc}"
              )
          pytest.skip(f"dev stack not reachable (run `./dev start`): {exc}")
      return services_manifest


  @pytest.fixture
  def trace_id():
      """A W3C trace id (32 hex chars)."""
      return uuid.uuid4().hex


  @pytest.fixture
  async def api_client(trace_id):
      """Async HTTPX client that stamps a W3C traceparent so test traffic is
      identifiable in jaeger."""
      span_id = uuid.uuid4().hex[:16]
      traceparent = f"00-{trace_id}-{span_id}-01"
      headers = {"traceparent": traceparent, "x-test-run": "system-test"}
      async with httpx.AsyncClient(headers=headers, timeout=10.0) as client:
          yield client


  @pytest.fixture(scope="function", autouse=True)
  def pure_state_reset(services_manifest):
      """Truncate every table in each discovered service's database before each
      test. Tolerates a missing DB (not yet created) and an empty table set."""
      for svc in services_manifest:
          dsn = (
              f"postgresql://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{svc['db_name']}"
          )
          try:
              with psycopg.connect(dsn, autocommit=True) as conn:
                  with conn.cursor() as cur:
                      cur.execute(
                          "SELECT tablename FROM pg_tables WHERE schemaname='public'"
                      )
                      tables = [row[0] for row in cur.fetchall()]
                      if tables:
                          joined = ", ".join(f'"{t}"' for t in tables)
                          cur.execute(
                              f"TRUNCATE {joined} RESTART IDENTITY CASCADE"
                          )
          except psycopg.OperationalError:
              pass  # DB may not exist yet (pre-migrate); tolerate it.
      yield
  ```
- **Acceptance:** verified end-to-end by Task 0.10 (regenerate + `./dev test integration`). Standalone sanity:
  ```bash
  python3 -c "import ast,sys; ast.parse(open('/Users/ryannel/Workspace/groundWork/src/generators/system-test-runner/files/tests/system/conftest.py.template').read()); print('parses OK')"
  ```
  Expect `parses OK`. (The `.template` file is valid Python because there are no EJS tags left in it.)
- **Guardrails:** Do NOT reintroduce `docker_compose_file`, `docker_compose_project_name`, or `docker_services`. Do NOT hardcode ports (5430/5433/4000/4001) or a `projectPrefix` DSN. The compose path is exactly `parent.parent.parent / "docker-compose.yml"` (system → tests → root) — do not change the parent count.

---

### Task 0.4 — Rewrite test_system.py: parametrized real tests over discovered services

- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/system-test-runner/files/tests/system/test_system.py.template`
- **Depends on:** 0.3
- **Goal:** Replace the commented-out / `pass` stubs with real parametrized tests: every service healthy; instrumented GET exports a span; trace context propagates unchanged; CRUD round-trip (skipped until Phase 4).
- **Anchor (current code to find):** test_system.py.template currently (lines 1-13, 67, 87):
  ```python
  import uuid
  import asyncio
  import pytest
  import httpx

  @pytest.mark.asyncio
  async def test_cluster_health(cluster, api_client: httpx.AsyncClient):
      ...
      url = "http://localhost:5430/health"
      ...
      # assert healthy, f"Service never became healthy at {url}"
  ...
      pass   # test_idempotency_middleware
  ...
      pass   # test_defensive_load_shedding
  ```
- **Change:** Replace the ENTIRE contents of `test_system.py.template` with:
  ```python
  """Real, discovery-driven system tests. Parametrized over every APP service
  found in the workspace docker-compose.yml (see conftest.services_manifest).

  FAIL LOUD: the span tests are gated by GROUNDWORK_REQUIRE_TRACES=1. When that
  flag is set (CI, `./dev test integration`), an unreachable backend or a
  missing span is a FAILURE, not a skip.
  """

  import os
  import time
  import uuid

  import httpx
  import pytest

  from conftest import JAEGER_URL, _base_url, _discover_services

  REQUIRE_TRACES = os.environ.get("GROUNDWORK_REQUIRE_TRACES") == "1"
  # BatchSpanProcessor flushes ~every 5s; give spans time to land.
  EXPORT_TIMEOUT_S = 30

  # Build params at import time so pytest can show one case per service. An empty
  # workspace yields zero params (and the suite is a no-op, which is correct).
  _SERVICES = _discover_services()
  _PARAMS = [pytest.param(s, id=s["name"]) for s in _SERVICES]


  def _fetch_trace(trace_id: str) -> dict | None:
      deadline = time.time() + EXPORT_TIMEOUT_S
      while time.time() < deadline:
          resp = httpx.get(f"{JAEGER_URL}/api/traces/{trace_id}", timeout=3.0)
          if resp.status_code == 200 and resp.json().get("data"):
              return resp.json()["data"][0]
          time.sleep(1)
      return None


  @pytest.mark.asyncio
  @pytest.mark.parametrize("svc", _PARAMS)
  async def test_every_service_is_healthy(cluster, api_client: httpx.AsyncClient, svc):
      """Each discovered service answers its health endpoint."""
      if svc["host_port"] is None:
          pytest.skip(f"{svc['name']} has no published host port")
      url = f"{_base_url(svc)}{svc['health_path']}"
      resp = await api_client.get(url, timeout=5.0)
      assert resp.status_code == 200, f"{url} -> {resp.status_code}"
      data = resp.json()
      if svc["type"] == "go":
          assert data.get("status") == "ok", f"{svc['name']} status: {data}"
          assert data.get("checks", {}).get("db") == "ok", f"{svc['name']} db: {data}"
      else:
          # Python FastAPI returns {"status": "alive"}; Next returns its own shape.
          assert data.get("status") in {"ok", "alive", "ready"}, f"{svc['name']}: {data}"


  @pytest.mark.parametrize("svc", _PARAMS)
  def test_instrumented_get_exports_span(cluster, svc):
      """A traced GET to an instrumented route produces a span that reaches jaeger.

      Only Go is verifiable in Phase 0: the Go scaffold ships
      OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 in .env, so native export
      works. Python has no OTLP endpoint until Phase 3, and Next is unverified —
      both xfail here.
      """
      if svc["type"] != "go":
          pytest.xfail(f"{svc['type']} trace export not wired until a later phase (TODO)")
      if svc["host_port"] is None:
          pytest.skip(f"{svc['name']} has no published host port")

      trace_id = uuid.uuid4().hex
      span_id = uuid.uuid4().hex[:16]
      # The trailing -01 (sampled) flag is load-bearing: ParentBased(AlwaysSample)
      # inherits it. -00 exports nothing.
      traceparent = f"00-{trace_id}-{span_id}-01"
      # /health is excluded from tracing by the otelhttp middleware; use a real route.
      probe = os.environ.get("TRACE_PROBE_PATH", "/api/v1/entities")

      resp = httpx.get(
          f"{_base_url(svc)}{probe}",
          headers={"traceparent": traceparent},
          timeout=5.0,
      )
      assert resp.status_code == 200, f"probe failed: {resp.status_code}"

      trace = _fetch_trace(trace_id)
      if trace is None:
          msg = (
              f"no span with trace_id={trace_id} reached jaeger within "
              f"{EXPORT_TIMEOUT_S}s — the OTLP export pipeline is broken"
          )
          if REQUIRE_TRACES:
              pytest.fail(msg)
          pytest.skip(msg)

      services = {p["serviceName"] for p in trace["processes"].values()}
      assert svc["otel_name"] in services, (
          f"expected span from '{svc['otel_name']}', got {services}"
      )
      assert trace["spans"], "trace arrived but contains no spans"


  @pytest.mark.parametrize("svc", _PARAMS)
  def test_trace_context_propagates_unchanged(cluster, svc):
      """The service continues the incoming trace id rather than starting a new one."""
      if svc["type"] != "go":
          pytest.xfail(f"{svc['type']} trace export not wired until a later phase (TODO)")
      if svc["host_port"] is None:
          pytest.skip(f"{svc['name']} has no published host port")

      trace_id = uuid.uuid4().hex
      span_id = uuid.uuid4().hex[:16]
      traceparent = f"00-{trace_id}-{span_id}-01"
      probe = os.environ.get("TRACE_PROBE_PATH", "/api/v1/entities")

      httpx.get(
          f"{_base_url(svc)}{probe}",
          headers={"traceparent": traceparent},
          timeout=5.0,
      )
      trace = _fetch_trace(trace_id)
      if trace is None:
          msg = "injected trace context was not propagated/exported"
          if REQUIRE_TRACES:
              pytest.fail(msg)
          pytest.skip(msg)
      # Compare numerically so leading-zero normalisation doesn't cause a false fail.
      assert int(trace["traceID"], 16) == int(trace_id, 16)


  @pytest.mark.skip(reason="real CRUD lands in Phase 4")
  @pytest.mark.asyncio
  @pytest.mark.parametrize("svc", _PARAMS)
  async def test_crud_round_trip(cluster, api_client: httpx.AsyncClient, svc):
      """POST then GET an entity and assert the round-trip through the real DB."""
      if svc["type"] != "go":
          pytest.skip("CRUD round-trip targets Go services for now")
      base = _base_url(svc)
      payload = {"name": "phase0-roundtrip"}
      created = await api_client.post(f"{base}/api/v1/entities", json=payload, timeout=5.0)
      assert created.status_code in (200, 201), created.text
      entity_id = created.json().get("id")
      assert entity_id, "POST did not return an id"
      fetched = await api_client.get(f"{base}/api/v1/entities/{entity_id}", timeout=5.0)
      assert fetched.status_code == 200
      assert fetched.json().get("name") == payload["name"]
  ```
- **Change (delete the now-merged trace file):** the standalone trace test is merged into the parametrized suite above. Delete it so its module-level `skipif` (which targets the old `localhost:4001`) does not run in parallel:
  ```bash
  rm /Users/ryannel/Workspace/groundWork/src/generators/system-test-runner/files/tests/system/test_traces.py.template
  ```
- **Acceptance:**
  ```bash
  python3 -c "import ast; ast.parse(open('/Users/ryannel/Workspace/groundWork/src/generators/system-test-runner/files/tests/system/test_system.py.template').read()); print('parses OK')"
  test ! -f /Users/ryannel/Workspace/groundWork/src/generators/system-test-runner/files/tests/system/test_traces.py.template && echo "traces removed"
  ```
  Expect `parses OK` then `traces removed`. Full behavior verified by Task 0.10.
- **Guardrails:** The default `SERVICE_NAME`/otel name is now the DISCOVERED service key — do NOT hardcode `"api"`. Keep the trace tests SYNC (`def`, not `async def`) — they use sync `httpx.get`; only the health and CRUD tests are async. Do NOT remove the `pytest.xfail` for non-Go services (Python/Next tracing is not wired yet).

---

### Task 0.5 — Add `cmd_migrate` to lifecycle.sh

- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/workspace-dev-cli/files/scripts/cli/lifecycle.sh.template`
- **Depends on:** none
- **Goal:** Add a `./dev migrate` command that, for each app service, creates its database if missing and runs `scripts/apply-schema.sh` if present.
- **Anchor (current code to find):** the helper that lists app services (lifecycle.sh.template, lines 30-32), and the prefix is the workspace `projectPrefix` (the db container is `<%= projectPrefix %>-db`):
  ```bash
  _get_app_services() {
    ls "$ROOT_DIR/services" 2>/dev/null || true
  }
  ```
  The end of the file is `cmd_clean()` closing at line 305 (`}`). Append the new function after it.
- **Change:** Add this function at the END of `lifecycle.sh.template` (after `cmd_clean`'s closing `}`):
  ```bash

  function cmd_migrate() {
    print_logo "Applying Database Migrations"

    local db_container="<%= projectPrefix %>-db"

    # Wait for postgres to accept connections before any CREATE DATABASE.
    start_spinner "Waiting for database ($db_container)"
    local ready=false
    for _ in $(seq 1 60); do
      if docker exec "$db_container" pg_isready -U postgres >/dev/null 2>&1; then
        ready=true
        break
      fi
      sleep 1
    done
    if ! $ready; then
      stop_spinner "Failed" ""
      fail "Database '$db_container' never became ready" "Run './dev start' first"
    fi
    stop_spinner "Database ready" ""

    for svc in $(_get_app_services); do
      local svc_dir="$ROOT_DIR/services/$svc"
      local db_name="$svc"

      print_step "Migrating $svc (db: $db_name)"

      # Create the database if it does not exist.
      local check="docker exec $db_container psql -U postgres -tc \"SELECT 1 FROM pg_database WHERE datname='$db_name'\" | grep -q 1"
      local create="docker exec $db_container psql -U postgres -c \"CREATE DATABASE \\\"$db_name\\\";\""
      if eval "$check"; then
        print_substep "Database '$db_name' already exists."
      else
        if eval "$create" >/dev/null 2>&1; then
          print_substep "Created database '$db_name'."
        else
          print_warn "Could not create database '$db_name' (continuing)."
        fi
      fi

      # Apply declarative schema if the service ships one (Go services do).
      if [ -f "$svc_dir/scripts/apply-schema.sh" ]; then
        local db_url="postgres://postgres:postgres@localhost:5432/$db_name?sslmode=disable"
        start_spinner "Applying schema for $svc"
        if (cd "$svc_dir" && DATABASE_URL="$db_url" bash scripts/apply-schema.sh) >/dev/null 2>&1; then
          stop_spinner "Schema applied for $svc" ""
        else
          stop_spinner "Failed" ""
          fail "Schema migration failed for $svc" "Run 'cd services/$svc && DATABASE_URL=$db_url bash scripts/apply-schema.sh' to see the error"
        fi
      else
        print_substep "No apply-schema.sh for $svc; database created only."
      fi
    done

    echo ""
    print_success "Migrations complete."
  }
  ```
- **Acceptance:** verified by Task 0.10. Standalone:
  ```bash
  bash -n /Users/ryannel/Workspace/groundWork/src/generators/workspace-dev-cli/files/scripts/cli/lifecycle.sh.template && echo "syntax OK"
  grep -q "function cmd_migrate" /Users/ryannel/Workspace/groundWork/src/generators/workspace-dev-cli/files/scripts/cli/lifecycle.sh.template && echo "cmd present"
  ```
  Expect `syntax OK` then `cmd present`. (Note: `bash -n` on the `.template` works because the only EJS tag, `<%= projectPrefix %>`, sits inside a double-quoted string and is syntactically inert.)
- **Guardrails:** `apply-schema.sh` uses `go run github.com/stripe/pg-schema-diff` — it needs Go on the host; that's fine (Go services have it). Do NOT make `migrate` fail when a Python service has no `apply-schema.sh` — just create its DB. Use `fail` (already defined in `_ui.sh`, used elsewhere in this file) for hard errors so migrate FAILS LOUD when schema application errors.

---

### Task 0.6 — Register `migrate` in the dev help dashboard

- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/workspace-dev-cli/files/dev.template`
- **Depends on:** 0.5
- **Goal:** Surface `migrate` in `./dev help`. (Dispatch is automatic: `dev.template` routes any `cmd_<COMMAND>` that is defined, and `lifecycle.sh` is already sourced — so no routing change is needed, only help text.)
- **Anchor (current code to find):** dev.template lines 31-36:
  ```bash
    print_category "LIFECYCLE"
    print_cmd "start" "Spin up environment (--docker)"
    print_cmd "stop" "Tear down components"
    print_cmd "logs" "Tail output logs"
    print_cmd "status" "Print local endpoints (--json)"
    print_cmd "clean" "Deep teardown & wipe (--hard)"
  ```
- **Change:** Add a `migrate` row after `start`:
  ```bash
    print_category "LIFECYCLE"
    print_cmd "start" "Spin up environment (--docker)"
    print_cmd "migrate" "Create service DBs & apply schemas"
    print_cmd "stop" "Tear down components"
    print_cmd "logs" "Tail output logs"
    print_cmd "status" "Print local endpoints (--json)"
    print_cmd "clean" "Deep teardown & wipe (--hard)"
  ```
- **Acceptance:**
  ```bash
  grep -q 'print_cmd "migrate"' /Users/ryannel/Workspace/groundWork/src/generators/workspace-dev-cli/files/dev.template && echo OK
  ```
  Expect `OK`.
- **Guardrails:** Do NOT add a manual `case`/dispatch branch — the existing `declare -f "cmd_${COMMAND}"` router handles `migrate` once `cmd_migrate` exists (Task 0.5). `lifecycle.sh` is already sourced (dev.template line 71); do not re-source it.

---

### Task 0.7 — Extend `cmd_test` in quality.sh with the `integration` subcommand

- **Files:** `/Users/ryannel/Workspace/groundWork/src/generators/workspace-dev-cli/files/scripts/cli/quality.sh.template`
- **Depends on:** 0.3, 0.4, 0.5
- **Goal:** `./dev test integration` = start → migrate → (health gate is inside the suite via `cluster`) → run pytest with `GROUNDWORK_REQUIRE_*=1` → stop (unless `--keep`). Bare `./dev test` keeps the fast inner loop (pytest against an already-up stack, flags unset).
- **Anchor (current code to find):** quality.sh.template lines 8-22:
  ```bash
  function cmd_test() {
    print_logo "Running Tests"

    # Run Python system tests if the folder exists
    if [ -d "$ROOT_DIR/tests/system" ]; then
      print_step "Running System Tests (Pytest)"
      cd "$ROOT_DIR/tests" && uv run pytest system/
    else
      print_info "No system tests found."
    fi

    # In the future we can run `nx run-many -t test` here
    echo ""
    print_success "Testing complete."
  }
  ```
- **Change:** Replace the whole `cmd_test` function with:
  ```bash
  function cmd_test() {
    local MODE="$1"
    local KEEP=false
    for arg in "$@"; do
      if [ "$arg" == "--keep" ]; then KEEP=true; fi
    done

    if [ ! -d "$ROOT_DIR/tests/system" ]; then
      print_logo "Running Tests"
      print_info "No system tests found."
      return 0
    fi

    if [ "$MODE" == "integration" ]; then
      print_logo "Running Integration Tests"
      # Full loop: boot the dev stack, migrate, run the suite with FAIL-LOUD
      # flags, then tear down (unless --keep).
      cmd_start
      cmd_migrate
      print_step "Running System Tests (Pytest, REQUIRE_* enabled)"
      local rc=0
      ( cd "$ROOT_DIR/tests" && \
        GROUNDWORK_REQUIRE_SERVICES=1 GROUNDWORK_REQUIRE_TRACES=1 uv run pytest system/ ) || rc=$?
      if ! $KEEP; then
        cmd_stop
      fi
      if [ "$rc" -ne 0 ]; then
        fail "Integration tests failed" "Re-run with './dev test integration --keep' to inspect the running stack"
      fi
      echo ""
      print_success "Integration tests passed."
      return 0
    fi

    # Default: fast inner loop against an already-running stack.
    print_logo "Running Tests"
    print_step "Running System Tests (Pytest)"
    cd "$ROOT_DIR/tests" && uv run pytest system/
    echo ""
    print_success "Testing complete."
  }
  ```
- **Acceptance:**
  ```bash
  bash -n /Users/ryannel/Workspace/groundWork/src/generators/workspace-dev-cli/files/scripts/cli/quality.sh.template && echo "syntax OK"
  ```
  Expect `syntax OK`. Behavior verified by Task 0.10.
- **Guardrails:** `cmd_start`, `cmd_migrate`, `cmd_stop`, `fail` are all in scope when quality.sh is sourced (lifecycle.sh is sourced first in `dev.template`). Do NOT set `GROUNDWORK_REQUIRE_*` for the bare `./dev test` path — that must stay skip-friendly for local dev. Do NOT swallow the pytest exit code; propagate it via `fail`.

---

### Task 0.8 — Update tests/scaffolds/test_scaffolds.py to use discovery + migrate + REQUIRE flags

- **Files:** `/Users/ryannel/Workspace/groundWork/tests/scaffolds/test_scaffolds.py`
- **Depends on:** 0.3, 0.4, 0.5, 0.7
- **Goal:** After boot, call `./dev migrate`, then run the discovery-based system suite with `GROUNDWORK_REQUIRE_*=1`. Remove the manual port-shifting that fights service discovery (compose host_port must equal native `.env` PORT for discovery to find the running service). Be conservative: only change what discovery requires.
- **Anchor #1 (manual Go port shift to REMOVE — test_02, lines 81-97):**
  ```python
      print("\n--- Shifting Ports to Avoid Collision ---")
      basic_env = SANDBOX_DIR / "services" / "goapi-basic" / ".env"
      if basic_env.exists():
          content = basic_env.read_text()
          content = content.replace("PORT=4000", "PORT=9000")
          basic_env.write_text(content)

      full_env = SANDBOX_DIR / "services" / "goapi-full" / ".env"
      if full_env.exists():
          content = full_env.read_text()
          content = content.replace("PORT=4001", "PORT=9001")
          full_env.write_text(content)

      docker_compose = SANDBOX_DIR / "docker-compose.yml"
      if docker_compose.exists():
          # Any other global port shifting if needed
          pass
  ```
- **Change #1:** Delete that block (lines 81-97). `assignedPort` already auto-increments (4000, 4001, …), so compose port == native `.env` PORT == discovered port. **Invariant to preserve:** never shift `.env` PORT in only one place — discovery reads the compose host_port and the service listens on the `.env` PORT; they must stay equal.
- **Anchor #2 (Python port shift to REMOVE — test_02d, lines 218-225):**
  ```python
      # Shift port to avoid collision with Go services (9000, 9001)
      env_file = svc_dir / ".env"
      if env_file.exists():
          content = env_file.read_text()
          # Python generator starts at 8000; shift to 9002 for the boot test sandbox
          content = content.replace("PORT=8000", "PORT=9002")
          content = content.replace("SERVER_PORT=8000", "SERVER_PORT=9002")
          env_file.write_text(content)
  ```
- **Change #2:** Delete that block (lines 218-225). The Python generator's `assignedPort` already avoids collisions via the same auto-increment scan.
- **Anchor #3 (DB creation + health asserts on hardcoded ports — test_04 lines 277-282, test_05 lines 312-341):**
  ```python
      # Create the necessary databases for the services
      for db_name in ["goapi-basic", "goapi-full"]:
          check_cmd = f"docker exec testloop-db psql -U postgres -tc \"SELECT 1 FROM pg_database WHERE datname = '{db_name}'\" | grep -q 1"
          create_cmd = f"docker exec testloop-db psql -U postgres -c \"CREATE DATABASE \\\"{db_name}\\\";\""
          subprocess.run(f"{check_cmd} || {create_cmd}", shell=True, executable="/bin/bash")
  ```
  ```python
  async def test_05_verify_goapi_health():
      services = [
          ("goapi-basic", "http://localhost:9000/health"),
          ("goapi-full", "http://localhost:9001/health")
      ]
  ```
- **Change #3:** In `test_04`, replace the manual per-DB loop with a `./dev migrate` call (it discovers DBs and applies schemas). Replace the inline block:
  ```python
      # Create per-service databases and apply schemas via the discovery-based migrate.
      migrate_res = subprocess.run(
          ["bash", "./dev", "migrate"],
          cwd=SANDBOX_DIR,
          capture_output=True,
          text=True,
      )
      print(migrate_res.stdout)
      if migrate_res.returncode != 0:
          print(f"Stderr: {migrate_res.stderr}")
      assert migrate_res.returncode == 0, "./dev migrate failed"
  ```
  Leave the `pg_isready` wait loop above it intact (migrate also waits, but the test's wait is harmless). Update `test_05` health-check ports to the actual auto-assigned ports (Go starts at 4000): `("goapi-basic", "http://localhost:4000/health")` and `("goapi-full", "http://localhost:4001/health")`. Update `test_05b` Python URL from `9002` to its auto-assigned port (Python generator starts at 8000; after two Go services on 4000/4001 it is assigned `4002` — confirm by reading `services/narrative-engine/.env` PORT in the test rather than hardcoding; if simpler, read the port at runtime: `port = (svc_dir/".env").read_text()...`).
- **Change #4 (run booted system suite with REQUIRE flags — test_07, lines 381-396):** Replace `test_07_run_isolated_system_tests` body so it runs the discovery suite against the booted stack with FAIL-LOUD flags:
  ```python
  def test_07_run_booted_system_tests():
      """Run the discovery-based system suite against the live dev stack."""
      print("\n--- Running System Tests (Discovery, REQUIRE_* enabled) ---")
      env = {**os.environ, "GROUNDWORK_REQUIRE_SERVICES": "1", "GROUNDWORK_REQUIRE_TRACES": "1"}
      res = subprocess.run(
          ["uv", "run", "pytest", "system/", "-v", "-s"],
          cwd=SANDBOX_DIR / "tests",
          capture_output=True,
          text=True,
          env=env,
      )
      print(res.stdout)
      if res.returncode != 0:
          print(f"Stderr: {res.stderr}")
      assert res.returncode == 0, "Booted system tests failed"
  ```
- **Acceptance:**
  ```bash
  python3 -c "import ast; ast.parse(open('/Users/ryannel/Workspace/groundWork/tests/scaffolds/test_scaffolds.py').read()); print('parses OK')"
  grep -q "dev.*migrate" /Users/ryannel/Workspace/groundWork/tests/scaffolds/test_scaffolds.py && echo "migrate wired"
  ! grep -q "PORT=4000.*PORT=9000\|localhost:9000" /Users/ryannel/Workspace/groundWork/tests/scaffolds/test_scaffolds.py && echo "shifts removed"
  ```
  Expect `parses OK`, `migrate wired`, `shifts removed`. (This is `./dev test scaffolds`, which boots Docker — run it once locally to confirm; see Task 0.10.)
- **Guardrails:** Be conservative — do NOT rewrite tests that already pass and don't depend on ports (test_01, 02b, 02c, 03, 06, 08). `test_06` (Clerk webhook) hits `goapi-full`; change its `9001` to the auto-assigned `4001`. The db container is named `testloop-db` (projectPrefix = `testloop`) — keep that name where it remains. Do NOT delete `import os` (already imported at top). Keep the `docker-compose.test.yml` assertion in test_03 REMOVED (that file no longer generates).

---

### Task 0.9 — Create the CI workflow

- **Files:** `/Users/ryannel/Workspace/groundWork/.github/workflows/ci.yml` (new)
- **Depends on:** 0.1–0.8
- **Goal:** Three required jobs mapped to repo-root `./dev`: `generation`, `compilation`, and `e2e` (regenerate → `./dev start` → `./dev migrate` → booted system tests with REQUIRE flags). Plus an optional, gated `eval` job (documented, not required).
- **Anchor (current code to find):** there is no existing workflow.
  ```bash
  ls /Users/ryannel/Workspace/groundWork/.github/workflows/ 2>/dev/null || echo "no workflows dir yet"
  ```
- **Change:** Create `.github/workflows/ci.yml` with:
  ```yaml
  name: CI

  on:
    pull_request:
    push:
      branches: [main]

  concurrency:
    group: ci-${{ github.ref }}
    cancel-in-progress: true

  jobs:
    generation:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: '20'
            cache: 'npm'
        - run: npm ci
        - run: ./dev test generation

    compilation:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: '20'
            cache: 'npm'
        - run: npm ci
        - run: ./dev test compilation

    e2e:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: '20'
            cache: 'npm'
        - uses: actions/setup-go@v5
          with:
            go-version: '1.22'
            cache: true
        - uses: actions/setup-python@v5
          with:
            python-version: '3.11'
        - name: Install uv
          uses: astral-sh/setup-uv@v3
          with:
            enable-cache: true
        - run: npm ci
        - name: Build generators
          run: npm run build
        # GitHub ubuntu runners ship Docker; the dev stack boots directly.
        - name: End-to-end scaffold + harness
          env:
            GROUNDWORK_REQUIRE_SERVICES: '1'
            GROUNDWORK_REQUIRE_TRACES: '1'
          run: ./dev test scaffolds

    # OPTIONAL — requires LLM API keys; gated to nightly / label, NOT required.
    # Enable by adding secrets and uncommenting. Documented here per Phase 0 design.
    # eval:
    #   if: github.event_name == 'schedule' || contains(github.event.pull_request.labels.*.name, 'run-eval')
    #   runs-on: ubuntu-latest
    #   steps:
    #     - uses: actions/checkout@v4
    #     - uses: actions/setup-node@v4
    #       with: { node-version: '20', cache: 'npm' }
    #     - run: npm ci
    #     - run: ./dev eval run
    #       env:
    #         ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  ```
- **Acceptance:**
  ```bash
  python3 -c "import yaml; yaml.safe_load(open('/Users/ryannel/Workspace/groundWork/.github/workflows/ci.yml')); print('valid yaml')"
  ```
  Expect `valid yaml`. (Full validation occurs when the workflow runs on a PR.)
- **Guardrails:** Confirm the exact repo-root meta-test invocations before finalizing — run `./dev help` (or read the repo-root `dev`) to verify `test generation`, `test compilation`, `test scaffolds`, and `eval` are the real subcommands; adjust the `run:` lines to match. Do NOT make the `eval` job required or un-gated (it needs paid API keys). The `e2e` job runs the REPO meta-test `./dev test scaffolds` (which regenerates + boots), not the generated workspace's `./dev test integration`.

---

### Task 0.10 — Build, regenerate, and run the full harness end-to-end (phase verification)

- **Files:** none (verification only)
- **Depends on:** 0.1–0.9
- **Goal:** Prove the spine works: regenerate a workspace, boot it, migrate, and confirm the system suite passes with a real span found in jaeger.
- **Anchor:** n/a.
- **Change:** Run the commands below in order.
  ```bash
  # Build generators
  cd /Users/ryannel/Workspace/groundWork && npm run build

  # Fast structural meta-test
  cd /Users/ryannel/Workspace/groundWork && ./dev test generation

  # Regenerate sample workspace with a Go service (validated pattern)
  GJSON=/Users/ryannel/Workspace/groundWork/generators.json
  TMP=/Users/ryannel/Workspace/groundWork/.sandboxes/demo
  rm -rf $TMP; mkdir -p $TMP/services; printf '{}' > $TMP/nx.json; printf '{"name":"demo"}' > $TMP/package.json
  (cd $TMP && npx --yes nx g $GJSON:workspace-dev-cli --appName demo)
  (cd $TMP && npx --yes nx g $GJSON:go-microservice --name api --auth service)

  # Boot, migrate, integration-test (FAIL LOUD)
  cd $TMP && ./dev start
  cd $TMP && ./dev migrate
  cd $TMP && GROUNDWORK_REQUIRE_TRACES=1 GROUNDWORK_REQUIRE_SERVICES=1 ./dev test integration

  # Teardown
  cd $TMP && ./dev clean --hard
  ```
- **Acceptance / expected observable result:**
  - `npm run build` exits 0.
  - `./dev test generation` exits 0.
  - Both generators exit 0; `$TMP/tests/system/conftest.py` exists; `$TMP/tests/system/docker-compose.test.yml` does NOT exist.
  - `./dev migrate` prints "Created database 'api'" and "Schema applied for api", exits 0.
  - `./dev test integration` output shows: `test_every_service_is_healthy[api] PASSED`, `test_instrumented_get_exports_span[api] PASSED`, `test_trace_context_propagates_unchanged[api] PASSED`, `test_crud_round_trip[api] SKIPPED`. Overall exit 0.
  - `./dev clean --hard` exits 0.
- **Guardrails:** `$TMP` MUST be under the repo (`/Users/ryannel/Workspace/groundWork/.sandboxes/...`) so Nx resolves the generators. If the span test fails with "no span reached jaeger", check that jaeger published `4317:4317` (dev-stack `docker-compose.yml`) and that `services/api/.env` still has `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317` — do NOT "fix" it by relaxing the assertion; that reintroduces the silent-failure defect this phase exists to kill. Always `./dev clean --hard` at the end so leftover containers don't poison the next run.

---

## Definition of done for Phase 0

- [ ] `docker-compose.test.yml.template` deleted; no generator or test references it.
- [ ] `pytest-docker` removed from `pyproject.toml.template`; `PyYAML` added.
- [ ] `conftest.py.template` rewritten: `services_manifest` discovery (compose `build.context` discriminator, generic over N services, no hardcoded ports/manifest), health-gated `cluster` (tenacity, 120s, REQUIRE_SERVICES → fail / else skip), generic `pure_state_reset` (TRUNCATE all public tables per discovered DB, tolerant of missing DB).
- [ ] `test_system.py.template` rewritten: parametrized `test_every_service_is_healthy` (Go: status ok + db ok; Python/Next: lenient), `test_instrumented_get_exports_span` (Go PASS, non-Go xfail, REQUIRE_TRACES → fail-not-skip), `test_trace_context_propagates_unchanged`, `test_crud_round_trip` (skipped until Phase 4). `test_traces.py.template` deleted/merged; otel name is discovered, not `"api"`.
- [ ] `cmd_migrate` added to `lifecycle.sh.template` (waits for db, creates per-service DB, runs `apply-schema.sh` if present, fails loud on schema error); registered in `dev.template` help.
- [ ] `cmd_test` in `quality.sh.template` extended with `integration` mode (start → migrate → pytest with REQUIRE_* → stop, `--keep` honored); bare `./dev test` unchanged for the inner loop.
- [ ] `tests/scaffolds/test_scaffolds.py` updated: manual `.env` port shifts removed (compose port == native PORT invariant), `./dev migrate` replaces manual DB creation, booted system suite runs with REQUIRE_* flags, hardcoded health ports corrected to auto-assigned values.
- [ ] `.github/workflows/ci.yml` created with `generation`, `compilation`, `e2e` jobs (node+go+python+uv, caches, ubuntu Docker), `on: [pull_request, push main]`, `concurrency` cancel-in-progress; optional gated `eval` job documented.
- [ ] `npm run build` and `./dev test generation` pass.
- [ ] End-to-end (Task 0.10): regenerate → `./dev start` → `./dev migrate` → `GROUNDWORK_REQUIRE_TRACES=1 GROUNDWORK_REQUIRE_SERVICES=1 ./dev test integration` → all system tests PASS and a span with `serviceName == "api"` is found in jaeger.
