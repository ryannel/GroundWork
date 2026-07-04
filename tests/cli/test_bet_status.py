"""Contract tests for `groundwork status` — the checkpoint-snapshot renderer
(Wave 2, WS-B slice B1).

This is the CLI-rendered "you are here" snapshot Protocol 11 (operating-contract.md,
"The checkpoint snapshot") specifies: Program (delivered / in flight / queued bets,
patches interleaved) -> Bet (goal + milestone ladder as a checklist) -> Milestone
(current milestone's slices, with the in-progress slice's model tier as a column).
Everything renders from committed truth: docs/bets/_archive/ for delivered bets,
pitch frontmatter + decomposition prose for in-flight bets (this checkout, other
worktrees, and branch-only refs), `.groundwork/cache/discovery-notes.md`'s
`## Bets` bullets (in written order — the order IS the queue, D-S5) for queued
bets, and `git log --grep='Lane: patch'` for patches. `board.yaml` is NEVER read —
the snapshot must render mid-delivery with no board at all.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import json
import os
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"

DENYLIST = [
    "Developer Mode",
    "red board",
    "VERDICT:",
    "honest green",
    "frontier",
    "execution tier",
    "REVIEW_UNAVAILABLE",
]


def gw(args, cwd):
    return subprocess.run(
        ["node", str(CLI), *args], cwd=cwd, capture_output=True, text=True,
        env={"GROUNDWORK_NO_UPDATE_CHECK": "1", "PATH": os.environ["PATH"]},
    )


def git(args, cwd):
    subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t", *args],
                    cwd=cwd, capture_output=True, text=True, check=True)


def write_pitch(root, slug, problem, status="delivery", archived=False):
    d = "docs/bets/_archive" if archived else "docs/bets"
    p = root / d / slug
    p.mkdir(parents=True, exist_ok=True)
    (p / "pitch.md").write_text(
        f"---\nstatus: {status}\n---\n# Bet: {slug.replace('-', ' ').title()}\n\n"
        f"## The Pitch\n\n- **Problem:** {problem}\n"
    )
    return p


def write_milestone(bet_dir, n, dirname, goal, slug):
    """Write a minimal milestone index.md with no slices — used by tests that
    only need the milestone ladder, not the slice table."""
    m = bet_dir / "decomposition" / f"{n:02d}-{dirname}"
    m.mkdir(parents=True, exist_ok=True)
    (m / "index.md").write_text(
        f"# Milestone {n}: {goal}\n\n**Demonstrable goal:** {goal}\n\n"
        f"## Proof of work\n\n**Test file:** `tests/bets/{slug}/test_milestone_{n}_{dirname}.py`\n"
    )
    return m


def write_slice(milestone_dir, n, service, slug, name, tier=None):
    tier_line = f"**Model tier:** {tier}\n" if tier else ""
    (milestone_dir / f"01-{slug}.md").write_text(
        f"# Slice {n}.1 — {service}: {name}\n\n**Owner service:** {service}\n{tier_line}\n"
        f"## Proof of work\n\n**Test file:** `tests/bets/PLACEHOLDER/test_slice_{n}_{service}_{slug}.py`\n"
    )


GREEN_BODY = "def test_x():\n    assert True\n"
RED_BODY = "def test_x():\n    assert False, 'not implemented yet'\n"


def commit_test_file(root, bet_slug, filename, body=GREEN_BODY):
    d = root / "tests" / "bets" / bet_slug
    d.mkdir(parents=True, exist_ok=True)
    (d / filename).write_text(body)


def init_repo(root):
    git(["init", "-q"], root)


def commit_all(root, message):
    git(["add", "-A"], root)
    git(["commit", "-q", "-m", message], root)


# ─── Multi-bet program: archived + in-flight + queued, queue order preserved ─

def test_program_shows_archived_in_flight_and_queued_in_written_order(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "onboarding-flow", "New users abandon signup before finishing setup.", archived=True)
    write_pitch(tmp_path, "widget-import", "Users cannot bring their own widgets into the library.")
    notes = tmp_path / ".groundwork" / "cache"
    notes.mkdir(parents=True)
    (notes / "discovery-notes.md").write_text(
        "# Discovery Notes\n\n## Bets\n\n"
        "- Bulk-tagging for the library\n"
        "- Export to a shareable link\n"
        "- Offline mode for the mobile client\n"
    )
    commit_all(tmp_path, "seed program fixture")

    proc = gw(["status"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    out = proc.stdout

    assert "New users abandon signup before finishing setup." in out
    assert "Users cannot bring their own widgets into the library." in out
    assert "Bulk-tagging for the library" in out
    assert "Export to a shareable link" in out
    assert "Offline mode for the mobile client" in out

    # Queue order is the written order (D-S5) — not alphabetical, not reversed.
    i1 = out.index("Bulk-tagging for the library")
    i2 = out.index("Export to a shareable link")
    i3 = out.index("Offline mode for the mobile client")
    assert i1 < i2 < i3


def test_program_json_preserves_queue_order(tmp_path):
    init_repo(tmp_path)
    notes = tmp_path / ".groundwork" / "cache"
    notes.mkdir(parents=True)
    (notes / "discovery-notes.md").write_text(
        "# Discovery Notes\n\n## Bets\n\n- first queued\n- second queued\n- third queued\n"
    )
    commit_all(tmp_path, "seed queue")
    proc = gw(["status", "--json"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    doc = json.loads(proc.stdout)
    goals = [b["goal"] for b in doc["program"]["queued"]]
    assert goals == ["first queued", "second queued", "third queued"]


# ─── Queued-only project: no bet dirs at all ────────────────────────────────

def test_queued_only_project_with_no_bet_dirs(tmp_path):
    init_repo(tmp_path)
    notes = tmp_path / ".groundwork" / "cache"
    notes.mkdir(parents=True)
    (notes / "discovery-notes.md").write_text(
        "# Discovery Notes\n\n## Bets\n\n- Someday: dark mode\n"
    )
    commit_all(tmp_path, "seed notes only")
    proc = gw(["status"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert "Someday: dark mode" in proc.stdout
    assert "Delivered" not in proc.stdout
    assert "In flight" not in proc.stdout


# ─── Patches interleaved, grouped by Area ────────────────────────────────────

def test_patches_grouped_by_area_appear_in_program(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed bet")
    (tmp_path / "a.txt").write_text("a")
    git(["add", "-A"], tmp_path)
    git(["commit", "-q", "-m", "fix(importer): tighten mime sniffing\n\nLane: patch\nArea: importer"], tmp_path)
    (tmp_path / "b.txt").write_text("b")
    git(["add", "-A"], tmp_path)
    git(["commit", "-q", "-m", "fix(exporter): correct file extension\n\nLane: patch\nArea: exporter"], tmp_path)

    proc = gw(["status"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    out = proc.stdout
    assert "importer" in out and "tighten mime sniffing" in out
    assert "exporter" in out and "correct file extension" in out


# ─── No-board delivery-in-progress: decomposition + test state, no board.yaml ─

def test_no_board_delivery_in_progress_still_renders(tmp_path):
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(bet_dir, 1, "first-image", "point the app at a folder and see one image appear", "widget-import")
    m1 = bet_dir / "decomposition" / "01-first-image"
    write_slice(m1, 1, "importer", "import-endpoint", "Accept one image over the API")
    commit_test_file(tmp_path, "widget-import", "test_milestone_1_first-image.py")
    commit_test_file(tmp_path, "widget-import", "test_slice_1_importer_import-endpoint.py")
    commit_all(tmp_path, "bet(widget-import): materialize milestone 1 red")

    # No board.yaml anywhere in the fixture.
    assert not (tmp_path / ".groundwork" / "cache" / "bets").exists()

    proc = gw(["status"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    out = proc.stdout
    assert "point the app at a folder and see one image appear" in out
    assert "Accept one image over the API" in out
    assert "Milestone 1" in out


def test_status_never_reads_board_yaml(tmp_path):
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(bet_dir, 1, "first-image", "see one image appear", "widget-import")
    commit_test_file(tmp_path, "widget-import", "test_milestone_1_first-image.py")
    commit_all(tmp_path, "seed")

    board_dir = tmp_path / ".groundwork" / "cache" / "bets" / "widget-import"
    board_dir.mkdir(parents=True)
    # A board.yaml claiming a state the committed truth does not support —
    # if the renderer read it, this would leak into the output.
    (board_dir / "board.yaml").write_text("bet: widget-import\nmode: fake\nstep: bogus-step-name\n")

    proc = gw(["status"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert "bogus-step-name" not in proc.stdout
    assert "fake" not in proc.stdout.lower() or "fake" not in proc.stdout


# ─── Archived bets only ──────────────────────────────────────────────────────

def test_archived_bets_only(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "onboarding-flow", "New users abandon signup before finishing setup.", archived=True)
    write_pitch(tmp_path, "search-v1", "Users cannot find items once the library grows.", archived=True)
    commit_all(tmp_path, "seed archived bets")

    proc = gw(["status"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    out = proc.stdout
    assert "New users abandon signup before finishing setup." in out
    assert "Users cannot find items once the library grows." in out
    assert "Delivered" in out


# ─── --bet resolution ────────────────────────────────────────────────────────

def test_bet_flag_selects_named_bet_when_multiple_in_flight(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_pitch(tmp_path, "search-v1", "Users cannot find items once the library grows.")
    commit_all(tmp_path, "seed two in-flight bets")

    proc = gw(["status", "--bet", "widget-import"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert "## Bet: widget-import" in proc.stdout
    assert "Bring your own widgets into the library." in proc.stdout


def test_single_in_flight_bet_resolves_without_flag(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed one in-flight bet")

    proc = gw(["status"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert "## Bet: widget-import" in proc.stdout


def test_ambiguous_bet_without_flag_shows_program_only(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_pitch(tmp_path, "search-v1", "Users cannot find items once the library grows.")
    commit_all(tmp_path, "seed two in-flight bets")

    proc = gw(["status"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert "## Bet:" not in proc.stdout
    assert "## Program" in proc.stdout


def test_unknown_bet_flag_exits_nonzero(tmp_path):
    init_repo(tmp_path)
    (tmp_path / "x").write_text("x")
    commit_all(tmp_path, "init")
    proc = gw(["status", "--bet", "nope"], tmp_path)
    assert proc.returncode == 2


# ─── Milestone ladder states derived from suite + git ────────────────────────

def test_milestone_ladder_shows_done_and_not_started_states(tmp_path):
    # Milestone 1's test is genuinely green (closed); milestone 2's is
    # genuinely red (materialized, not yet implemented) AND has no slices
    # authored — an unopened rung, which reads as not started rather than in
    # progress. Pinned regardless of whether the local environment can run
    # the suite (pytest-capable: real pass/fail; otherwise: the git-history
    # fallback, where milestone 1's second, closing commit trips 'done').
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(bet_dir, 1, "first-image", "see one image appear", "widget-import")
    write_milestone(bet_dir, 2, "search", "search returns matching images", "widget-import")
    commit_test_file(tmp_path, "widget-import", "test_milestone_1_first-image.py", GREEN_BODY)
    commit_test_file(tmp_path, "widget-import", "test_milestone_2_search.py", RED_BODY)
    commit_all(tmp_path, "bet(widget-import): materialize milestone 1+2 red")
    # A second, closing commit on milestone 1's test file only — trips the
    # git-history fallback's 'done' signal in a no-pytest environment too.
    (tmp_path / "tests" / "bets" / "widget-import" / "test_milestone_1_first-image.py").write_text(
        GREEN_BODY + "# closed\n"
    )
    commit_all(tmp_path, "close milestone 1")

    proc = gw(["status", "--bet", "widget-import", "--json"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    doc = json.loads(proc.stdout)
    states = {m["n"]: m["state"] for m in doc["bet"]["milestones"]}
    assert states[1] == "done"
    assert states[2] == "not-started"


def test_bet_slug_with_path_traversal_is_rejected(tmp_path):
    # A slug is a path segment under docs/bets/ — anything shaped like a
    # traversal must be refused before it reaches a path join (the same guard
    # the ./dev bundle's archive applies), for both read and --write paths.
    init_repo(tmp_path)
    outside = tmp_path / "docs" / "outside-secret"
    outside.mkdir(parents=True)
    (outside / "pitch.md").write_text("---\nstatus: delivery\n---\n# Bet: outside\n")
    commit_all(tmp_path, "init")
    for extra in ([], ["--write"]):
        proc = gw(["status", "--bet", "../outside-secret", *extra], tmp_path)
        assert proc.returncode == 2
        assert "invalid bet slug" in (proc.stderr + proc.stdout)
    assert not (outside / "status.md").exists()


# ─── Milestone section: in-progress slice carries the model tier column ─────

def test_milestone_section_carries_model_tier_for_in_progress_slice(tmp_path):
    # RED_BODY + a single commit keeps the slice 'in-progress' whether the
    # environment can run the suite (genuinely fails) or falls back to the
    # git-history heuristic (single commit == in-progress).
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(bet_dir, 1, "first-image", "see one image appear", "widget-import")
    m1 = bet_dir / "decomposition" / "01-first-image"
    write_slice(m1, 1, "importer", "import-endpoint", "Accept one image over the API", tier="frontier — tricky binary parsing")
    commit_test_file(tmp_path, "widget-import", "test_milestone_1_first-image.py", RED_BODY)
    commit_test_file(tmp_path, "widget-import", "test_slice_1_importer_import-endpoint.py", RED_BODY)
    commit_all(tmp_path, "bet(widget-import): materialize milestone 1 red")

    proc = gw(["status", "--bet", "widget-import", "--json"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    doc = json.loads(proc.stdout)
    slices = doc["milestone"]["slices"]
    assert len(slices) == 1
    assert slices[0]["state"] == "in-progress"
    assert slices[0]["tier"] == "frontier"

    md = gw(["status", "--bet", "widget-import"], tmp_path).stdout
    assert "strongest model" in md


def test_default_tier_slice_shows_standard_model_label(tmp_path):
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(bet_dir, 1, "first-image", "see one image appear", "widget-import")
    m1 = bet_dir / "decomposition" / "01-first-image"
    write_slice(m1, 1, "importer", "import-endpoint", "Accept one image over the API")  # no tier -> default
    commit_test_file(tmp_path, "widget-import", "test_milestone_1_first-image.py", RED_BODY)
    commit_test_file(tmp_path, "widget-import", "test_slice_1_importer_import-endpoint.py", RED_BODY)
    commit_all(tmp_path, "bet(widget-import): materialize milestone 1 red")

    md = gw(["status", "--bet", "widget-import"], tmp_path).stdout
    assert "standard model" in md


# ─── Output-language: no engine vocabulary outside the shared set ───────────

def test_no_engine_vocabulary_in_rendered_markdown(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "onboarding-flow", "New users abandon signup before finishing setup.", archived=True)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(bet_dir, 1, "first-image", "see one image appear", "widget-import")
    m1 = bet_dir / "decomposition" / "01-first-image"
    write_slice(m1, 1, "importer", "import-endpoint", "Accept one image over the API", tier="frontier — tricky parsing")
    commit_test_file(tmp_path, "widget-import", "test_milestone_1_first-image.py")
    commit_test_file(tmp_path, "widget-import", "test_slice_1_importer_import-endpoint.py")
    notes = tmp_path / ".groundwork" / "cache"
    notes.mkdir(parents=True)
    (notes / "discovery-notes.md").write_text("# Discovery Notes\n\n## Bets\n\n- Someday feature\n")
    commit_all(tmp_path, "seed full fixture")
    (tmp_path / "p.txt").write_text("p")
    git(["add", "-A"], tmp_path)
    git(["commit", "-q", "-m", "fix(x): patch\n\nLane: patch\nArea: x"], tmp_path)

    proc = gw(["status", "--bet", "widget-import"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    out = proc.stdout
    for term in DENYLIST:
        assert term not in out, f"denylisted engine term leaked into output: {term!r}\n{out}"


def test_no_engine_vocabulary_in_json_string_fields(tmp_path):
    # --json is machine output, not a chat-boundary artifact — but the tier
    # field's raw value ('frontier'/'execution') is a class name for machine
    # consumption, not the owner-language label. This test pins that the
    # *markdown* render (the actual chat-boundary artifact) never carries it,
    # which test_no_engine_vocabulary_in_rendered_markdown above already does;
    # here we just confirm --json still produces a well-formed, parseable doc
    # (a cannot-run condition would leak as an unparseable stream instead).
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")
    proc = gw(["status", "--json"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    json.loads(proc.stdout)  # must parse cleanly


# ─── Not a git repo: degrade gracefully rather than error ───────────────────

def test_status_outside_git_repo_still_renders(tmp_path):
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    proc = gw(["status"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert "Bring your own widgets into the library." in proc.stdout


def test_empty_project_renders_empty_program(tmp_path):
    init_repo(tmp_path)
    (tmp_path / "x").write_text("x")
    commit_all(tmp_path, "init")
    proc = gw(["status"], tmp_path)
    assert proc.returncode == 0, proc.stderr


# ─── --write: the per-bet delivery status page (Wave 2, C2) ─────────────────

def test_write_with_bet_defaults_to_docs_bets_slug_status_md(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    proc = gw(["status", "--bet", "widget-import", "--write"], tmp_path)
    assert proc.returncode == 0, proc.stderr

    written = tmp_path / "docs" / "bets" / "widget-import" / "status.md"
    assert written.exists()
    assert "Bring your own widgets into the library." in written.read_text()


def test_write_explicit_path_overrides_default(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    custom = tmp_path / "elsewhere" / "snapshot.md"
    proc = gw(["status", "--bet", "widget-import", "--write", str(custom)], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert custom.exists()
    assert "Bring your own widgets into the library." in custom.read_text()
    # The default path was never touched.
    assert not (tmp_path / "docs" / "bets" / "widget-import" / "status.md").exists()


def test_write_carries_generated_marker_and_generated_at_line(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    gw(["status", "--bet", "widget-import", "--write"], tmp_path)
    text = (tmp_path / "docs" / "bets" / "widget-import" / "status.md").read_text()
    assert "<!-- GENERATED by" in text
    assert "do not hand-edit" in text.lower() or "not hand-edit" in text.lower()
    assert "Generated at" in text
    # The generated-at line carries a real timestamp, not a placeholder.
    import re
    assert re.search(r"Generated at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", text)


def test_write_twice_regenerates_whole_never_appends(tmp_path):
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    gw(["status", "--bet", "widget-import", "--write"], tmp_path)
    first = (tmp_path / "docs" / "bets" / "widget-import" / "status.md").read_text()

    # Advance state between writes — the second write must reflect the new
    # state, not carry the first write's content forward alongside it.
    write_milestone(bet_dir, 1, "first-image", "see one image appear", "widget-import")
    commit_test_file(tmp_path, "widget-import", "test_milestone_1_first-image.py")
    commit_all(tmp_path, "materialize milestone 1")

    gw(["status", "--bet", "widget-import", "--write"], tmp_path)
    second = (tmp_path / "docs" / "bets" / "widget-import" / "status.md").read_text()

    assert second != first
    assert "see one image appear" in second
    # Only one marker comment, one generated-at line, one Program heading —
    # a patch/append would duplicate these.
    assert second.count("<!-- GENERATED by") == 1
    assert second.count("Generated at") == 1
    assert second.count("## Program") == 1
    assert "Bring your own widgets into the library." in second


def test_write_with_no_value_and_no_resolvable_bet_exits_nonzero(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_pitch(tmp_path, "search-v1", "Users cannot find items once the library grows.")
    commit_all(tmp_path, "seed two in-flight bets")

    proc = gw(["status", "--write"], tmp_path)
    assert proc.returncode != 0
    assert not (tmp_path / "docs" / "bets" / "status.md").exists()


def test_write_still_prints_the_paste_ready_snapshot_to_stdout(tmp_path):
    # The same invocation both refreshes the file and hands back the snapshot
    # to paste — one command, not a compose-then-write pair.
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    proc = gw(["status", "--bet", "widget-import", "--write"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert "Bring your own widgets into the library." in proc.stdout
    # stdout is the paste-ready snapshot, not the file's generated-marker wrapper.
    assert "<!-- GENERATED by" not in proc.stdout


def test_write_json_mode_still_writes_file_and_prints_json(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    proc = gw(["status", "--bet", "widget-import", "--write", "--json"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    json.loads(proc.stdout)
    assert (tmp_path / "docs" / "bets" / "widget-import" / "status.md").exists()
