"""Composable `./dev` — project-owned commands extend the CLI without touching the
bundle (the customization seam), and an empty workspace degrades loudly instead of
no-opping (the "no empty capabilities" rule). Runs the committed bundle directly with
node against throwaway projects.
"""

import ast
import json
import os
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
COMMITTED_BUNDLE = (
    REPO_ROOT / "src" / "generators" / "workspace-dev-cli" / "cli-src" / "dist" / "dev-bundle.js"
)


def _dev(project: Path, *args: str, cwd: Path | None = None) -> subprocess.CompletedProcess:
    """Run the committed dev bundle with node. DEV_ROOT pins the project; cwd controls
    where Docker/service discovery looks (default: the project itself)."""
    return subprocess.run(
        ["node", str(COMMITTED_BUNDLE), *args],
        cwd=str(cwd or project),
        capture_output=True,
        text=True,
        timeout=60,
        env={**os.environ, "DEV_ROOT": str(project)},
    )


def _project(tmp_path: Path, config: dict, commands_dir: dict[str, dict] | None = None) -> Path:
    project = tmp_path / "proj"
    (project / ".dev").mkdir(parents=True)
    (project / ".dev" / "dev.config.json").write_text(json.dumps(config))
    if commands_dir:
        cdir = project / ".dev" / "commands"
        cdir.mkdir()
        for name, spec in commands_dir.items():
            (cdir / f"{name}.json").write_text(json.dumps(spec))
    return project


def _require_bundle():
    if not COMMITTED_BUNDLE.exists():
        pytest.fail(f"committed bundle missing: {COMMITTED_BUNDLE} — run npm run build:dev-cli")


def test_project_command_from_config_is_discovered_and_runs(tmp_path):
    """A `commands` entry in dev.config.json appears in help and executes as a subprocess
    with extra args appended."""
    _require_bundle()
    project = _project(
        tmp_path,
        {
            "projectPrefix": "demo",
            "runners": [],
            "commands": [
                {"name": "seed", "summary": "Load demo fixtures", "group": "DATA", "run": "echo seeded"}
            ],
        },
    )

    help_out = _dev(project, "help").stderr + _dev(project, "help").stdout
    assert "seed" in help_out, f"project command not listed in help:\n{help_out}"
    assert "DATA" in help_out, f"custom group not rendered:\n{help_out}"

    run = _dev(project, "seed")
    assert run.returncode == 0, f"project command failed:\n{run.stderr}"
    assert "seeded" in (run.stdout + run.stderr)


def test_project_command_from_commands_dir_is_discovered(tmp_path):
    """A `.dev/commands/*.json` file is discovered the same as an inline command."""
    _require_bundle()
    project = _project(
        tmp_path,
        {"projectPrefix": "demo", "runners": []},
        commands_dir={"release": {"name": "release", "summary": "Cut a release", "run": "echo released"}},
    )
    run = _dev(project, "release")
    assert run.returncode == 0, f"dir command failed:\n{run.stderr}"
    assert "released" in (run.stdout + run.stderr)


def test_project_command_shadows_builtin(tmp_path):
    """A project command named like a built-in shadows it — the project's version runs,
    not the framework lifecycle. This is how a project redefines `start` for a stack the
    default lifecycle does not fit."""
    _require_bundle()
    project = _project(
        tmp_path,
        {
            "projectPrefix": "demo",
            "runners": [],
            "commands": [{"name": "start", "summary": "Launch native app", "run": "echo custom-start"}],
        },
    )
    run = _dev(project, "start")
    assert run.returncode == 0, f"shadowed start failed:\n{run.stderr}"
    out = run.stdout + run.stderr
    assert "custom-start" in out, f"project command did not shadow built-in start:\n{out}"
    # The built-in start would try Docker/native boot; the custom one must not.
    assert "Infrastructure" not in out and "docker" not in out.lower()


def test_project_command_in_completion(tmp_path):
    """Project verbs appear in the generated shell completion, like the built-ins."""
    _require_bundle()
    project = _project(
        tmp_path,
        {"projectPrefix": "demo", "runners": [], "commands": [{"name": "seed", "summary": "s", "run": "true"}]},
    )
    out = _dev(project, "completion", "bash").stdout
    assert "seed" in out, f"project verb missing from completion:\n{out}"


SHIPPED_TEMPLATES_DIR = (
    REPO_ROOT / "src" / "generators" / "workspace-dev-cli" / "files" / "scripts" / "cli" / "templates"
)


def _seed_bet_templates(project: Path, extra: dict[str, str] | None = None) -> None:
    """Materialize `scripts/cli/templates/` the way the scaffold does: strip the
    `.template` suffix off the shipped milestone/slice pytmpl sources. `extra` adds
    further `{filename: content}` templates (e.g. a `.gotmpl` variant) to prove
    `./dev new milestone|slice` discovers whichever template ships instead of
    assuming `.py`."""
    dest = project / "scripts" / "cli" / "templates"
    dest.mkdir(parents=True)
    for src in SHIPPED_TEMPLATES_DIR.glob("*.template"):
        (dest / src.name.removesuffix(".template")).write_text(src.read_text())
    for name, content in (extra or {}).items():
        (dest / name).write_text(content)


