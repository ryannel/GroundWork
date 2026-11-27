import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GitFork,
  KeyRound,
  Link2,
  Search,
  Table2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ComponentEndpointSummary } from "../../utils/spaceLookup";
import { EndpointSpecCard, methodColor, type RichEndpointSpec } from "./ApiReferenceView";
import type { DbTableSpec } from "./DatabaseSchemaView";

interface EndpointExplorerProps {
  summary: ComponentEndpointSummary;
  onOpenEndpoint: (endpointKey: string) => void;
  onOpenAllApis?: () => void;
}

/**
 * Reusable compact API explorer for both InspectorDrawer (System Map) and QuickPeekDrawer (Flows / Plan Walkthrough).
 * Displays EVERY resource group (AI, Meetings, Notes, People, Tasks, etc.), allows 1-click direct navigation
 * straight to any endpoint's full API Reference spec, AND supports inline schema expansion in place.
 */
export function DrawerEndpointExplorer({ summary, onOpenEndpoint, onOpenAllApis }: EndpointExplorerProps) {
  const [query, setQuery] = useState("");
  const [showTriaged, setShowTriaged] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [peekedEndpointKey, setPeekedEndpointKey] = useState<string | null>(null);

  const visibleEndpoints = useMemo(() => {
    const base = showTriaged || summary.business.length === 0 ? summary.all : summary.business;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (e) =>
        e.path.toLowerCase().includes(q) ||
        e.group.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.method.toLowerCase().includes(q),
    );
  }, [summary, showTriaged, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, RichEndpointSpec[]>();
    for (const ep of visibleEndpoints) {
      const arr = map.get(ep.group) ?? [];
      arr.push(ep);
      map.set(ep.group, arr);
    }
    return [...map.entries()];
  }, [visibleEndpoints]);

  // Smart default expansion: expand all when compact (<= 10 endpoints), otherwise expand the first group so all
  // other domain groups (AI, Meetings, Notes, People, Tasks, ...) remain visible immediately without scrolling!
  useEffect(() => {
    if (summary.displayCount <= 10) {
      setExpandedGroups(new Set(summary.groups.map((g) => g.name)));
      if (summary.displayCount <= 2 && summary.groups[0]?.endpoints[0]) {
        setPeekedEndpointKey(summary.groups[0].endpoints[0].key);
      } else {
        setPeekedEndpointKey(null);
      }
    } else {
      const first = summary.groups[0]?.name;
      setExpandedGroups(first ? new Set([first]) : new Set());
      setPeekedEndpointKey(null);
    }
  }, [summary]);

  if (summary.all.length === 0) {
    return (
      <div className="section-card" style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
        No API endpoints recorded for this entity yet.
      </div>
    );
  }

  const isSearching = query.trim().length > 0;
  const allExpanded = grouped.length > 0 && grouped.every(([name]) => expandedGroups.has(name));

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Search + Controls */}
      {summary.all.length > 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: 10, color: "var(--text-faint)" }} />
            <input
              className="search-input"
              style={{ width: "100%", paddingLeft: 28, height: 32, fontSize: 12 }}
              placeholder={`Filter ${summary.displayCount} endpoints (meetings, people, tasks…)`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
              {grouped.length} {grouped.length === 1 ? "group" : "groups"} · click any route for full spec
            </span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {grouped.length > 1 && !isSearching && (
                <button
                  type="button"
                  className="icon-btn"
                  style={{ fontSize: 11, padding: "2px 7px", border: "1px solid var(--border)" }}
                  onClick={() =>
                    setExpandedGroups(allExpanded ? new Set() : new Set(grouped.map(([name]) => name)))
                  }
                >
                  {allExpanded ? "Collapse all" : "Expand all"}
                </button>
              )}
              {summary.triagedCount > 0 && summary.business.length > 0 && (
                <button
                  type="button"
                  className={`icon-btn ${showTriaged ? "active" : ""}`}
                  style={{ fontSize: 11, padding: "2px 7px", border: "1px solid var(--border)" }}
                  onClick={() => setShowTriaged((v) => !v)}
                  title="Toggle triaged/internal/health routes"
                >
                  {showTriaged ? <EyeOff size={11} /> : <Eye size={11} />}
                  {showTriaged ? "Hide" : `+${summary.triagedCount} triaged`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="section-card" style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
          No endpoints match “{query}”.
        </div>
      ) : (
        grouped.map(([groupName, eps]) => {
          const isOpen = isSearching || expandedGroups.has(groupName);
          const firstEp = eps[0]!;
          const distinctMethods = [...new Set(eps.map((e) => e.method))].slice(0, 4);
          return (
            <div key={groupName} className="section-card" style={{ padding: 0, overflow: "hidden" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 6,
                  padding: "8px 10px",
                  background: "var(--bg)",
                  borderBottom: isOpen ? "1px solid var(--border)" : "none",
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(groupName)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    color: "var(--text)",
                    textAlign: "left",
                  }}
                >
                  {isOpen ? (
                    <ChevronDown size={13} color="var(--text-faint)" style={{ flexShrink: 0 }} />
                  ) : (
                    <ChevronRight size={13} color="var(--text-faint)" style={{ flexShrink: 0 }} />
                  )}
                  <span style={{ fontWeight: 700, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {groupName}
                  </span>
                  <span className="badge" style={{ fontSize: 10, padding: "1px 6px", flexShrink: 0 }}>
                    {eps.length}
                  </span>
                  {!isOpen && (
                    <span style={{ display: "flex", gap: 3, marginLeft: 4, overflow: "hidden" }}>
                      {distinctMethods.map((m) => {
                        const mc = methodColor(m);
                        return (
                          <span
                            key={m}
                            className="mono"
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: "0px 4px",
                              borderRadius: 3,
                              background: mc.bg,
                              color: mc.fg,
                            }}
                          >
                            {m}
                          </span>
                        );
                      })}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className="icon-btn"
                  style={{ padding: "3px 6px", fontSize: 11, flexShrink: 0 }}
                  onClick={() => onOpenEndpoint(firstEp.key)}
                  title={`Open ${groupName} endpoints in full API Reference`}
                >
                  <ArrowUpRight size={12} />
                </button>
              </div>

              {isOpen && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {eps.map((ep, idx) => {
                    const mc = methodColor(ep.method);
                    const isPeeked = peekedEndpointKey === ep.key;
                    return (
                      <div
                        key={ep.key}
                        style={{
                          borderBottom: idx < eps.length - 1 ? "1px solid var(--border)" : "none",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 8px",
                            background: isPeeked ? "var(--accent-soft)" : "transparent",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setPeekedEndpointKey(isPeeked ? null : ep.key)}
                            className="icon-btn"
                            style={{ padding: 3, flexShrink: 0 }}
                            title={isPeeked ? "Hide inline schema" : "Peek parameters & response inline"}
                          >
                            {isPeeked ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenEndpoint(ep.key)}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              display: "flex",
                              alignItems: "center",
                              gap: 7,
                              background: "transparent",
                              border: "none",
                              padding: "2px 0",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                            title={`Open ${ep.method} ${ep.path} in Full API Reference`}
                          >
                            <span
                              className="mono"
                              style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                padding: "1px 5px",
                                borderRadius: 4,
                                minWidth: 38,
                                textAlign: "center",
                                background: mc.bg,
                                color: mc.fg,
                                flexShrink: 0,
                              }}
                            >
                              {ep.method}
                            </span>
                            <span
                              className="mono"
                              style={{
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: "var(--text)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                              }}
                            >
                              {ep.path}
                            </span>
                            {ep.hasPlanChange && (
                              <span
                                style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--emerald)", flexShrink: 0 }}
                                title="Modified in Plan"
                              />
                            )}
                            <ArrowUpRight size={12} color="var(--text-faint)" style={{ flexShrink: 0 }} />
                          </button>
                        </div>

                        {isPeeked && (
                          <div style={{ padding: "8px 10px 10px 10px", background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
                            <EndpointSpecCard
                              endpoint={ep}
                              onOpenFullEndpoint={() => onOpenEndpoint(ep.key)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {onOpenAllApis && (
        <button
          type="button"
          className="secondary-btn"
          style={{ width: "100%", justifyContent: "center", fontSize: 12 }}
          onClick={onOpenAllApis}
        >
          Open Full 3-Pane API Reference ({summary.displayCount}) <ArrowUpRight size={13} />
        </button>
      )}
    </div>
  );
}

interface TableExplorerProps {
  tables: readonly DbTableSpec[];
  onOpenTable: (tableName: string) => void;
  onOpenErDiagram: () => void;
}

/**
 * Reusable compact Database Table explorer for InspectorDrawer & QuickPeekDrawer.
 * Shows ALL tables (authored + scanned SQL DDL), inline column peek, 1-click jump to any table,
 * and 1-click jump to the interactive ER Diagram.
 */
export function DrawerTableExplorer({ tables, onOpenTable, onOpenErDiagram }: TableExplorerProps) {
  const [query, setQuery] = useState("");
  const [peekedTable, setPeekedTable] = useState<string | null>(() => (tables.length <= 3 ? tables[0]?.name ?? null : null));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q)),
    );
  }, [tables, query]);

  if (tables.length === 0) {
    return (
      <div className="section-card" style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
        No tables documented or scanned for this database yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {tables.length > 3 && (
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: 10, color: "var(--text-faint)" }} />
            <input
              className="search-input"
              style={{ width: "100%", paddingLeft: 28, height: 32, fontSize: 12 }}
              placeholder={`Filter ${tables.length} tables or columns…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}
        <button
          type="button"
          className="secondary-btn"
          style={{ padding: "5px 10px", fontSize: 11.5, flexShrink: 0 }}
          onClick={onOpenErDiagram}
          title="Open interactive Entity Relationship Diagram"
        >
          <GitFork size={12} /> ER Diagram <ArrowUpRight size={11} />
        </button>
      </div>

      <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 12, fontSize: 12.5, color: "var(--text-faint)" }}>No tables match “{query}”.</div>
        ) : (
          filtered.map((tbl, idx) => {
            const isPeeked = peekedTable === tbl.name;
            const fkCount = tbl.columns.filter((c) => Boolean(c.references)).length;
            return (
              <div
                key={tbl.name}
                style={{ borderBottom: idx < filtered.length - 1 ? "1px solid var(--border)" : "none" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 8px",
                    background: isPeeked ? "var(--accent-soft)" : "transparent",
                  }}
                >
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ padding: 3, flexShrink: 0 }}
                    onClick={() => setPeekedTable(isPeeked ? null : tbl.name)}
                    title={isPeeked ? "Hide columns" : "Peek columns inline"}
                  >
                    {isPeeked ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenTable(tbl.name)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      background: "transparent",
                      border: "none",
                      padding: "2px 0",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    title={`Open table "${tbl.name}" in Full Database View`}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <Table2 size={12} color="var(--teal)" style={{ flexShrink: 0 }} />
                      <span
                        className="mono"
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tbl.name}
                      </span>
                      {tbl.hasPlanChange && (
                        <span className="badge emerald" style={{ fontSize: 9.5, padding: "0px 5px" }}>
                          + Plan
                        </span>
                      )}
                    </span>

                    <span style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                      {fkCount > 0 && (
                        <span className="badge indigo" style={{ fontSize: 9.5, padding: "0px 5px" }}>
                          {fkCount} FK
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{tbl.columns.length} cols</span>
                      <ArrowUpRight size={12} color="var(--text-faint)" />
                    </span>
                  </button>
                </div>

                {isPeeked && (
                  <div style={{ padding: "6px 12px 10px 28px", background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
                    {tbl.columns.slice(0, 12).map((col) => (
                      <div
                        key={col.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 6,
                          padding: "3px 0",
                          fontSize: 11.5,
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                          {col.primaryKey && <KeyRound size={10} color="var(--amber)" />}
                          {col.references && <Link2 size={10} color="var(--accent)" />}
                          <span className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>
                            {col.name}
                          </span>
                          {col.diffKind && (
                            <span className="badge emerald" style={{ fontSize: 9, padding: "0 4px" }}>
                              +{col.diffKind}
                            </span>
                          )}
                        </span>
                        <span className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                          {col.type}
                        </span>
                      </div>
                    ))}
                    {tbl.columns.length > 12 && (
                      <button
                        type="button"
                        className="entity-link"
                        style={{ marginTop: 6, fontSize: 11 }}
                        onClick={() => onOpenTable(tbl.name)}
                      >
                        +{tbl.columns.length - 12} more columns · Open table <ArrowUpRight size={11} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
