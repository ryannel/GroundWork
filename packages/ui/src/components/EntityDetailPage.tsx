import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Compass,
  Database,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  GitCompare,
  GitFork,
  Globe,
  Layers,
  Server,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { EntityNavOptions } from "../router";
import type { LoadedPlanPayload, SpacePayload } from "../types";
import { getAllScannedSurfaces, getComponentRichEndpoints, getComponentScannedSurfaces, getStoreTables, isServedApiSurface } from "../utils/spaceLookup";
import { ApiReferenceView } from "./shared/ApiReferenceView";
import { buildGitHubUrl, CodebaseGuideView, roleStyle } from "./shared/CodebaseGuideView";
import { DatabaseSchemaView } from "./shared/DatabaseSchemaView";
import { EntityLink } from "./shared/EntityLink";
import { schemaDefToRows, SchemaTableView } from "./shared/SchemaTableView";
import { StepTreeView } from "./shared/StepTreeView";

interface Props {
  space: SpacePayload;
  entityId: string;
  initialTab?: string;
  initialEndpoint?: string;
  initialTable?: string;
  initialDbView?: "tables" | "er";
  fromPlan?: LoadedPlanPayload;
  stateMode?: "proposed" | "as-is";
  onRoutePatch?: (patch: { tab?: string; endpoint?: string; table?: string; dbview?: "tables" | "er"; state?: "proposed" | "as-is" }) => void;
  onBack: () => void;
  onBackToPlan?: () => void;
  onOpenEntity: (entityId: string, opts?: string | EntityNavOptions) => void;
  onOpenMap: (selectedId?: string) => void;
}

/**
 * Cohesive Full-Page Entity View for Services, Apps, Modules, Databases, Queues, Externals, and Systems.
 * Reuses ContractCatalog, SchemaTableView, StepTreeView, and EntityLink across the entire app.
 */
