"""CLI contract tests for bin/groundwork.js (init / update / check).

Each test runs the real CLI in a scratch directory. Together they pin the
install contract: what init lays down, what re-init and update preserve, what
the self-copy guard refuses, and the exit-code semantics check promises CI.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"
PKG_VERSION = json.loads((REPO_ROOT / "package.json").read_text())["version"]


def run_cli(args, cwd):
    return subprocess.run(
        ["node", str(CLI), *args], cwd=cwd, capture_output=True, text=True
    )


def git(args, cwd):
    return subprocess.run(
        ["git", "-c", "user.email=t@t", "-c", "user.name=t", *args],
        cwd=cwd, capture_output=True, text=True, check=True,
    )


@pytest.fixture()
def project(tmp_path):
    git(["init", "-q"], tmp_path)
    return tmp_path


def test_init_installs_the_contract(project):
    proc = run_cli(["init"], project)
    assert proc.returncode == 0, proc.stderr

    # Skill trees
    assert (project / ".agents/skills/groundwork-orchestrator/SKILL.md").exists()
    assert (project / ".agents/skills/groundwork-orchestrator/workflow-index.md").exists()
    assert (project / ".agents/groundwork/skills/operating-contract.md").exists()
    assert (project / ".agents/groundwork/skills/groundwork-bet/instructions.md").exists()
    # Config: state seed, version stamp, user config, generators
    state = json.loads((project / ".groundwork/config/state.json").read_text())
    assert state["groundwork"]["version"] == PKG_VERSION
    assert state["completed"] == []
    assert (project / ".groundwork/config/config.toml").exists()
    assert (project / ".groundwork/config/generators.json").exists()
    assert (project / ".groundwork/cache").is_dir()
    # Agent surfaces
    assert (project / ".claude").is_symlink()
    assert "depwire" in json.loads((project / ".mcp.json").read_text())["mcpServers"]
    assert (project / "llms.txt").exists()


def test_reinit_preserves_state_and_user_config(project):
    run_cli(["init"], project)
    state_path = project / ".groundwork/config/state.json"
    state = json.loads(state_path.read_text())
    state["completed"] = ["product-brief"]
    state_path.write_text(json.dumps(state))
    config_path = project / ".groundwork/config/config.toml"
    config_path.write_text(config_path.read_text() + '\n[skills]\n"x" = "y.md"\n')

    proc = run_cli(["init"], project)
    assert proc.returncode == 0, proc.stderr
    assert json.loads(state_path.read_text())["completed"] == ["product-brief"]
    assert '"x" = "y.md"' in config_path.read_text()


def test_update_is_noop_when_current(project):
    run_cli(["init"], project)
    proc = run_cli(["update"], project)
    assert proc.returncode == 0
    assert "Already up to date" in proc.stdout


def test_update_refreshes_and_reports_drift(project):
    run_cli(["init"], project)
    mutated = project / ".agents/skills/groundwork-check/SKILL.md"
    mutated.write_text(mutated.read_text() + "\ndrift\n")
    removed = project / ".agents/groundwork/skills/groundwork-update"
    shutil.rmtree(removed)

    proc = run_cli(["update"], project)
    assert proc.returncode == 0, proc.stderr
    assert "~ groundwork-check/SKILL.md" in proc.stdout
    assert "+ groundwork-update/instructions.md" in proc.stdout
    assert mutated.read_text() == (REPO_ROOT / "src/skills/groundwork-check/SKILL.md").read_text()
    assert (removed / "instructions.md").exists()


def test_update_surfaces_migration_notes_on_version_jump(project):
    run_cli(["init"], project)
    state_path = project / ".groundwork/config/state.json"
    state = json.loads(state_path.read_text())
    state["groundwork"]["version"] = "0.1.0"
    state_path.write_text(json.dumps(state))
    # Force a file diff so update takes the full path
    (project / ".agents/skills/groundwork-check/SKILL.md").write_text("stale")

    proc = run_cli(["update"], project)
    assert proc.returncode == 0, proc.stderr
    assert f"Updating 0.1.0 → {PKG_VERSION}" in proc.stdout
    assert "What changed:" in proc.stdout
    # Re-stamped after update
    assert json.loads(state_path.read_text())["groundwork"]["version"] == PKG_VERSION


def test_update_without_install_fails_cleanly(project):
    proc = run_cli(["update"], project)
    assert proc.returncode == 1
    assert "No GroundWork installation" in proc.stdout + proc.stderr


def test_self_copy_guard(tmp_path):
    # Build a minimal package skeleton so the guard can be tested without
    # touching the real repo's .agents/.
    pkg = tmp_path / "pkg"
    (pkg / "bin").mkdir(parents=True)
    shutil.copy(CLI, pkg / "bin/groundwork.js")
    shutil.copy(REPO_ROOT / "package.json", pkg / "package.json")
    shutil.copy(REPO_ROOT / "CHANGELOG.md", pkg / "CHANGELOG.md")
    shutil.copytree(REPO_ROOT / "src" / "skills", pkg / "src" / "skills")
    shutil.copytree(REPO_ROOT / "src" / "hidden-skills", pkg / "src" / "hidden-skills")
    shutil.copytree(REPO_ROOT / "src" / "config", pkg / "src" / "config")
    # A sentinel meta-skill dir that a broken guard would delete
    sentinel = pkg / ".agents" / "skills" / "meta-skill" / "SKILL.md"
    sentinel.parent.mkdir(parents=True)
    sentinel.write_text("precious")

    proc = subprocess.run(
        ["node", str(pkg / "bin/groundwork.js"), "init"],
        cwd=pkg, capture_output=True, text=True,
    )
    assert proc.returncode == 0
    assert "source repository" in proc.stdout + proc.stderr
    assert sentinel.read_text() == "precious", "guard failed: init clobbered the source repo's .agents/"


def test_check_exit_codes(project):
    run_cli(["init"], project)
    docs = project / "docs"
    (docs / "api").mkdir(parents=True, exist_ok=True)
    (project / "services/widget").mkdir(parents=True)
    (project / "services/widget/main.go").write_text("package main")
    (docs / "api/widget.md").write_text(
        "---\ntitle: widget API\ngeneration_mode: extracted\n"
        "source_of_truth: services/widget/\nlast_reviewed: 2020-01-01\n---\n# widget\n"
    )
    git(["add", "-A"], project)
    git(["commit", "-qm", "seed"], project)

    stale = run_cli(["check"], project)
    assert stale.returncode == 1
    assert "stale" in stale.stdout.lower()
    assert "groundwork-update" in stale.stdout

    doc = docs / "api/widget.md"
    doc.write_text(doc.read_text().replace("2020-01-01", "2099-01-01"))
    current = run_cli(["check"], project)
    assert current.returncode == 0


def test_check_warns_on_version_mismatch(project):
    run_cli(["init"], project)
    (project / "docs").mkdir(exist_ok=True)
    state_path = project / ".groundwork/config/state.json"
    state = json.loads(state_path.read_text())
    state["groundwork"]["version"] = "0.1.0"
    state_path.write_text(json.dumps(state))

    proc = run_cli(["check"], project)
    out = proc.stdout + proc.stderr
    assert "0.1.0" in out
    assert "update" in out
