import { ExternalLink, Eye, EyeOff, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { InterfaceDef, ScannedSurface } from "../../types";
import { EntityLink } from "./EntityLink";

export interface TriageRuleRef {
  readonly surface: string;
  readonly disposition: string;
  readonly reason: string;
}

export interface NormalizedRoute {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly summary?: string;
  readonly auth?: string;
  readonly knownFrom: string;
  readonly request?: string;
  readonly response?: string;
  readonly docUrl?: string;
  readonly source: "authored" | "scanned";
  readonly group: string;
  readonly triageDisposition?: string;
}

interface Props {
  interfaces: readonly InterfaceDef[];
  scannedRoutes?: readonly ScannedSurface[];
  triageRules?: readonly TriageRuleRef[];
  onNavigate?: (id: string) => void;
  compact?: boolean;
}

function matchesGlob(pattern: string, value: string): boolean {
  const regexStr =
    "^" +
    pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "__GLOBSTAR__")
      .replace(/\*/g, "[^/]*")
      .replace(/__GLOBSTAR__/g, ".*") +
    "$";
  try {
    return new RegExp(regexStr).test(value);
  } catch {
    return pattern === value;
  }
}

function matchTriageDisposition(surfaceId: string, routePath: string, triageRules: readonly TriageRuleRef[]): string | undefined {
  for (const rule of triageRules) {
    if (matchesGlob(rule.surface, surfaceId) || matchesGlob(rule.surface, routePath)) {
      return rule.disposition;
    }
  }
  return undefined;
}

function methodBadgeClass(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "indigo";
    case "POST":
      return "emerald";
    case "PUT":
    case "PATCH":
      return "amber";
    case "DELETE":
      return "rose";
    default:
      return "";
  }
}

