"""
Layer 1 — Generation Correctness Tests: flutter-app

Generation-tier only, per the multi-surface verification contract: no Flutter
SDK is required for anything in this file. Asserts that:
  - the generator exits cleanly and produces the expected file set
  - brand-tokens.json's visual block projects into the Dart theme module
  - Tier-1-only tokens (and no tokens) fall back to sensible defaults
  - stack docs deploy idempotently (mirroring the go/nextjs tests)
  - the engineer skill is promoted alongside the output
  - no EJS artifacts leak into generated files
  - the app never joins docker-compose (a mobile app has no Docker boot)

The compilation tier (flutter analyze) runs only when the SDK is on PATH and
is reported skipped-with-reason otherwise — never silently green.

Sandbox note: brand tokens must exist BEFORE generation, so each token
scenario gets its own sandbox under .sandboxes/scaffolds/generation-flutter/.
"""

import json
import re
import shutil
import subprocess
import pytest
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
GENERATORS_JSON = REPO_ROOT / "generators.json"
SANDBOX_BASE = REPO_ROOT / ".sandboxes" / "scaffolds" / "generation-flutter"

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
        "motion": {
            "easeStandard": "cubic-bezier(0.2, 0, 0, 1)",
            "durationBaseMs": 150,
            "personality": "snappy",
        },
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
def flutter_sandbox_base():
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
    (sandbox / "package.json").write_text('{"name": "fluttergentest"}')
    (sandbox / "nx.json").write_text("{}")
    if brand_tokens is not None:
        config = sandbox / ".groundwork" / "config"
        config.mkdir(parents=True)
        (config / "brand-tokens.json").write_text(json.dumps(brand_tokens, indent=2))
    return sandbox


def _scaffold(sandbox: Path, service_name: str, **params) -> subprocess.CompletedProcess:
    cmd = ["npx", "--yes", "nx", "g", f"{GENERATORS_JSON}:flutter-app", "--name", service_name]
    for key, value in params.items():
        cmd.extend(["--" + key, str(value)])
    return subprocess.run(cmd, cwd=sandbox, capture_output=True, text=True)


def _assert_ok(result: subprocess.CompletedProcess, context: str):
    assert result.returncode == 0, (
        f"flutter-app generator failed ({context})\n"
        f"STDOUT: {result.stdout}\nSTDERR: {result.stderr}"
    )


# ---------------------------------------------------------------------------
# File set
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def default_app() -> Path:
    """A flutter-app generated with no brand tokens at all."""
    sandbox = _make_sandbox("default")
    result = _scaffold(sandbox, "mobile-app")
    _assert_ok(result, "no tokens")
    return sandbox


def test_flutter_app_file_set(default_app):
    app = default_app / "services" / "mobile-app"
    expected = [
        "pubspec.yaml",
        "analysis_options.yaml",
        "project.json",
        "README.md",
        ".gitignore",
        "tool/flutter_exec.sh",
        "lib/main.dart",
        "lib/app.dart",
        "lib/router.dart",
        "lib/config/app_config.dart",
        "lib/ui/core/theme/brand_palette.dart",
        "lib/ui/core/theme/app_theme.dart",
        "lib/ui/home/home_view.dart",
        "lib/ui/home/home_view_model.dart",
        "lib/data/repositories/status_repository.dart",
        "lib/data/services/api_client.dart",
        "lib/domain/models/health_status.dart",
        "test/home_view_test.dart",
        "test/api_client_test.dart",
        "test/fakes/fake_status_repository.dart",
        "integration_test/app_test.dart",
    ]
    for rel in expected:
        assert (app / rel).exists(), f"expected generated file missing: {rel}"


def test_pubspec_is_a_valid_dart_package(default_app):
    pubspec = (default_app / "services" / "mobile-app" / "pubspec.yaml").read_text()
    # Dart package names are lower_snake_case — the kebab slug must be converted.
    assert "name: mobile_app" in pubspec, "pubspec package name must be snake_case"
    assert "flutter_riverpod:" in pubspec
    assert "go_router:" in pubspec
    assert "dio:" in pubspec
    assert "integration_test:" in pubspec
    assert "flutter_lints:" in pubspec
    assert "sdk: ^3.12.0" in pubspec


def test_project_json_targets_wrap_flutter_cli(default_app):
    """O7: hand-rolled nx:run-commands targets wrapping the flutter CLI."""
    project = json.loads(
        (default_app / "services" / "mobile-app" / "project.json").read_text()
    )
    targets = project["targets"]
    for target in ["bootstrap", "run", "build", "analyze", "test", "test-integration"]:
        assert target in targets, f"project.json missing target: {target}"
        assert targets[target]["executor"] == "nx:run-commands", (
            f"target {target} must use nx:run-commands (O7: no third-party plugin)"
        )
        assert "flutter_exec.sh" in targets[target]["options"]["command"], (
            f"target {target} must run through the toolchain guard"
        )


