import os
import shutil
import subprocess
import time
import asyncio
import pytest
import httpx
from pathlib import Path

# Paths
REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
SANDBOX_DIR = REPO_ROOT / ".sandboxes" / "scaffolds" / "testloop"
GENERATORS_JSON = REPO_ROOT / "generators.json"

@pytest.fixture(scope="session", autouse=True)
def setup_workspace():
    """
    Sets up the Nx workspace in the sandbox directory and compiles the GroundWork generators.
    This runs once per test session.
    """
    # 1. Compile GroundWork just to be sure we have the latest generators
    print("\n--- Compiling GroundWork Generators ---")
    subprocess.run(["npm", "run", "build"], cwd=REPO_ROOT, check=True)

    # 2. Prepare Sandbox
    print(f"\n--- Preparing Sandbox Workspace in {SANDBOX_DIR} ---")
    if SANDBOX_DIR.exists():
        shutil.rmtree(SANDBOX_DIR)
    SANDBOX_DIR.mkdir(parents=True)

    # We need a basic package.json so nx considers it a workspace
    package_json = SANDBOX_DIR / "package.json"
    package_json.write_text('{"name": "testloop"}')

    nx_json = SANDBOX_DIR / "nx.json"
    nx_json.write_text('{}')

    yield

    # Clean up (Optional: comment out if you want to inspect the generated files after failure)
    # print(f"\n--- Cleaning up Sandbox ---")
    # if SANDBOX_DIR.exists():
    #     shutil.rmtree(SANDBOX_DIR)


def test_01_scaffold_workspace_cli():
    """Test generating the root dev CLI and infra."""
    print("\n--- Scaffolding Workspace Dev CLI ---")
    res = subprocess.run(
        ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:workspace-dev-cli", "--appName", "testloop"],
        cwd=SANDBOX_DIR,
        capture_output=True,
        text=True
    )
    assert res.returncode == 0, f"Generator failed:\n{res.stderr}"
    assert (SANDBOX_DIR / "dev").exists(), "The ./dev script was not created"
    assert (SANDBOX_DIR / "docker-compose.yml").exists(), "docker-compose.yml was not created"


def test_02_scaffold_go_microservice():
    """Test generating the Go microservices with different configurations."""
    print("\n--- Scaffolding Go Microservice (goapi-basic) ---")
    res = subprocess.run(
        ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:go-microservice", "--name", "goapi-basic", "--auth", "service"],
        cwd=SANDBOX_DIR,
        capture_output=True,
        text=True
    )
    assert res.returncode == 0, f"Generator failed:\n{res.stderr}"
    assert (SANDBOX_DIR / "services" / "goapi-basic" / "go.mod").exists(), "goapi-basic was not created properly"

    print("\n--- Scaffolding Go Microservice (goapi-full) ---")
    res2 = subprocess.run(
        ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:go-microservice", "--name", "goapi-full", "--auth", "clerk", "--websockets", "true", "--messaging", "gcp-pubsub"],
        cwd=SANDBOX_DIR,
        capture_output=True,
        text=True
    )
    assert res2.returncode == 0, f"Generator failed:\n{res2.stderr}"
    assert (SANDBOX_DIR / "services" / "goapi-full" / "go.mod").exists(), "goapi-full was not created properly"