function extractGroup(routePath: string): string {
  const clean = routePath.replace(/^\/v\d+\//, "/").replace(/^\//, "");
  const first = clean.split("/")[0] || "root";
  return `/${first}`;
}

export function buildNormalizedRoutes(
  interfaces: readonly InterfaceDef[],
  scannedRoutes: readonly ScannedSurface[] = [],
  triageRules: readonly TriageRuleRef[] = [],
): NormalizedRoute[] {
  const list: NormalizedRoute[] = [];
  const seenMethodPath = new Set<string>();

  for (const iface of interfaces) {
    for (const ep of iface.entries) {
      const method = (ep.method ?? (iface.kind === "websocket" ? "WS" : "RPC")).toUpperCase();
      const fullPath = `${iface.base_path ?? ""}${ep.path ?? ""}` || ep.id;
      seenMethodPath.add(`${method} ${fullPath}`);

      let docUrl: string | undefined;
      for (const c of ep.cites ?? []) {
        if (c && typeof c === "object" && "doc" in c && typeof (c as { doc?: unknown }).doc === "string") {
          docUrl = (c as { doc: string }).doc;
        }
      }

      list.push({
        id: ep.id,
        method,
        path: fullPath,
        summary: ep.summary,
        auth: ep.auth ?? iface.auth,
        knownFrom: iface.known_from,
        request: ep.request,
        response: ep.response,
        docUrl,
        source: "authored",
        group: extractGroup(fullPath),
      });
    }
  }

  // Prefer declarative_spec routes before source_heuristic when deduplicating
  const orderedScanned = [...scannedRoutes].sort((a, b) => {
    const aSpec = a.denominator === "declarative_spec" ? 0 : 1;
    const bSpec = b.denominator === "declarative_spec" ? 0 : 1;
    return aSpec - bSpec;
  });

  for (const s of orderedScanned) {
    if (s.kind !== "route" && s.kind !== "ws_channel") continue;
    const method = s.kind === "ws_channel" ? "WS" : String(s.details?.method ?? "ANY").toUpperCase();
    const routePath = String(s.details?.path ?? s.details?.channel ?? s.surface_id);
    const key = `${method} ${routePath}`;
    if (seenMethodPath.has(key)) continue;
    seenMethodPath.add(key);

    const disposition = matchTriageDisposition(s.surface_id, routePath, triageRules);

    list.push({
      id: s.surface_id,
      method,
      path: routePath,
      summary: typeof s.details?.summary === "string" ? s.details.summary : undefined,
      knownFrom: s.extractor,
      source: "scanned",
      group: extractGroup(routePath),
      triageDisposition: disposition,
    });
  }

  return list.sort((a, b) => a.group.localeCompare(b.group) || a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

export function ContractCatalog({ interfaces, scannedRoutes = [], triageRules = [], onNavigate, compact = false }: Props) {
  const [query, setQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [showTriaged, setShowTriaged] = useState(false);

  const routes = useMemo<NormalizedRoute[]>(
    () => buildNormalizedRoutes(interfaces, scannedRoutes, triageRules),
    [interfaces, scannedRoutes, triageRules],
  );

  const triagedCount = useMemo(
    () => routes.filter((r) => Boolean(r.triageDisposition)).length,
    [routes],
  );
  const businessCount = routes.length - triagedCount;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return routes.filter((r) => {
      if (!showTriaged && businessCount > 0 && r.triageDisposition) return false;
      if (methodFilter !== "ALL" && r.method !== methodFilter) return false;
      if (!q) return true;
      return (
        r.path.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.summary?.toLowerCase().includes(q) ?? false) ||
        r.group.toLowerCase().includes(q)
      );
    });
  }, [routes, query, methodFilter, showTriaged, businessCount]);

  const grouped = useMemo(() => {
    const map = new Map<string, NormalizedRoute[]>();
    for (const r of filtered) {
      const arr = map.get(r.group) ?? [];
      arr.push(r);
      map.set(r.group, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  if (routes.length === 0) {
    return (
      <div className="section-card" style={{ color: "var(--text-faint)", fontSize: 13 }}>
        No API endpoints recorded for this entity.
      </div>
    );
  }

  const visibleTotal = showTriaged || businessCount === 0 ? routes.length : businessCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!compact && routes.length > 4 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-faint)" }} />
            <input
              className="search-input"
              style={{ width: "100%", paddingLeft: 32 }}
              placeholder={`Filter ${visibleTotal} endpoints by path, group, or summary…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="pill-group">
            {["ALL", "GET", "POST", "PUT", "PATCH", "DELETE", "WS"].map((m) => (
              <button
                key={m}
                className={`icon-btn ${methodFilter === m ? "active" : ""}`}
                onClick={() => setMethodFilter(m)}
              >
                {m}
              </button>
            ))}
          </div>
          {triagedCount > 0 && businessCount > 0 && (
            <button
              className={`secondary-btn ${showTriaged ? "active" : ""}`}
              style={{ fontSize: 11.5, padding: "6px 10px" }}
              onClick={() => setShowTriaged((v) => !v)}
              title="Toggle operational, documentation, and test-only routes filtered by component triage rules"
            >
              {showTriaged ? <EyeOff size={13} /> : <Eye size={13} />}
              {showTriaged ? `Hide triaged (${triagedCount})` : `Show triaged (${triagedCount})`}
            </button>
          )}
        </div>
      )}

      {grouped.map(([group, items]) => (
        <div key={group} className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "8px 14px",
              background: "var(--bg)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span className="mono" style={{ fontWeight: 700, fontSize: 12 }}>{group}</span>
            <span className="badge">{items.length}</span>
          </div>

          <div>
            {items.map((r) => (
              <div
                key={`${r.source}:${r.id}:${r.method}:${r.path}`}
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  opacity: r.triageDisposition ? 0.72 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`badge ${methodBadgeClass(r.method)}`} style={{ minWidth: 50, justifyContent: "center" }}>
                      {r.method}
                    </span>
                    <span className="mono" style={{ fontWeight: 600, fontSize: 12.5 }}>{r.path}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {r.triageDisposition && <span className="badge amber">{r.triageDisposition}</span>}
                    {r.auth && <span className="badge">{r.auth}</span>}
                    <span className="badge">{r.knownFrom}</span>
                    {r.docUrl && (
                      <a href={r.docUrl} target="_blank" rel="noreferrer" className="entity-link neutral">
                        Docs <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>

                {r.summary && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{r.summary}</div>}

                {(r.request || r.response) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                    {r.request && r.request !== "none" && (
                      <span style={{ fontSize: 11, color: "var(--text-faint)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        Req:
                        {onNavigate ? <EntityLink id={r.request} variant="neutral" onOpen={onNavigate} /> : <code className="mono">{r.request}</code>}
                      </span>
                    )}
                    {r.response && r.response !== "none" && (
                      <span style={{ fontSize: 11, color: "var(--text-faint)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        Res:
                        {onNavigate ? <EntityLink id={r.response} variant="neutral" onOpen={onNavigate} /> : <code className="mono">{r.response}</code>}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
