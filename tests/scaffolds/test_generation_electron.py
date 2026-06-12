"""
Layer 1 — Generation Correctness Tests: electron-app

Generation-tier only by default, per the multi-surface verification contract:
no Electron binary (and no npm install) is required for anything except the
final opt-in compile test. Asserts that:
  - the generator exits cleanly and produces the expected file set
  - the security defaults are BAKED: the generated main never loosens the
    hardened quartet, permissions are denied by default, navigation is
    restricted, openExternal is allowlisted, the preload exposes no raw
    ipcRenderer, and the fuses config is present with the recorded settings
  - brand-tokens.json's visual block projects into the renderer's CSS custom
    properties (OKLCH passes through verbatim — CSS resolves it natively)
  - Tier-1-only tokens (and no tokens) fall back to sensible defaults
  - stack docs deploy idempotently and the generator's doc mirrors are
    byte-identical with their canonical sources (repo electron principles;
    nextjs-app's typescript/frontend.md)
  - the engineer skill is promoted alongside the output
  - no EJS artifacts leak into generated files
  - the app never joins docker-compose (a desktop app has no Docker boot)

Compilation tier: the cheap, always-on checks are config well-formedness plus
a TypeScript parse of every generated .ts/.tsx using the repo's own typescript
package (no install needed). A full `npm install && tsc` compile runs as the
last test and SKIPS-WITH-REASON when the registry is unreachable or slow —
documented choice: the full compile is real but environment-dependent, so it
degrades the way a missing SDK does, never silently green and never a flaky
hard failure.

Sandbox note: brand tokens must exist BEFORE generation, so each token
scenario gets its own sandbox under .sandboxes/scaffolds/generation-electron/.
"""

import json
import re
import shutil
import subprocess
import pytest
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
GENERATORS_JSON = REPO_ROOT / "generators.json"
SANDBOX_BASE = REPO_ROOT / ".sandboxes" / "scaffolds" / "generation-electron"

BRAND_TOKENS_TWO_BLOCK = {
    "schema": "groundwork.brand-tokens",
    "version": 1,
    "tier": 2,
    "identity": {
        "appName": "Acme",
        "wordmark": "X",
        "primary": "#5fafff",
        "accent": "#d7afff",
        "voice": "clear, modern",
    },
    "visual": {
        "palette": {
            "primary": {"light": "#5fafff", "dark": "oklch(70% 0.15 250)"},
            "accent": {"light": "#d7afff", "dark": "#b3a1f0"},
            "surface": {"light": "#fafafa", "dark": "#17181c"},
            "surfaceAlt": {"light": "#f0f1f4", "dark": "#1f2127"},
            "textBody": {"light": "#26282e", "dark": "#e4e6eb"},
            "success": {"light": "#2f9e6e", "dark": "#5fc398"},
            "error": {"light": "#cf4444", "dark": "#ef7f7f"},
            "warning": {"light": "#c08a1f", "dark": "#e0b35f"},
            "info": {"light": "#3b6fd4", "dark": "#7da7ef"},
        },
        "typography": {
            "display": {"family": "Instrument Sans", "weight": 600},
            "body": {"family": "Inter", "weight": 400},
            "scale": "1.25 modular from 16px",
        },
        "shape": {"radiusBase": "12px", "character": "soft"},
        "density": "comfortable, 8pt grid",
    },
    "terminal": {"colorRoles": {}, "symbols": {}, "splash": {"style": "none"}},
}

BRAND_TOKENS_TIER1 = {
    "schema": "groundwork.brand-tokens",
    "version": 1,
    "tier": 1,
    "identity": {
        "appName": "Acme",
        "wordmark": "X",
        "primary": "#5fafff",
        "accent": "#d7afff",
        "voice": "clear, modern",
    },
}


