import { ArrowRight, Building2, FolderKanban, GitFork, Layers, Box, FileCode2 } from "lucide-react";
import { buildHref, isModifiedClick } from "../router";
import type { WorkspaceSummary } from "../types";

interface Props {
  workspaces: readonly WorkspaceSummary[];
  onOpen: (workspaceId: string, projectId?: string) => void;
  onOpenPlans?: (workspaceId: string, projectId?: string) => void;
}

export function WorkspaceLanding({ workspaces, onOpen, onOpenPlans }: Props) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "44px 32px", background: "var(--bg)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span className="badge indigo">Groundwork v3</span>
            <span className="badge">{workspaces.length} registered workspaces</span>
          </div>
          <h1 style={{ margin: "0 0 8px 0", fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em" }}>
            Choose a workspace
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: "var(--text-muted)", maxWidth: 640, lineHeight: 1.55 }}>
            Explore how existing systems work today, inspect real contracts and module boundaries, and collaborate on 4-pillar plans alongside AI agents.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 20 }}>
          {workspaces.map((ws) => {
            const isMulti = ws.mode === "multi-project";
            return (
              <div
                key={ws.id}
                className="section-card"
                style={{
                  padding: 22,
                  borderRadius: 14,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 16,
                  boxShadow: "0 4px 16px rgba(15, 23, 42, 0.05)",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: isMulti ? "var(--teal-soft)" : "var(--accent-soft)",
                          color: isMulti ? "var(--teal)" : "var(--accent)",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        {isMulti ? <FolderKanban size={20} /> : <Building2 size={20} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 17 }}>{ws.name}</div>
                        <div className="mono" style={{ color: "var(--text-faint)", fontSize: 11 }}>{ws.id}</div>
                      </div>
                    </div>
                    <span className={`badge ${isMulti ? "teal" : "indigo"}`}>
                      {isMulti ? "Multi-Project" : "Enterprise Org"}
                    </span>
                  </div>

                  {ws.description && (
                    <p style={{ margin: "0 0 14px 0", fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {ws.description}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--text-muted)", marginBottom: isMulti ? 14 : 0 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Layers size={13} /> <strong>{ws.systems_count ?? 0}</strong> {(ws.systems_count ?? 0) === 1 ? "system" : "systems"}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Box size={13} /> <strong>{ws.components_count ?? 0}</strong> {(ws.components_count ?? 0) === 1 ? "component" : "components"}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <GitFork size={13} /> <strong>{ws.repos_count ?? 0}</strong> {(ws.repos_count ?? 0) === 1 ? "repo" : "repos"}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <FileCode2 size={13} /> <strong>{ws.plans_count ?? 0}</strong> {(ws.plans_count ?? 0) === 1 ? "plan" : "plans"}
                    </span>
                  </div>

                  {isMulti && ws.project_summaries && ws.project_summaries.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                      <div className="section-title" style={{ marginBottom: 2 }}>Projects</div>
                      {ws.project_summaries.map((proj) => {
                        const href = buildHref({ kind: "map", ws: ws.id, project: proj.id });
                        return (
                          <a
                            key={proj.id}
                            href={href}
                            onClick={(e) => {
                              if (isModifiedClick(e)) return;
                              e.preventDefault();
                              onOpen(ws.id, proj.id);
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              textDecoration: "none",
                              padding: "12px 14px",
                              borderRadius: 10,
                              border: "1px solid var(--border-strong)",
                              background: "var(--bg)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{proj.name}</div>
                              {proj.description && (
                                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{proj.description}</div>
                              )}
                              <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11, color: "var(--text-faint)" }}>
                                <span>{proj.systems_count} {proj.systems_count === 1 ? "system" : "systems"}</span>
                                <span>·</span>
                                <span>{proj.components_count} {proj.components_count === 1 ? "component" : "components"}</span>
                                <span>·</span>
                                <span>{proj.repos_count} {proj.repos_count === 1 ? "repo" : "repos"}</span>
                              </div>
                            </div>
                            <ArrowRight size={16} color="var(--accent)" />
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>

                {!isMulti && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <a
                      href={buildHref({ kind: "map", ws: ws.id })}
                      className="primary-btn"
                      onClick={(e) => {
                        if (isModifiedClick(e)) return;
                        e.preventDefault();
                        onOpen(ws.id);
                      }}
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        borderRadius: 9,
                        fontSize: 13.5,
                        textDecoration: "none",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      Open {ws.name} <ArrowRight size={15} />
                    </a>
                    {(ws.plans_count ?? 0) > 0 && onOpenPlans && (
                      <a
                        href={buildHref({ kind: "plans", ws: ws.id })}
                        onClick={(e) => {
                          if (isModifiedClick(e)) return;
                          e.preventDefault();
                          onOpenPlans(ws.id);
                        }}
                        className="secondary-btn"
                        style={{ textDecoration: "none", padding: "10px 14px" }}
                      >
                        <FileCode2 size={14} /> Plans ({ws.plans_count})
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
