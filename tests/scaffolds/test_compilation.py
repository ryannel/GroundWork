"""
Layer 2 — Compilation Tests (Pairwise Coverage)

For each generator, uses pairwise (all-pairs) testing to reduce the full combination
space to a set of test cases where every pair of parameter values appears together
at least once. This catches interaction bugs between two parameters without running
every full combination through the compiler.

Go:       18 combinations → ~9 pairwise cases  (go build ./...)
Python:  128 combinations → ~16 pairwise cases (uv sync + python -c import)
Next.js:   8 combinations → ~4 pairwise cases  (pnpm tsc --noEmit)
Docs Site: 1 combination  →  1 case           (pnpm tsc --noEmit)

Sandbox note: the sandbox lives under REPO_ROOT so Nx can walk up and find node_modules.
"""

import subprocess
import shutil
import re
import pytest
from pathlib import Path
from allpairspy import AllPairs

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
GENERATORS_JSON = REPO_ROOT / "generators.json"
SANDBOX_DIR = REPO_ROOT / ".sandboxes" / "scaffolds" / "compilation"


@pytest.fixture(scope="session", autouse=True)
def compilation_workspace():
    """Create the shared compilation sandbox once per session."""
    if SANDBOX_DIR.exists():
        shutil.rmtree(SANDBOX_DIR)
    SANDBOX_DIR.mkdir(parents=True)
    (SANDBOX_DIR / "package.json").write_text('{"name": "comptest"}')
    (SANDBOX_DIR / "nx.json").write_text("{}")
    yield


def _safe_name(label: str) -> str:
    return re.sub(r"[^a-z0-9]", "-", label.lower())[:40]


def _scaffold(service_name: str, generator: str, **params) -> subprocess.CompletedProcess:
    cmd = ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:{generator}", "--name", service_name]
    for key, value in params.items():
        cli_key = "--" + key
        cmd.extend([cli_key, str(value).lower() if isinstance(value, bool) else str(value)])
    return subprocess.run(cmd, cwd=SANDBOX_DIR, capture_output=True, text=True)


def _cleanup(service_name: str):
    svc = SANDBOX_DIR / "services" / service_name
    if svc.exists():
        shutil.rmtree(svc)


def _pairwise_params(parameter_lists):
    """Return list of test vectors from AllPairs pairwise matrix."""
    pairs = AllPairs(parameter_lists)
    return list(pairs)  # each row is already a list of parameter values


# ---------------------------------------------------------------------------
# Go Microservice — pairwise
# ---------------------------------------------------------------------------

_GO_PARAMS = [
    ["none", "service", "clerk"],   # auth
    ["none", "kafka", "gcp-pubsub"],  # messaging
    [True, False],                  # websockets
]

_GO_PAIRWISE = _pairwise_params(_GO_PARAMS)
_GO_IDS = [f"auth={r[0]},msg={r[1]},ws={r[2]}" for r in _GO_PAIRWISE]


