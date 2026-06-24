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


def test_non_cli_registry_entry_is_ignored(project, tmp_path):
    """The registry is cli-only now. A stray non-cli entry is skipped — never run,
    never queued into a brief, never recorded. Structural/judgment advancement lives
    in the groundwork-update skill's reconcile pass, not the migration registry."""
    mig = make_registry(
        tmp_path,
        [{"id": "gw-test-stray", "version": "99.0.0", "title": "Stray", "kind": "agent", "summary": "x"}],
    )
    proc = run_cli(["update"], project, migrations_dir=mig)
    assert proc.returncode == 0, proc.stderr
    # No brief is written for a non-cli entry …
    assert not (project / ".groundwork/cache/upgrade-brief.json").exists()
    # … and it is never recorded as a completed migration.
    state = json.loads((project / ".groundwork/config/state.json").read_text())
    assert "gw-test-stray" not in state["groundwork"].get("migrations", [])


def _seed_precutover_brief(project, extra_items=None):
    """Write a brief shaped like one left by a pre-retirement (agent-migration)
    update, plus its staged payload dir."""
    cache = project / ".groundwork/cache"
    staged = cache / "upgrade/briefs"
    staged.mkdir(parents=True, exist_ok=True)
    (staged / "gw-legacy-thing.md").write_text("# legacy brief\n## Detect\nx\n")
    items = [{
        "type": "agent-migration", "id": "gw-legacy-thing",
        "title": "Legacy", "summary": "x",
        "brief": ".groundwork/cache/upgrade/briefs/gw-legacy-thing.md",
        "status": "pending",
    }]
    items += extra_items or []
    (cache / "upgrade-brief.json").write_text(json.dumps(
        {"brief_version": 1, "from": "0.9.0", "to": "0.9.0", "items": items}
    ))


def test_precutover_brief_with_only_agent_items_is_removed(project):
    """A leftover brief whose only items are retired agent-migrations is pruned to
    nothing and deleted — the skill never sees a type it cannot run. This exercises
    the `total == 0` path (a fresh init has no other update work)."""
    _seed_precutover_brief(project)

    proc = run_cli(["update"], project)
    assert proc.returncode == 0, proc.stderr
    assert not (project / ".groundwork/cache/upgrade-brief.json").exists(), \
        "stale agent-migration brief should be deleted"
    assert not (project / ".groundwork/cache/upgrade/briefs").exists(), \
        "orphaned briefs/ payload cache should be cleared"


def test_precutover_brief_keeps_supported_items_drops_agent_items(project, tmp_path):
    """When a leftover brief mixes a retired agent-migration with a still-supported
    item, the agent item is dropped and the supported one survives."""
    _seed_precutover_brief(project, extra_items=[{
        "type": "tier2-merge", "id": "tier2:llms.txt", "path": "llms.txt",
        "incoming": ".groundwork/cache/upgrade/tier2/llms.txt",
        "base_hash": None, "summary": "merge", "status": "pending",
    }])

    # A no-op registry so update does no migration work; the brief merge still runs.
    mig = make_registry(tmp_path, [])
    proc = run_cli(["update"], project, migrations_dir=mig)
    assert proc.returncode == 0, proc.stderr

    brief = json.loads((project / ".groundwork/cache/upgrade-brief.json").read_text())
    ids = {i["id"] for i in brief["items"]}
    assert "tier2:llms.txt" in ids, "supported item must survive the prune"
    assert "gw-legacy-thing" not in ids, "retired agent-migration item must be pruned"
    assert not (project / ".groundwork/cache/upgrade/briefs").exists()


def test_dry_run_lists_the_plan_and_mutates_nothing(project, tmp_path):
    mig = make_registry(
        tmp_path,
        [{"id": "gw-test-marker", "version": "99.0.0", "title": "Write marker", "kind": "cli", "summary": "t"}],
        modules={"gw-test-marker": MARKER_MIGRATION},
    )
    # Make multiple lanes show up in the plan: a scripted migration, an edited tier-2
    # file (judgment lane), and a deleted skill (clean-replace diff).
    edited = project / "docs/principles/index.md"
    edited.write_text(edited.read_text() + "\nuser edit\n")
    import shutil as _shutil
    _shutil.rmtree(project / ".groundwork/skills/groundwork-update")

    before = tree_hash(project)
    proc = run_cli(["update", "--dry-run"], project, migrations_dir=mig)
    assert proc.returncode == 0, proc.stderr
    assert tree_hash(project) == before, "--dry-run wrote something"

    out = proc.stdout
    assert "Dry run" in out
    assert "gw-test-marker" in out          # scripted migration
    assert "groundwork-update/instructions.md" in out  # skill diff
