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
            svc / "internal" / "core" / "service" / "user_repository.go",
            svc / "internal" / "core" / "service" / "user_service.go",
            svc / "internal" / "postgres" / "user_repository.go",
        ]
        if auth == "clerk":
            for f in clerk_files:
                assert f.exists(), f"Clerk file missing for auth=clerk: {f.name}"
        else:
            for f in clerk_files:
                assert not f.exists(), f"Clerk file should be absent for auth={auth}: {f.name}"

        # --- Messaging ---
        outbox_files = [
            svc / "internal" / "core" / "service" / "message_queue.go",
            svc / "internal" / "core" / "service" / "outbox_repository.go",
            svc / "asyncapi-pubsub.yaml",
        ]
        if messaging == "none":
            for f in outbox_files:
                assert not f.exists(), f"Outbox file should be absent for messaging=none: {f.name}"
        else:
            for f in outbox_files:
                assert f.exists(), f"Outbox file missing for messaging={messaging}: {f.name}"

        kafka_provider = svc / "internal" / "kafka" / "kafka.go"
        if messaging == "kafka":
            assert kafka_provider.exists(), "kafka.go missing for messaging=kafka"
        else:
            assert not kafka_provider.exists(), f"kafka.go should be absent for messaging={messaging}"

        pubsub_provider = svc / "internal" / "pubsub" / "gcp_pubsub.go"
        if messaging == "gcp-pubsub":
            assert pubsub_provider.exists(), "gcp_pubsub.go missing for messaging=gcp-pubsub"
        else:
            assert not pubsub_provider.exists(), f"gcp_pubsub.go should be absent for messaging={messaging}"

        # --- WebSockets ---
        ws_files = [
            svc / "internal" / "websocket",
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

        # --- Visual verification loop: token-conformance lint (B1) + component render test (B2) ---
        eslint_cfg = (svc / "eslint.config.mjs").read_text()
        assert "no-restricted-syntax" in eslint_cfg, "token-conformance lint rule missing from eslint config"
        assert "Tailwind arbitrary colour value" in eslint_cfg, "token-conformance lint messages missing"
        assert (svc / "components" / "render-smoke.test.tsx").exists(), \
            "component render-test example missing"

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
        assert (svc / "source.config.ts").exists(), "source.config.ts missing"
        assert (svc / "app" / "layout.tsx").exists(), "Root layout missing"
        assert (svc / "app" / "docs" / "[[...slug]]" / "page.tsx").exists(), "Docs catch-all route missing"

        # Native runner, not a container: no Dockerfile, and it never joins compose.
        assert not (svc / "Dockerfile").exists(), "docs-site is a native runner — no Dockerfile"

        # Frontmatter-free docs: the source schema derives titles from the first H1.
        source_config = (svc / "source.config.ts").read_text()
        assert "frontmatterSchema" in source_config and "ctx.source.match" in source_config, (
            "source.config.ts must derive the title from the first H1 for frontmatter-free docs"
        )
        # The fumadocs source map is generated by the fumadocs-mdx postinstall.
        pkg = json.loads((svc / "package.json").read_text())
        assert pkg.get("scripts", {}).get("postinstall") == "fumadocs-mdx", (
            "package.json must run `fumadocs-mdx` on postinstall to generate @/.source types"
        )
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
        pkg = svc_name.replace("-", "_")
        assert svc.exists(), "Service directory was not created"
        assert (svc / "pyproject.toml").exists(), "pyproject.toml missing"
        assert (svc / "src" / pkg / "main.py").exists(), "main.py missing"

        # --- REST / API entrypoint ---
        api_dir = svc / "src" / pkg / "entrypoints" / "api"
        if rest:
            assert api_dir.exists(), "API entrypoints dir missing for rest=True"
        else:
            assert not api_dir.exists(), "API entrypoints dir should be absent for rest=False"

        # --- WebSockets ---
        # websocket_hub.py lives in adapters/ — deleted only when websockets=False
        ws_hub = svc / "src" / pkg / "adapters" / "websocket_hub.py"
        if websockets:
            assert ws_hub.exists(), "websocket_hub.py missing for websockets=True"
        else:
            assert not ws_hub.exists(), "websocket_hub.py should be absent for websockets=False"

        # websocket_handler.py lives in api/ — absent when rest=False (whole api/ deleted)
        # or when websockets=False (explicitly deleted)
        ws_handler = svc / "src" / pkg / "entrypoints" / "api" / "websocket_handler.py"
        if websockets and rest:
            assert ws_handler.exists(), "websocket_handler.py missing for websockets=True, rest=True"
        else:
            assert not ws_handler.exists(), "websocket_handler.py should be absent"

        # --- Postgres ---
        if postgres:
            assert (svc / "src" / pkg / "adapters" / "database.py").exists(), "database.py missing"
            assert (svc / "src" / pkg / "adapters" / "repository.py").exists(), "repository.py missing"
            # Schema lives under db/ for parity with the Go scaffold (pg-schema-diff
            # --to-dir ./db), applied by scripts/apply-schema.sh.
            assert (svc / "db" / "schema.sql").exists(), "db/schema.sql missing"
            assert (svc / "scripts" / "apply-schema.sh").exists(), "apply-schema.sh missing"
        else:
            assert not (svc / "src" / pkg / "adapters" / "database.py").exists(), "database.py should be absent"
            assert not (svc / "src" / pkg / "adapters" / "repository.py").exists(), "repository.py should be absent"
            assert not (svc / "db" / "schema.sql").exists(), "db/schema.sql should be absent"
            assert not (svc / "scripts" / "apply-schema.sh").exists(), "apply-schema.sh should be absent"

        # --- Messaging ---
        msg_queue = svc / "src" / pkg / "adapters" / "message_queue.py"
        if messaging != "none":
            assert msg_queue.exists(), f"message_queue.py missing for messaging={messaging}"
        else:
            assert not msg_queue.exists(), "message_queue.py should be absent for messaging=none"

        # --- LLM ---
        llm_adapter = svc / "src" / pkg / "adapters" / "llm.py"
        if llm:
            assert llm_adapter.exists(), "adapters/llm.py missing for llm=True"
        else:
            assert not llm_adapter.exists(), "adapters/llm.py should be absent for llm=False"

        # --- Runpod ---
        worker_dir = svc / "src" / pkg / "entrypoints" / "worker"
        comfyui = svc / "src" / pkg / "adapters" / "comfyui.py"
        if runpod:
            assert worker_dir.exists(), "worker entrypoint dir missing for runpod=True"
            assert comfyui.exists(), "comfyui.py missing for runpod=True"
        else:
            assert not worker_dir.exists(), "worker dir should be absent for runpod=False"
            assert not comfyui.exists(), "comfyui.py should be absent for runpod=False"

    finally:
        _cleanup(svc_name)


# ---------------------------------------------------------------------------
# Python Microservice — LLM provider selection (--llm-provider)
# ---------------------------------------------------------------------------
#
# The provider is a boilerplate-only choice: both branches emit the same adapter
# shape (LLMClient implementing the TextGenerator port), differing only in SDK,
# default model, and exception namespace. openai is the default — a plain --llm
# with no --llmProvider must reproduce the OpenAI adapter unchanged.

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
        pkg = svc_name.replace("-", "_")
        adapter = (svc / "src" / pkg / "adapters" / "llm.py").read_text()
        config = (svc / "src" / pkg / "adapters" / "config.py").read_text()
        env = (svc / ".env.example").read_text()
        pyproject = (svc / "pyproject.toml").read_text()

        # Provider-specific SDK + model default, but a provider-neutral class name.
        assert expect_import in adapter, f"expected {expect_import!r} in adapters/llm.py"
        assert "class LLMClient:" in adapter, "adapter class must be provider-neutral LLMClient"
        assert "OpenAILLMGateway" not in adapter, "legacy provider-specific class name must be gone"
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
            for layer in ("test_render_smoke.py", "test_layout_geometry.py", "test_visual_regression.py", "test_token_conformance.py"):
                p = sandbox / "tests" / "system" / layer
                assert p.exists(), f"tests/system/{layer} missing for interfaceMedium=graphical-ui"
                _py_compiles(p)
        else:
            assert "pytest-playwright" not in pyproject, \
                f"pytest-playwright should be absent for interfaceMedium={medium}"
            assert not (sandbox / "tests" / "system" / "pages").exists(), \
                f"tests/system/pages/ should be absent for interfaceMedium={medium}"
            assert not (sandbox / "tests" / "system" / "test_a11y_smoke.py").exists(), \
                f"tests/system/test_a11y_smoke.py should be absent for interfaceMedium={medium}"
            for layer in ("test_render_smoke.py", "test_layout_geometry.py", "test_visual_regression.py", "test_token_conformance.py"):
                assert not (sandbox / "tests" / "system" / layer).exists(), \
                    f"tests/system/{layer} should be absent for interfaceMedium={medium}"

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

        # --- Registry mode is opt-in ---
        # The deprecated single-medium alias must emit none of the surfaces-mode
        # artifacts: legacy output is the compatibility contract for projects
        # that predate the surface registry.
        assert "_SURFACE_SPECS" not in shared, \
            f"surfaces-mode spec map leaked into single-medium output for medium={medium}"
        assert "def surfaces(" not in shared, \
            f"surfaces fixture leaked into single-medium output for medium={medium}"
        assert "pexpect" not in (sandbox / "tests" / "pyproject.toml").read_text(), \
            f"pexpect dep leaked into single-medium output for medium={medium}"

    finally:
        shutil.rmtree(sandbox, ignore_errors=True)


# ---------------------------------------------------------------------------
# System Test Runner — surface-registry mode (--surfaces)
# ---------------------------------------------------------------------------


def _make_runner_sandbox(name: str) -> Path:
    import shutil
    sandbox = _SYSTEM_TEST_RUNNER_SANDBOX_BASE / name
    if sandbox.exists():
        shutil.rmtree(sandbox)
    sandbox.mkdir(parents=True)
    (sandbox / "package.json").write_text('{"name": "sysrunnertest"}')
    (sandbox / "nx.json").write_text("{}")
    return sandbox


def _py_compiles(path: Path) -> None:
    """The generated file must be valid Python — structural greps cannot catch
    a template rendering that produces syntactically broken fixtures."""
    proc = subprocess.run(
        ["python3", "-m", "py_compile", str(path)], capture_output=True, text=True
    )
    assert proc.returncode == 0, f"{path.name} does not compile:\n{proc.stderr}"


def test_system_test_runner_two_surface_generation():
    """A web + CLI registry produces both fixture families, the slug-keyed
    `surfaces` map, and the deprecated frontend_base_url alias (generated while
    exactly one graphical surface exists)."""
    import shutil
    sandbox = _make_runner_sandbox("two_surface")
    specs = json.dumps([
        {"slug": "web-app", "medium": "playwright"},
        {"slug": "admin-cli", "medium": "subprocess-cli",
         "reach": "node services/admin-cli/dist/cli.js"},
    ])
    try:
        result = _scaffold_workspace(sandbox, "system-test-runner", surfaces=specs)
        assert result.returncode == 0, (
            f"system-test-runner generator failed for --surfaces (web+cli)\n"
            f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        conftest = (sandbox / "tests" / "conftest.py").read_text()
        _py_compiles(sandbox / "tests" / "conftest.py")

        # --- The canonical surfaces map: slug-keyed specs + session fixture ---
        assert '"web-app": {"medium": "playwright", "reach": None}' in conftest, \
            "web-app spec missing from _SURFACE_SPECS"
        assert ('"admin-cli": {"medium": "subprocess-cli", '
                '"reach": "node services/admin-cli/dist/cli.js"}') in conftest, \
            "admin-cli spec (with static reach) missing from _SURFACE_SPECS"
        assert "def surfaces(services_manifest)" in conftest, \
            "slug-keyed surfaces fixture missing"

        # --- One runner fixture per surface, named by slug + medium family ---
        assert "def web_app_page(browser, surfaces):" in conftest, \
            "playwright page fixture missing for web-app"
        assert "def admin_cli_runner(surfaces):" in conftest, \
            "subprocess runner fixture missing for admin-cli"

        # --- Deprecated alias survives while exactly one graphical surface exists ---
        assert "def frontend_base_url(surfaces):" in conftest, \
            "frontend_base_url alias missing for single-graphical registry"

        # --- Playwright structure + per-CLI pexpect ship with their surfaces ---
        pyproject = (sandbox / "tests" / "pyproject.toml").read_text()
        assert "pytest-playwright" in pyproject, \
            "pytest-playwright missing despite a playwright surface"
        assert "pexpect" in pyproject, \
            "pexpect missing despite a subprocess-cli surface"
        assert (sandbox / "tests" / "system" / "pages" / "base_page.py").exists(), \
            "page-object package missing despite a playwright surface"
        a11y_path = sandbox / "tests" / "system" / "test_a11y_smoke.py"
        assert a11y_path.exists(), "a11y smoke missing despite a playwright surface"
        _py_compiles(a11y_path)
        assert "def test_web_app_root_a11y_smoke" in a11y_path.read_text(), \
            "a11y smoke not generated per graphical surface"
        render_smoke_path = sandbox / "tests" / "system" / "test_render_smoke.py"
        assert render_smoke_path.exists(), "render smoke missing despite a playwright surface"
        _py_compiles(render_smoke_path)
        render_smoke_body = render_smoke_path.read_text()
        assert "def test_web_app_render_smoke" in render_smoke_body, \
            "render smoke not generated per graphical surface"
        # The dead-end navigation check ships in the render-smoke floor.
        assert "dead-end screen" in render_smoke_body, \
            "render smoke missing the no-dead-end navigation assertion"

        # Known mediums (web + cli) are both runnable — no fail-closed placeholder.
        import glob as _glob
        leaked = _glob.glob(str(sandbox / "tests" / "system" / "*ui_check_missing*"))
        assert not leaked, \
            f"fail-closed placeholder leaked for a known, runnable medium: {leaked}"
        geometry_path = sandbox / "tests" / "system" / "test_layout_geometry.py"
        assert geometry_path.exists(), "geometry gate missing despite a playwright surface"
        _py_compiles(geometry_path)
        assert "def test_web_app_no_horizontal_overflow" in geometry_path.read_text(), \
            "geometry gate not generated per graphical surface"
        visreg_path = sandbox / "tests" / "system" / "test_visual_regression.py"
        assert visreg_path.exists(), "visual regression gate missing despite a playwright surface"
        _py_compiles(visreg_path)
        assert "def test_web_app_visual_regression" in visreg_path.read_text(), \
            "visual regression gate not generated per graphical surface"
        conformance_path = sandbox / "tests" / "system" / "test_token_conformance.py"
        assert conformance_path.exists(), "token-conformance gate missing despite a playwright surface"
        _py_compiles(conformance_path)
        assert "def test_web_app_token_conformance" in conformance_path.read_text(), \
            "token-conformance gate not generated per graphical surface"
    finally:
        shutil.rmtree(sandbox, ignore_errors=True)


def test_system_test_runner_manual_surface_registration():
    """A surface whose medium has no GroundWork-runnable check (e.g. a kiosk
    surface on bespoke appium tooling) is registered in the `surfaces` fixture
    so tests can name it, gets no auto fixture family — and, because it is a
    surface nothing checks, gets a FAIL-CLOSED placeholder check rather than a
    silent skip. The placeholder fails until a platform UI check is implemented
    per NATIVE-CHECK-CONTRACT.md; that is the silent-no-op this closes."""
    import shutil
    sandbox = _make_runner_sandbox("manual_surface")
    specs = json.dumps([
        {"slug": "web-app", "medium": "playwright"},
        {"slug": "kiosk-app", "medium": "appium"},
    ])
    try:
        result = _scaffold_workspace(sandbox, "system-test-runner", surfaces=specs)
        assert result.returncode == 0, (
            f"system-test-runner generator failed for --surfaces (manual kiosk)\n"
            f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        conftest = (sandbox / "tests" / "conftest.py").read_text()
        _py_compiles(sandbox / "tests" / "conftest.py")

        # --- Registered in the surfaces map... ---
        assert '"kiosk-app": {"medium": "appium", "reach": None}' in conftest, \
            "manual surface not registered in _SURFACE_SPECS"

        # --- ...but no runner fixture until its medium ships a family ---
        assert "kiosk_app_page" not in conftest, \
            "manual surface must not get a playwright page fixture"
        assert "kiosk_app_runner" not in conftest, \
            "manual surface must not get a subprocess runner fixture"
        assert "kiosk_app_client" not in conftest, \
            "manual surface must not get a protocol client fixture"
        # No app-harness machinery without a flutter/electron surface.
        assert "_HARNESS_MEDIUMS" not in conftest, \
            "app-harness medium map leaked without a flutter/electron surface"

        # --- Fail-closed: the unverified surface gets a failing placeholder,
        #     never a silent skip. This is the Magpie-class fix. ---
        placeholder = sandbox / "tests" / "system" / "test_kiosk_app_ui_check_missing.py"
        assert placeholder.exists(), \
            "no fail-closed placeholder for a surface with no runnable UI check"
        _py_compiles(placeholder)
        body = placeholder.read_text()
        assert "pytest.fail(" in body, \
            "placeholder must FAIL (not skip) so the gap is loud"
        assert "def test_kiosk_app_ui_check_not_implemented" in body, \
            "placeholder test function missing for kiosk-app"
        assert "NATIVE-CHECK-CONTRACT.md" in body, \
            "placeholder must point to the native-check contract"

        # --- The graphical surface is unaffected ---
        assert "def web_app_page(browser, surfaces):" in conftest, \
            "web-app page fixture missing"
        assert "def frontend_base_url(surfaces):" in conftest, \
            "frontend_base_url alias missing — web-app is still the only graphical surface"
        pyproject = (sandbox / "tests" / "pyproject.toml").read_text()
        assert "pexpect" not in pyproject, \
            "pexpect should be absent without a subprocess-cli surface"
    finally:
        shutil.rmtree(sandbox, ignore_errors=True)


def test_system_test_runner_app_harness_surface_generation():
    """A web + mobile (flutter-integration) + desktop (playwright-electron)
    registry generates the slug-keyed `surfaces` map for all three plus the
    two app-harness runner fixtures (H3/H7): each drives the app's OWN test
    suite as a subprocess through its Nx target, reusing the per-app
    tool/*_exec.sh toolchain guard, and skips with reason — never silently
    green."""
    import shutil
    sandbox = _make_runner_sandbox("app_harness_surfaces")
    specs = json.dumps([
        {"slug": "web-app", "medium": "playwright"},
        {"slug": "mobile-app", "medium": "flutter-integration"},
        {"slug": "desktop-app", "medium": "playwright-electron"},
    ])
    try:
        result = _scaffold_workspace(sandbox, "system-test-runner", surfaces=specs)
        assert result.returncode == 0, (
            f"system-test-runner generator failed for --surfaces (web+mobile+desktop)\n"
            f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        conftest = (sandbox / "tests" / "conftest.py").read_text()
        _py_compiles(sandbox / "tests" / "conftest.py")

        # --- All three surfaces registered in the spec map ---
        assert '"web-app": {"medium": "playwright", "reach": None}' in conftest, \
            "web-app spec missing from _SURFACE_SPECS"
        assert '"mobile-app": {"medium": "flutter-integration", "reach": None}' in conftest, \
            "mobile-app spec missing from _SURFACE_SPECS"
        assert '"desktop-app": {"medium": "playwright-electron", "reach": None}' in conftest, \
            "desktop-app spec missing from _SURFACE_SPECS"
        assert "def surfaces(services_manifest)" in conftest, \
            "slug-keyed surfaces fixture missing"

        # --- One runner fixture per app-harness surface, runner family naming ---
        assert "def mobile_app_runner(surfaces, services_manifest):" in conftest, \
            "flutter-integration runner fixture missing for mobile-app"

        # --- Device probe counts only platforms the app project supports ---
        # A host machine reports desktop/web "devices" (macOS, Chrome) that
        # `flutter test integration_test` cannot target for an android/ios
        # scaffold; counting them turns the intended skip into a hard failure
        # (proven live in the manual multi-surface sandbox).
        assert 'd.get("targetPlatform", "")' in conftest, \
            "flutter runner must filter devices by targetPlatform"
        assert '.startswith(("android", "ios"))' in conftest, \
            "flutter runner must only count android/ios devices"
        assert "no Android/iOS device or emulator available" in conftest, \
            "flutter runner skip reason must name the missing device class"
        assert "def desktop_app_runner(surfaces, services_manifest):" in conftest, \
            "playwright-electron runner fixture missing for desktop-app"

        # --- Reach resolves to the app's own Nx test target ---
        assert '"flutter-integration": "test-integration"' in conftest, \
            "flutter-integration -> test-integration target mapping missing"
        assert '"playwright-electron": "smoke"' in conftest, \
            "playwright-electron -> smoke target mapping missing"
        assert "npx nx run {slug}:{_HARNESS_MEDIUMS[spec['medium']]}" in conftest, \
            "harness reach discovery (npx nx run <slug>:<target>) missing"

        # --- The booted topology flows in: dart-define for Flutter, env for Electron ---
        assert "--dart-define=API_BASE_URL=" in conftest, \
            "flutter runner must forward the core's gateway URL via --dart-define"
        assert '"API_BASE_URL": api_base' in conftest, \
            "electron runner must pass the core's gateway URL via env"

        # --- Skip-with-reason, never silently green ---
        assert "never silently green" in conftest, \
            "verification-contract wording missing from harness runner docstrings"
        assert "not silently green" in conftest, \
            "flutter SDK/emulator skip reasons missing"
        assert "tier skipped" in conftest, \
            "toolchain-guard skip translation (tier skipped -> pytest.skip) missing"

        # --- Patrol is named as the escalation path, not wired ---
        assert "Patrol" in conftest, \
            "flutter runner docstring must name Patrol as the OS-boundary escalation path"

        # --- Web surface untouched; no CLI deps leak ---
        assert "def web_app_page(browser, surfaces):" in conftest, \
            "web-app page fixture missing"
        pyproject = (sandbox / "tests" / "pyproject.toml").read_text()
        assert "pytest-playwright" in pyproject, \
            "pytest-playwright missing despite a playwright surface"
        assert "pexpect" not in pyproject, \
            "pexpect should be absent without a subprocess-cli surface"
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

    # --- Surface board: graceful no-registry state, then retired-column rule ---
    surface_empty = subprocess.run(
        ["node", "dev", "surface", "status"], cwd=sb, capture_output=True, text=True, timeout=60
    )
    assert surface_empty.returncode == 0, f"./dev surface status failed\nSTDERR: {surface_empty.stderr}"
    assert "no surface registry" in (surface_empty.stdout + surface_empty.stderr).lower(), \
        "surface status without surfaces.json must say so and point at the activation skill"

    (sb / ".groundwork").mkdir(exist_ok=True)
    (sb / ".groundwork" / "surfaces.json").write_text(json.dumps({
        "schema": "groundwork.surfaces", "version": 1,
        "surfaces": [
            {"slug": "web-app", "type": "graphical-ui", "platform": "web", "status": "active",
             "scaffold": "nextjs-app", "testMedium": "playwright"},
            {"slug": "old-ui", "type": "graphical-ui", "platform": "desktop", "status": "retired",
             "scaffold": "manual", "testMedium": None},
        ],
        "capabilities": [
            {"key": "demo/thing", "name": "Demo", "cells": {
                "web-app": {"state": "planned", "ref": "demo"},
                "old-ui": {"state": "n/a"},
            }},
        ],
    }))
    surface_json = subprocess.run(
        ["node", "dev", "surface", "status", "--json"], cwd=sb, capture_output=True, text=True, timeout=60
    )
    assert surface_json.returncode == 0, f"./dev surface status --json failed\nSTDERR: {surface_json.stderr}"
    board = json.loads(surface_json.stdout)
    assert board["backlog"] == {"web-app": 1}, \
        f"retired surfaces must be excluded from backlog counts: {board['backlog']}"
    assert board["illegalCells"] == [], f"complete ledger flagged illegal cells: {board['illegalCells']}"


def test_workspace_dev_cli_rerun_preserves_compose_topology(workspace_dev_cli_bet_workspace):
    """Re-running workspace-dev-cli (e.g. to pick up a newer CLI bundle) must
    not reset docker-compose.yml to the base infra: service generators accrete
    their registrations into that file after the first run. Proven live in the
    manual multi-surface sandbox, where a re-run erased the api service and
    ./dev migrate silently migrated nothing."""
    sb = _WORKSPACE_DEV_CLI_SANDBOX
    compose_path = sb / "docker-compose.yml"
    if not compose_path.exists():
        first = _scaffold_workspace(sb, "workspace-dev-cli")
        assert first.returncode == 0, first.stderr
    accreted = compose_path.read_text() + (
        "  accreted-svc:\n"
        "    image: alpine:3.20\n"
        "    container_name: accreted-svc\n"
    )
    compose_path.write_text(accreted)

    rerun = _scaffold_workspace(sb, "workspace-dev-cli")
    assert rerun.returncode == 0, (
        f"workspace-dev-cli re-run failed\nSTDOUT: {rerun.stdout}\nSTDERR: {rerun.stderr}"
    )
    after = compose_path.read_text()
    assert "accreted-svc" in after, (
        "re-running workspace-dev-cli reset docker-compose.yml — service "
        "registrations accreted by other generators were erased"
    )


# ---------------------------------------------------------------------------
# Infrastructure is opt-in — db/jaeger are injected on demand, not seeded
# ---------------------------------------------------------------------------

_INFRA_SANDBOX = REPO_ROOT / ".sandboxes" / "scaffolds" / "infra-on-demand"


def _fresh_workspace_sandbox(sandbox: Path):
    import shutil
    if sandbox.exists():
        shutil.rmtree(sandbox)
    sandbox.mkdir(parents=True)
    (sandbox / "package.json").write_text('{"name": "infratest"}')
    (sandbox / "nx.json").write_text("{}")


def _scaffold_service_into(sandbox: Path, service_name: str, generator: str, **params) -> subprocess.CompletedProcess:
    """Run a service generator (with --name) into an arbitrary sandbox root."""
    cmd = ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:{generator}", "--name", service_name]
    for key, value in params.items():
        cmd.extend(["--" + key, str(value).lower() if isinstance(value, bool) else str(value)])
    return subprocess.run(cmd, cwd=sandbox, capture_output=True, text=True)


def test_base_compose_provisions_no_default_infrastructure():
    """A bare workspace provisions nothing: db and jaeger are no longer seeded
    into the base compose — they are injected on demand by the service generators
    that use them, exactly like redis/pubsub. A desktop / CLI / local-first
    workspace with no containerized service therefore gets no infrastructure, so
    `./dev start` never boots an empty stack. Also seeds an empty runner registry."""
    import shutil
    sb = _INFRA_SANDBOX
    _fresh_workspace_sandbox(sb)
    try:
        result = _scaffold_workspace(sb, "workspace-dev-cli")
        assert result.returncode == 0, result.stderr
        compose = (sb / "docker-compose.yml").read_text()
        # Match real service definitions (image lines), not the explanatory comment
        # that names db/jaeger to document the on-demand contract.
        assert "image: jaegertracing" not in compose, f"base compose must not seed jaeger:\n{compose}"
        assert "image: ankane/pgvector" not in compose, f"base compose must not seed a database:\n{compose}"
        assert "container_name:" not in compose, f"base compose must define no services:\n{compose}"
        config = json.loads((sb / ".dev" / "dev.config.json").read_text())
        assert config.get("runners") == [], \
            f"dev.config.json must seed an empty runner registry, got: {config.get('runners')!r}"
    finally:
        shutil.rmtree(sb, ignore_errors=True)


def test_go_microservice_injects_db_and_jaeger_on_demand():
    """A Go microservice uses a per-service database and exports telemetry, so it
    provisions db + jaeger into the shared compose on demand. The db container is
    named <prefix>-db so `./dev migrate` can find it."""
    import shutil
    sb = _INFRA_SANDBOX
    _fresh_workspace_sandbox(sb)
    try:
        assert _scaffold_workspace(sb, "workspace-dev-cli").returncode == 0
        go = _scaffold_service_into(sb, "api", "go-microservice")
        assert go.returncode == 0, f"go-microservice failed\nSTDOUT: {go.stdout}\nSTDERR: {go.stderr}"
        compose = (sb / "docker-compose.yml").read_text()
        assert "pgvector" in compose, f"go microservice must inject db (pgvector):\n{compose}"
        assert "jaeger" in compose, f"go microservice must inject jaeger:\n{compose}"
        assert "container_name: workspace-db" in compose, \
            f"db must be named <prefix>-db for ./dev migrate:\n{compose}"
    finally:
        shutil.rmtree(sb, ignore_errors=True)


def test_electron_app_registers_autostart_surface_runner():
    """An Electron app is a managed unit: it registers as an autostart surface
    runner in dev.config.json so `./dev start` launches it and `./dev status`
    reports it — while still never joining docker-compose."""
    import shutil
    sb = _INFRA_SANDBOX
    _fresh_workspace_sandbox(sb)
    try:
        assert _scaffold_workspace(sb, "workspace-dev-cli").returncode == 0
        r = _scaffold_service_into(sb, "desktop-app", "electron-app")
        assert r.returncode == 0, f"electron-app failed\nSTDERR: {r.stderr}"
        config = json.loads((sb / ".dev" / "dev.config.json").read_text())
        runners = {x["name"]: x for x in config.get("runners", [])}
        assert "desktop-app" in runners, f"electron app must register a runner: {config.get('runners')}"
        run = runners["desktop-app"]
        assert run["kind"] == "surface", f"electron runner kind: {run}"
        assert run.get("autostart") is True, f"electron runner must autostart: {run}"
        compose = (sb / "docker-compose.yml").read_text()
        assert "desktop-app" not in compose, "electron app must not join docker-compose"
    finally:
        shutil.rmtree(sb, ignore_errors=True)


def test_python_native_registers_sidecar_runner_and_no_compose_service():
    """--native runs the service as a host process (e.g. needs Metal/MPS): it
    registers a sidecar runner and adds NO compose service for itself."""
    import shutil
    sb = _INFRA_SANDBOX
    _fresh_workspace_sandbox(sb)
    try:
        assert _scaffold_workspace(sb, "workspace-dev-cli").returncode == 0
        r = _scaffold_service_into(sb, "compute-service", "python-microservice", native=True, rest=False)
        assert r.returncode == 0, f"python-microservice --native failed\nSTDERR: {r.stderr}"
        config = json.loads((sb / ".dev" / "dev.config.json").read_text())
        runners = {x["name"]: x for x in config.get("runners", [])}
        assert "compute-service" in runners, f"native python must register a sidecar runner: {config.get('runners')}"
        run = runners["compute-service"]
        assert run["kind"] == "sidecar", f"native python runner kind: {run}"
        assert "uv run" in run["cmd"], f"native python runner cmd: {run}"
        compose = (sb / "docker-compose.yml").read_text()
        assert "container_name: compute-service" not in compose, \
            "native python sidecar must not define a compose service for itself"
    finally:
        shutil.rmtree(sb, ignore_errors=True)


def test_docs_site_registers_surface_runner_and_no_compose_service():
    """The docs site is a native runner, not a docker-compose service: it compiles
    the repo-root docs/ tree, which is outside any per-service Docker build context.
    It registers a non-autostart surface runner (`pnpm dev`) so `./dev` status/logs
    manage it, and never joins compose."""
    import shutil
    sb = _INFRA_SANDBOX
    _fresh_workspace_sandbox(sb)
    try:
        assert _scaffold_workspace(sb, "workspace-dev-cli").returncode == 0
        r = _scaffold_service_into(sb, "docs", "docs-site")
        assert r.returncode == 0, f"docs-site failed\nSTDERR: {r.stderr}"
        config = json.loads((sb / ".dev" / "dev.config.json").read_text())
        runners = {x["name"]: x for x in config.get("runners", [])}
        assert "docs" in runners, f"docs site must register a runner: {config.get('runners')}"
        run = runners["docs"]
        assert run["kind"] == "surface", f"docs runner kind: {run}"
        assert run["cmd"] == "pnpm dev", f"docs runner cmd: {run}"
        assert run.get("autostart") is False, f"docs runner must not autostart: {run}"
        compose_path = sb / "docker-compose.yml"
        if compose_path.exists():
            assert "docs" not in compose_path.read_text(), "docs site must not join docker-compose"
    finally:
        shutil.rmtree(sb, ignore_errors=True)


# ---------------------------------------------------------------------------
# Composable capability ports & providers (plan WS-F)
# ---------------------------------------------------------------------------

_CAP_SANDBOX = REPO_ROOT / ".sandboxes" / "scaffolds" / "capabilities"


def test_python_llm_none_ships_raw_gateway_as_a_bet():
    """`--llm --llmProvider=none` is the bare port: the TextGenerator port, a
    not-yet-implemented stub adapter, and a strict-xfail contract test — a bet,
    not an implementation. No provider SDK is added and no LLM env is written.
    The port lives in its own module (core/llm.py), not ports.py, so the
    standalone add-capability generator can reuse it."""
    import shutil
    sb = _CAP_SANDBOX
    _fresh_workspace_sandbox(sb)
    try:
        r = _scaffold_service_into(sb, "ai", "python-microservice",
                                   llm=True, llmProvider="none", rest=False, postgres=False)
        assert r.returncode == 0, f"python --llm none failed\nSTDERR: {r.stderr}"
        svc = sb / "services" / "ai"
        pkg = "ai"
        port = (svc / "src" / pkg / "core" / "llm.py").read_text()
        assert "class TextGenerator" in port, "the TextGenerator port must be generated"
        adapter = (svc / "src" / pkg / "adapters" / "llm.py").read_text()
        assert "NotImplementedError" in adapter, "none provider must ship a stub adapter (the bet)"
        test = (svc / "tests" / "contracts" / "test_llm.py").read_text()
        assert "xfail" in test and "issubclass" in test, "none must ship a strict-xfail contract test"
        pyproject = (svc / "pyproject.toml").read_text()
        assert "anthropic" not in pyproject and "openai" not in pyproject, \
            f"bare port must add no provider SDK:\n{pyproject}"
        ports = (svc / "src" / pkg / "core" / "ports.py").read_text()
        assert "class TextGenerator" not in ports, "the LLM port must live in core/llm.py, not ports.py"
        env = (svc / ".env.example").read_text()
        assert "LLM_API_KEY" not in env, f"none footprint writes no LLM env:\n{env}"
    finally:
        shutil.rmtree(sb, ignore_errors=True)


def test_python_llm_anthropic_provider_footprint():
    """A real provider selects its adapter and materializes its footprint: the
    Anthropic SDK dependency in pyproject and the LLM env (key + claude model) in
    .env.example. Swapping the provider swaps only the adapter — the port and its
    callers are untouched. The contract test is a plain conformance check (no
    xfail — the adapter is implemented)."""
    import shutil
    sb = _CAP_SANDBOX
    _fresh_workspace_sandbox(sb)
    try:
        r = _scaffold_service_into(sb, "ai", "python-microservice",
                                   llm=True, llmProvider="anthropic", rest=False, postgres=False)
        assert r.returncode == 0, f"python --llm anthropic failed\nSTDERR: {r.stderr}"
        svc = sb / "services" / "ai"
        pkg = "ai"
        adapter = (svc / "src" / pkg / "adapters" / "llm.py").read_text()
        assert "import anthropic" in adapter, "anthropic provider must ship the anthropic adapter"
        pyproject = (svc / "pyproject.toml").read_text()
        # Parse the TOML so a malformed injection (e.g. splicing inside another
        # dependency spec) is caught — a substring check alone would not see it.
        import tomllib
        deps = tomllib.loads(pyproject)["project"]["dependencies"]
        assert any(d.startswith("anthropic>=") for d in deps), \
            f"anthropic footprint must inject the SDK dep as a valid entry:\n{deps}"
        assert all(d.startswith("uvicorn[standard]") is False or "]>=" in d for d in deps if "uvicorn" in d), \
            f"existing deps must remain intact (no corruption):\n{deps}"
        env = (svc / ".env.example").read_text()
        assert "LLM_API_KEY=" in env and "claude" in env, f"env footprint must document the key + model:\n{env}"
        test = (svc / "tests" / "contracts" / "test_llm.py").read_text()
        assert "xfail" not in test, "an implemented provider's contract test must not be xfail"
        assert (svc / "src" / pkg / "core" / "llm.py").exists(), "the port is always generated"
    finally:
        shutil.rmtree(sb, ignore_errors=True)


def test_add_capability_generator_adds_raw_gateway_to_existing_service():
    """The standalone add-capability generator is the Day-2 / bet entry point: it
    bolts a capability port + provider onto a service that was scaffolded without
    it, through the same injector the service generators use."""
    import shutil
    sb = _CAP_SANDBOX
    _fresh_workspace_sandbox(sb)
    try:
        base = _scaffold_service_into(sb, "ai", "python-microservice",
                                      llm=False, rest=False, postgres=False)
        assert base.returncode == 0, f"base python service failed\nSTDERR: {base.stderr}"
        svc = sb / "services" / "ai"
        pkg = "ai"
        assert not (svc / "src" / pkg / "core" / "llm.py").exists(), \
            "precondition: the base service has no LLM port"
        cmd = ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:add-capability",
               "--service", "ai", "--capability", "llm", "--provider", "none"]
        add = subprocess.run(cmd, cwd=sb, capture_output=True, text=True)
        assert add.returncode == 0, f"add-capability failed\nSTDOUT: {add.stdout}\nSTDERR: {add.stderr}"
        assert (svc / "src" / pkg / "core" / "llm.py").exists(), "add-capability must generate the port"
        adapter = (svc / "src" / pkg / "adapters" / "llm.py").read_text()
        assert "NotImplementedError" in adapter, "add-capability none must ship the stub"
        assert (svc / "tests" / "contracts" / "test_llm.py").exists(), "add-capability must ship the contract test"
    finally:
        shutil.rmtree(sb, ignore_errors=True)


def test_go_add_capability_llm_none_raw_gateway():
    """The capability layer is general across stacks: add-capability bolts the LLM
    interface onto a Go service too. `none` ships the service.TextGenerator
    interface, a stub adapter that returns an error, and a contract test that Skips
    while the bet is open. Go adapters use net/http (no SDK), so go.mod gains no
    dependency."""
    import shutil
    sb = _CAP_SANDBOX
    _fresh_workspace_sandbox(sb)
    try:
        assert _scaffold_workspace(sb, "workspace-dev-cli").returncode == 0
        go = _scaffold_service_into(sb, "api", "go-microservice")
        assert go.returncode == 0, f"go-microservice failed\nSTDERR: {go.stderr}"
        cmd = ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:add-capability",
               "--service", "api", "--capability", "llm", "--provider", "none"]
        add = subprocess.run(cmd, cwd=sb, capture_output=True, text=True)
        assert add.returncode == 0, f"add-capability (go) failed\nSTDOUT: {add.stdout}\nSTDERR: {add.stderr}"
        svc = sb / "services" / "api"
        port = (svc / "internal" / "core" / "service" / "llm.go").read_text()
        assert "TextGenerator interface" in port, "the Go service.TextGenerator interface must be generated"
        adapter = (svc / "internal" / "llm" / "llm.go").read_text()
        assert "not implemented" in adapter, "none provider must ship a stub that errors (the bet)"
        assert "api/internal/core/service" in adapter, "adapter must import the interface via the module path from go.mod"
        test = (svc / "internal" / "llm" / "llm_test.go").read_text()
        assert "var _ service.TextGenerator = (*Client)(nil)" in test, "compile-time interface conformance assertion"
        assert "Skip" in test, "none must ship the strict bet test (Skip while unimplemented)"
        gomod = (svc / "go.mod").read_text()
        assert "anthropic" not in gomod and "openai" not in gomod, \
            f"net/http Go adapter must add no module dependency:\n{gomod}"
    finally:
        shutil.rmtree(sb, ignore_errors=True)


def test_go_add_capability_llm_anthropic_http_adapter():
    """A real Go provider ships a net/http adapter against the vendor API and
    records its env footprint, with no go.mod dependency and the port untouched."""
    import shutil
    sb = _CAP_SANDBOX
    _fresh_workspace_sandbox(sb)
    try:
        assert _scaffold_workspace(sb, "workspace-dev-cli").returncode == 0
        assert _scaffold_service_into(sb, "api", "go-microservice").returncode == 0
        cmd = ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:add-capability",
               "--service", "api", "--capability", "llm", "--provider", "anthropic"]
        add = subprocess.run(cmd, cwd=sb, capture_output=True, text=True)
        assert add.returncode == 0, f"add-capability (go anthropic) failed\nSTDOUT: {add.stdout}\nSTDERR: {add.stderr}"
        svc = sb / "services" / "api"
        adapter = (svc / "internal" / "llm" / "llm.go").read_text()
        assert "api.anthropic.com" in adapter and "anthropic-version" in adapter, \
            "anthropic Go adapter must call the Messages API"
        assert 'var _ service.TextGenerator = (*Client)(nil)' in adapter, "adapter must assert interface conformance"
        env = (svc / ".env").read_text()
        assert "LLM_API_KEY=" in env and "claude" in env, f"env footprint must land in .env:\n{env}"
        gomod = (svc / "go.mod").read_text()
        assert "anthropic" not in gomod, f"net/http adapter must not add an SDK dependency:\n{gomod}"
    finally:
        shutil.rmtree(sb, ignore_errors=True)


def test_add_capability_llm_ollama_registers_runner_footprint():
    """The footprint matrix, runner arm: a `runner`-footprint provider materializes
    as a native process, not a container. Selecting `ollama` registers an
    `ollama serve` runner in .dev/dev.config.json so `./dev start` brings it up;
    no compose service is injected. The port and adapter are the same
    OpenAI-compatible shape as every other LLM provider — only the footprint
    differs, which is the whole thesis: infrastructure is a consequence of the
    provider choice, not a default."""
    import shutil, json
    sb = _CAP_SANDBOX
    _fresh_workspace_sandbox(sb)
    try:
        assert _scaffold_workspace(sb, "workspace-dev-cli").returncode == 0
        assert _scaffold_service_into(sb, "ai", "python-microservice",
                                      llm=False, rest=False, postgres=False).returncode == 0
        cmd = ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:add-capability",
               "--service", "ai", "--capability", "llm", "--provider", "ollama"]
        add = subprocess.run(cmd, cwd=sb, capture_output=True, text=True)
        assert add.returncode == 0, f"add-capability ollama failed\nSTDOUT: {add.stdout}\nSTDERR: {add.stderr}"
        svc = sb / "services" / "ai"
        pkg = "ai"
        adapter = (svc / "src" / pkg / "adapters" / "llm.py").read_text()
        assert "openai" in adapter, "ollama uses the OpenAI-compatible adapter"
        config = json.loads((sb / ".dev" / "dev.config.json").read_text())
        runners = {r["name"]: r for r in config.get("runners", [])}
        assert "ollama" in runners, f"runner footprint must register a runner:\n{config}"
        assert runners["ollama"]["cmd"] == "ollama serve", \
            f"the ollama runner must launch the server: {runners['ollama']}"
        compose = (sb / "docker-compose.yml").read_text()
        assert "ollama" not in compose, f"a runner footprint must inject no compose service:\n{compose}"
        env = (svc / ".env.example").read_text()
        assert "LLM_BASE_URL=" in env, f"runner footprint still documents its env:\n{env}"
    finally:
        shutil.rmtree(sb, ignore_errors=True)


