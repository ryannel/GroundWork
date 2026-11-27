import type { DbColumnSpec, DbTableSpec } from "../components/shared/DatabaseSchemaView";
import { buildRichEndpoints, type RichEndpointSpec } from "../components/shared/ApiReferenceView";
import type { LoadedComponent, LoadedSystem, ScannedSurface, SpacePayload, StoreFile } from "../types";

export function getAllScannedSurfaces(space: SpacePayload): ScannedSurface[] {
  return Object.values(space.evidence ?? {}).flatMap((ev) => ev.inventory?.surfaces ?? []);
}

export function getComponentHome(sys: LoadedSystem, comp: LoadedComponent): { repo: string; path?: string } | null {
  const homes = sys.system.homes ?? {};
  const key = comp.component.home ?? Object.keys(homes)[0];
  return key ? homes[key] ?? null : null;
}

/**
 * Single source of truth for matching scanned surfaces (OpenAPI, router, WS, Pub/Sub)
 * to a component across System Map, InspectorDrawer, QuickPeekDrawer, EntityDetailPage, and CommandPalette.
 */
export function getComponentScannedSurfaces(
  space: SpacePayload,
  sys: LoadedSystem,
  comp: LoadedComponent,
): ScannedSurface[] {
  const fromCodeInfo = space.component_code_info?.[comp.id]?.matched_surfaces;
  if (fromCodeInfo && fromCodeInfo.length > 0) {
    return fromCodeInfo;
  }

  const all = getAllScannedSurfaces(space);
  const homeInfo = getComponentHome(sys, comp);
  const slug = comp.slug;
  const repoKey = homeInfo?.repo;
  const subPath = homeInfo?.path;

  return all.filter((s) => {
    if (subPath && (s.package_root === subPath || s.package_root.endsWith(subPath))) return true;
    if (repoKey && !subPath && s.repo_name === repoKey) return true;
    if (s.package_root.includes(slug)) return true;
    const shortSlug = slug.replace(/^wordloop-/, "");
    if (s.package_root === "." && s.file.toLowerCase().includes(shortSlug)) return true;
    return false;
  });
}

export interface ComponentEndpointSummary {
  readonly all: readonly RichEndpointSpec[];
  readonly business: readonly RichEndpointSpec[];
  readonly triagedCount: number;
  readonly displayCount: number;
  readonly groups: ReadonlyArray<{ readonly name: string; readonly endpoints: readonly RichEndpointSpec[] }>;
}

export function getComponentRichEndpoints(
  space: SpacePayload,
  sys: LoadedSystem,
  comp: LoadedComponent,
  diffByEntity?: ReadonlyMap<string, "added" | "modified" | "removed">,
): ComponentEndpointSummary {
  const scannedRoutes = getComponentScannedSurfaces(space, sys, comp).filter(
    (s) => s.kind === "route" || s.kind === "ws_channel",
  );
  const all = buildRichEndpoints(
    comp.contracts.interfaces ?? [],
    comp.contracts.schemas ?? [],
    scannedRoutes,
    comp.component.triage ?? [],
    diffByEntity,
  );
  const business = all.filter((e) => !e.triageDisposition);
  const triagedCount = all.length - business.length;
  const primary = business.length > 0 ? business : all;

  const map = new Map<string, RichEndpointSpec[]>();
  for (const ep of primary) {
    const arr = map.get(ep.group) ?? [];
    arr.push(ep);
    map.set(ep.group, arr);
  }
  const groups = [...map.entries()].map(([name, endpoints]) => ({ name, endpoints }));

  return {
    all,
    business,
    triagedCount,
    displayCount: primary.length,
    groups,
  };
}

/**
 * Single source of truth for merging authored store records + scanned SQL DDL tables.
 */
export function getStoreTables(
  space: SpacePayload,
  store: StoreFile,
  diffByEntity?: ReadonlyMap<string, "added" | "modified" | "removed">,
): DbTableSpec[] {
  const scannedTables = store.form === "database" ? getAllScannedSurfaces(space).filter((s) => s.kind === "table") : [];
  const combined: DbTableSpec[] = [];
  const seen = new Set<string>();

  for (const rec of store.records ?? []) {
    const name = rec.table ?? rec.id.replace(/^schema:/, "");
    seen.add(name);
    const cols: DbColumnSpec[] = rec.fields.map((f) => ({
      id: f.id,
      name: f.name,
      type: typeof f.type === "string" ? f.type : JSON.stringify(f.type),
      required: f.required,
      primaryKey: f.name === "id",
      diffKind: diffByEntity?.get(`${rec.id}#${f.id}`),
    }));
    combined.push({
      name,
      schemaId: rec.id,
      source: "authored",
      columns: cols,
      hasPlanChange: cols.some((c) => Boolean(c.diffKind)),
    });
  }

  for (const s of scannedTables) {
    const tName = s.symbol ?? String(s.details?.table ?? s.surface_id.replace(/^table:/, ""));
    if (seen.has(tName)) continue;
    seen.add(tName);
    const rawDefs = Array.isArray(s.details?.column_defs)
      ? (s.details.column_defs as Array<{
          name: string;
          type: string;
          required?: boolean;
          primary_key?: boolean;
          references?: string;
          notes?: string;
        }>)
      : null;
    const cols: DbColumnSpec[] = rawDefs
      ? rawDefs.map((c) => ({
          id: c.name,
          name: c.name,
          type: c.type,
          required: c.required,
          primaryKey: c.primary_key,
          references: c.references,
          notes: c.notes,
        }))
      : (Array.isArray(s.details?.columns) ? (s.details.columns as string[]) : []).map((c) => ({
          id: c,
          name: c,
          type: "sql",
        }));
    combined.push({
      name: tName,
      source: "scanned",
      file: s.file,
      columns: cols,
      hasPlanChange: false,
    });
  }

  return combined.sort((a, b) => Number(b.hasPlanChange) - Number(a.hasPlanChange) || a.name.localeCompare(b.name));
}
