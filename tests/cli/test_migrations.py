"""Migration-runner contract tests (upgrade-path plan B2/B4/C3).

These exercise the runner with a synthetic registry via GROUNDWORK_MIGRATIONS_DIR
(the documented test seam in migrations/README.md), so they pin runner semantics —
run-once, record, failure stops the stamp, dry-run mutates nothing — independent
of whichever real migrations the package ships.
"""

import hashlib
import json
import os
import subprocess
import textwrap
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"
PKG_VERSION = json.loads((REPO_ROOT / "package.json").read_text())["version"]


def run_cli(args, cwd, migrations_dir=None):
    env = dict(os.environ)
    if migrations_dir is not None:
        env["GROUNDWORK_MIGRATIONS_DIR"] = str(migrations_dir)
    return subprocess.run(
        ["node", str(CLI), *args], cwd=cwd, capture_output=True, text=True, env=env
    )


def tree_hash(root: Path) -> str:
    """Content hash of every file under root (symlink targets, not follows)."""
    h = hashlib.sha256()
    for f in sorted(root.rglob("*")):
        if f.is_symlink():
            h.update(str(f.relative_to(root)).encode() + os.readlink(f).encode())
        elif f.is_file():
            h.update(str(f.relative_to(root)).encode() + f.read_bytes())
    return h.hexdigest()