def test_add_capability_llm_localai_injects_compose_service_footprint():
    """The footprint matrix, compose arm: a `compose-service`-footprint provider
    materializes as a container in the workspace docker-compose — the
    capability-driven generalisation of WS-A's on-demand db/jaeger injection.
    Selecting `localai` injects the model-server service and its named volume; the
    adapter is the same OpenAI-compatible client pointed at it. No runner is
    registered. Generation re-serializes the whole compose via the YAML document,
    so a returncode of 0 plus these markers proves the file stayed well-formed."""
    import shutil, json
    sb = _CAP_SANDBOX
    _fresh_workspace_sandbox(sb)
    try:
        assert _scaffold_workspace(sb, "workspace-dev-cli").returncode == 0
        assert _scaffold_service_into(sb, "ai", "python-microservice",
                                      llm=False, rest=False, postgres=False).returncode == 0
        cmd = ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:add-capability",
               "--service", "ai", "--capability", "llm", "--provider", "localai"]
        add = subprocess.run(cmd, cwd=sb, capture_output=True, text=True)
        assert add.returncode == 0, f"add-capability localai failed\nSTDOUT: {add.stdout}\nSTDERR: {add.stderr}"
        compose = (sb / "docker-compose.yml").read_text()
        assert "localai:" in compose, f"compose footprint must inject the service:\n{compose}"
        assert "localai/localai" in compose, f"compose footprint must set the model-server image:\n{compose}"
        assert "localai_models" in compose, f"compose footprint must declare its named volume:\n{compose}"
        config = json.loads((sb / ".dev" / "dev.config.json").read_text())
        assert config.get("runners", []) == [], \
            f"a compose footprint must register no runner:\n{config}"
        svc = sb / "services" / "ai"
        pkg = "ai"
        adapter = (svc / "src" / pkg / "adapters" / "llm.py").read_text()
        assert "openai" in adapter, "localai uses the OpenAI-compatible adapter"
    finally:
        shutil.rmtree(sb, ignore_errors=True)


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


