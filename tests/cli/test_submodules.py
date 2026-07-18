"""Submodule-topology contract tests for bin/groundwork.js (init / check).

A methodology-twin repo often keeps its doc canon or tooling in git submodules.
init must state the superproject-root topology honestly (notice + state record)
without changing the rest of the install contract; check surfaces it as an
advisory. Both read .gitmodules directly, so an uninitialized clone (gitlinks
without checked-out content) is still detected.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import json
import os
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"


def run_cli(args, cwd):
    env = {**os.environ, "GROUNDWORK_NO_UPDATE_CHECK": "1"}
    return subprocess.run(
        ["node", str(CLI), *args], cwd=cwd, capture_output=True, text=True, env=env
    )


def git(args, cwd):
    return subprocess.run(
        ["git", "-c", "user.email=t@t", "-c", "user.name=t", *args],
        cwd=cwd, capture_output=True, text=True, check=True,
    )


@pytest.fixture()
def project(tmp_path):
    repo = tmp_path / "superproject"
    repo.mkdir()
    git(["init", "-q"], repo)
    return repo


def state_of(project):
    return json.loads((project / ".groundwork/config/state.json").read_text())


def add_real_submodule(project, tmp_path, dest="vendored/child"):
    child = tmp_path / "child"
    child.mkdir()
    git(["init", "-q"], child)
    (child / "README.md").write_text("child\n")
    git(["add", "-A"], child)
    git(["commit", "-qm", "seed"], child)
    # Local-path submodules need the file protocol explicitly allowed on modern git.
    git(["-c", "protocol.file.allow=always", "submodule", "add", str(child), dest], project)
    return dest


def test_init_records_real_submodule_topology(project, tmp_path):
    dest = add_real_submodule(project, tmp_path)

    proc = run_cli(["init"], project)
    assert proc.returncode == 0, proc.stderr
    assert "submodule" in proc.stdout.lower()
    assert "superproject root" in proc.stdout

    state = state_of(project)
    assert state["topology"]["submodules"] == [dest]
    # The rest of the install contract is unchanged.
    assert (project / ".agents/skills/groundwork-orchestrator/SKILL.md").exists()
    assert state["completed"] == []


def test_init_detects_uninitialized_gitmodules(project):
    # A fresh clone can carry .gitmodules with no checked-out content — detection
    # reads the file, not the working tree.
    (project / ".gitmodules").write_text(
        '[submodule "docs-site"]\n\tpath = services/docs\n\turl = https://example.invalid/docs.git\n'
    )
    proc = run_cli(["init"], project)
    assert proc.returncode == 0, proc.stderr
    assert state_of(project)["topology"]["submodules"] == ["services/docs"]


def test_init_without_submodules_stays_silent(project):
    proc = run_cli(["init"], project)
    assert proc.returncode == 0, proc.stderr
    # The pytest tmp dir name itself contains "submodules", and init echoes the
    # path — assert on the notice's own phrase, not the bare word.
    assert "superproject root" not in proc.stdout
    assert "topology" not in state_of(project)


def test_check_advises_on_uninitialized_submodules(project):
    run_cli(["init"], project)
    (project / ".gitmodules").write_text(
        '[submodule "docs-site"]\n\tpath = services/docs\n\turl = https://example.invalid/docs.git\n'
    )
    proc = run_cli(["check"], project)
    assert "git submodule(s)" in proc.stdout
    # Warnings go to stderr (c.warn → console.warn).
    assert "not initialized" in proc.stderr
