import type { HandlerStep } from "../../types";
import { EntityLink } from "./EntityLink";

interface Props {
  steps: readonly HandlerStep[];
  citeBase?: string;
  onNavigate?: (id: string) => void;
  diffByStepId?: ReadonlyMap<string, "added" | "modified" | "removed">;
}

export function StepTreeView({ steps, citeBase, onNavigate, diffByStepId }: Props) {
  return (
    <div>
      {steps.map((step) => {
        const diff = diffByStepId?.get(step.id);
        const targetId = step.call ?? step.publish ?? step.run ?? step.to ?? step.from;
        const badge = step.call
          ? { text: "CALL", cls: "indigo" }
          : step.unresolved_call
            ? { text: "UNRESOLVED", cls: "amber" }
            : step.publish
              ? { text: "PUBLISH", cls: "" }
              : step.write
                ? { text: "WRITE", cls: "" }
                : step.read
                  ? { text: "READ", cls: "" }
                  : step.run
                    ? { text: "PROCEDURE", cls: "indigo" }
                    : step.return !== undefined
                      ? { text: `RETURN ${step.return}`, cls: "emerald" }
                      : step.if
                        ? { text: "IF", cls: "amber" }
                        : null;

        return (
          <div
            key={step.id}
            className={`step-node ${step.if || step.try || step.each ? "step-branch" : ""}`}
            style={
              diff === "added"
                ? { borderColor: "var(--emerald)", background: "var(--emerald-soft)" }
                : diff === "modified"
                  ? { borderColor: "var(--amber)", background: "var(--amber-soft)" }
                  : undefined
            }
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {badge && <span className={`badge ${badge.cls}`}>{badge.text}</span>}
                <strong>{step.say ?? (step.if ? step.if : step.id)}</strong>
                {diff && (
                  <span className={`badge ${diff === "added" ? "emerald" : diff === "modified" ? "amber" : "rose"}`}>
                    {diff}
                  </span>
                )}
              </div>
              <span className="mono" style={{ color: "var(--text-faint)", fontSize: 10.5 }}>#{step.id}</span>
            </div>

            {step.does && <div style={{ color: "var(--text-muted)", marginTop: 4 }}>{step.does}</div>}

            {(targetId || step.read || step.write) && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {step.read && onNavigate && <EntityLink id={step.read} variant="neutral" onOpen={onNavigate} />}
                {step.write && onNavigate && <EntityLink id={step.write} variant="neutral" onOpen={onNavigate} />}
                {targetId && onNavigate && <EntityLink id={targetId} onOpen={onNavigate} />}
                {targetId && !onNavigate && <span className="mono" style={{ color: "var(--text-muted)" }}>{targetId}</span>}
              </div>
            )}

            {step.cites && step.cites.length > 0 && (
              <div className="mono" style={{ color: "var(--text-faint)", fontSize: 10.5, marginTop: 5 }}>
                {citeBase ?? ""}{typeof step.cites[0] === "string" ? step.cites[0] : JSON.stringify(step.cites[0])}
              </div>
            )}

            {step.then && step.then.length > 0 && (
              <div className="step-children">
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", marginBottom: 4 }}>THEN</div>
                <StepTreeView steps={step.then} citeBase={citeBase} onNavigate={onNavigate} diffByStepId={diffByStepId} />
              </div>
            )}
            {step.else && step.else.length > 0 && (
              <div className="step-children">
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", marginBottom: 4 }}>ELSE</div>
                <StepTreeView steps={step.else} citeBase={citeBase} onNavigate={onNavigate} diffByStepId={diffByStepId} />
              </div>
            )}
            {step.steps && step.steps.length > 0 && (
              <div className="step-children">
                <StepTreeView steps={step.steps} citeBase={citeBase} onNavigate={onNavigate} diffByStepId={diffByStepId} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
