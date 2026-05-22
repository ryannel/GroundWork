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
