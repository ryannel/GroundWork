"""Contract tests for the Wave-2 mechanical gates: `groundwork gate` + `seal verify`.

These verbs compute the structural, fail-closed half of the delivery checklists the
driver walked by hand:

  * `gate decomposition` — the decomposition tree is structurally complete (meta.json,
    milestone index.md files, the first milestone sliced, a Proof-of-work section and a
    named Test file per unit, every slice link / meta page resolving);
  * `gate readiness` — that, plus the pitch is at status: delivery, technical-design/
    exists, and the bet/<slug>/approved tag is present;
  * `seal verify` — the sealed prose has not drifted from the approved tag (one
    git-pathspec diff — the mechanical form of the prose-integrity walk).

Exit codes: 0 pass, 1 a check failed / drift, 2 the gate could not run (no tag / no git).

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

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


def git(args, cwd, check=True):
    return subprocess.run(
        ["git", "-c", "user.email=t@t", "-c", "user.name=t", *args],
        cwd=cwd, capture_output=True, text=True, check=check,
    )


PROOF = "## Proof of work\n\n**Proves:** it works.\n\n**Test file:** `tests/bets/b/test_x.py`\n"


def seal_bet(root: Path, *, tag=True, git_init=True):
    """Lay down a minimal, structurally-complete sealed bet 'b' and (optionally) tag it."""
    bet = root / "docs" / "bets" / "b"
    (bet / "technical-design").mkdir(parents=True)
    (bet / "technical-design" / "03-api-design.md").write_text("# API\n\nThe `Store` interface.\n")
    (bet / "pitch.md").write_text("---\nstatus: delivery\n---\n\n# Bet: B\n")
    m = bet / "decomposition" / "01-capture"
    m.mkdir(parents=True)
    (bet / "decomposition" / "meta.json").write_text(
        '{"title":"D","pages":["01-capture/index.md","01-capture/01-add.md"]}'
    )
    (m / "index.md").write_text(
        "# Milestone 1: Capture\n\n" + PROOF + "\n## Slices\n\n- [Slice 1.1](./01-add.md)\n"
    )
    (m / "01-add.md").write_text("# Slice 1.1 — add\n\n" + PROOF)
    if git_init:
        git(["init", "-q"], root)
        git(["add", "-A"], root)
        git(["commit", "-q", "-m", "bet(b): approve decomposition"], root)
        if tag:
            git(["tag", "bet/b/approved"], root)
    return bet


# ─── gate decomposition ──────────────────────────────────────────────────────

def test_gate_decomposition_passes_on_complete_tree(tmp_path):
    seal_bet(tmp_path)
    assert gw(["gate", "decomposition", "--bet", "b"], tmp_path).returncode == 0


def test_gate_decomposition_fails_on_missing_meta(tmp_path):
    bet = seal_bet(tmp_path, git_init=False)
    (bet / "decomposition" / "meta.json").unlink()
    p = gw(["gate", "decomposition", "--bet", "b"], tmp_path)
    assert p.returncode == 1 and "meta.json" in p.stderr


def test_gate_decomposition_fails_on_dangling_slice_link(tmp_path):
    bet = seal_bet(tmp_path, git_init=False)
    (bet / "decomposition" / "01-capture" / "01-add.md").unlink()
    p = gw(["gate", "decomposition", "--bet", "b"], tmp_path)
    assert p.returncode == 1 and "slice links resolve" in p.stderr


def test_gate_decomposition_fails_on_missing_test_file(tmp_path):
    bet = seal_bet(tmp_path, git_init=False)
    (bet / "decomposition" / "01-capture" / "01-add.md").write_text("# Slice 1.1\n\n## Proof of work\n\nno test named\n")
    p = gw(["gate", "decomposition", "--bet", "b"], tmp_path)
    assert p.returncode == 1 and "Test file" in p.stderr


def test_gate_decomposition_fails_on_missing_proof(tmp_path):
    bet = seal_bet(tmp_path, git_init=False)
    (bet / "decomposition" / "01-capture" / "index.md").write_text(
        "# Milestone 1\n\nno proof section\n\n- [Slice 1.1](./01-add.md)\n"
    )
    p = gw(["gate", "decomposition", "--bet", "b"], tmp_path)
    assert p.returncode == 1 and "Proof of work" in p.stderr


def test_gate_decomposition_allows_later_milestone_unsliced(tmp_path):
    # A second milestone with only an index.md (sliced on arrival) must NOT fail.
    bet = seal_bet(tmp_path, git_init=False)
    m2 = bet / "decomposition" / "02-complete"
    m2.mkdir()
    (m2 / "index.md").write_text("# Milestone 2\n\n" + PROOF + "\n## Slices\n\n> Authored on arrival.\n")
    assert gw(["gate", "decomposition", "--bet", "b"], tmp_path).returncode == 0


def test_gate_decomposition_milestone_scope_requires_slices(tmp_path):
    # With --milestone 2 the (unsliced) second milestone must now be sliced → fail.
    bet = seal_bet(tmp_path, git_init=False)
    m2 = bet / "decomposition" / "02-complete"
    m2.mkdir()
    (m2 / "index.md").write_text("# Milestone 2\n\n" + PROOF + "\n## Slices\n\n> Authored on arrival.\n")
    p = gw(["gate", "decomposition", "--bet", "b", "--milestone", "2"], tmp_path)
    assert p.returncode == 1 and "milestone 2 sliced" in p.stderr


# ─── gate readiness ──────────────────────────────────────────────────────────

def test_gate_readiness_passes_on_sealed_bet(tmp_path):
    seal_bet(tmp_path)
    assert gw(["gate", "readiness", "--bet", "b"], tmp_path).returncode == 0


def test_gate_readiness_fails_without_tag(tmp_path):
    seal_bet(tmp_path, tag=False)
    p = gw(["gate", "readiness", "--bet", "b"], tmp_path)
    assert p.returncode == 1 and "approved tag" in p.stderr


def test_gate_readiness_fails_on_wrong_status(tmp_path):
    bet = seal_bet(tmp_path, git_init=False)
    (bet / "pitch.md").write_text("---\nstatus: discovery\n---\n\n# Bet: B\n")
    p = gw(["gate", "readiness", "--bet", "b"], tmp_path)
    assert p.returncode == 1 and "status" in p.stderr


# ─── seal verify ─────────────────────────────────────────────────────────────

def test_seal_verify_passes_when_sealed(tmp_path):
    seal_bet(tmp_path)
    assert gw(["seal", "verify", "--bet", "b"], tmp_path).returncode == 0


def test_seal_verify_detects_drift(tmp_path):
    bet = seal_bet(tmp_path)
    # A silent edit to the sealed technical design, no amendment / tag re-point.
    (bet / "technical-design" / "03-api-design.md").write_text("# API\n\nsilently changed\n")
    p = gw(["seal", "verify", "--bet", "b"], tmp_path)
    assert p.returncode == 1 and "03-api-design.md" in p.stderr


def test_seal_verify_passes_after_amendment_retag(tmp_path):
    # An amendment edits the prose, commits, and re-points the tag → sealed again.
    bet = seal_bet(tmp_path)
    (bet / "decomposition" / "01-capture" / "index.md").write_text(
        "# Milestone 1: Capture\n\n" + PROOF + "\n(amended)\n\n## Slices\n\n- [Slice 1.1](./01-add.md)\n"
    )
    git(["add", "-A"], tmp_path)
    git(["commit", "-q", "-m", "bet(b): amend milestone 1 proof — reason"], tmp_path)
    git(["tag", "-f", "bet/b/approved"], tmp_path)
    assert gw(["seal", "verify", "--bet", "b"], tmp_path).returncode == 0


def test_seal_verify_no_tag_exits_2(tmp_path):
    seal_bet(tmp_path, tag=False)
    assert gw(["seal", "verify", "--bet", "b"], tmp_path).returncode == 2


def test_seal_verify_no_git_exits_2(tmp_path):
    seal_bet(tmp_path, git_init=False)
    assert gw(["seal", "verify", "--bet", "b"], tmp_path).returncode == 2


# ─── arg discipline ──────────────────────────────────────────────────────────

def test_gate_requires_bet_and_known_sub(tmp_path):
    assert gw(["gate", "readiness"], tmp_path).returncode == 1        # no --bet
    assert gw(["gate", "wat", "--bet", "b"], tmp_path).returncode == 1  # unknown sub
    assert gw(["seal", "wat", "--bet", "b"], tmp_path).returncode == 1


def test_gate_json_output(tmp_path):
    import json
    seal_bet(tmp_path, tag=False)
    p = gw(["gate", "readiness", "--bet", "b", "--json"], tmp_path)
    payload = json.loads(p.stdout)
    assert payload["gate"] == "readiness" and payload["ok"] is False and p.returncode == 1
    assert any(not ch["ok"] and "approved tag" in ch["name"] for ch in payload["checks"])