def _typecheck_cli_app(proj):
    """Type-check the generated project with the repo's TypeScript (no install)."""
    tsc = REPO_ROOT / "node_modules" / ".bin" / "tsc"
    tc = subprocess.run(
        [str(tsc), "--noEmit", "-p", str(proj / "tsconfig.json")],
        cwd=REPO_ROOT, capture_output=True, text=True, timeout=120,
    )
    assert tc.returncode == 0, f"generated cli-app does not type-check\nSTDOUT: {tc.stdout}\nSTDERR: {tc.stderr}"


def _run_generated_unit_tests(proj):
    """Run the scaffold's own `npm test` path without an install: compile the
    test build (tsconfig.test.json -> dist-test/) with the repo's TypeScript
    standing in for the project devDep, then execute the node:test suite."""
    tsc = REPO_ROOT / "node_modules" / ".bin" / "tsc"
    emit = subprocess.run(
        [str(tsc), "-p", str(proj / "tsconfig.test.json")],
        cwd=REPO_ROOT, capture_output=True, text=True, timeout=180,
    )
    assert emit.returncode == 0, f"cli-app test build failed\nSTDOUT: {emit.stdout}\nSTDERR: {emit.stderr}"
    run = subprocess.run(
        ["node", "--test", "dist-test/**/*.test.js"],
        cwd=proj, capture_output=True, text=True, timeout=120,
    )
    assert run.returncode == 0, (
        f"generated node:test suite failed\nSTDOUT: {run.stdout}\nSTDERR: {run.stderr}"
    )
    return run.stdout


