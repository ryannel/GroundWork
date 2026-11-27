export type AppRoute =
  | { readonly kind: "landing" }
  | {
      readonly kind: "map";
      readonly ws: string;
      readonly project?: string;
      readonly select?: string;
    }
  | {
      readonly kind: "flows";
      readonly ws: string;
      readonly project?: string;
    }
  | {
      readonly kind: "gaps";
      readonly ws: string;
      readonly project?: string;
    }
  | {
      readonly kind: "plans";
      readonly ws: string;
      readonly project?: string;
      readonly plan?: string;
      readonly tab?: string;
      readonly op?: string;
      readonly step?: number;
      readonly mode?: "architecture" | "sequence";
    }
  | {
      readonly kind: "entity";
      readonly ws: string;
      readonly project?: string;
      readonly entityId: string;
      readonly tab?: string;
      readonly endpoint?: string;
      readonly table?: string;
      readonly dbview?: "tables" | "er";
      readonly plan?: string;
      readonly state?: "proposed" | "as-is";
      readonly returnTo?: string;
    };

function wsPrefix(ws: string, project?: string): string {
  const base = `/w/${encodeURIComponent(ws)}`;
  return project ? `${base}/p/${encodeURIComponent(project)}` : base;
}

export function buildHref(route: AppRoute): string {
  if (route.kind === "landing") return "/";

  const prefix = wsPrefix(route.ws, route.project);
  const qs = new URLSearchParams();

  if (route.kind === "map") {
    if (route.select) qs.set("select", route.select);
    const q = qs.toString();
    return q ? `${prefix}?${q}` : prefix;
  }

  if (route.kind === "flows") return `${prefix}/flows`;
  if (route.kind === "gaps") return `${prefix}/gaps`;

  if (route.kind === "plans") {
    const path = route.plan ? `${prefix}/plans/${encodeURIComponent(route.plan)}` : `${prefix}/plans`;
    if (route.tab) qs.set("tab", route.tab);
    if (route.op) qs.set("op", route.op);
    if (route.step !== undefined && route.step >= 0) qs.set("step", String(route.step));
    if (route.mode && route.mode !== "architecture") qs.set("mode", route.mode);
    const q = qs.toString();
    return q ? `${path}?${q}` : path;
  }

  // entity
  const path = `${prefix}/entity/${encodeURIComponent(route.entityId)}`;
  if (route.tab && route.tab !== "overview") qs.set("tab", route.tab);
  if (route.endpoint) qs.set("endpoint", route.endpoint);
  if (route.table) qs.set("table", route.table);
  if (route.dbview && route.dbview !== "tables") qs.set("dbview", route.dbview);
  if (route.plan) qs.set("plan", route.plan);
  if (route.state && route.state !== "proposed") qs.set("state", route.state);
  if (route.returnTo) qs.set("returnTo", route.returnTo);
  const q = qs.toString();
  return q ? `${path}?${q}` : path;
}

export function parseRoute(pathname: string, search: string): AppRoute {
  const cleanPath = pathname.replace(/\/+$/, "") || "/";
  if (cleanPath === "/") return { kind: "landing" };

  const segs = cleanPath.split("/").filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });

  if (segs[0] !== "w" || !segs[1]) return { kind: "landing" };

  const ws = segs[1];
  let idx = 2;
  let project: string | undefined;
  if (segs[idx] === "p" && segs[idx + 1]) {
    project = segs[idx + 1];
    idx += 2;
  }

  const qs = new URLSearchParams(search);
  const section = segs[idx];

  if (!section) {
    return {
      kind: "map",
      ws,
      ...(project ? { project } : {}),
      ...(qs.get("select") ? { select: qs.get("select")! } : {}),
    };
  }

  if (section === "flows") {
    return { kind: "flows", ws, ...(project ? { project } : {}) };
  }

  if (section === "gaps") {
    return { kind: "gaps", ws, ...(project ? { project } : {}) };
  }

  if (section === "plans") {
    const plan = segs[idx + 1];
    const stepRaw = qs.get("step");
    const stepNum = stepRaw !== null && /^\d+$/.test(stepRaw) ? Number(stepRaw) : undefined;
    const modeRaw = qs.get("mode");
    return {
      kind: "plans",
      ws,
      ...(project ? { project } : {}),
      ...(plan ? { plan } : {}),
      ...(qs.get("tab") ? { tab: qs.get("tab")! } : {}),
      ...(qs.get("op") ? { op: qs.get("op")! } : {}),
      ...(stepNum !== undefined ? { step: stepNum } : {}),
      ...(modeRaw === "sequence" ? { mode: "sequence" } : {}),
    };
  }

  if (section === "entity" && segs[idx + 1]) {
    // Support entity IDs that may contain slashes if unencoded, or single encoded segment
    const entityId = segs.slice(idx + 1).join("/");
    const dbviewRaw = qs.get("dbview");
    const stateRaw = qs.get("state");
    return {
      kind: "entity",
      ws,
      ...(project ? { project } : {}),
      entityId,
      ...(qs.get("tab") ? { tab: qs.get("tab")! } : {}),
      ...(qs.get("endpoint") ? { endpoint: qs.get("endpoint")! } : {}),
      ...(qs.get("table") ? { table: qs.get("table")! } : {}),
      ...(dbviewRaw === "er" ? { dbview: "er" } : {}),
      ...(qs.get("plan") ? { plan: qs.get("plan")! } : {}),
      ...(stateRaw === "as-is" ? { state: "as-is" } : {}),
      ...(qs.get("returnTo") ? { returnTo: qs.get("returnTo")! } : {}),
    };
  }

  return { kind: "map", ws, ...(project ? { project } : {}) };
}

export function getCurrentHref(): string {
  return `${window.location.pathname}${window.location.search}`;
}

export function pushRoute(route: AppRoute, replace = false): void {
  const href = buildHref(route);
  const current = getCurrentHref();
  if (href === current) return;
  if (replace) {
    window.history.replaceState(null, "", href);
  } else {
    window.history.pushState(null, "", href);
  }
}

export function pushRawHref(href: string, replace = false): void {
  if (href === getCurrentHref()) return;
  if (replace) {
    window.history.replaceState(null, "", href);
  } else {
    window.history.pushState(null, "", href);
  }
}

/** Helper for `<a href>` click handlers so Cmd/Ctrl/Shift/Middle-click open new tabs natively! */
export function isModifiedClick(e: React.MouseEvent): boolean {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}
