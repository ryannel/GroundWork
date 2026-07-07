"""Junk-file deploy filter regression tests.

The init/update deploy path must never copy OS/editor junk (.DS_Store, Thumbs.db,
desktop.ini, editor backups `foo~`) from the package source into a project, nor
record it in the install manifest. The real-world vector is an npm-linked dev
checkout — npm pack's excludes never run there — so these tests run the CLI from
a hermetic copy of the package with junk planted throughout its src/ trees.

The gw-scrub-junk-files migration is exercised the test_upgrade.py way: seed a
frozen pre-manifest fixture (whose state.json predates the migration, so it
detects pending) and plant junk into the seeded copy at test time — the junk
names themselves are gitignored, so they cannot be committed into the fixture.
"""

import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
FIXTURES = REPO_ROOT / "tests" / "fixtures" / "installs"

JUNK_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini"}


def is_junk(name: str) -> bool:
    return name in JUNK_NAMES or name.endswith("~")


def run_cli(cli: Path, args, cwd):
    return subprocess.run(
        ["node", str(cli), *args], cwd=cwd, capture_output=True, text=True
    )


def deployed_junk(project: Path):
    return [
        str(f.relative_to(project))
        for f in project.rglob("*")
        if f.is_file() and is_junk(f.name) and ".git" not in f.parts
    ]


def tree_hash(root: Path) -> str:
    h = hashlib.sha256()
    for f in sorted(root.rglob("*")):
        if f.is_symlink():
            h.update(str(f.relative_to(root)).encode() + os.readlink(f).encode())
        elif f.is_file():
            h.update(str(f.relative_to(root)).encode() + f.read_bytes())
    return h.hexdigest()


def manifest_files(project: Path) -> dict:
    return json.loads(
        (project / ".groundwork/config/manifest.json").read_text()
    )["files"]


@pytest.fixture()
def junk_package(tmp_path):
    """A hermetic copy of the package's deployable surface with junk planted in
    every source tree — what an npm-linked dev checkout looks like on macOS."""
    pkg = tmp_path / "pkg"
    (pkg / "src").mkdir(parents=True)
    shutil.copytree(REPO_ROOT / "bin", pkg / "bin")
    shutil.copytree(REPO_ROOT / "migrations", pkg / "migrations")
    for sub in ("skills", "hidden-skills", "docs", "config"):
        shutil.copytree(REPO_ROOT / "src" / sub, pkg / "src" / sub)
    for f in ("package.json", "generators.json"):
        shutil.copy2(REPO_ROOT / f, pkg / f)
    shutil.copy2(REPO_ROOT / "src" / "AGENTS.md", pkg / "src" / "AGENTS.md")

    a_hidden_skill = sorted(
        d for d in (pkg / "src/hidden-skills").iterdir() if d.is_dir()
    )[0]
    for junk in (
        pkg / "src/docs/.DS_Store",
        pkg / "src/docs/principles/.DS_Store",
        pkg / "src/docs/principles/Thumbs.db",
        pkg / "src/docs/desktop.ini",
        pkg / "src/docs/index.md~",
        pkg / "src/skills/.DS_Store",
        pkg / "src/skills/groundwork-orchestrator/.DS_Store",
        a_hidden_skill / ".DS_Store",
        a_hidden_skill / "instructions.md~",
    ):
        junk.write_bytes(b"junk")
    return pkg


@pytest.fixture()
def project_dir(tmp_path):
    project = tmp_path / "project"
    project.mkdir()
    subprocess.run(["git", "init", "-q"], cwd=project, check=True)
    return project


def test_init_deploys_and_manifests_no_junk(junk_package, project_dir):
    cli = junk_package / "bin/groundwork.js"
    proc = run_cli(cli, ["init"], project_dir)
    assert proc.returncode == 0, proc.stderr

    assert deployed_junk(project_dir) == []

    files = manifest_files(project_dir)
    junk_entries = [rel for rel in files if is_junk(Path(rel).name)]
    assert junk_entries == [], f"manifest recorded junk: {junk_entries}"

    # The filter must not have taken legit neighbors with it.
    assert (project_dir / "docs/principles/index.md").exists()
    assert (project_dir / ".agents/skills/groundwork-orchestrator/SKILL.md").exists()
    assert "AGENTS.md" in files
    assert any(rel.startswith(".groundwork/skills/") for rel in files)


