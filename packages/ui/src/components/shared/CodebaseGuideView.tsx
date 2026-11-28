import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Compass,
  ExternalLink,
  FileCode2,
  FolderOpen,
  Layers,
  Play,
  Terminal,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import type {
  ComponentCodeInfoPayload,
  LoadedComponent,
  ModuleSurfaceCountsPayload,
  OrientationZoneRole,
  StructureModulePayload,
} from "../../types";

interface Props {
  comp: LoadedComponent;
  codeInfo?: ComponentCodeInfoPayload;
  orientationStats?: {
    readonly tier: "compact" | "standard" | "deep";
    readonly orientation_required: boolean;
    readonly has_orientation: boolean;
    readonly zone_count: number;
    readonly significant_modules: number;
    readonly covered_modules: number;
    readonly uncovered_modules: readonly string[];
    readonly coverage_pct: number;
    readonly broken_paths: readonly string[];
  };
}

function formatLoc(loc: number): string {
  if (loc >= 1000) return `${(loc / 1000).toFixed(1)}k LOC`;
  return `${loc} LOC`;
}

export function buildGitHubUrl(
  codeInfo: ComponentCodeInfoPayload | undefined,
  pkgRelPath?: string,
  kind: "tree" | "blob" = "tree",
): string | null {
  if (!codeInfo?.web_url) return null;
  const base = codeInfo.web_url.replace(/\/+$/, "");
  const ref = codeInfo.git_ref || "main";
  const parts: string[] = [];
  if (codeInfo.repo_subpath) parts.push(codeInfo.repo_subpath.replace(/^\/+|\/+$/g, ""));
  if (pkgRelPath) parts.push(pkgRelPath.replace(/^\.\//, "").replace(/^\/+|\/+$/g, ""));
  if (parts.length === 0) return base;
  return `${base}/${kind}/${ref}/${parts.join("/")}`;
}

export function roleStyle(role: OrientationZoneRole): { bg: string; fg: string; border: string; label: string } {
  switch (role) {
    case "core":
      return { bg: "var(--accent-soft)", fg: "var(--accent)", border: "var(--accent-border)", label: "Core Spine" };
    case "contract":
      return { bg: "var(--teal-soft)", fg: "var(--teal)", border: "var(--teal-border)", label: "Contracts" };
    case "feature":
      return { bg: "var(--emerald-soft)", fg: "var(--emerald)", border: "var(--emerald-border)", label: "Feature" };
    case "adapter":
      return { bg: "var(--amber-soft)", fg: "var(--amber)", border: "var(--amber-border)", label: "Adapter" };
    case "infra":
      return { bg: "var(--surface-muted)", fg: "var(--text-muted)", border: "var(--border-strong)", label: "Infra & Config" };
    case "diagnostic":
      return { bg: "var(--violet-soft)", fg: "var(--violet)", border: "var(--violet-border)", label: "Diagnostic / Test" };
  }
}

function cleanDocSummary(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Skip raw setup checklist lines like "1. **Clone the repository**"
  if (/^\d+\.\s+/.test(trimmed)) return null;
  return trimmed.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function pathMatches(zonePath: string, modPath: string): boolean {
  const zp = normalizePath(zonePath);
  const mp = normalizePath(modPath);
  if (zp === mp) return true;
  if (zp.replace(/\.rs$/, "") === mp.replace(/\.rs$/, "")) return true;
  if (mp.startsWith(zp + "/") || zp.startsWith(mp + "/")) return true;
  return false;
}

function computeZoneMetrics(
  zonePaths: readonly string[],
  modules: readonly StructureModulePayload[],
  surfaceCountsByMod: Readonly<Record<string, ModuleSurfaceCountsPayload>>,
) {
  const matchedMods = modules.filter((m) => zonePaths.some((zp) => pathMatches(zp, m.path)));
  let files = 0;
  let loc = 0;
  const assets: Record<string, number> = {};
  let routes = 0;
  let tables = 0;
  let topics = 0;

  for (const m of matchedMods) {
    files += m.source_files || m.file_count;
    loc += m.loc;
    for (const [ext, count] of Object.entries(m.asset_counts ?? {})) {
      assets[ext] = (assets[ext] ?? 0) + count;
    }
    const sc = surfaceCountsByMod[m.path];
    if (sc) {
      routes += sc.routes;
      tables += sc.tables;
      topics += sc.topics;
    }
  }
  return { files, loc, assets, routes, tables, topics, matchedMods };
}

function formatCite(cite: unknown): string {
  if (typeof cite === "string") return cite;
  if (cite && typeof cite === "object" && "code" in cite) {
    return String((cite as { code: string }).code);
  }
  return "";
}

export function CodebaseGuideView({ comp, codeInfo, orientationStats }: Props) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const pkgStruct = codeInfo?.package_structure;
  const pkgRoot = codeInfo?.package_root;
  const orientation = comp.orientation;
  const modules = pkgStruct?.modules ?? [];
  const surfaceCountsByMod = codeInfo?.surface_counts_by_module ?? {};
  const repoUrl = buildGitHubUrl(codeInfo);
  const entrypoints = pkgStruct?.entrypoints ?? [];
  const harnesses = codeInfo?.workspace_harnesses ?? [];
  const zones = orientation?.zones ?? [];
  const startHere = orientation?.start_here ?? [];
  const tasks = orientation?.tasks ?? [];
  const traps = orientation?.traps ?? [];
  const techStack = pkgStruct?.tech_stack ?? [];
  const triageRules = comp.component.triage ?? [];

  // Fallback module groups when no orientation.yaml zones are authored yet
  const autoGroups = (() => {
    if (zones.length > 0 || modules.length === 0) return [];
    const groups: { title: string; role: OrientationZoneRole; items: StructureModulePayload[] }[] = [
      { title: "Public & Entrypoints", role: "contract", items: modules.filter((m) => m.visibility === "public") },
      { title: "Internal Modules", role: "core", items: modules.filter((m) => m.visibility === "internal" || m.visibility === "hidden") },
      { title: "Assets & Schemas", role: "adapter", items: modules.filter((m) => m.visibility === "asset") },
      { title: "Tests", role: "diagnostic", items: modules.filter((m) => m.visibility === "test") },
    ];
    return groups.filter((g) => g.items.length > 0);
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 1. Header Strip: Repo Link, Footprint & Runnable Entrypoints */}
      <div className="section-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="section-title" style={{ marginBottom: 8 }}>
              <Compass size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              Repository &amp; Footprint
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {codeInfo?.home_repo && <span className="badge indigo mono">repo: {codeInfo.home_repo}</span>}
              {codeInfo?.repo_subpath && <span className="badge mono">path: {codeInfo.repo_subpath}</span>}
              {codeInfo?.git_ref && <span className="badge mono">@{codeInfo.git_ref.slice(0, 8)}</span>}
              {pkgStruct && (
                <>
                  <span className="badge emerald">{pkgStruct.source_files} source files</span>
                  <span className="badge">{formatLoc(pkgStruct.total_loc)}</span>
                  <span className="badge">{pkgStruct.tier} tier</span>
                </>
              )}
            </div>
            {cleanDocSummary(pkgStruct?.doc_summary) && (
              <p style={{ margin: "10px 0 0 0", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, maxWidth: 820 }}>
                {cleanDocSummary(pkgStruct?.doc_summary)}
              </p>
            )}
          </div>

          {repoUrl && (
            <a
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
              className="primary-btn"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              Open on GitHub <ExternalLink size={13} />
            </a>
          )}
        </div>

        {entrypoints.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <div className="section-title" style={{ marginBottom: 8 }}>
              <Play size={12} style={{ verticalAlign: "-1px", marginRight: 5 }} />
              Entrypoints ({entrypoints.length})
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {entrypoints.map((ep) => {
                const url = buildGitHubUrl(codeInfo, ep.path, "blob");
                return (
                  <div
                    key={`${ep.kind}:${ep.path}:${ep.name}`}
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      minWidth: 180,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 12.5 }}>{ep.name}</span>
                      <span className="badge">{ep.kind}</span>
                    </div>
                    <div className="mono" style={{ fontSize: 11.5, marginTop: 4 }}>
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>
                          {ep.path}
                        </a>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>{ep.path}</span>
                      )}
                    </div>
                    {ep.command && (
                      <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
                        $ {ep.command}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Annotated Architecture Map (Zones) — or Auto-Derived Gravity Map */}
      {zones.length > 0 ? (
        <div className="section-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div className="section-title" style={{ margin: 0 }}>
              <Layers size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              Architecture Map — {zones.length} Zones
            </div>
            {orientationStats && (
              <span className="badge emerald">
                {orientationStats.covered_modules}/{orientationStats.significant_modules} modules mapped ({orientationStats.coverage_pct}%)
              </span>
            )}
          </div>

          <div className="grid-2">
            {zones.map((zone) => {
              const rs = roleStyle(zone.role);
              const metrics = computeZoneMetrics(zone.paths, modules, surfaceCountsByMod);
              return (
                <div
                  key={zone.id}
                  style={{
                    background: "var(--bg)",
                    border: `1px solid ${rs.border}`,
                    borderLeft: `4px solid ${rs.fg}`,
                    borderRadius: 8,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14, color: "var(--text)" }}>{zone.name}</strong>
                    <span
                      className="badge"
                      style={{ background: rs.bg, color: rs.fg, borderColor: rs.border, fontWeight: 600 }}
                    >
                      {rs.label}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {zone.summary}
                  </p>

                  {/* Live joined metrics from structure.json + inventory.json */}
                  {(metrics.files > 0 || metrics.routes > 0 || metrics.tables > 0 || Object.keys(metrics.assets).length > 0) && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {metrics.files > 0 && <span className="badge">{metrics.files} files</span>}
                      {metrics.loc > 0 && <span className="badge">{formatLoc(metrics.loc)}</span>}
                      {metrics.routes > 0 && <span className="badge indigo">{metrics.routes} routes</span>}
                      {metrics.tables > 0 && <span className="badge emerald">{metrics.tables} tables</span>}
                      {metrics.topics > 0 && <span className="badge">{metrics.topics} topics</span>}
                      {Object.entries(metrics.assets).map(([ext, count]) => (
                        <span key={ext} className="badge mono">{count} .{ext}</span>
                      ))}
                    </div>
                  )}

                  {/* Clickable GitHub path pills */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                    {zone.paths.map((p) => {
                      const isFile = /\.[a-z0-9]+$/i.test(p);
                      const url = buildGitHubUrl(codeInfo, p, isFile ? "blob" : "tree");
                      return url ? (
                        <a
                          key={p}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="badge mono"
                          style={{
                            textDecoration: "none",
                            color: "var(--accent)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {isFile ? <FileCode2 size={11} /> : <FolderOpen size={11} />}
                          {p}
                        </a>
                      ) : (
                        <span key={p} className="badge mono">{p}</span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : autoGroups.length > 0 ? (
        <div className="section-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div className="section-title" style={{ margin: 0 }}>
              <Layers size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              Module Gravity Map (Auto-Derived)
            </div>
            <span className="badge">Run `groundwork orient brief` to author curated zones</span>
          </div>
          <div className="grid-2">
            {autoGroups.map((grp) => {
              const rs = roleStyle(grp.role);
              return (
                <div
                  key={grp.title}
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ fontSize: 13 }}>{grp.title}</strong>
                    <span className="badge" style={{ background: rs.bg, color: rs.fg }}>{grp.items.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {grp.items.slice(0, 10).map((m) => {
                      const url = buildGitHubUrl(codeInfo, m.path, m.kind === "file" ? "blob" : "tree");
                      const sc = surfaceCountsByMod[m.path];
                      return (
                        <div
                          key={m.path}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 6,
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            fontSize: 12,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            {url ? (
                              <a href={url} target="_blank" rel="noreferrer" className="mono" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
                                {m.path}
                              </a>
                            ) : (
                              <span className="mono" style={{ fontWeight: 600 }}>{m.path}</span>
                            )}
                            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
                              {m.source_files || m.file_count} files · {formatLoc(m.loc)}
                            </span>
                          </div>
                          {m.doc_summary && (
                            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>
                              {m.doc_summary}
                            </div>
                          )}
                          {sc && (sc.routes > 0 || sc.tables > 0 || sc.topics > 0) && (
                            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                              {sc.routes > 0 && <span className="badge indigo">{sc.routes} routes</span>}
                              {sc.tables > 0 && <span className="badge emerald">{sc.tables} tables</span>}
                              {sc.topics > 0 && <span className="badge">{sc.topics} topics</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {grp.items.length > 10 && (
                      <div style={{ fontSize: 11.5, color: "var(--text-faint)", paddingLeft: 4 }}>
                        +{grp.items.length - 10} smaller modules
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 3. Start Here Reading Path & Common Tasks / Harnesses */}
      {(startHere.length > 0 || tasks.length > 0 || (comp.component.kind === "module" && harnesses.length > 0)) && (
        <div className="grid-2">
          {startHere.length > 0 && (
            <div className="section-card">
              <div className="section-title">
                <BookOpen size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                Start Here — Reading Order
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {startHere.map((item, idx) => {
                  const isFile = /\.[a-z0-9]+$/i.test(item.path);
                  const url = buildGitHubUrl(codeInfo, item.path, isFile ? "blob" : "tree");
                  return (
                    <div
                      key={`${item.path}:${idx}`}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        padding: "8px 10px",
                        background: "var(--bg)",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "#eef2ff",
                          color: "#4338ca",
                          fontWeight: 700,
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>
                              {item.path}
                            </a>
                          ) : (
                            <span className="mono" style={{ fontSize: 12.5, fontWeight: 700 }}>{item.path}</span>
                          )}
                          {item.symbol && <span className="badge mono">{item.symbol}</span>}
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.45 }}>
                          {item.why}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(tasks.length > 0 || (comp.component.kind === "module" && harnesses.length > 0)) && (
            <div className="section-card">
              <div className="section-title">
                <Wrench size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                Common Tasks &amp; Verification
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {tasks.map((task, idx) => {
                  const isFile = Boolean(task.path && /\.[a-z0-9]+$/i.test(task.path));
                  const url = task.path ? buildGitHubUrl(codeInfo, task.path, isFile ? "blob" : "tree") : null;
                  return (
                    <div
                      key={`${task.label}:${idx}`}
                      style={{
                        padding: "8px 10px",
                        background: "var(--bg)",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 12.5 }}>{task.label}</div>
                      {task.path && (
                        <div className="mono" style={{ fontSize: 11.5, marginTop: 3 }}>
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>
                              {task.path}
                            </a>
                          ) : (
                            <span>{task.path}</span>
                          )}
                        </div>
                      )}
                      {task.command && (
                        <div
                          className="mono"
                          style={{
                            fontSize: 11.5,
                            marginTop: 4,
                            padding: "4px 8px",
                            borderRadius: 5,
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            color: "var(--text)",
                          }}
                        >
                          <Terminal size={11} style={{ verticalAlign: "-1px", marginRight: 5, color: "var(--text-faint)" }} />
                          {task.command}
                        </div>
                      )}
                      {task.note && (
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{task.note}</div>
                      )}
                    </div>
                  );
                })}

                {comp.component.kind === "module" && harnesses.length > 0 && (
                  <div style={{ marginTop: tasks.length > 0 ? 6 : 0, paddingTop: tasks.length > 0 ? 10 : 0, borderTop: tasks.length > 0 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", marginBottom: 6 }}>
                      Workspace Runnable Harnesses ({harnesses.length})
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {harnesses.slice(0, 8).map((h) => (
                        <span key={h.path} className="badge mono" title={h.summary ?? h.path}>
                          {h.command ?? h.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Traps / Watch-Outs (if authored) + Tech Stack Grouped by Role */}
      <div className="grid-2">
        {traps.length > 0 && (
          <div className="section-card" style={{ borderLeft: "4px solid #d97706" }}>
            <div className="section-title" style={{ color: "#b45309" }}>
              <AlertTriangle size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              Traps &amp; Non-Obvious Boundaries ({traps.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {traps.map((trap, i) => (
                <div key={i} style={{ fontSize: 12.5 }}>
                  <div style={{ fontWeight: 700, color: "var(--text)" }}>{trap.title}</div>
                  <div style={{ color: "var(--text-muted)", marginTop: 2, lineHeight: 1.45 }}>{trap.detail}</div>
                  {formatCite(trap.cite) && (
                    <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 3 }}>
                      cite: {formatCite(trap.cite)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {techStack.length > 0 && (
          <div className="section-card">
            <div className="section-title">Tech Stack by Role</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {techStack.map((grp) => (
                <div
                  key={grp.category}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    padding: "6px 0",
                    borderBottom: "1px solid var(--border)",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>{grp.category}</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {grp.items.map((item) => (
                      <span key={item} className="badge indigo">{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. Collapsible Scan Diagnostics & Triage */}
      {(pkgRoot || triageRules.length > 0 || (pkgStruct?.flags?.length ?? 0) > 0) && (
        <div className="section-card" style={{ padding: "10px 16px" }}>
          <button
            type="button"
            onClick={() => setShowDiagnostics((v) => !v)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              color: "var(--text-muted)",
              fontWeight: 700,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {showDiagnostics ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Scan Diagnostics &amp; Triage
              {triageRules.length > 0 && <span className="badge">{triageRules.length} triage</span>}
              {orientationStats && (
                <span className="badge">
                  orientation: {orientationStats.has_orientation ? `${orientationStats.coverage_pct}%` : orientationStats.orientation_required ? "missing" : "compact"}
                </span>
              )}
            </span>
            <span className="mono" style={{ fontSize: 11, fontWeight: 400, color: "var(--text-faint)" }}>
              {pkgRoot ? `${pkgRoot.manifest} (${pkgRoot.language})` : ""}
            </span>
          </button>

          {showDiagnostics && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 14 }}>
              {pkgRoot && (
                <div>
                  <div className="section-title">Extractor Capabilities</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    {Object.entries(pkgRoot.capabilities)
                      .filter(([, v]) => v !== "unsupported")
                      .map(([facet, level]) => (
                        <span key={facet} className={`badge ${level === "supported" ? "emerald" : "indigo"}`}>
                          {facet}: {level}
                        </span>
                      ))}
                  </div>
                  {pkgRoot.key_dependencies.length > 0 && (
                    <>
                      <div className="section-title">Raw Manifest Dependencies ({pkgRoot.key_dependencies.length})</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {pkgRoot.key_dependencies.map((d) => (
                          <span key={d} className="badge mono">{d}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {(pkgStruct?.flags?.length ?? 0) > 0 && (
                <div>
                  <div className="section-title">Detected Env &amp; Feature Flags ({pkgStruct!.flags!.length})</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {pkgStruct!.flags!.map((f) => (
                      <span key={f} className="badge mono">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {triageRules.length > 0 && (
                <div>
                  <div className="section-title">Triage Rules ({triageRules.length})</div>
                  {triageRules.map((t, i) => (
                    <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span className="mono" style={{ fontWeight: 600 }}>{t.surface}</span>
                        <span className="badge">{t.disposition}</span>
                      </div>
                      <div style={{ color: "var(--text-muted)", marginTop: 2 }}>{t.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
