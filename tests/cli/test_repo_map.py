"""Contract tests for `groundwork repo-map` (bin/groundwork.js + lib/repo-map).

These run the real CLI against scratch git repos and assert on the emitted
.groundwork/cache/repo-map.json: that tree-sitter import edges resolve, that
PageRank surfaces the shared hub, that the parse cache makes reruns incremental,
and that staleness detection is honest. The generator is the deterministic
producer Serena cannot be — these tests pin that contract.

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


@pytest.fixture()
def project(tmp_path):
    git(["init", "-q"], tmp_path)
    return tmp_path


def commit_all(project):
    git(["add", "-A"], project)
    git(["commit", "-qm", "seed"], project)


def test_ranks_shared_hub_highest(project):
    # logger is imported by three modules; it must top the centrality ranking.
    write(project, "src/logger.ts", "export function log(){}\n")
    write(project, "src/a.ts", 'import { log } from "./logger";\nexport function a(){ log() }\n')
    write(project, "src/b.ts", 'import { log } from "./logger";\nexport function b(){ log() }\n')
    write(project, "src/c.ts", 'import { log } from "./logger";\nimport { a } from "./a";\n')
    commit_all(project)

    proc = run_cli(["repo-map"], project)
    assert proc.returncode == 0, proc.stderr
    m = read_map(project)

    assert m["centrality"][0]["file"] == "src/logger.ts"
    assert m["centrality"][0]["in"] == 3
    # An edge from each importer to the hub resolved.
    edge_pairs = {(e["from"], e["to"]) for e in m["edges"]}
    assert ("src/a.ts", "src/logger.ts") in edge_pairs
    assert m["generated_at_commit"]  # provenance stamped


def test_covers_languages_and_contracts(project):
    write(project, "go.mod", "module example.com/app\ngo 1.21\n")
    write(project, "util/util.go", "package util\nfunc Help(){}\n")
    write(project, "core/core.go", 'package core\nimport "example.com/app/util"\nfunc Run(){ util.Help() }\n')
    write(project, "svc/svc.py", "from util.helpers import thing\n")
    write(project, "util/helpers.py", "def thing(): pass\n")
    write(project, "web/index.ts", 'import { x } from "./api";\n')
    write(project, "web/api.ts", "export const x = 1;\n")
    write(project, "api/openapi.yaml", "openapi: 3.0.0\n")
    write(project, "rpc/service.proto", "syntax = \"proto3\";\n")
    commit_all(project)

    proc = run_cli(["repo-map"], project)
    assert proc.returncode == 0, proc.stderr
    m = read_map(project)

    assert set(m["stats"]["languages"]) >= {"go", "python", "typescript"}
    # internal Go + Python + TS edges all resolved
    edge_pairs = {(e["from"], e["to"]) for e in m["edges"]}
    assert ("core/core.go", "util/util.go") in edge_pairs
    assert ("svc/svc.py", "util/helpers.py") in edge_pairs
    assert ("web/index.ts", "web/api.ts") in edge_pairs
    assert "api/openapi.yaml" in m["contracts"]
    assert "rpc/service.proto" in m["contracts"]


def test_incremental_reparses_only_changed(project):
    write(project, "src/logger.ts", "export function log(){}\n")
    write(project, "src/a.ts", 'import { log } from "./logger";\n')
    commit_all(project)

    first = run_cli(["repo-map"], project)
    assert "2 parsed, 0 reused" in first.stdout

    # No change → everything served from cache.
    second = run_cli(["repo-map"], project)
    assert "0 parsed, 2 reused" in second.stdout

    # Touch one file → only it reparses.
    (project / "src/a.ts").write_text('import { log } from "./logger";\n// edit\n')
    third = run_cli(["repo-map"], project)
    assert "1 parsed, 1 reused" in third.stdout


def test_staleness_detects_source_change(project):
    write(project, "src/a.ts", "export const a = 1;\n")
    commit_all(project)
    run_cli(["repo-map"], project)

    fresh = run_cli(["repo-map", "--check"], project)
    assert fresh.returncode == 0
    assert "current with HEAD" in fresh.stdout

    (project / "src/a.ts").write_text("export const a = 2;\n")
    stale = run_cli(["repo-map", "--check"], project)
    assert stale.returncode == 0  # advisory — never fails the build
    assert "stale" in stale.stdout + stale.stderr  # warnings go to stderr
    assert "1 source file" in stale.stdout + stale.stderr


def test_check_reports_absent_map(project):
    write(project, "src/a.ts", "export const a = 1;\n")
    commit_all(project)

    proc = run_cli(["repo-map", "--check"], project)
    assert proc.returncode == 0
    assert "No code map yet" in proc.stdout + proc.stderr  # warning → stderr


def test_java_resolves_edges_at_graph_fidelity(project):
    # A Java import is a fully-qualified type name; the resolver maps it to the
    # file that mirrors the package path, so an internal edge resolves and the
    # imported type tops centrality.
    write(project, "src/com/example/util/Helper.java",
          "package com.example.util;\npublic class Helper { public void help(){} }\n")
    write(project, "src/com/example/core/Service.java",
          "package com.example.core;\nimport com.example.util.Helper;\npublic class Service {}\n")
    commit_all(project)

    proc = run_cli(["repo-map"], project)
    assert proc.returncode == 0, proc.stderr
    m = read_map(project)

    edge_pairs = {(e["from"], e["to"]) for e in m["edges"]}
    assert ("src/com/example/core/Service.java", "src/com/example/util/Helper.java") in edge_pairs
    assert m["coverage"]["java"]["fidelity"] == "graph"
    assert m["symbols"]["src/com/example/util/Helper.java"] == ["Helper"]


def test_symbols_tier_indexes_without_edges(project):
    # Symbols-tier languages (no resolver) still yield a symbol index, external
    # deps, and module shape — at honest 'symbols' fidelity, no fabricated edges.
    write(project, "rs/main.rs", "use crate::util::helper;\npub fn run() {}\nstruct S;\n")
    write(project, "cs/Service.cs", "namespace App;\nusing App.Util;\nclass Service {}\n")
    commit_all(project)

    proc = run_cli(["repo-map"], project)
    assert proc.returncode == 0, proc.stderr
    m = read_map(project)

    assert m["coverage"]["rust"]["fidelity"] == "symbols"
    assert m["coverage"]["csharp"]["fidelity"] == "symbols"
    assert "run" in m["symbols"]["rs/main.rs"] and "S" in m["symbols"]["rs/main.rs"]
    assert m["symbols"]["cs/Service.cs"] == ["Service"]
    # external imports captured even without internal-edge resolution
    assert "crate::util::helper" in m["external_dependencies"]


def test_dart_resolves_edges_at_graph_fidelity(project):
    # Dart maps at graph fidelity: a self-package import (package:<self>/x) and a
    # schemeless relative import both resolve to internal files, while other
    # packages and dart: SDK libraries fall to external.
    write(project, "pubspec.yaml", "name: myapp\nenvironment:\n  sdk: \">=3.0.0\"\n")
    write(project, "lib/widgets/button.dart", "class Button {}\n")
    write(project, "lib/models/user.dart", "class User {}\n")
    write(project, "lib/home.dart",
          "import 'package:myapp/widgets/button.dart';\n"
          "import 'models/user.dart';\n"
          "import 'package:flutter/material.dart';\n"
          "import 'dart:async';\n"
          "class HomePage { void build(){} }\n")
    commit_all(project)

    proc = run_cli(["repo-map"], project)
    assert proc.returncode == 0, proc.stderr
    m = read_map(project)

    edge_pairs = {(e["from"], e["to"]) for e in m["edges"]}
    assert ("lib/home.dart", "lib/widgets/button.dart") in edge_pairs   # package:<self>
    assert ("lib/home.dart", "lib/models/user.dart") in edge_pairs      # schemeless relative
    assert m["coverage"]["dart"]["fidelity"] == "graph"
    assert "HomePage" in m["symbols"]["lib/home.dart"]
    # other-package and SDK imports are external, not internal edges
    assert "package:flutter/material.dart" in m["external_dependencies"]
    assert "dart:async" in m["external_dependencies"]


def test_unmapped_language_degrades_gracefully(project):
    # A known code language with no built-in support (Elixir) must never crash the
    # run: its files are reported as unmapped, with a reason, alongside a real map.
    write(project, "lib/app.ex", "defmodule App do\nend\n")
    write(project, "web/a.ts", "export const a = 1;\n")
    commit_all(project)

    proc = run_cli(["repo-map"], project)
    assert proc.returncode == 0, proc.stderr  # graceful — does not fail the build
    m = read_map(project)

    elixir = [u for u in m["unmapped"] if u["language"] == "Elixir"]
    assert elixir and elixir[0]["files"] == 1 and elixir[0]["reason"]
    assert "not mapped" in proc.stdout + proc.stderr
    assert "code-intelligence.md" in proc.stdout + proc.stderr


SWIFT_MANIFEST = """// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "AppPackages",
    products: [
        .library(name: "AppKitchen", targets: ["Core", "Recipes"]),
    ],
    dependencies: [
        .package(url: "https://github.com/groue/GRDB.swift", from: "7.0.0"),
    ],
    targets: [
        .target(name: "Core"),
        .target(name: "Recipes", dependencies: ["Core",
            .product(name: "GRDB", package: "grdb.swift")]),
        .executableTarget(name: "Tool", dependencies: [.target(name: "Core")]),
        .testTarget(name: "RecipesTests", dependencies: ["Recipes"]),
    ]
)
"""


def test_swiftpm_module_graph_from_manifest(project):
    # The module graph is read from the SwiftPM manifest — real module edges for
    # a symbols-fidelity language whose imports yield none, external products
    # kept as nodes, and the hub target topping module centrality.
    write(project, "Packages/Package.swift", SWIFT_MANIFEST)
    write(project, "Packages/Sources/Core/Core.swift", "public struct Core {}\n")
    commit_all(project)

    proc = run_cli(["repo-map"], project)
    assert proc.returncode == 0, proc.stderr
    mg = read_map(project)["module_graph"]

    kinds = {m["name"]: m["kind"] for m in mg["modules"]}
    assert kinds["Core"] == "target"
    assert kinds["Tool"] == "executable"
    assert kinds["RecipesTests"] == "test"
    assert kinds["AppKitchen"] == "product"
    assert kinds["GRDB"] == "external"

    edge_pairs = {(e["from"], e["to"]) for e in mg["edges"]}
    assert ("Recipes", "Core") in edge_pairs          # bare-string dependency
    assert ("Tool", "Core") in edge_pairs             # .target(name:) dependency
    assert ("Recipes", "GRDB") in edge_pairs          # .product(name:, package:)
    assert ("RecipesTests", "Recipes") in edge_pairs
    assert ("AppKitchen", "Core") in edge_pairs       # product → realizing target

    assert mg["module_centrality"][0]["module"] == "Core"
    assert mg["sources"] == [
        {"ecosystem": "swiftpm", "manifests": ["Packages/Package.swift"], "method": "parsed"}
    ]
    assert "module graph: " in proc.stdout


def test_cargo_workspace_module_graph(project):
    # Cargo path dependencies are the internal crate topology; registry crates
    # are external noise the module graph deliberately omits.
    write(project, "Cargo.toml", '[workspace]\nmembers = ["crates/*"]\n')
    write(project, "crates/util/Cargo.toml", '[package]\nname = "util"\nversion = "0.1.0"\n')
    write(project, "crates/app/Cargo.toml",
          '[package]\nname = "app"\nversion = "0.1.0"\n\n'
          '[dependencies]\nutil = { path = "../util" }\nserde = "1"\n\n'
          '[dependencies.tokio]\nversion = "1"\n')
    commit_all(project)

    proc = run_cli(["repo-map"], project)
    assert proc.returncode == 0, proc.stderr
    mg = read_map(project)["module_graph"]

    assert {m["name"] for m in mg["modules"]} == {"util", "app"}
    assert all(m["kind"] == "crate" for m in mg["modules"])
    assert mg["edges"] == [{"from": "app", "to": "util"}]


def test_npm_workspace_module_graph(project):
    # Activates only on a declared workspace; member-to-member dependencies are
    # the edges, the root package is not a module.
    write(project, "package.json", '{ "name": "root", "workspaces": ["packages/*"] }')
    write(project, "packages/lib/package.json", '{ "name": "@app/lib" }')
    write(project, "packages/web/package.json",
          '{ "name": "@app/web", "dependencies": { "@app/lib": "workspace:*", "react": "^19" } }')
    commit_all(project)

    proc = run_cli(["repo-map"], project)
    assert proc.returncode == 0, proc.stderr
    mg = read_map(project)["module_graph"]

    assert {m["name"] for m in mg["modules"]} == {"@app/lib", "@app/web"}
    assert mg["edges"] == [{"from": "@app/web", "to": "@app/lib"}]


def test_dotnet_project_references(project):
    write(project, "src/Lib/Lib.csproj", "<Project><ItemGroup></ItemGroup></Project>")
    write(project, "src/Api/Api.csproj",
          '<Project><ItemGroup>'
          '<ProjectReference Include="..\\Lib\\Lib.csproj" />'
          "</ItemGroup></Project>")
    commit_all(project)

    proc = run_cli(["repo-map"], project)
    assert proc.returncode == 0, proc.stderr
    mg = read_map(project)["module_graph"]

    assert {m["name"] for m in mg["modules"]} == {"Lib", "Api"}
    assert mg["edges"] == [{"from": "Api", "to": "Lib"}]


def test_module_graph_absent_with_reason(project):
    # No recognized manifest → empty module graph with an honest reason, never a
    # fabricated one and never a crash.
    write(project, "src/a.ts", "export const a = 1;\n")
    commit_all(project)

    proc = run_cli(["repo-map"], project)
    assert proc.returncode == 0, proc.stderr
    mg = read_map(project)["module_graph"]

    assert mg["modules"] == [] and mg["edges"] == []
    assert "no recognized build manifests" in mg["reason"]


def test_mermaid_renders_module_graph(project):
    write(project, "Packages/Package.swift", SWIFT_MANIFEST)
    commit_all(project)

    proc = run_cli(["repo-map", "--mermaid"], project)
    assert proc.returncode == 0, proc.stderr

    mmd = (project / ".groundwork/cache/module-graph.mmd").read_text()
    assert mmd.startswith("graph LR")
    assert "swiftpm_Recipes[Recipes]" in mmd
    assert "swiftpm_GRDB{{GRDB}}" in mmd                       # external → hexagon
    assert "swiftpm_Recipes --> swiftpm_Core" in mmd
    assert "swiftpm_Recipes --> swiftpm_GRDB" in mmd


def test_manifest_provider_extension_seam(project):
    # A project maps a build system repo-map does not cover by committing a
    # provider definition — same seam shape as repo-map.languages.js.
    write(project, ".groundwork/config/repo-map.manifests.js", """