@pytest.fixture(scope="session", autouse=True)
def electron_sandbox_base():
    if SANDBOX_BASE.exists():
        shutil.rmtree(SANDBOX_BASE)
    SANDBOX_BASE.mkdir(parents=True)
    yield
    # Leave the sandbox for post-run inspection; CI cleans via ./dev eval clean


def _make_sandbox(name: str, brand_tokens: dict | None = None) -> Path:
    sandbox = SANDBOX_BASE / name
    if sandbox.exists():
        shutil.rmtree(sandbox)
    sandbox.mkdir(parents=True)
    (sandbox / "package.json").write_text('{"name": "electrongentest"}')
    (sandbox / "nx.json").write_text("{}")
    if brand_tokens is not None:
        config = sandbox / ".groundwork" / "config"
        config.mkdir(parents=True)
        (config / "brand-tokens.json").write_text(json.dumps(brand_tokens, indent=2))
    return sandbox


def _scaffold(sandbox: Path, service_name: str, **params) -> subprocess.CompletedProcess:
    cmd = ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:electron-app", "--name", service_name]
    for key, value in params.items():
        cmd.extend(["--" + key, str(value)])
    return subprocess.run(cmd, cwd=sandbox, capture_output=True, text=True)


def _assert_ok(result: subprocess.CompletedProcess, context: str):
    assert result.returncode == 0, (
        f"electron-app generator failed ({context})\n"
        f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}"
    )


# ---------------------------------------------------------------------------
# File set
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def default_app() -> Path:
    """An electron-app generated with no brand tokens at all."""
    sandbox = _make_sandbox("default")
    result = _scaffold(sandbox, "desktop-app")
    _assert_ok(result, "no tokens")
    return sandbox


def _app_root(sandbox: Path, name: str = "desktop-app") -> Path:
    return sandbox / "services" / name


def test_electron_app_file_set(default_app):
    app = _app_root(default_app)
    expected = [
        "package.json",
        "project.json",
        "README.md",
        ".gitignore",
        "electron.vite.config.ts",
        "forge.config.ts",
        "playwright.config.ts",
        "vitest.config.ts",
        "vitest.setup.ts",
        "eslint.config.mjs",
        "tsconfig.json",
        "tsconfig.node.json",
        "tsconfig.web.json",
        "tool/electron_exec.sh",
        "src/main/index.ts",
        "src/main/ipc.ts",
        "src/main/core-client.ts",
        "src/main/core-client.test.ts",
        "src/main/policy.ts",
        "src/main/policy.test.ts",
        "src/preload/index.ts",
        "src/shared/ipc.ts",
        "src/renderer/index.html",
        "src/renderer/src/main.tsx",
        "src/renderer/src/App.tsx",
        "src/renderer/src/App.test.tsx",
        "src/renderer/src/env.d.ts",
        "src/renderer/src/assets/main.css",
        "src/renderer/src/assets/brand.css",
        "tests/smoke/app.spec.ts",
    ]
    for rel in expected:
        assert (app / rel).exists(), f"expected generated file missing: {rel}"


def test_package_json_shape(default_app):
    pkg = json.loads((_app_root(default_app) / "package.json").read_text())
    assert pkg["name"] == "desktop-app"
    assert pkg["main"] == "./out/main/index.js", (
        "package.json main must point at the electron-vite build output"
    )
    dev = pkg["devDependencies"]
    for required in ["electron", "electron-vite", "@tailwindcss/vite",
                     "@playwright/test", "playwright", "@electron-forge/cli",
                     "@electron-forge/plugin-fuses", "@electron/fuses",
                     "vitest", "typescript", "typescript-eslint"]:
        assert required in dev, f"package.json missing devDependency: {required}"
    assert "zod" in pkg["dependencies"], "zod validates IPC payloads in main"
    assert "@tanstack/react-query" in pkg["dependencies"]


