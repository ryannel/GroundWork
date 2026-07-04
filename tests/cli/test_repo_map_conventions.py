"""Contract tests for `groundwork repo-map --conventions` (lib/repo-map/conventions.js).

The conventions digest is the deterministic half of a project-context document:
runtimes pinned by manifests, commands declared in config, the map's own hub
ranking, and counted layout/naming patterns. These tests pin the contract that
matters — everything in the digest is read, never inferred, and two runs over
the same tree are byte-identical (no timestamps, no absolute paths).

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import json
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"


def run_cli(args, cwd):
    return subprocess.run(
        ["node", str(CLI), *args], cwd=cwd, capture_output=True, text=True
    )


def git(args, cwd):
    return subprocess.run(
        ["git", "-c", "user.email=t@t", "-c", "user.name=t", *args],
        cwd=cwd, capture_output=True, text=True, check=True,
    )


def write(root: Path, rel: str, content: str):
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)


def read_map(project: Path):
    return json.loads((project / ".groundwork/cache/repo-map.json").read_text())


def conventions_md(project: Path) -> Path:
    return project / ".groundwork/cache/conventions.md"


@pytest.fixture()
def project(tmp_path):
    git(["init", "-q"], tmp_path)
    return tmp_path


def commit_all(project):
    git(["add", "-A"], project)
    git(["commit", "-qm", "seed"], project)


def seed_node_repo(project):
    write(project, "package.json", json.dumps({
        "name": "demo",
        "type": "module",
        "engines": {"node": ">=18"},
        "scripts": {
            "test": "vitest run",
            "build": "tsc",
            "lint": "eslint .",
            "publish:docs": "not-a-convention-key",
        },
    }))
    write(project, "src/logger.ts", "export function log(){}\n")
    write(project, "src/a.ts", 'import { log } from "./logger";\n')
    write(project, "src/b.ts", 'import { log } from "./logger";\n')
    write(project, "src/a.test.ts", "export {};\n")
    write(project, "src/b.test.ts", "export {};\n")
    write(project, "Makefile", "VAR:=1\nbuild:\n\techo b\ntest: build\n\techo t\n")
    commit_all(project)


def test_node_repo_digest_fields(project):
    seed_node_repo(project)

    proc = run_cli(["repo-map", "--conventions"], project)
    assert proc.returncode == 0, proc.stderr
    conv = read_map(project)["conventions"]

    # runtimes: read from the root manifest, verbatim
    assert conv["runtimes"]["node"] == {"engines": {"node": ">=18"}, "type": "module"}
    # commands: only the conventional script keys; Makefile targets, not variables
    assert conv["commands"]["npm_scripts"] == {
        "test": "vitest run", "build": "tsc", "lint": "eslint .",
    }
    assert conv["commands"]["make"] == ["build", "test"]
    # hubs: reuse the map's centrality ranking — the import hub leads
    assert conv["hubs"]["files"][0] == "src/logger.ts"
    assert len(conv["hubs"]["files"]) <= 5
    # layout: observed dirs + counted test-naming pattern
    assert conv["layout"]["source_dirs"] == ["src"]
    assert conv["layout"]["test_patterns"]["typescript"] == "*.test.ts"

    md = conventions_md(project).read_text()
    assert "node >=18" in md and "type: module" in md
    assert "npm run test" in md and "vitest run" in md
    assert "src/logger.ts" in md
    assert "Wrote .groundwork/cache/conventions.md" in proc.stdout


def test_python_repo_digest_fields(project):
    write(project, "pyproject.toml",
          '[project]\nname = "demo"\nrequires-python = ">=3.11"\n\n'
          '[tool.pytest.ini_options]\ntestpaths = ["tests"]\n')
    write(project, "src/util.py", "def helper(): pass\n")
    write(project, "src/app.py", "from util import helper\n")
    write(project, "tests/test_app.py", "def test_app(): pass\n")
    write(project, "tests/test_util.py", "def test_util(): pass\n")
    commit_all(project)

    proc = run_cli(["repo-map", "--conventions"], project)
    assert proc.returncode == 0, proc.stderr
    conv = read_map(project)["conventions"]

    assert conv["runtimes"] == {"python": {"requires": ">=3.11"}}
    assert conv["commands"]["pytest"] is True
    assert conv["layout"]["source_dirs"] == ["src", "tests"]
    assert conv["layout"]["test_patterns"]["python"] == "test_*.py"

    md = conventions_md(project).read_text()
    assert "requires >=3.11" in md
    assert "test_*.py" in md


def test_two_runs_are_byte_identical(project):
    seed_node_repo(project)

    first = run_cli(["repo-map", "--conventions"], project)
    assert first.returncode == 0, first.stderr
    md1 = conventions_md(project).read_bytes()
    conv1 = json.dumps(read_map(project)["conventions"], sort_keys=False)

    second = run_cli(["repo-map", "--conventions"], project)
    assert second.returncode == 0, second.stderr
    md2 = conventions_md(project).read_bytes()
    conv2 = json.dumps(read_map(project)["conventions"], sort_keys=False)

    # Determinism is the contract: identical tree → identical bytes.
    assert md1 == md2
    assert conv1 == conv2


def test_no_manifests_yields_empty_but_valid_digest(project):
    # No package.json / pyproject / go.mod / Cargo.toml / Makefile / ./dev:
    # every section is present and empty rather than missing or crashing.
    write(project, "code.ts", "export const a = 1;\n")
    commit_all(project)

    proc = run_cli(["repo-map", "--conventions"], project)
    assert proc.returncode == 0, proc.stderr
    conv = read_map(project)["conventions"]

    assert conv["runtimes"] == {}
    assert conv["commands"] == {}
    assert conv["hubs"] == {"files": ["code.ts"], "modules": []}
    assert conv["layout"] == {"source_dirs": [], "test_patterns": {}}
    assert conventions_md(project).exists()


def test_unmappable_repo_still_writes_conventions(project):
    # No mappable source at all (repo-map's early "nothing to map" path):
    # the manifests still state conventions, so the digest is still delivered.
    write(project, "package.json", '{ "name": "d", "scripts": { "test": "make t" } }')
    write(project, "README.md", "# demo\n")
    commit_all(project)

    proc = run_cli(["repo-map", "--conventions"], project)
    assert proc.returncode == 0, proc.stderr
    md = conventions_md(project).read_text()
    assert "npm run test" in md
    # no map was built — the digest rides alone
    assert not (project / ".groundwork/cache/repo-map.json").exists()


def test_plain_run_stays_free_of_conventions(project):
    # Composability: without the flag, nothing about the build changes.
    seed_node_repo(project)

    proc = run_cli(["repo-map"], project)
    assert proc.returncode == 0, proc.stderr
    assert "conventions" not in read_map(project)
    assert not conventions_md(project).exists()