def test_02b_scaffold_nextjs_app():
    """Test generating a Next.js frontend application."""
    print("\n--- Scaffolding Next.js App (my-frontend - full options) ---")
    res = subprocess.run(
        ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:nextjs-app", "--name", "my-frontend", "--auth", "clerk", "--apiProxy", "true", "--websockets", "true"],
        cwd=SANDBOX_DIR,
        capture_output=True,
        text=True
    )
    assert res.returncode == 0, f"Generator failed:\n{res.stderr}"

    frontend_dir = SANDBOX_DIR / "services" / "my-frontend"
    assert frontend_dir.exists(), "my-frontend service directory was not created"

    # Core files
    assert (frontend_dir / "package.json").exists(), "package.json was not created"
    assert (frontend_dir / "next.config.mjs").exists(), "next.config.mjs was not created"
    assert (frontend_dir / "tsconfig.json").exists(), "tsconfig.json was not created"
    assert (frontend_dir / "Dockerfile").exists(), "Dockerfile was not created"
    assert (frontend_dir / "instrumentation.ts").exists(), "instrumentation.ts was not created"

    # App Router structure
    assert (frontend_dir / "app" / "layout.tsx").exists(), "Root layout was not created"
    assert (frontend_dir / "app" / "page.tsx").exists(), "Home page was not created"
    assert (frontend_dir / "app" / "error.tsx").exists(), "Error boundary was not created"
    assert (frontend_dir / "app" / "global-error.tsx").exists(), "Global error boundary was not created"
    assert (frontend_dir / "app" / "not-found.tsx").exists(), "404 page was not created"
    assert (frontend_dir / "app" / "api" / "healthz" / "route.ts").exists(), "Health check route was not created"

    # Dynamic route segments (verify Nx __var__ → Next.js [...] renaming worked)
    assert (frontend_dir / "app" / "api" / "proxy" / "[...path]" / "route.ts").exists(), "Proxy catch-all route was not created"
    assert (frontend_dir / "app" / "(auth)" / "sign-in" / "[[...sign-in]]" / "page.tsx").exists(), "Sign-in catch-all route was not created"
    assert (frontend_dir / "app" / "(auth)" / "sign-up" / "[[...sign-up]]" / "page.tsx").exists(), "Sign-up catch-all route was not created"

    # Auth middleware
    assert (frontend_dir / "proxy.ts").exists(), "Clerk middleware (proxy.ts) was not created"

    # Lib structure
    assert (frontend_dir / "lib" / "api" / "fetcher.ts").exists(), "API fetcher was not created"
    assert (frontend_dir / "lib" / "config.ts").exists(), "Server config was not created"
    assert (frontend_dir / "lib" / "schemas" / "index.ts").exists(), "Schemas barrel was not created"

    # Components
    assert (frontend_dir / "components" / "providers" / "production.tsx").exists(), "Clerk provider was not created"
    assert (frontend_dir / "components" / "theme-provider.tsx").exists(), "Theme provider was not created"

    # Docker-compose was updated with the service
    docker_compose = SANDBOX_DIR / "docker-compose.yml"
    compose_content = docker_compose.read_text()
    assert "my-frontend" in compose_content, "my-frontend was not added to docker-compose.yml"

    # Hidden skill was installed
    assert (SANDBOX_DIR / ".agents" / "skills" / "groundwork-nextjs-engineer" / "SKILL.md").exists(), "Next.js engineer skill was not installed"

    print(f"Generated files:\n{subprocess.run(['find', str(frontend_dir), '-type', 'f'], capture_output=True, text=True).stdout}")


def test_02c_scaffold_nextjs_app_minimal():
    """Test generating a minimal Next.js app (no auth, no proxy, no websockets)."""
    print("\n--- Scaffolding Next.js App (my-dashboard - minimal) ---")
    res = subprocess.run(
        ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:nextjs-app", "--name", "my-dashboard", "--auth", "none", "--apiProxy", "false", "--websockets", "false"],
        cwd=SANDBOX_DIR,
        capture_output=True,
        text=True
    )
    assert res.returncode == 0, f"Generator failed:\n{res.stderr}"

    dashboard_dir = SANDBOX_DIR / "services" / "my-dashboard"

    # Core files present
    assert (dashboard_dir / "package.json").exists(), "package.json was not created"
    assert (dashboard_dir / "app" / "layout.tsx").exists(), "Root layout was not created"

    # Auth files should NOT exist
    assert not (dashboard_dir / "proxy.ts").exists(), "Clerk middleware should not exist for auth=none"
    assert not (dashboard_dir / "app" / "(auth)").exists(), "Auth routes should not exist for auth=none"
    assert not (dashboard_dir / "components" / "providers" / "production.tsx").exists(), "Clerk provider should not exist"

    # API proxy files should NOT exist
    assert not (dashboard_dir / "app" / "api" / "proxy").exists(), "Proxy route should not exist without apiProxy"
    assert not (dashboard_dir / "lib" / "api").exists(), "API lib should not exist without apiProxy"
    assert not (dashboard_dir / "lib" / "config.ts").exists(), "Server config should not exist without apiProxy"

    # WebSocket config route should NOT exist
    assert not (dashboard_dir / "app" / "api" / "config").exists(), "Config route should not exist without websockets"

    # Default provider should exist
    assert (dashboard_dir / "components" / "providers" / "default.tsx").exists(), "Default provider should exist"


