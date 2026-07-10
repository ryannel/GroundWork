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

# Both annotations may carry a surface-group scope (see G1): `[migration: dev-cli]`,
# `[no-migration: generator:docs-site]`.
MIGRATION_LINE = re.compile(r"\[migration(?::[^\]]*)?\]", re.IGNORECASE)
NO_MIGRATION_LINE = re.compile(r"\[no-migration(?::[^\]]*)?\]", re.IGNORECASE)
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
        if not MIGRATION_LINE.search(line) or NO_MIGRATION_LINE.search(line):
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
# entry or a [no-migration] annotation on a changelog line scoped to the surface
# group the change touches. Skills are exempt — clean-copy carries them.
SHIPPED_SURFACE = [
    "src/docs/",
    "src/config/",
    "src/AGENTS.md",
    "src/generators/*/files/**",
    "src/generators/workspace-dev-cli/cli-src/src/",
]

# Annotation scoping. A bare [no-migration] anywhere in [Unreleased] used to
# satisfy the gate for every shipped-surface change at once — change B passed on
# the back of change A's annotation (the Wave 3 docs-site change rode Wave 1/2
# entries before its own line existed). Each changed file now maps to a surface
# group, and only an annotation naming that group covers it:
#     `[no-migration: dev-cli]`
#     `- [migration: docs] … (gw-id)`
#     `[no-migration: generator:docs-site, dev-cli]`   (one line, several groups)
# Bare annotations stay valid prose on lines for changes outside the shipped
# surface; they cover no group.

DEV_CLI_SRC = "src/generators/workspace-dev-cli/cli-src/src/"
GENERATOR_FILES = re.compile(r"src/generators/([^/]+)/files/")


def surface_group(path):
    """Map a changed shipped-surface path to the scope token that must cover it."""
    if path.startswith("src/docs/"):
        return "docs"
    if path.startswith("src/config/"):
        return "config"
    if path == "src/AGENTS.md":
        return "agents-md"
    if path.startswith(DEV_CLI_SRC):
        return "dev-cli"
    m = GENERATOR_FILES.match(path)
    if m:
        return f"generator:{m.group(1)}"
    # A SHIPPED_SURFACE pathspec with no group mapping is gate drift — fail closed.
    return f"unmapped:{path}"


ANNOTATION_SCOPE = re.compile(r"\[(?:no-)?migration:\s*([^\]]+)\]", re.IGNORECASE)


def annotated_groups(changelog_text):
    scopes = set()
    for m in ANNOTATION_SCOPE.finditer(changelog_text):
        scopes.update(token.strip() for token in m.group(1).split(","))
    return scopes


def unannotated_groups(changed_paths, unreleased_text):
    """The surface groups changed_paths touch that unreleased_text never scopes."""
    covered = annotated_groups(unreleased_text)
    groups = {surface_group(p) for p in changed_paths}
    return sorted(g for g in groups if g.startswith("unmapped:") or g not in covered)


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
    unreleased = CHANGELOG.split(f"## [{tag_version}]")[0]
    missing = unannotated_groups(changed, unreleased)
    examples = {g: [p for p in changed if surface_group(p) == g][:2] for g in missing}
    assert not missing, (
        f"The shipped surface changed since {tag} but these surface groups have no "
        f"scoped changelog annotation in [Unreleased]: {examples}. Each changed group "
        "needs its own line — `[no-migration: <group>]`, or `[migration: <group>] … "
        "(gw-id)` with a registry entry; one line may scope several groups. A bare "
        f"[no-migration] covers nothing. Scopes found: "
        f"{sorted(annotated_groups(unreleased)) or 'none'}. Old installs will be left "
        "behind — see the contributor guide: Shipping a Change That Touches Installed "
        "Projects."
    )


# The scoping fixtures: prove an annotation for change A cannot green-light an
# unannotated change B, against synthetic diffs and Unreleased sections.

def test_annotation_for_one_group_does_not_cover_another():
    changed = [
        "src/generators/docs-site/files/scripts/sync-live-bets.js",
        "src/generators/workspace-dev-cli/cli-src/src/commands/bet.ts",
    ]
    unreleased = (
        "## [Unreleased]\n\n### Added\n"
        "- Docs site: the live window. `[no-migration: generator:docs-site]`\n"
    )
    assert unannotated_groups(changed, unreleased) == ["dev-cli"]


def test_bare_annotation_covers_no_group():
    changed = ["src/generators/docs-site/files/scripts/sync-live-bets.js"]
    unreleased = (
        "## [Unreleased]\n\n### Changed\n"
        "- Dev-time harness cleanup. [no-migration]\n"
    )
    assert unannotated_groups(changed, unreleased) == ["generator:docs-site"]


