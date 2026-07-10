"""Contract tests for the proofs board going live (review-throughput plan,
Workstream B, slice B3): a derived state column, Tier-2 visual evidence, and
the "What keeps this honest" faithfulness footer.

State: each row carries the derived board state of its milestone (the same
glyph vocabulary `status` renders — done / in progress / not started); with
git unavailable, every row renders "(state unknown)" rather than guessing,
and the verb still exits 0.

Evidence: (a) a milestone's Tier-2 `Visual:` commit-body verdict, mined from
`git log` and attributed to a milestone via the test file(s) that same commit
touched under tests/bets/<slug>/; (b) existing screenshot paths under
`.groundwork/cache/visual/<slug>/` and `.groundwork/cache/visual/_smoke/`
(existence check only, never embedded).

Footer: findings counts by bucket/disposition (lib/bet-state), honesty/wiring/
tokens lead counts read from a per-HEAD scan cache
(`.groundwork/cache/bets/<slug>/scan-cache.json`), and the deletion-test line
mined from memlog.md's `mutate ...: bit` / `"... did not bite"` lines with
explicit absence semantics (never/ran-clean/ran-with-failures are three
distinct claims). An as-of stamp closes it.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import json
import os
import shutil
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"

# Same denylist convention as test_bet_proofs.py:29-37 — no engine vocabulary
# (verdict grammar, tier names, wire tokens, raw tag/HEAD text) may reach a
# rendered board, footer included.
DENYLIST = [
    "Developer Mode",
    "red board",
    "VERDICT:",
    "honest green",
    "frontier",
    "execution tier",
    "REVIEW_UNAVAILABLE",
    "bet/",  # the raw approved-tag name (bet/<slug>/approved) — owner language never sees it
    "mutate ",  # the engine verb — the footer says "deletion test", never "mutate"
]


# ─── CLI + git helpers (same pattern as the sibling test_*.py files) ────────

def gw(args, cwd, extra_env=None, extra_path=None):
    env = {"GROUNDWORK_NO_UPDATE_CHECK": "1", "PATH": os.environ["PATH"]}
    if extra_path is not None:
        env["PATH"] = extra_path
    if extra_env:
        env.update(extra_env)
    return subprocess.run(
        ["node", str(CLI), *args], cwd=cwd, capture_output=True, text=True, env=env,
    )


def git(args, cwd):
    return subprocess.run(
        ["git", "-c", "user.email=t@t", "-c", "user.name=t", *args],
        cwd=cwd, capture_output=True, text=True, check=True,
    )


def init_repo(root):
    git(["init", "-q"], root)


def commit_all(root, message, body=None):
    git(["add", "-A"], root)
    args = ["commit", "-q", "-m", message]
    if body is not None:
        args += ["-m", body]
    git(args, root)


def tag_approved(root, slug):
    git(["tag", f"bet/{slug}/approved"], root)


def write_pitch(root, slug, problem, status="delivery"):
    p = root / "docs" / "bets" / slug
    p.mkdir(parents=True, exist_ok=True)
    (p / "pitch.md").write_text(
        f"---\nstatus: {status}\n---\n# Bet: {slug.replace('-', ' ').title()}\n\n"
        f"## The Pitch\n\n- **Problem:** {problem}\n"
    )
    return p


def write_milestone(bet_dir, n, dirname, goal, slug, consumer, criteria, proves):
    m = bet_dir / "decomposition" / f"{n:02d}-{dirname}"
    m.mkdir(parents=True, exist_ok=True)
    criteria_block = "\n".join(f"- {c}" for c in criteria)
    (m / "index.md").write_text(
        f"# Milestone {n}: {goal}\n\n"
        f"**Consumer:** {consumer}\n\n"
        f"**Demonstrable goal:** {goal}\n\n"
        f"**Sequencing rationale:** because it comes first.\n\n"
        f"**Acceptance criteria — proven at the app's real entry point:**\n"
        f"{criteria_block}\n\n"
        f"## Proof of work\n\n"
        f"**Proves:** {proves}\n\n"
        f"**How we prove it:** drives the real entry point end to end.\n\n"
        f"**Test file:** `tests/bets/{slug}/test_milestone_{n}_{dirname}.py`\n"
    )
    return m


def write_test_file(root, slug, filename, body="def test_x():\n    assert True\n"):
    d = root / "tests" / "bets" / slug
    d.mkdir(parents=True, exist_ok=True)
    (d / filename).write_text(body)
    return d / filename


def write_memlog(root, slug, lines):
    d = root / ".groundwork" / "cache" / "bets" / slug
    d.mkdir(parents=True, exist_ok=True)
    (d / "memlog.md").write_text("".join(f"- 2026-07-10T00:00:0{i}Z — {line}\n" for i, line in enumerate(lines)))


def write_screenshot(root, rel_path):
    p = root / rel_path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(b"not really a png, existence is all that's checked")
    return p


# A curated bin dir with ONLY node+git (or just node) symlinked in, mirroring
# test_status_delta.py's bin_without_python — a PATH minus one directory is
# not airtight (git/node/python3 are typically colocated), so this names
# exactly what should and shouldn't be reachable.

def bin_with_git_and_node(tmp_path, dirname="fullbin"):
    bindir = tmp_path / dirname
    bindir.mkdir(exist_ok=True)
    for name in ("git", "node"):
        target = shutil.which(name)
        if target and not (bindir / name).exists():
            (bindir / name).symlink_to(target)
    return str(bindir)


STUB_PYTHON = r"""#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
if (args.includes('--version')) {
  console.log('Python 3.99.0 (stub)');
  process.exit(0);
}
const mIdx = args.indexOf('-m');
if (mIdx !== -1 && args[mIdx + 1] === 'pytest') {
  const testDir = args[mIdx + 2];
  let results = {};
  try { results = JSON.parse(process.env.STUB_RESULTS || '{}'); } catch (e) {}
  let files = [];
  try { files = fs.readdirSync(testDir).filter((f) => /^test_.*\.py$/.test(f)); } catch (e) {}
  let anyFail = false;
  for (const f of files) {
    const outcome = results[f] || 'PASSED';
    if (outcome !== 'PASSED') anyFail = true;
    console.log(testDir + '/' + f + '::test_x ' + outcome);
  }
  process.exit(anyFail ? 1 : 0);
}
process.exit(1);
"""


def bin_with_stub_python(tmp_path):
    bindir = tmp_path / "stubbin"
    bindir.mkdir(exist_ok=True)
    for name in ("git", "node"):
        target = shutil.which(name)
        if target and not (bindir / name).exists():
            (bindir / name).symlink_to(target)
    stub = bindir / "python3"
    stub.write_text(STUB_PYTHON)
    stub.chmod(0o755)
    return str(bindir)


SLUG = "widget-import"


def seed_mid_delivery_bet(tmp_path):
    """Two milestones, one closed (green, Visual verdict recorded) and one
    open (a slice authored, red) — the fixture the state/evidence/footer
    assertions share."""
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, SLUG, "Bring your own widgets into the library.")
    write_milestone(
        bet_dir, 1, "first-image", "see one image appear", SLUG,
        consumer="A person browsing the library",
        criteria=["Upload one image and see it appear in the library"],
        proves="The library shows an uploaded image without a page reload.",
    )
    write_milestone(
        bet_dir, 2, "second-screen", "search returns matching images", SLUG,
        consumer="A person searching the library",
        criteria=["Search for a known tag and see the matching image"],
        proves="Search returns images whose tags match the query.",
    )
    commit_all(tmp_path, "seed two-milestone decomposition")
    tag_approved(tmp_path, SLUG)

    # Milestone 1 closes: its test file lands green, and the closing commit
    # carries the Tier-2 Visual: verdict step-03-milestone-close.md mandates.
    write_test_file(tmp_path, SLUG, "test_milestone_1_first-image.py")
    commit_all(
        tmp_path, f"bet({SLUG}): close milestone 1",
        body="Visual: first-image screen matches the spec — elevation and motion tokens landed.",
    )

    # Milestone 2 is mid-flight: a slice is authored (red), the milestone
    # stub itself still red — no Visual: line yet.
    write_test_file(tmp_path, SLUG, "test_milestone_2_second-screen.py")
    write_test_file(tmp_path, SLUG, "test_slice_2_svc_thing.py")
    commit_all(tmp_path, f"bet({SLUG}): slice 2.1 svc thing")

    return bet_dir


STUB_RESULTS = json.dumps({
    "test_milestone_1_first-image.py": "PASSED",
    "test_milestone_2_second-screen.py": "FAILED",
    "test_slice_2_svc_thing.py": "PASSED",
})


# ─── State column: derived board state, status's glyph vocabulary ──────────

def test_mid_delivery_fixture_renders_correct_glyphs_and_evidence(tmp_path):
    seed_mid_delivery_bet(tmp_path)
    stubbin = bin_with_stub_python(tmp_path)

    proc = gw(
        ["proofs", "--bet", SLUG], tmp_path,
        extra_env={"STUB_RESULTS": STUB_RESULTS}, extra_path=stubbin,
    )
    assert proc.returncode == 0, proc.stderr
    out = proc.stdout

    # Milestone 1 (green, no slices) -> done; milestone 2 (a slice authored,
    # its own stub still red) -> in progress — the same glyphs `status` uses.
    assert "✅ done" in out, out
    assert "▶ in progress" in out, out

    # Milestone 1's Visual verdict renders verbatim beside ITS rows...
    assert "elevation and motion tokens landed" in out
    # ...milestone 2 carries none.
    lines = [l for l in out.splitlines() if "Search for a known tag" in l]
    assert lines and "elevation and motion tokens landed" not in lines[0]


def test_json_rows_carry_state_and_evidence_fields(tmp_path):
    seed_mid_delivery_bet(tmp_path)
    stubbin = bin_with_stub_python(tmp_path)

    proc = gw(
        ["proofs", "--bet", SLUG, "--json"], tmp_path,
        extra_env={"STUB_RESULTS": STUB_RESULTS}, extra_path=stubbin,
    )
    assert proc.returncode == 0, proc.stderr
    doc = json.loads(proc.stdout)

    m1_rows = [r for r in doc["rows"] if r["milestoneN"] == 1]
    m2_rows = [r for r in doc["rows"] if r["milestoneN"] == 2]
    assert all(r["state"] == "done" for r in m1_rows)
    assert all(r["state"] == "in-progress" for r in m2_rows)
    assert all("elevation and motion tokens landed" in r["evidence"] for r in m1_rows)
    assert all(r["evidence"] == "" for r in m2_rows)


# ─── Evidence column: screenshot paths, existence-only ──────────────────────

def test_screenshot_path_listed_only_when_the_file_exists(tmp_path):
    seed_mid_delivery_bet(tmp_path)

    proc_before = gw(["proofs", "--bet", SLUG], tmp_path)
    assert proc_before.returncode == 0, proc_before.stderr
    assert "Screenshots on disk" not in proc_before.stdout

    rel = f".groundwork/cache/visual/_smoke/app/home__desktop__light.png"
    write_screenshot(tmp_path, rel)

    proc_after = gw(["proofs", "--bet", SLUG], tmp_path)
    assert proc_after.returncode == 0, proc_after.stderr
    assert "Screenshots on disk" in proc_after.stdout
    assert rel in proc_after.stdout

    # Per-state captures under the bet's own slug dir are picked up too.
    rel2 = f".groundwork/cache/visual/{SLUG}/app/loaded.png"
    write_screenshot(tmp_path, rel2)
    proc_both = gw(["proofs", "--bet", SLUG], tmp_path)
    assert rel in proc_both.stdout and rel2 in proc_both.stdout


# ─── Faithfulness footer: findings, scans, deletion test, as-of ────────────

def test_footer_counts_match_the_ledger(tmp_path):
    seed_mid_delivery_bet(tmp_path)

    add = gw(["findings", "add", "--bet", SLUG, "--bucket", "patch", "--title", "Ugly empty state"], tmp_path)
    assert add.returncode == 0, add.stderr
    add2 = gw(["findings", "add", "--bet", SLUG, "--bucket", "defer", "--title", "Slow search on huge libraries"], tmp_path)
    assert add2.returncode == 0, add2.stderr
    f2_id = json.loads(gw(["findings", "add", "--bet", SLUG, "--bucket", "decision-needed", "--title", "Pick a search backend", "--json"], tmp_path).stdout)["id"]
    disp = gw(["findings", "disposition", "--bet", SLUG, "--id", f2_id, "--as", "fixed"], tmp_path)
    assert disp.returncode == 0, disp.stderr

    write_memlog(tmp_path, SLUG, [
        "mutate slice-2-1-svc-thing: bit",
        "mutate slice-2-2-svc-other: did not bite",
    ])

    proc = gw(["proofs", "--bet", SLUG], tmp_path)
    assert proc.returncode == 0, proc.stderr
    out = proc.stdout

    assert "## What keeps this honest" in out
    # 2 still open (patch + defer), 1 dispositioned (fixed).
    assert "2 open findings" in out
    assert "1 being fixed" in out and "1 parked with an owner" in out
    assert "1 finding dispositioned" in out and "1 fixed" in out
    # Explicit absence semantics: ran twice, one did not bite.
    assert "2 runs logged, 1 did not bite — see the findings ledger" in out
    assert "As of " in out and "rulings happen in the conversation" in out


def test_scan_lines_clean_when_scans_can_run(tmp_path):
    # The mid-delivery fixture's test files are plain .py test files — no
    # honesty/wiring/tokens lead should fire against them.
    seed_mid_delivery_bet(tmp_path)
    proc = gw(["proofs", "--bet", SLUG], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert "Honesty check: 0 things worth a second look." in proc.stdout
    assert "Wiring check: 0 things worth a second look." in proc.stdout
    assert "Design-token check: 0 things worth a second look." in proc.stdout


def test_scan_lines_degrade_when_no_approved_tag(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, SLUG, "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed pitch only — no approved tag yet")

    proc = gw(["proofs", "--bet", SLUG], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert proc.stdout.count("(scan unavailable)") == 3


# ─── Deletion-test line: three distinct absence claims ──────────────────────

def test_deletion_test_line_never_logged(tmp_path):
    seed_mid_delivery_bet(tmp_path)
    # No memlog.md at all.
    out = gw(["proofs", "--bet", SLUG], tmp_path).stdout
    assert "no deletion-test runs logged" in out


def test_deletion_test_line_ran_clean(tmp_path):
    seed_mid_delivery_bet(tmp_path)
    write_memlog(tmp_path, SLUG, [
        "mutate slice-1-1-svc-thing: bit",
        "mutate slice-1-2-svc-other: bit",
    ])
    out = gw(["proofs", "--bet", SLUG], tmp_path).stdout
    assert "2 deletion-test runs logged, none failed" in out
    # Never conflate "ran clean" with "never ran".
    assert "no deletion-test runs logged" not in out


def test_deletion_test_line_some_did_not_bite(tmp_path):
    seed_mid_delivery_bet(tmp_path)
    write_memlog(tmp_path, SLUG, [
        "mutate slice-1-1-svc-thing: bit",
        "mutate slice-1-2-svc-other: did not bite",
        "mutate slice-2-1-svc-thing: did not bite",
    ])
    out = gw(["proofs", "--bet", SLUG], tmp_path).stdout
    assert "3 runs logged, 2 did not bite — see the findings ledger" in out
    assert "none failed" not in out
    assert "no deletion-test runs logged" not in out


# ─── git absent: "(state unknown)", never a guess, still exit 0 ────────────

def test_git_absent_renders_state_unknown_and_exits_zero(tmp_path):
    # No `git init` at all — the fixture is deliberately not a git repo.
    write_pitch(tmp_path, SLUG, "Bring your own widgets into the library.")
    bet_dir = tmp_path / "docs" / "bets" / SLUG
    write_milestone(
        bet_dir, 1, "first-image", "see one image appear", SLUG,
        consumer="A person browsing the library",
        criteria=["Upload one image and see it appear"],
        proves="The library shows an uploaded image.",
    )

    proc = gw(["proofs", "--bet", SLUG], tmp_path)
    assert proc.returncode == 0, proc.stderr
    assert "(state unknown)" in proc.stdout
    # Never a guessed "not started" glyph standing in for genuine ignorance.
    assert "○ not started" not in proc.stdout

    doc = json.loads(gw(["proofs", "--bet", SLUG, "--json"], tmp_path).stdout)
    assert doc["found"] is True
    assert all(r["state"] == "unknown" for r in doc["rows"])


# ─── Denylist: the whole page, footer included ──────────────────────────────

def test_no_engine_vocabulary_anywhere_on_the_full_page(tmp_path):
    seed_mid_delivery_bet(tmp_path)
    gw(["findings", "add", "--bet", SLUG, "--bucket", "patch", "--title", "x"], tmp_path)
    write_memlog(tmp_path, SLUG, ["mutate slice-1-1-svc-thing: did not bite"])
    stubbin = bin_with_stub_python(tmp_path)

    proc = gw(
        ["proofs", "--bet", SLUG], tmp_path,
        extra_env={"STUB_RESULTS": STUB_RESULTS}, extra_path=stubbin,
    )
    assert proc.returncode == 0, proc.stderr
    for term in DENYLIST:
        assert term not in proc.stdout, f"denylisted engine term leaked into output: {term!r}\n{proc.stdout}"

    written = gw(
        ["proofs", "--bet", SLUG, "--write"], tmp_path,
        extra_env={"STUB_RESULTS": STUB_RESULTS}, extra_path=stubbin,
    )
    assert written.returncode == 0, written.stderr
    page = (tmp_path / "docs" / "bets" / SLUG / "proofs.md").read_text()
    for term in DENYLIST:
        assert term not in page, f"denylisted engine term leaked into the written page: {term!r}\n{page}"


# ─── Scan cache: a cache hit invokes zero scans ─────────────────────────────

def test_unchanged_head_does_not_reinvoke_the_scans(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, SLUG, "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")
    tag_approved(tmp_path, SLUG)
    (tmp_path / "NOTES.md").write_text("a harmless follow-up change\n")
    commit_all(tmp_path, "seed 2", body="a harmless follow-up commit")

    counter = tmp_path / "scan-counter.txt"

    first = gw(["proofs", "--bet", SLUG], tmp_path, extra_env={"GW_SCAN_COUNT_FILE": str(counter)})
    assert first.returncode == 0, first.stderr
    assert counter.exists()
    first_lines = counter.read_text().splitlines()
    assert sorted(first_lines) == ["honesty", "tokens", "wiring"]

    # Second render, HEAD unchanged: the cache hit means zero new scan spawns.
    second = gw(["proofs", "--bet", SLUG], tmp_path, extra_env={"GW_SCAN_COUNT_FILE": str(counter)})
    assert second.returncode == 0, second.stderr
    assert counter.read_text().splitlines() == first_lines

    # Advance HEAD: the cache invalidates and the scans run again.
    (tmp_path / "NOTES.md").write_text("a second harmless follow-up change\n")
    commit_all(tmp_path, "seed 3", body="another follow-up commit")
    third = gw(["proofs", "--bet", SLUG], tmp_path, extra_env={"GW_SCAN_COUNT_FILE": str(counter)})
    assert third.returncode == 0, third.stderr
    assert len(counter.read_text().splitlines()) == 6
