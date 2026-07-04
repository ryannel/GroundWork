"""Registry-shape and contributor forcing-function gates (upgrade-path plan B1/B3/G1).

These run in the contracts lane (./dev test contracts) so the release workflow's
cheap gates catch a shipped-surface change that forgot its migration, and a
changelog/registry id reference that dangles on either side.
"""

import json
import re
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
MIGRATIONS = REPO_ROOT / "migrations"
CHANGELOG = (REPO_ROOT / "CHANGELOG.md").read_text()


def registry_entries():
    index = json.loads((MIGRATIONS / "index.json").read_text())
    return index["migrations"]


# ── B1: the registry validates ──────────────────────────────────────────────

def test_registry_entries_are_well_formed():
    entries = registry_entries()
    assert entries, "registry exists but is empty"
    ids = [e["id"] for e in entries]
    assert len(ids) == len(set(ids)), "duplicate migration ids"
    for e in entries:
        assert re.fullmatch(r"gw-[a-z0-9-]+", e["id"]), e["id"]
        assert re.fullmatch(r"\d+\.\d+\.\d+", e["version"]), e
        # The registry is cli-only: agent migrations were retired in favour of the
        # groundwork-update skill's reconcile pass (its Family Index).
        assert e["kind"] == "cli", e
        assert e["title"] and e["summary"], e


def test_every_entry_has_its_artifact():
    for e in registry_entries():
        assert e["kind"] == "cli", f"{e['id']} must be kind=cli (the registry is cli-only)"
        module = MIGRATIONS / f"{e['id']}.js"
        assert module.is_file(), f"{e['id']} is kind=cli but {module.name} is missing"
        src = module.read_text()
        assert "detect" in src and "run" in src


def test_cli_migrations_load_and_detect_cleanly_on_fresh_dirs(tmp_path):
    """detect() must be callable and read-only safe on an arbitrary directory."""
    script = """
const ids = %s;
for (const id of ids) {
  const mod = require(require('path').join(%r, id + '.js'));
  const verdict = mod.detect({ targetDir: %r, packageRoot: %r });
  if (!['pending', 'done', 'n/a'].includes(verdict)) {
    throw new Error(id + ' detect returned ' + verdict);
  }
}
console.log('ok');
""" % (
        json.dumps([e["id"] for e in registry_entries() if e["kind"] == "cli"]),
        str(MIGRATIONS),
        str(tmp_path),
        str(REPO_ROOT),
    )
    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    assert proc.returncode == 0, proc.stderr
    assert proc.stdout.strip() == "ok"


# ── gw-seed-capture-hook: the seed path the frozen fixtures don't reach ──────
# The pre-0.9 / 0.9 install fixtures carry no .claude dir, so they only exercise
# the migration's n/a branch. This proves the actual seed round-trip on a
# synthetic Claude Code install: detect → pending, run → seeds, detect → done,
# and a second run stays idempotent.

def test_seed_capture_hook_round_trip(tmp_path):
    (tmp_path / ".groundwork").mkdir()
    claude = tmp_path / ".claude"
    claude.mkdir()
    # A pre-existing unrelated hook must survive — the migration is additive.
    (claude / "settings.json").write_text(json.dumps({
        "hooks": {"PreToolUse": [
            {"matcher": "Bash", "hooks": [{"type": "command", "command": "echo other"}]}
        ]}
    }))
    script = """
const path = require('path');
const fs = require('fs');
const mod = require(path.join(%r, 'gw-seed-capture-hook.js'));
const ctx = { targetDir: %r, packageRoot: %r };
if (mod.detect(ctx) !== 'pending') throw new Error('expected pending before run');
mod.run(ctx);
mod.run(ctx); // idempotent — must not duplicate
if (mod.detect(ctx) !== 'done') throw new Error('expected done after run');
const hook = path.join(%r, '.groundwork', 'hooks', 'capture-reminder.js');
if (!fs.existsSync(hook)) throw new Error('hook script not seeded');
const s = JSON.parse(fs.readFileSync(path.join(%r, '.claude', 'settings.json'), 'utf8'));
const pre = s.hooks.PreToolUse;
const ours = pre.filter(g => g.hooks.some(h => (h.command || '').includes('capture-reminder')));
if (ours.length !== 1) throw new Error('expected exactly one capture-reminder entry, got ' + ours.length);
if (!pre.some(g => g.hooks.some(h => (h.command || '') === 'echo other'))) {
  throw new Error('pre-existing hook was clobbered');
}
console.log('ok');
""" % (str(MIGRATIONS), str(tmp_path), str(REPO_ROOT), str(tmp_path), str(tmp_path))
    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    assert proc.returncode == 0, proc.stderr
    assert proc.stdout.strip() == "ok"


def test_seed_capture_hook_na_without_claude_dir(tmp_path):
    """A native-only install (no .claude) is n/a — those agents can't run the hook."""
    (tmp_path / ".groundwork").mkdir()
    script = """
const mod = require(require('path').join(%r, 'gw-seed-capture-hook.js'));
const v = mod.detect({ targetDir: %r, packageRoot: %r });
if (v !== 'n/a') throw new Error('expected n/a, got ' + v);
console.log('ok');
""" % (str(MIGRATIONS), str(tmp_path), str(REPO_ROOT))
    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    assert proc.returncode == 0, proc.stderr
    assert proc.stdout.strip() == "ok"


