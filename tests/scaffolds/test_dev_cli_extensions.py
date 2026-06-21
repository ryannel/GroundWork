"""Composable `./dev` — project-owned commands extend the CLI without touching the
bundle (the customization seam), and an empty workspace degrades loudly instead of
no-opping (the "no empty capabilities" rule). Runs the committed bundle directly with
node against throwaway projects.
"""

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
