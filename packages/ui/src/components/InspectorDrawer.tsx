import { ArrowUpRight, ExternalLink, GitBranch, X } from "lucide-react";
import { useState } from "react";
import type { HandlerDef, SpacePayload } from "../types";
import { buildRichEndpoints, EndpointSpecCard } from "./shared/ApiReferenceView";
import { EntityLink } from "./shared/EntityLink";
import { schemaDefToRows, SchemaTableView } from "./shared/SchemaTableView";
import { StepTreeView } from "./shared/StepTreeView";

interface Props {
  space: SpacePayload;
  selectedId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onOpenFullView: (entityId: string, tab?: string) => void;
}

export function InspectorDrawer({ space, selectedId, onClose, onSelect, onOpenFullView }: Props) {
  const [tab, setTab] = useState<"overview" | "contracts" | "flows">("overview");
  const [activeHandlerId, setActiveHandlerId] = useState<string | null>(null);

  if (!selectedId) return null;

  const sys = space.systems.find((s) => s.id === selectedId);
  const comp = space.systems.flatMap((s) => s.components).find((c) => c.id === selectedId);
  const store = [...space.systems.flatMap((s) => s.stores), ...space.unassigned_stores].find((s) => s.id === selectedId);
  const topic = [...space.systems.flatMap((s) => s.topics), ...space.unassigned_topics].find((t) => t.id === selectedId);
  const ext = space.externals.find((e) => e.id === selectedId);

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

  const outgoing = space.edges.filter((e) => e.from === selectedId || e.from_system === selectedId);
  const incoming = space.edges.filter((e) => e.to === selectedId || e.to_system === selectedId);
  const entityGaps = space.gaps.filter((g) => g.entity_id === selectedId || g.entity_id.startsWith(`${selectedId}/`));
  const compComplete = space.completeness.components.find((c) => c.component_id === selectedId);

  const interfaces = comp?.contracts.interfaces ?? sys?.stub_contracts?.interfaces ?? ext?.contracts.interfaces ?? [];
  const allFlows: HandlerDef[] = comp
    ? [...comp.handlers.handlers, ...(comp.handlers.procedures ?? [])]
    : [];
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
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <button
          className="primary-btn"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={() => onOpenFullView(selectedId)}
        >
          {fullViewLabel} <ArrowUpRight size={14} />
        </button>
      </div>

      <div className="inspector-tabs">
        <button className={`icon-btn ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>
          Overview
        </button>
        {(interfaces.length > 0 || store || topic) && (
          <button className={`icon-btn ${tab === "contracts" ? "active" : ""}`} onClick={() => setTab("contracts")}>
            {store ? "Tables" : topic ? "Messages" : `Contracts (${interfaces.reduce((a, i) => a + i.entries.length, 0)})`}
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

            {comp?.component.public_modules && comp.component.public_modules.length > 0 && (
              <div className="section-card">
                <div className="section-title">Public Module Surface ({comp.component.public_modules.length})</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {comp.component.public_modules.map((m) => (
                    <span key={m.name} className="badge indigo mono">pub mod {m.name}</span>
                  ))}
                </div>
              </div>
            )}

            {entityGaps.length > 0 && (
              <div className="section-card" style={{ borderColor: "var(--amber-border)", background: "var(--amber-soft)" }}>
                <div className="section-title" style={{ color: "var(--amber)" }}>Explicit Gaps ({entityGaps.length})</div>
                {entityGaps.map((g, i) => (
                  <div key={i} style={{ fontSize: 12, color: "var(--amber-ink)", marginBottom: 4 }}>
                    <strong>[{g.kind}]</strong> {g.detail}
                  </div>
                ))}
              </div>
            )}

            <div className="section-card">
              <div className="section-title">Depends On ({outgoing.length})</div>
              {outgoing.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>No outgoing edges recorded.</div>
              ) : (
                outgoing.map((e, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                    <span className="badge">{e.kind}</span>
                    <EntityLink id={e.to} variant="neutral" onOpen={onSelect} />
                  </div>
                ))
              )}
            </div>

            <div className="section-card">
              <div className="section-title">Used By ({incoming.length})</div>
              {incoming.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>No incoming callers recorded.</div>
              ) : (
                incoming.map((e, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                    <EntityLink id={e.from} variant="neutral" onOpen={onSelect} />
                    <span className="badge">{e.kind}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === "contracts" && (
          <>
            {interfaces.length > 0 &&
              buildRichEndpoints(interfaces, comp?.contracts.schemas ?? []).slice(0, 8).map((ep) => (
                <EndpointSpecCard key={ep.key} endpoint={ep} />
              ))}

            {store && (store.records ?? []).map((rec) => (
              <SchemaTableView
                key={rec.id}
                title={`Table: ${rec.table ?? rec.id}`}
                schemaId={rec.id}
                columns={schemaDefToRows(rec)}
              />
            ))}

            {store && (() => {
              const authoredNames = new Set((store.records ?? []).map((r) => r.table ?? r.id));
              const scanned = Object.values(space.evidence ?? {})
                .flatMap((ev) => ev.inventory?.surfaces ?? [])
                .filter((s) => s.kind === "table" && !authoredNames.has(s.symbol ?? s.surface_id));
              if (scanned.length === 0) return null;
              return (
                <div className="section-card">
                  <div className="section-title">Scanned SQL Tables ({scanned.length})</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {scanned.slice(0, 18).map((s) => (
                      <button
                        key={s.surface_id}
                        className="entity-link neutral"
                        onClick={() => onOpenFullView(store.id)}
                      >
                        {s.symbol ?? s.surface_id}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

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