def test_02d_scaffold_python_microservice():
    """Test generating a Python microservice with REST, Postgres, and GCP Pub/Sub."""
    print("\n--- Scaffolding Python Microservice (narrative-engine) ---")
    res = subprocess.run(
        [
            "npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:python-microservice",
            "--name", "narrative-engine",
            "--rest", "true",
            "--postgres", "true",
            "--messaging", "gcp-pubsub",
            "--llm", "true",
        ],
        cwd=SANDBOX_DIR,
        capture_output=True,
        text=True
    )
    assert res.returncode == 0, f"Generator failed:\n{res.stderr}"

    svc_dir = SANDBOX_DIR / "services" / "narrative-engine"
    assert svc_dir.exists(), "narrative-engine directory was not created"
    assert (svc_dir / "pyproject.toml").exists(), "pyproject.toml was not created"
    assert (svc_dir / "src" / "narrative_engine" / "main.py").exists(), "main.py was not created"
    assert (svc_dir / "src" / "narrative_engine" / "entrypoints" / "api").exists(), "API entrypoint missing for rest=True"
    assert (svc_dir / "src" / "narrative_engine" / "adapters" / "database.py").exists(), "database.py missing for postgres=True"
    assert (svc_dir / "src" / "narrative_engine" / "adapters" / "message_queue.py").exists(), "message_queue.py missing for messaging=gcp-pubsub"
    assert (svc_dir / "src" / "narrative_engine" / "adapters" / "llm.py").exists(), "adapters/llm.py missing for llm=True"

    # Verify docker-compose.yml was updated
    docker_compose = SANDBOX_DIR / "docker-compose.yml"
    assert "narrative-engine" in docker_compose.read_text(), "narrative-engine missing from docker-compose.yml"

    print(f"Python engineer skill installed: {(SANDBOX_DIR / '.agents' / 'skills' / 'groundwork-python-engineer' / 'SKILL.md').exists()}")


def test_03_scaffold_system_test_runner():
    """Test generating the isolated system test environment."""
    print("\n--- Scaffolding System Test Runner ---")
    res = subprocess.run(
        ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:system-test-runner"],
        cwd=SANDBOX_DIR,
        capture_output=True,
        text=True
    )
    assert res.returncode == 0, f"Generator failed:\n{res.stderr}"
    assert (SANDBOX_DIR / "tests" / "system" / "test_system.py").exists(), "System test suite was not created"