def test_project_json_targets_wrap_toolchain_guard(default_app):
    project = json.loads((_app_root(default_app) / "project.json").read_text())
    assert project["tags"] == ["surface:desktop", "stack:electron"]
    targets = project["targets"]
    for target in ["bootstrap", "run", "build", "lint", "typecheck", "test", "smoke", "package"]:
        assert target in targets, f"project.json missing target: {target}"
        assert targets[target]["executor"] == "nx:run-commands", (
            f"target {target} must use nx:run-commands"
        )
        assert "electron_exec.sh" in targets[target]["options"]["command"], (
            f"target {target} must run through the toolchain guard"
        )


def test_toolchain_guard_degrades_with_reason(default_app):
    """Missing binary or display reports skipped-with-reason, never silently
    green and never a cryptic failure (the verification contract)."""
    guard = (_app_root(default_app) / "tool" / "electron_exec.sh").read_text()
    assert "tier skipped" in guard, "guard must report tiers as skipped"
    assert "require('electron')" in guard, "guard must detect the Electron binary"
    assert "xvfb-run" in guard, "smoke must run under xvfb on displayless Linux CI"
    assert "DISPLAY" in guard, "guard must check display availability"


def test_core_access_seam_wired_through_main(default_app):
    """The desktop surface reaches the workspace core through main's
    core-client seam — the renderer's CSP forbids direct fetch, so the probe
    rides the typed bridge: API_BASE_URL is consumed in main, /health is the
    route (Go/Python cores; a Next.js BFF would be /api/healthz), the auth
    seam is a Bearer header, and the wiring proof renders in the home view.
    Before this seam existed the harness passed API_BASE_URL to an app that
    never read it — proven live in the manual sandbox."""
    root = _app_root(default_app)
    core = (root / "src" / "main" / "core-client.ts").read_text()
    assert "API_BASE_URL" in core, "core base URL must come from API_BASE_URL"
    assert "'/health'" in core, "wiring proof must probe the core's /health route"
    assert "Bearer" in core, "auth seam (Bearer header) missing"
    shared = (root / "src" / "shared" / "ipc.ts").read_text()
    assert "'core:health'" in shared, "core:health channel missing from the contract"
    assert "CoreHealth" in shared and "getCoreHealth" in shared
    main_ipc = (root / "src" / "main" / "ipc.ts").read_text()
    assert "'core:health'" in main_ipc and "fetchCoreHealth" in main_ipc, (
        "main must serve core:health via the core-client seam"
    )
    preload = (root / "src" / "preload" / "index.ts").read_text()
    assert "getCoreHealth" in preload, "bridge must expose the core probe"
    app_tsx = (root / "src" / "renderer" / "src" / "App.tsx").read_text()
    assert "core-status" in app_tsx, "home view must render the core wiring proof"
    smoke = (root / "tests" / "smoke" / "app.spec.ts").read_text()
    assert "getCoreHealth" in smoke, "smoke must assert the core seam answers"


def test_engineer_skill_promoted(default_app):
    """The electron engineer skill is auto-installed alongside the output."""
    skill = default_app / ".agents" / "skills" / "groundwork-electron-engineer"
    assert (skill / "SKILL.md").exists(), "engineer SKILL.md not promoted"
    assert (skill / "sync-anchor.md").exists(), "engineer sync-anchor.md not promoted"
    references = skill / "references"
    assert references.is_dir() and any(references.iterdir()), (
        "engineer references/ not promoted"
    )


def test_generated_files_nonempty_and_no_ejs_artifacts(default_app):
    app = _app_root(default_app)
    for path in app.rglob("*"):
        if not path.is_file():
            continue
        content = path.read_text()
        assert content.strip(), f"generated file is empty: {path.relative_to(app)}"
        assert "<%" not in content, (
            f"EJS artifact leaked into generated file: {path.relative_to(app)}"
        )


# ---------------------------------------------------------------------------
# Security defaults — baked, never advisory
# ---------------------------------------------------------------------------

