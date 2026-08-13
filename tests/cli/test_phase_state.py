"""phase_states register tests (doc-canon-and-onboarding-diet plan, slice B1).

state.json gains a `phase_states` object (schema version 3): the register that
records a setup phase as deferred, collapsed, or not-applicable. init seeds it;
the gw-phase-state-register migration adds it to older installs. The migration
is exercised through the real runner via GROUNDWORK_MIGRATIONS_DIR (the
documented seam), pointing at the real module file, on a project whose
state.json has been rewound to the pre-register shape.
"""

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"
MIGRATION = REPO_ROOT / "migrations" / "gw-phase-state-register.js"


def run_cli(args, cwd, migrations_dir=None):
    env = dict(os.environ)
    if migrations_dir is not None:
        env["GROUNDWORK_MIGRATIONS_DIR"] = str(migrations_dir)
    return subprocess.run(
        ["node", str(CLI), *args], cwd=cwd, capture_output=True, text=True, env=env
    )


def state_path(project: Path) -> Path:
    return project / ".groundwork" / "config" / "state.json"


def read_state(project: Path) -> dict:
    return json.loads(state_path(project).read_text())


def write_state(project: Path, state: dict) -> None:
    state_path(project).write_text(json.dumps(state, indent=2) + "\n")


@pytest.fixture()
def project(tmp_path):
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    proc = run_cli(["init"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    return tmp_path


@pytest.fixture()
def registry(tmp_path_factory):
    """A registry holding only the real gw-phase-state-register module."""
    mig = tmp_path_factory.mktemp("registry")
    shutil.copy(MIGRATION, mig / "gw-phase-state-register.js")
    (mig / "index.json").write_text(
        json.dumps(
            {
                "migrations": [
                    {
                        "id": "gw-phase-state-register",
                        "version": "0.17.0",
                        "title": "Add the phase_states register to state.json",
                        "kind": "cli",
                        "summary": "test",
                    }
                ]
            }
        )
    )
    return mig


def rewind_to_pre_register(project: Path) -> None:
    """Rewrite state.json to the shape an older install carries."""
    state = read_state(project)
    state.pop("phase_states", None)
    state["version"] = 2
    recorded = state.get("groundwork", {}).get("migrations", [])
    if "gw-phase-state-register" in recorded:
        recorded.remove("gw-phase-state-register")
    write_state(project, state)


def test_init_seeds_phase_states(project):
    state = read_state(project)
    assert state["phase_states"] == {}
    assert state["version"] == 3


def test_migration_adds_register_to_older_install(project, registry):
    rewind_to_pre_register(project)
    state = read_state(project)
    state["completed"] = ["scan"]
    write_state(project, state)

    proc = run_cli(["update"], project, migrations_dir=registry)
    assert proc.returncode == 0, proc.stderr

    state = read_state(project)
    assert state["phase_states"] == {}
    assert state["version"] == 3
    assert state["completed"] == ["scan"], "migration must not disturb other keys"


def test_migration_preserves_existing_entries(project, registry):
    """A state.json that already carries register entries is left alone."""
    state = read_state(project)
    state["phase_states"] = {"design-system-extract": {"state": "deferred"}}
    write_state(project, state)

    proc = run_cli(["update"], project, migrations_dir=registry)
    assert proc.returncode == 0, proc.stderr

    state = read_state(project)
    assert state["phase_states"] == {"design-system-extract": {"state": "deferred"}}


def test_migration_idempotent(project, registry):
    rewind_to_pre_register(project)
    for _ in range(2):
        proc = run_cli(["update"], project, migrations_dir=registry)
        assert proc.returncode == 0, proc.stderr
    state = read_state(project)
    assert state["phase_states"] == {}
    assert state["version"] == 3
