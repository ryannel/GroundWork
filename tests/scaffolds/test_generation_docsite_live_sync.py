"""
Layer 1 — Generation Correctness Tests: docs-site live-bets sync script

user-legibility plan, Wave 3, slice C1 — "the docsite becomes the live window".
review-throughput plan, Wave 3a, slices C2/C3 — the window stays live (--watch
fingerprint + loop, mirror-banner plumbing, collision visibility) and gains the
program-level "In flight" dashboard (docs/bets/_live/index.md) plus the
`_live`-first docs/bets/meta.json seed.

This is a FUNCTIONAL test of the generated sync script itself
(src/generators/docs-site/files/scripts/sync-live-bets.js), not a structural
generator test (that half lives in test_generation.py's
test_docs_site_generation: the script exists, is wired as predev/prebuild, and
docs/bets/.gitignore is seeded). The C2 structural additions that have no
sync-script behavior of their own (the page.tsx banner branch, the dev.js
wrapper, the package.json `dev` script) are asserted against the generator's
template files directly at the end of this file.

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
    write-whole approach);

and the C2/C3 acceptance:

  - the --watch fingerprint flips on a worktree docs/bets edit and on a bet
    branch advance, and is stable otherwise;
  - a bounded --watch run (short SYNC_LIVE_BETS_INTERVAL_MS) picks up a
    worktree pitch edit without a restart;
  - a forced slug collision is recorded in _live/meta.json `collisions`;
  - the dashboard lists all three sources (worktree, branch-only, checkout-
    resident quick bet) with correct cells, only-existing links, and per-source
    "waiting on you" counts; no in-flight work → no index.md;
  - an absent docs/bets/meta.json is created with `_live` first; an existing
    one is never touched.

No Nx, no fumadocs, no Next.js involved — this exercises exactly the script's
own git-plumbing and file-materialization logic, which is unaffected by whether
it runs inside a real Next.js service. That keeps this in the fast Generation
tier: no compilation, no boot.
"""

import json
import os
import shutil
import subprocess
import time
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

    # C2d: the collision is recorded in meta.json so the mirror banner can flag
    # the affected page — one entry naming the kept and dropped sources, the
    # kept one matching the branch whose files actually won on disk.
    collisions = meta.get("collisions")
    assert collisions is not None, "meta.json must carry a `collisions` list"
    assert len(collisions) == 1, f"expected exactly one recorded collision, got {collisions}"
    entry = collisions[0]
    assert entry["slug"] == "collide"
    assert {entry["kept"], entry["dropped"]} == {"bet/collide-a", "bet/collide-b"}
    assert entry["kept"] == collide_entries[0]["branch"], (
        "the recorded winner must match the source meta.json lists for the slug"
    )

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


# ---------------------------------------------------------------------------
# C2a: --watch fingerprint — flips on worktree edit / branch advance, stable
# otherwise
# ---------------------------------------------------------------------------


def _fingerprint(service_dir: Path) -> str:
    """The exported computeFingerprint(), exactly as the watch loop calls it."""
    r = _run(
        [
            "node",
            "-e",
            "const m=require('./scripts/sync-live-bets.js');"
            "process.stdout.write(m.computeFingerprint());",
        ],
        cwd=service_dir,
    )
    return r.stdout


def _make_worktree_bet(root: Path, slug: str, solution: str) -> Path:
    """A committed worktree bet on branch bet/<slug>; returns the worktree path."""
    _git(["branch", f"bet/{slug}"], cwd=root)
    wt_path = root.parent / f"{slug}-wt"
    _git(["worktree", "add", str(wt_path), f"bet/{slug}"], cwd=root)
    _write_pitch(wt_path / "docs" / "bets" / slug / "pitch.md", slug.title(), solution)
    _git(["add", "-A"], cwd=wt_path)
    _git(["commit", "-q", "-m", f"wip: {slug}"], cwd=wt_path)
    return wt_path