# ── B3: changelog ↔ registry cross-check ────────────────────────────────────

MIGRATION_LINE = re.compile(r"\[migration\]", re.IGNORECASE)
MIGRATION_ID_SUFFIX = re.compile(r"\((gw-[a-z0-9-]+)\)\s*$")

# The registry ships at 0.10.0; [migration] lines in sections released before it
# are prose history and cannot be retro-required to name entries.
REGISTRY_SINCE = (0, 10, 0)


def _post_registry_changelog():
    """Changelog content from [Unreleased] and any section >= REGISTRY_SINCE."""
    keep, current = [], False
    for line in CHANGELOG.splitlines():
        m = re.match(r"^## \[(Unreleased|\d+\.\d+\.\d+)\]", line)
        if m:
            v = m.group(1)
            current = v == "Unreleased" or tuple(int(x) for x in v.split(".")) >= REGISTRY_SINCE
        if current:
            keep.append(line)
    return keep


def test_every_migration_line_names_a_registry_entry():
    ids = {e["id"] for e in registry_entries()}
    for line in _post_registry_changelog():
        if not MIGRATION_LINE.search(line) or "[no-migration]" in line:
            continue
        # Only the prose convention applies to entries, not the preamble explaining it.
        if not line.lstrip().startswith("-"):
            continue
        m = MIGRATION_ID_SUFFIX.search(line.strip())
        assert m, f"[migration] line lacks its registry id suffix: {line.strip()!r}"
        assert m.group(1) in ids, f"changelog references unknown migration {m.group(1)}"


def test_every_registry_entry_has_a_changelog_line():
    for e in registry_entries():
        assert f"({e['id']})" in CHANGELOG, f"{e['id']} has no [migration] changelog line"


# ── G1: the migration-coverage gate ─────────────────────────────────────────

# The shipped surface: changes here reach installed projects and need a migration
# entry at the unreleased version or a [no-migration] changelog annotation.
# Skills are exempt — clean-copy carries them.
SHIPPED_SURFACE = [
    "src/docs/",
    "src/config/",
    "src/AGENTS.md",
    "src/generators/*/files/**",
    "src/generators/workspace-dev-cli/cli-src/src/",
]


def last_release_tag():
    proc = subprocess.run(
        ["git", "describe", "--tags", "--abbrev=0", "--match", "v*"],
        cwd=REPO_ROOT, capture_output=True, text=True,
    )
    return proc.stdout.strip() if proc.returncode == 0 else None


def test_shipped_surface_changes_require_a_migration_or_annotation():
    tag = last_release_tag()
    if tag is None:
        pytest.skip(
            "no release tag yet — the gate activates with the first tagged release"
        )
    proc = subprocess.run(
        ["git", "diff", "--name-only", f"{tag}..HEAD", "--", *SHIPPED_SURFACE],
        cwd=REPO_ROOT, capture_output=True, text=True, check=True,
    )
    changed = [l for l in proc.stdout.splitlines() if l.strip()]
    if not changed:
        return

    tag_version = tag.lstrip("v")
    def newer(v):
        return [int(x) for x in v.split(".")] > [int(x) for x in tag_version.split(".")]

    has_new_migration = any(newer(e["version"]) for e in registry_entries())
    has_annotation = "[no-migration]" in CHANGELOG.split(f"## [{tag_version}]")[0]
    assert has_new_migration or has_annotation, (
        "The shipped surface changed since "
        f"{tag} ({len(changed)} file(s), e.g. {changed[:3]}) but migrations/index.json "
        "has no entry at an unreleased version and the changelog carries no "
        "[no-migration] annotation. Old installs will be left behind — see the "
        "contributor guide: Shipping a Change That Touches Installed Projects."
    )


# ── gw-seed-policy-toml round trip ──────────────────────────────────────────
# The frozen install fixtures predate the policy layer, so they exercise the
# migration's pending → run path on upgrade. This proves the seed round-trip
# directly: detect → pending, run → seeds policy.toml + gitignores the user file,
# detect → done, and a second run stays idempotent.

def test_seed_policy_toml_round_trip(tmp_path):
    (tmp_path / ".groundwork" / "config").mkdir(parents=True)
    script = """
const path = require('path');
const fs = require('fs');
const mod = require(path.join(%r, 'gw-seed-policy-toml.js'));
const target = %r, pkg = %r;
if (mod.detect({ targetDir: target }) !== 'pending') throw new Error('expected pending');
mod.run({ targetDir: target, packageRoot: pkg });
if (mod.detect({ targetDir: target }) !== 'done') throw new Error('expected done after run');
const policy = path.join(target, '.groundwork', 'config', 'policy.toml');
const ignore = path.join(target, '.groundwork', 'config', '.gitignore');
if (!fs.existsSync(policy)) throw new Error('policy.toml not seeded');
if (!fs.readFileSync(ignore, 'utf8').includes('policy.user.toml')) throw new Error('user file not gitignored');
mod.run({ targetDir: target, packageRoot: pkg });  // idempotent
if (fs.readFileSync(ignore, 'utf8').split('policy.user.toml').length !== 2) throw new Error('gitignore duplicated');
console.log('ok');
""" % (str(MIGRATIONS), str(tmp_path), str(REPO_ROOT))
    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    assert proc.returncode == 0, proc.stderr
    assert proc.stdout.strip() == "ok"
