import type { FacetName, ModelingDepth, TriageRule } from "@groundwork/schema";
import type { LoadedComponent, SpaceModel } from "./model.js";
import {
  evaluateComponentOrientation,
  resolveComponentEvidence,
  type ComponentOrientationCheck,
} from "./orientation.js";

export interface FacetLedger {
  readonly facet: FacetName;
  readonly found: number;
  readonly bound: number;
  readonly triaged: number;
  readonly deferred: number;
  readonly unaccounted: readonly string[];
  readonly attested_none: boolean;
}

export interface ComponentCompleteness {
  readonly component_id: string;
  readonly system_id: string;
  readonly depth: ModelingDepth;
  readonly repo_key?: string;
  readonly package_path?: string;
  readonly accounted_pct: number;
  readonly has_deferred: boolean;
  readonly unpromoted_observed_edges: number;
  readonly facets: readonly FacetLedger[];
  readonly orientation?: ComponentOrientationCheck;
}

export interface SpaceCompletenessReport {
  readonly space_id: string;
  /** Level 1 closure: Space repos declared vs claimed by a system home */
  readonly unclaimed_repos: readonly string[];
  /** Level 2 closure: Package roots in evidence vs claimed by a component home */
  readonly unclaimed_package_roots: readonly string[];
  /** Level 3 closure: Per-component 3-axis ledgers */
  readonly components: readonly ComponentCompleteness[];
  readonly summary: {
    readonly total_components: number;
    readonly full_depth: number;
    readonly contract_only_depth: number;
    readonly stub_systems: number;
    readonly total_unaccounted_surfaces: number;
  };
}

/** Matches exact surface_id or simple glob patterns like "route:GET:/docs*" or "route:*:/actuator/**" */
export function matchesTriagePattern(surfaceId: string, pattern: string): boolean {
  if (surfaceId === pattern) return true;
  if (!pattern.includes("*")) return false;
  const escaped = pattern
    .replace(/\*\*/g, "__GLOBSTAR__")
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[^/]*")
    .replace(/__GLOBSTAR__/g, ".*");
  return new RegExp(`^${escaped}$`).test(surfaceId);
}

function findMatchingTriage(surfaceId: string, rules: readonly TriageRule[]): TriageRule | undefined {
  return rules.find((r) => matchesTriagePattern(surfaceId, r.surface));
}

function collectBoundSurfaces(comp: LoadedComponent): Set<string> {
  const bound = new Set<string>();
  for (const iface of comp.contracts.interfaces ?? []) {
    for (const ep of iface.entries) {
      if (ep.surface) bound.add(ep.surface);
      if (ep.method && ep.path) {
        const fullPath = `${iface.base_path ?? ""}${ep.path}`;
        bound.add(`route:${ep.method.toUpperCase()}:${fullPath}`);
      }
    }
  }
  for (const sub of comp.contracts.subscriptions ?? []) {
    if (sub.surface) bound.add(sub.surface);
  }
  for (const job of comp.contracts.jobs ?? []) {
    if (job.surface) bound.add(job.surface);
  }
  for (const dep of comp.component.depends_on ?? []) {
    const depSlug = dep.replace(/^(?:module|service|app):/, "");
    bound.add(`module_dep:${comp.slug}->${depSlug}`);
  }
  for (const mod of comp.component.public_modules ?? []) {
    bound.add(`module_export:${comp.slug}::${mod.name}`);
  }
  return bound;
}

const ALL_FACETS: readonly FacetName[] = [
  "interfaces",
  "stores",
  "messages_published",
  "messages_consumed",
  "jobs",
  "screens",
  "outbound_calls",
];

