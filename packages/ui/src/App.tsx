import { AlertTriangle, ArrowLeft, FileCode2, GitBranch, Map as MapIcon, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CommandPalette, type SearchHit } from "./components/CommandPalette";
import { EntityDetailPage } from "./components/EntityDetailPage";
import { FlowsView } from "./components/FlowsView";
import { GapsView } from "./components/GapsView";
import { InspectorDrawer } from "./components/InspectorDrawer";
import { PlanStudio } from "./components/PlanStudio";
import { SystemMapCanvas } from "./components/SystemMapCanvas";
import { ThemeToggle } from "./components/shared/ThemeToggle";
import { WorkspaceLanding } from "./components/WorkspaceLanding";
import { LinkContext } from "./LinkContext";
import {
  buildHref,
  getCurrentHref,
  isModifiedClick,
  parseRoute,
  pushRawHref,
  pushRoute,
  type AppRoute,
} from "./router";
import type { SpacePayload, WorkspaceSummary } from "./types";

export function App() {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseRoute(window.location.pathname, window.location.search),
  );
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [space, setSpace] = useState<SpacePayload | null>(null);
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(new Set());
  const [cmdOpen, setCmdOpen] = useState(false);

  const activeWs = route.kind === "landing" ? null : route.ws;
  const activeProject = route.kind === "landing" ? undefined : route.project;
  const selectedMapId = route.kind === "map" ? route.select ?? null : null;

  // Listen to native Browser Back / Forward!
  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRoute(window.location.pathname, window.location.search));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((next: AppRoute, replace = false) => {
    pushRoute(next, replace);
    setRoute(next);
  }, []);

  const navigateRaw = useCallback((href: string, replace = false) => {
    pushRawHref(href, replace);
    const u = new URL(href, window.location.origin);
    setRoute(parseRoute(u.pathname, u.search));
  }, []);

  const loadWorkspaces = useCallback(async () => {
    const res = await fetch("/api/workspaces");
    const data = (await res.json()) as { workspaces: WorkspaceSummary[] };
    setWorkspaces(data.workspaces);
  }, []);

  const loadActiveSpace = useCallback(async (wsId: string, projectId?: string, resetExpand = false) => {
    if (!wsId) return;
    const url = `/api/space?workspace=${encodeURIComponent(wsId)}${projectId ? `&project=${encodeURIComponent(projectId)}` : ""}`;
    const res = await fetch(url);
    const data = (await res.json()) as SpacePayload;
    setSpace(data);
    setExpandedSystems((prev) => {
      if (!resetExpand && prev.size > 0) return prev;
      const mapped = data.systems.filter((s) => s.system.mapped);
      const totalChildren = mapped.reduce(
        (acc, s) => acc + s.components.length + s.stores.length + s.topics.length,
        0,
      );
      if (mapped.length > 3 || totalChildren > 10) return new Set();
      return new Set(mapped.map((s) => s.id));
    });
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    if (activeWs) {
      setSpace(null);
      loadActiveSpace(activeWs, activeProject, true);
    } else {
      setSpace(null);
      setExpandedSystems(new Set());
    }
  }, [activeWs, activeProject, loadActiveSpace]);

  useEffect(() => {
    const ev = new EventSource("/api/events");
    ev.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as { type: string };
        if (parsed.type === "reload" && activeWs) {
          loadActiveSpace(activeWs, activeProject, false);
        }
      } catch {
        // ignore
      }
    };
    return () => ev.close();
  }, [activeWs, activeProject, loadActiveSpace]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const resolveNavTarget = useCallback(
    (rawId: string): { entityId: string; tab?: string; endpoint?: string } => {
      const base = rawId.split("#")[0]!;
      if (!space) return { entityId: base };

      for (const sys of space.systems) {
        if (sys.id === base) return { entityId: sys.id };
        for (const st of sys.stores) {
          if (st.id === base || (st.records ?? []).some((r) => r.id === base)) {
            return { entityId: st.id };
          }
        }
        for (const top of sys.topics) {
          if (top.id === base || (top.messages ?? []).some((m) => m.id === base)) {
            return { entityId: top.id };
          }
        }
        for (const comp of sys.components) {
          if (comp.id === base) return { entityId: comp.id };
          if (base.startsWith(`screen:${comp.slug}/`)) return { entityId: comp.id };
          for (const iface of comp.contracts.interfaces ?? []) {
            if (iface.id === base) return { entityId: comp.id, tab: "api" };
            const ep = iface.entries.find((e) => e.id === base);
            if (ep) return { entityId: comp.id, tab: "api", endpoint: ep.id };
          }
          if ((comp.contracts.schemas ?? []).some((s) => s.id === base)) {
            return { entityId: comp.id, tab: "api" };
          }
          if (comp.handlers.handlers.some((h) => h.id === base) || (comp.handlers.procedures ?? []).some((p) => p.id === base)) {
            return { entityId: comp.id, tab: "logic" };
          }
        }
        if ((sys.stub_contracts?.interfaces ?? []).some((i) => i.id === base || i.entries.some((e) => e.id === base))) {
          return { entityId: sys.id };
        }
      }
      for (const ext of space.externals) {
        if (ext.id === base || (ext.contracts.interfaces ?? []).some((i) => i.id === base || i.entries.some((e) => e.id === base))) {
          return { entityId: ext.id };
        }
      }
      return { entityId: base };
    },
    [space],
  );

  const openEntity = useCallback(
    (rawId: string, preferredTab?: string, originPlanIdOrSlug?: string) => {
      if (!activeWs) return;
      const resolved = resolveNavTarget(rawId);
      const currentPlan =
        originPlanIdOrSlug?.replace(/^plan:/, "") ??
        (route.kind === "entity" ? route.plan : undefined);
      const currentReturnTo =
        originPlanIdOrSlug && route.kind === "plans"
          ? getCurrentHref()
          : route.kind === "entity"
            ? route.returnTo
            : undefined;
      const currentState = route.kind === "entity" ? route.state : undefined;

      navigate({
        kind: "entity",
        ws: activeWs,
        ...(activeProject ? { project: activeProject } : {}),
        entityId: resolved.entityId,
        ...(preferredTab ?? resolved.tab ? { tab: preferredTab ?? resolved.tab } : {}),
        ...(resolved.endpoint ? { endpoint: resolved.endpoint } : {}),
        ...(currentPlan ? { plan: currentPlan } : {}),
        ...(currentState ? { state: currentState } : {}),
        ...(currentReturnTo ? { returnTo: currentReturnTo } : {}),
      });
    },
    [activeWs, activeProject, resolveNavTarget, route, navigate],
  );

  const buildEntityHref = useCallback(
    (rawId: string, tab?: string): string => {
      if (!activeWs) return "/";
      const resolved = resolveNavTarget(rawId);
      const planSlug = route.kind === "entity" ? route.plan : route.kind === "plans" ? route.plan : undefined;
      return buildHref({
        kind: "entity",
        ws: activeWs,
        ...(activeProject ? { project: activeProject } : {}),
        entityId: resolved.entityId,
        ...(tab ?? resolved.tab ? { tab: tab ?? resolved.tab } : {}),
        ...(resolved.endpoint ? { endpoint: resolved.endpoint } : {}),
        ...(planSlug ? { plan: planSlug } : {}),
      });
    },
    [activeWs, activeProject, resolveNavTarget, route],
  );

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
    } else if (activeWs) {
      navigate({ kind: "map", ws: activeWs, ...(activeProject ? { project: activeProject } : {}) });
    } else {
      navigate({ kind: "landing" });
    }
  }, [activeWs, activeProject, navigate]);

  const currentWsMeta = workspaces.find((w) => w.id === activeWs);

  const activePlan = useMemo(() => {
    if (!space || space.plans.length === 0) return null;
    if (route.kind === "plans" && route.plan) {
      return space.plans.find((p) => p.slug === route.plan || p.id === route.plan) ?? space.plans[0]!;
    }
    return space.plans[0]!;
  }, [space, route]);

  const originPlan = useMemo(() => {
    if (!space || route.kind !== "entity" || !route.plan) return undefined;
    return space.plans.find((p) => p.slug === route.plan || p.id === route.plan || p.id === `plan:${route.plan}`);
  }, [space, route]);

  const handleSearchSelect = (hit: SearchHit) => {
    if (!activeWs) return;
    if (hit.kind === "plan") {
      navigate({
        kind: "plans",
        ws: activeWs,
        ...(activeProject ? { project: activeProject } : {}),
        plan: hit.id.replace(/^plan:/, ""),
      });
      return;
    }
    openEntity(hit.targetNodeId);
  };

  const navLink = (target: AppRoute, active: boolean, children: React.ReactNode, className = "nav-tab") => {
    const href = buildHref(target);
    return (
      <a
        href={href}
        className={`${className} ${active ? "active" : ""}`}
        style={{ textDecoration: "none" }}
        onClick={(e) => {
          if (isModifiedClick(e)) return;
          e.preventDefault();
          navigate(target);
        }}
      >
        {children}
      </a>
    );
  };

  return (
    <LinkContext.Provider value={buildEntityHref}>
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-left">
            <a
              href="/"
              className="brand"
              style={{ textDecoration: "none", color: "inherit" }}
              onClick={(e) => {
                if (isModifiedClick(e)) return;
                e.preventDefault();
                navigate({ kind: "landing" });
                loadWorkspaces();
              }}
              title="All Workspaces"
            >
              <span className="brand-mark">G</span>
              Groundwork
            </a>

            {activeWs && (
              <>
                <a
                  href="/"
                  className="icon-btn"
                  style={{ textDecoration: "none" }}
                  onClick={(e) => {
                    if (isModifiedClick(e)) return;
                    e.preventDefault();
                    navigate({ kind: "landing" });
                    loadWorkspaces();
                  }}
                  title="Back to all workspaces"
                >
                  <ArrowLeft size={13} /> Workspaces
                </a>

                <select
                  className="select"
                  value={activeWs}
                  onChange={(e) => {
                    const nextWs = workspaces.find((w) => w.id === e.target.value);
                    const nextProj = nextWs?.mode === "multi-project" ? nextWs.projects[0] : undefined;
                    navigate({ kind: "map", ws: e.target.value, ...(nextProj ? { project: nextProj } : {}) });
                  }}
                >
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.mode === "multi-project" ? "projects" : "org"})
                    </option>
                  ))}
                </select>

                {currentWsMeta?.mode === "multi-project" && (
                  <select
                    className="select"
                    value={activeProject ?? ""}
                    onChange={(e) => navigate({ kind: "map", ws: activeWs, project: e.target.value })}
                  >
                    {currentWsMeta.projects.map((p) => (
                      <option key={p} value={p}>
                        {p.replace(/^project:/, "")}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>

          {activeWs && (
            <nav className="nav-tabs">
              {navLink(
                { kind: "map", ws: activeWs, ...(activeProject ? { project: activeProject } : {}) },
                route.kind === "map" || route.kind === "entity",
                <><MapIcon size={14} /> System Map</>,
              )}
              {navLink(
                { kind: "flows", ws: activeWs, ...(activeProject ? { project: activeProject } : {}) },
                route.kind === "flows",
                <><GitBranch size={14} /> Flows ({space?.flows.length ?? 0})</>,
              )}
              {navLink(
                {
                  kind: "plans",
                  ws: activeWs,
                  ...(activeProject ? { project: activeProject } : {}),
                  ...(space?.plans[0] ? { plan: space.plans[0].slug } : {}),
                },
                route.kind === "plans",
                <><FileCode2 size={14} /> Plans ({space?.plans.length ?? 0})</>,
              )}
              {navLink(
                { kind: "gaps", ws: activeWs, ...(activeProject ? { project: activeProject } : {}) },
                route.kind === "gaps",
                <><AlertTriangle size={14} /> Gaps ({space?.gaps.length ?? 0})</>,
              )}
            </nav>
          )}

          <div className="topbar-right">
            {activeWs && (
              <button className="cmd-btn" onClick={() => setCmdOpen(true)}>
                <Search size={13} /> Search… <kbd>⌘K</kbd>
              </button>
            )}
            <ThemeToggle />
          </div>
        </header>

        <main className="main-area">
          {route.kind === "landing" ? (
            <WorkspaceLanding
              workspaces={workspaces}
              onOpen={(wsId, projId) =>
                navigate({ kind: "map", ws: wsId, ...(projId ? { project: projId } : {}) })
              }
              onOpenPlans={(wsId, projId) =>
                navigate({ kind: "plans", ws: wsId, ...(projId ? { project: projId } : {}) })
              }
            />
          ) : !space ? (
            <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--text-faint)" }}>
              Loading workspace…
            </div>
          ) : route.kind === "entity" ? (
            <EntityDetailPage
              space={space}
              entityId={route.entityId}
              initialTab={route.tab}
              initialEndpoint={route.endpoint}
              initialTable={route.table}
              initialDbView={route.dbview}
              fromPlan={originPlan}
              stateMode={route.state ?? "proposed"}
              onRoutePatch={(patch) => {
                navigate({ ...route, ...patch }, true);
              }}
              onBack={goBack}
              onBackToPlan={
                originPlan
                  ? () => {
                      if (route.returnTo) {
                        navigateRaw(route.returnTo);
                      } else {
                        navigate({
                          kind: "plans",
                          ws: route.ws,
                          ...(route.project ? { project: route.project } : {}),
                          plan: originPlan.slug,
                          tab: "walkthrough",
                        });
                      }
                    }
                  : undefined
              }
              onOpenEntity={(id, t) => openEntity(id, t, route.plan)}
              onOpenMap={(selId) =>
                navigate({
                  kind: "map",
                  ws: route.ws,
                  ...(route.project ? { project: route.project } : {}),
                  ...(selId ? { select: selId } : {}),
                })
              }
            />
          ) : route.kind === "map" ? (
            <>
              <SystemMapCanvas
                systems={space.systems}
                externals={space.externals}
                unassignedStores={space.unassigned_stores}
                unassignedTopics={space.unassigned_topics}
                edges={space.edges}
                evidence={space.evidence}
                componentCodeInfo={space.component_code_info}
                selectedId={selectedMapId}
                onSelect={(id) => navigate({ ...route, select: id }, true)}
                onOpenFullView={(id) => openEntity(id)}
                expandedSystems={expandedSystems}
                onToggleExpand={(sysId) =>
                  setExpandedSystems((prev) => {
                    const next = new Set(prev);
                    if (next.has(sysId)) next.delete(sysId);
                    else next.add(sysId);
                    return next;
                  })
                }
                onExpandAll={() =>
                  setExpandedSystems(
                    new Set(
                      space.systems
                        .filter((s) => s.components.length + s.stores.length + s.topics.length > 0)
                        .map((s) => s.id),
                    ),
                  )
                }
                onCollapseAll={() => setExpandedSystems(new Set())}
              />
              <InspectorDrawer
                space={space}
                selectedId={selectedMapId}
                onClose={() => navigate({ kind: "map", ws: route.ws, ...(route.project ? { project: route.project } : {}) }, true)}
                onSelect={(id) => {
                  navigate({ ...route, select: id }, true);
                  const parentSys = space.systems.find(
                    (s) =>
                      s.components.some((c) => c.id === id) ||
                      s.stores.some((st) => st.id === id) ||
                      s.topics.some((t) => t.id === id),
                  );
                  if (parentSys) setExpandedSystems((prev) => new Set([...prev, parentSys.id]));
                }}
                onOpenFullView={(id, t) => openEntity(id, t)}
              />
            </>
          ) : route.kind === "plans" ? (
            activePlan ? (
              <PlanStudio
                space={space}
                plan={activePlan}
                initialTab={route.tab}
                initialOp={route.op}
                initialStep={route.step}
                initialMode={route.mode}
                onRouteSync={(patch, push = false) => {
                  navigate(
                    {
                      kind: "plans",
                      ws: route.ws,
                      ...(route.project ? { project: route.project } : {}),
                      plan: activePlan.slug,
                      tab: patch.tab ?? route.tab ?? "walkthrough",
                      op: patch.op ?? route.op,
                      step: patch.step ?? route.step,
                      mode: patch.mode ?? route.mode,
                    },
                    !push,
                  );
                }}
                onRefresh={() => loadActiveSpace(route.ws, route.project, false)}
                onOpenEntity={(id, t, pid) => openEntity(id, t, pid ?? activePlan.slug)}
              />
            ) : (
              <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--text-faint)" }}>
                No plans in this space yet.
              </div>
            )
          ) : route.kind === "flows" ? (
            <FlowsView space={space} onOpenEntity={(id, t) => openEntity(id, t)} />
          ) : (
            <GapsView space={space} onOpenEntity={(id, t) => openEntity(id, t)} />
          )}
        </main>

        {space && (
          <CommandPalette open={cmdOpen} space={space} onClose={() => setCmdOpen(false)} onSelect={handleSearchSelect} />
        )}
      </div>
    </LinkContext.Provider>
  );
}
