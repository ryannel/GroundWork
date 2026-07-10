"""Contract tests for `groundwork proofs` — the proofs-at-a-glance board
(Wave 2, WS-B slice B1).

One row per agreed front-door case from the decomposition tree, walked in
milestone order: milestone number + name, consumer, the case text verbatim,
and its proof (test) path — plus each milestone's Proves headline. Rendered
from milestone `index.md` prose only, never a signed manifest or a hand-edited
page (D-T1). A milestone whose index.md doesn't parse (or carries zero
acceptance criteria) degrades to one placeholder row rather than failing the
whole board.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import json
import os
import re
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"

# Same denylist convention as test_bet_status.py:29-37 — no engine vocabulary
# (verdict grammar, tier names, wire tokens) may reach a rendered board.
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


def init_repo(root):
    git(["init", "-q"], root)


def commit_all(root, message):
    git(["add", "-A"], root)
    git(["commit", "-q", "-m", message], root)


def write_pitch(root, slug, problem, status="delivery"):
    p = root / "docs" / "bets" / slug
    p.mkdir(parents=True, exist_ok=True)
    (p / "pitch.md").write_text(
        f"---\nstatus: {status}\n---\n# Bet: {slug.replace('-', ' ').title()}\n\n"
        f"## The Pitch\n\n- **Problem:** {problem}\n"
    )
    return p


def write_milestone(bet_dir, n, dirname, goal, slug, consumer, criteria, proves, checkbox=False):
    """A filled-in milestone index.md — Consumer, Acceptance criteria bullets
    (plain `- ` by default, `- [ ] ` when checkbox=True), and the Proof of
    work section's Proves + Test file lines."""
    m = bet_dir / "decomposition" / f"{n:02d}-{dirname}"
    m.mkdir(parents=True, exist_ok=True)
    prefix = "- [ ] " if checkbox else "- "
    criteria_block = "\n".join(f"{prefix}{c}" for c in criteria)
    (m / "index.md").write_text(
        f"# Milestone {n}: {goal}\n\n"
        f"**Consumer:** {consumer}\n\n"
        f"**Demonstrable goal:** {goal}\n\n"
        f"**Sequencing rationale:** because it comes first.\n\n"
        f"**Acceptance criteria — proven at the app's real entry point:**\n"
        f"{criteria_block}\n\n"
        f"## Proof of work\n\n"
        f"**Proves:** {proves}\n\n"
        f"**How we prove it:** drives the real entry point end to end.\n\n"
        f"**Test file:** `tests/bets/{slug}/test_milestone_{n}_{dirname}.py`\n"
    )
    return m


def write_malformed_milestone(bet_dir, n, dirname, goal):
    """A milestone index.md with no Acceptance criteria field at all — the
    degradation case."""
    m = bet_dir / "decomposition" / f"{n:02d}-{dirname}"
    m.mkdir(parents=True, exist_ok=True)
    (m / "index.md").write_text(f"# Milestone {n}: {goal}\n\nSomeone wrote a paragraph instead.\n")
    return m


# ─── Two milestones, both bullet forms → one row per criterion ─────────────

