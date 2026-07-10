"""
Layer 1 — Generation Correctness Tests: the dev-CLI half of the review-
throughput plan's Wave 3 slices B5, C5, and C6.

- B5 (dev-cli half): `./dev archive bet` also deletes `docs/bets/<slug>/
  proofs.md`, beside the existing `status.md` deletion — both superseded by
  the delivery record this same command writes (C6).
- C5 (dev-cli half): the last-run verdict cache (`.groundwork/cache/bets/
  <slug>/last-run.json`, `{ranAt, head, byFile}` — the exact shape
  `lib/bet-status/derive.js` reads and writes on the groundwork-method
  engine side). `bet.ts`'s board derivation reads it when fresh (HEAD
  matches, no `tests/bets/<slug>/` file newer than `ranAt`) and renders an
  honesty line naming its age and the `--run` escape hatch; both `bet.ts`'s
  own real-suite path and `quality.ts`'s `test bet` path write it after
  every real run, via the shared `cli-src/src/util/suite-cache.ts` parser.
- C6: `./dev archive bet` writes `docs/bets/<slug>/delivery-record.md`
  immediately before the docs move (after the status/proofs deletions, so
  `git mv` carries the record into `_archive/<slug>/` with everything
  else) — composed from the final board, the decisions ledger (with the
  owner's verbatim ratification responses), findings counts, and the
  memlog appendix. Every section is fail-soft: a missing/malformed source
  renders "(not recorded)" and never blocks the archive.

Runs the COMMITTED dev-cli bundle (dist/dev-bundle.js) with node against
synthetic fixtures — the same self-contained style as
tests/scaffolds/test_generation_dev_cli_docs_and_bet_panel.py, and the same
PATH-curation/stub-runner technique tests/cli/test_status_delta.py uses to
pin down the groundwork-method engine's half of this same cache.

NOTE: this file exercises source newer than the currently-committed
dist/dev-bundle.js (the new suite-cache.ts util, and the bet.ts/quality.ts/
registry.ts changes that use it). It will fail until that bundle is
rebuilt (`npm run build:dev-cli`) — this mirrors test_contracts.py's own
`_require_bundle()` gate.
"""

import json
import os
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
COMMITTED_BUNDLE = (
    REPO_ROOT / "src" / "generators" / "workspace-dev-cli" / "cli-src" / "dist" / "dev-bundle.js"
)


def _require_bundle():
    if not COMMITTED_BUNDLE.exists():
        pytest.fail(f"committed bundle missing: {COMMITTED_BUNDLE} — run npm run build:dev-cli")


def _dev(
    project: Path,
    *args: str,
    timeout: int = 15,
    extra_env: dict | None = None,
    extra_path: str | None = None,
) -> subprocess.CompletedProcess:
    """Run the committed dev bundle with node, pinned at `project` via
    DEV_ROOT. `extra_path` replaces PATH wholesale (curated bin dirs, below)
    so a test can prove exactly what did or didn't run."""
    env = {**os.environ, "DEV_ROOT": str(project)}
    if extra_path is not None:
        env["PATH"] = extra_path
    if extra_env:
        env.update(extra_env)
    return subprocess.run(
        ["node", str(COMMITTED_BUNDLE), *args],
        cwd=str(project),
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
    )