def test_cli_app_generation(cli_app_workspace):
    """cli-app scaffolds a branded TypeScript CLI product themed from brand-tokens.json,
    including the shared theme layer and (with --repl) the interactive layer; the
    generated TypeScript type-checks and its node:test suite passes. Without --core
    the scaffold is standalone: no core-access seam, no status command."""
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
        "package.json", "tsconfig.json", "tsconfig.test.json", "build.mjs", "README.md",
        "src/cli.ts", "src/registry.ts", "src/registry.test.ts",
        "src/commands/hello.ts", "src/brand.json",
        "src/theme/tokens.ts", "src/theme/color.ts", "src/theme/render.ts",
        "src/commands/repl.ts", "src/util/prompt.ts",  # --repl layer
    ]:
        assert (proj / rel).exists(), f"cli-app missing {rel}"

    # --- Standalone: the core-access seam must NOT be generated ---
    for rel in ["src/core/client.ts", "src/core/client.test.ts", "src/commands/status.ts"]:
        assert not (proj / rel).exists(), f"standalone cli-app must not ship {rel}"
    registry = (proj / "src" / "registry.ts").read_text()
    assert "'status'" not in registry, "standalone cli-app must not register a status command"

    # --- Brand projected from tokens ---
    brand = json.loads((proj / "src" / "brand.json").read_text())
    assert brand["identity"]["appName"] == "Demo", "brand.json appName not projected from tokens"
    assert brand["identity"]["primary"] == "#a855f7", "brand.json primary not projected from tokens"
    assert "terminal" in brand, "Tier-2 terminal block not projected"

    # --- REPL registered ---
    assert "repl" in registry, "repl not registered for --repl"

    # --- Test harness wired into the scaffold's own DX ---
    pkg = json.loads((proj / "package.json").read_text())
    assert "node --test" in pkg["scripts"].get("test", ""), "npm test must run the node:test suite"

    # --- Generated TypeScript type-checks and its unit tests pass ---
    _typecheck_cli_app(proj)
    _run_generated_unit_tests(proj)


