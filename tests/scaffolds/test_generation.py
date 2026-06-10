"""
Layer 1 — Generation Correctness Tests

Runs every combination of generator parameters and asserts that:
  - the generator exits cleanly (returncode == 0)
  - files that SHOULD exist for the given options are present
  - files that SHOULD NOT exist for the given options are absent

No compilation, no Docker, no boot. These are fast structural checks.

Sandbox note: each test generates into a uniquely-named service directory
inside a shared sandbox at .sandboxes/scaffolds/generation/. The sandbox
must live within the repo so Nx can locate node_modules by walking up.
"""

import itertools
import json
import os
import re
import subprocess
import pytest
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
GENERATORS_JSON = REPO_ROOT / "generators.json"
SANDBOX_DIR = REPO_ROOT / ".sandboxes" / "scaffolds" / "generation"


@pytest.fixture(scope="session", autouse=True)
def generation_workspace():
    """Create the shared generation sandbox once per session."""
    import shutil
    if SANDBOX_DIR.exists():
        shutil.rmtree(SANDBOX_DIR)
    SANDBOX_DIR.mkdir(parents=True)
    (SANDBOX_DIR / "package.json").write_text('{"name": "gentest"}')
    (SANDBOX_DIR / "nx.json").write_text("{}")
    yield
    # Leave the sandbox in place for post-run inspection; CI can clean via ./dev eval clean


def _safe_name(param_id: str) -> str:
    """Turn a parametrize ID into a valid directory-safe service name."""
    return re.sub(r"[^a-z0-9]", "-", param_id.lower())[:40]


def _scaffold(service_name: str, generator: str, **params) -> subprocess.CompletedProcess:
    """Run a generator into SANDBOX_DIR/services/<service_name>."""
    cmd = ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:{generator}", "--name", service_name]
    for key, value in params.items():
        cli_key = "--" + key
        cmd.extend([cli_key, str(value).lower() if isinstance(value, bool) else str(value)])
    return subprocess.run(cmd, cwd=SANDBOX_DIR, capture_output=True, text=True)


def _cleanup(service_name: str):
    """Remove a generated service directory so tests don't accumulate state."""
    import shutil
    svc = SANDBOX_DIR / "services" / service_name
    if svc.exists():
        shutil.rmtree(svc)


# ---------------------------------------------------------------------------
# Go Microservice — 18 combinations
# ---------------------------------------------------------------------------

_GO_AUTH = ["none", "service", "clerk"]
_GO_MESSAGING = ["none", "kafka", "gcp-pubsub"]
_GO_WEBSOCKETS = [True, False]

_GO_COMBINATIONS = list(itertools.product(_GO_AUTH, _GO_MESSAGING, _GO_WEBSOCKETS))
_GO_IDS = [f"auth={a},msg={m},ws={w}" for a, m, w in _GO_COMBINATIONS]


