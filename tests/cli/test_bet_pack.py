"""Contract tests for the Wave-2 engine verb `groundwork pack build|refresh|check`.

The verb mechanizes the milestone context pack the delivery driver used to
distil by hand (W1.3). The load-bearing behaviors:

  * the pack carries POINTERS AND LEARNINGS, NEVER CONTRACT TEXT — the generator
    must never copy design-doc content into the pack (paths and anchors only);
  * the `<!-- driver-notes:start/end -->` block is the driver's judgment surface
    and survives every rebuild verbatim;
  * staleness is mechanical — stale exactly when `compiled_from` differs from the
    sha the `bet/<slug>/approved` tag points at, so an amendment (tag re-point)
    makes `check` fail-closed (exit 1) and `refresh` regenerate, while a fresh
    pack makes `refresh` a no-op.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import json
import os
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"

CONTRACT_MARKER = "CONTRACT_MARKER_NEVER_COPIED_INTO_PACK"


def gw(args, cwd, *, check_returncode=None):
    proc = subprocess.run(
        ["node", str(CLI), *args],
        cwd=cwd, capture_output=True, text=True,
        env={"GROUNDWORK_NO_UPDATE_CHECK": "1", "PATH": os.environ["PATH"]},
    )
    if check_returncode is not None:
        assert proc.returncode == check_returncode, f"args={args}\nstdout={proc.stdout}\nstderr={proc.stderr}"
    return proc


def git(cwd, *args):
    return subprocess.run(
        ["git", "-c", "user.email=t@t", "-c", "user.name=t", *args],
        cwd=cwd, capture_output=True, text=True, check=True,
    ).stdout.strip()


PACK = Path(".groundwork/cache/bets/b/milestone-01-context.md")


@pytest.fixture
def sealed_bet(tmp_path):
    """A minimal sealed bet: one milestone, one slice naming a technical-design
    file and a Test file, committed and tagged bet/b/approved."""
    design = tmp_path / "docs/bets/b/technical-design"
    milestone = tmp_path / "docs/bets/b/decomposition/01-first"
    design.mkdir(parents=True)
    milestone.mkdir(parents=True)
    (design / "03-api-design.md").write_text(
        f"# API design\n\n{CONTRACT_MARKER}: POST /api/things returns 201 with a thing_id.\n"
    )
    (milestone / "index.md").write_text(
        "# Milestone 1: First\n\n"
        "**Test file:** `tests/bets/b/test_milestone_1_first.py` — drives the "
        "interfaces in `technical-design/03-api-design.md`.\n"
    )
    (milestone / "01-do-thing.md").write_text(
        "# Slice 1.1 — svc: Do Thing\n\n"
        "Implements the interface in `technical-design/03-api-design.md`.\n\n"
        "**Test file:** `tests/bets/b/test_slice_1_svc_do-thing.py` — traces to the interface.\n"
    )
    git(tmp_path, "init", "-q")
    git(tmp_path, "add", "-A")
    git(tmp_path, "commit", "-qm", "seal bet b")
    git(tmp_path, "tag", "bet/b/approved")
    return tmp_path


def approved_sha(cwd):
    return git(cwd, "rev-parse", "bet/b/approved^{commit}")


def amend(cwd):
    """An amendment: a new commit re-pointing the approved tag."""
    p = Path(cwd) / "docs/bets/b/technical-design/03-api-design.md"
    p.write_text(p.read_text() + "\namended shape\n")
    git(cwd, "add", "-A")
    git(cwd, "commit", "-qm", "bet(b): amend milestone 1 proof — test")
    git(cwd, "tag", "-f", "bet/b/approved")


# ─── build ───────────────────────────────────────────────────────────────────

def test_build_writes_pack_with_compiled_from(sealed_bet):
    gw(["pack", "build", "--bet", "b", "--milestone", "1"], sealed_bet, check_returncode=0)
    content = (sealed_bet / PACK).read_text()
    assert f"compiled_from: {approved_sha(sealed_bet)}" in content
    assert "milestone: 01" in content


def test_build_pack_carries_pointers(sealed_bet):
    gw(["pack", "build", "--bet", "b", "--milestone", "1"], sealed_bet, check_returncode=0)
    content = (sealed_bet / PACK).read_text()
    # The design file the slice names, the milestone index, the slice file + its test path.
    assert "docs/bets/b/technical-design/03-api-design.md" in content
    assert "docs/bets/b/decomposition/01-first/index.md" in content
    assert "docs/bets/b/decomposition/01-first/01-do-thing.md" in content
    assert "tests/bets/b/test_slice_1_svc_do-thing.py" in content


def test_build_never_copies_contract_text(sealed_bet):
    # THE invariant: pointers and learnings, never contract text.
    gw(["pack", "build", "--bet", "b", "--milestone", "1"], sealed_bet, check_returncode=0)
    assert CONTRACT_MARKER not in (sealed_bet / PACK).read_text()


def test_build_harvests_learnings_from_state(sealed_bet):
    gw(["findings", "add", "--bet", "b", "--milestone", "1", "--bucket", "patch",
        "--title", "missing null guard"], sealed_bet, check_returncode=0)
    gw(["decisions", "add", "--bet", "b", "--question", "fmt", "--default", "json",
        "--rationale", "diff-friendly"], sealed_bet, check_returncode=0)
    gw(["decisions", "ratify", "--bet", "b", "--id", "D1", "--response", "ok"],
       sealed_bet, check_returncode=0)
    reports = sealed_bet / ".groundwork/cache/bets/b/reports"
    reports.mkdir(parents=True)
    (reports / "1-1.md").write_text("worker report\n")
    (sealed_bet / ".groundwork/cache/bets/b/memlog.md").write_text(
        "\n".join(f"line {i}" for i in range(30)) + "\n"
    )
    gw(["pack", "build", "--bet", "b", "--milestone", "1"], sealed_bet, check_returncode=0)
    content = (sealed_bet / PACK).read_text()
    assert "F1 [open] missing null guard" in content
    assert "D1: fmt → json" in content
    assert ".groundwork/cache/bets/b/reports/1-1.md" in content
    assert "line 29" in content and "line 5" not in content  # ~15-line tail only


def test_build_preserves_driver_notes(sealed_bet):
    gw(["pack", "build", "--bet", "b", "--milestone", "1"], sealed_bet, check_returncode=0)
    pack = sealed_bet / PACK
    content = pack.read_text()
    pack.write_text(content.replace(
        "<!-- driver-notes:start -->",
        "<!-- driver-notes:start -->\nWORKTREE FACT: scratch DB on port 5433",
    ))
    gw(["pack", "build", "--bet", "b", "--milestone", "1"], sealed_bet, check_returncode=0)
    assert "WORKTREE FACT: scratch DB on port 5433" in pack.read_text()


# ─── refresh ─────────────────────────────────────────────────────────────────

def test_refresh_is_noop_when_fresh(sealed_bet):
    gw(["pack", "build", "--bet", "b", "--milestone", "1"], sealed_bet, check_returncode=0)
    before = (sealed_bet / PACK).read_text()
    proc = gw(["pack", "refresh", "--bet", "b", "--milestone", "1"], sealed_bet, check_returncode=0)
    assert "fresh" in proc.stdout
    assert (sealed_bet / PACK).read_text() == before


def test_refresh_regenerates_after_amendment(sealed_bet):
    gw(["pack", "build", "--bet", "b", "--milestone", "1"], sealed_bet, check_returncode=0)
    pack = sealed_bet / PACK
    pack.write_text(pack.read_text().replace(
        "<!-- driver-notes:start -->", "<!-- driver-notes:start -->\nKEEP ME",
    ))
    old_sha = approved_sha(sealed_bet)
    amend(sealed_bet)
    new_sha = approved_sha(sealed_bet)
    assert new_sha != old_sha
    gw(["pack", "refresh", "--bet", "b", "--milestone", "1"], sealed_bet, check_returncode=0)
    content = pack.read_text()
    assert f"compiled_from: {new_sha}" in content
    assert "KEEP ME" in content  # driver notes survive the amendment recompile


def test_refresh_builds_missing_pack(sealed_bet):
    gw(["pack", "refresh", "--bet", "b", "--milestone", "1"], sealed_bet, check_returncode=0)
    assert f"compiled_from: {approved_sha(sealed_bet)}" in (sealed_bet / PACK).read_text()


# ─── check ───────────────────────────────────────────────────────────────────

def test_check_exit_codes_across_lifecycle(sealed_bet):
    # Missing → 1; built → 0; amended (tag re-pointed) → 1; refreshed → 0.
    assert gw(["pack", "check", "--bet", "b", "--milestone", "1"], sealed_bet).returncode == 1
    gw(["pack", "build", "--bet", "b", "--milestone", "1"], sealed_bet, check_returncode=0)
    assert gw(["pack", "check", "--bet", "b", "--milestone", "1"], sealed_bet).returncode == 0
    amend(sealed_bet)
    assert gw(["pack", "check", "--bet", "b", "--milestone", "1"], sealed_bet).returncode == 1
    gw(["pack", "refresh", "--bet", "b", "--milestone", "1"], sealed_bet, check_returncode=0)
    assert gw(["pack", "check", "--bet", "b", "--milestone", "1"], sealed_bet).returncode == 0


def test_check_json_payload(sealed_bet):
    gw(["pack", "build", "--bet", "b", "--milestone", "1"], sealed_bet, check_returncode=0)
    amend(sealed_bet)
    proc = gw(["pack", "check", "--bet", "b", "--milestone", "1", "--json"], sealed_bet)
    payload = json.loads(proc.stdout)
    assert proc.returncode == 1
    assert payload["status"] == "stale"
    assert payload["tag_sha"] == approved_sha(sealed_bet)
    assert payload["compiled_from"] != payload["tag_sha"]


# ─── errors ──────────────────────────────────────────────────────────────────

def test_no_approved_tag_exits_2(sealed_bet):
    git(sealed_bet, "tag", "-d", "bet/b/approved")
    for sub in ("build", "refresh", "check"):
        assert gw(["pack", sub, "--bet", "b", "--milestone", "1"], sealed_bet).returncode == 2


def test_not_a_git_repo_exits_2(tmp_path):
    assert gw(["pack", "build", "--bet", "b", "--milestone", "1"], tmp_path).returncode == 2


def test_missing_milestone_dir_exits_1(sealed_bet):
    assert gw(["pack", "build", "--bet", "b", "--milestone", "2"], sealed_bet).returncode == 1


def test_flag_discipline(sealed_bet):
    assert gw(["pack", "build", "--milestone", "1"], sealed_bet).returncode == 1
    assert gw(["pack", "build", "--bet", "b"], sealed_bet).returncode == 1
    assert gw(["pack", "wat", "--bet", "b", "--milestone", "1"], sealed_bet).returncode == 1
