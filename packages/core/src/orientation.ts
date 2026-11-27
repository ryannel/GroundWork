import fs from "node:fs";
import path from "node:path";
import type {
  OrientationFile,
  OrientationTier,
  PackageRoot,
  PackageStructure,
  StructureEntrypoint,
  StructureModuleEntry,
  SubmodulePin,
  SurfaceRecord,
} from "@groundwork/schema";
import type { SpaceIndex } from "./index-builder.js";
import type { LoadedComponent, LoadedSystem, RepoEvidence, SpaceModel, SpaceProblem } from "./model.js";

export interface ResolvedComponentEvidence {
  readonly home_repo?: string;
  readonly home_path?: string;
  readonly evidence_key?: string;
  readonly evidence?: RepoEvidence;
  readonly package_root?: PackageRoot;
  readonly package_structure?: PackageStructure;
  readonly submodule?: SubmodulePin;
  readonly surfaces: readonly SurfaceRecord[];
  readonly workspace_harnesses: readonly StructureEntrypoint[];
  readonly web_url?: string;
  readonly git_ref?: string;
  readonly repo_subpath?: string;
  /** Absolute local directory on disk if the repo is checked out locally */
  readonly local_package_dir?: string;
}

export interface ModuleSurfaceCounts {
  readonly routes: number;
  readonly tables: number;
  readonly topics: number;
  readonly other: number;
}

export interface ComponentOrientationCheck {
  readonly component_id: string;
  readonly tier: OrientationTier;
  readonly orientation_required: boolean;
  readonly has_orientation: boolean;
  readonly zone_count: number;
  readonly significant_modules: number;
  readonly covered_modules: number;
  readonly uncovered_modules: readonly string[];
  readonly coverage_pct: number;
  readonly broken_paths: readonly string[];
  readonly catchall_paths: readonly string[];
  readonly mechanical_does: boolean;
  readonly problems: readonly SpaceProblem[];
}

export interface OrientBrief {
  readonly component_id: string;
  readonly name: string;
  readonly kind: string;
  readonly system_id: string;
  readonly system_name: string;
  readonly does?: string;
  readonly tech?: string;
  readonly tier: OrientationTier;
  readonly orientation_required: boolean;
  readonly footprint: {
    readonly total_files: number;
    readonly source_files: number;
    readonly total_loc: number;
  };
  readonly web_url?: string;
  readonly doc_summary?: string;
  readonly entrypoints: readonly StructureEntrypoint[];
  readonly workspace_harnesses: readonly StructureEntrypoint[];
  readonly flags: readonly string[];
  readonly tech_stack: readonly { readonly category: string; readonly items: readonly string[] }[];
  readonly modules: readonly (StructureModuleEntry & {
    readonly surfaces?: ModuleSurfaceCounts;
    readonly assigned_zone?: string;
  })[];
  readonly neighbors: {
    readonly depends_on: readonly { readonly id: string; readonly name: string; readonly does?: string }[];
    readonly used_by: readonly { readonly id: string; readonly name: string; readonly does?: string }[];
  };
  readonly current_orientation?: OrientationFile;
  readonly check: ComponentOrientationCheck;
}

function normalizeGitWebUrl(remote?: string): string | undefined {
  if (!remote) return undefined;
  const trimmed = remote.trim();
  if (!trimmed) return undefined;
  const scpMatch = trimmed.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (scpMatch) return `https://${scpMatch[1]}/${scpMatch[2]}`;
  const sshMatch = trimmed.match(/^ssh:\/\/(?:[^@]+@)?([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) return `https://${sshMatch[1]}/${sshMatch[2]}`;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\.git$/, "");
  }
  return undefined;
}

