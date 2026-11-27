import { ArrowUpRight, ExternalLink, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LoadedPlanPayload, SpacePayload } from "../../types";
import { buildRichEndpoints, EndpointSpecCard } from "./ApiReferenceView";
import { EntityLink } from "./EntityLink";
import { schemaDefToRows, SchemaTableView } from "./SchemaTableView";
import { StepTreeView } from "./StepTreeView";

interface Props {
  space: SpacePayload;
  plan?: LoadedPlanPayload;
  targetId: string | null;
  onClose: () => void;
  onPeek: (id: string) => void;
  onOpenFullView: (entityId: string, tab?: string) => void;
}

/**
 * Rich contextual Quick Peek drawer: answers "What is this service's API schema?",
 * "How does this procedure work?", or "What does this table look like?" right where you are
 * without forcing you to leave the Plan Walkthrough — plus one-click jump to the Full Page!
 */
export function QuickPeekDrawer({ space, plan, targetId, onClose, onPeek, onOpenFullView }: Props) {
  const [compTab, setCompTab] = useState<"api" | "logic" | "data" | "overview">("api");

  const systems = plan ? plan.after_systems : space.systems;
  const baseId = targetId?.split("#")[0] ?? "";
  const childSlug = targetId?.includes("#") ? targetId.split("#")[1] : undefined;

  const diffMap = useMemo(() => {
    const m = new Map<string, "added" | "modified" | "removed">();
    for (const d of plan?.diff ?? []) m.set(d.entity_id, d.kind);
    return m;
  }, [plan]);

  // Reset component tab sensibly whenever the peeked component changes
  const matchedComp = useMemo(() => {
    if (!baseId) return null;
    for (const sys of systems) {
      const c = sys.components.find(
        (x) => x.id === baseId || baseId.startsWith(`screen:${x.slug}/`),
      );
      if (c) return { sys, comp: c };
    }
    return null;
  }, [systems, baseId]);

  useEffect(() => {
    if (!matchedComp) return;
    const hasApis = (matchedComp.comp.contracts.interfaces?.reduce((a, i) => a + i.entries.length, 0) ?? 0) > 0;
    const hasLogic = matchedComp.comp.handlers.handlers.length + (matchedComp.comp.handlers.procedures?.length ?? 0) > 0;
    setCompTab(hasApis ? "api" : hasLogic ? "logic" : "overview");
  }, [matchedComp?.comp.id]);

  if (!targetId) return null;

  const planBanner = plan ? (
    <div
      style={{
        padding: "6px 14px",
        background: "var(--accent-soft)",
        borderBottom: "1px solid var(--accent-border)",
        fontSize: 11.5,
        color: "var(--accent-ink)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span>
        <strong>Plan Preview:</strong> {plan.slug}
      </span>
      <span className="badge emerald" style={{ fontSize: 10 }}>Proposed</span>
    </div>
  ) : null;

  // 1. Procedure or Handler
  for (const sys of systems) {
    for (const comp of sys.components) {
      const proc = (comp.handlers.procedures ?? []).find((p) => p.id === baseId);
      const handler = comp.handlers.handlers.find((h) => h.id === baseId);
      const flow = proc ?? handler;
      if (flow) {
        const stepDiffs = new Map<string, "added" | "modified" | "removed">();
        for (const d of plan?.diff ?? []) {
          if (d.entity_id.startsWith(`${flow.id}#`)) {
            stepDiffs.set(d.entity_id.split("#")[1]!, d.kind);
          }
        }
        return (
          <aside className="quick-peek">
            {planBanner}
            <div className="inspector-header">
              <div>
                <div className="badge indigo" style={{ marginBottom: 4 }}>{proc ? "Procedure" : "Handler"}</div>
                <div className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{flow.id}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>in {comp.component.name}</div>
              </div>
              <button className="icon-btn" onClick={onClose} title="Close"><X size={16} /></button>
            </div>
            <div className="inspector-body">
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{flow.summary}</p>
              <StepTreeView steps={flow.steps} citeBase={flow.cite_base} onNavigate={onPeek} diffByStepId={stepDiffs} />
              <div style={{ paddingTop: 6 }}>
                <button className="primary-btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => onOpenFullView(comp.id, "logic")}>
                  Open Full Service View ({comp.component.name}) <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          </aside>
        );
      }
    }
  }

  // 2. Schema or Store
  for (const sys of systems) {
    for (const st of sys.stores) {
      const rec = (st.records ?? []).find((r) => r.id === baseId);
      if (st.id === baseId || rec) {
        const records = rec ? [rec] : (st.records ?? []);
        return (
          <aside className="quick-peek">
            {planBanner}
            <div className="inspector-header">
              <div>
                <div className="badge teal" style={{ marginBottom: 4 }}>Database{rec ? ` · Table ${rec.table ?? rec.id}` : ""}</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{st.name}</div>
                <div className="mono" style={{ color: "var(--text-faint)", fontSize: 11 }}>{st.id}</div>
              </div>
              <button className="icon-btn" onClick={onClose} title="Close"><X size={16} /></button>
            </div>
            <div className="inspector-body">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {st.tech && <span className="badge">{st.tech}</span>}
                <span className="badge">form: {st.form}</span>
                {st.owner !== "unknown" && <EntityLink id={st.owner} variant="neutral" onOpen={(id) => onPeek(id)} />}
              </div>
              {childSlug && (
                <div className="badge emerald" style={{ alignSelf: "flex-start" }}>
                  Focused column: #{childSlug}
                </div>
              )}
              {records.map((r) => (
                <SchemaTableView
                  key={r.id}
                  title={`Table: ${r.table ?? r.id}`}
                  schemaId={r.id}
                  columns={schemaDefToRows(r, diffMap)}
                />
              ))}
              <button className="primary-btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => onOpenFullView(st.id)}>
                Open Full Database View ({st.name}) <ArrowUpRight size={14} />
              </button>
            </div>
          </aside>
        );
      }
    }
    for (const comp of sys.components) {
      const dto = (comp.contracts.schemas ?? []).find((s) => s.id === baseId);
      if (dto) {
        return (
          <aside className="quick-peek">
            {planBanner}
            <div className="inspector-header">
              <div>
                <div className="badge" style={{ marginBottom: 4 }}>API Schema ({dto.kind})</div>
                <div className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{dto.id}</div>
              </div>
              <button className="icon-btn" onClick={onClose}><X size={16} /></button>
            </div>
            <div className="inspector-body">
              <SchemaTableView title={dto.id} columns={schemaDefToRows(dto, diffMap)} />
              <button className="primary-btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => onOpenFullView(comp.id, "api")}>
                Open Full API Reference ({comp.component.name}) <ArrowUpRight size={14} />
              </button>
            </div>
          </aside>
        );
      }
    }
  }

  // 3. Endpoint (on component or stub system)
  for (const sys of systems) {
    for (const comp of sys.components) {
      for (const iface of comp.contracts.interfaces ?? []) {
        const ep = iface.entries.find((e) => e.id === baseId);
        if (ep) {
          const rich = buildRichEndpoints([{ ...iface, entries: [ep] }], comp.contracts.schemas ?? [], [], [], diffMap)[0];
          return (
            <aside className="quick-peek">
              {planBanner}
              <div className="inspector-header">
                <div>
                  <div className="badge indigo" style={{ marginBottom: 4 }}>Endpoint · {comp.component.name}</div>
                  <div className="mono" style={{ fontWeight: 700, fontSize: 13 }}>{ep.id}</div>
                </div>
                <button className="icon-btn" onClick={onClose}><X size={16} /></button>
              </div>
              <div className="inspector-body">
                {rich && <EndpointSpecCard endpoint={rich} />}
                <button className="primary-btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => onOpenFullView(comp.id, "api")}>
                  Open Full API Reference ({comp.component.name}) <ArrowUpRight size={14} />
                </button>
              </div>
            </aside>
          );
        }
      }
    }
    for (const iface of sys.stub_contracts?.interfaces ?? []) {
      const ep = iface.entries.find((e) => e.id === baseId);
      if (ep || sys.id === baseId) {
        const richList = buildRichEndpoints(
          ep ? [{ ...iface, entries: [ep] }] : (sys.stub_contracts?.interfaces ?? []),
          [],
          [],
          [],
          diffMap,
        );
        return (
          <aside className="quick-peek">
            {planBanner}
            <div className="inspector-header">
              <div>
                <div className="badge amber" style={{ marginBottom: 4 }}>Internal API (Unmapped Stub)</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{sys.system.name}</div>
                <div className="mono" style={{ color: "var(--text-faint)", fontSize: 11 }}>{ep?.id ?? sys.id}</div>
              </div>
              <button className="icon-btn" onClick={onClose}><X size={16} /></button>
            </div>
            <div className="inspector-body">
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>{sys.system.purpose}</p>
              {richList.map((r) => (
                <EndpointSpecCard key={r.key} endpoint={r} />
              ))}
              <button className="primary-btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => onOpenFullView(sys.id)}>
                Open Full System View <ArrowUpRight size={14} />
              </button>
            </div>
          </aside>
        );
      }
    }
  }

  // 4. External or External Endpoint
  for (const ext of space.externals) {
    const ep = (ext.contracts.interfaces ?? []).flatMap((i) => i.entries.map((e) => ({ iface: i, ep: e }))).find((x) => x.ep.id === baseId);
    if (ext.id === baseId || ep) {
      const richList = buildRichEndpoints(
        ep ? [{ ...ep.iface, entries: [ep.ep] }] : (ext.contracts.interfaces ?? []),
        [],
        [],
        [],
        diffMap,
      );
      return (
        <aside className="quick-peek">
          {planBanner}
          <div className="inspector-header">
            <div>
              <div className="badge" style={{ marginBottom: 4 }}>External 3rd-Party API</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{ext.external.name}</div>
              <div className="mono" style={{ color: "var(--text-faint)", fontSize: 11 }}>{ep?.ep.id ?? ext.id}</div>
            </div>
            <button className="icon-btn" onClick={onClose}><X size={16} /></button>
          </div>
          <div className="inspector-body">
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>{ext.external.summary}</p>
            {ext.external.doc_root && (
              <a href={ext.external.doc_root} target="_blank" rel="noreferrer" className="entity-link neutral" style={{ alignSelf: "flex-start" }}>
                Vendor API Documentation <ExternalLink size={12} />
              </a>
            )}
            {richList.map((r) => (
              <EndpointSpecCard key={r.key} endpoint={r} />
            ))}
            <button className="primary-btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => onOpenFullView(ext.id)}>
              Open External Provider View <ArrowUpRight size={14} />
            </button>
          </div>
        </aside>
      );
    }
  }

  // 5. Message or Topic
  for (const sys of systems) {
    for (const top of sys.topics) {
      const msg = (top.messages ?? []).find((m) => m.id === baseId);
      if (top.id === baseId || msg) {
        return (
          <aside className="quick-peek">
            {planBanner}
            <div className="inspector-header">
              <div>
                <div className="badge violet" style={{ marginBottom: 4 }}>Message Queue / Stream</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{top.name}</div>
                <div className="mono" style={{ color: "var(--text-faint)", fontSize: 11 }}>{msg?.id ?? top.id}</div>
              </div>
              <button className="icon-btn" onClick={onClose}><X size={16} /></button>
            </div>
            <div className="inspector-body">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {top.tech && <span className="badge">{top.tech}</span>}
                <span className="badge">form: {top.form}</span>
              </div>
              {(msg ? [msg] : (top.messages ?? [])).map((m) => (
                <div key={m.id} className="section-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="mono" style={{ fontWeight: 700 }}>{m.id}</span>
                    <span className="badge">{m.semantics}</span>
                  </div>
                  {m.summary && <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "6px 0 0 0" }}>{m.summary}</p>}
                </div>
              ))}
              <button className="primary-btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => onOpenFullView(top.id)}>
                Open Full Queue View ({top.name}) <ArrowUpRight size={14} />
              </button>
            </div>
          </aside>
        );
      }
    }
  }

  // 6. Component itself — NOW RICH & TABBED IN PLACE (APIs + Request/Response Schemas, Logic, Data, Overview!)
  if (matchedComp) {
    const { sys, comp } = matchedComp;
    const richEndpoints = buildRichEndpoints(
      comp.contracts.interfaces ?? [],
      comp.contracts.schemas ?? [],
      [],
      comp.component.triage ?? [],
      diffMap,
    );
    const allFlows = [...comp.handlers.handlers, ...(comp.handlers.procedures ?? [])];
    const outgoing = space.edges.filter((e) => e.from === comp.id);
    const relatedStores = sys.stores.filter((s) => s.owner === comp.id || outgoing.some((e) => e.to === s.id));
    const relatedTopics = sys.topics.filter((t) => t.owner === comp.id || outgoing.some((e) => e.to === t.id));

    return (
      <aside className="quick-peek">
        {planBanner}
        <div className="inspector-header">
          <div>
            <div className="badge indigo" style={{ marginBottom: 4 }}>{comp.component.kind}</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{comp.component.name}</div>
            <div className="mono" style={{ color: "var(--text-faint)", fontSize: 11 }}>{comp.id}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="inspector-tabs">
          <button className={`icon-btn ${compTab === "api" ? "active" : ""}`} onClick={() => setCompTab("api")}>
            APIs ({richEndpoints.length})
          </button>
          <button className={`icon-btn ${compTab === "logic" ? "active" : ""}`} onClick={() => setCompTab("logic")}>
            Logic ({allFlows.length})
          </button>
          <button className={`icon-btn ${compTab === "data" ? "active" : ""}`} onClick={() => setCompTab("data")}>
            Data ({relatedStores.length + relatedTopics.length})
          </button>
          <button className={`icon-btn ${compTab === "overview" ? "active" : ""}`} onClick={() => setCompTab("overview")}>
            Overview
          </button>
        </div>

        <div className="inspector-body">
          {compTab === "api" && (
            <>
              {richEndpoints.length === 0 ? (
                <div className="section-card" style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
                  No authored endpoints on this component yet. Open Full View to inspect scanned routes.
                </div>
              ) : (
                richEndpoints.slice(0, 8).map((ep) => <EndpointSpecCard key={ep.key} endpoint={ep} />)
              )}
            </>
          )}

          {compTab === "logic" && (
            <>
              {allFlows.length === 0 ? (
                <div className="section-card" style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
                  No handlers or procedures recorded yet.
                </div>
              ) : (
                allFlows.map((f) => {
                  const stepDiffs = new Map<string, "added" | "modified" | "removed">();
                  for (const d of plan?.diff ?? []) {
                    if (d.entity_id.startsWith(`${f.id}#`)) stepDiffs.set(d.entity_id.split("#")[1]!, d.kind);
                  }
                  return (
                    <div key={f.id} className="section-card">
                      <div className="mono" style={{ fontWeight: 700, fontSize: 12, color: "var(--accent)", marginBottom: 4 }}>{f.id}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{f.summary}</div>
                      <StepTreeView steps={f.steps} citeBase={f.cite_base} onNavigate={onPeek} diffByStepId={stepDiffs} />
                    </div>
                  );
                })
              )}
            </>
          )}

          {compTab === "data" && (
            <>
              {relatedStores.map((st) => (
                <div key={st.id} className="section-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <strong style={{ fontSize: 13 }}>{st.name}</strong>
                    <button className="entity-link" onClick={() => onPeek(st.id)}>Inspect DB</button>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>{st.id} · {st.tech ?? st.form}</div>
                </div>
              ))}
              {relatedTopics.map((t) => (
                <div key={t.id} className="section-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <strong style={{ fontSize: 13 }}>{t.name}</strong>
                    <button className="entity-link" onClick={() => onPeek(t.id)}>Inspect Queue</button>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>{t.id} · {t.tech ?? t.form}</div>
                </div>
              ))}
              {relatedStores.length === 0 && relatedTopics.length === 0 && (
                <div className="section-card" style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
                  No databases or queues linked to this component.
                </div>
              )}
            </>
          )}

          {compTab === "overview" && (
            <>
              {comp.component.does && <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{comp.component.does}</p>}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {comp.component.tech && <span className="badge">{comp.component.tech}</span>}
                {comp.component.depth && <span className="badge">depth: {comp.component.depth}</span>}
              </div>
              {outgoing.length > 0 && (
                <div className="section-card">
                  <div className="section-title">Depends On ({outgoing.length})</div>
                  {outgoing.map((e, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                      <span className="badge">{e.kind}</span>
                      <EntityLink id={e.to} onOpen={onPeek} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <button
            className="primary-btn"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => onOpenFullView(comp.id, compTab)}
          >
            Open Full {comp.component.kind === "module" ? "Module" : "Service"} Page ({comp.component.name}) <ArrowUpRight size={14} />
          </button>
        </div>
      </aside>
    );
  }

  return null;
}
