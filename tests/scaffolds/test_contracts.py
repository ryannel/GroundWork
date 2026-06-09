"""Scaffold contract-gap tests.

Deterministic checks (no LLM) for generator contracts that the existing layers
do not cover:

  1. **Bundle freshness** — the committed `./dev` bundle that ships into generated
     projects must equal a fresh build of its source. A stale bundle silently ships
     stale behavior, because the generator copies the committed file verbatim.

  2. **Adopt-merge idempotency** — running the brownfield docker-compose adopt/merge
     a second time on an already-adopted compose must be a no-op. Re-running the
     infra-adopt phase is a realistic operation (interrupted run, re-onboarding);
     it must not duplicate services or re-home churn.

The nx-bootstrap and first-pass compose-merge contracts are covered by
test_brownfield_adopt.py; this file adds the freshness and idempotency edges.
Each test skips cleanly when its toolchain (esbuild / node `yaml`) is absent.
"""

import json
import subprocess
import tempfile
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent.parent.resolve()
CLI_SRC = REPO_ROOT / "src" / "generators" / "workspace-dev-cli" / "cli-src"
COMMITTED_BUNDLE = CLI_SRC / "dist" / "dev-bundle.js"


def test_dev_bundle_is_fresh(tmp_path):
    """The committed dev-bundle.js equals a fresh esbuild of cli-src/src.

    Catches the 'edited cli-src but forgot to rebuild' regression the contributor
    guide warns about — the committed bundle is what ships.
    """
    if not (REPO_ROOT / "node_modules" / "esbuild").exists():
        pytest.skip("esbuild not installed; run npm install")
    if not COMMITTED_BUNDLE.exists():
        pytest.fail(f"committed bundle missing: {COMMITTED_BUNDLE} — run npm run build:dev-cli")

    fresh = tmp_path / "dev-bundle.fresh.js"
    proc = subprocess.run(
        ["node", str(CLI_SRC / "build.mjs")],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        env={**__import__("os").environ, "DEV_CLI_OUTFILE": str(fresh)},
    )
    assert proc.returncode == 0, f"fresh build failed: {proc.stderr[-400:]}"
    assert fresh.exists(), "fresh build produced no output"

    committed_bytes = COMMITTED_BUNDLE.read_bytes()
    fresh_bytes = fresh.read_bytes()
    assert committed_bytes == fresh_bytes, (
        "Committed dev-bundle.js is STALE — it differs from a fresh build of cli-src/.\n"
        "Rebuild and commit it: `npm run build:dev-cli`."
    )


def test_workflow_index_is_fresh():
    """The committed workflow-index.md equals a fresh derivation from the
    orchestrator routing tables (decision D7: help is generated, not
    hand-maintained). Catches the 'edited a routing table but forgot to
    regenerate the index' drift.
    """
    proc = subprocess.run(
        ["node", str(REPO_ROOT / "scripts" / "generate_workflow_index.js"), "--check"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, (
        f"workflow-index.md is stale or unparseable: {proc.stderr or proc.stdout}\n"
        "Regenerate and commit it: `npm run gen:workflow-index`."
    )


# The adopt/merge algorithm the infra-adopt skill prescribes, expressed once and
# driven through the real `yaml` library the generators use (not reimplemented in
# Python), so the test exercises the actual mechanism.
_MERGE_FN = """
  const yaml = require(YAML_PATH);
  function adopt(baseYaml, targetYaml) {
    const base = yaml.parseDocument(baseYaml);
    const target = yaml.parseDocument(targetYaml);
    const baseServices = base.get('services');
    const targetServices = target.get('services');
    for (const item of targetServices.items) {
      const name = item.key.value;
      if (!baseServices.has(name)) {
        const def = item.value;
        def.set('networks', ['groundwork-net']);
        baseServices.set(name, def);
      }
    }
    return base.toString();
  }
"""


def test_compose_merge_is_idempotent(tmp_path):
    """Re-running adopt on an already-adopted compose changes nothing."""
    yaml_pkg = REPO_ROOT / "node_modules" / "yaml"
    if not yaml_pkg.exists():
        pytest.skip("node `yaml` package not installed; run npm install")

    user_compose = (
        "version: '3.8'\n"
        "services:\n"
        "  api:\n"
        "    build: ./services/api\n"
        "    ports:\n"
        '      - "4000:4000"\n'
    )
    groundwork_base = (
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

    script = f"""
      const YAML_PATH = {json.dumps(str(yaml_pkg))};
      {_MERGE_FN}
      const base = {json.dumps(groundwork_base)};
      const user = {json.dumps(user_compose)};
      const once = adopt(base, user);          // first adoption
      const twice = adopt(base, once);         // re-run on the adopted compose
      const names = y => Object.keys(yaml.parse(y).services).sort();
      const net = y => yaml.parse(y).services.api.networks;
      console.log(JSON.stringify({{
        onceNames: names(once), twiceNames: names(twice),
        onceApiNet: net(once), twiceApiNet: net(twice),
        stable: once === twice,
      }}));
    """
    proc = subprocess.run(["node", "-e", script], cwd=REPO_ROOT, capture_output=True, text=True)
    assert proc.returncode == 0, f"merge script failed: {proc.stderr}"
    out = json.loads(proc.stdout.strip().splitlines()[-1])

    # No duplicate services introduced on the second run.
    assert out["onceNames"] == ["api", "db", "jaeger"], out["onceNames"]
    assert out["twiceNames"] == out["onceNames"], (
        f"second adopt changed the service set: {out['twiceNames']} != {out['onceNames']}"
    )
    # The adopted user service stays on groundwork-net — not re-homed or duplicated.
    assert out["onceApiNet"] == ["groundwork-net"], out["onceApiNet"]
    assert out["twiceApiNet"] == ["groundwork-net"], out["twiceApiNet"]
    # Byte-for-byte stable: re-running adopt is a true no-op.
    assert out["stable"], "adopt is not idempotent — second run produced different YAML"
