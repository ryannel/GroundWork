import ELK from "elkjs/lib/elk.bundled.js";
import { ArrowRight, KeyRound, Link2, Network, Search, Table2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { InteractiveViewport, type ContentBounds } from "./InteractiveViewport";

const elk = new ELK();

export interface DbColumnSpec {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly required?: boolean;
  readonly primaryKey?: boolean;
  readonly references?: string; // e.g. "users(id)"
  readonly refTable?: string; // e.g. "users"
  readonly notes?: string;
  readonly diffKind?: "added" | "modified" | "removed";
}

export interface DbTableSpec {
  readonly name: string;
  readonly schemaId?: string;
  readonly source: "authored" | "scanned" | "merged";
  readonly file?: string;
  readonly columns: readonly DbColumnSpec[];
  readonly hasPlanChange: boolean;
}

function formatTableSource(source: DbTableSpec["source"]): string {
  if (source === "merged") return "modeled + sql-ddl";
  return source === "authored" ? "modeled" : "scanned sql-ddl";
}

interface PositionedTable {
  readonly table: DbTableSpec;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface PositionedFkEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly fromCol: string;
  readonly points: readonly { x: number; y: number }[];
}

interface Props {
  tables: readonly DbTableSpec[];
  viewMode: "tables" | "er";
  onChangeViewMode: (mode: "tables" | "er") => void;
  selectedTableName?: string;
  onSelectTable: (tableName: string) => void;
  onInspectTable?: (tableName: string) => void;
}

function parseRefTable(ref?: string): string | undefined {
  if (!ref) return undefined;
  const cleaned = ref.replace(/^public\./i, "").trim();
  const m = cleaned.match(/^([a-zA-Z0-9_]+)/);
  return m?.[1];
}

/**
 * Modern 2026 Database Schema & ER Visualizer (Supabase Schema Visualizer / Drizzle Studio / ChartDB pattern):
 *  - Mode 1: Schema Tables (searchable master-detail with PK/FK badges, clickable FK jumps, Referenced By list)
 *  - Mode 2: Interactive ER Diagram (shared InteractiveViewport with trackpad pan/pinch-zoom + Full Screen)
 */
export function DatabaseSchemaView({
  tables,
  viewMode,
  onChangeViewMode,
  selectedTableName,
  onSelectTable,
  onInspectTable,
}: Props) {
  const [query, setQuery] = useState("");
  const [erNodes, setErNodes] = useState<PositionedTable[]>([]);
  const [erEdges, setErEdges] = useState<PositionedFkEdge[]>([]);
  const [erSelected, setErSelected] = useState<string | null>(selectedTableName ?? null);
  const [layoutSeq, setLayoutSeq] = useState(0);

  useEffect(() => {
    if (selectedTableName) setErSelected(selectedTableName);
  }, [selectedTableName]);

  const selectErTable = (name: string | null) => {
    setErSelected(name);
    if (name && name !== selectedTableName) {
      onSelectTable(name);
    }
  };

  const inspectInTablesView = (name: string) => {
    if (onInspectTable) {
      onInspectTable(name);
    } else {
      onSelectTable(name);
      onChangeViewMode("tables");
    }
  };

  const tableSet = useMemo(() => new Set(tables.map((t) => t.name)), [tables]);

  // Compute all normalized FK edges across tables
  const fkEdges = useMemo(() => {
    const out: Array<{ id: string; from: string; to: string; fromCol: string }> = [];
    for (const t of tables) {
      for (const c of t.columns) {
        const target = c.refTable ?? parseRefTable(c.references);
        if (target && tableSet.has(target) && target !== t.name) {
          out.push({ id: `${t.name}.${c.name}->${target}`, from: t.name, to: target, fromCol: c.name });
        }
      }
    }
    return out;
  }, [tables, tableSet]);

  // Incoming references by table name ("Referenced By")
  const referencedBy = useMemo(() => {
    const map = new Map<string, Array<{ table: string; column: string }>>();
    for (const e of fkEdges) {
      const arr = map.get(e.to) ?? [];
      arr.push({ table: e.from, column: e.fromCol });
      map.set(e.to, arr);
    }
    return map;
  }, [fkEdges]);

  const filteredTables = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q)),
    );
  }, [tables, query]);

  const activeTable =
    filteredTables.find((t) => t.name === selectedTableName) ??
    tables.find((t) => t.name === selectedTableName) ??
    filteredTables[0];

  // Run ELK layout (small schemas: layered; large star schemas > 8 tables: balanced 2D landscape grid with orthogonal/curved FK routing!)
  useEffect(() => {
    if (viewMode !== "er" || tables.length === 0) return;
    let cancelled = false;

    const CARD_W = 236;
    const ROW_H = 22;
    const HEADER_H = 36;
    const MAX_ROWS = tables.length > 10 ? 7 : 10;

    const cardHeight = (t: DbTableSpec) => {
      const shown = Math.min(t.columns.length, MAX_ROWS);
      const extra = t.columns.length > MAX_ROWS ? 22 : 0;
      return HEADER_H + Math.max(1, shown) * ROW_H + extra + 8;
    };

    const tableMap = new Map(tables.map((t) => [t.name, t]));
    const dedupeEdge = new Set<string>();
    const uniqueFks: Array<{ id: string; from: string; to: string; fromCol: string }> = [];
    for (const e of fkEdges) {
      const k = `${e.from}|${e.to}`;
      if (dedupeEdge.has(k)) continue;
      dedupeEdge.add(k);
      uniqueFks.push(e);
    }

    if (tables.length > 8) {
      // Balanced 2D landscape layout (Supabase / ChartDB style): sort hub tables first, pack into ~16:9 columns
      const degree = new Map<string, number>();
      for (const e of uniqueFks) {
        degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
        degree.set(e.to, (degree.get(e.to) ?? 0) + 2);
      }
      const ordered = [...tables].sort((a, b) => (degree.get(b.name) ?? 0) - (degree.get(a.name) ?? 0) || a.name.localeCompare(b.name));

      const cols = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(ordered.length * 1.4))));
      const colGap = 54;
      const rowGap = 44;
      const colBottomY = new Array<number>(cols).fill(24);
      const positioned: PositionedTable[] = [];
      const posByName = new Map<string, PositionedTable>();

      for (const tbl of ordered) {
        // Place in the shortest column for balanced vertical rhythm
        let bestCol = 0;
        for (let c = 1; c < cols; c++) {
          if (colBottomY[c]! < colBottomY[bestCol]!) bestCol = c;
        }
        const x = 24 + bestCol * (CARD_W + colGap);
        const y = colBottomY[bestCol]!;
        const h = cardHeight(tbl);
        const pt: PositionedTable = { table: tbl, x, y, width: CARD_W, height: h };
        positioned.push(pt);
        posByName.set(tbl.name, pt);
        colBottomY[bestCol] = y + h + rowGap;
      }

      const routed: PositionedFkEdge[] = [];
      for (const e of uniqueFks) {
        const src = posByName.get(e.from);
        const dst = posByName.get(e.to);
        if (!src || !dst) continue;
        const srcCx = src.x + src.width / 2;
        const dstCx = dst.x + dst.width / 2;
        const x1 = srcCx <= dstCx ? src.x + src.width : src.x;
        const y1 = src.y + 44;
        const x2 = srcCx <= dstCx ? dst.x : dst.x + dst.width;
        const y2 = dst.y + 36;
        const midX = x1 === x2 ? x1 - 24 : (x1 + x2) / 2;
        routed.push({
          id: e.id,
          from: e.from,
          to: e.to,
          fromCol: e.fromCol,
          points: [
            { x: x1, y: y1 },
            { x: midX, y: y1 },
            { x: midX, y: y2 },
            { x: x2, y: y2 },
          ],
        });
      }

      setErNodes(positioned);
      setErEdges(routed);
      setLayoutSeq((s) => s + 1);
      return;
    }

    const graph = {
      id: "er-root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.spacing.nodeNode": "34",
        "elk.layered.spacing.nodeNodeBetweenLayers": "68",
        "elk.separateConnectedComponents": "true",
      },
      children: tables.map((t) => ({ id: t.name, width: CARD_W, height: cardHeight(t) })),
      edges: uniqueFks.map((e) => ({ id: e.id, sources: [e.from], targets: [e.to] })),
    };

    elk.layout(graph as never).then((res) => {
      if (cancelled) return;
      const positioned: PositionedTable[] = [];
      for (const ch of (res.children ?? []) as Array<{ id: string; x?: number; y?: number; width?: number; height?: number }>) {
        const tbl = tableMap.get(ch.id);
        if (!tbl) continue;
        positioned.push({
          table: tbl,
          x: ch.x ?? 0,
          y: ch.y ?? 0,
          width: ch.width ?? CARD_W,
          height: ch.height ?? 140,
        });
      }

      const edgeMeta = new Map(uniqueFks.map((e) => [e.id, e]));
      const routed: PositionedFkEdge[] = [];
      for (const raw of (res.edges ?? []) as Array<{
        id: string;
        sections?: Array<{ startPoint: { x: number; y: number }; bendPoints?: Array<{ x: number; y: number }>; endPoint: { x: number; y: number } }>;
      }>) {
        const em = edgeMeta.get(raw.id);
        const sec = raw.sections?.[0];
        if (!em || !sec) continue;
        routed.push({
          id: raw.id,
          from: em.from,
          to: em.to,
          fromCol: em.fromCol,
          points: [sec.startPoint, ...(sec.bendPoints ?? []), sec.endPoint],
        });
      }

      setErNodes(positioned);
      setErEdges(routed);
      setLayoutSeq((s) => s + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [viewMode, tables, fkEdges]);

  const erBounds = useMemo<ContentBounds>(() => {
    if (erNodes.length === 0) return { minX: 0, minY: 0, width: 900, height: 500 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of erNodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    return { minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }, [erNodes]);

  const erHighlightSet = useMemo(() => {
    if (!erSelected) return null;
    const s = new Set<string>([erSelected]);
    for (const e of erEdges) {
      if (e.from === erSelected || e.to === erSelected) {
        s.add(e.from);
        s.add(e.to);
      }
    }
    return s;
  }, [erSelected, erEdges]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Segmented View Mode Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div className="pill-group">
          <button
            className={`icon-btn ${viewMode === "tables" ? "active" : ""}`}
            onClick={() => onChangeViewMode("tables")}
          >
            <Table2 size={14} /> Schema Tables ({tables.length})
          </button>
          <button
            className={`icon-btn ${viewMode === "er" ? "active" : ""}`}
            onClick={() => onChangeViewMode("er")}
          >
            <Network size={14} /> ER Diagram ({fkEdges.length} relationships)
          </button>
        </div>

        {viewMode === "er" && erSelected && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="badge indigo mono">Focused: {erSelected}</span>
            <button
              className="secondary-btn"
              style={{ padding: "5px 10px", fontSize: 12 }}
              onClick={() => inspectInTablesView(erSelected)}
            >
              Open in Schema Tables <ArrowRight size={13} />
            </button>
            <button className="icon-btn" onClick={() => setErSelected(null)}>
              Clear Focus
            </button>
          </div>
        )}
      </div>

      {/* Mode 1: Schema Tables (Supabase / Drizzle Studio Master-Detail) */}
      {viewMode === "tables" ? (
        <div style={{ display: "grid", gridTemplateColumns: "290px minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
          <div className="section-card" style={{ padding: 12, position: "sticky", top: 12 }}>
            <div className="section-title">Tables ({tables.length})</div>
            <div style={{ position: "relative", marginBottom: 10 }}>
              <Search size={13} style={{ position: "absolute", left: 9, top: 10, color: "var(--text-faint)" }} />
              <input
                className="search-input"
                style={{ width: "100%", paddingLeft: 28, height: 32 }}
                placeholder="Filter tables or columns…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 520, overflowY: "auto" }}>
              {filteredTables.map((t) => {
                const isSel = activeTable?.name === t.name;
                const fkCount = t.columns.filter((c) => Boolean(c.references || c.refTable)).length;
                return (
                  <button
                    key={t.name}
                    onClick={() => onSelectTable(t.name)}
                    style={{
                      textAlign: "left",
                      padding: "7px 10px",
                      borderRadius: 7,
                      border: isSel ? "1.5px solid var(--accent)" : "1px solid transparent",
                      background: isSel ? "var(--accent-soft)" : "transparent",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span className="mono" style={{ fontWeight: isSel ? 700 : 500, color: isSel ? "var(--accent)" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.name}
                    </span>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {t.hasPlanChange && <span className="badge emerald">+ plan</span>}
                      {fkCount > 0 && (
                        <span className="badge" title={`${fkCount} foreign keys`}>
                          <Link2 size={10} /> {fkCount}
                        </span>
                      )}
                      <span className="badge">{t.columns.length}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {activeTable ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
              <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
                <div
                  style={{
                    padding: "14px 16px",
                    background: "var(--bg)",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Table2 size={16} color="#4f46e5" />
                      <span className="mono" style={{ fontWeight: 800, fontSize: 16 }}>{activeTable.name}</span>
                      <span className="badge">{formatTableSource(activeTable.source)}</span>
                      <span className="badge">{activeTable.columns.length} {activeTable.columns.length === 1 ? "column" : "columns"}</span>
                    </div>
                    {(activeTable.schemaId || activeTable.file) && (
                      <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
                        {activeTable.schemaId && activeTable.file
                          ? `${activeTable.schemaId} · ${activeTable.file}`
                          : activeTable.schemaId ?? `Source: ${activeTable.file}`}
                      </div>
                    )}
                  </div>
                  <button
                    className="secondary-btn"
                    style={{ fontSize: 12, padding: "5px 10px" }}
                    onClick={() => {
                      setErSelected(activeTable.name);
                      onChangeViewMode("er");
                    }}
                  >
                    <Network size={13} /> View in ER Diagram
                  </button>
                </div>

                <table className="gw-table">
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Data Type</th>
                      <th>Nullability</th>
                      <th>Keys &amp; Foreign Keys</th>
                      {activeTable.hasPlanChange && <th>Plan Diff</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTable.columns.map((col) => {
                      const targetTable = col.refTable ?? parseRefTable(col.references);
                      const canJump = Boolean(targetTable && tableSet.has(targetTable));
                      return (
                        <tr
                          key={col.id}
                          style={
                            col.diffKind === "added"
                              ? { background: "var(--emerald-soft)" }
                              : col.diffKind === "modified"
                                ? { background: "var(--amber-soft)" }
                                : undefined
                          }
                        >
                          <td className="mono" style={{ fontWeight: col.primaryKey || col.diffKind ? 700 : 500 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {col.primaryKey && <KeyRound size={12} color="var(--amber)" />}
                              <span>{col.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className="mono" style={{ fontSize: 11.5, background: "var(--accent-soft)", color: "var(--accent)", padding: "2px 7px", borderRadius: 4 }}>
                              {col.type}
                            </span>
                          </td>
                          <td>
                            {col.required === undefined ? (
                              <span style={{ color: "var(--text-faint)" }}>—</span>
                            ) : col.required ? (
                              <span className="badge" style={{ background: "var(--surface-muted)", color: "var(--text)" }}>NOT NULL</span>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--text-faint)" }}>nullable</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              {col.primaryKey && <span className="badge amber">PK</span>}
                              {col.references &&
                                (canJump && targetTable ? (
                                  <button
                                    className="entity-link"
                                    style={{ padding: "2px 7px", fontSize: 11 }}
                                    onClick={() => onSelectTable(targetTable)}
                                    title={`Jump to table ${targetTable}`}
                                  >
                                    <Link2 size={11} /> FK → {col.references}
                                  </button>
                                ) : (
                                  <span className="badge indigo mono">FK → {col.references}</span>
                                ))}
                              {col.notes && !col.references && !col.primaryKey && (
                                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{col.notes}</span>
                              )}
                              {!col.primaryKey && !col.references && !col.notes && (
                                <span style={{ color: "var(--text-faint)" }}>—</span>
                              )}
                            </div>
                          </td>
                          {activeTable.hasPlanChange && (
                            <td>
                              {col.diffKind && (
                                <span className={`badge ${col.diffKind === "added" ? "emerald" : col.diffKind === "modified" ? "amber" : "rose"}`}>
                                  {col.diffKind === "added" ? "+ Added" : col.diffKind}
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Referenced By (Incoming Foreign Keys) */}
              {(referencedBy.get(activeTable.name)?.length ?? 0) > 0 && (
                <div className="section-card">
                  <div className="section-title">
                    Referenced By ({referencedBy.get(activeTable.name)!.length} {referencedBy.get(activeTable.name)!.length === 1 ? "table" : "tables"})
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {referencedBy.get(activeTable.name)!.map((ref) => (
                      <button
                        key={`${ref.table}.${ref.column}`}
                        className="entity-link neutral"
                        onClick={() => onSelectTable(ref.table)}
                      >
                        <Table2 size={12} /> {ref.table}.{ref.column}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="section-card" style={{ color: "var(--text-faint)" }}>No tables match your filter.</div>
          )}
        </div>
      ) : (
        /* Mode 2: Interactive ER Diagram + In-Place Table Columns Drawer */
        (() => {
          const erFocusedTable = erSelected ? tables.find((t) => t.name === erSelected) ?? null : null;
          const erFocusedRefs = erFocusedTable ? (referencedBy.get(erFocusedTable.name) ?? []) : [];
          const erInspectorPanel = erFocusedTable ? (
            <aside
              style={{
                width: 340,
                flexShrink: 0,
                height: 640,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div className="inspector-header" style={{ padding: "12px 14px" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Table2 size={14} color="var(--accent)" />
                    <span className="mono" style={{ fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {erFocusedTable.name}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                    <span className="badge">{erFocusedTable.columns.length} {erFocusedTable.columns.length === 1 ? "column" : "columns"}</span>
                    <span className="badge">{formatTableSource(erFocusedTable.source)}</span>
                  </div>
                </div>
                <button className="icon-btn" onClick={() => setErSelected(null)} title="Close table details">
                  <X size={15} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div className="section-title" style={{ marginBottom: 6 }}>All Columns ({erFocusedTable.columns.length})</div>
                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    {erFocusedTable.columns.map((c, idx) => {
                      const targetTbl = c.refTable ?? parseRefTable(c.references);
                      const canJump = Boolean(targetTbl && tableSet.has(targetTbl));
                      return (
                        <div
                          key={c.id}
                          style={{
                            padding: "6px 10px",
                            borderBottom: idx < erFocusedTable.columns.length - 1 ? "1px solid var(--border)" : "none",
                            background: c.diffKind === "added" ? "var(--emerald-soft)" : "transparent",
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                              {c.primaryKey && <KeyRound size={11} color="var(--amber)" style={{ flexShrink: 0 }} />}
                              {!c.primaryKey && c.references && <Link2 size={11} color="var(--accent)" style={{ flexShrink: 0 }} />}
                              <span className="mono" style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {c.name}
                              </span>
                            </span>
                            <span className="mono" style={{ fontSize: 10.5, color: "var(--accent)", background: "var(--accent-soft)", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>
                              {c.type}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            {c.required && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)" }}>NOT NULL</span>}
                            {c.primaryKey && <span className="badge amber" style={{ fontSize: 9.5, padding: "0 5px" }}>PK</span>}
                            {c.references && canJump && targetTbl && (
                              <button
                                type="button"
                                className="entity-link"
                                style={{ fontSize: 10.5, padding: "1px 6px" }}
                                onClick={() => selectErTable(targetTbl)}
                                title={`Focus ${targetTbl} in ER Diagram`}
                              >
                                <Link2 size={10} /> FK → {c.references}
                              </button>
                            )}
                            {c.diffKind && (
                              <span className="badge emerald" style={{ fontSize: 9.5, padding: "0 5px" }}>+ Added</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {erFocusedRefs.length > 0 && (
                  <div>
                    <div className="section-title" style={{ marginBottom: 6 }}>Referenced By ({erFocusedRefs.length})</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {erFocusedRefs.map((ref) => (
                        <button
                          key={`${ref.table}.${ref.column}`}
                          type="button"
                          className="entity-link neutral"
                          style={{ fontSize: 11, padding: "2px 7px" }}
                          onClick={() => selectErTable(ref.table)}
                        >
                          {ref.table}.{ref.column}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
                <button
                  type="button"
                  className="primary-btn"
                  style={{ width: "100%", justifyContent: "center", fontSize: 12 }}
                  onClick={() => inspectInTablesView(erFocusedTable.name)}
                >
                  Open in Schema Tables <ArrowRight size={13} />
                </button>
              </div>
            </aside>
          ) : null;

          return (
            <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
              <InteractiveViewport
                bounds={erBounds}
                fitKey={layoutSeq}
                minZoom={0.18}
                maxFitZoom={1.0}
                fullscreenSide={erInspectorPanel}
                style={{ flex: 1, height: 640, borderRadius: 12, border: "1px solid var(--border)" }}
                hint="Two-finger pan · Pinch to zoom · Click any table to inspect all columns & relationships"
                svgDefs={
                  <defs>
                    <marker id="er-fk-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
                    </marker>
                    <marker id="er-fk-muted" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#94a3b8" />
                    </marker>
                  </defs>
                }
                legend={
                  <>
                    <span className="legend-item"><KeyRound size={11} color="#d97706" /> Primary Key</span>
                    <span className="legend-item"><Link2 size={11} color="#4f46e5" /> Foreign Key</span>
                    <span className="legend-item"><span className="legend-line" style={{ background: "#6366f1" }} /> FK Relationship</span>
                  </>
                }
              >
                {/* Relationship Edges */}
                {erEdges.map((edge) => {
                  const isHighlighted = !erHighlightSet || (erHighlightSet.has(edge.from) && erHighlightSet.has(edge.to));
                  const isActiveEdge = erSelected === edge.from || erSelected === edge.to;
                  const d = edge.points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                  return (
                    <path
                      key={edge.id}
                      d={d}
                      fill="none"
                      stroke={isActiveEdge ? "#4f46e5" : "#94a3b8"}
                      strokeWidth={isActiveEdge ? 2.2 : 1.4}
                      opacity={isHighlighted ? 0.9 : 0.14}
                      markerEnd={isActiveEdge ? "url(#er-fk-arrow)" : "url(#er-fk-muted)"}
                    />
                  );
                })}

                {/* Modern dbdiagram / Supabase Table Cards */}
                {erNodes.map((node) => {
                  const t = node.table;
                  const isSel = erSelected === t.name;
                  const dimmed = erHighlightSet !== null && !erHighlightSet.has(t.name);
                  const maxRows = tables.length > 10 ? 7 : 10;
                  const shownCols = t.columns.slice(0, maxRows);
                  const overflow = t.columns.length - shownCols.length;
                  return (
                    <foreignObject key={t.name} x={node.x} y={node.y} width={node.width} height={node.height}>
                      <div
                        data-no-pan
                        onClick={() => selectErTable(erSelected === t.name ? null : t.name)}
                        onDoubleClick={() => inspectInTablesView(t.name)}
                        style={{
                          width: "100%",
                          height: "100%",
                          background: "var(--surface)",
                          border: isSel ? "2px solid var(--accent)" : "1.5px solid var(--border-strong)",
                          borderRadius: 10,
                          overflow: "hidden",
                          opacity: dimmed ? 0.22 : 1,
                          boxShadow: isSel ? "0 0 0 4px rgba(99,102,241,0.2)" : "var(--shadow-sm)",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                        }}
                        title="Click to inspect all columns & relationships · Double-click for full table view"
                      >
                        <div
                          style={{
                            padding: "8px 10px",
                            background: isSel ? "#4f46e5" : "var(--er-header-bg)",
                            color: "var(--er-header-text)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 6,
                          }}
                        >
                          <span className="mono" style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.name}
                          </span>
                          <span style={{ fontSize: 10, opacity: 0.8 }}>{t.columns.length}</span>
                        </div>

                        <div style={{ flex: 1, padding: "4px 0" }}>
                          {shownCols.map((c) => (
                            <div
                              key={c.id}
                              style={{
                                height: 24,
                                padding: "0 10px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 6,
                                fontSize: 11,
                                background: c.diffKind === "added" ? "var(--emerald-soft)" : "transparent",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                                {c.primaryKey ? (
                                  <KeyRound size={10} color="var(--amber)" style={{ flexShrink: 0 }} />
                                ) : c.references ? (
                                  <Link2 size={10} color="var(--accent)" style={{ flexShrink: 0 }} />
                                ) : (
                                  <span style={{ width: 10, display: "inline-block" }} />
                                )}
                                <span
                                  className="mono"
                                  style={{
                                    fontWeight: c.primaryKey || c.diffKind ? 700 : 500,
                                    color: c.diffKind === "added" ? "var(--emerald)" : "var(--text)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {c.name}
                                </span>
                              </div>
                              <span className="mono" style={{ fontSize: 10, color: "var(--text-faint)", flexShrink: 0 }}>
                                {c.type.length > 12 ? c.type.slice(0, 11) + "…" : c.type}
                              </span>
                            </div>
                          ))}
                          {overflow > 0 && (
                            <div style={{ padding: "2px 10px", fontSize: 10.5, color: "var(--accent)", fontWeight: 600 }}>
                              +{overflow} more {overflow === 1 ? "column" : "columns"} — click to view all
                            </div>
                          )}
                        </div>
                      </div>
                    </foreignObject>
                  );
                })}
              </InteractiveViewport>
              {erInspectorPanel}
            </div>
          );
        })()
      )}
    </div>
  );
}