def test_main_never_loosens_the_hardened_quartet(default_app):
    """The four window-hardening settings are asserted both ways: the loosened
    value must never appear anywhere in main, and the hardened quartet must be
    present in the window construction."""
    main_dir = _app_root(default_app) / "src" / "main"
    main_sources = {
        p.name: p.read_text() for p in main_dir.glob("*.ts")
    }
    for name, content in main_sources.items():
        flat = re.sub(r"\s+", " ", content)
        assert "nodeIntegration: true" not in flat, f"nodeIntegration enabled in {name}"
        assert "contextIsolation: false" not in flat, f"contextIsolation disabled in {name}"
        assert "webSecurity: false" not in flat, f"webSecurity disabled in {name}"
        assert "sandbox: false" not in flat, f"sandbox disabled in {name}"

    index = main_sources["index.ts"]
    for setting in ["contextIsolation: true", "sandbox: true",
                    "nodeIntegration: false", "webSecurity: true"]:
        assert setting in index, f"hardened quartet missing from window creation: {setting}"


def test_main_security_policy_wiring(default_app):
    index = (_app_root(default_app) / "src" / "main" / "index.ts").read_text()
    assert "setPermissionRequestHandler" in index, "permission handler missing"
    assert "callback(false)" in index, "permissions must be denied by default"
    assert "will-navigate" in index, "navigation restriction missing"
    assert "setWindowOpenHandler" in index, "window.open handling missing"
    assert "isAllowedExternalUrl" in index, "openExternal must go through the allowlist"
    assert "nativeTheme" in index, "nativeTheme sync broadcast missing"
    # Content ships over a custom protocol, never file://
    assert "protocol.handle" in index, "custom protocol handler missing"
    assert "loadFile(" not in index, "packaged content must not load over file://"


def test_main_validates_ipc_senders_and_payloads(default_app):
    ipc = (_app_root(default_app) / "src" / "main" / "ipc.ts").read_text()
    assert "senderFrame" in ipc, "sender validation (checklist item 17) missing"
    assert "zod" in ipc or "from 'zod'" in ipc, "zod payload validation missing"
    assert ".parse(" in ipc, "non-trivial payloads must be parsed, not trusted"


def test_preload_exposes_no_raw_ipc_renderer(default_app):
    preload = (_app_root(default_app) / "src" / "preload" / "index.ts").read_text()
    exposures = re.findall(r"exposeInMainWorld\(\s*['\"]([^'\"]+)['\"]", preload)
    assert exposures == ["api"], (
        f"preload must expose exactly one purpose-named bridge, got: {exposures}"
    )
    assert "ipcRenderer:" not in preload, (
        "raw ipcRenderer must never be a property of the exposed bridge"
    )
    assert not re.search(r"exposeInMainWorld\([^)]*ipcRenderer", preload), (
        "raw ipcRenderer must never be exposed on window"
    )


def test_fuses_config_present_with_recorded_settings(default_app):
    forge = (_app_root(default_app) / "forge.config.ts").read_text()
    assert "FusesPlugin" in forge, "fuses plugin missing from forge config"
    assert "[FuseV1Options.RunAsNode]: false" in forge
    assert "[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true" in forge
    assert "[FuseV1Options.OnlyLoadAppFromAsar]: true" in forge
    # The recorded exception: Playwright _electron launch needs the inspect
    # CLI path — the agent-closable loop outranks the marginal hardening.
    assert "[FuseV1Options.EnableNodeCliInspectArguments]: true" in forge
    assert "asar: true" in forge, "ASAR packaging required for the integrity fuses"


def test_renderer_ships_a_strict_csp(default_app):
    html = (_app_root(default_app) / "src" / "renderer" / "index.html").read_text()
    assert "Content-Security-Policy" in html, "CSP meta missing"
    csp = re.search(r'content="([^"]+)"\s*/?>', html)
    assert csp and "default-src 'self'" in csp.group(1), "CSP must be 'self'-strict"
    assert "*" not in (csp.group(1).replace("'", "")), "a CSP containing * is no CSP"