module.exports = [{
  id: 'make',
  detect(files) { return files.filter((f) => f.endsWith('module.mk')); },
  parse({ manifestPaths }) {
    return {
      modules: manifestPaths.map((p) => ({
        name: p.split('/')[0], kind: 'component', ecosystem: 'make', path: p, language: 'c',
      })),
      edges: [{ from: 'app', to: 'base' }],
    };
  },
}];
""")
    write(project, "app/module.mk", "obj := app.o\n")
    write(project, "base/module.mk", "obj := base.o\n")
    commit_all(project)

    proc = run_cli(["repo-map"], project)
    assert proc.returncode == 0, proc.stderr
    mg = read_map(project)["module_graph"]

    assert {m["name"] for m in mg["modules"]} == {"app", "base"}
    assert mg["edges"] == [{"from": "app", "to": "base"}]
    assert mg["sources"][0]["ecosystem"] == "make"


def test_project_extension_seam_adds_language_and_edges(project):
    # A repo enables a language repo-map does not cover by committing a project
    # language definition — including a resolver that produces real edges.
    write(project, ".groundwork/config/repo-map.languages.js", """
const path = require('path');
module.exports = [{
  id: 'widget',
  extensions: ['.widget'],
  grammar: 'tree-sitter-javascript.wasm',
  importQuery: '(import_statement source: (string) @imp)',
  symbolQuery: '(function_declaration name: (identifier) @sym)',
  resolve(spec, fromFile, files) {
    if (!spec.startsWith('.')) return null;
    const t = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec)) + '.widget';
    return files.has(t) ? [t] : null;
  },
}];
""")
    write(project, "app/base.widget", "export function base(){}\n")
    write(project, "app/child.widget", 'import { base } from "./base";\nfunction child(){}\n')
    commit_all(project)

    proc = run_cli(["repo-map"], project)
    assert proc.returncode == 0, proc.stderr
    m = read_map(project)

    edge_pairs = {(e["from"], e["to"]) for e in m["edges"]}
    assert ("app/child.widget", "app/base.widget") in edge_pairs
    assert m["coverage"]["widget"]["fidelity"] == "graph"
    # GroundWork's own machinery is never mapped as app source.
    assert ".groundwork/config/repo-map.languages.js" not in m["symbols"]
    assert "project languages: widget" in proc.stdout


def test_enumerates_submodules_without_indexing_contents(project, tmp_path):
    # A real gitlink: the child repo's files must never leak into the map, and
    # the enumeration keeps that absence visible instead of silent.
    child = tmp_path / "child"
    child.mkdir()
    git(["init", "-q"], child)
    (child / "inner.ts").write_text("export const inner = 1\n")
    git(["add", "-A"], child)
    git(["commit", "-qm", "seed"], child)
    git(["-c", "protocol.file.allow=always", "submodule", "add", str(child), "vendor/child"], project)

    write(project, "src/app.ts", "export const app = 1\n")
    commit_all(project)

    proc = run_cli(["repo-map"], project)
    assert proc.returncode == 0, proc.stderr
    m = read_map(project)

    (entry,) = m["submodules"]
    assert entry["path"] == "vendor/child"
    assert entry["url"]
    assert entry["initialized"] is True
    assert not any(f["file"].startswith("vendor/child/") for f in m["centrality"])
    assert not any(k.startswith("vendor/child/") for k in m["symbols"])


def test_submodules_empty_without_gitmodules(project):
    write(project, "src/app.ts", "export const app = 1\n")
    commit_all(project)
    proc = run_cli(["repo-map"], project)
    assert proc.returncode == 0, proc.stderr
    assert read_map(project)["submodules"] == []
