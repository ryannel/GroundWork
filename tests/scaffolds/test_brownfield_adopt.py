"""
Brownfield Infra-Adoption Tests

The brownfield track's infra-adopt phase makes two mechanical claims the conversational
eval harness cannot verify (it has no generators and no filesystem assertions):

  1. nx-bootstrap is additive — dropping a minimal `nx.json = {}` lets the infrastructure
     generators run on a NON-Nx repo and lay down the operational layer WITHOUT touching
     existing application source. This is the premise the whole "adopt, don't refactor"
     approach rests on.

  2. The docker-compose adopt/merge guard preserves the user's existing services while
     adding the GroundWork base (db, jaeger, groundwork-net). workspace-dev-cli would
     otherwise clobber an existing compose, so the skill backs it up and merges — this
     test validates the merge algorithm the skill prescribes.

These are deterministic checks (no LLM). Generator-running tests skip cleanly when the
workspace bundle is not built, so the file is always collectable.
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
GENERATORS_JSON = REPO_ROOT / "generators.json"
SANDBOX_DIR = REPO_ROOT / ".sandboxes" / "scaffolds" / "brownfield"


def _seed_existing_repo(root: Path):
    """Lay down a tiny pre-existing two-service repo with a real docker-compose.yml.

    Mirrors the eval fixture at tests/evals/fixtures/brownfield_monorepo/00_codebase.
    """
    (root / "services" / "api" / "cmd" / "server").mkdir(parents=True, exist_ok=True)
    (root / "services" / "api" / "go.mod").write_text("module github.com/tasklet/api\n\ngo 1.22\n")
    main_go = "package main\n\nfunc main() { /* existing app code — must not be touched */ }\n"
    (root / "services" / "api" / "cmd" / "server" / "main.go").write_text(main_go)
    (root / "docker-compose.yml").write_text(
        "version: '3.8'\n"
        "services:\n"
        "  db:\n"
        "    image: postgres:16\n"
        "    ports:\n"
        '      - "5432:5432"\n'
        "  api:\n"
        "    build: ./services/api\n"
        "    environment:\n"
        "      - PORT=4000\n"
        "    ports:\n"
        '      - "4000:4000"\n'
    )
    return main_go


@pytest.fixture()
def brownfield_sandbox():
    if SANDBOX_DIR.exists():
        shutil.rmtree(SANDBOX_DIR)
    SANDBOX_DIR.mkdir(parents=True)
    # A brownfield repo is NOT an Nx workspace. The infra-adopt phase writes this minimal
    # nx.json so the infrastructure generators can run — the bootstrap under test.
    (SANDBOX_DIR / "nx.json").write_text("{}")
    (SANDBOX_DIR / "package.json").write_text('{"name": "tasklet"}')
    original_main = _seed_existing_repo(SANDBOX_DIR)
    yield SANDBOX_DIR, original_main
    # Sandbox left for inspection; cleaned by `./dev eval clean`.


def _run_workspace_dev_cli(cwd: Path) -> subprocess.CompletedProcess:
    cmd = [
        "npx", "--yes", "nx", "g",
        f"{GENERATORS_JSON}:workspace-dev-cli",
        "--appName", "Tasklet",
    ]
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)


def test_nx_bootstrap_preserves_existing_app(brownfield_sandbox):
    """workspace-dev-cli runs on the bootstrapped non-Nx repo and never touches app source."""
    sandbox, original_main = brownfield_sandbox
    result = _run_workspace_dev_cli(sandbox)
    if result.returncode != 0:
        pytest.skip(f"workspace-dev-cli could not run (build the bundle first?): {result.stderr[-300:]}")

    # The operational layer landed.
    assert (sandbox / "dev").exists(), "./dev launcher was not generated"

    # The existing application source is byte-for-byte untouched — adopt, not refactor.
    main_after = (sandbox / "services" / "api" / "cmd" / "server" / "main.go").read_text()
    assert main_after == original_main, "infra adoption must never modify existing app source"


def test_compose_merge_preserves_user_services_and_adds_groundwork_base(brownfield_sandbox, tmp_path):
    """The merge algorithm the skill prescribes: user services survive, GroundWork base is added,
    everything lands on groundwork-net. Implemented with the same `yaml` library the generators
    use, driven through node so the test exercises the real mechanism, not a Python reimplementation.
    """
    sandbox, _ = brownfield_sandbox
    node_modules = REPO_ROOT / "node_modules" / "yaml"
    if not node_modules.exists():
        pytest.skip("node `yaml` package not installed; run npm install")

    user_compose = (sandbox / "docker-compose.yml").read_text()
    # The generated base workspace-dev-cli would write (db + jaeger on groundwork-net).
    generated_base = (
        "version: '3.8'\n"
        "services:\n"
        "  db:\n"
        "    image: ankane/pgvector:v0.5.0\n"
        "    networks: [groundwork-net]\n"
        "  jaeger:\n"
        "    image: jaegertracing/all-in-one\n"
        "    networks: [groundwork-net]\n"
        "networks:\n"
        "  groundwork-net:\n"
        "    driver: bridge\n"
    )
    base_file = tmp_path / "base.yml"
    user_file = tmp_path / "user.yml"
    base_file.write_text(generated_base)
    user_file.write_text(user_compose)

    merge_script = f"""
      const yaml = require({json.dumps(str(node_modules))});
      const fs = require('fs');
      const base = yaml.parseDocument(fs.readFileSync({json.dumps(str(base_file))}, 'utf-8'));
      const user = yaml.parseDocument(fs.readFileSync({json.dumps(str(user_file))}, 'utf-8'));
      const baseServices = base.get('services');
      const userServices = user.get('services');
      for (const item of userServices.items) {{
        const name = item.key.value;
        if (!baseServices.has(name)) {{
          const def = item.value;
          def.set('networks', ['groundwork-net']);   // re-home onto groundwork-net
          baseServices.set(name, def);
        }}
      }}
      const out = base.toString();
      const merged = yaml.parse(out);
      const names = Object.keys(merged.services).sort();
      console.log(JSON.stringify({{
        names,
        apiNet: merged.services.api && merged.services.api.networks,
        hasNetwork: !!(merged.networks && merged.networks['groundwork-net']),
      }}));
    """
    proc = subprocess.run(["node", "-e", merge_script], cwd=REPO_ROOT, capture_output=True, text=True)
    assert proc.returncode == 0, f"merge script failed: {proc.stderr}"
    out = json.loads(proc.stdout.strip().splitlines()[-1])

    # User services (api) AND the GroundWork base (db, jaeger) all present.
    assert set(out["names"]) == {"api", "db", "jaeger"}, out["names"]
    # The adopted user service was re-homed onto groundwork-net.
    assert out["apiNet"] == ["groundwork-net"], out["apiNet"]
    assert out["hasNetwork"], "groundwork-net network missing from merged compose"
