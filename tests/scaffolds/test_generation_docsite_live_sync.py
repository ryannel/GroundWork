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


def test_manually_removed_worktree_dir_demotes_to_branch_only(repo_with_service):
    """A worktree removed by hand (`rm -rf`, not `git worktree remove`) leaves a
    dangling entry in `git worktree list --porcelain` — the path is gone but
    git hasn't pruned the registration yet. That listed-but-missing entry must
    not cover its branch: the bet demotes to branch-only rendering on the next
    sync, exactly like a properly removed worktree, instead of vanishing
    because its (now-empty) directory read yields nothing."""
    root, service_dir = repo_with_service

    _git(["branch", "bet/manual-rm"], cwd=root)
    wt_path = root.parent / "manual-rm-wt"
    _git(["worktree", "add", str(wt_path), "bet/manual-rm"], cwd=root)
    _write_pitch(
        wt_path / "docs" / "bets" / "manual-rm" / "pitch.md",
        "Manual Rm",
        "This worktree will be rm -rf'd by hand.",
    )
    _git(["add", "-A"], cwd=wt_path)
    _git(["commit", "-q", "-m", "wip: manual rm"], cwd=wt_path)

    first = _sync(service_dir)
    assert first.returncode == 0
    live = _live_dir(root)
    assert "live" in (live / "manual-rm" / "pitch.md").read_text()

    # Manually delete the worktree directory WITHOUT `git worktree remove` —
    # `git worktree list --porcelain` keeps listing it (prunable) until
    # something runs `git worktree prune`, which this script must not do.
    shutil.rmtree(wt_path, ignore_errors=True)
    listing = _git(["worktree", "list", "--porcelain"], cwd=root).stdout
    assert "bet/manual-rm" in listing, (
        "test setup assumption: the dangling entry is still listed after rm -rf"
    )

    second = _sync(service_dir)
    assert second.returncode == 0, second.stderr
    second_pitch = (live / "manual-rm" / "pitch.md").read_text()
    assert "This worktree will be rm -rf'd by hand." in second_pitch
    assert "as of last commit" in second_pitch, (
        "a worktree removed by hand (dangling porcelain entry) must demote its "
        "bet to branch-only, not vanish it"
    )

    # Read-only toward the repo's worktree state — no `git worktree prune`.
    listing_after = _git(["worktree", "list", "--porcelain"], cwd=root).stdout
    assert "bet/manual-rm" in listing_after, (
        "sync must not prune the dangling worktree registration itself"
    )


# ---------------------------------------------------------------------------
# CRLF frontmatter — no double frontmatter block, keys preserved
# ---------------------------------------------------------------------------


def test_crlf_pitch_keeps_one_frontmatter_block(repo_with_service):
    """A pitch.md with CRLF line endings (`---\\r\\n`) must be recognized as
    already having frontmatter — falling into the no-frontmatter branch would
    prepend a SECOND `---` block, producing a malformed doc."""
    root, service_dir = repo_with_service

    _git(["branch", "bet/crlf-thing"], cwd=root)
    wt_path = root.parent / "crlf-thing-wt"
    _git(["worktree", "add", str(wt_path), "bet/crlf-thing"], cwd=root)
    pitch_path = wt_path / "docs" / "bets" / "crlf-thing" / "pitch.md"
    pitch_path.parent.mkdir(parents=True, exist_ok=True)
    pitch_path.write_bytes(
        (
            "---\r\n"
            "status: delivery\r\n"
            "---\r\n"
            "\r\n"
            "# Bet: CRLF Thing\r\n"
            "\r\n"
            "**Solution:** Solve the crlf thing.\r\n"
        ).encode("utf-8")
    )
    _git(["add", "-A"], cwd=wt_path)
    _git(["commit", "-q", "-m", "wip: crlf thing"], cwd=wt_path)

    result = _sync(service_dir)
    assert result.returncode == 0, result.stderr

    live_pitch = (_live_dir(root) / "crlf-thing" / "pitch.md").read_text()
    assert live_pitch.count("---") == 2, (
        "a CRLF pitch must end up with exactly one frontmatter block "
        f"(two `---` fences), got: {live_pitch!r}"
    )
    assert "status: delivery" in live_pitch, "original frontmatter keys must survive"
    assert "bet/crlf-thing" in live_pitch and "live" in live_pitch, (
        "badge must still be injected for a CRLF pitch"
    )

    shutil.rmtree(wt_path, ignore_errors=True)