function toPosix(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

/**
 * Single shared resolver mapping a component to its RepoEvidence, PackageRoot,
 * PackageStructure, SubmodulePin, Surfaces, and normalized GitHub URLs.
 * Handles both monorepo crates (home.repo = root, home.path = crates/foo)
 * and nested git submodules (home.repo = wordloop-core, evidence under superproject).
 */
export function resolveComponentEvidence(
  model: SpaceModel,
  sys: LoadedSystem,
  comp: LoadedComponent,
): ResolvedComponentEvidence {
  const homes = sys.system.homes ?? {};
  const homeKey = comp.component.home ?? Object.keys(homes)[0];
  const home = homeKey ? homes[homeKey] : undefined;
  const homeRepo = home?.repo;
  const homePath = home?.path ? toPosix(home.path) : undefined;

  let evidenceKey: string | undefined;
  let evidence: RepoEvidence | undefined;
  let packageRoot: PackageRoot | undefined;
  let packageStructure: PackageStructure | undefined;
  let submodule: SubmodulePin | undefined;

  // 1. Direct evidence match by home.repo
  if (homeRepo && model.evidence[homeRepo]) {
    evidenceKey = homeRepo;
    evidence = model.evidence[homeRepo];
  }

  // 2. Fallback: search all evidence entries for a matching submodule or package_root.repo_name
  if (!evidence && homeRepo) {
    for (const [key, ev] of Object.entries(model.evidence)) {
      const smMatch = (ev.repository.submodules ?? []).find((s) => s.name === homeRepo);
      const pkgMatch = ev.repository.package_roots.find(
        (p) => p.repo_name === homeRepo || (homePath && toPosix(p.path) === homePath),
      );
      if (smMatch || pkgMatch) {
        evidenceKey = key;
        evidence = ev;
        submodule = smMatch;
        packageRoot = pkgMatch;
        break;
      }
    }
  }

  if (evidence) {
    if (!submodule && homeRepo) {
      submodule = (evidence.repository.submodules ?? []).find((s) => s.name === homeRepo || s.name === comp.slug);
    }
    if (!packageRoot) {
      const roots = evidence.repository.package_roots;
      packageRoot =
        (homePath ? roots.find((p) => toPosix(p.path) === homePath) : undefined) ??
        (homeRepo ? roots.find((p) => p.repo_name === homeRepo) : undefined) ??
        roots.find((p) => p.name === comp.slug) ??
        (roots.length === 1 ? roots[0] : undefined);
    }
    if (evidence.structure) {
      const pkgs = evidence.structure.packages;
      packageStructure =
        (packageRoot ? pkgs.find((p) => toPosix(p.package_root) === toPosix(packageRoot!.path)) : undefined) ??
        (homePath ? pkgs.find((p) => toPosix(p.package_root) === homePath) : undefined) ??
        (homeRepo ? pkgs.find((p) => p.repo_name === homeRepo) : undefined) ??
        pkgs.find((p) => p.name === comp.slug);
    }
  }

  // Filter surfaces belonging strictly to this component's package root / submodule
  const pkgPathNorm = packageRoot ? toPosix(packageRoot.path) : homePath;
  const rawSurfaces = evidence?.inventory?.surfaces ?? [];
  const surfaces = rawSurfaces.filter((s) => {
    const sPkg = toPosix(s.package_root);
    if (pkgPathNorm && pkgPathNorm !== ".") {
      if (sPkg === pkgPathNorm) return true;
      // Repo-level declarative specs named after the service (e.g. specs/core-openapi.json -> wordloop-core)
      const shortSlug = comp.slug.replace(/^[^-]+-/, "");
      if (sPkg === "." && s.denominator === "declarative_spec" && s.file.toLowerCase().includes(shortSlug)) {
        return true;
      }
      return false;
    }
    if (submodule && s.repo_name === submodule.name) return true;
    if (pkgPathNorm === "." && evidence && evidence.repository.package_roots.length <= 1) {
      return sPkg === ".";
    }
    return false;
  });

  // Resolve web URL & git ref
  const repoConfig = homeRepo ? model.config.repos?.[homeRepo] : undefined;
  const webUrl =
    packageStructure?.web_url ??
    normalizeGitWebUrl(submodule?.remote ?? repoConfig?.remote ?? evidence?.repository.remote);
  const gitRef =
    packageStructure?.git_ref ??
    submodule?.commit ??
    repoConfig?.default_branch ??
    evidence?.repository.commit;

  let repoSubpath = packageStructure?.repo_subpath;
  if (repoSubpath === undefined) {
    if (submodule && pkgPathNorm) {
      const smPath = toPosix(submodule.path);
      if (pkgPathNorm.startsWith(smPath + "/")) {
        repoSubpath = pkgPathNorm.slice(smPath.length + 1);
      }
    } else if (!submodule && pkgPathNorm && pkgPathNorm !== ".") {
      repoSubpath = pkgPathNorm;
    }
  }

  // Resolve local checkout path on disk if available
  let localPackageDir: string | undefined;
  if (repoConfig?.path) {
    const candidate = homePath ? path.join(repoConfig.path, homePath) : repoConfig.path;
    if (fs.existsSync(candidate)) localPackageDir = candidate;
  } else if (evidenceKey && model.config.repos?.[evidenceKey]?.path && pkgPathNorm) {
    const candidate =
      pkgPathNorm === "."
        ? model.config.repos[evidenceKey]!.path!
        : path.join(model.config.repos[evidenceKey]!.path!, pkgPathNorm);
    if (fs.existsSync(candidate)) localPackageDir = candidate;
  }

  return {
    ...(homeRepo ? { home_repo: homeRepo } : {}),
    ...(homePath ? { home_path: homePath } : {}),
    ...(evidenceKey ? { evidence_key: evidenceKey } : {}),
    ...(evidence ? { evidence } : {}),
    ...(packageRoot ? { package_root: packageRoot } : {}),
    ...(packageStructure ? { package_structure: packageStructure } : {}),
    ...(submodule ? { submodule } : {}),
    surfaces,
    workspace_harnesses: evidence?.structure?.workspace_harnesses ?? [],
    ...(webUrl ? { web_url: webUrl } : {}),
    ...(gitRef ? { git_ref: gitRef } : {}),
    ...(repoSubpath ? { repo_subpath: repoSubpath } : {}),
    ...(localPackageDir ? { local_package_dir: localPackageDir } : {}),
  };
}

/** Derive per-module surface counts on read from inventory surfaces. */
export function deriveSurfaceCountsByModule(
  surfaces: readonly SurfaceRecord[],
  packageRootPath?: string,
): Map<string, ModuleSurfaceCounts> {
  const counts = new Map<string, { routes: number; tables: number; topics: number; other: number }>();
  const prefix = packageRootPath && packageRootPath !== "." ? toPosix(packageRootPath) + "/" : "";

  for (const s of surfaces) {
    const f = toPosix(s.file);
    let rel = f;
    if (prefix && f.startsWith(prefix)) {
      rel = f.slice(prefix.length);
    } else if (prefix) {
      continue;
    }
    const parts = rel.split("/");
    const key =
      parts[0] === "src" || parts[0] === "internal" || parts[0] === "pkg" || parts[0] === "cmd"
        ? parts.length >= 2
          ? `${parts[0]}/${parts[1]!.replace(/\.rs$/, "")}`
          : parts[0]!
        : parts[0]!;

    let entry = counts.get(key);
    if (!entry) {
      entry = { routes: 0, tables: 0, topics: 0, other: 0 };
      counts.set(key, entry);
    }
    if (s.kind === "route" || s.kind === "ws_channel") entry.routes += 1;
    else if (s.kind === "table") entry.tables += 1;
    else if (s.kind === "topic" || s.kind === "subscription") entry.topics += 1;
    else entry.other += 1;
  }
  return counts;
}

const CATCHALL_PATHS = new Set([".", "./", "src", "internal", "pkg", "cmd", "app", "lib"]);

function pathMatchesModule(zonePath: string, modPath: string): boolean {
  const zp = toPosix(zonePath);
  const mp = toPosix(modPath);
  if (zp === mp) return true;
  // Match Rust src/runtime.rs <-> src/runtime
  if (zp.replace(/\.rs$/, "") === mp.replace(/\.rs$/, "")) return true;
  // Zone covers parent dir of module (e.g., zone "internal/entrypoints" covers "internal/entrypoints/api")
  if (mp.startsWith(zp + "/")) return true;
  // Zone targets a file inside the module dir (e.g., zone "src/runtime/tick.rs" inside "src/runtime")
  if (zp.startsWith(mp + "/")) return true;
  return false;
}

function pathExistsInStructureOrDisk(
  relPath: string,
  pkgStruct?: PackageStructure,
  localPkgDir?: string,
): boolean | null {
  const clean = toPosix(relPath);
  if (localPkgDir) {
    if (fs.existsSync(path.join(localPkgDir, clean))) return true;
  }
  if (pkgStruct) {
    if (pkgStruct.modules.some((m) => pathMatchesModule(clean, m.path))) return true;
    if (pkgStruct.entrypoints.some((ep) => toPosix(ep.path) === clean)) return true;
    // Common root files inside a package that aren't in modules list
    if (/^(src\/lib\.rs|src\/main\.rs|Cargo\.toml|go\.mod|package\.json|pyproject\.toml|Dockerfile|README\.md|db\/schema\.sql)$/.test(clean)) {
      return true;
    }
    return false;
  }
  return null; // Cannot verify without structure.json or local checkout
}

const MECHANICAL_DOES_RE = /^Rust crate \([^)]+\)\s*[—-]\s*\d+\s+engine deps/i;

