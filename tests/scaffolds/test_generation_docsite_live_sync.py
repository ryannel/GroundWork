"""
Layer 1 — Generation Correctness Tests: docs-site live-bets sync script

user-legibility plan, Wave 3, slice C1 — "the docsite becomes the live window".

This is a FUNCTIONAL test of the generated sync script itself
(src/generators/docs-site/files/scripts/sync-live-bets.js), not a structural
generator test (that half lives in test_generation.py's
test_docs_site_generation: the script exists, is wired as predev/prebuild, and
docs/bets/.gitignore is seeded).

Runs the actual script (`node scripts/sync-live-bets.js`) against a synthetic
git repo built from scratch — no dependency on the groundwork-method package
build, since the script is self-contained (Node built-ins only) exactly as it
ships into a generated project. Proves the plan's C1 acceptance:

  - a repo with one archived bet, one worktree bet, and one branch-only bet
    materializes the two in-flight bets into docs/bets/_live/<slug>/, correctly
    badged, and leaves the archived bet alone (it is already inside the
    watched tree — no duplication);
  - deleting the worktree demotes that bet to branch-only rendering on the next
    sync, without error;
  - a fully-vanished source's stale _live/ content does not survive a
    re-sync (full regenerate discipline, mirroring lib/bet-status's
    write-whole approach).

No Nx, no fumadocs, no Next.js involved — this exercises exactly the script's
own git-plumbing and file-materialization logic, which is unaffected by whether
it runs inside a real Next.js service. That keeps this in the fast Generation
tier: no compilation, no boot.
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
SYNC_SCRIPT = (
    REPO_ROOT / "src" / "generators" / "docs-site" / "files" / "scripts" / "sync-live-bets.js"
)
SANDBOX_BASE = REPO_ROOT / ".sandboxes" / "scaffolds" / "generation-docsite-live-sync"


def _run(cmd, cwd, check=True):
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if check and result.returncode != 0:
        raise AssertionError(
            f"command failed: {cmd}\ncwd: {cwd}\nstdout: {result.stdout}\nstderr: {result.stderr}"
        )
    return result


def _git(args, cwd):
    return _run(["git", *args], cwd=cwd)


def _write_pitch(path: Path, title: str, solution: str, status: str = "delivery"):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f"---\nstatus: {status}\n---\n\n"
        f"# Bet: {title}\n\n"
        f"**Problem:** placeholder problem.\n\n"
        f"**Solution:** {solution}\n"
    )


@pytest.fixture()
def repo_with_service(tmp_path_factory):
    """A synthetic main checkout with a docs-site service directory two levels
    below the repo root (services/docs/scripts/sync-live-bets.js), an archived
    bet, an initial commit, and git config so commits succeed in CI."""
    root = tmp_path_factory.mktemp("live-sync-repo")
    _git(["init", "-q"], cwd=root)
    _git(["config", "user.email", "test@example.com"], cwd=root)
    _git(["config", "user.name", "Test"], cwd=root)

    # Archived bet — already inside the watched tree; sync must not touch it.
    _write_pitch(
        root / "docs" / "bets" / "_archive" / "shipped-thing" / "pitch.md",
        "Shipped Thing",
        "Ship the thing.",
    )

    # The service directory the sync script runs from: services/docs/scripts/.
    service_dir = root / "services" / "docs"
    scripts_dir = service_dir / "scripts"
    scripts_dir.mkdir(parents=True)
    shutil.copy(SYNC_SCRIPT, scripts_dir / "sync-live-bets.js")

    (root / "README.md").write_text("synthetic repo for sync-live-bets tests\n")
    _git(["add", "-A"], cwd=root)
    _git(["commit", "-q", "-m", "initial"], cwd=root)

    yield root, service_dir
    shutil.rmtree(root, ignore_errors=True)


def _sync(service_dir: Path):
    return _run(["node", "scripts/sync-live-bets.js"], cwd=service_dir)


def _live_dir(root: Path) -> Path:
    return root / "docs" / "bets" / "_live"


# ---------------------------------------------------------------------------
# No git / nothing to sync — graceful degradation
# ---------------------------------------------------------------------------


def test_no_bets_writes_nothing_and_exits_zero(repo_with_service):
    root, service_dir = repo_with_service
    result = _sync(service_dir)
    assert result.returncode == 0
    assert not _live_dir(root).exists(), "no in-flight bets — _live/ must not be created"


def test_not_a_git_repo_exits_zero(tmp_path):
    scripts_dir = tmp_path / "services" / "docs" / "scripts"
    scripts_dir.mkdir(parents=True)
    shutil.copy(SYNC_SCRIPT, scripts_dir / "sync-live-bets.js")
    result = subprocess.run(
        ["node", "scripts/sync-live-bets.js"], cwd=scripts_dir.parent, capture_output=True, text=True
    )
    assert result.returncode == 0
    assert "not a git repository" in result.stdout


# ---------------------------------------------------------------------------
# Three-source acceptance: archived + worktree + branch-only (plan §4 C1)
# ---------------------------------------------------------------------------


def test_three_source_aggregation_badged_correctly(repo_with_service):
    root, service_dir = repo_with_service

    # Worktree bet: a real git worktree on branch bet/worktree-thing.
    _git(["branch", "bet/worktree-thing"], cwd=root)
    wt_path = root.parent / "worktree-thing-wt"
    _git(["worktree", "add", str(wt_path), "bet/worktree-thing"], cwd=root)
    _write_pitch(
        wt_path / "docs" / "bets" / "worktree-thing" / "pitch.md",
        "Worktree Thing",
        "Build the worktree thing.",
    )
    # Commit inside the worktree so `git show`/ls-tree would also see it if this
    # became branch-only later (not required for the worktree-live path itself,
    # which reads the working tree directly).
    _git(["add", "-A"], cwd=wt_path)
    _git(["commit", "-q", "-m", "wip: worktree thing"], cwd=wt_path)

    # Branch-only bet: a bet/ branch with no worktree, committed via a temp
    # checkout then removed (leaving only the branch ref).
    tmp_checkout = root.parent / "tmp-branch-checkout"
    _git(["worktree", "add", str(tmp_checkout), "-b", "bet/branch-only-thing"], cwd=root)
    _write_pitch(
        tmp_checkout / "docs" / "bets" / "branch-only-thing" / "pitch.md",
        "Branch Only Thing",
        "Ship the branch-only thing.",
    )
    _git(["add", "-A"], cwd=tmp_checkout)
    _git(["commit", "-q", "-m", "wip: branch-only thing"], cwd=tmp_checkout)
    _git(["worktree", "remove", "--force", str(tmp_checkout)], cwd=root)

    result = _sync(service_dir)
    assert result.returncode == 0, result.stderr
    assert "materialized 2" in result.stdout

    live = _live_dir(root)
    assert live.exists()

    # Archived bet is untouched / not duplicated into _live/.
    assert not (live / "shipped-thing").exists(), "archived bet must not be duplicated into _live/"

    # Worktree bet materialized with its pitch content.
    wt_pitch = live / "worktree-thing" / "pitch.md"
    assert wt_pitch.exists()
    wt_text = wt_pitch.read_text()
    assert "Build the worktree thing." in wt_text
    assert "bet/worktree-thing" in wt_text and "live" in wt_text, (
        "worktree bet must badge with its branch and 'live' freshness"
    )

    # Branch-only bet materialized via `git show`.
    bo_pitch = live / "branch-only-thing" / "pitch.md"
    assert bo_pitch.exists()
    bo_text = bo_pitch.read_text()
    assert "Ship the branch-only thing." in bo_text
    assert "bet/branch-only-thing" in bo_text and "as of last commit" in bo_text, (
        "branch-only bet must badge with its branch and 'as of last commit' freshness"
    )

    # meta.json carries both entries for sidebar grouping.
    meta = json.loads((live / "meta.json").read_text())
    slugs = {b["slug"] for b in meta["bets"]}
    assert slugs == {"worktree-thing", "branch-only-thing"}
    by_slug = {b["slug"]: b for b in meta["bets"]}
    assert by_slug["worktree-thing"]["freshness"] == "live"
    assert by_slug["branch-only-thing"]["freshness"] == "as of last commit"

    shutil.rmtree(wt_path, ignore_errors=True)


# ---------------------------------------------------------------------------
# Demotion: deleting a worktree drops to branch-only rendering, no error
# ---------------------------------------------------------------------------


def test_deleted_worktree_demotes_to_branch_only_without_error(repo_with_service):
    root, service_dir = repo_with_service

    _git(["branch", "bet/demote-me"], cwd=root)
    wt_path = root.parent / "demote-me-wt"
    _git(["worktree", "add", str(wt_path), "bet/demote-me"], cwd=root)
    _write_pitch(
        wt_path / "docs" / "bets" / "demote-me" / "pitch.md",
        "Demote Me",
        "This bet will lose its worktree.",
    )
    _git(["add", "-A"], cwd=wt_path)
    _git(["commit", "-q", "-m", "wip: demote me"], cwd=wt_path)

    first = _sync(service_dir)
    assert first.returncode == 0
    live = _live_dir(root)
    first_pitch = (live / "demote-me" / "pitch.md").read_text()
    assert "live" in first_pitch

    # Remove the worktree — the branch itself still exists.
    _git(["worktree", "remove", "--force", str(wt_path)], cwd=root)

    second = _sync(service_dir)
    assert second.returncode == 0, second.stderr
    second_pitch = (live / "demote-me" / "pitch.md").read_text()
    assert "This bet will lose its worktree." in second_pitch
    assert "as of last commit" in second_pitch, (
        "a bet whose worktree vanished must demote to branch-only badging, not error"
    )


def test_deleted_worktree_and_branch_removes_stale_live_content(repo_with_service):
    """Full regenerate discipline: when a bet's worktree AND its branch are both
    gone, its stale _live/ content must not survive the next sync (mirrors
    lib/bet-status's whole-regeneration approach — never patched)."""
    root, service_dir = repo_with_service

    _git(["branch", "bet/vanish-me"], cwd=root)
    wt_path = root.parent / "vanish-me-wt"
    _git(["worktree", "add", str(wt_path), "bet/vanish-me"], cwd=root)
    _write_pitch(
        wt_path / "docs" / "bets" / "vanish-me" / "pitch.md",
        "Vanish Me",
        "This bet will disappear entirely.",
    )
    _git(["add", "-A"], cwd=wt_path)
    _git(["commit", "-q", "-m", "wip: vanish me"], cwd=wt_path)

    first = _sync(service_dir)
    assert first.returncode == 0
    live = _live_dir(root)
    assert (live / "vanish-me").exists()

    _git(["worktree", "remove", "--force", str(wt_path)], cwd=root)
    _git(["branch", "-D", "bet/vanish-me"], cwd=root)

    second = _sync(service_dir)
    assert second.returncode == 0, second.stderr
    assert not (live / "vanish-me").exists(), (
        "a bet with no remaining source (no worktree, no branch) must not "
        "survive in _live/ after a re-sync"
    )
