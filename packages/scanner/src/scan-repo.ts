import fs from "node:fs";
import path from "node:path";
import {
  validateCiteAnchors,
  validateRepositoryPin,
  validateStructureEvidence,
  validateSurfaceInventory,
  type CiteAnchorsFile,
  type DenominatorSource,
  type RepositoryPin,
  type StructureEvidence,
  type SurfaceInventory,
  type SurfaceRecord,
} from "@groundwork/schema";
import { buildCiteAnchors } from "./cite-anchors.js";
import { crossCheckRoutes } from "./cross-check.js";
import { extractDeclarativeSurfaces } from "./declarative.js";
import { readGitPin, resolveSubmodule } from "./git-pin.js";
import { extractHeuristicSurfaces } from "./heuristics.js";
import { detectPackageRoots, walkFiles } from "./package-roots.js";
import { buildStructureEvidence } from "./structure.js";

export const SCANNER_VERSION = "0.2.0-orientation";

export interface ScanResult {
  readonly repository: RepositoryPin;
  readonly inventory: SurfaceInventory;
  readonly anchors: CiteAnchorsFile;
  readonly structure: StructureEvidence;
}

export interface ScanOptions {
  readonly outDir?: string;
}

function sortSurfaces(surfaces: SurfaceRecord[]): SurfaceRecord[] {
  return [...surfaces].sort((a, b) =>
    a.package_root.localeCompare(b.package_root) ||
    a.kind.localeCompare(b.kind) ||
    a.surface_id.localeCompare(b.surface_id) ||
    a.denominator.localeCompare(b.denominator) ||
    a.file.localeCompare(b.file),
  );
}

export function scanRepository(repoDir: string, options: ScanOptions = {}): ScanResult {
  const absRepo = path.resolve(repoDir);
  if (!fs.existsSync(absRepo)) {
    throw new Error(`Repository path does not exist: ${absRepo}`);
  }

  const scanned_at = new Date().toISOString();
  const git = readGitPin(absRepo);
  const allFiles = walkFiles(absRepo);
  const package_roots = detectPackageRoots(absRepo, allFiles, git.repo_name, git.submodules);

  const repository: RepositoryPin = {
    schema_version: 1,
    repo_name: git.repo_name,
    ...(git.remote ? { remote: git.remote } : {}),
    commit: git.commit,
    branch: git.branch,
    dirty: git.dirty,
    scanned_at,
    scanner_version: SCANNER_VERSION,
    ...(git.submodules.length > 0 ? { submodules: git.submodules } : {}),
    package_roots,
  };

  const declarative = extractDeclarativeSurfaces(absRepo, allFiles, package_roots);
  const heuristics = extractHeuristicSurfaces(absRepo, allFiles, package_roots);
  const attributed = [...declarative, ...heuristics].map((s) => {
    if (s.repo_name) return s;
    const sm = resolveSubmodule(s.file, git.submodules);
    return { ...s, repo_name: sm ? sm.name : git.repo_name };
  });
  const surfaces = sortSurfaces(attributed);
  const cross_checks = crossCheckRoutes(surfaces);

  const by_kind: Record<string, number> = {};
  const by_denominator: Record<DenominatorSource, number> = {
    declarative_spec: 0,
    source_heuristic: 0,
    infra_manifest: 0,
  };
  const by_package: Record<string, number> = {};

  for (const s of surfaces) {
    by_kind[s.kind] = (by_kind[s.kind] ?? 0) + 1;
    by_denominator[s.denominator] = (by_denominator[s.denominator] ?? 0) + 1;
    by_package[s.package_root] = (by_package[s.package_root] ?? 0) + 1;
  }

  const inventory: SurfaceInventory = {
    schema_version: 1,
    repo_name: git.repo_name,
    commit: git.commit,
    scanned_at,
    summary: {
      total_surfaces: surfaces.length,
      by_kind,
      by_denominator,
      by_package,
    },
    surfaces,
    cross_checks,
  };

  const anchors = buildCiteAnchors(absRepo, git.repo_name, git.commit, surfaces);
  const structure = buildStructureEvidence(absRepo, allFiles, repository);

  // Self-validate every emitted artifact against @groundwork/schema
  const repoCheck = validateRepositoryPin(repository);
  if (!repoCheck.valid) {
    throw new Error(`Invalid repository.json output:\n${repoCheck.errors.join("\n")}`);
  }
  const invCheck = validateSurfaceInventory(inventory);
  if (!invCheck.valid) {
    throw new Error(`Invalid inventory.json output:\n${invCheck.errors.join("\n")}`);
  }
  const ancCheck = validateCiteAnchors(anchors);
  if (!ancCheck.valid) {
    throw new Error(`Invalid cite-anchors.json output:\n${ancCheck.errors.join("\n")}`);
  }
  const structCheck = validateStructureEvidence(structure);
  if (!structCheck.valid) {
    throw new Error(`Invalid structure.json output:\n${structCheck.errors.join("\n")}`);
  }

  if (options.outDir) {
    const out = path.resolve(options.outDir);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "repository.json"), JSON.stringify(repository, null, 2) + "\n");
    fs.writeFileSync(path.join(out, "inventory.json"), JSON.stringify(inventory, null, 2) + "\n");
    fs.writeFileSync(path.join(out, "cite-anchors.json"), JSON.stringify(anchors, null, 2) + "\n");
    fs.writeFileSync(path.join(out, "structure.json"), JSON.stringify(structure, null, 2) + "\n");
  }

  return { repository, inventory, anchors, structure };
}