export function evaluateComponentOrientation(
  model: SpaceModel,
  sys: LoadedSystem,
  comp: LoadedComponent,
): ComponentOrientationCheck {
  const resolved = resolveComponentEvidence(model, sys, comp);
  const pkgStruct = resolved.package_structure;
  const orientation = comp.orientation;
  const problems: SpaceProblem[] = [];
  const orientationFile = path.join(comp.dir, "orientation.yaml");

  const tier: OrientationTier = pkgStruct?.tier ?? (comp.component.depth === "stub" ? "compact" : "standard");
  const orientationRequired = comp.component.depth !== "stub" && tier !== "compact";
  const significantModules = (pkgStruct?.modules ?? []).filter(
    (m) => m.visibility !== "test" && (m.source_files >= 1 || m.file_count >= 2),
  );

  const brokenPaths: string[] = [];
  const catchallPaths: string[] = [];

  const checkPath = (raw: string, fieldName: string) => {
    const clean = toPosix(raw);
    // Reject repo-root prefixed paths when package_root is a subpath
    if (
      resolved.package_root &&
      resolved.package_root.path !== "." &&
      clean.startsWith(toPosix(resolved.package_root.path) + "/")
    ) {
      brokenPaths.push(raw);
      problems.push({
        severity: "error",
        code: "orientation_non_relative_path",
        file: orientationFile,
        entity_id: comp.id,
        message: `${fieldName} "${raw}" must be package-root-relative (omit "${resolved.package_root.path}/" prefix).`,
      });
      return;
    }

    const exists = pathExistsInStructureOrDisk(clean, pkgStruct, resolved.local_package_dir);
    if (exists === false) {
      brokenPaths.push(raw);
      problems.push({
        severity: "error",
        code: "orientation_missing_path",
        file: orientationFile,
        entity_id: comp.id,
        message: `${fieldName} "${raw}" was not found in ${comp.slug}'s structure.json or local checkout.`,
      });
    }
  };

  if (orientation) {
    for (const z of orientation.zones ?? []) {
      for (const p of z.paths) {
        const clean = toPosix(p);
        if (CATCHALL_PATHS.has(clean)) {
          catchallPaths.push(p);
          problems.push({
            severity: "warning",
            code: "orientation_catchall_zone_path",
            file: orientationFile,
            entity_id: comp.id,
            message: `Zone "${z.id}" uses catch-all path "${p}". Specify concrete subdirectories or modules.`,
          });
        } else {
          checkPath(p, `zone:${z.id}.paths`);
        }
      }
    }
    for (const sh of orientation.start_here ?? []) {
      checkPath(sh.path, "start_here.path");
    }
    for (const t of orientation.tasks ?? []) {
      if (t.path) checkPath(t.path, `tasks["${t.label}"].path`);
    }
  }

  // Compute zone coverage over significant non-test modules
  const zones = orientation?.zones ?? [];
  const uncoveredModules: string[] = [];
  for (const mod of significantModules) {
    const covered = zones.some((z) => z.paths.some((zp) => !CATCHALL_PATHS.has(toPosix(zp)) && pathMatchesModule(zp, mod.path)));
    if (!covered) uncoveredModules.push(mod.path);
  }
  const coveredCount = significantModules.length - uncoveredModules.length;
  const coveragePct =
    significantModules.length === 0
      ? 100
      : Math.round((coveredCount / significantModules.length) * 100);

  const mechanicalDoes = Boolean(comp.component.does && MECHANICAL_DOES_RE.test(comp.component.does.trim()));
  if (mechanicalDoes) {
    problems.push({
      severity: "warning",
      code: "mechanical_component_does",
      file: path.join(comp.dir, "component.yaml"),
      entity_id: comp.id,
      message: `Component "does" looks like a mechanical template ("${comp.component.does}"). Replace with a concrete 1-sentence domain summary.`,
    });
  }

  if (orientationRequired && !orientation) {
    problems.push({
      severity: "warning",
      code: "missing_orientation_yaml",
      file: orientationFile,
      entity_id: comp.id,
      message: `${comp.id} (${tier} tier, ${pkgStruct?.source_files ?? 0} source files) is missing orientation.yaml.`,
    });
  }

  return {
    component_id: comp.id,
    tier,
    orientation_required: orientationRequired,
    has_orientation: Boolean(orientation),
    zone_count: zones.length,
    significant_modules: significantModules.length,
    covered_modules: coveredCount,
    uncovered_modules: uncoveredModules,
    coverage_pct: coveragePct,
    broken_paths: brokenPaths,
    catchall_paths: catchallPaths,
    mechanical_does: mechanicalDoes,
    problems,
  };
}

