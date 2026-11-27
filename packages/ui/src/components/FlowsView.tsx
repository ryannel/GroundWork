import { ArrowRight, ChevronLeft, ChevronRight, GitBranch, User } from "lucide-react";
import { useEffect, useState } from "react";
import type { SpacePayload } from "../types";
import { EntityLink } from "./shared/EntityLink";
import { QuickPeekDrawer } from "./shared/QuickPeekDrawer";

interface Props {
  space: SpacePayload;
  onOpenEntity: (entityId: string, tab?: string) => void;
}

/**
 * Interactive Cross-System Flows explorer (outside of Plans):
 * Step through end-to-end journeys with keyboard arrows, inspect any step's API/handler/table
 * in place via QuickPeekDrawer, or jump directly to any Full Service / Database view.
 */
export function FlowsView({ space, onOpenEntity }: Props) {
  const [activeFlowId, setActiveFlowId] = useState<string>(space.flows[0]?.id ?? "");
  const [stepIdx, setStepIdx] = useState(0);
  const [peekId, setPeekId] = useState<string | null>(null);

  const flow = space.flows.find((f) => f.id === activeFlowId) ?? space.flows[0];

  useEffect(() => {
    setStepIdx(0);
    setPeekId(null);
  }, [flow?.id]);

  useEffect(() => {
    if (!flow) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setStepIdx((i) => Math.min(flow.steps.length - 1, i + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setStepIdx((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flow]);

  if (!flow) {
    return (
      <div className="studio-content" style={{ flex: 1 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <h2 style={{ marginTop: 0 }}>Cross-System Data Movement Flows</h2>
          <div className="section-card" style={{ color: "var(--text-faint)", fontSize: 13 }}>
            No cross-system flows recorded in this space yet.
          </div>
        </div>
      </div>
    );
  }

  const activeStep = flow.steps[stepIdx] ?? flow.steps[0];

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <div className="studio-content" style={{ flex: 1 }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span className="badge indigo"><GitBranch size={11} /> Cross-System Flow</span>
                {flow.actor && <span className="badge"><User size={11} /> {flow.actor}</span>}
                <span className="badge">As-Is System</span>
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>{flow.name}</h2>
              <div className="mono" style={{ color: "var(--text-faint)", marginTop: 2 }}>{flow.id}</div>
            </div>

            {space.flows.length > 1 && (
              <select
                className="select"
                value={flow.id}
                onChange={(e) => setActiveFlowId(e.target.value)}
              >
                {space.flows.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.steps.length} steps)
                  </option>
                ))}
              </select>
            )}
          </div>

          <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", maxWidth: 780, lineHeight: 1.55 }}>
            {flow.summary}
          </p>

          {/* Interactive Stepper Control Bar */}
          {activeStep && (
            <div
              className="section-card"
              style={{
                borderLeft: "4px solid var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span className="badge indigo">Step {stepIdx + 1} of {flow.steps.length}</span>
                  <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Use ← → keys or click any step card</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{activeStep.label}</div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <EntityLink
                    id={activeStep.ref}
                    label={`Inspect ${activeStep.ref}`}
                    onOpen={(id) => setPeekId(id)}
                  />
                  <button
                    className="secondary-btn"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={() => onOpenEntity(activeStep.ref)}
                  >
                    Open Full Page <ArrowRight size={12} />
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="secondary-btn"
                  onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                  disabled={stepIdx === 0}
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  className="secondary-btn"
                  onClick={() => setStepIdx((i) => Math.min(flow.steps.length - 1, i + 1))}
                  disabled={stepIdx >= flow.steps.length - 1}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Connected Step Cards Grid */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            {flow.steps.map((st, idx) => {
              const isSel = idx === stepIdx;
              return (
                <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setStepIdx(idx);
                      setPeekId(st.ref);
                    }}
                    className="section-card"
                    style={{
                      width: 268,
                      cursor: "pointer",
                      border: isSel ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                      background: isSel ? "var(--accent-soft)" : "var(--surface)",
                      boxShadow: isSel ? "0 0 0 3px rgba(99,102,241,0.18)" : "none",
                      transition: "border-color 0.12s, box-shadow 0.12s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span
                        className="mono"
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          background: isSel ? "var(--accent)" : "var(--surface-muted)",
                          color: isSel ? "#fff" : "var(--text)",
                          display: "inline-grid",
                          placeItems: "center",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{st.label}</span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <EntityLink id={st.ref} onOpen={(id) => onOpenEntity(id)} />
                    </div>
                  </div>
                  {idx < flow.steps.length - 1 && <ArrowRight size={16} color="var(--text-faint)" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <QuickPeekDrawer
        space={space}
        targetId={peekId}
        onClose={() => setPeekId(null)}
        onPeek={(id) => setPeekId(id)}
        onOpenFullView={(entityId, tab) => onOpenEntity(entityId, tab)}
      />
    </div>
  );
}