@pytest.mark.parametrize("auth,messaging,websockets", _GO_COMBINATIONS, ids=_GO_IDS)
def test_go_microservice_generation(auth, messaging, websockets):
    svc_name = _safe_name(f"go-auth-{auth}-msg-{messaging}-ws-{websockets}")
    _cleanup(svc_name)
    try:
        result = _scaffold(svc_name, "go-microservice",
                           auth=auth, messaging=messaging, websockets=websockets)

        assert result.returncode == 0, (
            f"Generator failed for auth={auth}, messaging={messaging}, websockets={websockets}\n"
            f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        svc = SANDBOX_DIR / "services" / svc_name
        assert svc.exists(), "Service directory was not created"
        assert (svc / "go.mod").exists(), "go.mod missing"
        assert (svc / "cmd" / "api" / "main.go").exists(), "main.go missing"

        # --- Auth ---
        clerk_files = [
            svc / "internal" / "entrypoints" / "api" / "middleware_auth.go",
            svc / "internal" / "entrypoints" / "api" / "clerk_webhook.go",
            svc / "internal" / "core" / "domain" / "user.go",
            svc / "internal" / "core" / "gateway" / "user_repository.go",
            svc / "internal" / "core" / "service" / "user_service.go",
            svc / "internal" / "provider" / "user_repository.go",
        ]
        if auth == "clerk":
            for f in clerk_files:
                assert f.exists(), f"Clerk file missing for auth=clerk: {f.name}"
        else:
            for f in clerk_files:
                assert not f.exists(), f"Clerk file should be absent for auth={auth}: {f.name}"

        # --- Messaging ---
        outbox_files = [
            svc / "internal" / "core" / "gateway" / "message_queue.go",
            svc / "internal" / "core" / "gateway" / "outbox_repository.go",
            svc / "asyncapi-pubsub.yaml",
        ]
        if messaging == "none":
            for f in outbox_files:
                assert not f.exists(), f"Outbox file should be absent for messaging=none: {f.name}"
        else:
            for f in outbox_files:
                assert f.exists(), f"Outbox file missing for messaging={messaging}: {f.name}"

        kafka_provider = svc / "internal" / "provider" / "kafka.go"
        if messaging == "kafka":
            assert kafka_provider.exists(), "kafka.go missing for messaging=kafka"
        else:
            assert not kafka_provider.exists(), f"kafka.go should be absent for messaging={messaging}"

        pubsub_provider = svc / "internal" / "provider" / "gcp_pubsub.go"
        if messaging == "gcp-pubsub":
            assert pubsub_provider.exists(), "gcp_pubsub.go missing for messaging=gcp-pubsub"
        else:
            assert not pubsub_provider.exists(), f"gcp_pubsub.go should be absent for messaging={messaging}"

        # --- WebSockets ---
        ws_files = [
            svc / "internal" / "provider" / "websocket",
            svc / "internal" / "entrypoints" / "api" / "websocket_handler.go",
            svc / "asyncapi-ws.yaml",
        ]
        if websockets:
            for f in ws_files:
                assert f.exists(), f"WebSocket file missing for websockets=true: {f.name}"
        else:
            for f in ws_files:
                assert not f.exists(), f"WebSocket file should be absent for websockets=false: {f.name}"

    finally:
        _cleanup(svc_name)


# ---------------------------------------------------------------------------
# Next.js App — 8 combinations
# ---------------------------------------------------------------------------

_NEXT_AUTH = ["none", "clerk"]
_NEXT_API_PROXY = [True, False]
_NEXT_WEBSOCKETS = [True, False]

_NEXT_COMBINATIONS = list(itertools.product(_NEXT_AUTH, _NEXT_API_PROXY, _NEXT_WEBSOCKETS))
_NEXT_IDS = [f"auth={a},proxy={p},ws={w}" for a, p, w in _NEXT_COMBINATIONS]


@pytest.mark.parametrize("auth,apiProxy,websockets", _NEXT_COMBINATIONS, ids=_NEXT_IDS)
def test_nextjs_app_generation(auth, apiProxy, websockets):
    svc_name = _safe_name(f"next-auth-{auth}-proxy-{apiProxy}-ws-{websockets}")
    _cleanup(svc_name)
    try:
        result = _scaffold(svc_name, "nextjs-app",
                           auth=auth, apiProxy=apiProxy, websockets=websockets)

        assert result.returncode == 0, (
            f"Generator failed for auth={auth}, apiProxy={apiProxy}, websockets={websockets}\n"
            f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        svc = SANDBOX_DIR / "services" / svc_name
        assert svc.exists(), "Service directory was not created"
        assert (svc / "package.json").exists(), "package.json missing"
        assert (svc / "app" / "layout.tsx").exists(), "Root layout missing"
        assert (svc / "app" / "api" / "healthz" / "route.ts").exists(), "Health check route missing"

        # --- Auth ---
        if auth == "clerk":
            assert (svc / "proxy.ts").exists(), "proxy.ts missing for auth=clerk"
            assert (svc / "components" / "providers" / "production.tsx").exists(), "Clerk provider missing"
            assert (svc / "app" / "(auth)" / "sign-in" / "[[...sign-in]]" / "page.tsx").exists(), "Sign-in route missing"
        else:
            assert not (svc / "proxy.ts").exists(), "proxy.ts should be absent for auth=none"
            assert not (svc / "app" / "(auth)").exists(), "Auth routes should be absent for auth=none"
            assert not (svc / "components" / "providers" / "production.tsx").exists(), "Clerk provider should be absent"

        # --- API Proxy ---
        if apiProxy:
            assert (svc / "app" / "api" / "proxy" / "[...path]" / "route.ts").exists(), "Proxy route missing"
            assert (svc / "lib" / "api").exists(), "lib/api missing"
            assert (svc / "lib" / "config.ts").exists(), "lib/config.ts missing"
        else:
            assert not (svc / "app" / "api" / "proxy").exists(), "Proxy route should be absent"
            assert not (svc / "lib" / "api").exists(), "lib/api should be absent"
            assert not (svc / "lib" / "config.ts").exists(), "lib/config.ts should be absent"

        # --- WebSockets ---
        if websockets:
            assert (svc / "app" / "api" / "config").exists(), "WebSocket config route missing"
        else:
            assert not (svc / "app" / "api" / "config").exists(), "WebSocket config route should be absent"

    finally:
        _cleanup(svc_name)


# ---------------------------------------------------------------------------
# Docs Site — single combination (no options)
# ---------------------------------------------------------------------------


def test_docs_site_generation():
    svc_name = "docs-site-test"
    _cleanup(svc_name)
    try:
        result = _scaffold(svc_name, "docs-site")

        assert result.returncode == 0, (
            f"docs-site generator failed\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        svc = SANDBOX_DIR / "services" / svc_name
        assert svc.exists(), "Service directory was not created"
        assert (svc / "package.json").exists(), "package.json missing"
        assert (svc / "next.config.mjs").exists(), "next.config.mjs missing"
        assert (svc / "tsconfig.json").exists(), "tsconfig.json missing"
        assert (svc / "Dockerfile").exists(), "Dockerfile missing"
        assert (svc / "source.config.ts").exists(), "source.config.ts missing"
        assert (svc / "app" / "layout.tsx").exists(), "Root layout missing"
        assert (svc / "app" / "docs" / "[[...slug]]" / "page.tsx").exists(), "Docs catch-all route missing"
    finally:
        _cleanup(svc_name)


# ---------------------------------------------------------------------------
# Python Microservice — 128 combinations
# ---------------------------------------------------------------------------

_PY_REST = [True, False]
_PY_POSTGRES = [True, False]
_PY_MESSAGING = ["none", "redis", "kafka", "gcp-pubsub"]
_PY_WEBSOCKETS = [True, False]
_PY_LLM = [True, False]
_PY_RUNPOD = [True, False]

_PY_COMBINATIONS = list(itertools.product(
    _PY_REST, _PY_POSTGRES, _PY_MESSAGING, _PY_WEBSOCKETS, _PY_LLM, _PY_RUNPOD
))
_PY_IDS = [
    f"rest={r},pg={p},msg={m},ws={w},llm={l},rp={rp}"
    for r, p, m, w, l, rp in _PY_COMBINATIONS
]


@pytest.mark.parametrize(
    "rest,postgres,messaging,websockets,llm,runpod",
    _PY_COMBINATIONS,
    ids=_PY_IDS,
)
def test_python_microservice_generation(rest, postgres, messaging, websockets, llm, runpod):
    svc_name = _safe_name(
        f"py-r{int(rest)}-pg{int(postgres)}-{messaging}-ws{int(websockets)}-l{int(llm)}-rp{int(runpod)}"
    )
    _cleanup(svc_name)
    try:
        result = _scaffold(svc_name, "python-microservice",
                           rest=rest, postgres=postgres, messaging=messaging,
                           websockets=websockets, llm=llm, runpod=runpod)

        assert result.returncode == 0, (
            f"Generator failed for rest={rest}, postgres={postgres}, messaging={messaging}, "
            f"websockets={websockets}, llm={llm}, runpod={runpod}\n"
            f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        svc = SANDBOX_DIR / "services" / svc_name
        assert svc.exists(), "Service directory was not created"
        assert (svc / "pyproject.toml").exists(), "pyproject.toml missing"
        assert (svc / "src" / "main.py").exists(), "main.py missing"

        # --- REST / API entrypoint ---
        api_dir = svc / "src" / "entrypoints" / "api"
        if rest:
            assert api_dir.exists(), "API entrypoints dir missing for rest=True"
        else:
            assert not api_dir.exists(), "API entrypoints dir should be absent for rest=False"

        # --- WebSockets ---
        # websocket_hub.py lives in provider/ — deleted only when websockets=False
        ws_hub = svc / "src" / "provider" / "websocket_hub.py"
        if websockets:
            assert ws_hub.exists(), "websocket_hub.py missing for websockets=True"
        else:
            assert not ws_hub.exists(), "websocket_hub.py should be absent for websockets=False"

        # websocket_handler.py lives in api/ — absent when rest=False (whole api/ deleted)
        # or when websockets=False (explicitly deleted)
        ws_handler = svc / "src" / "entrypoints" / "api" / "websocket_handler.py"
        if websockets and rest:
            assert ws_handler.exists(), "websocket_handler.py missing for websockets=True, rest=True"
        else:
            assert not ws_handler.exists(), "websocket_handler.py should be absent"

        # --- Postgres ---
        if postgres:
            assert (svc / "src" / "provider" / "database.py").exists(), "database.py missing"
            assert (svc / "src" / "provider" / "database_repository.py").exists(), "database_repository.py missing"
            assert (svc / "schema.sql").exists(), "schema.sql missing"
        else:
            assert not (svc / "src" / "provider" / "database.py").exists(), "database.py should be absent"
            assert not (svc / "src" / "provider" / "database_repository.py").exists(), "database_repository.py should be absent"
            assert not (svc / "schema.sql").exists(), "schema.sql should be absent"

        # --- Messaging ---
        msg_queue = svc / "src" / "provider" / "message_queue.py"
        if messaging != "none":
            assert msg_queue.exists(), f"message_queue.py missing for messaging={messaging}"
        else:
            assert not msg_queue.exists(), "message_queue.py should be absent for messaging=none"

        # --- LLM ---
        llm_gateway = svc / "src" / "provider" / "llm_gateway.py"
        if llm:
            assert llm_gateway.exists(), "llm_gateway.py missing for llm=True"
        else:
            assert not llm_gateway.exists(), "llm_gateway.py should be absent for llm=False"

        # --- Runpod ---
        worker_dir = svc / "src" / "entrypoints" / "worker"
        comfyui = svc / "src" / "provider" / "comfyui_gateway.py"
        if runpod:
            assert worker_dir.exists(), "worker entrypoint dir missing for runpod=True"
            assert comfyui.exists(), "comfyui_gateway.py missing for runpod=True"
        else:
            assert not worker_dir.exists(), "worker dir should be absent for runpod=False"
            assert not comfyui.exists(), "comfyui_gateway.py should be absent for runpod=False"

    finally:
        _cleanup(svc_name)


# ---------------------------------------------------------------------------
# Python Microservice — LLM provider selection (--llm-provider)
# ---------------------------------------------------------------------------
#
# The provider is a boilerplate-only choice: both branches emit the same gateway
# shape (LLMGatewayAdapter implementing the abstract LLMGateway protocol), differing
# only in SDK, default model, and exception namespace. openai is the default — a
# plain --llm with no --llmProvider must reproduce the OpenAI gateway unchanged.

@pytest.mark.parametrize(
    "provider,expect_import,expect_model,expect_dep",
    [
        ("openai", "import openai", "gpt-4o", "openai>="),
        ("anthropic", "import anthropic", "claude-sonnet-4-6", "anthropic>="),
        (None, "import openai", "gpt-4o", "openai>="),  # default → openai, unchanged
    ],
    ids=["openai", "anthropic", "default-is-openai"],
)
def test_python_microservice_llm_provider(provider, expect_import, expect_model, expect_dep):
    svc_name = _safe_name(f"py-llm-{provider or 'default'}")
    _cleanup(svc_name)
    try:
        params = dict(rest=True, postgres=False, messaging="none",
                      websockets=False, llm=True, runpod=False)
        if provider is not None:
            params["llmProvider"] = provider
        result = _scaffold(svc_name, "python-microservice", **params)
        assert result.returncode == 0, (
            f"Generator failed for llmProvider={provider}\n"
            f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        svc = SANDBOX_DIR / "services" / svc_name
        gateway = (svc / "src" / "provider" / "llm_gateway.py").read_text()
        config = (svc / "src" / "provider" / "config.py").read_text()
        env = (svc / ".env.example").read_text()
        pyproject = (svc / "pyproject.toml").read_text()

        # Provider-specific SDK + model default, but a provider-neutral class name.
        assert expect_import in gateway, f"expected {expect_import!r} in llm_gateway.py"
        assert "class LLMGatewayAdapter:" in gateway, "gateway class must be provider-neutral LLMGatewayAdapter"
        assert "OpenAILLMGateway" not in gateway, "legacy provider-specific class name must be gone"
        assert f'llm_model: str = "{expect_model}"' in config, f"config default model should be {expect_model}"
        assert f"LLM_MODEL={expect_model}" in env, f".env default model should be {expect_model}"
        assert expect_dep in pyproject, f"pyproject should pin {expect_dep}"
    finally:
        _cleanup(svc_name)


# ---------------------------------------------------------------------------
# Stack docs deployment
# ---------------------------------------------------------------------------

_STACK_DOCS_SANDBOX = REPO_ROOT / ".sandboxes" / "scaffolds" / "stack-docs"


@pytest.fixture(scope="module", autouse=False)
def stack_docs_workspace():
    import shutil
    if _STACK_DOCS_SANDBOX.exists():
        shutil.rmtree(_STACK_DOCS_SANDBOX)
    _STACK_DOCS_SANDBOX.mkdir(parents=True)
    (_STACK_DOCS_SANDBOX / "package.json").write_text('{"name": "stackdocstest"}')
    (_STACK_DOCS_SANDBOX / "nx.json").write_text("{}")
    yield
    shutil.rmtree(_STACK_DOCS_SANDBOX, ignore_errors=True)


def _scaffold_in(sandbox: Path, service_name: str, generator: str, **params) -> subprocess.CompletedProcess:
    cmd = ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:{generator}", "--name", service_name]
    for key, value in params.items():
        cli_key = "--" + key
        cmd.extend([cli_key, str(value).lower() if isinstance(value, bool) else str(value)])
    return subprocess.run(cmd, cwd=sandbox, capture_output=True, text=True)


def test_go_stack_docs_deployed(stack_docs_workspace):
    result = _scaffold_in(_STACK_DOCS_SANDBOX, "go-svc-docs", "go-microservice",
                          auth="none", messaging="none", websockets=False)
    assert result.returncode == 0, f"Go generator failed\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"

    docs_root = _STACK_DOCS_SANDBOX / "docs" / "principles" / "stack" / "go"
    assert (docs_root / "index.md").exists(), "Go stack docs index.md not deployed"
    assert (docs_root / "concurrency.md").exists(), "Go stack docs concurrency.md not deployed"
    assert (docs_root / "testing.md").exists(), "Go stack docs testing.md not deployed"


def test_python_stack_docs_deployed(stack_docs_workspace):
    result = _scaffold_in(_STACK_DOCS_SANDBOX, "py-svc-docs", "python-microservice",
                          rest=True, postgres=False, messaging="none",
                          websockets=False, llm=False, runpod=False)
    assert result.returncode == 0, f"Python generator failed\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"

    docs_root = _STACK_DOCS_SANDBOX / "docs" / "principles" / "stack" / "python"
    assert (docs_root / "async.md").exists(), "Python stack docs async.md not deployed"
    assert (docs_root / "resilience.md").exists(), "Python stack docs resilience.md not deployed"
    assert (docs_root / "testing.md").exists(), "Python stack docs testing.md not deployed"
    assert (docs_root / "documentation.md").exists(), "Python stack docs documentation.md not deployed"
    assert (docs_root / "mcp.md").exists(), "Python stack docs mcp.md not deployed"


def test_nextjs_stack_docs_deployed(stack_docs_workspace):
    result = _scaffold_in(_STACK_DOCS_SANDBOX, "next-svc-docs", "nextjs-app",
                          auth="none", apiProxy=False, websockets=False)
    assert result.returncode == 0, f"Next.js generator failed\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"

    docs_root = _STACK_DOCS_SANDBOX / "docs" / "principles" / "stack" / "typescript"
    assert (docs_root / "frontend.md").exists(), "Next.js stack docs frontend.md not deployed"


def test_stack_docs_idempotency(stack_docs_workspace):
    """Second generation of the same language must not overwrite existing stack docs."""
    go_index = _STACK_DOCS_SANDBOX / "docs" / "principles" / "stack" / "go" / "index.md"

    # First generation (may already be present from test_go_stack_docs_deployed)
    _scaffold_in(_STACK_DOCS_SANDBOX, "go-idempotency-1", "go-microservice",
                 auth="none", messaging="none", websockets=False)
    assert go_index.exists(), "Go index.md must exist after first generation"
    original_mtime = go_index.stat().st_mtime

    # Second generation — must not touch the file
    _scaffold_in(_STACK_DOCS_SANDBOX, "go-idempotency-2", "go-microservice",
                 auth="none", messaging="none", websockets=False)
    assert go_index.stat().st_mtime == original_mtime, (
        "go/index.md mtime changed on second generation — idempotency check failed"
    )


# ---------------------------------------------------------------------------
# System Test Runner — 3 interfaceMedium variants
# ---------------------------------------------------------------------------

_SYSTEM_TEST_RUNNER_SANDBOX_BASE = REPO_ROOT / ".sandboxes" / "scaffolds" / "system-test-runner"

_INTERFACE_MEDIA = ["graphical-ui", "cli", "agentic-protocol"]
_INTERFACE_MEDIA_IDS = _INTERFACE_MEDIA


def _scaffold_workspace(sandbox: Path, generator: str, **params) -> subprocess.CompletedProcess:
    """Run a workspace-level generator (no --name) into sandbox root."""
    cmd = ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:{generator}"]
    for key, value in params.items():
        cli_key = "--" + key
        cmd.extend([cli_key, str(value).lower() if isinstance(value, bool) else str(value)])
    return subprocess.run(cmd, cwd=sandbox, capture_output=True, text=True)


@pytest.mark.parametrize("medium", _INTERFACE_MEDIA, ids=_INTERFACE_MEDIA_IDS)
def test_system_test_runner_generation(medium):
    import shutil
    sandbox = _SYSTEM_TEST_RUNNER_SANDBOX_BASE / medium.replace("-", "_")
    if sandbox.exists():
        shutil.rmtree(sandbox)
    sandbox.mkdir(parents=True)
    (sandbox / "package.json").write_text('{"name": "sysrunnertest"}')
    (sandbox / "nx.json").write_text("{}")
    try:
        result = _scaffold_workspace(sandbox, "system-test-runner", interfaceMedium=medium)
        assert result.returncode == 0, (
            f"system-test-runner generator failed for interfaceMedium={medium}\n"
            f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        # --- Always present ---
        assert (sandbox / "tests" / "conftest.py").exists(), \
            "tests/conftest.py (shared fixtures) missing"
        assert not (sandbox / "tests" / "system" / "conftest.py").exists(), \
            "tests/system/conftest.py should NOT exist — a child conftest with the same " \
            "basename causes a circular import when test_system.py does 'from conftest import ...'. " \
            "Fixtures are auto-discovered from the parent tests/conftest.py."
        assert (sandbox / "tests" / "system" / "test_system.py").exists(), \
            "tests/system/test_system.py missing"
        assert (sandbox / "tests" / "system" / "test_contract_conformance.py").exists(), \
            "tests/system/test_contract_conformance.py missing — served-spec vs " \
            "docs/api/<service>/openapi.yaml conformance is generated for every medium"
        assert (sandbox / "tests" / "bets" / ".gitkeep").exists(), \
            "tests/bets/.gitkeep missing"
        assert (sandbox / "tests" / "bets" / "_archive" / ".gitkeep").exists(), \
            "tests/bets/_archive/.gitkeep missing"

        # testpaths includes "bets"
        pyproject = (sandbox / "tests" / "pyproject.toml").read_text()
        assert '"bets"' in pyproject, \
            f"pyproject.toml testpaths does not include 'bets' for medium={medium}"

        # --- Conditional: Playwright structure only for graphical-ui ---
        if medium == "graphical-ui":
            assert "pytest-playwright" in pyproject, \
                "pytest-playwright dep missing for interfaceMedium=graphical-ui"
            shared_conftest = (sandbox / "tests" / "conftest.py").read_text()
            assert "frontend_base_url" in shared_conftest, \
                "frontend_base_url fixture missing for interfaceMedium=graphical-ui"
            assert (sandbox / "tests" / "system" / "pages" / "__init__.py").exists(), \
                "tests/system/pages/__init__.py missing for interfaceMedium=graphical-ui"
            assert (sandbox / "tests" / "system" / "pages" / "base_page.py").exists(), \
                "tests/system/pages/base_page.py missing for interfaceMedium=graphical-ui"
            assert (sandbox / "tests" / "system" / "test_a11y_smoke.py").exists(), \
                "tests/system/test_a11y_smoke.py missing for interfaceMedium=graphical-ui"
        else:
            assert "pytest-playwright" not in pyproject, \
                f"pytest-playwright should be absent for interfaceMedium={medium}"
            assert not (sandbox / "tests" / "system" / "pages").exists(), \
                f"tests/system/pages/ should be absent for interfaceMedium={medium}"
            assert not (sandbox / "tests" / "system" / "test_a11y_smoke.py").exists(), \
                f"tests/system/test_a11y_smoke.py should be absent for interfaceMedium={medium}"

        # --- Shared conftest WORKSPACE_ROOT depth ---
        # conftest.py now lives at tests/ — one level shallower than tests/system/.
        # WORKSPACE_ROOT must use parent.parent (not parent.parent.parent).
        shared = (sandbox / "tests" / "conftest.py").read_text()
        assert "parent.parent.parent" not in shared, (
            "WORKSPACE_ROOT has too many .parent calls — conftest.py is now at tests/, "
            "not tests/system/; use .parent.parent"
        )
        assert "parent.parent" in shared, \
            "WORKSPACE_ROOT path missing — expected .parent.parent in tests/conftest.py"

    finally:
        shutil.rmtree(sandbox, ignore_errors=True)


# ---------------------------------------------------------------------------
# Workspace Dev CLI — bet workflow files
# ---------------------------------------------------------------------------

_WORKSPACE_DEV_CLI_SANDBOX = REPO_ROOT / ".sandboxes" / "scaffolds" / "workspace-dev-cli-bet"


@pytest.fixture(scope="module", autouse=False)
def workspace_dev_cli_bet_workspace():
    import shutil
    if _WORKSPACE_DEV_CLI_SANDBOX.exists():
        shutil.rmtree(_WORKSPACE_DEV_CLI_SANDBOX)
    _WORKSPACE_DEV_CLI_SANDBOX.mkdir(parents=True)
    (_WORKSPACE_DEV_CLI_SANDBOX / "package.json").write_text('{"name": "devclibettest"}')
    (_WORKSPACE_DEV_CLI_SANDBOX / "nx.json").write_text("{}")
    yield
    shutil.rmtree(_WORKSPACE_DEV_CLI_SANDBOX, ignore_errors=True)


def test_workspace_dev_cli_bet_files(workspace_dev_cli_bet_workspace):
    """workspace-dev-cli generates the Node ./dev CLI (launcher + prebuilt bundle +
    brand config) and the language-agnostic bet-workflow test-stub templates, and the
    generated CLI actually runs."""
    sb = _WORKSPACE_DEV_CLI_SANDBOX
    result = _scaffold_workspace(sb, "workspace-dev-cli")
    assert result.returncode == 0, (
        f"workspace-dev-cli generator failed\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
    )

    # --- Node CLI artifacts ---
    assert (sb / "dev").exists(), "dev launcher missing"
    assert (sb / ".dev" / "dev-bundle.js").exists(), ".dev/dev-bundle.js (prebuilt bundle) missing"
    assert (sb / ".dev" / "dev.config.json").exists(), ".dev/dev.config.json missing"

    # Launcher requires the bundle and is executable
    dev_script = (sb / "dev").read_text()
    assert "dev-bundle.js" in dev_script, "dev launcher does not require .dev/dev-bundle.js"
    assert os.access(sb / "dev", os.X_OK), "dev launcher is not executable"

    # dev.config.json is valid JSON carrying the projected brand identity
    config = json.loads((sb / ".dev" / "dev.config.json").read_text())
    assert config.get("identity", {}).get("appName"), "dev.config.json missing identity.appName"
    assert "projectPrefix" in config, "dev.config.json missing projectPrefix"

    # --- Bet workflow stub templates (language-agnostic; pytest must NOT collect .pytmpl) ---
    assert (sb / "scripts" / "cli" / "templates" / "milestone-test.pytmpl").exists(), \
        "scripts/cli/templates/milestone-test.pytmpl missing"
    assert (sb / "scripts" / "cli" / "templates" / "slice-test.pytmpl").exists(), \
        "scripts/cli/templates/slice-test.pytmpl missing"

    milestone_stub = (sb / "scripts" / "cli" / "templates" / "milestone-test.pytmpl").read_text()
    assert "@@BET@@" in milestone_stub, "milestone-test.pytmpl missing @@BET@@ token"
    assert "@@MILESTONE@@" in milestone_stub, "milestone-test.pytmpl missing @@MILESTONE@@ token"
    assert "@@N@@" in milestone_stub, "milestone-test.pytmpl missing @@N@@ token"

    slice_stub = (sb / "scripts" / "cli" / "templates" / "slice-test.pytmpl").read_text()
    assert "@@SERVICE@@" in slice_stub, "slice-test.pytmpl missing @@SERVICE@@ token"
    assert "@@SLUG@@" in slice_stub, "slice-test.pytmpl missing @@SLUG@@ token"

    # --- Smoke gate: the generated CLI loads and runs (the compile-equivalent this
    # generator otherwise lacks). Invoke via `node dev` so it does not depend on the
    # executable bit surviving every environment. ---
    help_run = subprocess.run(
        ["node", "dev", "--help"], cwd=sb, capture_output=True, text=True, timeout=60
    )
    assert help_run.returncode == 0, f"./dev --help failed\nSTDERR: {help_run.stderr}"

    status_run = subprocess.run(
        ["node", "dev", "status", "--json"], cwd=sb, capture_output=True, text=True, timeout=60
    )
    assert status_run.returncode == 0, f"./dev status --json failed\nSTDERR: {status_run.stderr}"
    parsed = json.loads(status_run.stdout)
    assert "docker" in parsed and "native" in parsed, \
        f"status --json shape unexpected: {status_run.stdout[:200]}"


# ---------------------------------------------------------------------------
# CLI App — branded product CLI generator
# ---------------------------------------------------------------------------

_CLI_APP_SANDBOX = REPO_ROOT / ".sandboxes" / "scaffolds" / "cli-app"

_BRAND_TOKENS_FIXTURE = """{
  "schema": "groundwork.brand-tokens", "version": 1, "tier": 2,
  "identity": {"appName": "Demo", "wordmark": "*", "primary": "#a855f7", "accent": "#22d3ee", "voice": "crisp"},
  "terminal": {
    "colorRoles": {"success": {"truecolor": "#22c55e", "ansi256": 34, "noColor": "bold"}, "error": {"truecolor": "#ef4444", "ansi256": 196, "noColor": "bold"}, "warning": {"truecolor": "#eab308", "ansi256": 178, "noColor": "bold"}, "info": {"truecolor": "#a855f7", "ansi256": 135, "noColor": "dim"}, "muted": {"truecolor": "#888888", "ansi256": 245, "noColor": "dim"}, "accent": {"truecolor": "#22d3ee", "ansi256": 51, "noColor": "underline"}, "header": {"truecolor": null, "ansi256": null, "noColor": "bold+upper"}, "key": {"truecolor": "#a855f7", "ansi256": 135, "noColor": "plain"}, "value": {"truecolor": "#d0d0d0", "ansi256": 252, "noColor": "plain"}},
    "symbols": {"success": {"unicode": "\\u2714", "ascii": "OK"}, "error": {"unicode": "\\u2716", "ascii": "x"}, "warning": {"unicode": "\\u26a0", "ascii": "!"}, "info": {"unicode": "\\u25cf", "ascii": "*"}, "step": {"unicode": "\\u25b6", "ascii": ">"}, "substep": {"unicode": "\\u21b3", "ascii": "-"}, "active": {"unicode": "\\u276f", "ascii": ">"}},
    "splash": {"style": "wordmark-line", "tagline": ""},
    "typography": {"header": "bold + UPPERCASE", "title": "bold + primary", "body": "plain", "muted": "dim"}
  }
}"""


@pytest.fixture()
def cli_app_workspace():
    import shutil
    if _CLI_APP_SANDBOX.exists():
        shutil.rmtree(_CLI_APP_SANDBOX)
    (_CLI_APP_SANDBOX / ".groundwork" / "config").mkdir(parents=True)
    (_CLI_APP_SANDBOX / "package.json").write_text('{"name": "cliapptest"}')
    (_CLI_APP_SANDBOX / "nx.json").write_text("{}")
    (_CLI_APP_SANDBOX / ".groundwork" / "config" / "brand-tokens.json").write_text(_BRAND_TOKENS_FIXTURE)
    yield
    shutil.rmtree(_CLI_APP_SANDBOX, ignore_errors=True)


def test_cli_app_generation(cli_app_workspace):
    """cli-app scaffolds a branded TypeScript CLI product themed from brand-tokens.json,
    including the shared theme layer and (with --repl) the interactive layer; and the
    generated TypeScript type-checks."""
    sb = _CLI_APP_SANDBOX
    cmd = [
        "npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:cli-app",
        "--name", "Demo CLI", "--repl=true",
    ]
    result = subprocess.run(cmd, cwd=sb, capture_output=True, text=True)
    assert result.returncode == 0, (
        f"cli-app generator failed\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
    )

    proj = sb / "services" / "demo-cli"
    # --- Structural ---
    for rel in [
        "package.json", "tsconfig.json", "build.mjs", "README.md",
        "src/cli.ts", "src/registry.ts", "src/commands/hello.ts", "src/brand.json",
        "src/theme/tokens.ts", "src/theme/color.ts", "src/theme/render.ts",
        "src/commands/repl.ts", "src/util/prompt.ts",  # --repl layer
    ]:
        assert (proj / rel).exists(), f"cli-app missing {rel}"

    # --- Brand projected from tokens ---
    brand = json.loads((proj / "src" / "brand.json").read_text())
    assert brand["identity"]["appName"] == "Demo", "brand.json appName not projected from tokens"
    assert brand["identity"]["primary"] == "#a855f7", "brand.json primary not projected from tokens"
    assert "terminal" in brand, "Tier-2 terminal block not projected"

    # --- REPL registered ---
    assert "repl" in (proj / "src" / "registry.ts").read_text(), "repl not registered for --repl"

    # --- Generated TypeScript type-checks (resolves tooling from the repo) ---
    tsc = REPO_ROOT / "node_modules" / ".bin" / "tsc"
    tc = subprocess.run(
        [str(tsc), "--noEmit", "-p", str(proj / "tsconfig.json")],
        cwd=REPO_ROOT, capture_output=True, text=True, timeout=120,
    )
    assert tc.returncode == 0, f"generated cli-app does not type-check\nSTDOUT: {tc.stdout}\nSTDERR: {tc.stderr}"
