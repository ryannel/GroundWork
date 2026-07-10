"""Contract tests for the queue-ownership footer on the Program section
(review-throughput plan, Workstream E, slice E6).

When `renderProgramMarkdown` renders one or more queued bets, it appends
exactly one italic footer line right after the queued bullets, naming
`.groundwork/cache/discovery-notes.md`'s `## Bets` list as the user's own
reorderable backlog. It rides the shared renderer, so it appears in both the
chat snapshot (`status`) and the written page (`status --write`) — this is one
of the plan's two sanctioned chat-render changes.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import os
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"

FOOTER = "_Queue order is yours: reorder the bullets under `## Bets` in `.groundwork/cache/discovery-notes.md` to reorder it._"


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


def write_queue(root, *bullets):
    notes = root / ".groundwork" / "cache"
    notes.mkdir(parents=True, exist_ok=True)
    body = "\n".join(f"- {b}" for b in bullets)
    (notes / "discovery-notes.md").write_text(f"# Discovery Notes\n\n## Bets\n\n{body}\n")


def test_footer_present_exactly_once_after_queued_bullets(tmp_path):
    init_repo(tmp_path)
    write_queue(tmp_path, "Bulk-tagging for the library", "Export to a shareable link")
    commit_all(tmp_path, "seed queue")

    proc = gw(["status"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    out = proc.stdout
    assert out.count(FOOTER) == 1
    assert out.index("Export to a shareable link") < out.index(FOOTER)


def test_footer_absent_when_no_queue(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    proc = gw(["status"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert "Queue order is yours" not in proc.stdout


def test_footer_absent_when_program_is_entirely_empty(tmp_path):
    init_repo(tmp_path)
    (tmp_path / "x").write_text("x")
    commit_all(tmp_path, "init")

    proc = gw(["status"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert "Queue order is yours" not in proc.stdout


def test_footer_rides_both_chat_and_written_renders(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_queue(tmp_path, "Someday: dark mode")
    commit_all(tmp_path, "seed")

    chat = gw(["status", "--bet", "widget-import"], tmp_path).stdout
    assert chat.count(FOOTER) == 1

    proc = gw(["status", "--bet", "widget-import", "--write"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    written = (tmp_path / "docs" / "bets" / "widget-import" / "status.md").read_text()
    assert written.count(FOOTER) == 1


def test_footer_still_absent_with_patches_but_no_queue(tmp_path):
    # Patches-only program: the footer names the queue specifically, never
    # fires off unrelated program content.
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed bet")
    (tmp_path / "a.txt").write_text("a")
    git(["add", "-A"], tmp_path)
    git(["commit", "-q", "-m", "fix(importer): tighten mime sniffing\n\nLane: patch\nArea: importer"], tmp_path)

    proc = gw(["status"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert "Queue order is yours" not in proc.stdout
