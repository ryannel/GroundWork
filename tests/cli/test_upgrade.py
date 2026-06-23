"""Upgrade-path contract tests (upgrade-path plan H2).

Each test copies a frozen old-install fixture (tests/fixtures/installs/ — see its
README for provenance) and runs the CURRENT CLI's update against it. The invariants:

- Convergence: after update, every tier-1 file is byte-identical to a fresh init.
- Preservation: user edits, config, project docs, and state survive byte-identical.
- Idempotency: a second update changes nothing (tree hash) and re-runs no migrations.
- Detect-honesty: every shipped migration detects done/n-a on a fresh init.
"""

import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"
FIXTURES = REPO_ROOT / "tests" / "fixtures" / "installs"
PKG_VERSION = json.loads((REPO_ROOT / "package.json").read_text())["version"]
PKG_BUNDLE = REPO_ROOT / "src/generators/workspace-dev-cli/cli-src/dist/dev-bundle.js"

LABELS = ["pre-0.9", "0.9-pre-surfaces", "pre-0.9-edited", "0.9-pre-surfaces-edited"]


def run_cli(args, cwd):
    return subprocess.run(
        ["node", str(CLI), *args], cwd=cwd, capture_output=True, text=True
    )


def seed(label: str, tmp_path: Path) -> Path:
    dest = tmp_path / label
    shutil.copytree(FIXTURES / label, dest, symlinks=True)
    return dest


def tree_hash(root: Path) -> str:
    h = hashlib.sha256()
    for f in sorted(root.rglob("*")):
        if f.is_symlink():
            h.update(str(f.relative_to(root)).encode() + os.readlink(f).encode())
        elif f.is_file():
            h.update(str(f.relative_to(root)).encode() + f.read_bytes())
    return h.hexdigest()


def dir_bytes(root: Path) -> dict:
    return {
        str(f.relative_to(root)): hashlib.sha256(f.read_bytes()).hexdigest()
        for f in sorted(root.rglob("*"))
        if f.is_file()
    }


@pytest.fixture(scope="module")
def fresh_init(tmp_path_factory):
    project = tmp_path_factory.mktemp("fresh")
    proc = run_cli(["init"], project)
    assert proc.returncode == 0, proc.stderr
    return project


@pytest.mark.parametrize("label", LABELS)
def test_convergence_tier1_matches_fresh_init(label, tmp_path, fresh_init):
    project = seed(label, tmp_path)
    proc = run_cli(["update"], project)
    assert proc.returncode == 0, proc.stderr

    for tree in (".agents/skills", ".groundwork/skills"):
        assert dir_bytes(project / tree) == dir_bytes(fresh_init / tree), (
            f"{label}: {tree} did not converge to the current package"
        )
    # The pre-relocation hidden tree is removed by the gw-relocate-hidden-skills migration.
    assert not (project / ".agents/groundwork").exists(), (
        f"{label}: stale .agents/groundwork/ tree survived the update"
    )
    state = json.loads((project / ".groundwork/config/state.json").read_text())
    assert state["groundwork"]["version"] == PKG_VERSION
    assert (project / ".groundwork/config/manifest.json").exists()


@pytest.mark.skipif(
    not PKG_BUNDLE.exists(),
    reason="dev-bundle not built (gitignored artifact) — run `npm run build:dev-cli`; "
    "the ./dev test harness builds it automatically before pytest",
)
def test_convergence_dev_bundle_replaced(tmp_path):
    project = seed("0.9-pre-surfaces", tmp_path)
    old = (project / ".dev/dev-bundle.js").read_bytes()
    assert old != PKG_BUNDLE.read_bytes(), "fixture bundle should predate the current one"

    proc = run_cli(["update"], project)
    assert proc.returncode == 0, proc.stderr
    assert (project / ".dev/dev-bundle.js").read_bytes() == PKG_BUNDLE.read_bytes()
    assert "dev-bundle.js" in proc.stdout
    # dev.config.json (tier 3, projected from brand tokens) is never touched.
    assert json.loads((project / ".dev/dev.config.json").read_text())["projectPrefix"] == "acme"


@pytest.mark.parametrize("label", ["pre-0.9-edited", "0.9-pre-surfaces-edited"])
def test_preservation_user_content_survives(label, tmp_path):
    project = seed(label, tmp_path)
    keep = {
        rel: (project / rel).read_bytes()
        for rel in [
            "docs/principles/index.md",      # user-edited tier-2
            "docs/architecture.md",          # project doc, pre-restructure shape
            "docs/bets/checkout-flow/pitch.md",
        ]
        if (project / rel).exists()
    }
    if label == "pre-0.9-edited":
        keep["docs/ux-design.md"] = (project / "docs/ux-design.md").read_bytes()

    proc = run_cli(["update"], project)
    assert proc.returncode == 0, proc.stderr

    for rel, before in keep.items():
        assert (project / rel).read_bytes() == before, f"{label}: update touched {rel}"

    # The edited tier-2 file landed in the judgment lane instead of being clobbered
    # (only when the framework actually moved past its base — pre-manifest installs
    # have unknown ancestry, so the edited file always queues).
    brief = json.loads((project / ".groundwork/cache/upgrade-brief.json").read_text())
    ids = {i["id"] for i in brief["items"]}
    assert "tier2:docs/principles/index.md" in ids


