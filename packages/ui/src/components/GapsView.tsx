import { AlertTriangle, ArrowRight, CheckCircle2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { SpacePayload } from "../types";
import { EntityLink } from "./shared/EntityLink";

interface Props {
  space: SpacePayload;
  onOpenEntity: (entityId: string, tab?: string) => void;
}

/**
 * 2026 Completeness Scorecard & Gaps Triage Queue (Backstage Scorecard / Linear Triage pattern):
 * Visualizes 3-axis completeness (Accounted Coverage, Modeling Depth, Explicit Gaps)
 * with filterable gap categories and direct deep-links into every affected entity.
 */
export function GapsView({ space, onOpenEntity }: Props) {
  const [kindFilter, setKindFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  const kinds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of space.gaps) {
      counts.set(g.kind, (counts.get(g.kind) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [space.gaps]);

  const filteredGaps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return space.gaps.filter((g) => {
      if (kindFilter !== "ALL" && g.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        g.entity_id.toLowerCase().includes(q) ||
        g.detail.toLowerCase().includes(q) ||
        g.kind.toLowerCase().includes(q)
      );
    });
  }, [space.gaps, kindFilter, query]);

  const avgAccounted = useMemo(() => {
    const comps = space.completeness.components;
    if (comps.length === 0) return 100;
    const sum = comps.reduce((a, c) => a + c.accounted_pct, 0);
    return Math.round(sum / comps.length);
  }, [space.completeness.components]);

  return (
    <div className="studio-content" style={{ flex: 1 }}>
      <div style={{ maxWidth: 1220, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
            3-Axis Completeness &amp; Explicit Gaps
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>
            Provable accounting across repositories, package roots, and code/spec surfaces. Every unknown is tracked explicitly — never invented.
          </p>
        </div>

        {/* Scorecard Strip */}
        <div className="stat-strip">
          <div className="stat-card">
            <div className="stat-label">Average Accounted Coverage</div>
            <div className="stat-value" style={{ color: avgAccounted === 100 ? "var(--emerald)" : "var(--accent)" }}>
              {avgAccounted}%
            </div>
            <div style={{ marginTop: 8, height: 6, borderRadius: 99, background: "var(--surface-muted)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${avgAccounted}%`,
                  height: "100%",
                  background: avgAccounted === 100 ? "#10b981" : "#4f46e5",
                  borderRadius: 99,
                }}
              />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Modeling Depth</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              <span className="badge emerald">Full: {space.completeness.summary.full_depth}</span>
              <span className="badge indigo">Contract: {space.completeness.summary.contract_only_depth}</span>
              <span className="badge amber">Stubs: {space.completeness.summary.stub_systems}</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Unaccounted Surfaces</div>
            <div
              className="stat-value"
              style={{ color: space.completeness.summary.total_unaccounted_surfaces === 0 ? "var(--emerald)" : "var(--amber)" }}
            >
              {space.completeness.summary.total_unaccounted_surfaces}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Open Model Gaps</div>
            <div
              className="stat-value"
              style={{ color: space.gaps.length === 0 ? "var(--emerald)" : "var(--amber)" }}
            >
              {space.gaps.length}
            </div>
          </div>
        </div>

        {/* Component Coverage Ledger */}
        <div className="section-card">
          <div className="section-title">Component Accounting Ledger ({space.completeness.components.length})</div>
          {space.completeness.components.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>No components registered in this space yet.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 10 }}>
              {space.completeness.components.map((c) => (
                <div
                  key={c.component_id}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--bg)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <EntityLink id={c.component_id} onOpen={(id) => onOpenEntity(id)} />
                    <div style={{ display: "flex", gap: 5 }}>
                      <span className="badge indigo">{c.depth}</span>
                      <span className={`badge ${c.accounted_pct === 100 ? "emerald" : "amber"}`}>{c.accounted_pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: 5, borderRadius: 99, background: "var(--surface-muted)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${c.accounted_pct}%`,
                        height: "100%",
                        background: c.accounted_pct === 100 ? "#10b981" : "#f59e0b",
                        borderRadius: 99,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filterable Gaps Triage Queue */}
        <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "12px 16px",
              background: "var(--bg)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="section-title" style={{ margin: 0 }}>Explicit Gaps ({filteredGaps.length})</span>
              {kinds.length > 0 && (
                <div className="pill-group" style={{ boxShadow: "none" }}>
                  <button className={`icon-btn ${kindFilter === "ALL" ? "active" : ""}`} onClick={() => setKindFilter("ALL")}>
                    All ({space.gaps.length})
                  </button>
                  {kinds.map(([k, cnt]) => (
                    <button
                      key={k}
                      className={`icon-btn ${kindFilter === k ? "active" : ""}`}
                      onClick={() => setKindFilter(k)}
                    >
                      {k} ({cnt})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {space.gaps.length > 0 && (
              <div style={{ position: "relative", minWidth: 220 }}>
                <Search size={13} style={{ position: "absolute", left: 9, top: 10, color: "var(--text-faint)" }} />
                <input
                  className="search-input"
                  style={{ width: "100%", paddingLeft: 28, height: 32 }}
                  placeholder="Filter gaps…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            )}
          </div>

          {filteredGaps.length === 0 ? (
            <div style={{ padding: 18, display: "flex", alignItems: "center", gap: 8, color: "var(--emerald)", fontSize: 13.5, fontWeight: 600 }}>
              <CheckCircle2 size={16} />
              {space.gaps.length === 0
                ? "Zero open model gaps — 100% of scanned surfaces and owners are accounted for."
                : "No gaps match the current filter."}
            </div>
          ) : (
            <table className="gw-table">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Entity</th>
                  <th>Detail</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredGaps.map((g, i) => (
                  <tr key={i}>
                    <td>
                      <span className="badge amber">
                        <AlertTriangle size={11} /> {g.kind}
                      </span>
                    </td>
                    <td>
                      <EntityLink id={g.entity_id} variant="neutral" onOpen={(id) => onOpenEntity(id)} />
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{g.detail}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="secondary-btn"
                        style={{ padding: "4px 9px", fontSize: 11.5 }}
                        onClick={() => onOpenEntity(g.entity_id, g.kind.includes("surface") ? "code" : undefined)}
                      >
                        Inspect <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
