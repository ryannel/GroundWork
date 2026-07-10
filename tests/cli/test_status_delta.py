"""Contract tests for the last-run verdict cache (review-throughput plan,
Workstream C, slice C5 — lib half) and snapshot delta compression on the chat
render (Workstream E, slice E2).

C5: `.groundwork/cache/bets/<slug>/last-run.json` caches the last real suite
run's per-file pass/fail verdicts (`{ranAt, head, byFile}`). Reading it is
conservative — valid only when `head` matches HEAD now and no file under
`tests/bets/<slug>/` carries an mtime newer than `ranAt`; anything uncertain
falls back to the real suite (or, absent a runner, the existing git-history
heuristic). `derive.js` is a cache WRITER too: a real run persists what it
just paid for. `status --with-proofs` shares one derivation between status.md
and proofs.md, so the pair spawns the suite at most once (zero on a cache
hit). `--run` bypasses the cache and refreshes it.

E2: after `composeStatus()`, the composed doc's Program section (and, for a
resolved bet, its milestone ladder) is compared against a render-cache sidecar
of the LAST CHAT render. An unchanged section collapses to one line; a
changed one renders in full with `(new)`/`(was <state>)` markers on the rows
that actually changed. The written page (`--write`) and `--json` are always
full; `--full` forces the uncompressed chat render too.

Both slices are cache-only, fail-open working state (D-S5): a missing,
corrupt, or stale cache never renders LESS information than before either
cache existed — it just renders full / re-runs the suite.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import json
import os
import shutil
import subprocess
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"

# Same denylist convention as test_bet_status.py:29-37 — no engine vocabulary
# may reach a rendered page, including the new age line and collapsed lines.
DENYLIST = [
    "Developer Mode",
    "red board",
    "VERDICT:",
    "honest green",
    "frontier",
    "execution tier",
    "REVIEW_UNAVAILABLE",
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
    return subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t", *args],
                           cwd=cwd, capture_output=True, text=True, check=True)


def init_repo(root):
    git(["init", "-q"], root)


def commit_all(root, message):
    git(["add", "-A"], root)
    git(["commit", "-q", "-m", message], root)


def head_sha(root):
    return git(["rev-parse", "HEAD"], root).stdout.strip()


def write_pitch(root, slug, problem, status="delivery"):
    p = root / "docs" / "bets" / slug
    p.mkdir(parents=True, exist_ok=True)
    (p / "pitch.md").write_text(
        f"---\nstatus: {status}\n---\n# Bet: {slug.replace('-', ' ').title()}\n\n"
        f"## The Pitch\n\n- **Problem:** {problem}\n"
    )
    return p


def write_milestone(bet_dir, n, dirname, goal, slug, consumer=None, criteria=None, proves=None):
    m = bet_dir / "decomposition" / f"{n:02d}-{dirname}"
    m.mkdir(parents=True, exist_ok=True)
    body = f"# Milestone {n}: {goal}\n\n"
    if consumer:
        body += f"**Consumer:** {consumer}\n\n"
    body += f"**Demonstrable goal:** {goal}\n\n"
    if criteria:
        crit = "\n".join(f"- {c}" for c in criteria)
        body += f"**Acceptance criteria — proven at the app's real entry point:**\n{crit}\n\n"
    body += "## Proof of work\n\n"
    if proves:
        body += f"**Proves:** {proves}\n\n"
    body += f"**Test file:** `tests/bets/{slug}/test_milestone_{n}_{dirname}.py`\n"
    (m / "index.md").write_text(body)
    return m


def commit_test_file(root, bet_slug, filename, body="def test_x():\n    assert True\n"):
    d = root / "tests" / "bets" / bet_slug
    d.mkdir(parents=True, exist_ok=True)
    (d / filename).write_text(body)
    return d / filename


def seed_run_cache(root, slug, head, ran_at, by_file):
    d = root / ".groundwork" / "cache" / "bets" / slug
    d.mkdir(parents=True, exist_ok=True)
    (d / "last-run.json").write_text(json.dumps({"ranAt": ran_at, "head": head, "byFile": by_file}))
    return d / "last-run.json"


def run_cache_path(root, slug):
    return root / ".groundwork" / "cache" / "bets" / slug / "last-run.json"


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


# ─── PATH control: prove the cache path needs no test runner at all ─────────
# A curated bin dir with ONLY git+node symlinked in — not a PATH minus one
# directory (git/node/python3 are typically colocated, e.g. /opt/homebrew/bin
# on macOS, so removing "the directory with python" would remove git and node
# too). This makes "the test runner is absent from PATH" airtight rather than
# incidentally true of the current machine.

def bin_without_python(tmp_path):
    bindir = tmp_path / "purebin"
    bindir.mkdir(exist_ok=True)
    for name in ("git", "node"):
        target = shutil.which(name)
        if target and not (bindir / name).exists():
            (bindir / name).symlink_to(target)
    return str(bindir)


STUB_PYTHON = r"""#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const counterFile = process.env.STUB_COUNTER_FILE;
function bump() {
  if (!counterFile) return;
  let n = 0;
  try { n = parseInt(fs.readFileSync(counterFile, 'utf8'), 10) || 0; } catch (e) {}
  fs.writeFileSync(counterFile, String(n + 1));
}
if (args.includes('--version')) {
  console.log('Python 3.99.0 (stub)');
  process.exit(0);
}
const mIdx = args.indexOf('-m');
if (mIdx !== -1 && args[mIdx + 1] === 'pytest') {
  bump();
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


# ═══════════════════════════════════════════════════════════════════════════
# C5 — the last-run verdict cache
# ═══════════════════════════════════════════════════════════════════════════

def _seed_single_commit_milestone_fixture(tmp_path):
    """A milestone test file committed exactly once, no slices authored — the
    git-history fallback (no cache, no runner) reads this as 'not-started'
    (an unopened rung; see derive.js's milestone-correction comment), while a
    cache saying 'green' reads as 'done'. The two are distinguishable, so a
    passing test proves the cache path was actually taken."""
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(bet_dir, 1, "first-image", "see one image appear", "widget-import")
    commit_test_file(tmp_path, "widget-import", "test_milestone_1_first-image.py")
    commit_all(tmp_path, "materialize milestone 1")
    return head_sha(tmp_path)


def test_seeded_valid_cache_renders_without_a_test_runner_on_path(tmp_path):
    head = _seed_single_commit_milestone_fixture(tmp_path)
    seed_run_cache(tmp_path, "widget-import", head, now_iso(), {"test_milestone_1_first-image.py": "green"})

    purebin = bin_without_python(tmp_path)
    proc = gw(["status", "--bet", "widget-import", "--json"], tmp_path, extra_path=purebin)
    assert proc.returncode == 0, proc.stderr
    doc = json.loads(proc.stdout)
    assert doc["bet"]["milestones"][0]["state"] == "done"
    assert doc["verdictSource"] == {"cached": True, "ranAt": doc["verdictSource"]["ranAt"]}

    md = gw(["status", "--bet", "widget-import"], tmp_path, extra_path=purebin).stdout
    assert "Test states are from the last run," in md
    for term in DENYLIST:
        assert term not in md


def test_wrong_head_in_cache_falls_back_to_todays_behavior(tmp_path):
    _seed_single_commit_milestone_fixture(tmp_path)
    seed_run_cache(tmp_path, "widget-import", "0" * 40, now_iso(), {"test_milestone_1_first-image.py": "green"})

    purebin = bin_without_python(tmp_path)
    proc = gw(["status", "--bet", "widget-import", "--json"], tmp_path, extra_path=purebin)
    assert proc.returncode == 0, proc.stderr
    doc = json.loads(proc.stdout)
    assert doc["bet"]["milestones"][0]["state"] == "not-started"
    assert doc["verdictSource"] is None


def test_touching_a_test_file_invalidates_the_cache(tmp_path):
    head = _seed_single_commit_milestone_fixture(tmp_path)
    ran_at = now_iso()
    seed_run_cache(tmp_path, "widget-import", head, ran_at, {"test_milestone_1_first-image.py": "green"})

    # Bump the test file's mtime past ranAt.
    test_file = tmp_path / "tests" / "bets" / "widget-import" / "test_milestone_1_first-image.py"
    future = (datetime.now(timezone.utc) + timedelta(minutes=5)).timestamp()
    os.utime(test_file, (future, future))

    purebin = bin_without_python(tmp_path)
    proc = gw(["status", "--bet", "widget-import", "--json"], tmp_path, extra_path=purebin)
    assert proc.returncode == 0, proc.stderr
    doc = json.loads(proc.stdout)
    assert doc["bet"]["milestones"][0]["state"] == "not-started"
    assert doc["verdictSource"] is None


def test_malformed_cache_file_falls_back(tmp_path):
    head = _seed_single_commit_milestone_fixture(tmp_path)
    cache_file = run_cache_path(tmp_path, "widget-import")
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_file.write_text("{not valid json")

    purebin = bin_without_python(tmp_path)
    proc = gw(["status", "--bet", "widget-import", "--json"], tmp_path, extra_path=purebin)
    assert proc.returncode == 0, proc.stderr
    doc = json.loads(proc.stdout)
    assert doc["verdictSource"] is None


def test_real_run_writes_the_cache(tmp_path):
    head = _seed_single_commit_milestone_fixture(tmp_path)
    stubbin = bin_with_stub_python(tmp_path)

    proc = gw(["status", "--bet", "widget-import", "--json"], tmp_path, extra_path=stubbin)
    assert proc.returncode == 0, proc.stderr
    doc = json.loads(proc.stdout)
    # A fresh real run renders exactly as it did before this cache existed —
    # no verdictSource, no age line.
    assert doc["verdictSource"] is None
    assert doc["bet"]["milestones"][0]["state"] == "done"

    cache = json.loads(run_cache_path(tmp_path, "widget-import").read_text())
    assert cache["head"] == head
    assert cache["byFile"] == {"test_milestone_1_first-image.py": "green"}
    assert "ranAt" in cache


def test_run_flag_bypasses_cache_and_refreshes_it(tmp_path):
    head = _seed_single_commit_milestone_fixture(tmp_path)
    # A stale cache claiming green — --run must ignore it.
    seed_run_cache(tmp_path, "widget-import", head, now_iso(), {"test_milestone_1_first-image.py": "green"})
    stubbin = bin_with_stub_python(tmp_path)

    proc = gw(
        ["status", "--bet", "widget-import", "--run", "--json"], tmp_path, extra_path=stubbin,
        extra_env={"STUB_RESULTS": json.dumps({"test_milestone_1_first-image.py": "FAILED"})},
    )
    assert proc.returncode == 0, proc.stderr
    doc = json.loads(proc.stdout)
    assert doc["verdictSource"] is None  # a fresh run, not the stale cache
    assert doc["bet"]["milestones"][0]["state"] == "not-started"  # a failing stub, no slices

    cache = json.loads(run_cache_path(tmp_path, "widget-import").read_text())
    assert cache["byFile"] == {"test_milestone_1_first-image.py": "red"}


# ─── --with-proofs: one composition, both pages, at most one suite spawn ────

def _seed_proofs_fixture(tmp_path):
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(
        bet_dir, 1, "first-image", "see one image appear", "widget-import",
        consumer="A person browsing the library",
        criteria=["Upload one image and see it appear"],
        proves="The library shows an uploaded image.",
    )
    commit_test_file(tmp_path, "widget-import", "test_milestone_1_first-image.py")
    commit_all(tmp_path, "materialize milestone 1")


def test_with_proofs_writes_both_pages_from_one_composition_at_most_one_spawn(tmp_path):
    _seed_proofs_fixture(tmp_path)
    stubbin = bin_with_stub_python(tmp_path)
    counter = tmp_path / "counter.txt"
    counter.write_text("0")

    proc = gw(
        ["status", "--bet", "widget-import", "--write", "--with-proofs"], tmp_path, extra_path=stubbin,
        extra_env={"STUB_COUNTER_FILE": str(counter)},
    )
    assert proc.returncode == 0, proc.stderr
    assert int(counter.read_text()) <= 1

    status_page = (tmp_path / "docs" / "bets" / "widget-import" / "status.md").read_text()
    proofs_page = (tmp_path / "docs" / "bets" / "widget-import" / "proofs.md").read_text()
    assert "widget-import" in status_page
    assert "Upload one image and see it appear" in proofs_page


def test_with_proofs_spawns_zero_times_on_a_fresh_cache(tmp_path):
    head = None
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(
        bet_dir, 1, "first-image", "see one image appear", "widget-import",
        consumer="A person browsing the library",
        criteria=["Upload one image and see it appear"],
        proves="The library shows an uploaded image.",
    )
    commit_test_file(tmp_path, "widget-import", "test_milestone_1_first-image.py")
    commit_all(tmp_path, "materialize milestone 1")
    head = head_sha(tmp_path)
    seed_run_cache(tmp_path, "widget-import", head, now_iso(), {"test_milestone_1_first-image.py": "green"})

    purebin = bin_without_python(tmp_path)  # no python at all — proves zero spawns
    proc = gw(["status", "--bet", "widget-import", "--write", "--with-proofs"], tmp_path, extra_path=purebin)
    assert proc.returncode == 0, proc.stderr
    assert (tmp_path / "docs" / "bets" / "widget-import" / "status.md").exists()
    assert (tmp_path / "docs" / "bets" / "widget-import" / "proofs.md").exists()

    # The cache is untouched — nothing re-ran to refresh it.
    cache = json.loads(run_cache_path(tmp_path, "widget-import").read_text())
    assert cache["byFile"] == {"test_milestone_1_first-image.py": "green"}


def test_with_proofs_requires_bet_and_write(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    proc = gw(["status", "--with-proofs"], tmp_path)
    assert proc.returncode != 0

    proc = gw(["status", "--bet", "widget-import", "--with-proofs"], tmp_path)
    assert proc.returncode != 0
    assert not (tmp_path / "docs" / "bets" / "widget-import" / "proofs.md").exists()

    proc = gw(["status", "--write", "--with-proofs"], tmp_path)
    assert proc.returncode != 0


# ═══════════════════════════════════════════════════════════════════════════
# E2 — snapshot delta compression, renderer-side
# ═══════════════════════════════════════════════════════════════════════════

def test_second_identical_render_collapses_program_to_two_lines_with_counts(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    first = gw(["status", "--bet", "widget-import"], tmp_path).stdout
    assert "- **In flight** —" in first  # first-ever render is full

    second = gw(["status", "--bet", "widget-import"], tmp_path).stdout
    program_block = second.split("\n\n")[0]
    lines = [l for l in program_block.split("\n") if l.strip()]
    assert len(lines) <= 2, program_block
    assert "unchanged since" in program_block
    assert "1 in flight" in program_block
    assert "0 delivered" in program_block
    assert "0 queued" in program_block
    assert "the bet's status page" in program_block
    for term in DENYLIST:
        assert term not in second


def test_unchanged_ladder_collapses_naming_the_current_milestone(tmp_path):
    init_repo(tmp_path)
    bet_dir = write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_milestone(bet_dir, 1, "first-image", "see one image appear", "widget-import")
    commit_all(tmp_path, "seed")

    gw(["status", "--bet", "widget-import"], tmp_path)  # first render, establishes the sidecar
    second = gw(["status", "--bet", "widget-import"], tmp_path).stdout
    assert 'still on "see one image appear"' in second
    assert "- ○ Milestone 1" not in second  # the full ladder line did not also render


def test_state_flip_renders_was_marker(tmp_path):
    # Two OTHER permanently in-flight bets keep the program-only render
    # ambiguous (no auto-resolved slug, per resolveDefaultBetSlug requiring
    # exactly one) on BOTH sides of the flip — one such bet would itself
    # become the sole in-flight bet once widget-import archives, silently
    # switching the sidecar's cache key (bet-scoped vs program-only) between
    # the two calls and comparing against nothing instead of the prior render.
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_pitch(tmp_path, "alpha", "Keep something else always in flight.")
    write_pitch(tmp_path, "beta", "And a second something, also always in flight.")
    commit_all(tmp_path, "seed three in-flight bets")

    gw(["status"], tmp_path)  # establish the sidecar while all three are in flight

    archive_dir = tmp_path / "docs" / "bets" / "_archive"
    archive_dir.mkdir(parents=True, exist_ok=True)
    git(["mv", "docs/bets/widget-import", "docs/bets/_archive/widget-import"], tmp_path)
    pitch = archive_dir / "widget-import" / "pitch.md"
    pitch.write_text(pitch.read_text().replace("status: delivery", "status: delivered"))
    commit_all(tmp_path, "archive widget-import")

    out = gw(["status"], tmp_path).stdout
    assert "**Delivered** — Bring your own widgets into the library. (was in flight)" in out
    assert "**In flight** — Keep something else always in flight." in out
    for term in DENYLIST:
        assert term not in out


def test_write_output_is_full_both_times_never_compressed(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    gw(["status", "--bet", "widget-import", "--write"], tmp_path)
    first_page = (tmp_path / "docs" / "bets" / "widget-import" / "status.md").read_text()
    gw(["status", "--bet", "widget-import", "--write"], tmp_path)
    second_page = (tmp_path / "docs" / "bets" / "widget-import" / "status.md").read_text()

    for page in (first_page, second_page):
        assert "- **In flight** — Bring your own widgets into the library." in page
        assert "Program — unchanged" not in page


def test_deleted_sidecar_restores_full_render(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    gw(["status", "--bet", "widget-import"], tmp_path)
    collapsed = gw(["status", "--bet", "widget-import"], tmp_path).stdout
    assert "unchanged since" in collapsed

    sidecar = tmp_path / ".groundwork" / "cache" / "bets" / "widget-import" / "last-snapshot.json"
    assert sidecar.exists()
    sidecar.unlink()

    restored = gw(["status", "--bet", "widget-import"], tmp_path).stdout
    assert "- **In flight** — Bring your own widgets into the library." in restored
    assert "unchanged since" not in restored


def test_corrupt_sidecar_fails_open_to_full_render(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    gw(["status", "--bet", "widget-import"], tmp_path)
    sidecar = tmp_path / ".groundwork" / "cache" / "bets" / "widget-import" / "last-snapshot.json"
    sidecar.write_text("{not valid json")

    out = gw(["status", "--bet", "widget-import"], tmp_path).stdout
    assert "- **In flight** — Bring your own widgets into the library." in out


def test_full_flag_forces_uncompressed_render_every_time(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    gw(["status", "--bet", "widget-import", "--full"], tmp_path)
    second = gw(["status", "--bet", "widget-import", "--full"], tmp_path).stdout
    assert "- **In flight** — Bring your own widgets into the library." in second
    assert "unchanged since" not in second


def test_json_always_emits_the_full_composed_doc(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    commit_all(tmp_path, "seed")

    gw(["status", "--bet", "widget-import"], tmp_path)  # establish the sidecar
    proc = gw(["status", "--bet", "widget-import", "--json"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    doc = json.loads(proc.stdout)
    assert doc["program"]["inFlight"][0]["goal"] == "Bring your own widgets into the library."


# ─── E6 queue footer rides the Program collapse (must collapse WITH it) ─────

def write_queue(root, *bullets):
    notes = root / ".groundwork" / "cache"
    notes.mkdir(parents=True, exist_ok=True)
    body = "\n".join(f"- {b}" for b in bullets)
    (notes / "discovery-notes.md").write_text(f"# Discovery Notes\n\n## Bets\n\n{body}\n")


def test_queue_footer_absent_when_program_collapsed_present_on_full_render(tmp_path):
    init_repo(tmp_path)
    write_pitch(tmp_path, "widget-import", "Bring your own widgets into the library.")
    write_queue(tmp_path, "Someday: dark mode")
    commit_all(tmp_path, "seed")

    full1 = gw(["status", "--bet", "widget-import"], tmp_path).stdout
    assert "Queue order is yours" in full1

    collapsed = gw(["status", "--bet", "widget-import"], tmp_path).stdout
    assert "Queue order is yours" not in collapsed
    assert "unchanged since" in collapsed

    full2 = gw(["status", "--bet", "widget-import", "--full"], tmp_path).stdout
    assert "Queue order is yours" in full2
