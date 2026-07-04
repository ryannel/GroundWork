"""Contract tests for `groundwork state` — the composed bet-state view (Wave 2 capstone, v1).

One document composes every engine fact about a bet: sealed baseline, seal
integrity, findings ledger, decisions queue, per-milestone pack freshness, and
the cache-tier board pointer. `--check` is the aggregate CI gate: non-zero on
seal drift, open findings, or a stale pack. The board and pitch status report
but never gate (the Wave-1 contract).

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import json
import os
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"


def gw(args, cwd):
    return subprocess.run(
        ["node", str(CLI), *args], cwd=cwd, capture_output=True, text=True,
        env={"GROUNDWORK_NO_UPDATE_CHECK": "1", "PATH": os.environ["PATH"]},
    )


def git(args, cwd):
    subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t", *args],
                   cwd=cwd, capture_output=True, text=True, check=True)


@pytest.fixture()
def bet(tmp_path):
    """A minimal sealed bet: pitch, one-milestone decomposition, approved tag."""
    root = tmp_path
    b = root / "docs" / "bets" / "b"
    (b / "technical-design").mkdir(parents=True)
    (b / "technical-design" / "03-api-design.md").write_text("# API\n")
    m1 = b / "decomposition" / "01-first"
    m1.mkdir(parents=True)
    (b / "decomposition" / "meta.json").write_text('{"pages": ["01-first/index.md"]}')
    (m1 / "index.md").write_text(
        "# Milestone 1\n\n## Proof of work\n\n**Test file:** `tests/bets/b/test_milestone_1.py`\n"
        "See `technical-design/03-api-design.md`.\n"
    )
    (b / "pitch.md").write_text("---\nstatus: delivery\n---\n# Bet: B\n")
    git(["init", "-q"], root)
    git(["add", "-A"], root)
    git(["commit", "-q", "-m", "bet(b): approve decomposition"], root)
    git(["tag", "bet/b/approved"], root)
    return root


def test_state_composes_clean_bet(bet):
    proc = gw(["state", "--bet", "b", "--json"], bet)
    assert proc.returncode == 0, proc.stderr
    doc = json.loads(proc.stdout)
    assert doc["bet"] == "b"
    assert doc["approved"]["tag"] == "bet/b/approved" and doc["approved"]["sha"]
    assert doc["pitch_status"] == "delivery"
    assert doc["seal"]["status"] == "sealed"
    assert doc["findings"] == {"open": 0, "closed": 0, "open_items": []}
    assert doc["decisions"]["pending"] == 0
    assert doc["clean"] is True


def test_state_check_gates_on_open_finding(bet):
    gw(["findings", "add", "--bet", "b", "--bucket", "patch", "--title", "x"], bet)
    assert gw(["state", "--bet", "b", "--check"], bet).returncode == 1
    gw(["findings", "disposition", "--bet", "b", "--id", "F1", "--as", "fixed"], bet)
    assert gw(["state", "--bet", "b", "--check"], bet).returncode == 0


def test_state_check_gates_on_seal_drift(bet):
    # Undeclared edit to sealed prose after the tag.
    idx = bet / "docs" / "bets" / "b" / "decomposition" / "01-first" / "index.md"
    idx.write_text(idx.read_text() + "\nDrifted.\n")
    git(["add", "-A"], bet)
    git(["commit", "-q", "-m", "quiet drift"], bet)
    proc = gw(["state", "--bet", "b", "--json"], bet)
    doc = json.loads(proc.stdout)
    assert doc["seal"]["status"] == "drift" and doc["clean"] is False
    assert gw(["state", "--bet", "b", "--check"], bet).returncode == 1


def test_state_check_gates_on_stale_pack(bet):
    gw(["pack", "build", "--bet", "b", "--milestone", "1"], bet)
    doc = json.loads(gw(["state", "--bet", "b", "--json"], bet).stdout)
    assert doc["packs"][0]["status"] == "fresh"
    # Amendment: commit + re-point the tag -> pack goes stale.
    (bet / "docs" / "bets" / "b" / "decomposition" / "01-first" / "index.md").write_text("# Amended\n\n**Test file:** `t.py`\n")
    git(["add", "-A"], bet)
    git(["commit", "-q", "-m", "bet(b): amend milestone 1 proof — reason"], bet)
    git(["tag", "-f", "bet/b/approved"], bet)
    doc = json.loads(gw(["state", "--bet", "b", "--json"], bet).stdout)
    assert doc["packs"][0]["status"] == "stale"
    assert gw(["state", "--bet", "b", "--check"], bet).returncode == 1
    gw(["pack", "refresh", "--bet", "b", "--milestone", "1"], bet)
    assert gw(["state", "--bet", "b", "--check"], bet).returncode == 0


def test_pending_decisions_report_but_do_not_gate(bet):
    gw(["decisions", "add", "--bet", "b", "--question", "q", "--default", "d", "--rationale", "r"], bet)
    doc = json.loads(gw(["state", "--bet", "b", "--json"], bet).stdout)
    assert doc["decisions"]["pending"] == 1
    assert doc["decisions"]["pending_items"][0]["id"] == "D1"
    # Pending decisions batch to the next checkpoint — they never block the loop.
    assert gw(["state", "--bet", "b", "--check"], bet).returncode == 0


def test_board_reported_when_present(bet):
    board = bet / ".groundwork" / "cache" / "bets" / "b"
    board.mkdir(parents=True)
    (board / "board.yaml").write_text("bet: b\nmode: milestone\nstep: step-02-slice-loop\nupdated: 2026-07-04T00:00:00Z\n")
    doc = json.loads(gw(["state", "--bet", "b", "--json"], bet).stdout)
    assert doc["board"] == {"present": True, "step": "step-02-slice-loop", "mode": "milestone", "updated": "2026-07-04T00:00:00Z"}


def test_state_without_tag_exits_2(tmp_path):
    git(["init", "-q"], tmp_path)
    (tmp_path / "x").write_text("x")
    git(["add", "-A"], tmp_path)
    git(["commit", "-q", "-m", "init"], tmp_path)
    assert gw(["state", "--bet", "b"], tmp_path).returncode == 2


def test_state_requires_bet_flag(bet):
    assert gw(["state"], bet).returncode == 1