def test_04_boot_dev_environment():
    """Test booting the local DX environment and verify it's green."""
    print("\n--- Booting ./dev Environment (--docker mode) ---")

    # 1. Start ALL services in Docker — this does not require `air` or any native
    # language runtime on the host; Docker builds and runs every service image.
    res = subprocess.run(
        ["node", "./dev", "start", "--docker"],
        cwd=SANDBOX_DIR,
        capture_output=True,
        text=True
    )
    print(res.stdout)
    if res.returncode != 0:
        print(f"Stderr: {res.stderr}")
    assert res.returncode == 0, "Failed to start ./dev environment"

    # Wait for PostgreSQL healthcheck to pass (docker inspect health status).
    db_ready = False
    for _ in range(90):
        health = subprocess.run(
            ["docker", "inspect", "--format={{.State.Health.Status}}", "testloop-db"],
            capture_output=True, text=True
        )
        if health.stdout.strip() == "healthy":
            db_ready = True
            break
        time.sleep(2)

    assert db_ready, "PostgreSQL container never became healthy"

    # Create per-service databases and apply schemas.
    migrate_res = subprocess.run(
        ["node", "./dev", "migrate"],
        cwd=SANDBOX_DIR,
        capture_output=True,
        text=True,
    )
    print(migrate_res.stdout)
    if migrate_res.returncode != 0:
        print(f"Stderr: {migrate_res.stderr}")
    assert migrate_res.returncode == 0, "./dev migrate failed"

    # Restart Go app containers so they reconnect to the now-existing databases.
    # Go services start before ./dev migrate creates their DBs (the compose dependency
    # only waits for postgres to be healthy, not for schemas to be applied). A restart
    # forces a clean DB connection attempt against the fully-initialised database.
    for svc in ("goapi-basic", "goapi-full"):
        subprocess.run(
            ["docker", "compose", "restart", svc],
            cwd=SANDBOX_DIR,
            capture_output=True,
            text=True,
        )

    # Wait for app containers to finish their restart and become responsive.
    print("\nWaiting for services to become responsive...")
    time.sleep(10)

    # 2. Check the status command parses correctly.
    status_res = subprocess.run(
        ["node", "./dev", "status"],
        cwd=SANDBOX_DIR,
        capture_output=True,
        text=True
    )
    assert status_res.returncode == 0, "Failed to get ./dev status"
    print(status_res.stdout)

    # Basic assertions: infra containers present.
    assert "db" in status_res.stdout
    assert "jaeger" in status_res.stdout

    # App services present in the compose output (all running in --docker mode).
    assert "goapi-basic" in status_res.stdout
    assert "goapi-full" in status_res.stdout
    assert "dead" not in status_res.stdout.lower()


@pytest.mark.asyncio
async def test_05_verify_goapi_health():
    """Test that the native Go services are processing traffic and connected to DB."""
    # goapi-basic is 4000, goapi-full is 4001 (auto-assigned, no port shifts)
    services = [
        ("goapi-basic", "http://localhost:4000/health"),
        ("goapi-full", "http://localhost:4001/health")
    ]
    
    async with httpx.AsyncClient() as client:
        for name, url in services:
            healthy = False
            # Retry logic in case 'air' takes a bit to compile and start the go binary
            # Also retry if the health check is 'degraded' (DB might still be initializing)
            for _ in range(60):
                try:
                    resp = await client.get(url, timeout=2.0)
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("status") == "ok":
                            healthy = True
                            break
                except (httpx.ConnectError, httpx.ReadTimeout):
                    pass
                except ValueError:
                    pass # Not JSON
                await asyncio.sleep(1)
            
            if not healthy:
                pytest.fail(f"Go service '{name}' never became healthy at {url}")


@pytest.mark.asyncio
async def test_05b_verify_python_health():
    """Test that the Python narrative-engine service starts and responds to health checks."""
    svc_dir = SANDBOX_DIR / "services" / "narrative-engine"
    # Python services don't generate a .env; read the port from the baked-in default in config.py.
    import re
    config_text = (svc_dir / "src" / "narrative_engine" / "adapters" / "config.py").read_text()
    match = re.search(r"server_port: int = (\d+)", config_text)
    port = match.group(1) if match else None
    assert port, "Could not find server_port in narrative-engine src/narrative_engine/adapters/config.py"
    url = f"http://localhost:{port}/health"

    async with httpx.AsyncClient() as client:
        healthy = False
        for _ in range(60):
            try:
                resp = await client.get(url, timeout=2.0)
                if resp.status_code == 200:
                    data = resp.json()
                    # Python FastAPI health returns {"status": "alive"}
                    if data.get("status") in ("ok", "alive"):
                        healthy = True
                        break
            except (httpx.ConnectError, httpx.ReadTimeout):
                pass
            except ValueError:
                pass  # Not JSON yet
            await asyncio.sleep(1)

        if not healthy:
            pytest.fail(f"Python service 'narrative-engine' never became healthy at {url}")


