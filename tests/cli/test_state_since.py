"""Contract tests for `findings list --since` / `decisions list --since`
(review-throughput plan, Workstream E, slice E3).

`--since <iso>` scopes the ledger to items created OR closed/ratified
at-or-after the stamp: findings compare `created`/`closed`; decisions compare
`created`/`ratification.ts`. The filter is additive in `lib/bet-state`
(`listFindings`/`listDecisions` accept an optional `since` in their options
object) — every existing caller (`findings check`, `decisions pending`, ...)
is unaffected. An invalid ISO value is a clear error, exit 2.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import json
import os
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"


def gw(args, cwd):
    return subprocess.run(
        ["node", str(CLI), *args], cwd=cwd, capture_output=True, text=True,
        env={"GROUNDWORK_NO_UPDATE_CHECK": "1", "PATH": os.environ["PATH"]},
    )


def seed_findings(root, slug, findings):
    d = root / ".groundwork" / "bets" / slug
    d.mkdir(parents=True, exist_ok=True)
    (d / "findings.json").write_text(json.dumps({"schema": 1, "bet": slug, "findings": findings}, indent=2))


def seed_decisions(root, slug, decisions):
    d = root / ".groundwork" / "bets" / slug
    d.mkdir(parents=True, exist_ok=True)
    (d / "decisions.json").write_text(json.dumps({"schema": 1, "bet": slug, "decisions": decisions}, indent=2))


def finding(id_, title, created, closed=None, bucket="patch", status="open"):
    return {
        "id": id_, "title": title, "bucket": bucket, "status": status,
        "slice": None, "milestone": None, "lens": None, "location": None,
        "disposition": ("fixed" if status == "closed" else None), "note": None,
        "created": created, "closed": closed,
    }


def decision(id_, question, created, ratified_ts=None, status="pending"):
    ratification = None
    if ratified_ts:
        ratification = {"outcome": "ratified", "response": "ok", "at": None, "ts": ratified_ts}
    return {
        "id": id_, "question": question, "default": "d", "rationale": "r",
        "milestone": None, "status": status, "created": created, "ratification": ratification,
    }


STAMP = "2026-02-01T00:00:00.000Z"
BEFORE = "2026-01-01T00:00:00.000Z"
AFTER = "2026-03-01T00:00:00.000Z"


# ─── findings: created boundary ──────────────────────────────────────────────

def test_findings_since_excludes_item_created_before_stamp(tmp_path):
    seed_findings(tmp_path, "b", [finding("F1", "old", BEFORE), finding("F2", "new", AFTER)])
    proc = gw(["findings", "list", "--bet", "b", "--since", STAMP, "--json"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert [f["id"] for f in json.loads(proc.stdout)] == ["F2"]


def test_findings_since_boundary_is_inclusive(tmp_path):
    seed_findings(tmp_path, "b", [finding("F1", "exact", STAMP)])
    proc = gw(["findings", "list", "--bet", "b", "--since", STAMP, "--json"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert [f["id"] for f in json.loads(proc.stdout)] == ["F1"]


# ─── findings: closed-after-stamp still counts even if created earlier ──────

def test_findings_since_includes_item_closed_after_stamp(tmp_path):
    seed_findings(tmp_path, "b", [
        finding("F1", "closed-late", BEFORE, closed=AFTER, status="closed"),
    ])
    proc = gw(["findings", "list", "--bet", "b", "--since", STAMP, "--json"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert [f["id"] for f in json.loads(proc.stdout)] == ["F1"]


def test_findings_since_excludes_item_created_and_closed_before_stamp(tmp_path):
    seed_findings(tmp_path, "b", [
        finding("F1", "long closed", BEFORE, closed=BEFORE, status="closed"),
    ])
    proc = gw(["findings", "list", "--bet", "b", "--since", STAMP, "--json"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert json.loads(proc.stdout) == []


# ─── decisions: created boundary ─────────────────────────────────────────────

def test_decisions_since_excludes_item_created_before_stamp(tmp_path):
    seed_decisions(tmp_path, "b", [decision("D1", "old", BEFORE), decision("D2", "new", AFTER)])
    proc = gw(["decisions", "list", "--bet", "b", "--since", STAMP, "--json"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert [d["id"] for d in json.loads(proc.stdout)] == ["D2"]


# ─── decisions: ratified-after-stamp still counts even if created earlier ───

def test_decisions_since_includes_item_ratified_after_stamp(tmp_path):
    seed_decisions(tmp_path, "b", [
        decision("D1", "old-but-ratified-late", BEFORE, ratified_ts=AFTER, status="ratified"),
    ])
    proc = gw(["decisions", "list", "--bet", "b", "--since", STAMP, "--json"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert [d["id"] for d in json.loads(proc.stdout)] == ["D1"]


def test_decisions_since_excludes_item_created_and_ratified_before_stamp(tmp_path):
    seed_decisions(tmp_path, "b", [
        decision("D1", "long ratified", BEFORE, ratified_ts=BEFORE, status="ratified"),
    ])
    proc = gw(["decisions", "list", "--bet", "b", "--since", STAMP, "--json"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert json.loads(proc.stdout) == []


# ─── invalid ISO -> clear error, exit 2 ──────────────────────────────────────

def test_findings_since_invalid_iso_exits_2(tmp_path):
    seed_findings(tmp_path, "b", [])
    proc = gw(["findings", "list", "--bet", "b", "--since", "not-a-date"], tmp_path)
    assert proc.returncode == 2
    assert proc.stderr.strip()


def test_decisions_since_invalid_iso_exits_2(tmp_path):
    seed_decisions(tmp_path, "b", [])
    proc = gw(["decisions", "list", "--bet", "b", "--since", "not-a-date"], tmp_path)
    assert proc.returncode == 2
    assert proc.stderr.strip()


# ─── additive: existing callers (no --since) are unaffected ─────────────────

def test_findings_list_without_since_still_lists_everything(tmp_path):
    seed_findings(tmp_path, "b", [finding("F1", "x", BEFORE)])
    proc = gw(["findings", "list", "--bet", "b", "--json"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert [f["id"] for f in json.loads(proc.stdout)] == ["F1"]


def test_findings_check_unaffected_by_since_support(tmp_path):
    seed_findings(tmp_path, "b", [finding("F1", "x", BEFORE)])
    assert gw(["findings", "check", "--bet", "b"], tmp_path).returncode == 1


def test_decisions_pending_unaffected_by_since_support(tmp_path):
    seed_decisions(tmp_path, "b", [decision("D1", "q", BEFORE)])
    proc = gw(["decisions", "pending", "--bet", "b", "--json"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert [d["id"] for d in json.loads(proc.stdout)] == ["D1"]
