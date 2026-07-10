"""
Layer 1 — Generation Correctness Tests: `./dev docs` + the bet-board status panel

review-throughput plan, Wave 3, slices C1 ("./dev docs: boot-or-refresh, URL
truth everywhere") and E5 ("bet board panel in `./dev status` / `--watch`").

Named `test_generation_*` (matching test_generation_docsite_live_sync.py's
precedent) so it rides the existing fast Generation tier in `./dev ci` step 2
(`pytest tests/scaffolds/test_generation*.py`) without needing new CI wiring.

Runs the COMMITTED dev-cli bundle (dist/dev-bundle.js) with node against
synthetic `.dev/dev.config.json` fixtures — the same style as
tests/scaffolds/test_contracts.py and test_dev_cli_extensions.py, self-
contained here rather than imported so this file has no cross-file coupling.
No Nx generation, no pnpm/next — the docs "runner" is a throwaway Node HTTP
server, since `./dev docs`'s boot/probe/refresh machinery only cares that
*something* answers on the configured port, not that it's actually Next.js.

NOTE: these tests exercise cli-src/src/commands/docs.ts, bet-panel.ts, and the
lifecycle.ts/registry.ts changes that ship them — i.e. code newer than the
currently-committed dist/dev-bundle.js. They will fail until that bundle is
rebuilt (`npm run build:dev-cli`) to pick the new source up; this mirrors
test_contracts.py's own `_require_bundle()` gate.

`test_docs_probe_timeout_reports_log_path_never_dead_url` is intentionally
slow (~90s) — it exercises the real probe-timeout deadline end to end rather
than a shortened stand-in, because "never print a dead URL" is exactly the
failure mode worth proving against the real wait.
"""

import json
import socket
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
COMMITTED_BUNDLE = (
    REPO_ROOT / "src" / "generators" / "workspace-dev-cli" / "cli-src" / "dist" / "dev-bundle.js"
)


def _require_bundle():
    if not COMMITTED_BUNDLE.exists():
        pytest.fail(f"committed bundle missing: {COMMITTED_BUNDLE} — run npm run build:dev-cli")


def _dev(project: Path, *args: str, timeout: int = 15) -> subprocess.CompletedProcess:
    """Run the committed dev bundle with node, pinned at `project` via DEV_ROOT."""
    import os

    return subprocess.run(
        ["node", str(COMMITTED_BUNDLE), *args],
        cwd=str(project),
        capture_output=True,
        text=True,
        timeout=timeout,
        env={**os.environ, "DEV_ROOT": str(project)},
    )


def _project(tmp_path: Path, config: dict) -> Path:
    project = tmp_path / "proj"
    (project / ".dev").mkdir(parents=True)
    (project / ".dev" / "dev.config.json").write_text(json.dumps(config))
    return project


def _free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _seed_docs_runner(project: Path, service_dir: str, port: int) -> None:
    """Materialize a throwaway 'docs site': a package.json carrying the
    `sync-live-bets` script the docs-site generator always wires (the
    name-independent discovery signal `findDocsRunner` looks for), a fake
    HTTP server standing in for `next dev`, and a sync script that leaves a
    marker file so a test can prove it ran."""
    svc = project / service_dir
    (svc / "scripts").mkdir(parents=True)
    (svc / "package.json").write_text(
        json.dumps(
            {
                "name": "docs",
                "scripts": {
                    "dev": "node fake-server.js",
                    "sync-live-bets": "node scripts/sync-live-bets.js",
                },
            }
        )
    )
    (svc / "fake-server.js").write_text(
        "require('http').createServer((req, res) => res.end('ok'))"
        ".listen(process.env.PORT);\n"
    )
    (svc / "scripts" / "sync-live-bets.js").write_text(
        "require('fs').writeFileSync('synced.marker', String(Date.now()));\n"
    )
    _ = port  # port lives in dev.config.json's runner env, not the fixture itself


def _stop(project: Path) -> None:
    _dev(project, "stop", timeout=20)


# ---------------------------------------------------------------------------
# C1 — `./dev docs`
# ---------------------------------------------------------------------------


def test_docs_command_listed_in_help_under_lifecycle(tmp_path):
    _require_bundle()
    project = _project(tmp_path, {"projectPrefix": "demo", "runners": []})
    out = _dev(project, "help")
    text = out.stdout + out.stderr
    assert "docs" in text, f"docs verb missing from help:\n{text}"
    assert "LIFECYCLE" in text


def test_docs_no_site_registered_prints_pointer_and_exits_zero(tmp_path):
    """No registered runner carries a `sync-live-bets` script → one info line,
    exit 0 (never a hang, never a nonzero exit for "nothing to do")."""
    _require_bundle()
    project = _project(tmp_path, {"projectPrefix": "demo", "runners": []})
    run = _dev(project, "docs")
    assert run.returncode == 0, f"docs with no site should exit 0:\n{run.stderr}"
    out = (run.stdout + run.stderr).lower()
    assert "no docs site scaffolded" in out, f"missing the no-docsite pointer:\n{out}"


