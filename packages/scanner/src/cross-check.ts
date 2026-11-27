import type { CrossCheckDiscrepancy, DenominatorCrossCheck, SurfaceRecord } from "@groundwork/schema";

export function normalizeRouteKey(method: string, routePath: string): string {
  const normalizedPath = routePath
    .trim()
    .replace(/\{[^}]+\}/g, "{}")
    .replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, "{}")
    .replace(/<[^>]+>/g, "{}")
    .replace(/\/+$/, "") || "/";
  return `${method.toUpperCase()} ${normalizedPath}`;
}

export function crossCheckRoutes(surfaces: readonly SurfaceRecord[]): DenominatorCrossCheck[] {
  const routes = surfaces.filter((s) => s.kind === "route");
  const specRoutes = routes.filter((s) => s.denominator === "declarative_spec");
  const codeRoutes = routes.filter((s) => s.denominator === "source_heuristic");

  if (specRoutes.length === 0 || codeRoutes.length === 0) {
    return [];
  }

  const specByKey = new Map<string, string[]>();
  const codeByKey = new Map<string, string[]>();

  for (const s of specRoutes) {
    const method = String(s.details?.method ?? "ANY");
    const routePath = String(s.details?.path ?? "");
    const key = normalizeRouteKey(method, routePath);
    const list = specByKey.get(key) ?? [];
    list.push(`${s.surface_id} (${s.file})`);
    specByKey.set(key, list);
  }

  for (const c of codeRoutes) {
    const method = String(c.details?.method ?? "ANY");
    const routePath = String(c.details?.path ?? "");
    const key = normalizeRouteKey(method, routePath);
    const list = codeByKey.get(key) ?? [];
    list.push(`${c.surface_id} (${c.file}${c.lines ? `#L${c.lines[0]}` : ""})`);
    codeByKey.set(key, list);
  }

  const allKeys = [...new Set([...specByKey.keys(), ...codeByKey.keys()])].sort();
  let matched = 0;
  const spec_only: CrossCheckDiscrepancy[] = [];
  const code_only: CrossCheckDiscrepancy[] = [];

  for (const key of allKeys) {
    const specs = specByKey.get(key) ?? [];
    const codes = codeByKey.get(key) ?? [];
    if (specs.length > 0 && codes.length > 0) {
      matched++;
    } else if (specs.length > 0) {
      // Also allow matching against ANY-method classic ServeMux registrations on the same path
      const [, routePath] = key.split(" ");
      const anyCodes = routePath ? codeByKey.get(`ANY ${routePath}`) : undefined;
      if (anyCodes && anyCodes.length > 0) {
        matched++;
      } else {
        spec_only.push({
          normalized_key: key,
          status: "spec_only",
          spec_surfaces: specs,
          code_surfaces: [],
        });
      }
    } else if (codes.length > 0) {
      // Skip ANY-method entries already matched to a typed spec route on the same path
      const [method, routePath] = key.split(" ");
      if (method === "ANY" && routePath) {
        const hasTypedSpec = [...specByKey.keys()].some((k) => k.endsWith(` ${routePath}`));
        if (hasTypedSpec) continue;
      }
      code_only.push({
        normalized_key: key,
        status: "code_only",
        spec_surfaces: [],
        code_surfaces: codes,
      });
    }
  }

  return [
    {
      facet: "interfaces",
      scope: "repo",
      spec_count: specByKey.size,
      code_count: codeByKey.size,
      matched,
      spec_only,
      code_only,
    },
  ];
}
