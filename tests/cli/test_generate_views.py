"""Contract tests for `groundwork generate-views` (bin/groundwork.js).

The generated architecture views are sibling files under docs/architecture/generated/,
never blocks inside the hand-kept docs/architecture/index.md. These tests run the real
CLI against scratch git repos and pin what the sibling files promise: the frontmatter
keys consumers read, the discard warning that keeps hand edits out, and honest
degradation — an unmapped language is named, an absent compose file is admitted.

Run via `./dev test cli` (or pytest tests/cli/ from the scaffolds venv).
"""

import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI = REPO_ROOT / "bin" / "groundwork.js"

GENERATED = "docs/architecture/generated"


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


def view(project: Path, name: str) -> str:
    return (project / GENERATED / name).read_text()


@pytest.fixture()
def project(tmp_path):
    git(["init", "-q"], tmp_path)
    # Real installs gitignore the cache; without this the map the verb writes would
    # land in every commit and read as a code change.
    (tmp_path / ".gitignore").write_text(".groundwork/\n")
    return tmp_path


def commit_all(project):
    git(["add", "-A"], project)
    git(["commit", "-qm", "seed"], project)


def head(project) -> str:
    return git(["rev-parse", "HEAD"], project).stdout.strip()


COMPOSE = """services:
  api:
    build: ./services/api
    ports:
      - "8080:8080"
  redis:
    image: redis:7
"""


def seed_compose_repo(project):
    write(project, "services/api/main.go", "package main\nfunc main(){}\n")
    write(project, "web/index.ts", "export const a = 1;\n")
    write(project, "api/openapi.yaml", "openapi: 3.0.0\n")
    write(project, "docker-compose.yml", COMPOSE)
    commit_all(project)


def test_writes_three_views_with_provenance_frontmatter(project):
    seed_compose_repo(project)

    proc = run_cli(["generate-views"], project)
    assert proc.returncode == 0, proc.stderr

    for name in ("services.md", "modules.md", "contracts.md"):
        body = view(project, name)
        assert body.startswith("---\n")
        assert "generated: true" in body
        assert f"generated_at_commit: {head(project)}" in body
        assert "command: npx groundwork-method generate-views" in body
        # The discard warning is the first line of prose, before any heading.
        first_prose = body.split("---\n", 2)[2].strip().splitlines()[0]
        assert "hand edits are discarded" in first_prose


def test_services_view_reads_compose_and_the_code_map(project):
    seed_compose_repo(project)
    assert run_cli(["generate-views"], project).returncode == 0

    services = view(project, "services.md")
    assert "docker-compose.yml" in services
    # name | language (from the code map partition) | port | root path
    assert "| api | go | 8080 | ./services/api |" in services
    # A compose-only service owns no source — it is listed, not silently dropped.
    assert "| redis | — | — | — |" in services


def test_services_view_degrades_without_compose(project):
    write(project, "services/api/main.go", "package main\nfunc main(){}\n")
    write(project, "web/index.ts", "export const a = 1;\n")
    commit_all(project)
    assert run_cli(["generate-views"], project).returncode == 0

    services = view(project, "services.md")
    assert "no docker-compose file exists in this repo" in services
    assert "top-level partitions alone" in services
    assert "| services | go | 1 |" in services
    assert "| web | typescript | 1 |" in services


def test_unmapped_language_is_named_not_omitted(project):
    write(project, "web/index.ts", "export const a = 1;\n")
    write(project, "lib/app.ex", "defmodule App do\nend\n")
    commit_all(project)
    assert run_cli(["generate-views"], project).returncode == 0

    modules = view(project, "modules.md")
    assert "Languages the code map does not cover" in modules
    assert "Elixir" in modules


def test_modules_view_renders_the_module_graph(project):
    write(project, "package.json", '{ "name": "root", "workspaces": ["packages/*"] }')
    write(project, "packages/lib/package.json", '{ "name": "@app/lib" }')
    write(project, "packages/web/package.json",
          '{ "name": "@app/web", "dependencies": { "@app/lib": "workspace:*" } }')
    write(project, "packages/lib/index.ts", "export const a = 1;\n")
    commit_all(project)
    assert run_cli(["generate-views"], project).returncode == 0

    modules = view(project, "modules.md")
    assert "```mermaid" in modules
    assert "graph LR" in modules
    assert "@app/web" in modules and "@app/lib" in modules


def test_modules_view_states_why_no_module_graph(project):
    write(project, "web/index.ts", "export const a = 1;\n")
    commit_all(project)
    assert run_cli(["generate-views"], project).returncode == 0

    modules = view(project, "modules.md")
    assert "No module graph" in modules
    assert "no recognized build manifests" in modules


def test_contracts_view_indexes_code_and_captured_records(project):
    seed_compose_repo(project)
    write(project, "docs/architecture/api/api/openapi.yaml", "openapi: 3.0.0\n")
    commit_all(project)
    assert run_cli(["generate-views"], project).returncode == 0

    contracts = view(project, "contracts.md")
    assert "`api/openapi.yaml`" in contracts
    assert "`docs/architecture/api/api/openapi.yaml`" in contracts


def test_contracts_view_admits_an_empty_captured_record(project):
    write(project, "web/index.ts", "export const a = 1;\n")
    commit_all(project)
    assert run_cli(["generate-views"], project).returncode == 0

    contracts = view(project, "contracts.md")
    assert "No contract or spec files detected in the code map." in contracts
    assert "Nothing captured yet" in contracts


def test_regeneration_restamps_and_discards_hand_edits(project):
    seed_compose_repo(project)
    assert run_cli(["generate-views"], project).returncode == 0
    first = head(project)

    (project / GENERATED / "services.md").write_text("hand-written nonsense\n")
    write(project, "services/api/extra.go", "package main\n")
    commit_all(project)

    assert run_cli(["generate-views"], project).returncode == 0
    services = view(project, "services.md")
    assert "hand-written nonsense" not in services
    assert f"generated_at_commit: {head(project)}" in services
    assert first not in services


def test_check_reports_generated_view_staleness(project):
    seed_compose_repo(project)
    assert run_cli(["generate-views"], project).returncode == 0

    fresh = run_cli(["check"], project)
    assert "Generated architecture views" in fresh.stdout + fresh.stderr
    assert "are current with HEAD" in fresh.stdout

    # Code moved after the stamp → stale (advisory, printed as a warning).
    write(project, "services/api/extra.go", "package main\n")
    commit_all(project)
    stale = run_cli(["check"], project)
    assert "Generated architecture views are stale" in stale.stdout + stale.stderr


def test_check_ignores_docs_only_commits(project):
    seed_compose_repo(project)
    assert run_cli(["generate-views"], project).returncode == 0

    write(project, "docs/architecture/index.md", "# Architecture\n")
    commit_all(project)
    proc = run_cli(["check"], project)
    assert "Generated architecture views are stale" not in proc.stdout + proc.stderr