export function buildOrientBrief(
  model: SpaceModel,
  index: SpaceIndex,
  componentId: string,
): OrientBrief | null {
  let matchedSys: LoadedSystem | undefined;
  let matchedComp: LoadedComponent | undefined;
  for (const sys of model.systems) {
    const found = sys.components.find((c) => c.id === componentId || c.slug === componentId);
    if (found) {
      matchedSys = sys;
      matchedComp = found;
      break;
    }
  }
  if (!matchedSys || !matchedComp) return null;

  const resolved = resolveComponentEvidence(model, matchedSys, matchedComp);
  const pkgStruct = resolved.package_structure;
  const check = evaluateComponentOrientation(model, matchedSys, matchedComp);
  const surfaceCounts = deriveSurfaceCountsByModule(resolved.surfaces, resolved.package_root?.path);

  const zones = matchedComp.orientation?.zones ?? [];
  const modules = (pkgStruct?.modules ?? []).slice(0, 24).map((m) => {
    const assigned = zones.find((z) => z.paths.some((zp) => pathMatchesModule(zp, m.path)));
    const sc = surfaceCounts.get(m.path);
    return {
      ...m,
      ...(sc ? { surfaces: sc } : {}),
      ...(assigned ? { assigned_zone: assigned.id } : {}),
    };
  });

  // 1-hop neighbor summaries for cross-component coherence
  const lookupComp = (id: string): { id: string; name: string; does?: string } => {
    for (const s of model.systems) {
      const c = s.components.find((x) => x.id === id);
      if (c) return { id: c.id, name: c.component.name, ...(c.component.does ? { does: c.component.does } : {}) };
    }
    const ext = model.externals.find((e) => e.id === id);
    if (ext) return { id: ext.id, name: ext.external.name, does: ext.external.summary };
    return { id, name: id };
  };

  const outIds = [...new Set(index.edges.filter((e) => e.from === matchedComp!.id).map((e) => e.to))];
  const inIds = [...new Set(index.edges.filter((e) => e.to === matchedComp!.id).map((e) => e.from))];

  return {
    component_id: matchedComp.id,
    name: matchedComp.component.name,
    kind: matchedComp.component.kind,
    system_id: matchedSys.id,
    system_name: matchedSys.system.name,
    ...(matchedComp.component.does ? { does: matchedComp.component.does } : {}),
    ...(matchedComp.component.tech ? { tech: matchedComp.component.tech } : {}),
    tier: check.tier,
    orientation_required: check.orientation_required,
    footprint: {
      total_files: pkgStruct?.total_files ?? 0,
      source_files: pkgStruct?.source_files ?? 0,
      total_loc: pkgStruct?.total_loc ?? 0,
    },
    ...(resolved.web_url ? { web_url: resolved.web_url } : {}),
    ...(pkgStruct?.doc_summary ? { doc_summary: pkgStruct.doc_summary } : {}),
    entrypoints: pkgStruct?.entrypoints ?? [],
    workspace_harnesses: resolved.workspace_harnesses.slice(0, 12),
    flags: pkgStruct?.flags ?? [],
    tech_stack: pkgStruct?.tech_stack ?? [],
    modules,
    neighbors: {
      depends_on: outIds.map(lookupComp),
      used_by: inIds.map(lookupComp),
    },
    ...(matchedComp.orientation ? { current_orientation: matchedComp.orientation } : {}),
    check,
  };
}