def test_cli_app_core_generation(cli_app_workspace):
    """--core wires the CLI as a frontend for workspace services: the core-access
    seam (src/core/client.ts) reads API_BASE_URL, probes /health (Go/Python cores;
    a Next.js BFF would be /api/healthz), carries the Bearer auth seam, and the
    `status` command is the wiring proof with exit-code discipline (0 reachable,
    1 not). The seam's unit tests run, and the compiled CLI is executed for real
    against a stub gateway — reachable and unreachable both behave."""
    sb = _CLI_APP_SANDBOX
    cmd = [
        "npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:cli-app",
        "--name", "Demo CLI", "--core=true",
    ]
    result = subprocess.run(cmd, cwd=sb, capture_output=True, text=True)
    assert result.returncode == 0, (
        f"cli-app generator failed\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
    )

    proj = sb / "services" / "demo-cli"
    # --- Structural: the core layer rides on top of the spine ---
    for rel in [
        "src/core/client.ts", "src/core/client.test.ts", "src/commands/status.ts",
        "src/registry.test.ts", "tsconfig.test.json",
    ]:
        assert (proj / rel).exists(), f"cli-app --core missing {rel}"

    # --- The seam's contract (mirrors the electron core-client assertions) ---
    client = (proj / "src" / "core" / "client.ts").read_text()
    assert "API_BASE_URL" in client, "core base URL must come from API_BASE_URL"
    assert "'/health'" in client, "wiring proof must probe the core's /health route"
    assert "Bearer" in client, "auth seam (Bearer header) missing"
    registry = (proj / "src" / "registry.ts").read_text()
    assert "'status'" in registry, "status wiring-proof command not registered for --core"
    readme = (proj / "README.md").read_text()
    assert "API_BASE_URL" in readme, "README must document the core gateway override"

    # --- Type-checks; the seam's unit tests pass without a network ---
    _typecheck_cli_app(proj)
    _run_generated_unit_tests(proj)

    # --- Execute the compiled CLI end-to-end (the test build emits a runnable
    #     CJS tree, so no npm install is needed) ---
    cli = proj / "dist-test" / "cli.js"
    assert cli.exists(), "test build should emit a runnable cli.js"

    hello = subprocess.run(
        ["node", str(cli), "hello", "--json"],
        cwd=proj, capture_output=True, text=True, timeout=30,
    )
    assert hello.returncode == 0, f"hello --json failed\nSTDERR: {hello.stderr}"
    assert json.loads(hello.stdout) == {"greeting": "Hello, world!"}

    import threading
    from http.server import BaseHTTPRequestHandler, HTTPServer

    class _StubGateway(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/health":
                body = b'{"status": "ok"}'
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_response(404)
                self.end_headers()

        def log_message(self, *_args):  # keep pytest output clean
            pass

    server = HTTPServer(("127.0.0.1", 0), _StubGateway)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        base = f"http://127.0.0.1:{server.server_port}"
        up = subprocess.run(
            ["node", str(cli), "status", "--json"],
            cwd=proj, capture_output=True, text=True, timeout=30,
            env={**os.environ, "API_BASE_URL": base},
        )
        assert up.returncode == 0, (
            f"status must exit 0 against a healthy core\nSTDOUT: {up.stdout}\nSTDERR: {up.stderr}"
        )
        assert json.loads(up.stdout) == {"baseUrl": base, "reachable": True, "status": "ok"}
    finally:
        server.shutdown()
        thread.join(timeout=5)

    down = subprocess.run(
        ["node", str(cli), "status", "--json"],
        cwd=proj, capture_output=True, text=True, timeout=30,
        env={**os.environ, "API_BASE_URL": "http://127.0.0.1:1"},
    )
    assert down.returncode == 1, "status must exit 1 against an unreachable core"
    payload = json.loads(down.stdout)
    assert payload["reachable"] is False, "unreachable core must map to a value, not a crash"
