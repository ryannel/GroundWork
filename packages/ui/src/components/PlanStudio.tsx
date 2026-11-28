import ELK from "elkjs/lib/elk.bundled.js";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  GitCompare,
  ListChecks,
  MessageSquarePlus,
  Monitor,
  Palette,
  ShieldCheck,
  Smartphone,
  Workflow,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { EntityNavOptions } from "../router";
import type { LoadedPlanPayload, SpacePayload } from "../types";
import { FlowWalkthrough } from "./FlowWalkthrough";
import { EntityLink } from "./shared/EntityLink";
import { InteractiveViewport, type ContentBounds } from "./shared/InteractiveViewport";
import { SystemMapCanvas } from "./SystemMapCanvas";

const elk = new ELK();

interface Props {
  space: SpacePayload;
  plan: LoadedPlanPayload;
  initialTab?: string;
  initialOp?: string;
  initialStep?: number;
  initialMode?: "architecture" | "sequence";
  onRouteSync?: (patch: { tab?: string; op?: string; step?: number; mode?: "architecture" | "sequence" }, push?: boolean) => void;
  onRefresh: () => void;
  onOpenEntity: (entityId: string, opts?: string | EntityNavOptions, fromPlanId?: string) => void;
}

function ExecutionDag({
  plan,
  selectedWiId,
  onSelectWi,
}: {
  plan: LoadedPlanPayload;
  selectedWiId: string | null;
  onSelectWi: (id: string) => void;
}) {
  const [nodes, setNodes] = useState<Array<{ id: string; x: number; y: number; w: number; h: number }>>([]);
  const [edges, setEdges] = useState<Array<{ id: string; points: { x: number; y: number }[] }>>([]);
  const [seq, setSeq] = useState(0);

  useEffect(() => {
    const wiSet = new Set(plan.execution.work_items.map((w) => w.id));
    const elkEdges: Array<{ id: string; sources: string[]; targets: string[] }> = [];
    for (const wi of plan.execution.work_items) {
      for (const dep of wi.depends_on ?? []) {
        if (wiSet.has(dep)) {
          elkEdges.push({ id: `${dep}->${wi.id}`, sources: [dep], targets: [wi.id] });
        }
      }
    }
    const graph = {
      id: "exec-dag",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.spacing.nodeNode": "34",
        "elk.layered.spacing.nodeNodeBetweenLayers": "72",
      },
      children: plan.execution.work_items.map((w) => ({ id: w.id, width: 280, height: 118 })),
      edges: elkEdges,
    };
    elk.layout(graph as never).then((res) => {
      setNodes(
        ((res.children ?? []) as Array<{ id: string; x?: number; y?: number; width?: number; height?: number }>).map((n) => ({
          id: n.id,
          x: n.x ?? 0,
          y: n.y ?? 0,
          w: n.width ?? 280,
          h: n.height ?? 118,
        })),
      );
      setEdges(
        ((res.edges ?? []) as Array<{
          id: string;
          sections?: Array<{ startPoint: { x: number; y: number }; bendPoints?: { x: number; y: number }[]; endPoint: { x: number; y: number } }>;
        }>)
          .filter((e) => e.sections?.[0])
          .map((e) => ({
            id: e.id,
            points: [e.sections![0]!.startPoint, ...(e.sections![0]!.bendPoints ?? []), e.sections![0]!.endPoint],
          })),
      );
      setSeq((s) => s + 1);
    });
  }, [plan]);

  const statusByWi = useMemo(() => {
    const m = new Map<string, string>();
    for (const ev of plan.progress?.events ?? []) m.set(ev.work_item, ev.status);
    return m;
  }, [plan.progress]);

  const wiById = useMemo(() => new Map(plan.execution.work_items.map((w) => [w.id, w])), [plan.execution.work_items]);

  const bounds = useMemo<ContentBounds>(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, width: 700, height: 220 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    }
    return { minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }, [nodes]);

  return (
    <div className="section-card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="section-title" style={{ margin: 0 }}>Work Item Dependency DAG</span>
        <span className="badge">{plan.execution.work_items.length} deliveries</span>
      </div>
      <InteractiveViewport
        bounds={bounds}
        fitKey={seq}
        minZoom={0.4}
        maxFitZoom={1.05}
        style={{ flex: "none", height: 260, borderRadius: 0 }}
        hint="Two-finger pan · Pinch to zoom · Click work item to highlight"
        svgDefs={
          <defs>
            <marker id="dag-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#4f46e5" />
            </marker>
          </defs>
        }
      >
        {edges.map((e) => (
          <path
            key={e.id}
            d={e.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
            fill="none"
            stroke="#4f46e5"
            strokeWidth={2}
            markerEnd="url(#dag-arrow)"
          />
        ))}
        {nodes.map((n) => {
          const wi = wiById.get(n.id);
          if (!wi) return null;
          const status = statusByWi.get(wi.id) ?? "todo";
          const statusColor = status === "done" ? "emerald" : status === "in_progress" ? "amber" : "indigo";
          const targetText = wi.target.repo
            ? `repo: ${wi.target.repo}`
            : wi.target.new_repo
              ? `new_repo: ${wi.target.new_repo}`
              : `external: ${wi.target.external}`;
          return (
            <foreignObject key={n.id} x={n.x} y={n.y} width={n.w} height={n.h}>
              <div
                className={`node-card ${selectedWiId === wi.id ? "selected" : ""}`}
                onClick={() => onSelectWi(wi.id)}
              >
                <div>
                  <div className="node-header">
                    <span className={`badge ${statusColor}`}>{status}</span>
                    <span className="mono" style={{ fontSize: 10, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {targetText}
                    </span>
                  </div>
                  <div className="node-title" style={{ whiteSpace: "normal", marginTop: 4 }}>{wi.title}</div>
                </div>
                <div className="node-footer">
                  <span className="mono" style={{ fontSize: 10 }}>{wi.id.split("/").pop()}</span>
                  <span className="badge" style={{ fontSize: 10, flexShrink: 0 }}>{wi.milestone.split("/").pop()}</span>
                </div>
              </div>
            </foreignObject>
          );
        })}
      </InteractiveViewport>
    </div>
  );
}

type PlanTab = "overview" | "architecture" | "walkthrough" | "design" | "execution" | "proof";
const VALID_TABS = new Set<string>(["overview", "architecture", "walkthrough", "design", "execution", "proof"]);

export function PlanStudio({
  space,
  plan,
  initialTab,
  initialOp,
  initialStep,
  initialMode,
  onRouteSync,
  onRefresh,
  onOpenEntity,
}: Props) {
  const [tab, setTab] = useState<PlanTab>(
    initialTab && VALID_TABS.has(initialTab) ? (initialTab as PlanTab) : "walkthrough",
  );

  useEffect(() => {
    if (initialTab && VALID_TABS.has(initialTab) && initialTab !== tab) {
      setTab(initialTab as PlanTab);
    }
  }, [initialTab]);

  const [selectedWiId, setSelectedWiId] = useState<string | null>(null);
  const [highlightedChangeId, setHighlightedChangeId] = useState<string | null>(null);
  const [highlightedTestId, setHighlightedTestId] = useState<string | null>(null);

  const changeTab = (next: PlanTab) => {
    setTab(next);
    onRouteSync?.({ tab: next }, true);
  };
  const [archMode, setArchMode] = useState<"diff" | "before" | "after">("diff");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(space.systems.filter((s) => s.system.mapped).map((s) => s.id)));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Design prototype state
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [xray, setXray] = useState(true);
  const [activeState, setActiveState] = useState("default");

  // Inline review form
  const [reviewTarget, setReviewTarget] = useState(plan.diff[0]?.entity_id ?? plan.id);
  const [reviewBody, setReviewBody] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  const diffMap = useMemo(() => {
    const m = new Map<string, "added" | "modified" | "removed">();
    for (const d of plan.diff) {
      const base = d.entity_id.split("#")[0]!;
      m.set(base, d.kind);
      if (base.startsWith("handler:") || base.startsWith("schema:")) {
        const compSlug = base.split(":")[1]?.split("/")[0];
        if (compSlug) {
          m.set(`service:${compSlug}`, "modified");
          m.set(`store:${compSlug}`, "modified");
        }
      }
    }
    return m;
  }, [plan.diff]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewBody.trim()) return;
    setSavingReview(true);
    try {
      await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace: space.workspace.id,
          project: space.project_id ?? undefined,
          plan_slug: plan.slug,
          target_id: reviewTarget,
          author: "Human Reviewer",
          body: reviewBody.trim(),
        }),
      });
      setReviewBody("");
      onRefresh();
    } finally {
      setSavingReview(false);
    }
  };

  const firstScreen = plan.design?.screens[0];
  const protoUrl = firstScreen
    ? `/api/prototype?workspace=${encodeURIComponent(space.workspace.id)}${space.project_id ? `&project=${encodeURIComponent(space.project_id)}` : ""}&plan=${encodeURIComponent(plan.slug)}&file=${encodeURIComponent(firstScreen.prototype)}&xray=${xray ? "1" : "0"}`
    : null;

  return (
    <div className="studio-shell">
      <div className="studio-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="mono" style={{ color: "var(--accent)", fontWeight: 600 }}>{plan.id}</span>
            <span className={`badge ${plan.gate_ready.passed ? "emerald" : "amber"}`}>
              {plan.gate_ready.passed ? "Gate: Ready PASS" : `Gate: ${plan.gate_ready.violations.length} items`}
            </span>
            <span className={`badge ${plan.drift.status === "clean_apply" ? "teal" : "rose"}`}>
              Drift: {plan.drift.status}
            </span>
          </div>
          <h2 style={{ margin: "4px 0 0 0", fontSize: 18 }}>{plan.manifest.title}</h2>
        </div>
      </div>

      <div className="studio-subtabs">
        <button className={`subtab ${tab === "overview" ? "active" : ""}`} onClick={() => changeTab("overview")}>
          <ClipboardCheck size={14} /> Overview
        </button>
        <button className={`subtab ${tab === "architecture" ? "active" : ""}`} onClick={() => changeTab("architecture")}>
          <GitCompare size={14} /> 1. Architecture ({plan.diff.length} ops)
        </button>
        <button className={`subtab ${tab === "walkthrough" ? "active" : ""}`} onClick={() => changeTab("walkthrough")}>
          <Workflow size={14} /> Walkthrough &amp; Flows
        </button>
        <button className={`subtab ${tab === "design" ? "active" : ""}`} onClick={() => changeTab("design")}>
          <Palette size={14} /> 2. Design ({plan.design?.screens.length ?? 0})
        </button>
        <button className={`subtab ${tab === "execution" ? "active" : ""}`} onClick={() => changeTab("execution")}>
          <ListChecks size={14} /> 3. Execution ({plan.execution.work_items.length})
        </button>
        <button className={`subtab ${tab === "proof" ? "active" : ""}`} onClick={() => changeTab("proof")}>
          <ShieldCheck size={14} /> 4. Proof ({plan.proof.tests.length})
        </button>
      </div>

      {tab === "walkthrough" ? (
        <FlowWalkthrough
          space={space}
          plan={plan}
          initialOp={initialOp}
          initialStep={initialStep}
          initialMode={initialMode}
          onStateChange={(st) => onRouteSync?.({ tab: "walkthrough", ...st }, false)}
          onOpenEntity={onOpenEntity}
        />
      ) : tab === "architecture" ? (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
            <SystemMapCanvas
              systems={archMode === "before" ? space.systems : plan.after_systems}
              externals={space.externals}
              unassignedStores={space.unassigned_stores}
              unassignedTopics={space.unassigned_topics}
              edges={archMode === "before" ? space.edges : plan.after_edges}
              evidence={space.evidence}
              componentCodeInfo={space.component_code_info}
              selectedId={selectedNode}
              onSelect={setSelectedNode}
              onOpenFullView={(id) => onOpenEntity(id, undefined, plan.id)}
              expandedSystems={expanded}
              onToggleExpand={(id) =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              diffByEntity={archMode === "diff" ? diffMap : undefined}
              toolbarExtra={
                <div className="pill-group">
                  {(["before", "diff", "after"] as const).map((m) => (
                    <button key={m} className={`icon-btn ${archMode === m ? "active" : ""}`} onClick={() => setArchMode(m)}>
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
              }
            />
          </div>
          <aside className="inspector" style={{ width: 400 }}>
            <div className="inspector-header">
              <div>
                <div className="section-title" style={{ margin: 0 }}>Overlay Diff ({plan.diff.length})</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Surgical tree-aware ops + additions</div>
              </div>
            </div>
            <div className="inspector-body">
              {plan.diff.map((d, i) => {
                const isHl = highlightedChangeId === d.change_id;
                return (
                  <div
                    key={i}
                    className="section-card"
                    style={{
                      cursor: "pointer",
                      borderColor: isHl ? "var(--accent)" : undefined,
                      boxShadow: isHl ? "0 0 0 3px rgba(79,70,229,0.14)" : undefined,
                    }}
                    onClick={() => onOpenEntity(d.entity_id, undefined, plan.id)}
                    title={`Inspect ${d.entity_id} in Plan Preview`}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span className={`badge ${d.kind === "added" ? "emerald" : d.kind === "modified" ? "amber" : "rose"}`}>
                        {d.kind === "added" ? "+ Added" : d.kind}
                      </span>
                      <span className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {d.change_id} <ArrowUpRight size={11} />
                      </span>
                    </div>
                    <div className="mono" style={{ fontWeight: 600, color: "var(--accent)" }}>{d.entity_id}</div>
                    {d.detail && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{d.detail}</div>}
                  </div>
                );
              })}
              {(plan.changes.relies_on?.length ?? 0) > 0 && (
                <div className="section-card">
                  <div className="section-title">Relies On (Drift-Locked)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {plan.changes.relies_on!.map((r) => (
                      <div key={r}>
                        <EntityLink id={r} variant="neutral" onOpen={(id) => onOpenEntity(id, undefined, plan.id)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div className="studio-content">
          {tab === "overview" && (
            <div style={{ maxWidth: 1220, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 4-Pillar Quick Jump Strip (Linear / GitHub PR Overview pattern) */}
              <div className="stat-strip">
                <button className="stat-card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => changeTab("architecture")}>
                  <div className="stat-label">1. Architecture</div>
                  <div className="stat-value" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{plan.diff.length} ops</span>
                    <ArrowRight size={15} color="var(--accent)" />
                  </div>
                </button>
                <button className="stat-card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => changeTab("walkthrough")}>
                  <div className="stat-label">Interactive Walkthrough</div>
                  <div className="stat-value" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Step Flow</span>
                    <ArrowRight size={15} color="var(--accent)" />
                  </div>
                </button>
                <button className="stat-card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => changeTab("design")}>
                  <div className="stat-label">2. Design</div>
                  <div className="stat-value" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>
                      {plan.design?.screens.length ?? 0} {(plan.design?.screens.length ?? 0) === 1 ? "screen" : "screens"}
                    </span>
                    <ArrowRight size={15} color="var(--accent)" />
                  </div>
                </button>
                <button className="stat-card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => changeTab("execution")}>
                  <div className="stat-label">3. Execution</div>
                  <div className="stat-value" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{plan.execution.work_items.length} items</span>
                    <ArrowRight size={15} color="var(--accent)" />
                  </div>
                </button>
                <button className="stat-card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => changeTab("proof")}>
                  <div className="stat-label">4. Proof</div>
                  <div className="stat-value" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{plan.proof.tests.length} tests</span>
                    <ArrowRight size={15} color="var(--accent)" />
                  </div>
                </button>
              </div>

              <div className="grid-2">
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div className="section-card">
                    <div className="section-title">Problem &amp; Why</div>
                    <p style={{ margin: "0 0 8px 0", fontSize: 13.5, lineHeight: 1.55 }}>{plan.manifest.problem.summary}</p>
                    {plan.manifest.problem.why && (
                      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{plan.manifest.problem.why}</p>
                    )}
                  </div>

                  <div className="section-card">
                    <div className="section-title">Affected Entities ({plan.diff.length})</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {plan.diff.map((d, idx) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <EntityLink id={d.entity_id} onOpen={(id) => onOpenEntity(id, undefined, plan.id)} />
                          <span className={`badge ${d.kind === "added" ? "emerald" : d.kind === "modified" ? "amber" : "rose"}`}>
                            {d.kind === "added" ? "+ Added" : d.kind}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="section-card">
                    <div className="section-title">Named Pillar Sign-Offs</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {Object.entries(plan.manifest.signoffs ?? {}).map(([pillar, s]) => (
                        <span key={pillar} className="badge emerald">
                          <CheckCircle2 size={12} /> {pillar}: {s.by} ({s.at})
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="section-card">
                    <div className="section-title">Maturity Gate (Ready)</div>
                    {plan.gate_ready.passed ? (
                      <div style={{ color: "var(--emerald)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        <CheckCircle2 size={16} /> All 6 cross-pillar gates passed.
                      </div>
                    ) : (
                      plan.gate_ready.violations.map((v, i) => (
                        <div key={i} style={{ color: "var(--rose)", fontSize: 12.5, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                          <XCircle size={14} /> <strong>[{v.gate}]</strong> {v.message}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div className="section-card">
                    <div className="section-title">Inline Review Notes ({plan.reviews.length}) — Human → Agent Loop</div>
                    {plan.reviews.map((r) => (
                      <div key={r.id} style={{ padding: "10px 12px", background: "var(--bg)", borderRadius: 8, marginBottom: 8, border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <EntityLink id={r.target_id} onOpen={(id) => onOpenEntity(id, undefined, plan.id)} />
                          <span className="badge amber">{r.status}</span>
                        </div>
                        <div style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.5 }}>{r.body}</div>
                        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>— {r.author}</div>
                      </div>
                    ))}
                    <form onSubmit={handleSubmitReview} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                      <input
                        className="select mono"
                        value={reviewTarget}
                        onChange={(e) => setReviewTarget(e.target.value)}
                        placeholder="Target canonical ID (e.g. handler:orders-api/create-order#save-hold-expiry)"
                      />
                      <textarea
                        rows={2}
                        value={reviewBody}
                        onChange={(e) => setReviewBody(e.target.value)}
                        placeholder="Pin a review note for the agent (saved directly to reviews/<note>.yaml)…"
                        style={{
                          border: "1px solid var(--border-strong)",
                          borderRadius: 7,
                          padding: 8,
                          fontFamily: "var(--sans)",
                          fontSize: 12.5,
                          background: "var(--bg)",
                          color: "var(--text)",
                        }}
                      />
                      <button
                        type="submit"
                        disabled={savingReview || !reviewBody.trim()}
                        className="primary-btn"
                        style={{ alignSelf: "flex-start" }}
                      >
                        <MessageSquarePlus size={14} /> {savingReview ? "Saving…" : "Pin Review Note"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "design" && (
            <div>
              {!plan.manifest.pillars.design.applicable ? (
                <div className="section-card">
                  <div className="section-title">Design Pillar Not Applicable</div>
                  <p style={{ margin: 0, fontSize: 13 }}>{plan.manifest.pillars.design.reason}</p>
                </div>
              ) : firstScreen && protoUrl ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
                  <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="mono" style={{ fontWeight: 700 }}>{firstScreen.screen}</span>
                        <span className="badge indigo">fidelity: {firstScreen.fidelity}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className={`icon-btn ${viewport === "desktop" ? "active" : ""}`} onClick={() => setViewport("desktop")}>
                          <Monitor size={14} /> Desktop
                        </button>
                        <button className={`icon-btn ${viewport === "mobile" ? "active" : ""}`} onClick={() => setViewport("mobile")}>
                          <Smartphone size={14} /> Mobile
                        </button>
                        <button className={`icon-btn ${xray ? "active" : ""}`} onClick={() => setXray((x) => !x)}>
                          <Eye size={14} /> Architecture X-Ray
                        </button>
                      </div>
                    </div>
                    <div style={{ padding: 20, background: "var(--proto-stage)", display: "flex", justifyContent: "center" }}>
                      <iframe
                        title={firstScreen.screen}
                        src={protoUrl}
                        sandbox="allow-scripts"
                        style={{
                          width: viewport === "mobile" ? 390 : "100%",
                          height: 360,
                          border: "1px solid #cbd5e1",
                          borderRadius: 10,
                          background: "#fff",
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div className="section-card">
                      <div className="section-title">Screen States</div>
                      {firstScreen.states.map((st) => (
                        <button
                          key={st.id}
                          className={`icon-btn ${activeState === st.id ? "active" : ""}`}
                          style={{ width: "100%", justifyContent: "space-between", gap: 10, marginBottom: 4, border: "1px solid var(--border)", textAlign: "left" }}
                          onClick={() => setActiveState(st.id)}
                        >
                          <span className="mono" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{st.id}</span>
                          <span style={{ fontSize: 11, textAlign: "right" }}>{st.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="section-card">
                      <div className="section-title">Architecture X-Ray Bindings</div>
                      {(firstScreen.bindings ?? []).map((b, i) => (
                        <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                          <div className="mono" style={{ color: "var(--text)", fontWeight: 600 }}>{b.selector}</div>
                          {b.calls && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span className="badge emerald" style={{ fontSize: 10 }}>calls →</span>
                              <EntityLink id={b.calls} onOpen={(id) => onOpenEntity(id, undefined, plan.id)} />
                            </div>
                          )}
                          {b.reads?.map((r) => (
                            <div key={r} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span className="badge teal" style={{ fontSize: 10 }}>reads ←</span>
                              <EntityLink id={r} onOpen={(id) => onOpenEntity(id, undefined, plan.id)} />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {tab === "execution" && (
            <div style={{ maxWidth: 1220, margin: "0 auto" }}>
              <ExecutionDag plan={plan} selectedWiId={selectedWiId} onSelectWi={(id) => setSelectedWiId((cur) => (cur === id ? null : id))} />
              <div className="section-card">
                <div className="section-title">Milestones &amp; Work Items</div>
                <table className="gw-table">
                  <thead>
                    <tr><th>Work Item</th><th>Milestone</th><th>Target</th><th>Implements</th><th>Verified By</th></tr>
                  </thead>
                  <tbody>
                    {plan.execution.work_items.map((wi) => (
                      <tr
                        key={wi.id}
                        style={selectedWiId === wi.id ? { background: "var(--accent-soft)" } : undefined}
                        onClick={() => setSelectedWiId(wi.id)}
                      >
                        <td>
                          <div style={{ fontWeight: 600 }}>{wi.title}</div>
                          <div className="mono" style={{ color: "var(--text-faint)" }}>{wi.id}</div>
                        </td>
                        <td><span className="badge mono">{wi.milestone}</span></td>
                        <td className="mono">{wi.target.repo ?? wi.target.new_repo ?? wi.target.external}</td>
                        <td>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {(wi.implements ?? []).map((chg) => (
                              <button
                                key={chg}
                                className="entity-link"
                                style={{ padding: "2px 7px", fontSize: 11 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHighlightedChangeId(chg);
                                  changeTab("architecture");
                                }}
                                title={`Inspect ${chg} in 1. Architecture`}
                              >
                                {chg}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {(wi.verified_by ?? []).map((tst) => (
                              <button
                                key={tst}
                                className="entity-link neutral"
                                style={{ padding: "2px 7px", fontSize: 11 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHighlightedTestId(tst);
                                  changeTab("proof");
                                }}
                                title={`Inspect ${tst} in 4. Proof`}
                              >
                                {tst}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "proof" && (
            <div style={{ maxWidth: 1220, margin: "0 auto" }}>
              <div className="section-card">
                <div className="section-title">Verification Matrix (Changes &amp; Requirements × Acceptance Tests)</div>
                <table className="gw-table">
                  <thead>
                    <tr><th>Test</th><th>Level / Env</th><th>Proves</th><th>Given / When / Then</th><th>Delivered By</th></tr>
                  </thead>
                  <tbody>
                    {plan.proof.tests.map((t) => {
                      const deliveringWis = plan.execution.work_items.filter((wi) => (wi.verified_by ?? []).includes(t.id));
                      return (
                        <tr
                          key={t.id}
                          style={highlightedTestId === t.id ? { background: "var(--accent-soft)" } : undefined}
                        >
                          <td>
                            <div style={{ fontWeight: 700 }}>{t.name}</div>
                            <div className="mono" style={{ color: "var(--text-faint)" }}>{t.id}</div>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                              <span className="badge indigo">{t.level}</span>
                              <span className="badge">{t.env}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {t.proves.map((p) =>
                                p.startsWith("change:") ? (
                                  <button
                                    key={p}
                                    className="entity-link"
                                    style={{ padding: "2px 7px", fontSize: 11, alignSelf: "flex-start" }}
                                    onClick={() => {
                                      setHighlightedChangeId(p);
                                      changeTab("architecture");
                                    }}
                                    title={`Inspect ${p} in 1. Architecture`}
                                  >
                                    ✓ {p}
                                  </button>
                                ) : (
                                  <span key={p} className="badge emerald mono" style={{ alignSelf: "flex-start" }}>✓ {p}</span>
                                ),
                              )}
                            </div>
                          </td>
                          <td style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                            {!t.given && !t.when && !t.then && <span style={{ color: "var(--text-faint)" }}>—</span>}
                            {t.given && (
                              <div style={{ marginBottom: 4 }}>
                                <span className="badge" style={{ marginRight: 6, fontSize: 10 }}>GIVEN</span>
                                {t.given}
                              </div>
                            )}
                            {t.when && (
                              <div style={{ marginBottom: 4 }}>
                                <span className="badge indigo" style={{ marginRight: 6, fontSize: 10 }}>WHEN</span>
                                {t.when}
                              </div>
                            )}
                            {t.then && (
                              <div>
                                <span className="badge emerald" style={{ marginRight: 6, fontSize: 10 }}>THEN</span>
                                {Array.isArray(t.then) ? t.then.join("; ") : t.then}
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {deliveringWis.map((wi) => (
                                <button
                                  key={wi.id}
                                  className="entity-link neutral"
                                  style={{ padding: "2px 7px", fontSize: 11, alignSelf: "flex-start" }}
                                  onClick={() => {
                                    setSelectedWiId(wi.id);
                                    changeTab("execution");
                                  }}
                                  title={`View ${wi.id} in 3. Execution`}
                                >
                                  {wi.id}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