def _git(args, cwd):
    return subprocess.run(
        ["git", "-c", "user.email=t@t", "-c", "user.name=t", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=True,
    )


def _init_repo(root: Path) -> None:
    _git(["init", "-q"], root)


def _commit_all(root: Path, message: str) -> None:
    _git(["add", "-A"], root)
    _git(["commit", "-q", "-m", message], root)


def _head_sha(root: Path) -> str:
    return _git(["rev-parse", "HEAD"], root).stdout.strip()


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _project(tmp_path: Path) -> Path:
    project = tmp_path / "proj"
    (project / ".dev").mkdir(parents=True)
    (project / ".dev" / "dev.config.json").write_text(json.dumps({"projectPrefix": "demo", "runners": []}))
    return project


def _seed_bet(project: Path, slug: str, with_slice: bool = True):
    """A minimal materialized bet: docs/bets/<slug>/ + tests/bets/<slug>/
    with one milestone test file (and, optionally, one slice test file) —
    enough for bet.ts's board derivation to have rows to work with.
    tests/system/ is also seeded so quality.ts's `test` command clears its
    early "no system tests" gate."""
    docs = project / "docs" / "bets" / slug
    docs.mkdir(parents=True)
    (docs / "pitch.md").write_text(f"---\nstatus: delivery\n---\n# Bet: {slug}\n")

    tests_dir = project / "tests" / "bets" / slug
    tests_dir.mkdir(parents=True)
    (tests_dir / "test_milestone_1_first-image.py").write_text("def test_x():\n    assert True\n")
    if with_slice:
        (tests_dir / "test_slice_1_library_image-upload.py").write_text("def test_y():\n    assert True\n")

    (project / "tests" / "system").mkdir(parents=True, exist_ok=True)
    return docs, tests_dir


def _seed_run_cache(project: Path, slug: str, head: str, ran_at: str, by_file: dict) -> Path:
    d = project / ".groundwork" / "cache" / "bets" / slug
    d.mkdir(parents=True, exist_ok=True)
    (d / "last-run.json").write_text(json.dumps({"ranAt": ran_at, "head": head, "byFile": by_file}))
    return d / "last-run.json"


def _run_cache_path(project: Path, slug: str) -> Path:
    return project / ".groundwork" / "cache" / "bets" / slug / "last-run.json"


# ─── PATH control (mirrors tests/cli/test_status_delta.py's technique,
# applied to `uv` instead of `python3` — bet.ts/quality.ts shell out to
# `uv run pytest`, not a bare interpreter) ───────────────────────────────────


def _bin_without_uv(tmp_path: Path) -> str:
    """A curated bin dir with ONLY git+node symlinked in — makes "no test
    runner on PATH" airtight rather than incidentally true of this machine."""
    bindir = tmp_path / "purebin"
    bindir.mkdir(exist_ok=True)
    for name in ("git", "node"):
        target = shutil.which(name)
        if target and not (bindir / name).exists():
            (bindir / name).symlink_to(target)
    return str(bindir)


STUB_UV = r"""#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const counterFile = process.env.STUB_COUNTER_FILE;
function bump() {
  if (!counterFile) return;
  let n = 0;
  try { n = parseInt(fs.readFileSync(counterFile, 'utf8'), 10) || 0; } catch (e) {}
  fs.writeFileSync(counterFile, String(n + 1));
}
// Only `uv run pytest <dir>/ ...` is emulated (what bet.ts/quality.ts run) —
// anything else is a silent no-op success.
if (args[0] === 'run' && args[1] === 'pytest') {
  bump();
  const testDir = args[2] || '';
  let results = {};
  try { results = JSON.parse(process.env.STUB_RESULTS || '{}'); } catch (e) {}
  let files = [];
  try { files = fs.readdirSync(testDir).filter((f) => /^test_(milestone|slice)_.*\.py$/.test(f)); } catch (e) {}
  let anyFail = false;
  for (const f of files) {
    const outcome = results[f] || 'PASSED';
    if (outcome !== 'PASSED') anyFail = true;
    console.log(testDir.replace(/\/$/, '') + '/' + f + '::test_x ' + outcome + ' [100%]');
  }
  process.exit(anyFail ? 1 : 0);
}
process.exit(0);
"""


def _bin_with_stub_uv(tmp_path: Path) -> str:
    bindir = tmp_path / "stubbin"
    bindir.mkdir(exist_ok=True)
    for name in ("git", "node"):
        target = shutil.which(name)
        if target and not (bindir / name).exists():
            (bindir / name).symlink_to(target)
    stub = bindir / "uv"
    stub.write_text(STUB_UV)
    stub.chmod(0o755)
    return str(bindir)


# ═══════════════════════════════════════════════════════════════════════════
# B5 + C6 — archive: proofs.md deletion + the delivery record
# ═══════════════════════════════════════════════════════════════════════════


def test_archive_writes_delivery_record_with_rulings_and_memlog(tmp_path):
    _require_bundle()
    project = _project(tmp_path)
    _init_repo(project)
    docs, _tests_dir = _seed_bet(project, "widget-import")
    _commit_all(project, "seed widget-import bet")
    head = _head_sha(project)

    _seed_run_cache(
        project,
        "widget-import",
        head,
        _now_iso(),
        {
            "test_milestone_1_first-image.py": "green",
            "test_slice_1_library_image-upload.py": "red",
        },
    )

    # status.md / proofs.md — must not survive the archive (B5, plus the
    # pre-existing status.md contract).
    (docs / "status.md").write_text("stale status\n")
    (docs / "proofs.md").write_text("stale proofs\n")

    decisions_doc = {
        "schema": 1,
        "bet": "widget-import",
        "decisions": [
            {
                "id": "D1",
                "question": "Ship the SVG uploader too?",
                "default": "no — raster only for M1",
                "rationale": "keep M1 narrow",
                "milestone": 1,
                "status": "ratified",
                "created": _now_iso(),
                "ratification": {
                    "outcome": "ratified",
                    "response": "MAGENTA-PLATYPUS-42 — yes, raster only, ship it.",
                    "at": None,
                    "ts": _now_iso(),
                },
            },
            {
                "id": "D2",
                "question": "Bump the thumbnail size?",
                "default": "keep 200px",
                "rationale": "no evidence it matters yet",
                "milestone": 1,
                "status": "pending",
                "created": _now_iso(),
                "ratification": None,
            },
        ],
    }
    bet_state_dir = project / ".groundwork" / "bets" / "widget-import"
    bet_state_dir.mkdir(parents=True)
    (bet_state_dir / "decisions.json").write_text(json.dumps(decisions_doc))

    findings_doc = {
        "schema": 1,
        "bet": "widget-import",
        "findings": [
            {
                "id": "F1",
                "title": "Upload spinner never clears on error",
                "bucket": "patch",
                "status": "closed",
                "slice": "1.1-library-upload",
                "milestone": 1,
                "lens": "reviewer",
                "location": None,
                "disposition": "fixed",
                "note": "fixed in the same slice",
                "created": _now_iso(),
                "closed": _now_iso(),
            },
        ],
    }
    (bet_state_dir / "findings.json").write_text(json.dumps(findings_doc))

    cache_dir = project / ".groundwork" / "cache" / "bets" / "widget-import"
    (cache_dir / "memlog.md").write_text(
        "- 2026-07-08T10:00:00Z — milestone 1 opened\n"
        "- 2026-07-09T09:00:00Z — slice 1.1 closed (abc123)\n"
        "- 2026-07-09T15:00:00Z — milestone 1 postmortem: proof honest, plan unchanged\n"
    )

    purebin = _bin_without_uv(tmp_path)
    run = _dev(project, "archive", "bet", "widget-import", extra_path=purebin)
    assert run.returncode == 0, f"archive failed:\n{run.stdout}{run.stderr}"

    archived_docs = project / "docs" / "bets" / "_archive" / "widget-import"
    record = archived_docs / "delivery-record.md"
    assert record.exists(), f"delivery-record.md missing:\n{run.stdout}{run.stderr}"
    text = record.read_text()

    assert text.startswith("<!-- GENERATED")
    assert "# Delivery record: widget-import" in text

    # (b) Your rulings — the owner's verbatim ratification response.
    assert "MAGENTA-PLATYPUS-42 — yes, raster only, ship it." in text

    # (d) Delivery log — the memlog copied whole.
    for line in [
        "milestone 1 opened",
        "slice 1.1 closed (abc123)",
        "milestone 1 postmortem: proof honest, plan unchanged",
    ]:
        assert line in text, f"memlog line missing from the record: {line!r}\n{text}"

    # (a) How it proved out — the final board, same glyph vocabulary as the
    # terminal board (passing/failing), derived via the seeded C5 cache.
    assert "## How it proved out" in text
    assert "first-image" in text and "passing" in text
    assert "image-upload" in text and "failing" in text

    assert not (archived_docs / "status.md").exists()
    assert not (archived_docs / "proofs.md").exists()
    assert not (project / ".groundwork" / "cache" / "bets" / "widget-import").exists()


def test_archive_with_no_ledgers_or_cache_records_not_recorded(tmp_path):
    _require_bundle()
    project = _project(tmp_path)
    _init_repo(project)
    _seed_bet(project, "quiet-bet", with_slice=False)
    _commit_all(project, "seed quiet-bet")

    purebin = _bin_without_uv(tmp_path)
    run = _dev(project, "archive", "bet", "quiet-bet", extra_path=purebin)
    assert run.returncode == 0, f"archive failed:\n{run.stdout}{run.stderr}"

    record = project / "docs" / "bets" / "_archive" / "quiet-bet" / "delivery-record.md"
    assert record.exists()
    text = record.read_text()
    assert "# Delivery record: quiet-bet" in text
    assert "## Your rulings" in text
    assert "## Findings" in text
    assert "## Delivery log" in text
    # Rulings and findings both have nothing to read from — never a crash,
    # never a blocked archive, just an honest placeholder.
    assert text.count("(not recorded)") >= 2, text


# ═══════════════════════════════════════════════════════════════════════════
# C5 (dev-cli half) — the last-run verdict cache
# ═══════════════════════════════════════════════════════════════════════════


def test_status_cache_hit_prints_age_line_without_spawning_uv(tmp_path):
    _require_bundle()
    project = _project(tmp_path)
    _init_repo(project)
    _seed_bet(project, "widget-import")
    _commit_all(project, "seed widget-import bet")
    head = _head_sha(project)
    _seed_run_cache(
        project,
        "widget-import",
        head,
        _now_iso(),
        {
            "test_milestone_1_first-image.py": "green",
            "test_slice_1_library_image-upload.py": "red",
        },
    )

    stubbin = _bin_with_stub_uv(tmp_path)
    counter = tmp_path / "counter.txt"
    counter.write_text("0")

    run = _dev(
        project,
        "bet",
        "status",
        "widget-import",
        extra_path=stubbin,
        extra_env={"STUB_COUNTER_FILE": str(counter)},
    )
    out = run.stdout + run.stderr
    assert run.returncode == 0, out
    assert counter.read_text() == "0", f"a cache hit must never spawn the suite:\n{out}"
    assert "Test states from the last run," in out, out
    assert "./dev bet status widget-import --run" in out, out
    assert "passing" in out and "failing" in out


def test_run_flag_bypasses_cache_and_refreshes_it(tmp_path):
    _require_bundle()
    project = _project(tmp_path)
    _init_repo(project)
    _seed_bet(project, "widget-import", with_slice=False)
    _commit_all(project, "seed widget-import bet")
    head = _head_sha(project)
    # A stale-but-valid-looking cache claiming green — --run must ignore it.
    _seed_run_cache(project, "widget-import", head, _now_iso(), {"test_milestone_1_first-image.py": "green"})

    stubbin = _bin_with_stub_uv(tmp_path)
    counter = tmp_path / "counter.txt"
    counter.write_text("0")

    run = _dev(
        project,
        "bet",
        "status",
        "widget-import",
        "--run",
        "--json",
        extra_path=stubbin,
        extra_env={
            "STUB_COUNTER_FILE": str(counter),
            "STUB_RESULTS": json.dumps({"test_milestone_1_first-image.py": "FAILED"}),
        },
    )
    assert run.returncode == 0, run.stdout + run.stderr
    assert counter.read_text() == "1", "--run must spawn the suite exactly once, bypassing the cache"
    doc = json.loads(run.stdout)
    assert doc["milestones"][0]["state"] == "red"

    cache = json.loads(_run_cache_path(project, "widget-import").read_text())
    assert cache["head"] == head
    assert cache["byFile"] == {"test_milestone_1_first-image.py": "red"}


def test_wrong_head_in_cache_falls_back_to_real_run(tmp_path):
    _require_bundle()
    project = _project(tmp_path)
    _init_repo(project)
    _seed_bet(project, "widget-import", with_slice=False)
    _commit_all(project, "seed widget-import bet")
    # Cache keyed to a head that no longer matches.
    _seed_run_cache(project, "widget-import", "0" * 40, _now_iso(), {"test_milestone_1_first-image.py": "green"})

    stubbin = _bin_with_stub_uv(tmp_path)
    counter = tmp_path / "counter.txt"
    counter.write_text("0")

    run = _dev(
        project,
        "bet",
        "status",
        "widget-import",
        "--json",
        extra_path=stubbin,
        extra_env={"STUB_COUNTER_FILE": str(counter)},
    )
    assert run.returncode == 0, run.stdout + run.stderr
    assert counter.read_text() == "1", "a wrong-head cache must fall back to a real run"
    doc = json.loads(run.stdout)
    assert doc["milestones"][0]["state"] == "green"  # STUB_UV defaults every file to PASSED


def test_touching_a_test_file_invalidates_the_cache(tmp_path):
    _require_bundle()
    project = _project(tmp_path)
    _init_repo(project)
    _, tests_dir = _seed_bet(project, "widget-import", with_slice=False)
    _commit_all(project, "seed widget-import bet")
    head = _head_sha(project)
    ran_at = _now_iso()
    _seed_run_cache(project, "widget-import", head, ran_at, {"test_milestone_1_first-image.py": "green"})

    future = (datetime.now(timezone.utc) + timedelta(minutes=5)).timestamp()
    test_file = tests_dir / "test_milestone_1_first-image.py"
    os.utime(test_file, (future, future))

    stubbin = _bin_with_stub_uv(tmp_path)
    counter = tmp_path / "counter.txt"
    counter.write_text("0")

    run = _dev(
        project,
        "bet",
        "status",
        "widget-import",
        "--json",
        extra_path=stubbin,
        extra_env={"STUB_COUNTER_FILE": str(counter)},
    )
    assert run.returncode == 0, run.stdout + run.stderr
    assert counter.read_text() == "1", "a touched test file must invalidate the cache"


def test_dev_test_bet_writes_the_cache(tmp_path):
    """quality.ts's `test bet` path (non-integration) is a cache WRITER too —
    a failing bet suite still leaves an accurate cache entry behind for the
    next `./dev bet status` to read."""
    _require_bundle()
    project = _project(tmp_path)
    _init_repo(project)
    _seed_bet(project, "widget-import", with_slice=False)
    _commit_all(project, "seed widget-import bet")
    head = _head_sha(project)

    stubbin = _bin_with_stub_uv(tmp_path)
    run = _dev(
        project,
        "test",
        "bet",
        "widget-import",
        extra_path=stubbin,
        extra_env={"STUB_RESULTS": json.dumps({"test_milestone_1_first-image.py": "FAILED"})},
    )
    assert run.returncode != 0, "a failing bet suite must exit nonzero"
    assert "test_milestone_1_first-image.py::test_x FAILED" in (run.stdout + run.stderr)

    cache = json.loads(_run_cache_path(project, "widget-import").read_text())
    assert cache["head"] == head
    assert cache["byFile"] == {"test_milestone_1_first-image.py": "red"}

    # The cache this just wrote must be usable by the board command too —
    # proving the two commands' writes/reads share one shape.
    counter = tmp_path / "counter.txt"
    counter.write_text("0")
    status_run = _dev(
        project,
        "bet",
        "status",
        "widget-import",
        "--json",
        extra_path=stubbin,
        extra_env={"STUB_COUNTER_FILE": str(counter)},
    )
    assert status_run.returncode == 0, status_run.stdout + status_run.stderr
    assert counter.read_text() == "0", "the just-written cache must be read, not re-run"
    doc = json.loads(status_run.stdout)
    assert doc["milestones"][0]["state"] == "red"
