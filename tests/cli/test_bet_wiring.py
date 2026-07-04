"""Contract tests for the Wave-3 engine verb: `groundwork wiring scan`.

The scan is the COMPUTABLE half of the built-but-never-wired audit (escape
class d) — it diffs HEAD against the sealed baseline (`bet/<slug>/approved`)
for interactive elements that exist in code but can't be reached in use:
empty or TODO-only handler bodies on known framework shapes, and
handler-shaped functions with no reachable caller (best-effort word-grep).
Its findings are leads for the review wave, never verdicts. Load-bearing
behaviors:

  * exit 1 on any lead, exit 0 clean — CI-safe like `honesty scan`; and
  * exit 2 when the scan CANNOT run (no approved tag, not a git repo) —
    cannot-run must never masquerade as clean.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import json
import os
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"


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
    subprocess.run(
        ["git", "-c", "user.email=t@t", "-c", "user.name=t", *args],
        cwd=cwd, check=True, capture_output=True, text=True,
    )


def commit_all(cwd, msg):
    git(cwd, "add", "-A")
    git(cwd, "commit", "-m", msg)


def seal_bet(tmp_path):
    """A minimal sealed bet: one wired UI component — tagged approved."""
    src = tmp_path / "src"
    src.mkdir(parents=True)
    (src / "App.tsx").write_text(
        "export function App() {\n"
        "  return <button onClick={() => save()}>Save</button>;\n"
        "}\n"
    )
    git(tmp_path, "init", "-q")
    commit_all(tmp_path, "seal")
    git(tmp_path, "tag", "bet/b/approved")
    return tmp_path


def scan(cwd, *extra, check_returncode=None):
    return gw(["wiring", "scan", "--bet", "b", *extra], cwd, check_returncode=check_returncode)


def scan_json(cwd):
    proc = scan(cwd, "--json")
    return proc, json.loads(proc.stdout)


# ─── cannot-run: exit 2, never a fake clean ──────────────────────────────────

def test_no_git_repo_exits_2(tmp_path):
    assert scan(tmp_path).returncode == 2


def test_no_approved_tag_exits_2(tmp_path):
    git(tmp_path, "init", "-q")
    (tmp_path / "x.txt").write_text("x\n")
    commit_all(tmp_path, "init")
    proc = scan(tmp_path)
    assert proc.returncode == 2
    assert "bet/b/approved" in proc.stderr


def test_bet_flag_required(tmp_path):
    assert gw(["wiring", "scan"], tmp_path).returncode == 1
    assert gw(["wiring", "wat", "--bet", "b"], tmp_path).returncode == 1


# ─── clean repo: exit 0 ──────────────────────────────────────────────────────

def test_clean_repo_exits_0(tmp_path):
    seal_bet(tmp_path)
    scan(tmp_path, check_returncode=0)
    proc, payload = scan_json(tmp_path)
    assert proc.returncode == 0
    assert payload == {"clean": True, "findings": []}


# ─── empty actions ───────────────────────────────────────────────────────────

def test_empty_onclick_is_a_lead(tmp_path):
    seal_bet(tmp_path)
    (tmp_path / "src" / "Panel.tsx").write_text(
        "export function Panel() {\n"
        "  return <button onClick={() => {}}>Cancel</button>;\n"
        "}\n"
    )
    commit_all(tmp_path, "add hollow control")
    proc, payload = scan_json(tmp_path)
    assert proc.returncode == 1 and payload["clean"] is False
    (f,) = [x for x in payload["findings"] if x["check"] == "empty-action"]
    assert f["file"] == "src/Panel.tsx" and f["symbol"] == "onClick"
    assert "empty" in f["detail"]


def test_todo_only_handler_is_a_lead(tmp_path):
    seal_bet(tmp_path)
    (tmp_path / "src" / "Panel.tsx").write_text(
        "export function Panel() {\n"
        "  return <button onPress={() => { /* TODO: wire delete */ }}>Delete</button>;\n"
        "}\n"
    )
    commit_all(tmp_path, "add deferred wiring")
    proc, payload = scan_json(tmp_path)
    assert proc.returncode == 1
    (f,) = [x for x in payload["findings"] if x["check"] == "empty-action"]
    assert f["symbol"] == "onPress" and "TODO" in f["detail"]


def test_wired_handler_body_is_not_a_lead(tmp_path):
    seal_bet(tmp_path)
    (tmp_path / "src" / "Panel.tsx").write_text(
        "export function Panel() {\n"
        "  return <button onClick={() => persist()}>Save</button>;\n"
        "}\n"
    )
    commit_all(tmp_path, "add real control")
    scan(tmp_path, check_returncode=0)


# ─── unreachable handlers (best-effort) ──────────────────────────────────────

def test_handler_with_no_references_is_a_best_effort_lead(tmp_path):
    seal_bet(tmp_path)
    (tmp_path / "src" / "save.ts").write_text(
        "export function handleSave() { return persist(); }\n"
    )
    commit_all(tmp_path, "add orphan handler")
    proc, payload = scan_json(tmp_path)
    assert proc.returncode == 1
    (f,) = [x for x in payload["findings"] if x["check"] == "unreachable-handler"]
    assert f["file"] == "src/save.ts" and f["symbol"] == "handleSave"
    assert f["detail"].startswith("[best-effort]")


def test_referenced_handler_is_not_a_lead(tmp_path):
    seal_bet(tmp_path)
    # Same-file JSX reference: defined AND wired within the changed file.
    (tmp_path / "src" / "Panel.tsx").write_text(
        "export function Panel() {\n"
        "  const handleSave = () => persist();\n"
        "  return <button onClick={handleSave}>Save</button>;\n"
        "}\n"
    )
    # Cross-file reference: defined in one changed file, wired from another.
    (tmp_path / "src" / "load.ts").write_text(
        "export function handleLoad() { return fetchAll(); }\n"
    )
    (tmp_path / "src" / "main.ts").write_text(
        "import { handleLoad } from './load';\n"
        "document.addEventListener('load', handleLoad);\n"
    )
    commit_all(tmp_path, "add wired handlers")
    scan(tmp_path, check_returncode=0)


def test_test_files_neither_flagged_nor_count_as_wiring(tmp_path):
    seal_bet(tmp_path)
    # A handler whose only reference lives in a test file is still unwired.
    (tmp_path / "src" / "share.ts").write_text(
        "export function handleShare() { return share(); }\n"
    )
    tests = tmp_path / "tests"
    tests.mkdir()
    (tests / "share.test.ts").write_text(
        "import { handleShare } from '../src/share';\nhandleShare();\n"
    )
    commit_all(tmp_path, "add test-only handler")
    proc, payload = scan_json(tmp_path)
    assert proc.returncode == 1
    (f,) = [x for x in payload["findings"] if x["check"] == "unreachable-handler"]
    assert f["symbol"] == "handleShare"


def test_unrecognized_file_types_skip_silently(tmp_path):
    seal_bet(tmp_path)
    (tmp_path / "src" / "handlers.rb").write_text(
        "def handle_save\nend\n"
    )
    (tmp_path / "notes.md").write_text("onClick={() => {}}\n")
    commit_all(tmp_path, "add unscannable files")
    scan(tmp_path, check_returncode=0)


# ─── output contract ─────────────────────────────────────────────────────────

def test_json_shape_and_human_footer(tmp_path):
    seal_bet(tmp_path)
    (tmp_path / "src" / "Panel.tsx").write_text(
        "export function Panel() {\n"
        "  return <button onClick={() => {}}>Cancel</button>;\n"
        "}\n"
    )
    commit_all(tmp_path, "add hollow control")
    _, payload = scan_json(tmp_path)
    assert set(payload) == {"clean", "findings"}
    for f in payload["findings"]:
        assert {"check", "file", "detail"} <= set(f)
    human = scan(tmp_path)
    assert human.returncode == 1
    # Leads, not verdicts — the footer routes real ones to the findings ledger.
    assert "leads" in human.stderr and "findings add" in human.stderr