def test_two_milestones_both_bullet_forms_one_row_per_criterion(tmp_path):
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(
        bet_dir, 1, "first-image", "see one image appear", "widget-import",
        consumer="A person browsing the library",
        criteria=["Upload one image and see it appear in the library", "The image thumbnail loads within five seconds"],
        proves="The library shows an uploaded image without a page reload.",
        checkbox=False,
    )
    write_milestone(
        bet_dir, 2, "search", "search returns matching images", "widget-import",
        consumer="A person searching the library",
        criteria=["Search for a known tag and see the matching image", "An empty search shows a helpful empty state"],
        proves="Search returns images whose tags match the query.",
        checkbox=True,
    )
    commit_all(tmp_path, "seed two-milestone decomposition")

    proc = gw(["proofs", "--bet", "widget-import"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    out = proc.stdout

    for text in [
        "Upload one image and see it appear in the library",
        "The image thumbnail loads within five seconds",
        "Search for a known tag and see the matching image",
        "An empty search shows a helpful empty state",
    ]:
        assert text in out, f"missing case text: {text!r}\n{out}"

    for text in ["A person browsing the library", "A person searching the library"]:
        assert text in out

    for text in [
        "tests/bets/widget-import/test_milestone_1_first-image.py",
        "tests/bets/widget-import/test_milestone_2_search.py",
    ]:
        assert text in out

    for text in [
        "The library shows an uploaded image without a page reload.",
        "Search returns images whose tags match the query.",
    ]:
        assert text in out


def test_json_composes_one_row_per_criterion_plus_proves_rows(tmp_path):
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(
        bet_dir, 1, "first-image", "see one image appear", "widget-import",
        consumer="A person browsing the library",
        criteria=["Upload one image and see it appear", "Search finds the uploaded image"],
        proves="The library shows an uploaded image.",
        checkbox=False,
    )
    write_milestone(
        bet_dir, 2, "search", "search returns matching images", "widget-import",
        consumer="A person searching the library",
        criteria=["Search for a known tag and see the matching image"],
        proves="Search returns matching images.",
        checkbox=True,
    )
    commit_all(tmp_path, "seed")

    proc = gw(["proofs", "--bet", "widget-import", "--json"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    doc = json.loads(proc.stdout)

    assert doc["found"] is True
    assert doc["slug"] == "widget-import"
    assert len(doc["milestones"]) == 2

    m1 = doc["milestones"][0]
    assert m1["n"] == 1
    assert m1["consumer"] == "A person browsing the library"
    assert m1["proves"] == "The library shows an uploaded image."
    assert m1["testFile"] == "tests/bets/widget-import/test_milestone_1_first-image.py"
    assert m1["cases"] == ["Upload one image and see it appear", "Search finds the uploaded image"]
    assert m1["degraded"] is False

    # Rows: 2 case rows + 1 proves row for milestone 1, 1 case row + 1 proves
    # row for milestone 2 (the checkbox-form bullets parse identically).
    case_rows = [r for r in doc["rows"] if r["kind"] == "case"]
    proves_rows = [r for r in doc["rows"] if r["kind"] == "proves"]
    assert len(case_rows) == 3
    assert len(proves_rows) == 2
    assert {r["text"] for r in case_rows} == {
        "Upload one image and see it appear",
        "Search finds the uploaded image",
        "Search for a known tag and see the matching image",
    }


# ─── --write: the generated proofs.md page ──────────────────────────────────

def test_write_produces_page_with_generated_marker_and_h1(tmp_path):
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(
        bet_dir, 1, "first-image", "see one image appear", "widget-import",
        consumer="A person browsing the library",
        criteria=["Upload one image and see it appear"],
        proves="The library shows an uploaded image.",
    )
    commit_all(tmp_path, "seed")

    proc = gw(["proofs", "--bet", "widget-import", "--write"], tmp_path)
    assert proc.returncode == 0, proc.stderr

    written = tmp_path / "docs" / "bets" / "widget-import" / "proofs.md"
    assert written.exists()
    text = written.read_text()

    assert "<!-- GENERATED by" in text
    assert "not hand-edit" in text.lower()
    assert re.search(r"^# Proofs: widget-import\s*$", text, re.MULTILINE)
    assert "Generated at" in text
    assert re.search(r"Generated at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", text)
    assert "Upload one image and see it appear" in text
    # No frontmatter.
    assert not text.startswith("---")


def test_write_twice_is_stable_aside_from_the_timestamp(tmp_path):
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(
        bet_dir, 1, "first-image", "see one image appear", "widget-import",
        consumer="A person browsing the library",
        criteria=["Upload one image and see it appear"],
        proves="The library shows an uploaded image.",
    )
    commit_all(tmp_path, "seed")

    gw(["proofs", "--bet", "widget-import", "--write"], tmp_path)
    first = (tmp_path / "docs" / "bets" / "widget-import" / "proofs.md").read_text()

    gw(["proofs", "--bet", "widget-import", "--write"], tmp_path)
    second = (tmp_path / "docs" / "bets" / "widget-import" / "proofs.md").read_text()

    # Never appends/duplicates the header on a second write.
    assert second.count("<!-- GENERATED by") == 1
    assert second.count("Generated at") == 1
    assert second.count("# Proofs: widget-import") == 1

    # Byte-idempotent given identical inputs, apart from the generated-at
    # line — the same convention writeStatusPage follows — and the
    # faithfulness footer's own as-of stamp (B3), which carries its own
    # independent wall-clock read.
    def strip_ts(t):
        t = re.sub(r"Generated at \S+", "Generated at <TS>", t)
        t = re.sub(r"As of \S+", "As of <TS>", t)
        return t

    assert strip_ts(first) == strip_ts(second)


def test_write_explicit_path_overrides_default(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    custom = tmp_path / "elsewhere" / "board.md"
    proc = gw(["proofs", "--bet", "widget-import", "--write", str(custom)], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert custom.exists()
    assert not (tmp_path / "docs" / "bets" / "widget-import" / "proofs.md").exists()


def test_write_still_prints_paste_ready_board_not_the_file_wrapper(tmp_path):
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(
        bet_dir, 1, "first-image", "see one image appear", "widget-import",
        consumer="A person browsing the library",
        criteria=["Upload one image and see it appear"],
        proves="The library shows an uploaded image.",
    )
    commit_all(tmp_path, "seed")

    proc = gw(["proofs", "--bet", "widget-import", "--write"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert "Upload one image and see it appear" in proc.stdout
    assert "<!-- GENERATED by" not in proc.stdout


# ─── Denylist: zero engine vocabulary in the rendered board ─────────────────

def test_no_engine_vocabulary_in_rendered_board(tmp_path):
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(
        bet_dir, 1, "first-image", "see one image appear", "widget-import",
        consumer="A person browsing the library",
        criteria=["Upload one image and see it appear", "Search finds the uploaded image"],
        proves="The library shows an uploaded image.",
    )
    commit_all(tmp_path, "seed")

    proc = gw(["proofs", "--bet", "widget-import"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    out = proc.stdout
    for term in DENYLIST:
        assert term not in out, f"denylisted engine term leaked into output: {term!r}\n{out}"

    written = gw(["proofs", "--bet", "widget-import", "--write"], tmp_path)
    assert written.returncode == 0, written.stderr
    page = (tmp_path / "docs" / "bets" / "widget-import" / "proofs.md").read_text()
    for term in DENYLIST:
        assert term not in page, f"denylisted engine term leaked into the written page: {term!r}\n{page}"


# ─── Per-row degradation: a malformed milestone never fails the board ───────

def test_malformed_milestone_degrades_to_one_placeholder_row(tmp_path):
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(
        bet_dir, 1, "first-image", "see one image appear", "widget-import",
        consumer="A person browsing the library",
        criteria=["Upload one image and see it appear"],
        proves="The library shows an uploaded image.",
    )
    write_malformed_milestone(bet_dir, 2, "search", "search returns matching images")
    commit_all(tmp_path, "seed one good, one malformed milestone")

    proc = gw(["proofs", "--bet", "widget-import"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    out = proc.stdout

    # The good milestone still renders in full.
    assert "Upload one image and see it appear" in out
    # The malformed milestone degrades to exactly the placeholder text —
    # it never takes the whole board down.
    assert "(no criteria parsed — see the milestone page)" in out

    doc = json.loads(gw(["proofs", "--bet", "widget-import", "--json"], tmp_path).stdout)
    m2 = next(m for m in doc["milestones"] if m["n"] == 2)
    assert m2["degraded"] is True
    assert m2["cases"] == []
    degraded_rows = [r for r in doc["rows"] if r["kind"] == "degraded"]
    assert len(degraded_rows) == 1
    assert degraded_rows[0]["milestoneN"] == 2


# ─── Missing state: no decomposition dir, and no bet at all ────────────────

def test_bet_with_no_decomposition_dir_renders_empty_board(tmp_path):
    # Mirrors the status verb's precedent for a bet with zero milestones
    # decomposed: it renders (exit 0), it doesn't error.
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed pitch only, no decomposition dir")

    proc = gw(["proofs", "--bet", "widget-import"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert "No milestones decomposed yet" in proc.stdout

    doc = json.loads(gw(["proofs", "--bet", "widget-import", "--json"], tmp_path).stdout)
    assert doc["found"] is True
    assert doc["milestones"] == []
    assert doc["rows"] == []


def test_unknown_bet_exits_nonzero_with_clear_message(tmp_path):
    init_repo(tmp_path)
    (tmp_path / "x").write_text("x")
    commit_all(tmp_path, "init")

    proc = gw(["proofs", "--bet", "nope"], tmp_path)
    assert proc.returncode != 0
    assert "no pitch found" in (proc.stderr + proc.stdout).lower()


def test_missing_bet_flag_exits_nonzero(tmp_path):
    init_repo(tmp_path)
    (tmp_path / "x").write_text("x")
    commit_all(tmp_path, "init")

    proc = gw(["proofs"], tmp_path)
    assert proc.returncode != 0


def test_bet_slug_with_path_traversal_is_rejected(tmp_path):
    init_repo(tmp_path)
    outside = tmp_path / "docs" / "outside-secret"
    outside.mkdir(parents=True)
    (outside / "pitch.md").write_text("---\nstatus: delivery\n---\n# Bet: outside\n")
    commit_all(tmp_path, "init")

    proc = gw(["proofs", "--bet", "../outside-secret"], tmp_path)
    assert proc.returncode == 2
    assert "invalid bet slug" in (proc.stderr + proc.stdout)