def test_pre09_fixture_gets_exactly_the_pending_cli_migrations(tmp_path):
    project = seed("pre-0.9", tmp_path)
    assert not (project / ".groundwork/config/config.toml").exists()

    proc = run_cli(["update"], project)
    assert proc.returncode == 0, proc.stderr
    # config.toml was never seeded by old installs — the migration heals it.
    assert (project / ".groundwork/config/config.toml").exists()
    state = json.loads((project / ".groundwork/config/state.json").read_text())
    recorded = state["groundwork"]["migrations"]
    assert "gw-seed-config-toml" in recorded
    # This fixture's .mcp.json still carries the retired depwire server — the swap migration
    # runs, removes it, and registers Serena.
    assert "gw-register-serena-mcp" in recorded
    mcp_servers = json.loads((project / ".mcp.json").read_text())["mcpServers"]
    assert "serena" in mcp_servers and "depwire" not in mcp_servers
    # Agent migrations are not recorded by the CLI; they queue in the brief.
    brief = json.loads((project / ".groundwork/cache/upgrade-brief.json").read_text())
    ids = {i["id"] for i in brief["items"]}
    assert {"gw-design-system-rename", "gw-surfaces-registry-bootstrap"} <= ids


@pytest.mark.parametrize("label", LABELS)
def test_idempotency_second_update_is_a_noop(label, tmp_path):
    project = seed(label, tmp_path)
    proc = run_cli(["update"], project)
    assert proc.returncode == 0, proc.stderr

    before = tree_hash(project)
    state_before = (project / ".groundwork/config/state.json").read_text()
    proc = run_cli(["update"], project)
    assert proc.returncode == 0, proc.stderr
    assert tree_hash(project) == before, f"{label}: second update changed the tree"
    assert (project / ".groundwork/config/state.json").read_text() == state_before


def test_detect_honesty_on_fresh_init(fresh_init):
    """Every shipped migration must answer done/n-a on a fresh install — and init
    records the whole registry so update never queues delivered catch-up work."""
    state = json.loads((fresh_init / ".groundwork/config/state.json").read_text())
    index = json.loads((REPO_ROOT / "migrations/index.json").read_text())
    all_ids = {e["id"] for e in index["migrations"]}
    assert all_ids <= set(state["groundwork"]["migrations"])

    cli_ids = [e["id"] for e in index["migrations"] if e["kind"] == "cli"]
    script = """
const path = require('path');
for (const id of %s) {
  const mod = require(path.join(%r, id + '.js'));
  const verdict = mod.detect({ targetDir: %r, packageRoot: %r });
  if (verdict === 'pending') throw new Error(id + ' reports pending on a fresh init');
}
console.log('ok');
""" % (json.dumps(cli_ids), str(REPO_ROOT / "migrations"), str(fresh_init), str(REPO_ROOT))
    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    assert proc.returncode == 0, proc.stderr

    # No judgment-lane work on a fresh install either.
    assert not (fresh_init / ".groundwork/cache/upgrade-brief.json").exists()


def test_fail_closed_copy_error_does_not_advance_stamp(tmp_path):
    """A copy failure mid-update aborts before the stamp and manifest advance —
    a partial apply must read as "update failed, re-run", never as a clean update
    whose half-copied files classify as user edits on the next run."""
    project = seed("0.9-pre-surfaces", tmp_path)
    state_before = (project / ".groundwork/config/state.json").read_bytes()

    # Read-only on the whole tree — dirs (no unlink/create of entries) AND
    # files (no overwrite) — so the clean-copy fails with EACCES. The top dir
    # alone is not enough: cp -R happily overwrites writable files deeper in.
    skills_dir = project / ".agents/skills"
    tree = [skills_dir, *skills_dir.rglob("*")]
    for f in tree:
        f.chmod(0o555 if f.is_dir() else 0o444)
    try:
        proc = run_cli(["update"], project)
    finally:
        for f in tree:
            f.chmod(0o755 if f.is_dir() else 0o644)

    assert proc.returncode != 0, "update must exit non-zero on a copy failure"
    assert "Aborted" in proc.stderr
    assert (project / ".groundwork/config/state.json").read_bytes() == state_before, (
        "state.json (stamp, migrations) must not advance past a failed apply"
    )