def test_toolchain_guard_degrades_with_reason(default_app):
    """A missing SDK reports skipped-with-reason, never a cryptic failure."""
    guard = (default_app / "services" / "mobile-app" / "tool" / "flutter_exec.sh").read_text()
    assert "command -v flutter" in guard, "guard must detect the SDK"
    assert "tier skipped" in guard, "guard must report the tier as skipped"


def test_core_access_seam_targets_the_core_health_route(default_app):
    """The wiring proof must hit the route GroundWork cores actually serve:
    Go and Python cores answer /health. /api/healthz is the Next.js BFF route
    and 404s against a scaffolded core — proven live in the manual sandbox
    (the home view rendered 'unreachable' against a healthy core)."""
    client = (
        default_app / "services" / "mobile-app" / "lib" / "data" / "services" / "api_client.dart"
    ).read_text()
    assert "'/health'" in client, "wiring proof must probe the core's /health route"
    assert "'/api/healthz'" not in client, (
        "/api/healthz is the Next.js BFF route — it 404s against Go/Python cores"
    )


def test_auth_seam_is_present_and_unauthenticated_by_default(default_app):
    """The surface ships a token seam (provider + interceptor), not a baked
    credential: a supplied token rides as a Bearer header, the default adds
    nothing, and the seam has its own adapter-level test."""
    app = default_app / "services" / "mobile-app"
    client = (app / "lib" / "data" / "services" / "api_client.dart").read_text()
    assert "authTokenProvider" in client, "auth token seam missing"
    assert "authInterceptor" in client, "auth interceptor missing"
    assert "Bearer" in client, "token must ride as an Authorization: Bearer header"
    test_src = (app / "test" / "api_client_test.dart").read_text()
    assert "package:mobile_app/" in test_src, "seam test must import the app package"
    assert "Authorization" in test_src


def test_bootstrap_creates_empty_platform_shells(default_app):
    """`flutter create` without --empty adds its counter-app sample test
    (referencing a MyApp this scaffold does not have), breaking analyze and
    test straight after bootstrap — proven live in the manual sandbox."""
    guard = (default_app / "services" / "mobile-app" / "tool" / "flutter_exec.sh").read_text()
    assert "flutter create . --empty" in guard, (
        "bootstrap must use --empty so create adds no sample app files"
    )


def test_engineer_skill_promoted(default_app):
    """The flutter engineer skill is auto-installed alongside the output."""
    skill = default_app / ".agents" / "skills" / "groundwork-flutter-engineer"
    assert (skill / "SKILL.md").exists(), "engineer SKILL.md not promoted"
    assert (skill / "sync-anchor.md").exists(), "engineer sync-anchor.md not promoted"
    references = skill / "references"
    assert references.is_dir() and any(references.iterdir()), (
        "engineer references/ not promoted"
    )


def test_generated_files_nonempty_and_no_ejs_artifacts(default_app):
    # Platform shells (android/, ios/) and pub artifacts are flutter-tool
    # output, not generator output — they appear when the SDK is on PATH
    # (bootstrap runs at generation time) and contain binaries (gradle jars,
    # icons) the EJS scan must not read.
    toolchain_dirs = {"android", "ios", ".dart_tool", "build"}
    app = default_app / "services" / "mobile-app"
    for path in app.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(app)
        if rel.parts[0] in toolchain_dirs:
            continue
        content = path.read_text()
        assert content.strip(), f"generated file is empty: {rel}"
        assert "<%" not in content, f"EJS artifact leaked into generated file: {rel}"


# ---------------------------------------------------------------------------
# Workspace wiring — pubspec-based, never docker-compose / npm workspaces
# ---------------------------------------------------------------------------

def test_palette_color_literals_are_valid_dart(default_app):
    """Every emitted Color literal must be 0xFF + 6 hex digits. The neutral
    default palette carries CSS-style '#rrggbb' values; an unstripped '#'
    produced `Color(0xFF#3B6FD4)` — caught only when the compile tier first
    ran with a real SDK, so it is pinned here SDK-free."""
    palette = (
        default_app / "services" / "mobile-app" / "lib" / "ui" / "core" / "theme" / "brand_palette.dart"
    ).read_text()
    literals = re.findall(r"Color\(([^)]*)\)", palette)
    assert literals, "palette must emit Color literals"
    for literal in literals:
        assert re.fullmatch(r"0xFF[0-9A-F]{6}", literal), (
            f"malformed Dart Color literal: Color({literal})"
        )


def test_flutter_app_never_joins_docker_compose():
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

    result = _scaffold(sandbox, "mobile-app")
    _assert_ok(result, "with docker-compose present")

    assert (sandbox / "docker-compose.yml").read_text() == compose_before, (
        "flutter-app must not touch docker-compose.yml — a mobile app has no Docker boot"
    )
    assert (sandbox / "package.json").read_text() == package_before, (
        "flutter-app must not register itself in package.json — it lives on pubspec"
    )