def test_lint_enforces_the_process_boundary(default_app):
    eslint = (_app_root(default_app) / "eslint.config.mjs").read_text()
    assert "no-restricted-imports" in eslint, "process-boundary lint rule missing"
    assert "src/renderer/**" in eslint, "renderer boundary block missing"
    assert "src/shared/**" in eslint, "shared boundary block missing"


def test_smoke_spec_drives_playwright_electron(default_app):
    spec = (_app_root(default_app) / "tests" / "smoke" / "app.spec.ts").read_text()
    assert "_electron" in spec, "smoke must use Playwright's _electron driver"
    assert "firstWindow" in spec, "smoke must acquire the first window"
    assert "toHaveTitle" in spec, "smoke must assert the window title"
    assert "getStatus" in spec, "smoke must assert one IPC round-trip"
    assert "app.close()" in spec, "smoke must close the app (leaked Electron wedges CI)"


# ---------------------------------------------------------------------------
# Workspace wiring — never docker-compose / npm workspaces
# ---------------------------------------------------------------------------

def test_electron_app_never_joins_docker_compose():
    sandbox = _make_sandbox("compose")
    compose_before = (
        "services:\n"
        "  core:\n"
        "    image: alpine:3\n"
        "    ports:\n"
        "      - \"4000:4000\"\n"
        "networks:\n"
        "  groundwork-net:\n"
    )
    (sandbox / "docker-compose.yml").write_text(compose_before)
    package_before = (sandbox / "package.json").read_text()

    result = _scaffold(sandbox, "desktop-app")
    _assert_ok(result, "with docker-compose present")

    assert (sandbox / "docker-compose.yml").read_text() == compose_before, (
        "electron-app must not touch docker-compose.yml — a desktop app has no Docker boot"
    )
    assert (sandbox / "package.json").read_text() == package_before, (
        "electron-app must not register itself in the workspace package.json"
    )


# ---------------------------------------------------------------------------
# Theme projection from brand-tokens.json
# ---------------------------------------------------------------------------

def _brand_css(sandbox: Path, name: str) -> str:
    return (
        sandbox / "services" / name / "src" / "renderer" / "src" / "assets" / "brand.css"
    ).read_text()


def test_theme_projection_from_visual_block():
    sandbox = _make_sandbox("visual", brand_tokens=BRAND_TOKENS_TWO_BLOCK)
    result = _scaffold(sandbox, "branded-app")
    _assert_ok(result, "two-block tokens")

    brand = _brand_css(sandbox, "branded-app")

    # Palette values land as CSS custom properties.
    assert "--gw-primary: #5fafff" in brand, "visual.palette.primary.light not projected"
    assert "--gw-surface: #fafafa" in brand, "visual.palette.surface.light not projected"
    # OKLCH passes through verbatim — CSS resolves it natively (the Dart
    # projection converts; the CSS one must not).
    assert "oklch(70% 0.15 250)" in brand, "oklch dark value must pass through to CSS"
    # Dark values resolve under the nativeTheme-driven attribute.
    assert ":root[data-theme='dark']" in brand, "dark theme block missing"
    assert "--gw-text-body: #e4e6eb" in brand, "visual.palette.textBody.dark not projected"
    # Typography and shape project too.
    assert "Instrument Sans" in brand, "display font family not projected"
    assert "'Inter'" in brand, "body font family not projected"
    assert "--gw-radius-base: 12px" in brand, "shape.radiusBase not projected"
    assert "visual-block" in brand, "projection source not recorded"

    # The static main.css maps the variables into Tailwind theme tokens;
    # components consume utilities, never the variables.
    main_css = (
        sandbox / "services" / "branded-app" / "src" / "renderer" / "src" / "assets" / "main.css"
    ).read_text()
    assert "@theme inline" in main_css, "Tailwind v4 token mapping missing"
    assert "--color-primary: var(--gw-primary)" in main_css
    app_tsx = (
        sandbox / "services" / "branded-app" / "src" / "renderer" / "src" / "App.tsx"
    ).read_text()
    assert "--gw-" not in app_tsx, "components must consume utilities, not raw variables"