def test_docs_discovers_runner_name_independently_boots_and_probes(tmp_path):
    """A runner named nothing like "docs" is still found, purely by its cwd's
    package.json carrying a `sync-live-bets` script — then booted via the
    shared spawn/pid/log path and polled until its port answers."""
    _require_bundle()
    project = _project(tmp_path, {"projectPrefix": "demo", "runners": []})
    port = _free_port()
    _seed_docs_runner(project, "services/documentation-hub", port)
    (project / ".dev" / "dev.config.json").write_text(
        json.dumps(
            {
                "projectPrefix": "demo",
                "runners": [
                    {
                        "name": "documentation-hub",
                        "kind": "surface",
                        "cmd": "node fake-server.js",
                        "cwd": "services/documentation-hub",
                        "env": {"PORT": str(port)},
                        "autostart": False,
                    }
                ],
            }
        )
    )
    try:
        run = _dev(project, "docs", timeout=100)
        out = run.stdout + run.stderr
        assert run.returncode == 0, f"docs boot+probe failed:\n{out}"
        assert f"http://localhost:{port}" in out, f"live URL not printed:\n{out}"
    finally:
        _stop(project)


def test_docs_second_call_refreshes_when_already_running(tmp_path):
    """Once the runner is already serving, a second `./dev docs` call is a
    one-shot `sync-live-bets.js` refresh (proven via its marker file side
    effect) rather than a re-boot, and still prints the URL."""
    _require_bundle()
    project = _project(tmp_path, {"projectPrefix": "demo", "runners": []})
    port = _free_port()
    _seed_docs_runner(project, "services/docs", port)
    (project / ".dev" / "dev.config.json").write_text(
        json.dumps(
            {
                "projectPrefix": "demo",
                "runners": [
                    {
                        "name": "docs",
                        "kind": "surface",
                        "cmd": "node fake-server.js",
                        "cwd": "services/docs",
                        "env": {"PORT": str(port)},
                        "autostart": False,
                    }
                ],
            }
        )
    )
    try:
        first = _dev(project, "docs", timeout=100)
        assert first.returncode == 0, f"first docs call failed:\n{first.stdout}{first.stderr}"

        marker = project / "services" / "docs" / "synced.marker"
        assert not marker.exists(), "sync script must not run on the boot path, only on refresh"

        second = _dev(project, "docs", timeout=15)
        out = second.stdout + second.stderr
        assert second.returncode == 0, f"refresh call failed:\n{out}"
        assert f"http://localhost:{port}" in out, f"URL missing on refresh:\n{out}"
        assert marker.exists(), "already-running docs call must run sync-live-bets.js"
    finally:
        _stop(project)


def test_status_renders_url_for_running_docs_runner_and_hint_when_stopped(tmp_path):
    """C1b — the URL column: running renders the live URL, and once stopped
    the docs runner specifically renders the `./dev docs` boot hint rather
    than a dead link."""
    _require_bundle()
    project = _project(tmp_path, {"projectPrefix": "demo", "runners": []})
    port = _free_port()
    _seed_docs_runner(project, "services/docs", port)
    (project / ".dev" / "dev.config.json").write_text(
        json.dumps(
            {
                "projectPrefix": "demo",
                "runners": [
                    {
                        "name": "docs",
                        "kind": "surface",
                        "cmd": "node fake-server.js",
                        "cwd": "services/docs",
                        "env": {"PORT": str(port)},
                        "autostart": False,
                    }
                ],
            }
        )
    )
    try:
        boot = _dev(project, "docs", timeout=100)
        assert boot.returncode == 0, f"boot failed:\n{boot.stdout}{boot.stderr}"

        running = _dev(project, "status")
        assert f"http://localhost:{port}" in (running.stdout + running.stderr)

        _stop(project)
        stopped = _dev(project, "status")
        assert "./dev docs" in (stopped.stdout + stopped.stderr), (
            f"stopped docs runner must hint the boot verb:\n{stopped.stdout}{stopped.stderr}"
        )
    finally:
        _stop(project)


def test_docs_probe_timeout_reports_log_path_never_dead_url(tmp_path):
    """Probe timeout (~90s): the runner boots but its port never answers — the
    command must fail loud with the log-file path, and MUST NOT print the URL
    as if it were live. Intentionally slow; see module docstring."""
    _require_bundle()
    project = _project(tmp_path, {"projectPrefix": "demo", "runners": []})
    port = _free_port()
    svc = project / "services" / "docs"
    (svc / "scripts").mkdir(parents=True)
    (svc / "package.json").write_text(
        json.dumps({"name": "docs", "scripts": {"sync-live-bets": "true"}})
    )
    # Never opens the port — forces the probe to exhaust its ~90s deadline.
    (svc / "fake-server.js").write_text("setInterval(() => {}, 1000);\n")
    (project / ".dev" / "dev.config.json").write_text(
        json.dumps(
            {
                "projectPrefix": "demo",
                "runners": [
                    {
                        "name": "docs",
                        "kind": "surface",
                        "cmd": "node fake-server.js",
                        "cwd": "services/docs",
                        "env": {"PORT": str(port)},
                        "autostart": False,
                    }
                ],
            }
        )
    )
    try:
        run = _dev(project, "docs", timeout=110)
        out = run.stdout + run.stderr
        assert run.returncode != 0, f"probe timeout must exit non-zero:\n{out}"
        assert f"http://localhost:{port}" not in out or "Docs site: " not in out, (
            f"a timed-out probe must never print the URL as live:\n{out}"
        )
        assert ".log" in out, f"probe timeout must point at the log file:\n{out}"
    finally:
        _stop(project)


