"""Contract tests for the Wave-2 engine verbs: `groundwork findings` + `groundwork decisions`.

These verbs replace the two hand-maintained prose mechanisms in the delivery
workflow — the findings ledger (W1.4) and the default+veto decisions queue (W1.6) —
with durable, machine-checkable state under `.groundwork/bets/<slug>/`. The two
load-bearing behaviors they must guarantee:

  * `findings check` exits NON-ZERO while any finding is open — the mechanical form
    of the milestone-close gate ("the milestone cannot close while any finding is
    open"), so it is CI-safe and cannot be rubber-stamped; and
  * `decisions ratify` records the owner's VERBATIM response as durable state — the
    human-in-the-loop exchange the exit-gate judge flagged as living only in a
    memlog line is now re-derivable from committed JSON.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import json
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"


def gw(args, cwd, *, check_returncode=None):
    proc = subprocess.run(
        ["node", str(CLI), *args],
        cwd=cwd, capture_output=True, text=True,
        env={"GROUNDWORK_NO_UPDATE_CHECK": "1", "PATH": __import__("os").environ["PATH"]},
    )
    if check_returncode is not None:
        assert proc.returncode == check_returncode, f"args={args}\nstdout={proc.stdout}\nstderr={proc.stderr}"
    return proc


def read_json(cwd, slug, name):
    return json.loads((Path(cwd) / ".groundwork" / "bets" / slug / name).read_text())


# ─── findings ────────────────────────────────────────────────────────────────

def test_findings_add_assigns_ids_and_persists(tmp_path):
    gw(["findings", "add", "--bet", "b", "--slice", "1.1", "--milestone", "1",
        "--lens", "edge-case-tracer", "--bucket", "patch", "--title", "traceback"],
       tmp_path, check_returncode=0)
    gw(["findings", "add", "--bet", "b", "--bucket", "defer", "--title", "ordering"],
       tmp_path, check_returncode=0)
    doc = read_json(tmp_path, "b", "findings.json")
    assert [f["id"] for f in doc["findings"]] == ["F1", "F2"]
    f1 = doc["findings"][0]
    assert f1["bucket"] == "patch" and f1["status"] == "open" and f1["milestone"] == 1
    assert f1["slice"] == "1.1" and f1["disposition"] is None


def test_findings_check_gates_on_open(tmp_path):
    gw(["findings", "add", "--bet", "b", "--milestone", "1", "--bucket", "patch", "--title", "x"], tmp_path)
    # Open finding → non-zero (the milestone-close gate).
    assert gw(["findings", "check", "--bet", "b", "--milestone", "1"], tmp_path).returncode == 1
    gw(["findings", "disposition", "--bet", "b", "--id", "F1", "--as", "fixed"], tmp_path, check_returncode=0)
    # Disposed → clear to close.
    assert gw(["findings", "check", "--bet", "b", "--milestone", "1"], tmp_path).returncode == 0


def test_findings_check_empty_is_clear(tmp_path):
    assert gw(["findings", "check", "--bet", "b"], tmp_path).returncode == 0


def test_findings_check_scopes_by_milestone(tmp_path):
    gw(["findings", "add", "--bet", "b", "--milestone", "1", "--bucket", "patch", "--title", "m1"], tmp_path)
    gw(["findings", "add", "--bet", "b", "--milestone", "2", "--bucket", "patch", "--title", "m2"], tmp_path)
    gw(["findings", "disposition", "--bet", "b", "--id", "F1", "--as", "fixed"], tmp_path)
    # Milestone 1 is clear even though milestone 2 still has an open finding.
    assert gw(["findings", "check", "--bet", "b", "--milestone", "1"], tmp_path).returncode == 0
    assert gw(["findings", "check", "--bet", "b", "--milestone", "2"], tmp_path).returncode == 1
    assert gw(["findings", "check", "--bet", "b"], tmp_path).returncode == 1  # whole bet


@pytest.mark.parametrize("disp", ["deferred-with-owner", "dismissed-with-reason"])
def test_findings_disposition_requires_note_for_defer_dismiss(tmp_path, disp):
    gw(["findings", "add", "--bet", "b", "--bucket", "defer", "--title", "x"], tmp_path)
    assert gw(["findings", "disposition", "--bet", "b", "--id", "F1", "--as", disp], tmp_path).returncode == 1
    gw(["findings", "disposition", "--bet", "b", "--id", "F1", "--as", disp, "--note", "owner: me"],
       tmp_path, check_returncode=0)
    doc = read_json(tmp_path, "b", "findings.json")
    assert doc["findings"][0]["status"] == "closed" and doc["findings"][0]["note"] == "owner: me"


def test_findings_add_rejects_bad_bucket(tmp_path):
    assert gw(["findings", "add", "--bet", "b", "--bucket", "nonsense", "--title", "x"], tmp_path).returncode == 1


def test_findings_disposition_rejects_unknown_id(tmp_path):
    assert gw(["findings", "disposition", "--bet", "b", "--id", "F9", "--as", "fixed"], tmp_path).returncode == 1


def test_findings_json_output(tmp_path):
    gw(["findings", "add", "--bet", "b", "--bucket", "patch", "--title", "x"], tmp_path)
    proc = gw(["findings", "check", "--bet", "b", "--json"], tmp_path)
    payload = json.loads(proc.stdout)
    assert payload["open"] == 1 and proc.returncode == 1  # json AND non-zero exit


# ─── decisions ───────────────────────────────────────────────────────────────

def test_decisions_add_and_pending(tmp_path):
    gw(["decisions", "add", "--bet", "b", "--milestone", "1", "--question", "fmt",
        "--default", "json", "--rationale", "diff-friendly"], tmp_path, check_returncode=0)
    doc = read_json(tmp_path, "b", "decisions.json")
    d = doc["decisions"][0]
    assert d["id"] == "D1" and d["status"] == "pending" and d["ratification"] is None
    proc = gw(["decisions", "pending", "--bet", "b", "--json"], tmp_path, check_returncode=0)
    assert json.loads(proc.stdout)[0]["id"] == "D1"


def test_decisions_ratify_records_verbatim_response(tmp_path):
    # This is the exit-gate carried finding: the human-in-the-loop exchange must be
    # durable, re-derivable state — not a narration line.
    gw(["decisions", "add", "--bet", "b", "--question", "q", "--default", "d", "--rationale", "r"], tmp_path)
    gw(["decisions", "ratify", "--bet", "b", "--all", "--response", "that's fine, ratified",
        "--at", "milestone-1 checkpoint"], tmp_path, check_returncode=0)
    d = read_json(tmp_path, "b", "decisions.json")["decisions"][0]
    assert d["status"] == "ratified"
    assert d["ratification"]["response"] == "that's fine, ratified"
    assert d["ratification"]["at"] == "milestone-1 checkpoint"
    assert d["ratification"]["outcome"] == "ratified" and d["ratification"]["ts"]


def test_decisions_ratify_requires_response(tmp_path):
    gw(["decisions", "add", "--bet", "b", "--question", "q", "--default", "d", "--rationale", "r"], tmp_path)
    # No --response → refuse (never let the exchange go unrecorded).
    assert gw(["decisions", "ratify", "--bet", "b", "--id", "D1"], tmp_path).returncode == 1
    assert read_json(tmp_path, "b", "decisions.json")["decisions"][0]["status"] == "pending"


def test_decisions_veto(tmp_path):
    gw(["decisions", "add", "--bet", "b", "--question", "q", "--default", "d", "--rationale", "r"], tmp_path)
    gw(["decisions", "ratify", "--bet", "b", "--id", "D1", "--as", "vetoed", "--response", "no"],
       tmp_path, check_returncode=0)
    assert read_json(tmp_path, "b", "decisions.json")["decisions"][0]["status"] == "vetoed"


def test_decisions_ratify_rejects_already_settled(tmp_path):
    gw(["decisions", "add", "--bet", "b", "--question", "q", "--default", "d", "--rationale", "r"], tmp_path)
    gw(["decisions", "ratify", "--bet", "b", "--id", "D1", "--response", "ok"], tmp_path, check_returncode=0)
    assert gw(["decisions", "ratify", "--bet", "b", "--id", "D1", "--response", "again"], tmp_path).returncode == 1


def test_decisions_add_requires_question_default_rationale(tmp_path):
    assert gw(["decisions", "add", "--bet", "b", "--question", "q"], tmp_path).returncode == 1


# ─── shared: arg discipline ──────────────────────────────────────────────────

def test_bet_flag_required(tmp_path):
    assert gw(["findings", "add", "--bucket", "patch", "--title", "x"], tmp_path).returncode == 1
    assert gw(["decisions", "add", "--question", "q", "--default", "d", "--rationale", "r"], tmp_path).returncode == 1


def test_unknown_subcommand_fails(tmp_path):
    assert gw(["findings", "wat", "--bet", "b"], tmp_path).returncode == 1
    assert gw(["decisions", "wat", "--bet", "b"], tmp_path).returncode == 1


def test_corrupt_state_file_refuses_overwrite(tmp_path):
    d = tmp_path / ".groundwork" / "bets" / "b"
    d.mkdir(parents=True)
    (d / "findings.json").write_text("{not json")
    assert gw(["findings", "add", "--bet", "b", "--bucket", "patch", "--title", "x"], tmp_path).returncode == 1