@pytest.mark.asyncio
async def test_06_verify_clerk_webhook_rejection():
    """Test that the Clerk webhook handler rejects unverified requests."""
    url = "http://localhost:4001/webhooks/clerk"
    payload = {"type": "user.created", "data": {"id": "user_123"}}
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, timeout=2.0)
        # Should be 400 Bad Request or 401 Unauthorized because of missing Svix signature
        assert resp.status_code in [400, 401], f"Expected webhook to reject, got {resp.status_code}"
        print(f"\nWebhook correctly rejected unverified payload: {resp.status_code}")

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


def test_08_teardown_dev_environment():
    """Test cleaning up the DX environment."""
    print("\n--- Cleaning up ./dev Environment ---")

    res = subprocess.run(
        ["node", "./dev", "clean", "--hard"],
        cwd=SANDBOX_DIR,
        capture_output=True,
        text=True
    )
    print(res.stdout)
    assert res.returncode == 0, "Failed to clean ./dev environment"


def test_09_runner_lifecycle_without_docker():
    """The runner registry, end to end, with no Docker (the Magpie desktop/sidecar
    case): a registered native runner is a first-class managed unit. `./dev start`
    launches it (straight to Phase C — no infra, no app services, so Docker is
    never touched), `status --json` reports it running with a PID, and `./dev stop`
    kills it and clears its pid file. Runs in its own container-less workspace so
    it neither needs nor starts any of the shared sandbox's services."""
    import json
    runner_sb = REPO_ROOT / ".sandboxes" / "scaffolds" / "runner-boot"
    if runner_sb.exists():
        shutil.rmtree(runner_sb)
    runner_sb.mkdir(parents=True)
    (runner_sb / "package.json").write_text('{"name": "runnerboot"}')
    (runner_sb / "nx.json").write_text("{}")
    pid_file = runner_sb / ".dev" / "pids" / "probe.pid"
    try:
        gen = subprocess.run(
            ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:workspace-dev-cli", "--appName", "runnerboot"],
            cwd=runner_sb, capture_output=True, text=True,
        )
        assert gen.returncode == 0, f"workspace-dev-cli failed:\n{gen.stderr}"

        # Register a trivial long-lived runner — no Docker, no real service.
        config_path = runner_sb / ".dev" / "dev.config.json"
        config = json.loads(config_path.read_text())
        config["runners"] = [
            {"name": "probe", "kind": "sidecar", "cmd": "sleep 600", "autostart": True}
        ]
        config_path.write_text(json.dumps(config, indent=2) + "\n")

        start = subprocess.run(["node", "./dev", "start"], cwd=runner_sb,
                               capture_output=True, text=True, timeout=60)
        assert start.returncode == 0, f"./dev start failed:\n{start.stdout}\n{start.stderr}"
        assert pid_file.exists(), f"start must write the runner pid file:\n{start.stdout}"

        st = subprocess.run(["node", "./dev", "status", "--json"], cwd=runner_sb,
                            capture_output=True, text=True, timeout=60)
        assert st.returncode == 0, f"status failed:\n{st.stderr}"
        runners = {r["name"]: r for r in json.loads(st.stdout).get("runners", [])}
        assert runners.get("probe", {}).get("state") == "running", \
            f"runner must report running:\n{st.stdout}"
        assert runners["probe"]["pid"], "a running runner must report a pid"

        stop = subprocess.run(["node", "./dev", "stop"], cwd=runner_sb,
                              capture_output=True, text=True, timeout=60)
        assert stop.returncode == 0, f"./dev stop failed:\n{stop.stderr}"
        assert not pid_file.exists(), "stop must remove the runner pid file"
        st2 = subprocess.run(["node", "./dev", "status", "--json"], cwd=runner_sb,
                             capture_output=True, text=True, timeout=60)
        runners2 = {r["name"]: r for r in json.loads(st2.stdout).get("runners", [])}
        assert runners2.get("probe", {}).get("state") != "running", \
            f"runner must be stopped after ./dev stop:\n{st2.stdout}"
    finally:
        # Best-effort: never leave a stray `sleep` behind on a failed assertion.
        subprocess.run(["node", "./dev", "stop"], cwd=runner_sb,
                       capture_output=True, text=True)
        shutil.rmtree(runner_sb, ignore_errors=True)