# ---------------------------------------------------------------------------
# E5 — the bet-board status panel
# ---------------------------------------------------------------------------


def _board_yaml(step: str) -> str:
    return f"""bet: notifications
track: full
mode: slice
step: {step}
approved: bet/notifications/approved@abc123
updated: 2026-07-10T12:00:00Z
milestones:
  - n: 1
    slices:
      - key: 1.1-billing-record-event
        status: done
        commit: abc123
        tier: execution
        review-pointer: reviews/1.1-billing-record-event/
      - key: 1.2-billing-refund
        status: blocked
        commit: null
        tier: execution
        review-pointer: reviews/1.2-billing-refund/
"""


def test_bet_panel_absent_without_active_lane_sentinel(tmp_path):
    """No sentinel → `--json` output is byte-identical to a run with no bet
    machinery at all (no additive `bet` key), and no panel prints."""
    _require_bundle()
    project = _project(tmp_path, {"projectPrefix": "demo", "runners": []})
    run = _dev(project, "status", "--json")
    assert run.returncode == 0
    payload = json.loads(run.stdout)
    assert "bet" not in payload, f"bet key must be absent with no sentinel: {payload}"

    text = _dev(project, "status")
    assert "Bet:" not in (text.stdout + text.stderr)


def test_bet_panel_fails_silent_on_missing_or_malformed_board(tmp_path):
    """A sentinel naming a bet whose board.yaml is missing, or present but
    unparsable, must degrade to the exact same output as no sentinel at all —
    never a crash, never a partial/garbled panel."""
    _require_bundle()
    project = _project(tmp_path, {"projectPrefix": "demo", "runners": []})
    baseline = json.loads(_dev(project, "status", "--json").stdout)

    cache = project / ".groundwork" / "cache"
    cache.mkdir(parents=True)
    (cache / "active-lane").write_text("notifications\n")

    # (a) sentinel present, no board directory at all.
    no_board = json.loads(_dev(project, "status", "--json").stdout)
    assert no_board == baseline, f"missing board must be silent: {no_board}"

    # (b) sentinel present, board.yaml present but garbage.
    board_dir = cache / "bets" / "notifications"
    board_dir.mkdir(parents=True)
    (board_dir / "board.yaml").write_text("not: even: valid: yaml: :::\n")
    garbled = json.loads(_dev(project, "status", "--json").stdout)
    assert garbled == baseline, f"malformed board must be silent: {garbled}"

    # (c) sentinel + board present, but `step` isn't one of the four known
    # step-router values — also silent, never a guess.
    (board_dir / "board.yaml").write_text(_board_yaml("step-99-unrecognized"))
    unknown_step = json.loads(_dev(project, "status", "--json").stdout)
    assert unknown_step == baseline, f"unrecognized step must be silent: {unknown_step}"


def test_bet_panel_renders_current_milestone_slices_and_json_key(tmp_path):
    """A valid sentinel + board.yaml renders the panel (slug, plain-language
    step phrase, one row per current-milestone slice) and the additive
    `--json` `bet` key, leaving every prior `status --json` key untouched."""
    _require_bundle()
    project = _project(tmp_path, {"projectPrefix": "demo", "runners": []})
    baseline_keys = set(json.loads(_dev(project, "status", "--json").stdout).keys())

    cache = project / ".groundwork" / "cache"
    board_dir = cache / "bets" / "notifications"
    board_dir.mkdir(parents=True)
    (cache / "active-lane").write_text("notifications\n")
    (board_dir / "board.yaml").write_text(_board_yaml("step-02-slice-loop"))
    (board_dir / "memlog.md").write_text(
        "- 2026-07-09T10:00:00Z — milestone 1 opened\n"
        "- 2026-07-10T09:00:00Z — slice 1.1 closed (abc123)\n"
    )

    payload = json.loads(_dev(project, "status", "--json").stdout)
    assert baseline_keys <= set(payload.keys()), "existing keys must survive additively"
    assert payload["bet"]["slug"] == "notifications"
    assert payload["bet"]["step"] == "building slices"
    assert {"key": "1.1-billing-record-event", "status": "done"} in payload["bet"]["slices"]
    assert {"key": "1.2-billing-refund", "status": "blocked"} in payload["bet"]["slices"]
    assert payload["bet"]["lastEvent"] == "- 2026-07-10T09:00:00Z — slice 1.1 closed (abc123)"

    text = _dev(project, "status")
    out = text.stdout + text.stderr
    assert "notifications" in out and "building slices" in out
    assert "1.1-billing-record-event" in out and "1.2-billing-refund" in out