def test_tier1_tokens_seed_from_identity():
    sandbox = _make_sandbox("tier1", brand_tokens=BRAND_TOKENS_TIER1)
    result = _scaffold(sandbox, "tier-one-app")
    _assert_ok(result, "tier-1 tokens")

    brand = _brand_css(sandbox, "tier-one-app")
    assert "identity-only" in brand, "Tier-1 projection source not recorded"
    assert "--gw-primary: #5fafff" in brand, (
        "identity.primary must seed the palette when no visual block exists"
    )
    assert "--gw-accent: #d7afff" in brand, "identity.accent must seed the palette"


def test_no_tokens_fall_back_to_neutral_default(default_app):
    brand = _brand_css(default_app, "desktop-app")
    assert "Projection source: default" in brand
    # The neutral default still emits every palette role in both theme blocks.
    for role in ["primary", "accent", "surface", "surface-alt", "text-body",
                 "success", "error", "warning", "info"]:
        assert brand.count(f"--gw-{role}:") == 2, (
            f"neutral default must emit --gw-{role} in light AND dark blocks"
        )


# ---------------------------------------------------------------------------
# Stack docs — deployed, idempotent, byte-identical with their canon
# ---------------------------------------------------------------------------

ELECTRON_DOCS = ["index.md", "process-model.md", "ipc-contracts.md",
                 "security.md", "packaging-and-updates.md"]


def test_electron_stack_docs_deployed(default_app):
    docs_root = default_app / "docs" / "principles" / "stack" / "electron"
    for doc in ELECTRON_DOCS:
        assert (docs_root / doc).exists(), f"Electron stack doc not deployed: {doc}"
    # The electron set defers renderer idiom to typescript/frontend.md, so the
    # generator ships it too — a desktop-only product must not have dead links.
    assert (default_app / "docs" / "principles" / "stack" / "typescript" / "frontend.md").exists(), (
        "typescript/frontend.md (the renderer-idiom deferral target) not deployed"
    )


def test_electron_stack_docs_idempotency(default_app):
    """Second generation must not overwrite existing stack docs."""
    index = default_app / "docs" / "principles" / "stack" / "electron" / "index.md"
    assert index.exists(), "index.md must exist after first generation"
    original_mtime = index.stat().st_mtime

    result = _scaffold(default_app, "second-app")
    _assert_ok(result, "second generation in same workspace")
    assert index.stat().st_mtime == original_mtime, (
        "electron/index.md mtime changed on second generation — idempotency failed"
    )


def test_generator_doc_mirrors_are_byte_identical():
    """The generator's doc mirrors must not drift from their canonical sources:
    the repo's electron principles, and nextjs-app's typescript/frontend.md
    (both generators ship the same renderer-idiom canon)."""
    gen_docs = REPO_ROOT / "src" / "generators" / "electron-app" / "docs" / "principles" / "stack"
    repo_docs = REPO_ROOT / "docs" / "principles" / "stack"
    for doc in ELECTRON_DOCS:
        assert (gen_docs / "electron" / doc).read_bytes() == (repo_docs / "electron" / doc).read_bytes(), (
            f"generator mirror drifted from docs/principles/stack/electron/{doc}"
        )
    nextjs_frontend = (
        REPO_ROOT / "src" / "generators" / "nextjs-app" / "docs" / "principles"
        / "stack" / "typescript" / "frontend.md"
    )
    assert (gen_docs / "typescript" / "frontend.md").read_bytes() == nextjs_frontend.read_bytes(), (
        "electron-app's typescript/frontend.md mirror drifted from nextjs-app's"
    )


