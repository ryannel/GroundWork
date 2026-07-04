"""Contract tests for the Wave-3 engine verb: `groundwork tokens scan`.

The scan is the MECHANICAL half of the design-integrity ratchet (W3.4) — it
flags raw color/font/spacing/motion literals in UI source files changed since
the sealed baseline (`bet/<slug>/approved`) that bypass the project's
design-token set. Its findings are leads for slice review, never verdicts.
Load-bearing behaviors:

  * exit 1 on any finding, exit 0 clean — CI-safe like `honesty scan`;
  * exit 2 when the scan CANNOT run (no approved tag, not a git repo) —
    cannot-run must never masquerade as clean;
  * token-set awareness is best-effort and never invented — with a token
    source present the findings name it; without one the result carries
    `token_set: null` and the framing softens to tokenization leads.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import json
import os
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"

RAW_LITERAL_TSX = """export function Button({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ background: '#ff3366', fontSize: 13, padding: '12px' }}
    >
      go
    </button>
  );
}
"""


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


def seal_bet(tmp_path, *, token_set=True):
    """A minimal sealed bet: one clean UI file, optionally a tailwind config — tagged approved."""
    ui = tmp_path / "src" / "ui"
    ui.mkdir(parents=True)
    (ui / "App.tsx").write_text('export function App() { return <div className="app">ok</div>; }\n')
    if token_set:
        (tmp_path / "tailwind.config.js").write_text("module.exports = { theme: { extend: {} } };\n")
    git(tmp_path, "init", "-q")
    commit_all(tmp_path, "seal")
    git(tmp_path, "tag", "bet/b/approved")
    return tmp_path


def add_raw_literal_tsx(tmp_path):
    (tmp_path / "src" / "ui" / "Button.tsx").write_text(RAW_LITERAL_TSX)
    commit_all(tmp_path, "add raw literals")


def scan(cwd, *extra, check_returncode=None):
    return gw(["tokens", "scan", "--bet", "b", *extra], cwd, check_returncode=check_returncode)


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
    assert gw(["tokens", "scan"], tmp_path).returncode == 1
    assert gw(["tokens", "wat", "--bet", "b"], tmp_path).returncode == 1


# ─── clean repo: exit 0 ──────────────────────────────────────────────────────

def test_clean_repo_exits_0(tmp_path):
    seal_bet(tmp_path)
    scan(tmp_path, check_returncode=0)
    proc, payload = scan_json(tmp_path)
    assert proc.returncode == 0
    assert payload == {"clean": True, "token_set": "tailwind.config.js", "findings": []}


# ─── raw literals with a token set present ───────────────────────────────────

def test_raw_literals_flagged_and_name_the_token_set(tmp_path):
    seal_bet(tmp_path)
    add_raw_literal_tsx(tmp_path)
    proc, payload = scan_json(tmp_path)
    assert proc.returncode == 1 and payload["clean"] is False
    assert payload["token_set"] == "tailwind.config.js"

    kinds = {f["kind"] for f in payload["findings"]}
    assert {"color", "font", "spacing"} <= kinds

    (color,) = [f for f in payload["findings"] if f["kind"] == "color"]
    assert color["file"] == "src/ui/Button.tsx"
    assert color["line"] == 5
    assert color["literal"] == "#ff3366"
    assert "token set exists (tailwind.config.js)" in color["detail"]

    (font,) = [f for f in payload["findings"] if f["kind"] == "font"]
    assert "fontSize: 13" in font["literal"]

    # onClick is an event handler, not a design literal — the wrong scan's business.
    assert not [f for f in payload["findings"] if "onClick" in f["literal"]]


def test_motion_literal_flagged(tmp_path):
    seal_bet(tmp_path)
    (tmp_path / "src" / "ui" / "Fade.tsx").write_text(
        "export const fade = { transition: 'opacity 200ms ease' };\n"
    )
    commit_all(tmp_path, "add motion literal")
    proc, payload = scan_json(tmp_path)
    assert proc.returncode == 1
    (motion,) = [f for f in payload["findings"] if f["kind"] == "motion"]
    assert motion["literal"] == "200ms"


def test_flutter_color_literal_flagged(tmp_path):
    seal_bet(tmp_path)
    widget = tmp_path / "lib" / "ui"
    widget.mkdir(parents=True)
    (widget / "widget.dart").write_text("final accent = Color(0xFF123456);\n")
    commit_all(tmp_path, "add dart color")
    proc, payload = scan_json(tmp_path)
    assert proc.returncode == 1
    (color,) = [f for f in payload["findings"] if f["kind"] == "color"]
    assert color["file"] == "lib/ui/widget.dart"
    assert "0xFF123456" in color["literal"]


# ─── no token set: findings still report, framing softens ────────────────────

def test_no_token_set_reports_null_and_softens(tmp_path):
    seal_bet(tmp_path, token_set=False)
    add_raw_literal_tsx(tmp_path)
    proc, payload = scan_json(tmp_path)
    assert proc.returncode == 1
    assert payload["token_set"] is None
    assert payload["findings"], "raw literals still report without a token set"
    assert all("no token set detected" in f["detail"] for f in payload["findings"])
    human = scan(tmp_path)
    assert human.returncode == 1
    assert "No token set detected" in human.stderr
    assert "tokenization leads" in human.stderr


def test_css_spacing_gated_on_token_indirection(tmp_path):
    # A margin in a plain stylesheet with no token layer has nowhere else to
    # live — flag it only when a token indirection exists.
    seal_bet(tmp_path, token_set=False)
    (tmp_path / "src" / "ui" / "box.css").write_text(".box { margin: 12px; }\n")
    commit_all(tmp_path, "css spacing, no tokens")
    scan(tmp_path, check_returncode=0)

    (tmp_path / "tailwind.config.js").write_text("module.exports = { theme: { extend: {} } };\n")
    commit_all(tmp_path, "add token set")
    proc, payload = scan_json(tmp_path)
    assert proc.returncode == 1
    (spacing,) = [f for f in payload["findings"] if f["kind"] == "spacing"]
    assert spacing["file"] == "src/ui/box.css"


# ─── the allowlist and the scope boundary ────────────────────────────────────

def test_allowlisted_white_black_not_flagged(tmp_path):
    seal_bet(tmp_path)
    (tmp_path / "src" / "ui" / "Base.tsx").write_text(
        "export const base = { color: '#fff', background: '#000000', border: 'transparent' };\n"
    )
    commit_all(tmp_path, "allowlisted literals")
    scan(tmp_path, check_returncode=0)


def test_non_ui_files_skipped_silently(tmp_path):
    seal_bet(tmp_path)
    (tmp_path / "src" / "data.ts").write_text("export const brandHex = '#ff3366';\n")
    commit_all(tmp_path, "non-ui file")
    scan(tmp_path, check_returncode=0)


def test_hex_in_comment_not_flagged(tmp_path):
    seal_bet(tmp_path)
    (tmp_path / "src" / "ui" / "Note.tsx").write_text(
        "// old brand was #ff3366\nexport const note = 1;\n"
    )
    commit_all(tmp_path, "comment only")
    scan(tmp_path, check_returncode=0)


# ─── output contract ─────────────────────────────────────────────────────────

def test_json_shape_and_human_footer(tmp_path):
    seal_bet(tmp_path)
    add_raw_literal_tsx(tmp_path)
    _, payload = scan_json(tmp_path)
    assert set(payload) == {"clean", "token_set", "findings"}
    for f in payload["findings"]:
        assert {"kind", "file", "line", "literal"} <= set(f)
        assert isinstance(f["line"], int) and f["line"] >= 1
    human = scan(tmp_path)
    assert human.returncode == 1
    # Leads, not verdicts — the footer routes real ones to the findings ledger.
    assert "leads" in human.stderr and "findings add" in human.stderr
    assert "patch" in human.stderr  # default bucket when a token set exists


def test_scan_is_deterministic(tmp_path):
    seal_bet(tmp_path)
    add_raw_literal_tsx(tmp_path)
    a, b = scan(tmp_path), scan(tmp_path)
    assert (a.returncode, a.stdout, a.stderr) == (b.returncode, b.stdout, b.stderr)
    ja, jb = scan(tmp_path, "--json"), scan(tmp_path, "--json")
    assert ja.stdout == jb.stdout