export function computeCompleteness(model: SpaceModel): SpaceCompletenessReport {
  // Level 1: declared repos vs claimed by systems
  const declaredRepos = new Set(Object.keys(model.config.repos ?? {}));
  const claimedRepos = new Set<string>();
  const claimedPackageRoots = new Set<string>();

  for (const sys of model.systems) {
    for (const home of Object.values(sys.system.homes ?? {})) {
      claimedRepos.add(home.repo);
      claimedPackageRoots.add(`${home.repo}:${home.path ?? "."}`);
    }
  }

  const unclaimed_repos = [...declaredRepos].filter((r) => !claimedRepos.has(r)).sort();

  // Level 2: package roots present in evidence vs claimed
  const unclaimed_package_roots: string[] = [];
  for (const [repoKey, ev] of Object.entries(model.evidence)) {
    for (const pkg of ev.repository.package_roots) {
      if (pkg.path === ".") continue;
      const key = `${repoKey}:${pkg.path}`;
      if (!claimedPackageRoots.has(key)) {
        unclaimed_package_roots.push(key);
      }
    }
  }
  unclaimed_package_roots.sort();

  // Level 3: per-component surface accounting
  const components: ComponentCompleteness[] = [];
  let totalUnaccounted = 0;

  for (const sys of model.systems) {
    for (const comp of sys.components) {
      const resolved = resolveComponentEvidence(model, sys, comp);
      const pkgPath = resolved.package_root?.path ?? resolved.home_path ?? ".";

      const bound = collectBoundSurfaces(comp);
      // Also include store tables & topic messages owned by this component
      for (const st of sys.stores) {
        if (st.owner === comp.id) {
          for (const rec of st.records ?? []) {
            if (rec.table) bound.add(`table:${rec.table}`);
          }
        }
      }
      for (const top of sys.topics) {
        if (top.owner === comp.id) {
          for (const msg of top.messages ?? []) {
            if (msg.surface) bound.add(msg.surface);
          }
        }
      }

      const triageRules = comp.component.triage ?? [];
      const attestations = new Set((comp.component.attestations ?? []).map((a) => a.facet));
      const matchingSurfaces = resolved.surfaces;

      let totalFound = 0;
      let totalAccounted = 0;
      let hasDeferred = false;
      const facets: FacetLedger[] = [];

      for (const facet of ALL_FACETS) {
        const facetSurfaces = matchingSurfaces.filter((s) => s.facet === facet);
        // Deduplicate by surface_id so declarative + heuristic hits on the same route count once
        const uniqueIds = [...new Set(facetSurfaces.map((s) => s.surface_id))];
        let boundCount = 0;
        let triagedCount = 0;
        let deferredCount = 0;
        const unaccounted: string[] = [];

        for (const sid of uniqueIds) {
          totalFound++;
          if (bound.has(sid)) {
            boundCount++;
            totalAccounted++;
          } else {
            const tri = findMatchingTriage(sid, triageRules);
            if (tri) {
              if (tri.disposition === "deferred") {
                deferredCount++;
                hasDeferred = true;
              } else {
                triagedCount++;
                totalAccounted++;
              }
            } else {
              unaccounted.push(sid);
              totalUnaccounted++;
            }
          }
        }

        facets.push({
          facet,
          found: uniqueIds.length,
          bound: boundCount,
          triaged: triagedCount,
          deferred: deferredCount,
          unaccounted,
          attested_none: attestations.has(facet),
        });
      }

      const unpromoted = (comp.component.observed_edges ?? []).filter(
        (e) => e.status !== "unused_registration",
      ).length;
      const orientation = evaluateComponentOrientation(model, sys, comp);

      components.push({
        component_id: comp.id,
        system_id: sys.id,
        depth: comp.component.depth ?? "full",
        ...(resolved.home_repo ? { repo_key: resolved.home_repo, package_path: pkgPath } : {}),
        accounted_pct: totalFound === 0 ? 100 : Math.round((totalAccounted / totalFound) * 100),
        has_deferred: hasDeferred,
        unpromoted_observed_edges: unpromoted,
        facets,
        orientation,
      });
    }
  }

  return {
    space_id: model.config.id,
    unclaimed_repos,
    unclaimed_package_roots,
    components,
    summary: {
      total_components: components.length,
      full_depth: components.filter((c) => c.depth === "full").length,
      contract_only_depth: components.filter((c) => c.depth === "contract-only").length,
      stub_systems: model.systems.filter((s) => !s.system.mapped).length,
      total_unaccounted_surfaces: totalUnaccounted,
    },
  };
}
