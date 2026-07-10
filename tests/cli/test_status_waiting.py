"""Contract tests for the "Waiting on you" section on the written status page
(review-throughput plan, Workstream C, slice C4).

`renderStatusPage` (the WRITTEN page only) gains a `## Waiting on you` section
when the bet is resolved: pending decisions as checklist lines, open findings
translated to plain language, and one integrity line when the sealed prose has
drifted. The section is composed straight from committed bet-state
(`.groundwork/bets/<slug>/{findings,decisions}.json`, `lib/bet-state/compose`)
and is exclusive to the written page — the chat-paste render (`renderMarkdown`,
what `status` prints to stdout without `--write`) must stay byte-identical to
what it rendered before this slice, for the same fixture.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import os
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"

# Same denylist convention as test_bet_status.py:29-37 — no engine vocabulary
# may reach a rendered page, including this new section.
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


FOOTER = "Rulings happen in the conversation — this list is your re-entry point."


# ─── (a)+(b): pending decisions + open findings render on the written page ──

def test_write_renders_waiting_on_you_with_question_and_translated_finding(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    gw(["decisions", "add", "--bet", "widget-import", "--question", "Ship dark mode by default?",
        "--default", "keep light mode", "--rationale", "matches existing users' expectation"], tmp_path)
    gw(["findings", "add", "--bet", "widget-import", "--bucket", "decision-needed",
        "--title", "Undo behavior unspecified"], tmp_path)
    gw(["findings", "add", "--bet", "widget-import", "--bucket", "patch",
        "--title", "Missing alt text on the thumbnail"], tmp_path)
    gw(["findings", "add", "--bet", "widget-import", "--bucket", "defer",
        "--title", "Legacy importer still shells out"], tmp_path)

    proc = gw(["status", "--bet", "widget-import", "--write"], tmp_path)
    assert proc.returncode == 0, proc.stderr

    written = (tmp_path / "docs" / "bets" / "widget-import" / "status.md").read_text()
    assert "## Waiting on you" in written
    # The question renders verbatim.
    assert "Ship dark mode by default?" in written
    # Bucket translation, per the plan's owner-language map.
    assert "Undo behavior unspecified" in written and "needs your ruling" in written
    assert "Missing alt text on the thumbnail" in written and "being fixed" in written
    assert "Legacy importer still shells out" in written and "parked with an owner" in written
    assert FOOTER in written


# ─── (e): whole section omitted when nothing is pending or open ─────────────

def test_write_omits_section_when_nothing_pending_or_open(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    proc = gw(["status", "--bet", "widget-import", "--write"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    written = (tmp_path / "docs" / "bets" / "widget-import" / "status.md").read_text()
    assert "Waiting on you" not in written


# ─── HARD CONSTRAINT: chat stdout stays byte-identical ──────────────────────
#
# Both calls below pass --full. Isolating the variable under test (bet-state
# additions) from E2's *own*, separately-sanctioned reason for the chat render
# to change across repeated calls (review-throughput plan §6 E2 — an unchanged
# Program section collapses on a second render) is exactly what --full is for;
# D-T7/E2 names this test's byte-stability claim as scoped to *this slice's*
# diff, not a blanket "chat output never changes across calls" guarantee.

def test_chat_stdout_byte_identical_regardless_of_pending_state(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    golden = gw(["status", "--bet", "widget-import", "--full"], tmp_path).stdout

    gw(["decisions", "add", "--bet", "widget-import", "--question", "Ship dark mode by default?",
        "--default", "keep light mode", "--rationale", "matches existing users' expectation"], tmp_path)
    gw(["findings", "add", "--bet", "widget-import", "--bucket", "decision-needed",
        "--title", "Undo behavior unspecified"], tmp_path)

    actual = gw(["status", "--bet", "widget-import", "--full"], tmp_path).stdout
    assert actual == golden, "chat render must not change when bet-state carries pending decisions/findings"


def test_program_only_chat_stdout_also_unaffected(tmp_path):
    # No --bet resolvable (ambiguous) — the program-only chat render must be
    # untouched too, even with pending state recorded for one of the bets.
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_pitch(tmp_path, "search-v1", "Users cannot find items once the library grows.")
    commit_all(tmp_path, "seed two in-flight bets")

    golden = gw(["status", "--full"], tmp_path).stdout
    gw(["decisions", "add", "--bet", "widget-import", "--question", "q", "--default", "d", "--rationale", "r"], tmp_path)
    actual = gw(["status", "--full"], tmp_path).stdout
    assert actual == golden


# ─── Denylist on the written page, across all four buckets ──────────────────

def test_written_page_passes_denylist_with_full_waiting_section(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    gw(["decisions", "add", "--bet", "widget-import", "--question", "q", "--default", "d", "--rationale", "r"], tmp_path)
    for bucket in ["decision-needed", "patch", "defer", "dismiss"]:
        gw(["findings", "add", "--bet", "widget-import", "--bucket", bucket, "--title", f"finding-{bucket}"], tmp_path)

    proc = gw(["status", "--bet", "widget-import", "--write"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    written = (tmp_path / "docs" / "bets" / "widget-import" / "status.md").read_text()
    assert "## Waiting on you" in written
    for term in DENYLIST:
        assert term not in written, f"denylisted engine term leaked into the written page: {term!r}"


# ─── (c): the integrity line only appears with git + seal drift ─────────────

def test_no_git_fixture_writes_page_without_integrity_line(tmp_path):
    # No `git init` at all — sealVerify degrades to 'no-git', never 'drift'.
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    gw(["decisions", "add", "--bet", "widget-import", "--question", "q", "--default", "d", "--rationale", "r"], tmp_path)

    proc = gw(["status", "--bet", "widget-import", "--write"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    written = (tmp_path / "docs" / "bets" / "widget-import" / "status.md").read_text()
    assert "## Waiting on you" in written  # the pending decision still renders
    assert "drifted" not in written
    assert "worth asking about" not in written


def test_seal_drift_shows_the_integrity_line(tmp_path):
    b = tmp_path / "docs" / "bets" / "b"
    (b / "technical-design").mkdir(parents=True)
    (b / "technical-design" / "03-api-design.md").write_text("# API\n")
    m1 = b / "decomposition" / "01-first"
    m1.mkdir(parents=True)
    (b / "decomposition" / "meta.json").write_text('{"pages": ["01-first/index.md"]}')
    (m1 / "index.md").write_text(
        "# Milestone 1\n\n## Proof of work\n\n**Test file:** `tests/bets/b/test_milestone_1.py`\n"
    )
    (b / "pitch.md").write_text("---\nstatus: delivery\n---\n# Bet: B\n")
    init_repo(tmp_path)
    commit_all(tmp_path, "bet(b): approve decomposition")
    git(["tag", "bet/b/approved"], tmp_path)

    # The section needs at least one pending/open item to render at all (e).
    gw(["decisions", "add", "--bet", "b", "--question", "q", "--default", "d", "--rationale", "r"], tmp_path)

    # Undeclared edit to sealed prose after the tag.
    idx = m1 / "index.md"
    idx.write_text(idx.read_text() + "\nDrifted.\n")
    commit_all(tmp_path, "quiet drift")

    proc = gw(["status", "--bet", "b", "--write"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    written = (tmp_path / "docs" / "bets" / "b" / "status.md").read_text()
    assert "has drifted in 1 file" in written
    assert "worth asking about" in written


def test_drift_alone_never_earns_the_section(tmp_path):
    # (e) restated: seal drift with nothing pending/open must not, on its own,
    # cause the section to appear.
    b = tmp_path / "docs" / "bets" / "b"
    (b / "technical-design").mkdir(parents=True)
    (b / "technical-design" / "03-api-design.md").write_text("# API\n")
    m1 = b / "decomposition" / "01-first"
    m1.mkdir(parents=True)
    (b / "decomposition" / "meta.json").write_text('{"pages": ["01-first/index.md"]}')
    (m1 / "index.md").write_text(
        "# Milestone 1\n\n## Proof of work\n\n**Test file:** `tests/bets/b/test_milestone_1.py`\n"
    )
    (b / "pitch.md").write_text("---\nstatus: delivery\n---\n# Bet: B\n")
    init_repo(tmp_path)
    commit_all(tmp_path, "bet(b): approve decomposition")
    git(["tag", "bet/b/approved"], tmp_path)

    idx = m1 / "index.md"
    idx.write_text(idx.read_text() + "\nDrifted.\n")
    commit_all(tmp_path, "quiet drift")

    proc = gw(["status", "--bet", "b", "--write"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    written = (tmp_path / "docs" / "bets" / "b" / "status.md").read_text()
    assert "Waiting on you" not in written
