"""Contract tests for the Wave-3 runtime-verification verb: `groundwork mutate`.

The verb mechanizes the DELETION TEST: revert the slice's source changes to the
sealed baseline (`bet/<slug>/approved`, or `--since <sha>`) while keeping its
tests at HEAD, run the slice's test command, and demand red. A suite that stays
green with the implementation deleted proves nothing. Load-bearing behaviors:

  * exit 0 when the tests bite (the command goes red against the reverted
    stub), exit 1 when the command stays green — green-after-deletion is the
    finding, so it is CI-safe like the other engine gates;
  * SAFETY: exit 2 with nothing touched on a dirty working tree — the verb
    never stashes or destroys uncommitted work; and
  * restoration is unconditional — after any run the working tree is clean and
    every file is byte-identical to its pre-run HEAD content.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"

# The slice's test command — sys.executable, not "python", to dodge PATH games;
# -B so no __pycache__/ lands in the fixture repo (the clean-status assertions
# below must see only what the verb itself touched).
def mut_cmd():
    return [sys.executable, "-B", "tests/test_mod.py"]


def gw(args, cwd, *, check_returncode=None):
    proc = subprocess.run(
        ["node", str(CLI), *args],
        cwd=cwd, capture_output=True, text=True,
        env={"GROUNDWORK_NO_UPDATE_CHECK": "1", "PATH": os.environ["PATH"]},
    )
    if check_returncode is not None:
        assert proc.returncode == check_returncode, f"args={args}\nstdout={proc.stdout}\nstderr={proc.stderr}"
    return proc


def mutate(cwd, *extra, command=None, check_returncode=None):
    return gw(
        ["mutate", "--bet", "b", "--slice", "tests/test_mod.py", *extra,
         "--", *(command or mut_cmd())],
        cwd, check_returncode=check_returncode,
    )


def git(cwd, *args):
    return subprocess.run(
        ["git", "-c", "user.email=t@t", "-c", "user.name=t", *args],
        cwd=cwd, check=True, capture_output=True, text=True,
    ).stdout


def commit_all(cwd, msg):
    git(cwd, "add", "-A")
    git(cwd, "commit", "-m", msg)


STUB = "def add(a, b):\n    raise NotImplementedError\n"
IMPL = "def add(a, b):\n    return a + b\n"
# A test that ACTUALLY asserts behavior — red against the stub, green at HEAD.
BITING_TEST = (
    "import sys, pathlib\n"
    "sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / 'src'))\n"
    "from mod import add\n"
    "assert add(2, 3) == 5\n"
    "print('ok')\n"
)


@pytest.fixture
def repo(tmp_path):
    """Sealed baseline: stub raising NotImplementedError + a biting test, tagged
    approved; then the slice implements the source at HEAD (plus a helper file
    born after the baseline, so the deletion path is exercised too)."""
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "mod.py").write_text(STUB)
    (tmp_path / "tests").mkdir()
    (tmp_path / "tests" / "test_mod.py").write_text(BITING_TEST)
    git(tmp_path, "init", "-q")
    commit_all(tmp_path, "seal: stub + biting test")
    git(tmp_path, "tag", "bet/b/approved")
    (tmp_path / "src" / "mod.py").write_text(IMPL)
    (tmp_path / "src" / "helper.py").write_text("HELPED = True\n")
    commit_all(tmp_path, "slice 1.1: implement add")
    return tmp_path


def tree_snapshot(cwd):
    files = [cwd / "src" / "mod.py", cwd / "src" / "helper.py", cwd / "tests" / "test_mod.py"]
    return {p: (p.read_bytes() if p.exists() else None) for p in files}


# ─── (a) biting tests → exit 0 ───────────────────────────────────────────────

def test_biting_tests_pass_the_deletion_test(repo):
    proc = mutate(repo, check_returncode=0)
    assert "bite" in proc.stdout


# ─── (b) vacuous tests → exit 1, the sharp message ───────────────────────────

def test_vacuous_tests_are_the_finding(repo):
    # Gut the test at HEAD — green whatever the implementation does.
    (repo / "tests" / "test_mod.py").write_text("assert True\nprint('ok')\n")
    commit_all(repo, "slice 1.2: gut the test")
    proc = mutate(repo)
    assert proc.returncode == 1
    assert "do not bite" in proc.stderr and "deleted" in proc.stderr


# ─── (c) SAFETY: dirty working tree → exit 2, nothing touched ────────────────

def test_dirty_tree_refused_and_untouched(repo):
    (repo / "src" / "mod.py").write_text(IMPL + "# uncommitted work\n")
    before = tree_snapshot(repo)
    proc = mutate(repo)
    assert proc.returncode == 2
    assert "uncommitted" in proc.stderr and "never stash" in proc.stderr
    assert tree_snapshot(repo) == before  # the uncommitted edit survives, byte-identical


# ─── (d) restoration: unconditional, byte-identical, clean status ────────────

@pytest.mark.parametrize("gut_test", [False, True], ids=["biting", "vacuous"])
def test_restoration_after_any_run(repo, gut_test):
    if gut_test:
        (repo / "tests" / "test_mod.py").write_text("assert True\n")
        commit_all(repo, "gut")
    before = tree_snapshot(repo)
    mutate(repo, check_returncode=1 if gut_test else 0)
    assert git(repo, "status", "--porcelain").strip() == ""
    assert tree_snapshot(repo) == before


def test_restoration_after_crashing_test_command(repo):
    # A command that dies instantly is a bite (non-zero), never lost files.
    before = tree_snapshot(repo)
    mutate(repo, command=[sys.executable, "-c", "raise SystemExit(7)"], check_returncode=0)
    assert git(repo, "status", "--porcelain").strip() == ""
    assert tree_snapshot(repo) == before


def test_born_after_baseline_file_is_deleted_then_restored(repo):
    # helper.py did not exist at the tag: the deletion test must delete it for
    # the run (a file born in the slice IS implementation) and restore it after.
    # The probe "test command" goes green only when helper.py is gone mid-run,
    # so a verdict of 1 (green-after-deletion) proves the deletion happened.
    probe = (
        "import pathlib, sys\n"
        "sys.exit(0 if not (pathlib.Path('src') / 'helper.py').exists() else 3)\n"
    )
    proc = mutate(repo, command=[sys.executable, "-c", probe])
    assert proc.returncode == 1  # green mid-run == helper.py really was deleted
    assert (repo / "src" / "helper.py").read_text() == "HELPED = True\n"  # restored
    assert git(repo, "status", "--porcelain").strip() == ""


# ─── (e) nothing to revert ───────────────────────────────────────────────────

def test_no_source_changes_in_range(repo):
    head = git(repo, "rev-parse", "HEAD").strip()
    (repo / "docs").mkdir()
    (repo / "docs" / "notes.md").write_text("prose only\n")
    commit_all(repo, "docs-only change")
    # docs/ and tests are excluded — nothing in range is source.
    proc = mutate(repo, "--since", head, check_returncode=0)
    assert "nothing to revert" in proc.stdout
    proc = mutate(repo, "--since", head, "--json")
    payload = json.loads(proc.stdout)
    assert payload["no_source_changes"] is True and payload["reverted_files"] == []
    assert proc.returncode == 0


# ─── (f) --json shape ────────────────────────────────────────────────────────

def test_json_shape(repo):
    proc = mutate(repo, "--json", check_returncode=0)
    payload = json.loads(proc.stdout)
    assert {"bite", "reverted_files", "test_exit", "no_source_changes"} <= set(payload)
    assert payload["bite"] is True
    assert payload["no_source_changes"] is False
    assert payload["test_exit"] != 0
    assert sorted(payload["reverted_files"]) == ["src/helper.py", "src/mod.py"]
    assert payload["baseline"] == "bet/b/approved"


def test_json_shape_when_tests_do_not_bite(repo):
    (repo / "tests" / "test_mod.py").write_text("assert True\n")
    commit_all(repo, "gut")
    proc = mutate(repo, "--json")
    payload = json.loads(proc.stdout)
    assert payload["bite"] is False and payload["test_exit"] == 0
    assert proc.returncode == 1  # json AND the gating exit


# ─── cannot-run + arg discipline ─────────────────────────────────────────────

def test_no_git_repo_exits_2(tmp_path):
    assert mutate(tmp_path).returncode == 2


def test_no_approved_tag_exits_2(tmp_path):
    git(tmp_path, "init", "-q")
    (tmp_path / "x.txt").write_text("x\n")
    commit_all(tmp_path, "init")
    proc = mutate(tmp_path)
    assert proc.returncode == 2
    assert "bet/b/approved" in proc.stderr


def test_unspawnable_test_command_exits_2(repo):
    # ENOENT must never masquerade as "the tests bite" — and still restores.
    before = tree_snapshot(repo)
    proc = mutate(repo, command=["definitely-not-a-command-9f3a"])
    assert proc.returncode == 2
    assert tree_snapshot(repo) == before
    assert git(repo, "status", "--porcelain").strip() == ""


def test_required_args(repo):
    assert gw(["mutate", "--slice", "t.py", "--", "true"], repo).returncode == 1  # no --bet
    assert gw(["mutate", "--bet", "b", "--", "true"], repo).returncode == 1  # no --slice
    assert gw(["mutate", "--bet", "b", "--slice", "t.py"], repo).returncode == 1  # no command
    assert gw(["mutate", "--bet", "b", "--slice", "t.py", "--timeout", "nope", "--", "true"], repo).returncode == 1
