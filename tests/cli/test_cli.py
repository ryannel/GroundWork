"""CLI contract tests for bin/groundwork.js (init / update / check).

Each test runs the real CLI in a scratch directory. Together they pin the
install contract: what init lays down, what re-init and update preserve, what
the self-copy guard refuses, and the exit-code semantics check promises CI.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"
PKG_VERSION = json.loads((REPO_ROOT / "package.json").read_text())["version"]


def run_cli(args, cwd):
    # Suppress the async update-check so no network line ever bleeds into asserted output.
    env = {**os.environ, "GROUNDWORK_NO_UPDATE_CHECK": "1"}
    return subprocess.run(
        ["node", str(CLI), *args], cwd=cwd, capture_output=True, text=True, env=env
    )


def git(args, cwd):
    return subprocess.run(
        ["git", "-c", "user.email=t@t", "-c", "user.name=t", *args],
        cwd=cwd, capture_output=True, text=True, check=True,
    )


@pytest.fixture()
def project(tmp_path):
    git(["init", "-q"], tmp_path)
    return tmp_path


def test_init_installs_the_contract(project):
    proc = run_cli(["init"], project)
    assert proc.returncode == 0, proc.stderr

    # Skill trees
    assert (project / ".agents/skills/groundwork-orchestrator/SKILL.md").exists()
    assert (project / ".agents/skills/groundwork-orchestrator/workflow-index.md").exists()
    assert (project / ".groundwork/skills/operating-contract.md").exists()
    assert (project / ".groundwork/skills/groundwork-bet/instructions.md").exists()
    # Hidden skills no longer live under .agents/ — nothing an agent scanner can reach.
    assert not (project / ".agents/groundwork").exists()
    # Engineer skills are not installed at the root; they promote into scaffolds only.
    assert not (project / ".groundwork/skills/groundwork-go-engineer").exists()
    # Config: state seed, version stamp, user config, generators
    state = json.loads((project / ".groundwork/config/state.json").read_text())
    assert state["groundwork"]["version"] == PKG_VERSION
    assert state["completed"] == []
    assert (project / ".groundwork/config/config.toml").exists()
    assert (project / ".groundwork/config/generators.json").exists()
    assert (project / ".groundwork/cache").is_dir()
    # Agent surfaces: AGENTS.md is the canonical real file; Claude Code (the verified host,
    # the non-interactive fallback) is wired to it via symlinks and recorded in state.
    assert (project / "AGENTS.md").is_file() and not (project / "AGENTS.md").is_symlink()
    assert (project / ".claude").is_symlink()
    claude_md = project / "CLAUDE.md"
    assert claude_md.is_symlink() and Path(claude_md.readlink()).name == "AGENTS.md"
    assert state["groundwork"]["agents"] == ["claude-code"]
    mcp_servers = json.loads((project / ".mcp.json").read_text())["mcpServers"]
    assert "serena" in mcp_servers and "depwire" not in mcp_servers
    # Quiet launch: no browser dashboard tab on MCP startup.
    assert mcp_servers["serena"]["args"][-2:] == ["--open-web-dashboard", "false"]
    # The server is approved in the committed settings — Claude Code never prompts, so it
    # never needs the .claude/settings.local.json write that fails through the dir symlink.
    settings = json.loads((project / ".claude/settings.json").read_text())
    assert settings["enabledMcpjsonServers"] == ["serena"]
    assert (project / "llms.txt").exists()


def test_reinit_preserves_other_mcp_approvals(project):
    run_cli(["init"], project)
    settings_path = project / ".agents/settings.json"
    settings = json.loads(settings_path.read_text())
    settings["enabledMcpjsonServers"] = ["other-server"]
    settings_path.write_text(json.dumps(settings))

    proc = run_cli(["init"], project)
    assert proc.returncode == 0, proc.stderr
    enabled = json.loads(settings_path.read_text())["enabledMcpjsonServers"]
    # Additive and idempotent: serena is re-approved once, the user's entry survives.
    assert enabled == ["other-server", "serena"]


def test_init_agent_flag_wires_only_named_agents(project):
    # A native agent (Cursor reads AGENTS.md + .agents/skills directly) gets the canonical
    # files but no Claude-specific symlinks.
    proc = run_cli(["init", "--agent", "cursor"], project)
    assert proc.returncode == 0, proc.stderr
    assert (project / "AGENTS.md").is_file()
    assert not (project / ".claude").exists()
    assert not (project / "CLAUDE.md").exists()
    state = json.loads((project / ".groundwork/config/state.json").read_text())
    assert state["groundwork"]["agents"] == ["cursor"]
    assert "natively" in proc.stdout


def test_init_set_seeds_config_value(project):
    # --set writes into config.toml only at seed time.
    proc = run_cli(["init", "--yes", "--set", "defaults.stack=go"], project)
    assert proc.returncode == 0, proc.stderr
    cfg = (project / ".groundwork/config/config.toml").read_text()
    assert 'stack = "go"' in cfg
    assert "# stack" not in cfg.split("[defaults]")[1].split("\n")[1]  # the example line was activated


def test_init_set_refuses_on_existing_install(project):
    run_cli(["init", "--yes"], project)
    proc = run_cli(["init", "--yes", "--set", "defaults.stack=python"], project)
    assert proc.returncode == 0, proc.stderr
    assert "already exists" in proc.stdout or "already exists" in proc.stderr
    # the seeded (commented) template is untouched — no active stack line was written
    cfg = (project / ".groundwork/config/config.toml").read_text()
    assert 'stack = "python"' not in cfg


def test_init_set_rejects_unknown_and_unsafe_keys(project):
    bogus = run_cli(["init", "--yes", "--set", "defaults.bogus=x"], project)
    assert bogus.returncode == 1
    assert "unknown config key" in bogus.stdout or "unknown config key" in bogus.stderr
    # a rejected --set must not leave a half-written config behind
    assert not (project / ".groundwork/config/config.toml").exists()
    unsafe = run_cli(["init", "--yes", "--set", "__proto__.x=1"], project)
    assert unsafe.returncode == 1
    assert "unsafe key" in unsafe.stdout or "unsafe key" in unsafe.stderr


def test_policy_resolves_and_merges(project):
    cfg = project / ".groundwork/config"
    cfg.mkdir(parents=True)
    (cfg / "policy.toml").write_text(
        '[facts]\nitems = ["team A", "team B"]\n[checklists]\narchitecture = ["Name the region."]\n'
    )
    (cfg / "policy.user.toml").write_text('[facts]\nitems = ["personal C"]\n')
    proc = run_cli(["policy"], project)
    assert proc.returncode == 0, proc.stderr
    resolved = json.loads(proc.stdout)
    # arrays concatenate, team first
    assert resolved["facts"]["items"] == ["team A", "team B", "personal C"]
    assert resolved["checklists"]["architecture"] == ["Name the region."]


def test_check_flags_broken_policy(project):
    cfg = project / ".groundwork/config"
    cfg.mkdir(parents=True)
    (cfg / "policy.toml").write_text(
        '[facts]\nitems = ["file:docs/does-not-exist.md"]\n'
        '[[lenses.slice]]\nname = "sec"\nbrief = ".agents/custom/missing.md"\n'
    )
    proc = run_cli(["check"], project)
    assert proc.returncode == 1
    out = proc.stdout + proc.stderr
    assert "does-not-exist.md" in out
    assert "missing.md" in out


def test_check_rejects_unknown_policy_key(project):
    cfg = project / ".groundwork/config"
    cfg.mkdir(parents=True)
    (cfg / "policy.toml").write_text('[artifacts]\narchitecture = "docs/other.md"\n')
    proc = run_cli(["check"], project)
    assert proc.returncode == 1
    assert "unknown key" in (proc.stdout + proc.stderr)


def test_hosts_registry_stays_in_sync_with_support_doc():
    # The host registry (src/config/hosts.json) is the machine-readable source for the
    # Support matrix in docs/host-support.md. Guard the drift both ways: every registry
    # key must appear in the doc, every status must be a known tier, and a link'd host's
    # links must be well-formed.
    registry = json.loads((REPO_ROOT / "src/config/hosts.json").read_text())["hosts"]
    doc = (REPO_ROOT / "docs/host-support.md").read_text()
    valid_status = {"verified", "wired-untested", "manual"}
    keys = [h["key"] for h in registry]
    assert keys == list(dict.fromkeys(keys)), "duplicate host keys in registry"
    for h in registry:
        assert h["status"] in valid_status, f"{h['key']}: unknown status {h['status']!r}"
        assert h["label"] in doc, f"{h['label']} is in the registry but not in docs/host-support.md"
        if h.get("native"):
            assert not h.get("links"), f"{h['key']}: native host must not carry links"
        for link in h.get("links", []):
            assert {"link", "target", "type"} <= set(link), f"{h['key']}: malformed link {link}"
    # The support doc enumerates the supported keys inline — keep that list honest.
    for key in keys:
        assert key in doc, f"host key {key} is not documented in docs/host-support.md"


def test_init_does_not_clobber_existing_real_claude_md(project):
    (project / "CLAUDE.md").write_text("# hand-written\n")
    proc = run_cli(["init", "--agent", "claude-code"], project)
    assert proc.returncode == 0, proc.stderr
    claude_md = project / "CLAUDE.md"
    assert not claude_md.is_symlink()
    assert claude_md.read_text() == "# hand-written\n"
    assert "already exists" in proc.stdout + proc.stderr


def test_reinit_preserves_state_and_user_config(project):
    run_cli(["init"], project)
    state_path = project / ".groundwork/config/state.json"
    state = json.loads(state_path.read_text())
    state["completed"] = ["product-brief"]
    state_path.write_text(json.dumps(state))
    config_path = project / ".groundwork/config/config.toml"
    config_path.write_text(config_path.read_text() + '\n[skills]\n"x" = "y.md"\n')

    proc = run_cli(["init"], project)
    assert proc.returncode == 0, proc.stderr
    assert json.loads(state_path.read_text())["completed"] == ["product-brief"]
    assert '"x" = "y.md"' in config_path.read_text()


def test_update_is_noop_when_current(project):
    run_cli(["init"], project)
    proc = run_cli(["update"], project)
    assert proc.returncode == 0
    assert "Already up to date" in proc.stdout


def test_update_refreshes_and_reports_drift(project):
    run_cli(["init"], project)
    mutated = project / ".agents/skills/groundwork-check/SKILL.md"
    mutated.write_text(mutated.read_text() + "\ndrift\n")
    removed = project / ".groundwork/skills/groundwork-update"
    shutil.rmtree(removed)

    proc = run_cli(["update"], project)
    assert proc.returncode == 0, proc.stderr
    assert "~ groundwork-check/SKILL.md" in proc.stdout
    assert "+ groundwork-update/instructions.md" in proc.stdout
    assert mutated.read_text() == (REPO_ROOT / "src/skills/groundwork-check/SKILL.md").read_text()
    assert (removed / "instructions.md").exists()


def test_update_surfaces_migration_notes_on_version_jump(project):
    run_cli(["init"], project)
    state_path = project / ".groundwork/config/state.json"
    state = json.loads(state_path.read_text())
    state["groundwork"]["version"] = "0.1.0"
    state_path.write_text(json.dumps(state))
    # Force a file diff so update takes the full path
    (project / ".agents/skills/groundwork-check/SKILL.md").write_text("stale")

    proc = run_cli(["update"], project)
    assert proc.returncode == 0, proc.stderr
    assert f"Updating 0.1.0 → {PKG_VERSION}" in proc.stdout
    assert "What changed:" in proc.stdout
    # The summary is scannable: section-header headlines become one-line bullets...
    assert "one update lane, reconciled to the current canonical" in proc.stdout
    # ...and the verbatim entry bodies are NOT dumped (this sentence opens a body, not a header).
    assert "A live update run surfaced a gap" not in proc.stdout
    # Migration bullets list real `- [migration]` entries (with the prefix stripped),
    # never prose that merely mentions the token in backticks.
    assert "⚠ Migration required:" in proc.stdout
    assert "(gw-bet-prose-redesign)" in proc.stdout
    assert "[migration]" not in proc.stdout  # the bracket token itself never leaks into output
    assert "Changelog `` lines now reference registry ids" not in proc.stdout
    # Re-stamped after update
    assert json.loads(state_path.read_text())["groundwork"]["version"] == PKG_VERSION


def test_update_full_flag_dumps_complete_entries(project):
    run_cli(["init"], project)
    state_path = project / ".groundwork/config/state.json"
    state = json.loads(state_path.read_text())
    state["groundwork"]["version"] = "0.1.0"
    state_path.write_text(json.dumps(state))
    (project / ".agents/skills/groundwork-check/SKILL.md").write_text("stale")

    summary = run_cli(["update"], project).stdout
    # Reset and re-run with --full to compare verbosity.
    state = json.loads(state_path.read_text())
    state["groundwork"]["version"] = "0.1.0"
    state_path.write_text(json.dumps(state))
    (project / ".agents/skills/groundwork-check/SKILL.md").write_text("stale")
    full = run_cli(["update", "--full"], project).stdout

    assert full.count("\n") > summary.count("\n")
    assert "for the complete entries" in summary
    assert "for the complete entries" not in full


def test_update_without_install_fails_cleanly(project):
    proc = run_cli(["update"], project)
    assert proc.returncode == 1
    assert "No GroundWork installation" in proc.stdout + proc.stderr


def test_self_copy_guard(tmp_path):
    # Build a minimal package skeleton so the guard can be tested without
    # touching the real repo's .agents/.
    pkg = tmp_path / "pkg"
    (pkg / "bin").mkdir(parents=True)
    shutil.copy(CLI, pkg / "bin/groundwork.js")
    shutil.copy(REPO_ROOT / "package.json", pkg / "package.json")
    shutil.copy(REPO_ROOT / "CHANGELOG.md", pkg / "CHANGELOG.md")
    shutil.copytree(REPO_ROOT / "src" / "skills", pkg / "src" / "skills")
    shutil.copytree(REPO_ROOT / "src" / "hidden-skills", pkg / "src" / "hidden-skills")
    shutil.copytree(REPO_ROOT / "src" / "config", pkg / "src" / "config")
    # A sentinel meta-skill dir that a broken guard would delete
    sentinel = pkg / ".agents" / "skills" / "meta-skill" / "SKILL.md"
    sentinel.parent.mkdir(parents=True)
    sentinel.write_text("precious")

    proc = subprocess.run(
        ["node", str(pkg / "bin/groundwork.js"), "init"],
        cwd=pkg, capture_output=True, text=True,
    )
    assert proc.returncode == 0
    assert "source repository" in proc.stdout + proc.stderr
    assert sentinel.read_text() == "precious", "guard failed: init clobbered the source repo's .agents/"


def test_check_exit_codes(project):
    run_cli(["init"], project)
    docs = project / "docs"
    (docs / "api").mkdir(parents=True, exist_ok=True)
    (project / "services/widget").mkdir(parents=True)
    (project / "services/widget/main.go").write_text("package main")
    (docs / "api/widget.md").write_text(
        "---\ntitle: widget API\ngeneration_mode: extracted\n"
        "source_of_truth: services/widget/\nlast_reviewed: 2020-01-01\n---\n# widget\n"
    )
    git(["add", "-A"], project)
    git(["commit", "-qm", "seed"], project)

    stale = run_cli(["check"], project)
    assert stale.returncode == 1
    assert "stale" in stale.stdout.lower()
    assert "groundwork-update" in stale.stdout

    doc = docs / "api/widget.md"
    doc.write_text(doc.read_text().replace("2020-01-01", "2099-01-01"))
    current = run_cli(["check"], project)
    assert current.returncode == 0


def test_check_warns_on_version_mismatch(project):
    run_cli(["init"], project)
    (project / "docs").mkdir(exist_ok=True)
    state_path = project / ".groundwork/config/state.json"
    state = json.loads(state_path.read_text())
    state["groundwork"]["version"] = "0.1.0"
    state_path.write_text(json.dumps(state))

    proc = run_cli(["check"], project)
    out = proc.stdout + proc.stderr
    assert "0.1.0" in out
    assert "update" in out