export function EntityDetailPage({
  space,
  entityId,
  initialTab,
  initialEndpoint,
  initialTable,
  initialDbView,
  fromPlan,
  stateMode = "proposed",
  onRoutePatch,
  onBack,
  onBackToPlan,
  onOpenEntity,
  onOpenMap,
}: Props) {
  const [tab, setTab] = useState(initialTab ?? "overview");
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | undefined>(initialEndpoint);
  const [selectedTableName, setSelectedTableName] = useState<string | undefined>(initialTable);
  const [dbView, setDbView] = useState<"tables" | "er">(initialDbView ?? "tables");
  const [viewState, setViewState] = useState<"proposed" | "as-is">(stateMode);

  useEffect(() => {
    setTab(initialTab ?? "overview");
  }, [entityId, initialTab]);

  useEffect(() => {
    setSelectedEndpoint(initialEndpoint);
  }, [entityId, initialEndpoint]);

  useEffect(() => {
    setSelectedTableName(initialTable);
  }, [entityId, initialTable]);

  useEffect(() => {
    setDbView(initialDbView ?? "tables");
  }, [entityId, initialDbView]);

  useEffect(() => {
    setViewState(stateMode);
  }, [stateMode]);

  const changeTab = (next: string) => {
    setTab(next);
    onRoutePatch?.({ tab: next });
  };

  const changeViewState = (next: "proposed" | "as-is") => {
    setViewState(next);
    onRoutePatch?.({ state: next });
  };

  const showingProposed = Boolean(fromPlan && viewState === "proposed");
  const activeSystems = showingProposed && fromPlan ? fromPlan.after_systems : space.systems;
  const diffMap = useMemo(() => {
    const m = new Map<string, "added" | "modified" | "removed">();
    if (showingProposed && fromPlan) {
      for (const d of fromPlan.diff) m.set(d.entity_id, d.kind);
    }
    return m;
  }, [showingProposed, fromPlan]);

  // Crisp, unmistakable context bar when inspecting an entity from a Plan!
  const planContextBanner = fromPlan ? (
    <div
      style={{
        background: showingProposed ? "var(--accent-soft)" : "var(--surface-muted)",
        borderBottom: showingProposed ? "1px solid var(--accent-border)" : "1px solid var(--border)",
        padding: "8px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <GitCompare size={14} color={showingProposed ? "var(--accent)" : "var(--text-muted)"} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: showingProposed ? "var(--accent-ink)" : "var(--text)" }}>
          {showingProposed ? `Plan Preview: ${fromPlan.manifest.title}` : `Viewing Current System (As-Is)`}
        </span>
        <span className="mono" style={{ fontSize: 11.5, color: showingProposed ? "var(--accent)" : "var(--text-muted)" }}>
          ({fromPlan.id})
        </span>
        <span style={{ fontSize: 12, color: showingProposed ? "var(--accent-ink)" : "var(--text-muted)" }}>
          {showingProposed
            ? "· Highlighting proposed changes (+ Added / ~ Modified)"
            : "· Plan changes hidden"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="pill-group" style={{ boxShadow: "none" }}>
          <button
            className={`icon-btn ${showingProposed ? "active" : ""}`}
            onClick={() => changeViewState("proposed")}
          >
            Proposed (Plan)
          </button>
          <button
            className={`icon-btn ${!showingProposed ? "active" : ""}`}
            onClick={() => changeViewState("as-is")}
          >
            As-Is (Current)
          </button>
        </div>
        {onBackToPlan && (
          <button className="primary-btn" style={{ padding: "5px 12px", fontSize: 12 }} onClick={onBackToPlan}>
            <ArrowLeft size={13} /> Return to Plan
          </button>
        )}
      </div>
    </div>
  ) : null;

  // Resolve entity across all kinds
  const compMatch = useMemo(() => {
    for (const sys of activeSystems) {
      const c = sys.components.find((x) => x.id === entityId);
      if (c) return { sys, comp: c };
    }
    return null;
  }, [activeSystems, entityId]);

  const storeMatch = useMemo(() => {
    for (const sys of activeSystems) {
      const s = sys.stores.find((x) => x.id === entityId);
      if (s) return { sys, store: s };
    }
    const un = space.unassigned_stores.find((x) => x.id === entityId);
    if (un) return { sys: null, store: un };
    return null;
  }, [activeSystems, space.unassigned_stores, entityId]);

  const topicMatch = useMemo(() => {
    for (const sys of activeSystems) {
      const t = sys.topics.find((x) => x.id === entityId);
      if (t) return { sys, topic: t };
    }
    const un = space.unassigned_topics.find((x) => x.id === entityId);
    if (un) return { sys: null, topic: un };
    return null;
  }, [activeSystems, space.unassigned_topics, entityId]);

  const externalMatch = space.externals.find((e) => e.id === entityId) ?? null;
  const systemMatch = activeSystems.find((s) => s.id === entityId) ?? null;

  const outgoing = space.edges.filter((e) => e.from === entityId || e.from_system === entityId);
  const incoming = space.edges.filter((e) => e.to === entityId || e.to_system === entityId);

  const dedupeEdges = (list: typeof outgoing, targetField: "to" | "from") => {
    const map = new Map<string, { id: string; kind: string; count: number }>();
    for (const e of list) {
      const target = e[targetField];
      if (target === entityId) continue;
      const k = `${target}|${e.kind}`;
      const cur = map.get(k);
      if (cur) cur.count += 1;
      else map.set(k, { id: target, kind: e.kind, count: 1 });
    }
    return [...map.values()];
  };

  // ── 1. FULL SERVICE / APP / MODULE VIEW ───────────────────────────────────
  if (compMatch) {
    const { sys, comp } = compMatch;
    const compComplete = space.completeness.components.find((c) => c.component_id === comp.id);
    const codeInfo = space.component_code_info?.[comp.id];
    const compScannedSurfaces = getComponentScannedSurfaces(space, sys, comp);
    const scannedRoutes = compScannedSurfaces.filter(isServedApiSurface);
    const scannedTopics = [...new Map(
      compScannedSurfaces
        .filter((s) => s.kind === "topic" || s.kind === "subscription")
        .map((s) => [s.surface_id, s]),
    ).values()];
    const uniqueOutgoing = dedupeEdges(outgoing, "to");
    const uniqueIncoming = dedupeEdges(incoming, "from");

    // Owned or accessed databases & topics
    const relatedStores = sys.stores.filter(
      (s) => s.owner === comp.id || outgoing.some((e) => e.to === s.id),
    );
    const relatedTopics = sys.topics.filter(
      (t) => t.owner === comp.id || outgoing.some((e) => e.to === t.id) || incoming.some((e) => e.from === t.id),
    );

    const matchedSubmodule = codeInfo?.submodule;
    const githubUrl = buildGitHubUrl(codeInfo);
    const totalHandlers = comp.handlers.handlers.length + (comp.handlers.procedures?.length ?? 0);
    const totalData = relatedStores.length + relatedTopics.length;

    const endpointSummary = getComponentRichEndpoints(space, sys, comp, diffMap);
    const totalApis = endpointSummary.displayCount;

    const isModule = comp.component.kind === "module";
    const showApiTab = !isModule || totalApis > 0;
    const showLogicTab = !isModule || totalHandlers > 0;
    const showDataTab = !isModule || totalData > 0;
    const zones = comp.orientation?.zones ?? [];
    const traps = comp.orientation?.traps ?? [];
    const pkgStruct = codeInfo?.package_structure;

    return (
      <div className="detail-page">
        <div className="breadcrumb-bar">
          <div className="breadcrumbs">
            <button className="breadcrumb-btn" onClick={() => onOpenMap()}>{space.config.name}</button>
            <span>/</span>
            <button className="breadcrumb-btn" onClick={() => onOpenEntity(sys.id)}>{sys.system.name}</button>
            <span>/</span>
            <strong style={{ color: "var(--text)" }}>{comp.component.name}</strong>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="secondary-btn" onClick={onBack}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>
        </div>
        {planContextBanner}

        <div className="detail-hero">
          <div className="detail-hero-inner">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span className="badge indigo">{comp.component.kind}</span>
                  {!fromPlan && <span className="badge">As-Is System</span>}
                  {comp.component.tech && <span className="badge">{comp.component.tech}</span>}
                  {pkgStruct && <span className="badge">{pkgStruct.source_files} files</span>}
                  {compComplete && <span className="badge emerald">accounted: {compComplete.accounted_pct}%</span>}
                  {matchedSubmodule && (
                    <span className="badge mono">
                      <GitCommitHorizontal size={12} /> {matchedSubmodule.name} @ {matchedSubmodule.commit.slice(0, 8)}
                    </span>
                  )}
                </div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>{comp.component.name}</h1>
                <div className="mono" style={{ color: "var(--text-faint)", marginTop: 3 }}>{comp.id}</div>
                {comp.component.does && (
                  <p style={{ margin: "10px 0 0 0", fontSize: 14, color: "var(--text-muted)", maxWidth: 780, lineHeight: 1.5 }}>
                    {comp.component.does}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {githubUrl && (
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="secondary-btn"
                    style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <ExternalLink size={14} /> GitHub
                  </a>
                )}
                <button className="secondary-btn" onClick={() => onOpenMap(comp.id)}>
                  <Layers size={14} /> Show on System Map
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 22, marginTop: 18, flexWrap: "wrap" }}>
              <button className={`subtab ${tab === "overview" ? "active" : ""}`} onClick={() => changeTab("overview")}>
                <Server size={14} /> Overview
              </button>
              {isModule && (
                <button className={`subtab ${tab === "code" ? "active" : ""}`} onClick={() => changeTab("code")}>
                  <Compass size={14} /> Codebase Guide {zones.length > 0 ? `(${zones.length} zones)` : ""}
                </button>
              )}
              {showApiTab && (
                <button className={`subtab ${tab === "api" ? "active" : ""}`} onClick={() => changeTab("api")}>
                  <Zap size={14} /> API &amp; Contracts ({totalApis})
                </button>
              )}
              {showLogicTab && (
                <button className={`subtab ${tab === "logic" ? "active" : ""}`} onClick={() => changeTab("logic")}>
                  <GitBranch size={14} /> Logic &amp; Procedures ({totalHandlers})
                </button>
              )}
              {showDataTab && (
                <button className={`subtab ${tab === "data" ? "active" : ""}`} onClick={() => changeTab("data")}>
                  <Database size={14} /> Data &amp; Messages ({totalData})
                </button>
              )}
              {!isModule && (
                <button className={`subtab ${tab === "code" ? "active" : ""}`} onClick={() => changeTab("code")}>
                  <Compass size={14} /> Codebase Guide {zones.length > 0 ? `(${zones.length} zones)` : ""}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="detail-body">
          <div className="detail-inner">
            {tab === "overview" && (
              <>
                <div className="stat-strip">
                  {showApiTab && (
                    <button className="stat-card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => changeTab("api")}>
                      <div className="stat-label">APIs &amp; Routes</div>
                      <div className="stat-value" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>{totalApis}</span>
                        <ArrowRight size={15} color="var(--text-faint)" />
                      </div>
                    </button>
                  )}
                  {showLogicTab && (
                    <button className="stat-card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => changeTab("logic")}>
                      <div className="stat-label">Handlers &amp; Procedures</div>
                      <div className="stat-value" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>{totalHandlers}</span>
                        <ArrowRight size={15} color="var(--text-faint)" />
                      </div>
                    </button>
                  )}
                  {showDataTab && (
                    <button className="stat-card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => changeTab("data")}>
                      <div className="stat-label">Databases &amp; Queues</div>
                      <div className="stat-value" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>{totalData}</span>
                        <ArrowRight size={15} color="var(--text-faint)" />
                      </div>
                    </button>
                  )}
                  <button className="stat-card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => changeTab("code")}>
                    <div className="stat-label">Codebase Footprint</div>
                    <div className="stat-value" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>
                        {zones.length > 0
                          ? `${zones.length} zones · ${pkgStruct?.source_files ?? 0} files`
                          : pkgStruct
                            ? `${pkgStruct.source_files} files`
                            : "Guide"}
                      </span>
                      <ArrowRight size={15} color="var(--text-faint)" />
                    </div>
                  </button>
                  <div className="stat-card" style={{ textAlign: "left" }}>
                    <div className="stat-label">Dependencies</div>
                    <div className="stat-value">
                      {uniqueOutgoing.length} out · {uniqueIncoming.length} in
                    </div>
                  </div>
                </div>

                {comp.orientation?.lifecycle && (
                  <div className="section-card" style={{ borderLeft: "4px solid #0ea5e9" }}>
                    <div className="section-title">Execution Lifecycle</div>
                    <div style={{ fontSize: 13.5, color: "var(--text)", fontWeight: 500, lineHeight: 1.5 }}>
                      {comp.orientation.lifecycle}
                    </div>
                  </div>
                )}

                {((comp.component.invariants && comp.component.invariants.length > 0) || traps.length > 0) && (
                  <div className="section-card" style={{ borderLeft: "4px solid #4f46e5" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div className="section-title" style={{ margin: 0 }}>Architectural Invariants &amp; Traps</div>
                      {traps.length > 0 && (
                        <button className="secondary-btn" style={{ padding: "3px 10px", fontSize: 11.5 }} onClick={() => changeTab("code")}>
                          <AlertTriangle size={12} /> {traps.length} {traps.length === 1 ? "trap" : "traps"} in Codebase Guide
                        </button>
                      )}
                    </div>
                    {(comp.component.invariants ?? []).map((inv, i) => (
                      <div key={i} style={{ fontSize: 13, color: "var(--text)", marginBottom: 4 }}>• {inv}</div>
                    ))}
                    {traps.map((t, i) => (
                      <div key={`trap-${i}`} style={{ fontSize: 13, color: "#b45309", marginBottom: 4 }}>
                        ⚠ <strong>{t.title}:</strong> {t.detail}
                      </div>
                    ))}
                  </div>
                )}

                {endpointSummary.groups.length > 0 && (
                  <div className="section-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div className="section-title" style={{ margin: 0 }}>
                        API Resource Groups ({endpointSummary.displayCount} endpoints)
                      </div>
                      <button className="secondary-btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => changeTab("api")}>
                        Open API Reference <ArrowRight size={12} />
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {endpointSummary.groups.map((g) => (
                        <button
                          key={g.name}
                          type="button"
                          className="entity-link neutral"
                          style={{ padding: "5px 10px", fontSize: 12.5 }}
                          onClick={() => {
                            const firstKey = g.endpoints[0]?.key;
                            setSelectedEndpoint(firstKey);
                            setTab("api");
                            onRoutePatch?.({ tab: "api", endpoint: firstKey });
                          }}
                          title={`Jump to ${g.name} endpoints in API Reference`}
                        >
                          {g.name} <span style={{ opacity: 0.65 }}>({g.endpoints.length})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {zones.length > 0 ? (
                  <div className="section-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div className="section-title" style={{ margin: 0 }}>Architecture Zones ({zones.length})</div>
                      <button className="secondary-btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => changeTab("code")}>
                        Open Codebase Guide <ArrowRight size={12} />
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {zones.map((z) => {
                        const rs = roleStyle(z.role);
                        return (
                          <button
                            key={z.id}
                            type="button"
                            onClick={() => changeTab("code")}
                            style={{
                              cursor: "pointer",
                              background: rs.bg,
                              color: rs.fg,
                              border: `1px solid ${rs.border}`,
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontSize: 12.5,
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                            title={z.summary}
                          >
                            <span>{z.name}</span>
                            <span style={{ opacity: 0.75, fontWeight: 400, fontSize: 11 }}>{z.paths.length} paths</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : comp.component.public_modules && comp.component.public_modules.length > 0 ? (
                  <div className="section-card">
                    <div className="section-title">Public Module Surface ({comp.component.public_modules.length} exports)</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {comp.component.public_modules.map((m) => (
                        <button
                          key={m.name}
                          className="entity-link"
                          onClick={() => changeTab("code")}
                          title={`Browse ${m.name} in Codebase Guide`}
                        >
                          pub mod {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid-2">
                  <div className="section-card">
                    <div className="section-title">Depends On ({uniqueOutgoing.length})</div>
                    {uniqueOutgoing.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>No outgoing dependencies recorded.</div>
                    ) : (
                      uniqueOutgoing.map((e) => (
                        <div key={`${e.id}|${e.kind}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                          <span className="badge">{e.kind}{e.count > 1 ? ` ×${e.count}` : ""}</span>
                          <EntityLink id={e.id} onOpen={(id) => onOpenEntity(id)} />
                        </div>
                      ))
                    )}
                  </div>

                  <div className="section-card">
                    <div className="section-title">Used By ({uniqueIncoming.length})</div>
                    {uniqueIncoming.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>No incoming callers recorded.</div>
                    ) : (
                      uniqueIncoming.map((e) => (
                        <div key={`${e.id}|${e.kind}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                          <EntityLink id={e.id} onOpen={(id) => onOpenEntity(id)} />
                          <span className="badge">{e.kind}{e.count > 1 ? ` ×${e.count}` : ""}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {tab === "api" && (
              <ApiReferenceView
                interfaces={comp.contracts.interfaces ?? []}
                schemas={comp.contracts.schemas ?? []}
                scannedRoutes={scannedRoutes}
                triageRules={comp.component.triage ?? []}
                diffByEntity={diffMap}
                selectedEndpointKey={selectedEndpoint}
                onSelectEndpoint={(key) => {
                  setSelectedEndpoint(key);
                  onRoutePatch?.({ endpoint: key });
                }}
              />
            )}

            {tab === "logic" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {(comp.handlers.procedures?.length ?? 0) > 0 && (
                  <div>
                    <div className="section-title">Reusable Procedures ({comp.handlers.procedures!.length})</div>
                    <div className="grid-2">
                      {comp.handlers.procedures!.map((proc) => (
                        <div key={proc.id} className="section-card">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span className="mono" style={{ fontWeight: 700, color: "var(--accent)" }}>{proc.id}</span>
                            <span className="badge indigo">procedure</span>
                          </div>
                          <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "var(--text-muted)" }}>{proc.summary}</p>
                          <StepTreeView steps={proc.steps} citeBase={proc.cite_base} onNavigate={(id) => onOpenEntity(id)} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="section-title">Entry Handlers ({comp.handlers.handlers.length})</div>
                  {comp.handlers.handlers.length === 0 ? (
                    <div className="section-card" style={{ color: "var(--text-faint)", fontSize: 13 }}>
                      No handlers authored yet (modeling depth: {comp.component.depth ?? "contract-only"}).
                    </div>
                  ) : (
                    comp.handlers.handlers.map((h) => {
                      const stepDiffs = new Map<string, "added" | "modified" | "removed">();
                      for (const [k, v] of diffMap.entries()) {
                        if (k.startsWith(`${h.id}#`)) stepDiffs.set(k.split("#")[1]!, v);
                      }
                      return (
                        <div key={h.id} className="section-card" style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                            <span className="mono" style={{ fontWeight: 700 }}>{h.id}</span>
                            {h.on && <EntityLink id={h.on} label={`on: ${h.on}`} onOpen={(id) => onOpenEntity(id)} />}
                          </div>
                          <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "var(--text-muted)" }}>{h.summary}</p>
                          <StepTreeView steps={h.steps} citeBase={h.cite_base} onNavigate={(id) => onOpenEntity(id)} diffByStepId={stepDiffs} />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {tab === "data" && (
              <div className="grid-2">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="section-title">Databases &amp; Stores ({relatedStores.length})</div>
                  {relatedStores.length === 0 ? (
                    <div className="section-card" style={{ color: "var(--text-faint)", fontSize: 13 }}>No databases owned or accessed by this component.</div>
                  ) : (
                    relatedStores.map((st) => {
                      const stTables = getStoreTables(space, st, diffMap);
                      return (
                        <div key={st.id} className="section-card">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15 }}>{st.name}</div>
                              <div className="mono" style={{ color: "var(--text-faint)", fontSize: 11 }}>
                                {st.id} · {st.tech ?? st.form} · {stTables.length} tables
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="secondary-btn" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => onOpenEntity(st.id, { dbview: "er" })}>
                                <GitFork size={13} /> ER Diagram
                              </button>
                              <button className="primary-btn" onClick={() => onOpenEntity(st.id)}>
                                Open Database <ArrowRight size={13} />
                              </button>
                            </div>
                          </div>
                          {st.notes && <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px 0" }}>{st.notes}</p>}
                          {(st.records ?? []).map((rec) => (
                            <SchemaTableView
                              key={rec.id}
                              title={`Table: ${rec.table ?? rec.id}`}
                              schemaId={rec.id}
                              columns={schemaDefToRows(rec, diffMap)}
                            />
                          ))}
                          {stTables.length > (st.records?.length ?? 0) && (
                            <div style={{ marginTop: 10 }}>
                              <div className="section-title">All Tables ({stTables.length}) — click to inspect</div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {stTables.map((t) => (
                                  <button
                                    key={t.name}
                                    type="button"
                                    className="entity-link neutral mono"
                                    style={{ fontSize: 11.5, padding: "3px 8px" }}
                                    onClick={() => onOpenEntity(st.id, { table: t.name })}
                                    title={`Inspect "${t.name}" (${t.columns.length} columns)`}
                                  >
                                    {t.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="section-title">Message Queues &amp; Async Channels ({relatedTopics.length})</div>
                  {relatedTopics.length === 0 ? (
                    <div className="section-card" style={{ color: "var(--text-faint)", fontSize: 13 }}>No message queues or topics linked to this component.</div>
                  ) : (
                    relatedTopics.map((top) => (
                      <div key={top.id} className="section-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{top.name}</div>
                            <div className="mono" style={{ color: "var(--text-faint)", fontSize: 11 }}>{top.id} · {top.tech ?? top.form}</div>
                          </div>
                          <button className="secondary-btn" onClick={() => onOpenEntity(top.id)}>
                            Open Queue <ArrowRight size={13} />
                          </button>
                        </div>
                        {(top.messages ?? []).map((m) => (
                          <div key={m.id} style={{ padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 12.5 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span className="mono" style={{ fontWeight: 600 }}>{m.id}</span>
                              <span className="badge">{m.semantics}</span>
                            </div>
                            {m.summary && <div style={{ color: "var(--text-muted)", marginTop: 3 }}>{m.summary}</div>}
                          </div>
                        ))}
                        {scannedTopics.length > 0 && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                            <div className="section-title">Scanned Async Channels ({scannedTopics.length})</div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {scannedTopics.slice(0, 20).map((s) => (
                                <span key={`${s.surface_id}:${s.file}`} className="badge mono">{s.surface_id}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {tab === "code" && (
              <CodebaseGuideView
                comp={comp}
                codeInfo={codeInfo}
                orientationStats={compComplete?.orientation}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 2. FULL DATABASE VIEW (`store:*`) ─────────────────────────────────────
  if (storeMatch) {
    const { sys, store } = storeMatch;
    const combinedTables = getStoreTables(space, store, diffMap);

    const writers = space.edges.filter((e) => e.to === store.id && e.kind === "write");
    const readers = space.edges.filter((e) => e.to === store.id && e.kind === "read");

    return (
      <div className="detail-page">
        <div className="breadcrumb-bar">
          <div className="breadcrumbs">
            <button className="breadcrumb-btn" onClick={() => onOpenMap()}>{space.config.name}</button>
            {sys && (
              <>
                <span>/</span>
                <button className="breadcrumb-btn" onClick={() => onOpenEntity(sys.id)}>{sys.system.name}</button>
              </>
            )}
            <span>/</span>
            <strong style={{ color: "var(--text)" }}>{store.name}</strong>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="secondary-btn" onClick={onBack}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>
        </div>
        {planContextBanner}

        <div className="detail-hero" style={{ paddingBottom: 20 }}>
          <div className="detail-hero-inner">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span className="badge teal">Database · {store.form}</span>
                  {!fromPlan && <span className="badge">As-Is System</span>}
                  {store.tech && <span className="badge">{store.tech}</span>}
                  <span className="badge">{combinedTables.length} tables</span>
                  {store.owner === "unknown" ? (
                    <span className="badge amber"><ShieldAlert size={12} /> owner: unknown</span>
                  ) : (
                    <EntityLink id={store.owner} label={`owner: ${store.owner}`} variant="neutral" onOpen={(id) => onOpenEntity(id)} />
                  )}
                </div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{store.name}</h1>
                <div className="mono" style={{ color: "var(--text-faint)", marginTop: 3 }}>{store.id}</div>
                {store.notes && <p style={{ margin: "8px 0 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>{store.notes}</p>}
              </div>
              <button className="secondary-btn" onClick={() => onOpenMap(store.id)}>
                <Layers size={14} /> Show on System Map
              </button>
            </div>
          </div>
        </div>

        <div className="detail-body">
          <div className="detail-inner">
            <div className="grid-2">
              <div className="section-card">
                <div className="section-title">Writers ({writers.length})</div>
                {writers.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>No write edges recorded.</div>
                ) : (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[...new Set(writers.map((w) => w.from))].map((id) => (
                      <EntityLink key={id} id={id} onOpen={(x) => onOpenEntity(x)} />
                    ))}
                  </div>
                )}
              </div>
              <div className="section-card">
                <div className="section-title">Readers ({readers.length})</div>
                {readers.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>No read edges recorded.</div>
                ) : (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[...new Set(readers.map((r) => r.from))].map((id) => (
                      <EntityLink key={id} id={id} onOpen={(x) => onOpenEntity(x)} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DatabaseSchemaView
              tables={combinedTables}
              viewMode={dbView}
              onChangeViewMode={(m) => {
                setDbView(m);
                onRoutePatch?.({ dbview: m });
              }}
              selectedTableName={selectedTableName}
              onSelectTable={(t) => {
                setSelectedTableName(t);
                onRoutePatch?.({ table: t });
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── 3. FULL MESSAGE QUEUE / TOPIC VIEW (`topic:*`) ────────────────────────
  if (topicMatch) {
    const { sys, topic } = topicMatch;
    const publishers = space.edges.filter((e) => e.to === topic.id && e.kind === "publish");
    const consumers = space.edges.filter((e) => e.from === topic.id && e.kind === "consume");
    const scannedChannels = [
      ...new Map(
        getAllScannedSurfaces(space)
          .filter((s) => s.kind === "topic" || s.kind === "subscription")
          .map((s) => [s.surface_id, s]),
      ).values(),
    ];

    return (
      <div className="detail-page">
        <div className="breadcrumb-bar">
          <div className="breadcrumbs">
            <button className="breadcrumb-btn" onClick={() => onOpenMap()}>{space.config.name}</button>
            {sys && (
              <>
                <span>/</span>
                <button className="breadcrumb-btn" onClick={() => onOpenEntity(sys.id)}>{sys.system.name}</button>
              </>
            )}
            <span>/</span>
            <strong style={{ color: "var(--text)" }}>{topic.name}</strong>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="secondary-btn" onClick={onBack}><ArrowLeft size={14} /> Back</button>
          </div>
        </div>
        {planContextBanner}

        <div className="detail-hero" style={{ paddingBottom: 20 }}>
          <div className="detail-hero-inner">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span className="badge violet">Message Queue · {topic.form}</span>
                  {!fromPlan && <span className="badge">As-Is System</span>}
                  {topic.tech && <span className="badge">{topic.tech}</span>}
                  {topic.owner !== "unknown" && <EntityLink id={topic.owner} label={`owner: ${topic.owner}`} variant="neutral" onOpen={(id) => onOpenEntity(id)} />}
                </div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{topic.name}</h1>
                <div className="mono" style={{ color: "var(--text-faint)", marginTop: 3 }}>{topic.id}</div>
              </div>
              <button className="secondary-btn" onClick={() => onOpenMap(topic.id)}>
                <Layers size={14} /> Show on System Map
              </button>
            </div>
          </div>
        </div>

        <div className="detail-body">
          <div className="detail-inner">
            <div className="grid-2">
              <div className="section-card">
                <div className="section-title">Publishers ({publishers.length})</div>
                {publishers.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>No publishers recorded.</div>
                ) : (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[...new Set(publishers.map((p) => p.from))].map((id) => <EntityLink key={id} id={id} onOpen={(x) => onOpenEntity(x)} />)}
                  </div>
                )}
              </div>
              <div className="section-card">
                <div className="section-title">Consumers ({consumers.length})</div>
                {consumers.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>No consumers recorded yet.</div>
                ) : (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[...new Set(consumers.map((c) => c.to))].map((id) => <EntityLink key={id} id={id} onOpen={(x) => onOpenEntity(x)} />)}
                  </div>
                )}
              </div>
            </div>

            <div className="section-card">
              <div className="section-title">Messages ({topic.messages?.length ?? 0})</div>
              {(topic.messages ?? []).map((m) => (
                <div key={m.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="mono" style={{ fontWeight: 700 }}>{m.id}</span>
                    <span className="badge indigo">{m.semantics}</span>
                  </div>
                  {m.summary && <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-muted)" }}>{m.summary}</p>}
                </div>
              ))}
            </div>

            {scannedChannels.length > 0 && (
              <div className="section-card">
                <div className="section-title">Scanned AsyncAPI Channels ({scannedChannels.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {scannedChannels.map((ch) => (
                    <div
                      key={ch.surface_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "7px 0",
                        borderBottom: "1px solid var(--border)",
                        fontSize: 12.5,
                      }}
                    >
                      <span className="mono" style={{ fontWeight: 600 }}>{ch.surface_id}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className={`badge ${ch.kind === "subscription" ? "teal" : "violet"}`}>{ch.kind}</span>
                        <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>{ch.file}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 4. FULL EXTERNAL OR SYSTEM VIEW ───────────────────────────────────────
  if (externalMatch || systemMatch) {
    const title = externalMatch?.external.name ?? systemMatch!.system.name;
    const summary = externalMatch?.external.summary ?? systemMatch!.system.purpose;
    const interfaces = externalMatch?.contracts.interfaces ?? systemMatch?.stub_contracts?.interfaces ?? [];

    return (
      <div className="detail-page">
        <div className="breadcrumb-bar">
          <div className="breadcrumbs">
            <button className="breadcrumb-btn" onClick={() => onOpenMap()}>{space.config.name}</button>
            <span>/</span>
            <strong style={{ color: "var(--text)" }}>{title}</strong>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="secondary-btn" onClick={onBack}><ArrowLeft size={14} /> Back</button>
          </div>
        </div>
        {planContextBanner}

        <div className="detail-hero" style={{ paddingBottom: 20 }}>
          <div className="detail-hero-inner">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  {externalMatch ? (
                    <span className="badge"><Globe size={12} /> External 3rd-Party</span>
                  ) : (
                    <span className={`badge ${systemMatch!.system.mapped ? "indigo" : "amber"}`}>
                      {systemMatch!.system.mapped ? "System" : "Unmapped Stub System"}
                    </span>
                  )}
                  {!fromPlan && <span className="badge">As-Is System</span>}
                  {externalMatch?.external.doc_root && (
                    <a href={externalMatch.external.doc_root} target="_blank" rel="noreferrer" className="entity-link neutral">
                      Documentation <ExternalLink size={11} />
                    </a>
                  )}
                </div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{title}</h1>
                <div className="mono" style={{ color: "var(--text-faint)", marginTop: 3 }}>{entityId}</div>
                <p style={{ margin: "8px 0 0 0", fontSize: 13.5, color: "var(--text-muted)", maxWidth: 740 }}>{summary}</p>
              </div>
              <button className="secondary-btn" onClick={() => onOpenMap(entityId)}>
                <Layers size={14} /> Show on System Map
              </button>
            </div>
          </div>
        </div>

        <div className="detail-body">
          <div className="detail-inner">
            {systemMatch && systemMatch.components.length > 0 && (
              <div className="section-card">
                <div className="section-title">Components ({systemMatch.components.length})</div>
                <div className="grid-2">
                  {systemMatch.components.map((c) => (
                    <button
                      key={c.id}
                      className="section-card"
                      style={{ textAlign: "left", cursor: "pointer", background: "var(--bg)" }}
                      onClick={() => onOpenEntity(c.id)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong>{c.component.name}</strong>
                        <span className="badge">{c.component.kind}</span>
                      </div>
                      <div className="mono" style={{ color: "var(--text-faint)", fontSize: 11, marginTop: 2 }}>{c.id}</div>
                      {c.component.does && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{c.component.does}</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {systemMatch && (systemMatch.stores.length > 0 || systemMatch.topics.length > 0) && (
              <div className="grid-2">
                {systemMatch.stores.length > 0 && (
                  <div className="section-card">
                    <div className="section-title">Databases &amp; Stores ({systemMatch.stores.length})</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {systemMatch.stores.map((st) => {
                        const tblCount = getStoreTables(space, st, diffMap).length;
                        return (
                          <button
                            key={st.id}
                            className="section-card"
                            style={{ textAlign: "left", cursor: "pointer", background: "var(--bg)" }}
                            onClick={() => onOpenEntity(st.id)}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                              <strong>{st.name}</strong>
                              <span className="badge teal">{tblCount} tables</span>
                            </div>
                            <div className="mono" style={{ color: "var(--text-faint)", fontSize: 11, marginTop: 2 }}>
                              {st.id}{st.tech ? ` · ${st.tech}` : ""}
                            </div>
                            {st.notes && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 5 }}>{st.notes}</div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {systemMatch.topics.length > 0 && (
                  <div className="section-card">
                    <div className="section-title">Message Queues &amp; Streams ({systemMatch.topics.length})</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {systemMatch.topics.map((top) => (
                        <button
                          key={top.id}
                          className="section-card"
                          style={{ textAlign: "left", cursor: "pointer", background: "var(--bg)" }}
                          onClick={() => onOpenEntity(top.id)}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <strong>{top.name}</strong>
                            <span className="badge violet">{top.messages?.length ?? 0} msgs</span>
                          </div>
                          <div className="mono" style={{ color: "var(--text-faint)", fontSize: 11, marginTop: 2 }}>
                            {top.id}{top.tech ? ` · ${top.tech}` : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {interfaces.length > 0 && (
              <div>
                <div className="section-title">Known API Contracts</div>
                <ApiReferenceView
                  interfaces={interfaces}
                  schemas={[]}
                  diffByEntity={diffMap}
                  selectedEndpointKey={selectedEndpoint}
                  onSelectEndpoint={(key) => {
                    setSelectedEndpoint(key);
                    onRoutePatch?.({ endpoint: key });
                  }}
                />
              </div>
            )}

            {(() => {
              const externalCallers = [
                ...new Set(
                  incoming
                    .filter((e) => !systemMatch || e.from_system !== systemMatch.id)
                    .map((e) => e.from),
                ),
              ];
              return (
                <div className="section-card">
                  <div className="section-title">Called By ({externalCallers.length})</div>
                  {externalCallers.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>No external callers recorded.</div>
                  ) : (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {externalCallers.map((id) => <EntityLink key={id} id={id} onOpen={(x) => onOpenEntity(x)} />)}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-page">
      <div className="breadcrumb-bar">
        <button className="secondary-btn" onClick={onBack}><ArrowLeft size={14} /> Back</button>
      </div>
      <div className="detail-body">
        <div className="detail-inner">
          <div className="section-card">Entity <code className="mono">{entityId}</code> was not found in this space.</div>
        </div>
      </div>
    </div>
  );
}
