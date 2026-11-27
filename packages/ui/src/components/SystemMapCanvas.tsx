import ELK from "elkjs/lib/elk.bundled.js";
import { Box, ChevronsDownUp, ChevronsUpDown, Database, Eye, Globe, Layers, MessageSquare, Server, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DerivedEdge, LoadedExternal, LoadedSystem, SpacePayload, StoreFile, TopicFile } from "../types";
import { InteractiveViewport, type ContentBounds } from "./shared/InteractiveViewport";

const elk = new ELK();

interface GraphNodeMeta {
  readonly id: string;
  readonly kind: "system" | "service" | "app" | "module" | "store" | "topic" | "external" | "unassigned";
  readonly title: string;
  readonly subtitle: string;
  readonly mapped?: boolean;
  readonly badge?: string;
  readonly countText?: string;
  readonly expandable?: boolean;
  readonly expanded?: boolean;
  readonly diffKind?: "added" | "modified" | "removed";
}

interface PositionedNode {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly meta: GraphNodeMeta;
  readonly isContainer?: boolean;
}

interface PositionedEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: string;
  readonly label?: string;
  readonly count?: number;
  readonly points: readonly { x: number; y: number }[];
}

interface Props {
  systems: readonly LoadedSystem[];
  externals: readonly LoadedExternal[];
  unassignedStores: readonly StoreFile[];
  unassignedTopics: readonly TopicFile[];
  edges: readonly DerivedEdge[];
  evidence?: SpacePayload["evidence"];
  componentCodeInfo?: SpacePayload["component_code_info"];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenFullView?: (id: string) => void;
  expandedSystems: ReadonlySet<string>;
  onToggleExpand: (systemId: string) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  diffByEntity?: ReadonlyMap<string, "added" | "modified" | "removed">;
}