def test_new_milestone_and_slice_discover_extension_from_shipped_template(tmp_path):
    """`./dev new milestone|slice` must not hardcode `.py` — it discovers the
    extension from whichever test-stub template actually ships. Today only the
    pytest harness's `.pytmpl` ships, so the discovered extension is still `.py`,
    but it is *discovered*, not assumed: the multi-underscore service name here
    also exercises `SLICE_RE`'s trailing-kebab-slug anchoring end to end via
    `bet status --json`."""
    _require_bundle()
    project = _project(tmp_path, {"projectPrefix": "demo", "runners": []})
    _seed_bet_templates(project)

    bet = _dev(project, "new", "bet", "notifications")
    assert bet.returncode == 0, f"new bet failed:\n{bet.stderr}"

    milestone = _dev(project, "new", "milestone", "notifications", "event-intake")
    assert milestone.returncode == 0, f"new milestone failed:\n{milestone.stderr}"
    milestone_file = project / "tests" / "bets" / "notifications" / "test_milestone_1_event-intake.py"
    assert milestone_file.exists(), f"expected {milestone_file}, got: {milestone.stdout}"
    milestone_content = milestone_file.read_text()
    assert "Milestone 1: event-intake" in milestone_content
    # Kebab slug in the filename, snake identifier in the def — a hyphenated
    # def name is a SyntaxError pytest hits at import time.
    assert "async def test_milestone_1_event_intake_api(" in milestone_content
    ast.parse(milestone_content)

    slice_ = _dev(
        project, "new", "slice", "notifications", "event-intake", "billing_service", "record-event"
    )
    assert slice_.returncode == 0, f"new slice failed:\n{slice_.stderr}"
    slice_file = project / "tests" / "bets" / "notifications" / "test_slice_1_billing_service_record-event.py"
    assert slice_file.exists(), f"expected {slice_file}, got: {slice_.stdout}"
    content = slice_file.read_text()
    assert "service: billing_service" in content
    assert "async def test_slice_1_record_event(" in content
    ast.parse(content)

    # SLICE_RE anchors the slug to the trailing kebab token even though the
    # service segment itself has underscores — confirm the board parses it back.
    status = _dev(project, "bet", "status", "notifications", "--json")
    assert status.returncode == 0, f"bet status failed:\n{status.stderr}"
    board = json.loads(status.stdout)
    assert board["slices"] == [
        {"n": 1, "service": "billing_service", "slug": "record-event", "file": slice_file.name, "state": "red"}
    ], board


def test_new_slice_picks_up_a_non_python_template_when_one_ships(tmp_path):
    """When a template ships in another language (e.g. a future Go harness's
    `slice-test.gotmpl`), the CLI must follow it rather than always writing
    `.py` — proving the extension is discovered from disk, not hardcoded."""
    _require_bundle()
    project = _project(tmp_path, {"projectPrefix": "demo", "runners": []})
    _seed_bet_templates(
        project,
        extra={
            "slice-test.gotmpl": "// slice @@N@@ @@SLUG@@ in @@SERVICE@@ for bet @@BET@@\n",
        },
    )

    assert _dev(project, "new", "bet", "checkout").returncode == 0
    assert (
        _dev(project, "new", "milestone", "checkout", "cart").returncode == 0
    )  # only .pytmpl ships for milestones -> stays .py

    slice_ = _dev(project, "new", "slice", "checkout", "cart", "cart-service", "add-item")
    assert slice_.returncode == 0, f"new slice failed:\n{slice_.stderr}"
    go_file = project / "tests" / "bets" / "checkout" / "test_slice_1_cart-service_add-item.go"
    py_file = project / "tests" / "bets" / "checkout" / "test_slice_1_cart-service_add-item.py"
    assert go_file.exists(), f"expected discovered .go extension, got: {slice_.stdout}"
    assert not py_file.exists(), "extension should follow the discovered template, not stay hardcoded to .py"
    assert "add-item" in go_file.read_text()


def test_slice_numbering_is_bet_global_not_per_milestone(tmp_path):
    """`<N>` is the slice's ordinal across the whole bet (D11) — it keeps
    incrementing across milestones rather than resetting at each one."""
    _require_bundle()
    project = _project(tmp_path, {"projectPrefix": "demo", "runners": []})
    _seed_bet_templates(project)
    assert _dev(project, "new", "bet", "onboarding").returncode == 0
    assert _dev(project, "new", "milestone", "onboarding", "signup").returncode == 0
    assert _dev(project, "new", "milestone", "onboarding", "verify").returncode == 0

    first = _dev(project, "new", "slice", "onboarding", "signup", "auth", "create-account")
    assert first.returncode == 0
    second = _dev(project, "new", "slice", "onboarding", "verify", "auth", "send-code")
    assert second.returncode == 0

    bets_dir = project / "tests" / "bets" / "onboarding"
    assert (bets_dir / "test_slice_1_auth_create-account.py").exists()
    assert (bets_dir / "test_slice_2_auth_send-code.py").exists(), sorted(p.name for p in bets_dir.iterdir())


def test_empty_start_degrades_loudly(tmp_path):
    """`./dev start` on a workspace with nothing registered must NOT silently succeed —
    it warns and points at how to register a runner or a command (no empty capabilities).
    Run from an isolated cwd so docker-compose discovery finds nothing up-tree."""
    _require_bundle()
    project = _project(tmp_path, {"projectPrefix": "empty", "runners": []})
    run = _dev(project, "start", cwd=project)
    out = (run.stdout + run.stderr).lower()
    assert "nothing to start" in out, f"empty start did not degrade loudly:\n{out}"
    # It must point at the remedy, not just state the fact.
    assert ".dev/commands" in out or "runner" in out, f"empty start gave no remedy:\n{out}"
