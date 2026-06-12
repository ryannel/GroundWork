"""Install-manifest contract tests (upgrade-path plan A4).

The manifest at .groundwork/config/manifest.json is the provenance ledger every
update classifies against: what was deployed, from which package version, with
which content hash. These tests pin completeness, hash truthfulness, bootstrap
classification for pre-manifest installs, and survival of generator provenance.
"""

import hashlib
import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"
PKG_VERSION = json.loads((REPO_ROOT / "package.json").read_text())["version"]


def run_cli(args, cwd):
    return subprocess.run(
        ["node", str(CLI), *args], cwd=cwd, capture_output=True, text=True
    )


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_manifest(project: Path) -> dict:
    return json.loads((project / ".groundwork/config/manifest.json").read_text())


@pytest.fixture()
def project(tmp_path):
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    proc = run_cli(["init"], tmp_path)
    assert proc.returncode == 0, proc.stderr
    return tmp_path


def test_init_manifest_covers_everything_the_installer_wrote(project):
    manifest = load_manifest(project)
    assert manifest["manifest_version"] == 1
    files = manifest["files"]

    # Completeness: every skill file on disk has an entry.
    for tree in (".agents/skills", ".agents/groundwork/skills"):
        for f in (project / tree).rglob("*"):
            if f.is_file():
                rel = str(f.relative_to(project))
                assert rel in files, f"manifest missing tier-1 entry for {rel}"
                assert files[rel]["tier"] == 1

    # Tier-2 surface is present and classified deployed.
    for rel in ("AGENTS.md", "llms.txt", "docs/principles/index.md"):
        assert files[rel]["tier"] == 2
        assert files[rel]["provenance"] == "deployed"
        assert files[rel]["base"] == files[rel]["hash"]

    assert files[".groundwork/config/generators.json"]["tier"] == 1


def test_manifest_entries_verify_against_disk(project):
    files = load_manifest(project)["files"]
    for rel, entry in files.items():
        on_disk = project / rel
        assert on_disk.is_file(), f"manifest names {rel} but it is not on disk"
        assert sha256(on_disk) == entry["hash"], f"hash mismatch for {rel}"
        assert entry["version"] == PKG_VERSION


def test_init_over_existing_docs_records_adopted(tmp_path):
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    docs = tmp_path / "docs" / "principles"
    docs.mkdir(parents=True)
    (docs / "index.md").write_text("# My own principles\n")
    proc = run_cli(["init"], tmp_path)
    assert proc.returncode == 0, proc.stderr

    entry = load_manifest(tmp_path)["files"]["docs/principles/index.md"]
    assert entry["provenance"] == "adopted"
    assert entry["base"] is None
    # init never overwrites what exists
    assert (docs / "index.md").read_text() == "# My own principles\n"


def test_update_bootstraps_manifest_with_correct_classification(project):
    # Simulate a pre-manifest install: drop the manifest, edit one tier-2 file.
    (project / ".groundwork/config/manifest.json").unlink()
    edited = project / "docs/principles/index.md"
    edited.write_text(edited.read_text() + "\nuser edit\n")

    proc = run_cli(["update"], project)
    assert proc.returncode == 0, proc.stderr
    assert "Bootstrapped install manifest" in proc.stdout

    files = load_manifest(project)["files"]
    assert files["docs/principles/index.md"]["provenance"] == "adopted"
    assert files["docs/principles/index.md"]["base"] is None
    # An untouched tier-2 file classifies pristine.
    assert files["AGENTS.md"]["provenance"] == "deployed"


def test_generator_provenance_survives_update(project):
    manifest_path = project / ".groundwork/config/manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["generated"]["workspace-dev-cli"] = {
        "generator": "workspace-dev-cli",
        "version": "0.8.0",
        "options": {"appName": "Acme"},
        "files": {},
    }
    manifest_path.write_text(json.dumps(manifest, indent=2))
    # Force a real update pass (not the no-op early return).
    shutil.rmtree(project / ".agents/groundwork/skills/groundwork-update")

    proc = run_cli(["update"], project)
    assert proc.returncode == 0, proc.stderr
    generated = load_manifest(project)["generated"]
    assert generated["workspace-dev-cli"]["options"] == {"appName": "Acme"}
    # A stale recorded version queues a regenerate item in the brief.
    brief = json.loads((project / ".groundwork/cache/upgrade-brief.json").read_text())
    assert any(i["id"] == "regen:workspace-dev-cli" for i in brief["items"])