@pytest.mark.parametrize("params", _GO_PAIRWISE, ids=_GO_IDS)
def test_go_microservice_compiles(params):
    auth, messaging, websockets = params
    svc_name = _safe_name(f"go-c-auth-{auth}-msg-{messaging}-ws-{websockets}")
    _cleanup(svc_name)
    try:
        result = _scaffold(svc_name, "go-microservice",
                           auth=auth, messaging=messaging, websockets=websockets)
        assert result.returncode == 0, (
            f"Generator failed\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        svc_dir = SANDBOX_DIR / "services" / svc_name
        build = subprocess.run(
            ["go", "build", "./..."],
            cwd=svc_dir,
            capture_output=True,
            text=True,
        )
        assert build.returncode == 0, (
            f"go build failed for auth={auth}, messaging={messaging}, websockets={websockets}\n"
            f"STDOUT: {build.stdout}\nSTDERR: {build.stderr}"
        )
    finally:
        _cleanup(svc_name)


# ---------------------------------------------------------------------------
# Python Microservice — pairwise
# ---------------------------------------------------------------------------

_PY_PARAMS = [
    [True, False],                          # rest
    [True, False],                          # postgres
    ["none", "redis", "kafka", "gcp-pubsub"],  # messaging
    [True, False],                          # websockets
    [True, False],                          # llm
    [True, False],                          # runpod
]

_PY_PAIRWISE = _pairwise_params(_PY_PARAMS)
_PY_IDS = [
    f"rest={r[0]},pg={r[1]},msg={r[2]},ws={r[3]},llm={r[4]},rp={r[5]}"
    for r in _PY_PAIRWISE
]


@pytest.mark.parametrize("params", _PY_PAIRWISE, ids=_PY_IDS)
def test_python_microservice_compiles(params):
    rest, postgres, messaging, websockets, llm, runpod = params
    svc_name = _safe_name(
        f"py-c-r{int(rest)}-pg{int(postgres)}-{messaging}-ws{int(websockets)}-l{int(llm)}-rp{int(runpod)}"
    )
    _cleanup(svc_name)
    try:
        result = _scaffold(svc_name, "python-microservice",
                           rest=rest, postgres=postgres, messaging=messaging,
                           websockets=websockets, llm=llm, runpod=runpod)
        assert result.returncode == 0, (
            f"Generator failed\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        svc_dir = SANDBOX_DIR / "services" / svc_name

        sync = subprocess.run(
            ["uv", "sync"],
            cwd=svc_dir,
            capture_output=True,
            text=True,
        )
        assert sync.returncode == 0, (
            f"uv sync failed\nSTDOUT: {sync.stdout}\nSTDERR: {sync.stderr}"
        )

        check = subprocess.run(
            ["uv", "run", "python", "-c", f"import {svc_name.replace('-', '_')}.main"],
            cwd=svc_dir,
            capture_output=True,
            text=True,
        )
        assert check.returncode == 0, (
            f"Python import check failed for rest={rest}, postgres={postgres}, "
            f"messaging={messaging}, websockets={websockets}, llm={llm}, runpod={runpod}\n"
            f"STDOUT: {check.stdout}\nSTDERR: {check.stderr}"
        )
    finally:
        _cleanup(svc_name)


# The pairwise matrix above always runs the default (openai) provider. Add one
# anthropic case so the Anthropic SDK dependency resolves and the generated
# gateway imports cleanly — the openai path is already covered by the matrix.
def test_python_microservice_anthropic_provider_compiles():
    svc_name = _safe_name("py-c-llm-anthropic")
    _cleanup(svc_name)
    try:
        result = _scaffold(svc_name, "python-microservice",
                           rest=True, postgres=False, messaging="none",
                           websockets=False, llm=True, runpod=False,
                           llmProvider="anthropic")
        assert result.returncode == 0, (
            f"Generator failed\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        svc_dir = SANDBOX_DIR / "services" / svc_name

        sync = subprocess.run(
            ["uv", "sync"],
            cwd=svc_dir,
            capture_output=True,
            text=True,
        )
        assert sync.returncode == 0, (
            f"uv sync failed\nSTDOUT: {sync.stdout}\nSTDERR: {sync.stderr}"
        )

        check = subprocess.run(
            ["uv", "run", "python", "-c", f"import {svc_name.replace('-', '_')}.main"],
            cwd=svc_dir,
            capture_output=True,
            text=True,
        )
        assert check.returncode == 0, (
            f"Python import check failed for llmProvider=anthropic\n"
            f"STDOUT: {check.stdout}\nSTDERR: {check.stderr}"
        )
    finally:
        _cleanup(svc_name)


# ---------------------------------------------------------------------------
# Next.js App — pairwise
# ---------------------------------------------------------------------------

_NEXT_PARAMS = [
    ["none", "clerk"],  # auth
    [True, False],      # apiProxy
    [True, False],      # websockets
]

_NEXT_PAIRWISE = _pairwise_params(_NEXT_PARAMS)
_NEXT_IDS = [f"auth={r[0]},proxy={r[1]},ws={r[2]}" for r in _NEXT_PAIRWISE]


@pytest.mark.parametrize("params", _NEXT_PAIRWISE, ids=_NEXT_IDS)
def test_nextjs_app_compiles(params):
    auth, apiProxy, websockets = params
    svc_name = _safe_name(f"next-c-auth-{auth}-proxy-{apiProxy}-ws-{websockets}")
    _cleanup(svc_name)
    try:
        result = _scaffold(svc_name, "nextjs-app",
                           auth=auth, apiProxy=apiProxy, websockets=websockets)
        assert result.returncode == 0, (
            f"Generator failed\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        svc_dir = SANDBOX_DIR / "services" / svc_name

        install = subprocess.run(
            ["pnpm", "install", "--frozen-lockfile", "--ignore-scripts"],
            cwd=svc_dir,
            capture_output=True,
            text=True,
        )
        assert install.returncode == 0, (
            f"pnpm install failed\nSTDOUT: {install.stdout}\nSTDERR: {install.stderr}"
        )

        tsc = subprocess.run(
            ["pnpm", "tsc", "--noEmit"],
            cwd=svc_dir,
            capture_output=True,
            text=True,
        )
        assert tsc.returncode == 0, (
            f"TypeScript check failed for auth={auth}, apiProxy={apiProxy}, websockets={websockets}\n"
            f"STDOUT: {tsc.stdout}\nSTDERR: {tsc.stderr}"
        )
    finally:
        _cleanup(svc_name)


# ---------------------------------------------------------------------------
# Docs Site — single case (no options)
# ---------------------------------------------------------------------------


def test_docs_site_compiles():
    """The docs site type-checks. `@/.source` is a fumadocs-mdx artifact, generated
    here by running `fumadocs-mdx` explicitly (the package's `postinstall`) before
    tsc — install with --ignore-scripts so pnpm's dependency-build gating doesn't
    fail the install, then generate the source map by hand. The docs dir the site
    reads (../../docs) is seeded so type generation has a collection to map."""
    svc_name = "docs-site-comp-test"
    _cleanup(svc_name)
    docs_dir = SANDBOX_DIR / "docs"
    try:
        # The site compiles ../../docs at type-gen time; seed a minimal tree.
        docs_dir.mkdir(parents=True, exist_ok=True)
        (docs_dir / "index.md").write_text("# Welcome\n\nDocs home.\n")

        result = _scaffold(svc_name, "docs-site")
        assert result.returncode == 0, (
            f"Generator failed\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        svc_dir = SANDBOX_DIR / "services" / svc_name

        install = subprocess.run(
            ["pnpm", "install", "--ignore-scripts"],
            cwd=svc_dir,
            capture_output=True,
            text=True,
        )
        assert install.returncode == 0, (
            f"pnpm install failed\nSTDOUT: {install.stdout}\nSTDERR: {install.stderr}"
        )

        # Generate `.source` (the fumadocs-mdx type map) — normally the postinstall,
        # skipped above by --ignore-scripts.
        gen = subprocess.run(
            ["pnpm", "exec", "fumadocs-mdx"],
            cwd=svc_dir,
            capture_output=True,
            text=True,
        )
        assert gen.returncode == 0, (
            f"fumadocs-mdx type generation failed\nSTDOUT: {gen.stdout}\nSTDERR: {gen.stderr}"
        )

        tsc = subprocess.run(
            ["pnpm", "exec", "tsc", "--noEmit"],
            cwd=svc_dir,
            capture_output=True,
            text=True,
        )
        assert tsc.returncode == 0, (
            f"TypeScript check failed\nSTDOUT: {tsc.stdout}\nSTDERR: {tsc.stderr}"
        )
    finally:
        _cleanup(svc_name)
        shutil.rmtree(docs_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# System Test Runner — uv sync resolves with new deps (no playwright install)
# ---------------------------------------------------------------------------
# Tests two variants: graphical-ui (adds pytest-playwright) and cli (no browser dep).
# Both must resolve without running `playwright install` — browser binaries install
# on demand at ./dev test bet <slug> --integration time, never during uv sync.

_SYSTEM_TEST_RUNNER_COMP_SANDBOX = REPO_ROOT / ".sandboxes" / "scaffolds" / "system-test-runner-comp"


def _scaffold_workspace_comp(sandbox: Path, generator: str, **params) -> subprocess.CompletedProcess:
    cmd = ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:{generator}"]
    for key, value in params.items():
        cli_key = "--" + key
        cmd.extend([cli_key, str(value).lower() if isinstance(value, bool) else str(value)])
    return subprocess.run(cmd, cwd=sandbox, capture_output=True, text=True)


@pytest.mark.parametrize("medium", ["graphical-ui", "cli"], ids=["graphical-ui", "cli"])
def test_system_test_runner_deps_resolve(medium):
    """Verify the generated tests/pyproject.toml has valid TOML and the correct
    dependency set for the given interfaceMedium. Structural check that confirms
    the template renders correctly without running uv sync (which would inherit
    the parent test runner's virtual environment and fight it).
    """
    import tomllib
    sandbox = _SYSTEM_TEST_RUNNER_COMP_SANDBOX / medium.replace("-", "_")
    if sandbox.exists():
        shutil.rmtree(sandbox)
    sandbox.mkdir(parents=True)
    (sandbox / "package.json").write_text('{"name": "sysrunnercomp"}')
    (sandbox / "nx.json").write_text("{}")
    try:
        result = _scaffold_workspace_comp(sandbox, "system-test-runner", interfaceMedium=medium)
        assert result.returncode == 0, (
            f"Generator failed for interfaceMedium={medium}\n"
            f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}"
        )

        pyproject_path = sandbox / "tests" / "pyproject.toml"
        assert pyproject_path.exists(), "tests/pyproject.toml not generated"

        # Validate TOML is parseable — catches template rendering errors
        with open(pyproject_path, "rb") as f:
            config = tomllib.load(f)

        deps = config.get("project", {}).get("dependencies", [])

        # Core deps must always be present
        dep_names = [d.split(">=")[0].split("==")[0].split("[")[0].lower() for d in deps]
        for required in ["pytest", "pytest-asyncio", "httpx", "tenacity", "pyyaml", "psycopg"]:
            assert required in dep_names, f"{required} missing from deps for medium={medium}"

        # pytest-playwright only for graphical-ui
        if medium == "graphical-ui":
            assert "pytest-playwright" in dep_names, \
                "pytest-playwright missing for interfaceMedium=graphical-ui"
        else:
            assert "pytest-playwright" not in dep_names, \
                f"pytest-playwright should be absent for interfaceMedium={medium}"

        # testpaths includes bets
        testpaths = config.get("tool", {}).get("pytest", {}).get("ini_options", {}).get("testpaths", [])
        assert "bets" in testpaths, "testpaths does not include 'bets'"

    finally:
        shutil.rmtree(sandbox, ignore_errors=True)