def test_update_scrubs_junk_an_old_deploy_left_behind(junk_package, project_dir):
    """A project polluted by a pre-filter deploy self-heals on the next update:
    the pending scrub migration forces the full deploy path even at equal
    version, the reinstall sweeps the skill trees, and the migration cleans
    docs/ — while a user's own editor backup in docs/ is never touched."""
    cli = junk_package / "bin/groundwork.js"
    assert run_cli(cli, ["init"], project_dir).returncode == 0

    # What an older version deployed (or Finder created since).
    planted = [
        project_dir / "docs/.DS_Store",
        project_dir / "docs/principles/.DS_Store",
        project_dir / ".agents/skills/groundwork-check/.DS_Store",
        project_dir / ".groundwork/skills/Thumbs.db",
    ]
    for f in planted:
        f.write_bytes(b"junk")
    user_backup = project_dir / "docs/notes.md~"
    user_backup.write_text("the user's own editor backup — not ours to delete\n")

    # A fresh init records the whole registry as settled; un-record the scrub
    # migration to model an install that predates it.
    state_path = project_dir / ".groundwork/config/state.json"
    state = json.loads(state_path.read_text())
    state["groundwork"]["migrations"] = [
        m for m in state["groundwork"]["migrations"] if m != "gw-scrub-junk-files"
    ]
    state_path.write_text(json.dumps(state, indent=2))

    proc = run_cli(cli, ["update"], project_dir)
    assert proc.returncode == 0, proc.stderr

    leftover = deployed_junk(project_dir)
    assert leftover == ["docs/notes.md~"], f"junk survived the update: {leftover}"
    assert user_backup.read_text().startswith("the user's own"), (
        "update must never rewrite a user's backup file"
    )

    state = json.loads(state_path.read_text())
    assert "gw-scrub-junk-files" in state["groundwork"]["migrations"]
    junk_entries = [rel for rel in manifest_files(project_dir) if is_junk(Path(rel).name)]
    assert junk_entries == []
    # The report must not surface junk as changes — it was never legitimately there.
    assert ".DS_Store" not in proc.stdout


def test_scrub_migration_heals_a_pre_manifest_install(tmp_path):
    """test_upgrade.py-style proof against a frozen fixture: its state.json
    predates gw-scrub-junk-files, so the migration detects pending and runs."""
    cli = REPO_ROOT / "bin/groundwork.js"
    project = tmp_path / "pre-0.9"
    shutil.copytree(FIXTURES / "pre-0.9", project, symlinks=True)

    (project / "docs/.DS_Store").write_bytes(b"junk")
    (project / ".agents/skills/groundwork-check").mkdir(parents=True, exist_ok=True)
    (project / ".agents/skills/groundwork-check/desktop.ini").write_bytes(b"junk")
    user_backup = project / "docs/architecture.md~"
    user_backup.write_text("user backup\n")

    proc = run_cli(cli, ["update"], project)
    assert proc.returncode == 0, proc.stderr

    assert not (project / "docs/.DS_Store").exists()
    assert not (project / ".agents/skills/groundwork-check/desktop.ini").exists()
    assert user_backup.exists(), "the scrub must leave user editor backups alone"
    state = json.loads((project / ".groundwork/config/state.json").read_text())
    assert "gw-scrub-junk-files" in state["groundwork"]["migrations"]

    # Idempotency (test_upgrade.py convention): a second update changes nothing.
    before = tree_hash(project)
    proc = run_cli(cli, ["update"], project)
    assert proc.returncode == 0, proc.stderr
    assert tree_hash(project) == before, "second update changed the tree"