function plural(n: number, singular: string, pluralWord = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralWord}`;
}

function edgeColor(kind: string): { stroke: string; dash?: string } {
  switch (kind) {
    case "call":
      return { stroke: "#4f46e5" };
    case "depends":
      return { stroke: "#0284c7" };
    case "publish":
    case "consume":
      return { stroke: "#7c3aed", dash: "6 4" };
    case "read":
    case "write":
      return { stroke: "#0d9488" };
    case "unresolved_call":
    case "observed":
      return { stroke: "#d97706", dash: "3 4" };
    default:
      return { stroke: "#64748b" };
  }
}

function NodeIcon({ kind }: { kind: GraphNodeMeta["kind"] }) {
  switch (kind) {
    case "system":
      return <Layers size={12} />;
    case "service":
      return <Server size={12} />;
    case "app":
      return <Smartphone size={12} />;
    case "store":
    case "unassigned":
      return <Database size={12} />;
    case "topic":
      return <MessageSquare size={12} />;
    case "external":
      return <Globe size={12} />;
    default:
      return <Box size={12} />;
  }
}

export function SystemMapCanvas({
  systems,
  externals,
  unassignedStores,
  unassignedTopics,
  edges,
  evidence,
  componentCodeInfo,
  selectedId,
  onSelect,
  onOpenFullView,
  expandedSystems,
  onToggleExpand,
  onExpandAll,
  onCollapseAll,
  diffByEntity,
}: Props) {
  const [nodes, setNodes] = useState<PositionedNode[]>([]);
  const [routedEdges, setRoutedEdges] = useState<PositionedEdge[]>([]);
  const [isolateEgo, setIsolateEgo] = useState(false);
  const [directDepsOnly, setDirectDepsOnly] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [layoutSeq, setLayoutSeq] = useState(0);

  const bounds = useMemo<ContentBounds>(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, width: 800, height: 500 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    return {
      minX,
      minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }, [nodes]);

  const scannedTableNames = useMemo(() => {
    const set = new Set<string>();
    for (const ev of Object.values(evidence ?? {})) {
      for (const s of ev.inventory?.surfaces ?? []) {
        if (s.kind === "table") set.add(s.symbol ?? s.surface_id);
      }
    }
    return set;
  }, [evidence]);

  const incomingCountByComp = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    for (const e of edges) {
      let s = counts.get(e.to);
      if (!s) {
        s = new Set();
        counts.set(e.to, s);
      }
      s.add(e.from);
    }
    return counts;
  }, [edges]);

  const visibleModel = useMemo(() => {
    const metaById = new Map<string, GraphNodeMeta>();
    const compToVisible = new Map<string, string>();
    const elkChildren: Array<Record<string, unknown>> = [];

    for (const sys of systems) {
      const isExpanded = expandedSystems.has(sys.id) && sys.components.length + sys.stores.length + sys.topics.length > 0;
      const totalChildren = sys.components.length + sys.stores.length + sys.topics.length;
      const sysDiff = diffByEntity?.get(sys.id);

      metaById.set(sys.id, {
        id: sys.id,
        kind: "system",
        title: sys.system.name,
        subtitle: sys.system.purpose,
        mapped: sys.system.mapped,
        badge: sys.system.mapped ? sys.system.domain?.replace(/^domain:/, "") : "unmapped stub",
        countText: sys.system.mapped ? plural(totalChildren, "component") : "consumer-observed",
        expandable: totalChildren > 0,
        expanded: isExpanded,
        diffKind: sysDiff,
      });

      if (!isExpanded) {
        compToVisible.set(sys.id, sys.id);
        for (const c of sys.components) compToVisible.set(c.id, sys.id);
        for (const s of sys.stores) compToVisible.set(s.id, sys.id);
        for (const t of sys.topics) compToVisible.set(t.id, sys.id);
        elkChildren.push({ id: sys.id, width: 256, height: 122 });
      } else {
        const innerChildren: Array<Record<string, unknown>> = [];
        compToVisible.set(sys.id, sys.id);
        for (const c of sys.components) {
          compToVisible.set(c.id, c.id);
          const cDiff = diffByEntity?.get(c.id);
          const apiCount = c.contracts.interfaces?.reduce((a, i) => a + i.entries.length, 0) ?? 0;
          const pkgStruct = componentCodeInfo?.[c.id]?.package_structure;
          const zoneCount = c.orientation?.zones?.length ?? 0;
          const usedByCount = incomingCountByComp.get(c.id)?.size ?? 0;

          const footprintText =
            c.component.kind === "module"
              ? zoneCount > 0 && pkgStruct
                ? `${plural(zoneCount, "zone")} · ${plural(pkgStruct.source_files, "file")}`
                : pkgStruct
                  ? `${plural(pkgStruct.source_files, "file")} · ${plural(c.component.depends_on?.length ?? 0, "dep")}`
                  : `${plural(c.component.public_modules?.length ?? 0, "export")} · ${plural(c.component.depends_on?.length ?? 0, "dep")}`
              : apiCount > 0 || c.handlers.handlers.length > 0
                ? `${plural(apiCount, "API")} · ${plural(c.handlers.handlers.length, "handler")}`
                : pkgStruct
                  ? `${plural(pkgStruct.source_files, "file")}`
                  : c.component.tech ?? "";

          metaById.set(c.id, {
            id: c.id,
            kind: c.component.kind,
            title: c.component.name,
            subtitle: c.component.does ?? c.component.tech ?? "",
            badge: usedByCount >= 3 ? `used by ${usedByCount}` : c.component.tech,
            countText: footprintText,
            diffKind: cDiff,
          });
          innerChildren.push({ id: c.id, width: 236, height: 112 });
        }
        for (const s of sys.stores) {
          compToVisible.set(s.id, s.id);
          const mergedTables = new Set<string>([
            ...(s.records ?? []).map((r) => r.table ?? r.id),
            ...(s.form === "database" ? [...scannedTableNames] : []),
          ]);
          metaById.set(s.id, {
            id: s.id,
            kind: "store",
            title: s.name,
            subtitle: `${s.form}${s.tech ? ` · ${s.tech}` : ""}`,
            badge: plural(mergedTables.size, "table"),
            diffKind: diffByEntity?.get(s.id),
          });
          innerChildren.push({ id: s.id, width: 224, height: 108 });
        }
        for (const t of sys.topics) {
          compToVisible.set(t.id, t.id);
          metaById.set(t.id, {
            id: t.id,
            kind: "topic",
            title: t.name,
            subtitle: `${t.form}${t.tech ? ` · ${t.tech}` : ""}`,
            badge: plural(t.messages?.length ?? 0, "msg"),
            diffKind: diffByEntity?.get(t.id),
          });
          innerChildren.push({ id: t.id, width: 224, height: 108 });
        }
        elkChildren.push({
          id: sys.id,
          layoutOptions: {
            "elk.padding": "[top=52,left=22,bottom=22,right=22]",
            "elk.spacing.nodeNode": "22",
            "elk.layered.spacing.nodeNodeBetweenLayers": "48",
            "elk.nodeSize.constraints": "MINIMUM_SIZE",
            "elk.nodeSize.minimum": "(320,160)",
          },
          children: innerChildren,
        });
      }
    }

    for (const ext of externals) {
      compToVisible.set(ext.id, ext.id);
      metaById.set(ext.id, {
        id: ext.id,
        kind: "external",
        title: ext.external.name,
        subtitle: ext.external.summary,
        badge: "3rd party",
      });
      elkChildren.push({ id: ext.id, width: 226, height: 112 });
    }

    for (const st of unassignedStores) {
      compToVisible.set(st.id, st.id);
      metaById.set(st.id, {
        id: st.id,
        kind: "unassigned",
        title: st.name,
        subtitle: st.notes ?? `${st.form} · ${st.tech ?? ""}`,
        badge: "owner: unknown",
      });
      elkChildren.push({ id: st.id, width: 226, height: 112 });
    }

    for (const top of unassignedTopics) {
      compToVisible.set(top.id, top.id);
      metaById.set(top.id, {
        id: top.id,
        kind: "unassigned",
        title: top.name,
        subtitle: `${top.form} · ${top.tech ?? ""}`,
        badge: "owner: unknown",
      });
      elkChildren.push({ id: top.id, width: 226, height: 112 });
    }

    // Deduplicate visible edges and track rolled-up counts (for collapsed system edges)
    const edgeByKey = new Map<string, { src: string; dst: string; kind: string; label?: string; count: number }>();
    for (const e of edges) {
      const src = compToVisible.get(e.from) ?? compToVisible.get(e.from_system);
      const dst = compToVisible.get(e.to) ?? (e.to_system ? compToVisible.get(e.to_system) : undefined);
      if (!src || !dst || src === dst) continue;
      const key = `${src}|${dst}|${e.kind}`;
      const existing = edgeByKey.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        edgeByKey.set(key, { src, dst, kind: e.kind, label: e.label ?? e.kind, count: 1 });
      }
    }

    // Optional transitive reduction for `depends` edges to cut dependency spaghetti
    let mergedEdges = [...edgeByKey.values()];
    if (directDepsOnly) {
      const depAdj = new Map<string, Set<string>>();
      for (const e of mergedEdges) {
        if (e.kind !== "depends") continue;
        let s = depAdj.get(e.src);
        if (!s) {
          s = new Set();
          depAdj.set(e.src, s);
        }
        s.add(e.dst);
      }
      const isReachableViaOther = (start: string, target: string): boolean => {
        const direct = depAdj.get(start);
        if (!direct) return false;
        const queue: string[] = [];
        const visited = new Set<string>([start]);
        for (const next of direct) {
          if (next === target) continue;
          visited.add(next);
          queue.push(next);
        }
        while (queue.length > 0) {
          const cur = queue.shift()!;
          const nbrs = depAdj.get(cur);
          if (!nbrs) continue;
          for (const n of nbrs) {
            if (n === target) return true;
            if (!visited.has(n)) {
              visited.add(n);
              queue.push(n);
            }
          }
        }
        return false;
      };
      mergedEdges = mergedEdges.filter((e) => e.kind !== "depends" || !isReachableViaOther(e.src, e.dst));
    }

    const elkEdges = mergedEdges.map((e, i) => ({
      id: `e_${i}`,
      sources: [e.src],
      targets: [e.dst],
      kind: e.kind,
      label: e.label,
      count: e.count,
    }));

    return { metaById, elkChildren, elkEdges };
  }, [systems, externals, unassignedStores, unassignedTopics, edges, expandedSystems, diffByEntity, scannedTableNames, componentCodeInfo, incomingCountByComp, directDepsOnly]);

  useEffect(() => {
    let cancelled = false;
    const graph = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.hierarchyHandling": "INCLUDE_CHILDREN",
        "elk.spacing.nodeNode": "36",
        "elk.layered.spacing.nodeNodeBetweenLayers": "72",
      },
      children: visibleModel.elkChildren,
      edges: visibleModel.elkEdges.map((e) => ({ id: e.id, sources: e.sources, targets: e.targets })),
    };

    elk.layout(graph as never).then((laidOut) => {
      if (cancelled) return;
      const positioned: PositionedNode[] = [];
      const offsets = new Map<string, { x: number; y: number }>();

      const collect = (node: { id: string; x?: number; y?: number; width?: number; height?: number; children?: unknown[] }, ox = 0, oy = 0) => {
        const x = (node.x ?? 0) + ox;
        const y = (node.y ?? 0) + oy;
        offsets.set(node.id, { x, y });
        const meta = visibleModel.metaById.get(node.id);
        if (meta) {
          positioned.push({
            id: node.id,
            x,
            y,
            width: node.width ?? 220,
            height: node.height ?? 96,
            meta,
            isContainer: Boolean(node.children && node.children.length > 0),
          });
        }
        for (const ch of (node.children ?? []) as typeof node[]) {
          collect(ch, x, y);
        }
      };

      for (const ch of (laidOut.children ?? []) as never[]) {
        collect(ch, 0, 0);
      }

      const edgeMetaById = new Map(visibleModel.elkEdges.map((e) => [e.id, e]));
      const routed: PositionedEdge[] = [];
      const collectEdges = (container: { id?: string; edges?: unknown[]; children?: unknown[] }, ox = 0, oy = 0) => {
        for (const rawEdge of (container.edges ?? []) as Array<{
          id: string;
          container?: string;
          sections?: Array<{ startPoint: { x: number; y: number }; bendPoints?: Array<{ x: number; y: number }>; endPoint: { x: number; y: number } }>;
        }>) {
          const em = edgeMetaById.get(rawEdge.id);
          const sec = rawEdge.sections?.[0];
          if (!em || !sec) continue;
          // With elk.hierarchyHandling=INCLUDE_CHILDREN, ELK stores container-local coordinates
          // on root edges and sets rawEdge.container to the owning container node ID.
          const refOffset =
            rawEdge.container && rawEdge.container !== "root"
              ? offsets.get(rawEdge.container) ?? { x: ox, y: oy }
              : { x: ox, y: oy };
          const pts = [sec.startPoint, ...(sec.bendPoints ?? []), sec.endPoint].map((p) => ({
            x: p.x + refOffset.x,
            y: p.y + refOffset.y,
          }));
          routed.push({
            id: rawEdge.id,
            from: em.sources[0]!,
            to: em.targets[0]!,
            kind: em.kind,
            label: em.label,
            count: em.count,
            points: pts,
          });
        }
        for (const ch of (container.children ?? []) as Array<{ id: string; x?: number; y?: number; edges?: unknown[]; children?: unknown[] }>) {
          collectEdges(ch, ox + (ch.x ?? 0), oy + (ch.y ?? 0));
        }
      };
      collectEdges(laidOut as never, 0, 0);

      setNodes(positioned);
      setRoutedEdges(routed);
      setLayoutSeq((s) => s + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [visibleModel]);

  const egoSet = useMemo(() => {
    if (!isolateEgo || !selectedId) return null;
    const set = new Set<string>([selectedId]);
    for (const e of routedEdges) {
      if (e.from === selectedId || e.to === selectedId) {
        set.add(e.from);
        set.add(e.to);
      }
    }
    return set;
  }, [isolateEgo, selectedId, routedEdges]);

  const expandableSystemsCount = systems.filter((s) => s.components.length + s.stores.length + s.topics.length > 0).length;
  const allExpanded = expandableSystemsCount > 0 && expandedSystems.size >= expandableSystemsCount;
  const hasDependsEdges = routedEdges.some((e) => e.kind === "depends");

  return (
    <InteractiveViewport
      bounds={bounds}
      fitKey={layoutSeq}
      minZoom={0.3}
      maxFitZoom={1.02}
      hint="Two-finger pan · Pinch to zoom · Double-click node for full view"
      toolbarExtra={
        <>
          {expandableSystemsCount > 0 && onExpandAll && onCollapseAll && (
            <div className="pill-group">
              <button
                className="icon-btn"
                onClick={allExpanded ? onCollapseAll : onExpandAll}
                title={allExpanded ? "Collapse all systems" : "Expand all systems"}
              >
                {allExpanded ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
                {allExpanded ? "Collapse All" : "Expand All"}
              </button>
            </div>
          )}

          <div className="pill-group">
            <button
              className={`icon-btn ${isolateEgo ? "active" : ""}`}
              onClick={() => setIsolateEgo((v) => !v)}
              disabled={!selectedId}
              title="Show only 1-hop neighbors of selected node"
            >
              <Eye size={13} /> {isolateEgo ? "1-Hop Isolated" : "Isolate 1-Hop"}
            </button>
          </div>

          {(hasDependsEdges || directDepsOnly) && (
            <div className="pill-group">
              <button
                className={`icon-btn ${directDepsOnly ? "active" : ""}`}
                onClick={() => setDirectDepsOnly((v) => !v)}
                title="Hide transitive module dependency shortcuts"
              >
                {directDepsOnly ? "Direct Deps Only" : "Hide Transitive"}
              </button>
            </div>
          )}
        </>
      }
      svgDefs={
        <defs>
          <marker id="arrow-call" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#4f46e5" />
          </marker>
          <marker id="arrow-depends" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#0284c7" />
          </marker>
          <marker id="arrow-event" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#7c3aed" />
          </marker>
          <marker id="arrow-data" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#0d9488" />
          </marker>
          <marker id="arrow-warn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#d97706" />
          </marker>
        </defs>
      }
      legend={
        <>
          <span className="legend-item"><span className="legend-line" style={{ background: "#4f46e5" }} /> Sync Call</span>
          {hasDependsEdges && (
            <span className="legend-item"><span className="legend-line" style={{ background: "#0284c7" }} /> Module Dep</span>
          )}
          <span className="legend-item"><span className="legend-line" style={{ borderTop: "2px dashed #7c3aed" }} /> Async Event</span>
          <span className="legend-item"><span className="legend-line" style={{ background: "#0d9488" }} /> Data Access</span>
          <span className="legend-item"><span className="legend-line" style={{ borderTop: "2px dotted #d97706" }} /> Unresolved / Observed</span>
        </>
      }
    >
      {/* Expanded System Containers first */}
      {nodes
        .filter((n) => n.isContainer)
        .map((n) => (
          <g key={n.id}>
            <rect
              x={n.x}
              y={n.y}
              width={n.width}
              height={n.height}
              rx={14}
              fill="var(--canvas-container)"
              stroke={selectedId === n.id ? "var(--accent)" : "var(--border-strong)"}
              strokeWidth={selectedId === n.id ? 2 : 1.5}
              strokeDasharray="6 4"
            />
            <foreignObject x={n.x} y={n.y} width={n.width} height={46}>
              <div
                data-no-pan
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "10px 14px",
                  cursor: "pointer",
                  width: "100%",
                  height: "100%",
                }}
                onClick={() => onSelect(n.id)}
                onDoubleClick={() => onOpenFullView?.(n.id)}
                title={`${n.meta.title} (${n.id}) — Click to inspect · Double-click for full view`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flex: 1 }}>
                  <Layers size={14} color="#4f46e5" style={{ flexShrink: 0 }} />
                  <strong style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {n.meta.title}
                  </strong>
                  {n.width >= 400 && (
                    <span
                      className="mono"
                      style={{ color: "var(--text-faint)", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {n.id}
                    </span>
                  )}
                </div>
                <button
                  className="expand-btn"
                  style={{ flexShrink: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(n.id);
                  }}
                >
                  Collapse
                </button>
              </div>
            </foreignObject>
          </g>
        ))}

      {/* Edges */}
      {routedEdges.map((edge) => {
        const style = edgeColor(edge.kind);
        const focusId = hoveredId ?? selectedId;
        const isIncident = Boolean(focusId && (edge.from === focusId || edge.to === focusId));
        const passiveDimmed = Boolean(focusId && !isIncident);
        const egoDimmed = egoSet !== null && !(egoSet.has(edge.from) && egoSet.has(edge.to));
        const dimmed = egoDimmed || passiveDimmed;
        const marker =
          edge.kind === "depends"
            ? "url(#arrow-depends)"
            : edge.kind === "publish" || edge.kind === "consume"
              ? "url(#arrow-event)"
              : edge.kind === "read" || edge.kind === "write"
                ? "url(#arrow-data)"
                : edge.kind === "unresolved_call" || edge.kind === "observed"
                  ? "url(#arrow-warn)"
                  : "url(#arrow-call)";
        const d = edge.points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
        const showCountBadge = (edge.count ?? 1) > 1 && edge.points.length >= 2;
        const midIdx = Math.floor(edge.points.length / 2);
        const pA = edge.points[midIdx - 1] ?? edge.points[0]!;
        const pB = edge.points[midIdx] ?? edge.points[edge.points.length - 1]!;
        const midX = (pA.x + pB.x) / 2;
        const midY = (pA.y + pB.y) / 2;
        return (
          <g key={edge.id}>
            <path
              d={d}
              fill="none"
              stroke={style.stroke}
              strokeWidth={isIncident ? 2.4 : 1.75}
              strokeDasharray={style.dash}
              opacity={dimmed ? 0.14 : isIncident ? 0.95 : 0.8}
              markerEnd={marker}
            />
            {showCountBadge && !dimmed && (
              <g transform={`translate(${midX}, ${midY})`}>
                <rect x={-16} y={-9} width={32} height={18} rx={9} fill="var(--surface)" stroke={style.stroke} strokeWidth={1} />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  fontWeight={700}
                  fill={style.stroke}
                >
                  {edge.count}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Leaf Node Cards */}
      {nodes
        .filter((n) => !n.isContainer)
        .map((n) => {
          const dimmed = egoSet !== null && !egoSet.has(n.id);
          const classes = [
            "node-card",
            selectedId === n.id ? "selected" : "",
            dimmed ? "dimmed" : "",
            n.meta.kind === "external" ? "kind-external" : "",
            n.meta.kind === "system" && n.meta.mapped === false ? "kind-stub" : "",
            n.meta.kind === "store" || n.meta.kind === "unassigned" ? "kind-store" : "",
            n.meta.kind === "topic" ? "kind-topic" : "",
            n.meta.diffKind ? `diff-${n.meta.diffKind}` : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <foreignObject key={n.id} x={n.x} y={n.y} width={n.width} height={n.height}>
              <div
                className={classes}
                onClick={() => onSelect(n.id)}
                onDoubleClick={() => onOpenFullView?.(n.id)}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId((prev) => (prev === n.id ? null : prev))}
                title="Click to inspect · Double-click for full view"
              >
                <div>
                  <div className="node-header">
                    <span className="node-kind">
                      <NodeIcon kind={n.meta.kind} /> {n.meta.kind}
                    </span>
                    {n.meta.badge && (
                      <span className={`badge ${n.meta.mapped === false || n.meta.kind === "unassigned" ? "amber" : ""}`}>
                        {n.meta.badge}
                      </span>
                    )}
                  </div>
                  <div className="node-title">{n.meta.title}</div>
                  {n.meta.subtitle && <div className="node-sub">{n.meta.subtitle}</div>}
                </div>
                <div className="node-footer">
                  <span>{n.meta.countText ?? n.id}</span>
                  {n.meta.expandable && (
                    <button
                      className="expand-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand(n.id);
                      }}
                    >
                      Expand
                    </button>
                  )}
                </div>
              </div>
            </foreignObject>
          );
        })}
    </InteractiveViewport>
  );
}