# ---------------------------------------------------------------------------
# Theme projection from brand-tokens.json
# ---------------------------------------------------------------------------

def test_theme_projection_from_visual_block():
    sandbox = _make_sandbox("visual", brand_tokens=BRAND_TOKENS_TWO_BLOCK)
    result = _scaffold(sandbox, "branded-app")
    _assert_ok(result, "two-block tokens")

    palette = (
        sandbox / "services" / "branded-app" / "lib" / "ui" / "core" / "theme" / "brand_palette.dart"
    ).read_text()

    # Palette hex values land as Dart Color literals.
    assert "Color(0xFF5FAFFF)" in palette, "visual.palette.primary.light not projected"
    assert "Color(0xFF17181C)" in palette, "visual.palette.surface.dark not projected"
    # OKLCH values are resolved to sRGB at generation time, never shipped raw.
    assert "oklch" not in palette.lower(), "OKLCH must be resolved at generation time"
    assert "primaryDark = Color(0xFF" in palette, "oklch primary.dark did not resolve"
    # Typography families and shape project too.
    assert "Instrument Sans" in palette, "display font family not projected"
    assert "'Inter'" in palette, "body font family not projected"
    assert "radiusBase = 12.0" in palette, "shape.radiusBase not projected"
    assert "visual-block" in palette, "projection source not recorded"

    # The theme builder consumes the palette; widgets consume the theme.
    app_theme = (
        sandbox / "services" / "branded-app" / "lib" / "ui" / "core" / "theme" / "app_theme.dart"
    ).read_text()
    assert "BrandPalette.primaryLight" in app_theme
    assert "buildDarkTheme" in app_theme, "dual-theme support is a brand commitment"


def test_tier1_tokens_seed_from_identity():
    sandbox = _make_sandbox("tier1", brand_tokens=BRAND_TOKENS_TIER1)
    result = _scaffold(sandbox, "tier-one-app")
    _assert_ok(result, "tier-1 tokens")

    palette = (
        sandbox / "services" / "tier-one-app" / "lib" / "ui" / "core" / "theme" / "brand_palette.dart"
    ).read_text()
    assert "identity-only" in palette, "Tier-1 projection source not recorded"
    assert "Color(0xFF5FAFFF)" in palette, (
        "identity.primary must seed the palette when no visual block exists"
    )


def test_no_tokens_fall_back_to_neutral_default(default_app):
    palette = (
        default_app / "services" / "mobile-app" / "lib" / "ui" / "core" / "theme" / "brand_palette.dart"
    ).read_text()
    assert "Projection source: default" in palette
    # The neutral default still emits every palette role in both themes.
    for role in ["primary", "accent", "surface", "surfaceAlt", "textBody",
                 "success", "error", "warning", "info"]:
        assert f"{role}Light" in palette, f"neutral default missing {role}Light"
        assert f"{role}Dark" in palette, f"neutral default missing {role}Dark"


# ---------------------------------------------------------------------------
# Stack docs — deployed and idempotent (mirrors the go/nextjs tests)
# ---------------------------------------------------------------------------

def test_flutter_stack_docs_deployed(default_app):
    docs_root = default_app / "docs" / "principles" / "stack" / "flutter"
    for doc in ["index.md", "architecture.md", "state-management.md",
                "widgets-and-composition.md", "testing.md",
                "platform-channels.md", "releases-and-distribution.md"]:
        assert (docs_root / doc).exists(), f"Flutter stack doc not deployed: {doc}"


def test_flutter_stack_docs_idempotency(default_app):
    """Second generation must not overwrite existing stack docs."""
    index = default_app / "docs" / "principles" / "stack" / "flutter" / "index.md"
    assert index.exists(), "index.md must exist after first generation"
    original_mtime = index.stat().st_mtime

    result = _scaffold(default_app, "second-app")
    _assert_ok(result, "second generation in same workspace")
    assert index.stat().st_mtime == original_mtime, (
        "flutter/index.md mtime changed on second generation — idempotency failed"
    )


# ---------------------------------------------------------------------------
# Compilation tier — only when the SDK is present (verification contract)
# ---------------------------------------------------------------------------

@pytest.mark.skipif(
    shutil.which("flutter") is None,
    reason="compilation tier: skipped — no Flutter SDK on this machine "
           "(per the multi-surface verification contract)",
)
def test_flutter_analyze_when_sdk_present(default_app):
    app = default_app / "services" / "mobile-app"
    pub_get = subprocess.run(
        ["flutter", "pub", "get"], cwd=app, capture_output=True, text=True
    )
    assert pub_get.returncode == 0, f"flutter pub get failed:\n{pub_get.stdout}\n{pub_get.stderr}"
    analyze = subprocess.run(
        ["flutter", "analyze"], cwd=app, capture_output=True, text=True
    )
    assert analyze.returncode == 0, f"flutter analyze failed:\n{analyze.stdout}\n{analyze.stderr}"