@pytest.fixture()
def project(tmp_path):
    subprocess.run(["git", "init", "-q"], cwd=tmp_path / ".", check=True)
    proc = run_cli(["init"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    return tmp_path


def make_registry(tmp_path, entries, modules=None, briefs=None):
    mig = tmp_path / "migrations"
    mig.mkdir()
    (mig / "index.json").write_text(json.dumps({"migrations": entries}))
    for name, body in (modules or {}).items():
        (mig / f"{name}.js").write_text(body)
    for name, body in (briefs or {}).items():
        (mig / name).mkdir()
        (mig / name / "brief.md").write_text(body)
    return mig


MARKER_MIGRATION = textwrap.dedent("""
    const fs = require('fs'); const path = require('path');
    module.exports = {
      detect({ targetDir }) {
        return fs.existsSync(path.join(targetDir, '.groundwork', 'marker.txt')) ? 'done' : 'pending';
      },
      run({ targetDir }) {
        fs.writeFileSync(path.join(targetDir, '.groundwork', 'marker.txt'), 'migrated');
      },
    };
""")

FAILING_MIGRATION = textwrap.dedent("""
    module.exports = {
      detect() { return 'pending'; },
      run() { throw new Error('boom'); },
    };
""")

# The C3 pattern: additive config.toml healing — insert a missing key with its
# default and a comment, never touching existing lines.
CONFIG_KEY_MIGRATION = textwrap.dedent("""
    const fs = require('fs'); const path = require('path');
    const KEY = 'review_quorum';
    function configPath(targetDir) {
      return path.join(targetDir, '.groundwork', 'config', 'config.toml');
    }
    module.exports = {
      detect({ targetDir }) {
        const p = configPath(targetDir);
        if (!fs.existsSync(p)) return 'n/a';
        return fs.readFileSync(p, 'utf8').includes(KEY) ? 'done' : 'pending';
      },
      run({ targetDir }) {
        const p = configPath(targetDir);
        const existing = fs.readFileSync(p, 'utf8');
        fs.writeFileSync(p, existing + '\\n# Added by gw-test-config-key (default).\\n' + KEY + ' = 2\\n');
      },
    };
""")


def test_pending_migration_runs_once_and_is_recorded(project, tmp_path):
    mig = make_registry(
        tmp_path,
        [{"id": "gw-test-marker", "version": "99.0.0", "title": "Write marker", "kind": "cli", "summary": "t"}],
        modules={"gw-test-marker": MARKER_MIGRATION},
    )
    proc = run_cli(["update"], project, migrations_dir=mig)
    assert proc.returncode == 0, proc.stderr
    assert "gw-test-marker" in proc.stdout
    assert (project / ".groundwork/marker.txt").read_text() == "migrated"
    state = json.loads((project / ".groundwork/config/state.json").read_text())
    assert "gw-test-marker" in state["groundwork"]["migrations"]

    # Second update: recorded, not re-run (delete the marker to prove it).
    (project / ".groundwork/marker.txt").unlink()
    proc = run_cli(["update"], project, migrations_dir=mig)
    assert proc.returncode == 0
    assert not (project / ".groundwork/marker.txt").exists()


def test_failed_migration_stops_the_stamp(project, tmp_path):
    mig = make_registry(
        tmp_path,
        [
            {"id": "gw-test-marker", "version": "99.0.0", "title": "Write marker", "kind": "cli", "summary": "t"},
            {"id": "gw-test-boom", "version": "99.0.0", "title": "Fail", "kind": "cli", "summary": "t"},
        ],
        modules={"gw-test-marker": MARKER_MIGRATION, "gw-test-boom": FAILING_MIGRATION},
    )
    state_path = project / ".groundwork/config/state.json"
    state = json.loads(state_path.read_text())
    state["groundwork"]["version"] = "0.1.0"
    state_path.write_text(json.dumps(state))

    proc = run_cli(["update"], project, migrations_dir=mig)
    assert proc.returncode == 1
    assert "gw-test-boom failed" in proc.stdout + proc.stderr

    state = json.loads(state_path.read_text())
    # The migration before the failure completed and is recorded …
    assert "gw-test-marker" in state["groundwork"]["migrations"]
    assert "gw-test-boom" not in state["groundwork"]["migrations"]
    # … and the stamp did not advance past the failure.
    assert state["groundwork"]["version"] == "0.1.0"

    # The fix-and-retry path: idempotent migrations make the re-run safe.
    (mig / "gw-test-boom.js").write_text(MARKER_MIGRATION.replace("marker.txt", "boom.txt"))
    proc = run_cli(["update"], project, migrations_dir=mig)
    assert proc.returncode == 0
    state = json.loads(state_path.read_text())
    assert "gw-test-boom" in state["groundwork"]["migrations"]
    assert state["groundwork"]["version"] == PKG_VERSION


def test_config_toml_healing_is_additive_only(project, tmp_path):
    """The C3 contract: a new required key arrives as a cli migration that appends
    the key with a comment — existing keys, order, and formatting untouched."""
    config_path = project / ".groundwork/config/config.toml"
    config_path.write_text(config_path.read_text() + '\n[skills]\n"my-skill" = "custom/path.md"\n')
    before = config_path.read_text()

    mig = make_registry(
        tmp_path,
        [{"id": "gw-test-config-key", "version": "99.0.0", "title": "Add review_quorum", "kind": "cli", "summary": "t"}],
        modules={"gw-test-config-key": CONFIG_KEY_MIGRATION},
    )
    proc = run_cli(["update"], project, migrations_dir=mig)
    assert proc.returncode == 0, proc.stderr

    after = config_path.read_text()
    assert after.startswith(before), "existing config content was reordered or rewritten"
    assert "review_quorum = 2" in after


def test_agent_migration_is_queued_with_staged_brief(project, tmp_path):
    mig = make_registry(
        tmp_path,
        [{"id": "gw-test-judgment", "version": "99.0.0", "title": "Judge", "kind": "agent", "summary": "needs eyes"}],
        briefs={"gw-test-judgment": "# brief\n## Detect\nx\n## Transform\ny\n## Accept\nz\n"},
    )
    proc = run_cli(["update"], project, migrations_dir=mig)
    assert proc.returncode == 0, proc.stderr
    assert "1 item(s) need a working session" in proc.stdout

    brief = json.loads((project / ".groundwork/cache/upgrade-brief.json").read_text())
    (item,) = brief["items"]
    assert item["id"] == "gw-test-judgment"
    assert item["status"] == "pending"
    staged = project / item["brief"]
    assert staged.read_text().startswith("# brief")
    # Not recorded as done — only the upgrade skill records agent migrations.
    state = json.loads((project / ".groundwork/config/state.json").read_text())
    assert "gw-test-judgment" not in state["groundwork"].get("migrations", [])


def test_dry_run_lists_the_plan_and_mutates_nothing(project, tmp_path):
    mig = make_registry(
        tmp_path,
        [
            {"id": "gw-test-marker", "version": "99.0.0", "title": "Write marker", "kind": "cli", "summary": "t"},
            {"id": "gw-test-judgment", "version": "99.0.0", "title": "Judge", "kind": "agent", "summary": "needs eyes"},
        ],
        modules={"gw-test-marker": MARKER_MIGRATION},
        briefs={"gw-test-judgment": "# brief\n"},
    )
    # Make every lane show up in the plan: an edited tier-2 file and a deleted skill.
    edited = project / "docs/principles/index.md"
    edited.write_text(edited.read_text() + "\nuser edit\n")
    import shutil as _shutil
    _shutil.rmtree(project / ".agents/groundwork/skills/groundwork-update")

    before = tree_hash(project)
    proc = run_cli(["update", "--dry-run"], project, migrations_dir=mig)
    assert proc.returncode == 0, proc.stderr
    assert tree_hash(project) == before, "--dry-run wrote something"

    out = proc.stdout
    assert "Dry run" in out
    assert "gw-test-marker" in out          # scripted migration
    assert "gw-test-judgment" in out        # judgment-lane item
    assert "groundwork-update/instructions.md" in out  # skill diff
