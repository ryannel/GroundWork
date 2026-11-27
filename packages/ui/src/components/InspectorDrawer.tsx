import { ArrowUpRight, ExternalLink, GitBranch, GitFork, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { EntityNavOptions } from "../router";
import type { HandlerDef, SpacePayload } from "../types";
import { getComponentRichEndpoints, getStoreTables } from "../utils/spaceLookup";
import { buildRichEndpoints } from "./shared/ApiReferenceView";
import { DrawerEndpointExplorer, DrawerTableExplorer } from "./shared/DrawerExplorers";
import { EntityLink } from "./shared/EntityLink";
import { StepTreeView } from "./shared/StepTreeView";

interface Props {
  space: SpacePayload;
  selectedId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onOpenFullView: (entityId: string, opts?: string | EntityNavOptions) => void;
}

export function InspectorDrawer({ space, selectedId, onClose, onSelect, onOpenFullView }: Props) {
  const [tab, setTab] = useState<"overview" | "contracts" | "flows">("overview");
  const [activeHandlerId, setActiveHandlerId] = useState<string | null>(null);

  const sys = useMemo(() => space.systems.find((s) => s.id === selectedId), [space, selectedId]);
  const compMatch = useMemo(() => {
    for (const s of space.systems) {
      const c = s.components.find((x) => x.id === selectedId);
      if (c) return { sys: s, comp: c };
    }
    return null;
  }, [space, selectedId]);
  const comp = compMatch?.comp;
  const store = useMemo(
    () => [...space.systems.flatMap((s) => s.stores), ...space.unassigned_stores].find((s) => s.id === selectedId),
    [space, selectedId],
  );
  const topic = useMemo(
    () => [...space.systems.flatMap((s) => s.topics), ...space.unassigned_topics].find((t) => t.id === selectedId),
    [space, selectedId],
  );
  const ext = useMemo(() => space.externals.find((e) => e.id === selectedId), [space, selectedId]);

  const endpointSummary = useMemo(() => {
    if (compMatch) {
      return getComponentRichEndpoints(space, compMatch.sys, compMatch.comp);
    }
    const stubIfaces = sys?.stub_contracts?.interfaces ?? ext?.contracts.interfaces ?? [];
    if (stubIfaces.length === 0) return null;
    const all = buildRichEndpoints(stubIfaces);
    const map = new Map<string, typeof all>();
    for (const ep of all) {
      const arr = map.get(ep.group) ?? [];
      arr.push(ep);
      map.set(ep.group, arr);
    }
    return {
      all,
      business: all,
      triagedCount: 0,
      displayCount: all.length,
      groups: [...map.entries()].map(([name, endpoints]) => ({ name, endpoints })),
    };
  }, [space, compMatch, sys, ext]);

  const storeTables = useMemo(() => (store ? getStoreTables(space, store) : []), [space, store]);
  const allFlows: HandlerDef[] = useMemo(
    () => (comp ? [...comp.handlers.handlers, ...(comp.handlers.procedures ?? [])] : []),
    [comp],
  );

  const hasContractsTab = Boolean((endpointSummary && endpointSummary.all.length > 0) || store || topic);

  useEffect(() => {
    setActiveHandlerId(null);
    if (tab === "contracts" && !hasContractsTab) setTab("overview");
    if (tab === "flows" && allFlows.length === 0) setTab("overview");
  }, [selectedId, hasContractsTab, allFlows.length, tab]);

  if (!selectedId) return null;

  const title =
    sys?.system.name ??
    comp?.component.name ??
    store?.name ??
    topic?.name ??
    ext?.external.name ??
    selectedId;

  const fullViewLabel = store
    ? "Open Full Database View"
    : topic
      ? "Open Full Queue View"
      : comp
        ? comp.component.kind === "module"
          ? "Open Full Module View"
          : comp.component.kind === "app"
            ? "Open Full App View"
            : "Open Full Service View"
        : ext
          ? "Open Provider View"
          : "Open Full System View";

  const dedupeEdges = (list: typeof space.edges, field: "to" | "from") => {
    const map = new Map<string, { id: string; kind: string; count: number }>();
    for (const e of list) {
      const target = e[field];
      if (target === selectedId) continue;
      if (sys && field === "from" && e.from_system === sys.id) continue;
      if (sys && field === "to" && e.to_system === sys.id) continue;
      const k = `${target}|${e.kind}`;
      const cur = map.get(k);
      if (cur) cur.count += 1;
      else map.set(k, { id: target, kind: e.kind, count: 1 });
    }
    return [...map.values()];
  };

  const outgoing = dedupeEdges(
    space.edges.filter((e) => e.from === selectedId || e.from_system === selectedId),
    "to",
  );
  const incoming = dedupeEdges(
    space.edges.filter((e) => e.to === selectedId || e.to_system === selectedId),
    "from",
  );
  const entityGaps = space.gaps.filter((g) => g.entity_id === selectedId || g.entity_id.startsWith(`${selectedId}/`));
  const compComplete = space.completeness.components.find((c) => c.component_id === selectedId);

  const selectedFlow = allFlows.find((f) => f.id === activeHandlerId) ?? allFlows[0];

  return (
    <aside className="inspector">
      <div className="inspector-header">
        <div>
          <div className="mono" style={{ color: "var(--accent)", marginBottom: 3 }}>{selectedId}</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
        </div>
        <button className="icon-btn" onClick={onClose} title="Close inspector">
          <X size={16} />
        </button>
      </div>

      {/* Prominent one-click jump to Full Service / Database / Queue View */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface)", display: "flex", gap: 8 }}>
        <button
          className="primary-btn"
          style={{ flex: 1, justifyContent: "center" }}
          onClick={() => onOpenFullView(selectedId)}
        >
          {fullViewLabel} <ArrowUpRight size={14} />
        </button>
        {store && (
          <button
            className="secondary-btn"
            style={{ padding: "7px 10px", fontSize: 12, flexShrink: 0 }}
            onClick={() => onOpenFullView(store.id, { dbview: "er" })}
            title="Open Entity Relationship Diagram"
          >
            <GitFork size={13} /> ER
          </button>
        )}
      </div>

      <div className="inspector-tabs">
        <button className={`icon-btn ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>
          Overview
        </button>
        {hasContractsTab && (
          <button className={`icon-btn ${tab === "contracts" ? "active" : ""}`} onClick={() => setTab("contracts")}>
            {store
              ? `Tables (${storeTables.length})`
              : topic
                ? `Messages (${topic.messages?.length ?? 0})`
                : `Contracts (${endpointSummary?.displayCount ?? 0})`}
          </button>
        )}
        {allFlows.length > 0 && (
          <button className={`icon-btn ${tab === "flows" ? "active" : ""}`} onClick={() => setTab("flows")}>
            <GitBranch size={13} /> Logic ({allFlows.length})
          </button>
        )}
      </div>

      <div className="inspector-body">
        {tab === "overview" && (
          <>
            <div className="section-card">
              <div className="section-title">Summary</div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {sys?.system.purpose ?? comp?.component.does ?? store?.notes ?? ext?.external.summary ?? "No description recorded."}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {comp?.component.tech && <span className="badge">{comp.component.tech}</span>}
                {compComplete && <span className="badge indigo">depth: {compComplete.depth}</span>}
                {compComplete && <span className="badge emerald">accounted: {compComplete.accounted_pct}%</span>}
                {sys?.system.team && <span className="badge">{sys.system.team}</span>}
                {sys && !sys.system.mapped && <span className="badge amber">mapped: false (stub)</span>}
                {store && <span className="badge teal">{storeTables.length} tables</span>}
                {store && store.owner === "unknown" && <span className="badge amber">owner: unknown</span>}
                {store && store.owner !== "unknown" && (
                  <EntityLink id={store.owner} label={`owner: ${store.owner}`} variant="neutral" onOpen={(id) => onOpenFullView(id)} />
                )}
                {topic && topic.owner === "unknown" && <span className="badge amber">owner: unknown</span>}
                {topic && topic.owner !== "unknown" && (
                  <EntityLink id={topic.owner} label={`owner: ${topic.owner}`} variant="neutral" onOpen={(id) => onOpenFullView(id)} />
                )}
              </div>
              {ext?.external.doc_root && (
                <div style={{ marginTop: 10 }}>
                  <a href={ext.external.doc_root} target="_blank" rel="noreferrer" className="entity-link neutral">
                    External API Docs <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>

            {endpointSummary && endpointSummary.groups.length > 0 && (
              <div className="section-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div className="section-title" style={{ margin: 0 }}>
                    API Surfaces ({endpointSummary.displayCount})
                  </div>
                  <button
                    type="button"
                    className="entity-link"
                    style={{ fontSize: 11, padding: "2px 7px" }}
                    onClick={() => setTab("contracts")}
                  >
                    Browse all →
                  </button>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {endpointSummary.groups.map((g) => (
                    <button
                      key={g.name}
                      type="button"
                      className="entity-link neutral"
                      style={{ fontSize: 11.5, padding: "3px 8px" }}
                      onClick={() =>
                        onOpenFullView(selectedId, {
                          tab: comp ? "api" : undefined,
                          endpoint: g.endpoints[0]?.key,
                        })
                      }
                      title={`Jump directly to ${g.name} endpoints (${g.endpoints.length})`}
                    >
                      {g.name} <span style={{ opacity: 0.65 }}>({g.endpoints.length})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {store && storeTables.length > 0 && (
              <div className="section-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div className="section-title" style={{ margin: 0 }}>
                    Tables ({storeTables.length})
                  </div>
                  <button
                    type="button"
                    className="entity-link"
                    style={{ fontSize: 11, padding: "2px 7px" }}
                    onClick={() => setTab("contracts")}
                  >
                    Filter tables →
                  </button>
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {storeTables.slice(0, 14).map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      className="entity-link neutral mono"
                      style={{ fontSize: 11, padding: "2px 7px" }}
                      onClick={() => onOpenFullView(store.id, { table: t.name })}
                      title={`Open table "${t.name}" (${t.columns.length} columns)`}
                    >
                      {t.name}
                    </button>
                  ))}
                  {storeTables.length > 14 && (
                    <button
                      type="button"
                      className="entity-link"
                      style={{ fontSize: 11, padding: "2px 7px" }}
                      onClick={() => setTab("contracts")}
                    >
                      +{storeTables.length - 14} more
                    </button>
                  )}
                </div>
              </div>
            )}

            {sys && (sys.components.length > 0 || sys.stores.length > 0 || sys.topics.length > 0) && (
              <div className="section-card">
                <div className="section-title">
                  Inside {sys.system.name} ({sys.components.length + sys.stores.length + sys.topics.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {sys.components.map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <EntityLink id={c.id} label={c.component.name} variant="neutral" onOpen={(id) => onOpenFullView(id)} />
                      <span className="badge">{c.component.kind}</span>
                    </div>
                  ))}
                  {sys.stores.map((st) => (
                    <div key={st.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <EntityLink id={st.id} label={st.name} variant="neutral" onOpen={(id) => onOpenFullView(id)} />
                      <span className="badge teal">database</span>
                    </div>
                  ))}
                  {sys.topics.map((t) => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <EntityLink id={t.id} label={t.name} variant="neutral" onOpen={(id) => onOpenFullView(id)} />
                      <span className="badge violet">queue</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {comp?.component.invariants && comp.component.invariants.length > 0 && (
              <div className="section-card" style={{ borderLeft: "3px solid var(--accent)" }}>
                <div className="section-title">Architectural Invariants</div>
                {comp.component.invariants.map((inv, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: "var(--text)", marginBottom: 4 }}>• {inv}</div>
                ))}
              </div>
            )}

            {comp?.orientation?.zones && comp.orientation.zones.length > 0 ? (
              <div className="section-card">
                <div className="section-title">Architecture Zones ({comp.orientation.zones.length})</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {comp.orientation.zones.map((z) => (
                    <button
                      key={z.id}
                      type="button"
                      className="badge indigo"
                      style={{ cursor: "pointer" }}
                      title={z.summary}
                      onClick={() => onOpenFullView(comp.id, { tab: "code" })}
                    >
                      {z.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : comp?.component.public_modules && comp.component.public_modules.length > 0 ? (
              <div className="section-card">
                <div className="section-title">Public Module Surface ({comp.component.public_modules.length})</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {comp.component.public_modules.map((m) => (
                    <button
                      key={m.name}
                      type="button"
                      className="badge indigo mono"
                      style={{ cursor: "pointer" }}
                      onClick={() => onOpenFullView(comp.id, { tab: "code" })}
                    >
                      pub mod {m.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {entityGaps.length > 0 && (
              <div className="section-card" style={{ borderColor: "var(--amber-border)", background: "var(--amber-soft)" }}>
                <div className="section-title" style={{ color: "var(--amber)" }}>Explicit Gaps ({entityGaps.length})</div>
                {entityGaps.map((g, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onOpenFullView(g.entity_id, g.kind.includes("surface") ? { tab: "code" } : undefined)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      padding: "4px 0",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--amber-ink)",
                    }}
                    title="Inspect this gap"
                  >
                    <strong>[{g.kind}]</strong> {g.detail}
                  </button>
                ))}
              </div>
            )}

            <div className="section-card">
              <div className="section-title">Depends On ({outgoing.length})</div>
              {outgoing.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>No outgoing edges recorded.</div>
              ) : (
                outgoing.map((e) => (
                  <div key={`${e.id}|${e.kind}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                    <span className="badge">{e.kind}{e.count > 1 ? ` ×${e.count}` : ""}</span>
                    <EntityLink id={e.id} variant="neutral" onOpen={onSelect} />
                  </div>
                ))
              )}
            </div>

            <div className="section-card">
              <div className="section-title">Used By ({incoming.length})</div>
              {incoming.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>No incoming callers recorded.</div>
              ) : (
                incoming.map((e) => (
                  <div key={`${e.id}|${e.kind}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                    <EntityLink id={e.id} variant="neutral" onOpen={onSelect} />
                    <span className="badge">{e.kind}{e.count > 1 ? ` ×${e.count}` : ""}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === "contracts" && (
          <>
            {endpointSummary && endpointSummary.all.length > 0 && (
              <DrawerEndpointExplorer
                summary={endpointSummary}
                onOpenEndpoint={(endpointKey) =>
                  onOpenFullView(selectedId, {
                    tab: comp ? "api" : undefined,
                    endpoint: endpointKey,
                  })
                }
                onOpenAllApis={() => onOpenFullView(selectedId, { tab: comp ? "api" : undefined })}
              />
            )}

            {store && (
              <DrawerTableExplorer
                tables={storeTables}
                onOpenTable={(tableName) => onOpenFullView(store.id, { table: tableName })}
                onOpenErDiagram={() => onOpenFullView(store.id, { dbview: "er" })}
              />
            )}

            {topic && (topic.messages ?? []).map((m) => (
              <div key={m.id} className="section-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="mono" style={{ fontWeight: 700 }}>{m.id}</span>
                  <span className="badge">{m.semantics}</span>
                </div>
                {m.summary && <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "6px 0 0 0" }}>{m.summary}</p>}
              </div>
            ))}
          </>
        )}

        {tab === "flows" && selectedFlow && (
          <>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {allFlows.map((f) => (
                <button
                  key={f.id}
                  className={`icon-btn mono ${selectedFlow.id === f.id ? "active" : ""}`}
                  style={{ border: "1px solid var(--border)" }}
                  onClick={() => setActiveHandlerId(f.id)}
                >
                  {f.id.replace(/^(handler|procedure):/, "")}
                </button>
              ))}
            </div>
            <div className="section-card">
              <div className="mono" style={{ color: "var(--accent)", marginBottom: 4 }}>{selectedFlow.id}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{selectedFlow.summary}</div>
              <StepTreeView
                steps={selectedFlow.steps}
                citeBase={selectedFlow.cite_base}
                onNavigate={(id) => onOpenFullView(id)}
              />
              {selectedFlow.failures && selectedFlow.failures.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  <div className="section-title" style={{ color: "var(--rose)" }}>Failures</div>
                  {selectedFlow.failures.map((fail) => (
                    <div key={fail.id} style={{ fontSize: 12, color: "var(--rose)", marginBottom: 4 }}>
                      <span className="mono">#!{fail.id}</span> — {fail.when} (returns {fail.return})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