def test_10_docs_site_runner_serves_docs():
    """The docs-site runner, end to end: the generator registers a `pnpm dev` surface
    runner, `./dev start` boots it (no Docker), and the site actually serves the
    repo-root docs/ tree on its port. The runner ships autostart:false (a docs site
    is not part of every boot); the test flips it on to exercise the `./dev start`
    path. Proves the generator-registered cmd/cwd/env launch a working server."""
    import json
    import time
    import urllib.request

    if shutil.which("pnpm") is None:
        pytest.skip("pnpm not available")

    sb = REPO_ROOT / ".sandboxes" / "scaffolds" / "docs-runner-boot"
    if sb.exists():
        shutil.rmtree(sb)
    (sb / "docs" / "bets" / "dark-mode").mkdir(parents=True)
    (sb / "package.json").write_text('{"name": "docsboot"}')
    (sb / "nx.json").write_text("{}")
    # The site reads ../../docs at build time; seed a frontmatter-free bet + home.
    (sb / "docs" / "index.md").write_text("# Welcome\n\nHome.\n")
    (sb / "docs" / "bets" / "dark-mode" / "pitch.md").write_text("# Pitch: Dark Mode\n\nA bet.\n")

    def _port_pids():
        out = subprocess.run(["lsof", "-ti", "tcp:4000"], capture_output=True, text=True)
        return [p for p in out.stdout.split() if p]

    try:
        assert subprocess.run(
            ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:workspace-dev-cli", "--appName", "docsboot"],
            cwd=sb, capture_output=True, text=True,
        ).returncode == 0, "workspace-dev-cli failed"

        gen = subprocess.run(
            ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:docs-site", "--name", "docs"],
            cwd=sb, capture_output=True, text=True, timeout=300,
        )
        assert gen.returncode == 0, f"docs-site failed:\n{gen.stderr}"

        svc = sb / "services" / "docs"
        # Deterministic install (the post-gen hook may have run already). The
        # pnpm-workspace.yaml the generator ships makes this exit 0 under pnpm 10+.
        install = subprocess.run(["pnpm", "install"], cwd=svc, capture_output=True, text=True, timeout=300)
        assert install.returncode == 0, (
            f"pnpm install must exit 0 (pnpm-workspace.yaml allows builds):\n{install.stdout}\n{install.stderr}"
        )

        # Flip the docs runner to autostart so `./dev start` includes it.
        config_path = sb / ".dev" / "dev.config.json"
        config = json.loads(config_path.read_text())
        for r in config.get("runners", []):
            if r["name"] == "docs":
                r["autostart"] = True
        config_path.write_text(json.dumps(config, indent=2) + "\n")

        start = subprocess.run(["node", "./dev", "start"], cwd=sb,
                               capture_output=True, text=True, timeout=120)
        assert start.returncode == 0, f"./dev start failed:\n{start.stdout}\n{start.stderr}"

        # Poll the docs route (next dev compiles the route on first request).
        body, code = "", None
        for _ in range(60):
            try:
                with urllib.request.urlopen("http://localhost:4000/docs", timeout=3) as resp:
                    code = resp.status
                    body = resp.read().decode("utf-8", "replace")
                    if code == 200:
                        break
            except Exception:
                pass
            time.sleep(1)
        assert code == 200, f"docs site did not serve /docs (last code={code})\nstart:\n{start.stdout}"
        assert "<title>Welcome</title>" in body, "served page must carry the H1-derived title"

        stop = subprocess.run(["node", "./dev", "stop"], cwd=sb,
                              capture_output=True, text=True, timeout=120)
        assert stop.returncode == 0, f"./dev stop failed:\n{stop.stderr}"
    finally:
        subprocess.run(["node", "./dev", "stop"], cwd=sb, capture_output=True, text=True)
        # next dev spawns a child server; make sure nothing keeps port 4000.
        for pid in _port_pids():
            subprocess.run(["kill", "-9", pid], capture_output=True, text=True)
        shutil.rmtree(sb, ignore_errors=True)