def test_fingerprint_flips_on_worktree_edit_and_branch_advance(repo_with_service):
    root, service_dir = repo_with_service
    wt_path = _make_worktree_bet(root, "fp-thing", "Fingerprint the thing.")
    try:
        # Stable: repeated computation with nothing changed is byte-identical,
        # and a full sync (which writes only the CURRENT checkout's _live/)
        # does not disturb it either — no self-triggering loop.
        fp1 = _fingerprint(service_dir)
        assert fp1 == _fingerprint(service_dir), "fingerprint must be stable with no changes"
        _sync(service_dir)
        assert _fingerprint(service_dir) == fp1, "the sync's own writes must not flip the fingerprint"

        # A worktree docs/bets file touch flips it (mtime bumped explicitly so
        # this never depends on filesystem timestamp granularity).
        pitch = wt_path / "docs" / "bets" / "fp-thing" / "pitch.md"
        future = time.time() + 10
        os.utime(pitch, (future, future))
        fp2 = _fingerprint(service_dir)
        assert fp2 != fp1, "a worktree docs/bets edit must flip the fingerprint"
        assert fp2 == _fingerprint(service_dir), "stable again after the edit"

        # A new bet branch flips it …
        _git(["branch", "bet/fp-new-ref"], cwd=root)
        fp3 = _fingerprint(service_dir)
        assert fp3 != fp2, "a new bet/* ref must flip the fingerprint"

        # … and so does an existing bet branch advancing to a new commit.
        (root / "README.md").write_text("advanced\n")
        _git(["add", "-A"], cwd=root)
        _git(["commit", "-q", "-m", "advance"], cwd=root)
        _git(["branch", "-f", "bet/fp-new-ref", "HEAD"], cwd=root)
        fp4 = _fingerprint(service_dir)
        assert fp4 != fp3, "a bet branch advancing must flip the fingerprint"
    finally:
        shutil.rmtree(wt_path, ignore_errors=True)


# ---------------------------------------------------------------------------
# C2a: bounded --watch run — a worktree pitch edit lands without a restart
# ---------------------------------------------------------------------------