def test_scoped_annotations_cover_their_groups():
    changed = [
        "src/docs/principles/foundations.md",
        "src/config/config.toml",
        "src/AGENTS.md",
    ]
    # One line may carry several groups; [migration: …] lines count too.
    unreleased = (
        "## [Unreleased]\n\n### Changed\n"
        "- Reseeded docs and config. `[no-migration: docs, config]`\n"
    )
    assert unannotated_groups(changed, unreleased) == ["agents-md"]
    unreleased += "- [migration: agents-md] AGENTS.md shape bump (gw-agents-md-bump)\n"
    assert unannotated_groups(changed, unreleased) == []


def test_generator_file_groups_are_per_generator():
    assert surface_group("src/generators/docs-site/files/package.json") == "generator:docs-site"
    assert surface_group("src/generators/go-service/files/main.go.template") == "generator:go-service"
    assert surface_group("src/generators/workspace-dev-cli/files/dev") == "generator:workspace-dev-cli"
    assert surface_group("src/generators/workspace-dev-cli/cli-src/src/commands/bet.ts") == "dev-cli"


def test_unmapped_shipped_surface_path_fails_closed():
    # If SHIPPED_SURFACE grows a pathspec without a surface_group mapping, the
    # gate must fail — even against an annotation that names the fallback token.
    changed = ["src/seeds/new-surface.md"]
    unreleased = "## [Unreleased]\n- x. `[no-migration: unmapped:src/seeds/new-surface.md]`\n"
    assert unannotated_groups(changed, unreleased) == ["unmapped:src/seeds/new-surface.md"]


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


# ── gw-live-first-bets-meta round trip ──────────────────────────────────────
# Proved against the committed 0.16-docsite-pre-live-meta fixture (the shape it
# migrates from — a registered docs-site service plus a docs/bets/meta.json
# whose `pages` predates `_live`): detect → pending, run → `_live` inserted
# FIRST with the rest of the ordering untouched, detect → done, and a second
# run is byte-idempotent. Then the three skip paths on mutations of the same
# copy: a hand-tuned meta already naming `_live` anywhere is done (never
# reordered), an absent meta is n/a (the sync script owns creation), and a
# project without a docs-site service is n/a.

def test_live_first_bets_meta_round_trip(tmp_path):
    import shutil
    fixture = REPO_ROOT / "tests" / "fixtures" / "installs" / "0.16-docsite-pre-live-meta"
    project = tmp_path / "proj"
    shutil.copytree(fixture, project, symlinks=True)
    script = """
const path = require('path');
const fs = require('fs');
const mod = require(path.join(%r, 'gw-live-first-bets-meta.js'));
const target = %r, pkg = %r;
const metaPath = path.join(target, 'docs', 'bets', 'meta.json');
const ctx = { targetDir: target, packageRoot: pkg };

// pending → run inserts _live FIRST, keeps the rest of the ordering
if (mod.detect(ctx) !== 'pending') throw new Error('expected pending on the fixture shape');
mod.run(ctx);
const pages = JSON.parse(fs.readFileSync(metaPath, 'utf8')).pages;
if (JSON.stringify(pages) !== JSON.stringify(['_live', '...', '_archive'])) {
  throw new Error('expected _live inserted first, got ' + JSON.stringify(pages));
}
if (mod.detect(ctx) !== 'done') throw new Error('expected done after run');

// second run is byte-idempotent
const before = fs.readFileSync(metaPath, 'utf8');
mod.run(ctx);
if (fs.readFileSync(metaPath, 'utf8') !== before) throw new Error('second run rewrote meta.json');

// hand-tuned meta already naming _live (even not first) is done — never reordered
const handTuned = JSON.stringify({ pages: ['intro', '_live', '...', '_archive'] }, null, 2) + '\\n';
fs.writeFileSync(metaPath, handTuned);
if (mod.detect(ctx) !== 'done') throw new Error('hand-tuned meta naming _live must be done');
mod.run(ctx);
if (fs.readFileSync(metaPath, 'utf8') !== handTuned) throw new Error('hand-tuned meta was rewritten');

// absent meta is n/a — creation belongs to the sync script, never this migration
fs.rmSync(metaPath);
if (mod.detect(ctx) !== 'n/a') throw new Error('absent meta must be n/a');
mod.run(ctx); // must not create it
if (fs.existsSync(metaPath)) throw new Error('run created an absent meta.json');

// no docs-site service registered → n/a even with a pre-_live meta present
fs.writeFileSync(metaPath, JSON.stringify({ pages: ['...', '_archive'] }, null, 2) + '\\n');
fs.rmSync(path.join(target, '.dev'), { recursive: true, force: true });
if (mod.detect(ctx) !== 'n/a') throw new Error('no docs-site service must be n/a');
console.log('ok');
""" % (str(MIGRATIONS), str(project), str(REPO_ROOT))
    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    assert proc.returncode == 0, proc.stderr
    assert proc.stdout.strip() == "ok"