# ---------------------------------------------------------------------------
# Compilation tier — cheap checks always; full tsc when the environment allows
# ---------------------------------------------------------------------------

def test_tsconfigs_and_build_config_well_formed(default_app):
    app = _app_root(default_app)
    root = json.loads((app / "tsconfig.json").read_text())
    assert {r["path"] for r in root["references"]} == {"./tsconfig.node.json", "./tsconfig.web.json"}

    node_cfg = json.loads((app / "tsconfig.node.json").read_text())
    assert node_cfg["compilerOptions"]["types"] == ["node"], "main/preload compile in node context"
    assert "DOM" not in node_cfg["compilerOptions"]["lib"], "node tsconfig must not carry DOM"
    assert node_cfg["compilerOptions"]["strict"] is True

    web_cfg = json.loads((app / "tsconfig.web.json").read_text())
    assert "DOM" in web_cfg["compilerOptions"]["lib"], "renderer compiles in DOM context"
    assert web_cfg["compilerOptions"]["jsx"] == "react-jsx"
    assert web_cfg["compilerOptions"]["strict"] is True

    vite_cfg = (app / "electron.vite.config.ts").read_text()
    for section in ["main:", "preload:", "renderer:"]:
        assert section in vite_cfg, f"electron.vite.config.ts missing section: {section}"
    assert "tailwindcss()" in vite_cfg, "Tailwind must load as a Vite plugin (renderer)"


def test_generated_typescript_parses(default_app):
    """TypeScript-parse every generated .ts/.tsx with the repo's own typescript
    package — catches syntax-level template breakage with no install."""
    app = _app_root(default_app)
    ts_files = sorted(
        str(p) for p in app.rglob("*")
        if p.suffix in (".ts", ".tsx") and p.is_file() and "node_modules" not in p.parts
    )
    assert ts_files, "no TypeScript files found to parse"
    script = (
        "const ts = require('typescript');"
        "const fs = require('fs');"
        "let failed = 0;"
        "for (const f of process.argv.slice(1)) {"
        "  const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'),"
        "    ts.ScriptTarget.Latest, true,"
        "    f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);"
        "  const diags = sf.parseDiagnostics || [];"
        "  if (diags.length) { failed++;"
        "    console.error(f + ': ' + ts.flattenDiagnosticMessageText(diags[0].messageText, ' ')); }"
        "}"
        "process.exit(failed ? 1 : 0);"
    )
    result = subprocess.run(
        ["node", "-e", script, "--"] + ts_files,
        cwd=REPO_ROOT, capture_output=True, text=True,
    )
    assert result.returncode == 0, f"generated TypeScript failed to parse:\n{result.stderr}"


def test_full_typecheck_when_environment_allows(default_app):
    """The real compilation tier: npm install (binary download skipped — tsc
    does not need it) + tsc on both process tsconfigs. Skips with a reason when
    the registry is unreachable or slow, mirroring how toolchain-dependent
    tiers degrade everywhere else in this suite."""
    app = _app_root(default_app)
    try:
        install = subprocess.run(
            ["npm", "install", "--no-audit", "--no-fund"],
            cwd=app, capture_output=True, text=True, timeout=300,
            env={**__import__("os").environ, "ELECTRON_SKIP_BINARY_DOWNLOAD": "1"},
        )
    except subprocess.TimeoutExpired:
        pytest.skip("compilation tier: skipped — npm install exceeded 300s on this machine")
    if install.returncode != 0:
        pytest.skip(
            "compilation tier: skipped — npm install failed (registry unreachable?): "
            + install.stderr[-500:]
        )

    typecheck = subprocess.run(
        ["npm", "run", "typecheck"], cwd=app, capture_output=True, text=True, timeout=300,
    )
    assert typecheck.returncode == 0, (
        f"tsc failed on the generated app:\n{typecheck.stdout}\n{typecheck.stderr}"
    )