def test_watch_picks_up_worktree_pitch_edit_without_restart(repo_with_service):
    root, service_dir = repo_with_service
    wt_path = _make_worktree_bet(root, "watch-me", "Original solution.")

    # predev semantics: one-shot sync first, so the watcher starts warm.
    _sync(service_dir)
    live_pitch = _live_dir(root) / "watch-me" / "pitch.md"
    assert "Original solution." in live_pitch.read_text()

    env = dict(os.environ, SYNC_LIVE_BETS_INTERVAL_MS="150")
    proc = subprocess.Popen(
        ["node", "scripts/sync-live-bets.js", "--watch"],
        cwd=service_dir,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        # The watcher captures its baseline fingerprint BEFORE printing this
        # line, so an edit made after it is guaranteed to be a change.
        opening = proc.stdout.readline()
        assert "watching" in opening, f"unexpected watcher opening line: {opening!r}"

        _write_pitch(
            wt_path / "docs" / "bets" / "watch-me" / "pitch.md",
            "Watch Me",
            "Edited while the watcher ran.",
        )
        # Explicit future mtime — never rely on timestamp granularity.
        future = time.time() + 10
        os.utime(wt_path / "docs" / "bets" / "watch-me" / "pitch.md", (future, future))

        deadline = time.time() + 20  # a couple of 150ms ticks, with slack for CI
        while time.time() < deadline:
            try:
                if "Edited while the watcher ran." in live_pitch.read_text():
                    break
            except FileNotFoundError:
                pass  # mid-regenerate — the full-rebuild window
            time.sleep(0.2)
        else:
            pytest.fail("the watcher never re-synced the worktree pitch edit")

        assert proc.poll() is None, "the watcher process must still be running (never crashes)"
    finally:
        proc.terminate()
        proc.wait(timeout=10)
        shutil.rmtree(wt_path, ignore_errors=True)


# ---------------------------------------------------------------------------
# C3: the "In flight" dashboard — three sources, correct cells, existing links
# ---------------------------------------------------------------------------


def _write_state_json(path: Path, key: str, statuses: list):
    """A minimal lib/bet-state-shaped ledger ({key: [{status}, …]})."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"schema": 1, key: [{"id": f"X{i}", "status": s} for i, s in enumerate(statuses)]})
        + "\n"
    )


def test_dashboard_lists_all_three_sources(repo_with_service):
    root, service_dir = repo_with_service

    # Source 1 — worktree bet, with a status.md (so its status link exists but
    # proofs does not) and on-disk engine state: 1 pending + 1 ratified
    # decision, 2 open + 1 closed findings.
    wt_path = _make_worktree_bet(root, "worktree-thing", "Build the worktree thing.")
    (wt_path / "docs" / "bets" / "worktree-thing" / "status.md").write_text("# Status\n\nred.\n")
    _write_state_json(
        wt_path / ".groundwork" / "bets" / "worktree-thing" / "decisions.json",
        "decisions",
        ["pending", "ratified"],
    )
    _write_state_json(
        wt_path / ".groundwork" / "bets" / "worktree-thing" / "findings.json",
        "findings",
        ["open", "open", "closed"],
    )

    # Source 2 — branch-only bet with pending decisions COMMITTED on the branch
    # (2 pending, 1 open finding), then the worktree removed so only the ref
    # remains.
    tmp_checkout = root.parent / "tmp-branch-checkout"
    _git(["worktree", "add", str(tmp_checkout), "-b", "bet/branch-only-thing"], cwd=root)
    _write_pitch(
        tmp_checkout / "docs" / "bets" / "branch-only-thing" / "pitch.md",
        "Branch Only Thing",
        "Ship the branch-only thing.",
    )
    _write_state_json(
        tmp_checkout / ".groundwork" / "bets" / "branch-only-thing" / "decisions.json",
        "decisions",
        ["pending", "pending"],
    )
    _write_state_json(
        tmp_checkout / ".groundwork" / "bets" / "branch-only-thing" / "findings.json",
        "findings",
        ["open"],
    )
    _git(["add", "-A"], cwd=tmp_checkout)
    _git(["commit", "-q", "-m", "wip: branch-only thing"], cwd=tmp_checkout)
    _git(["worktree", "remove", "--force", str(tmp_checkout)], cwd=root)

    # Source 3 — checkout-resident quick bet: a live bet dir in THIS checkout
    # (uncommitted is fine — it is read off disk), no branch, no engine state.
    _write_pitch(
        root / "docs" / "bets" / "quick-thing" / "pitch.md",
        "Quick Thing",
        "Ship the quick thing.",
        status="quick",
    )

    result = _sync(service_dir)
    assert result.returncode == 0, result.stderr

    live = _live_dir(root)
    index = live / "index.md"
    assert index.exists(), "the dashboard must be written when work is in flight"
    text = index.read_text()

    rows = [l for l in text.splitlines() if l.startswith("| ") and not l.startswith("| Goal") ]
    rows = [r for r in rows if not set(r) <= {"|", "-", " "}]  # drop the separator row
    assert len(rows) == 3, f"expected three dashboard rows, got:\n{text}"

    by_goal = {}
    for r in rows:
        cells = [c.strip() for c in r.strip().strip("|").split("|")]
        by_goal[cells[0]] = cells  # goal | branch | freshness | links | waiting

    # Worktree row: live, its branch, pitch + status links (no proofs), counts
    # read from the worktree's own disk state.
    wt_row = by_goal["Build the worktree thing."]
    assert wt_row[1] == "`bet/worktree-thing`"
    assert wt_row[2] == "live"
    assert "[pitch](/docs/bets/_live/worktree-thing/pitch)" in wt_row[3]
    assert "[status](/docs/bets/_live/worktree-thing/status)" in wt_row[3]
    assert "proofs" not in wt_row[3], "a proofs link must not render when proofs.md is absent"
    assert wt_row[4] == "1 decision pending · 2 findings open"

    # Branch-only row: as of last commit, pitch link only, counts via git show.
    bo_row = by_goal["Ship the branch-only thing."]
    assert bo_row[1] == "`bet/branch-only-thing`"
    assert bo_row[2] == "as of last commit"
    assert "[pitch](/docs/bets/_live/branch-only-thing/pitch)" in bo_row[3]
    assert "status" not in bo_row[3] and "proofs" not in bo_row[3]
    assert bo_row[4] == "2 decisions pending · 1 finding open"

    # Checkout-resident quick bet: "this checkout", links to its normal
    # non-_live page, no ledgers on disk → the "—" fail-soft cell — and it is
    # NOT materialized into _live/ (it already lives in the watched tree).
    q_row = by_goal["Ship the quick thing."]
    assert q_row[1] == "this checkout"
    assert q_row[2] == "live"
    assert "[pitch](/docs/bets/quick-thing/pitch)" in q_row[3]
    assert "_live/quick-thing" not in q_row[3]
    assert q_row[4] == "—"
    assert not (live / "quick-thing").exists(), (
        "a checkout-resident bet is listed on the dashboard but never materialized"
    )

    # Footer: patches point at the program snapshot; delivered bets at the archive.
    assert "program snapshot" in text
    assert "_archive" in text

    shutil.rmtree(wt_path, ignore_errors=True)


def test_checkout_resident_only_still_gets_a_dashboard(repo_with_service):
    """A quick bet with no branch and no worktree is still work underway — the
    dashboard must exist for it alone, with nothing materialized."""
    root, service_dir = repo_with_service
    _write_pitch(
        root / "docs" / "bets" / "solo-quick" / "pitch.md",
        "Solo Quick",
        "Ship the solo quick thing.",
        status="quick",
    )
    result = _sync(service_dir)
    assert result.returncode == 0, result.stderr
    index = _live_dir(root) / "index.md"
    assert index.exists()
    text = index.read_text()
    assert "Ship the solo quick thing." in text
    assert "this checkout" in text
    assert not (_live_dir(root) / "solo-quick").exists()


def test_delivered_checkout_bet_is_not_a_dashboard_row(repo_with_service):
    """A checkout bet dir whose pitch is `status: delivered` is closed work —
    it must produce neither a dashboard row nor a dashboard at all when it is
    the only candidate."""
    root, service_dir = repo_with_service
    _write_pitch(
        root / "docs" / "bets" / "done-thing" / "pitch.md",
        "Done Thing",
        "Already delivered.",
        status="delivered",
    )
    result = _sync(service_dir)
    assert result.returncode == 0, result.stderr
    assert not (_live_dir(root) / "index.md").exists(), (
        "a delivered checkout bet must not summon the dashboard"
    )


def test_no_inflight_work_writes_no_dashboard(repo_with_service):
    """Explicit C3 acceptance: no live bets AND no checkout-resident bets →
    no index.md (the archived bet alone does not count)."""
    root, service_dir = repo_with_service
    result = _sync(service_dir)
    assert result.returncode == 0
    assert not (_live_dir(root) / "index.md").exists()


# ---------------------------------------------------------------------------
# C3b: docs/bets/meta.json seeding — created `_live`-first, never clobbered
# ---------------------------------------------------------------------------


def test_sync_seeds_bets_meta_live_first_when_absent(repo_with_service):
    root, service_dir = repo_with_service
    meta_path = root / "docs" / "bets" / "meta.json"
    assert not meta_path.exists()
    result = _sync(service_dir)
    assert result.returncode == 0
    assert meta_path.exists(), "sync must seed docs/bets/meta.json when absent"
    assert json.loads(meta_path.read_text()) == {"pages": ["_live", "...", "_archive"]}


def test_sync_never_clobbers_an_existing_bets_meta(repo_with_service):
    root, service_dir = repo_with_service
    meta_path = root / "docs" / "bets" / "meta.json"
    hand_tuned = '{\n  "pages": ["intro", "...", "_archive"]\n}\n'
    meta_path.write_text(hand_tuned)
    result = _sync(service_dir)
    assert result.returncode == 0
    assert meta_path.read_text() == hand_tuned, (
        "an existing docs/bets/meta.json must survive the sync byte-identical"
    )


# ---------------------------------------------------------------------------
# C2b/C2c structural: dev.js wrapper, package.json wiring, page.tsx banner
# ---------------------------------------------------------------------------

GENERATOR_FILES = REPO_ROOT / "src" / "generators" / "docs-site" / "files"


def test_package_json_dev_script_runs_the_wrapper():
    pkg = json.loads((GENERATOR_FILES / "package.json").read_text())
    scripts = pkg["scripts"]
    assert scripts["dev"] == "node scripts/dev.js", "dev must run the watcher+next wrapper"
    # predev stays a one-shot sync so the first render is fresh before the
    # watcher's first tick; the build pair is untouched.
    assert scripts["predev"] == "node scripts/sync-live-bets.js"
    assert scripts["prebuild"] == "node scripts/sync-live-bets.js"
    assert scripts["build"] == "next build"


def test_dev_js_spawns_watcher_and_next_and_couples_their_lifetimes():
    dev_js = (GENERATOR_FILES / "scripts" / "dev.js").read_text()
    assert "sync-live-bets.js" in dev_js and "--watch" in dev_js, "dev.js must spawn the watcher"
    assert "'next'" in dev_js and "'dev'" in dev_js, "dev.js must spawn next dev"
    assert "stdio: 'inherit'" in dev_js
    # Either process exiting stops the other — no orphaned watcher.
    assert dev_js.count("on('exit'") >= 2
    # Dependency-free: Node built-ins only.
    assert "require('child_process')" in dev_js
    for banned in ("require('fumadocs", "require('next"):
        assert banned not in dev_js


def test_page_tsx_carries_the_live_mirror_banner_fail_soft():
    src = (GENERATOR_FILES / "app" / "docs" / "__slug__" / "page.tsx").read_text()
    # The banner branch exists, scoped to pages under docs/bets/_live/.
    assert "In-flight mirror" in src
    assert "'_live'" in src and "'bets'" in src
    assert "never reach the bet branch" in src
    # Fail-soft meta read: the fs read + JSON.parse is inside try/catch that
    # resolves to null (no banner), so `next build` with _live absent survives.
    assert "readLiveMeta" in src
    read_fn = src.split("function readLiveMeta")[1].split("\n}")[0]
    assert "try {" in read_fn and "catch" in read_fn and "return null" in read_fn
    # C2d: the collision warning line renders off meta.json's collisions.
    assert "collisions" in src
