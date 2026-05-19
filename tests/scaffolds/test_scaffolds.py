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
    assert (SANDBOX_DIR / "tests" / "system" / "docker-compose.test.yml").exists(), "System test docker-compose was not created"


def test_04_boot_dev_environment():
    """Test booting the local DX environment and verify it's green."""
    print("\n--- Booting ./dev Environment ---")
    
    # 1. Start the environment (this uses docker compose up -d internally and air in background)
    res = subprocess.run(
        ["bash", "./dev", "start"],
        cwd=SANDBOX_DIR,
        capture_output=True,
        text=True
    )
    print(res.stdout)
    if res.returncode != 0:
        print(f"Stderr: {res.stderr}")
    assert res.returncode == 0, "Failed to start ./dev environment"

    # Wait for PostgreSQL to be ready
    db_ready = False
    for _ in range(60):
        res_ready = subprocess.run(
            ["docker", "exec", "testloop-db", "pg_isready", "-U", "postgres"],
            capture_output=True, text=True
        )
        if res_ready.returncode == 0:
            db_ready = True
            break
        time.sleep(1)
    
    assert db_ready, f"PostgreSQL never became ready. Output: {res_ready.stderr}"

    # Create the necessary databases for the services
    for db_name in ["goapi-basic", "goapi-full"]:
        # Only create if it doesn't exist
        check_cmd = f"docker exec testloop-db psql -U postgres -tc \"SELECT 1 FROM pg_database WHERE datname = '{db_name}'\" | grep -q 1"
        create_cmd = f"docker exec testloop-db psql -U postgres -c \"CREATE DATABASE \\\"{db_name}\\\";\""
        subprocess.run(f"{check_cmd} || {create_cmd}", shell=True, executable="/bin/bash")

    # Trigger a rebuild to ensure services connect to the newly created DBs
    subprocess.run(["touch", "services/goapi-basic/cmd/api/main.go"], cwd=SANDBOX_DIR)
    subprocess.run(["touch", "services/goapi-full/cmd/api/main.go"], cwd=SANDBOX_DIR)

    # Wait for everything to be truly healthy
    print("\nWaiting for services to become responsive...")
    time.sleep(5)

    # 2. Check the status command parses correctly
    status_res = subprocess.run(
        ["bash", "./dev", "status"],
        cwd=SANDBOX_DIR,
        capture_output=True,
        text=True
    )
    assert status_res.returncode == 0, "Failed to get ./dev status"
    print(status_res.stdout)
    
    # Basic assertions to ensure our containers booted
    assert "db" in status_res.stdout
    assert "aspire-dashboard" in status_res.stdout
    
    # Assert native go processes are running
    assert "goapi-basic" in status_res.stdout
    assert "goapi-full" in status_res.stdout
    assert "dead" not in status_res.stdout.lower()


@pytest.mark.asyncio
async def test_05_verify_goapi_health():
    """Test that the native Go services are processing traffic and connected to DB."""
    # goapi-basic is 9000, goapi-full is 9001
    services = [
        ("goapi-basic", "http://localhost:9000/health"),
        ("goapi-full", "http://localhost:9001/health")
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
async def test_06_verify_clerk_webhook_rejection():
    """Test that the Clerk webhook handler rejects unverified requests."""
    url = "http://localhost:9001/webhooks/clerk"
    payload = {"type": "user.created", "data": {"id": "user_123"}}
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, timeout=2.0)
        # Should be 400 Bad Request or 401 Unauthorized because of missing Svix signature
        assert resp.status_code in [400, 401], f"Expected webhook to reject, got {resp.status_code}"
        print(f"\nWebhook correctly rejected unverified payload: {resp.status_code}")

def test_07_run_isolated_system_tests():
    """Test running the offset 500x topology concurrently via the system test runner."""
    print("\n--- Running System Tests (Isolated Topology) ---")
    
    # Run pytest inside the generated tests/system directory
    res = subprocess.run(
        ["uv", "run", "pytest", "test_system.py", "-v", "-s"],
        cwd=SANDBOX_DIR / "tests" / "system",
        capture_output=True,
        text=True
    )
    print(res.stdout)
    if res.returncode != 0:
        print(f"Stderr: {res.stderr}")
    
    assert res.returncode == 0, "Isolated system tests failed to run"


def test_08_teardown_dev_environment():
    """Test cleaning up the DX environment."""
    print("\n--- Cleaning up ./dev Environment ---")
    
    res = subprocess.run(
        ["bash", "./dev", "clean", "--hard"],
        cwd=SANDBOX_DIR,
        capture_output=True,
        text=True
    )
    print(res.stdout)
    assert res.returncode == 0, "Failed to clean ./dev environment"