# ---------------------------------------------------------------------------
# Author-written description — preserved, badge prepended
# ---------------------------------------------------------------------------


def test_author_description_preserved_after_badge_injection(repo_with_service):
    """When the pitch already carries a `description:` field, the badge must be
    prepended to it rather than overwriting it — the author's text must survive
    in the same description value."""
    root, service_dir = repo_with_service

    _git(["branch", "bet/keep-description"], cwd=root)
    wt_path = root.parent / "keep-description-wt"
    _git(["worktree", "add", str(wt_path), "bet/keep-description"], cwd=root)
    pitch_path = wt_path / "docs" / "bets" / "keep-description" / "pitch.md"
    pitch_path.parent.mkdir(parents=True, exist_ok=True)
    pitch_path.write_text(
        "---\n"
        "description: Author's own summary of this bet.\n"
        "status: delivery\n"
        "---\n\n"
        "# Bet: Keep Description\n\n"
        "**Solution:** Keep the author's words.\n"
    )
    _git(["add", "-A"], cwd=wt_path)
    _git(["commit", "-q", "-m", "wip: keep description"], cwd=wt_path)

    result = _sync(service_dir)
    assert result.returncode == 0, result.stderr

    live_pitch = (_live_dir(root) / "keep-description" / "pitch.md").read_text()
    assert live_pitch.count("---") == 2, "must not gain a second frontmatter block"
    assert "Author's own summary of this bet." in live_pitch, (
        "the author's description text must be preserved, not overwritten"
    )
    assert "In flight" in live_pitch and "bet/keep-description" in live_pitch, (
        "the badge line must still lead the description value"
    )
    assert "status: delivery" in live_pitch, "unrelated frontmatter keys must survive"

    shutil.rmtree(wt_path, ignore_errors=True)


# ---------------------------------------------------------------------------
# Slug collision — one warning naming both sources, existing precedence kept
# ---------------------------------------------------------------------------


def test_slug_collision_warns_naming_both_sources(repo_with_service):
    """Two worktrees whose docs/bets/ dirs share a slug must not silently
    last-write-wins each other — one console.warn line names both branches so
    the loss is visible, while the existing precedence (later-enumerated
    source wins on disk) is unchanged."""
    root, service_dir = repo_with_service

    _git(["branch", "bet/collide-a"], cwd=root)
    wt_a = root.parent / "collide-a-wt"
    _git(["worktree", "add", str(wt_a), "bet/collide-a"], cwd=root)
    _write_pitch(
        wt_a / "docs" / "bets" / "collide" / "pitch.md",
        "Collide A",
        "From worktree A.",
    )
    _git(["add", "-A"], cwd=wt_a)
    _git(["commit", "-q", "-m", "wip: collide a"], cwd=wt_a)

    _git(["branch", "bet/collide-b"], cwd=root)
    wt_b = root.parent / "collide-b-wt"
    _git(["worktree", "add", str(wt_b), "bet/collide-b"], cwd=root)
    _write_pitch(
        wt_b / "docs" / "bets" / "collide" / "pitch.md",
        "Collide B",
        "From worktree B.",
    )
    _git(["add", "-A"], cwd=wt_b)
    _git(["commit", "-q", "-m", "wip: collide b"], cwd=wt_b)

    result = _sync(service_dir)
    assert result.returncode == 0, result.stderr
    assert "slug collision" in result.stdout + result.stderr
    assert "bet/collide-a" in result.stdout + result.stderr
    assert "bet/collide-b" in result.stdout + result.stderr

    live = _live_dir(root)
    # Exactly one materialized copy — no crash, no split content.
    assert (live / "collide").exists()
    meta = json.loads((live / "meta.json").read_text())
    collide_entries = [b for b in meta["bets"] if b["slug"] == "collide"]
    assert len(collide_entries) == 1, "meta.json must not list a dropped collision source"

    shutil.rmtree(wt_a, ignore_errors=True)
    shutil.rmtree(wt_b, ignore_errors=True)


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
