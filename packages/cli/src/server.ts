import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {
  applyPlan,
  buildIndex,
  checkPlanDrift,
  computeCompleteness,
  deriveSurfaceCountsByModule,
  discoverWorkspaces,
  evaluatePlanGates,
  loadSpace,
  reconcilePlanAgainstSpace,
  resolveComponentEvidence,
  resolveSpaceDir,
} from "@groundwork/core";
import yaml from "js-yaml";

export interface ServeOptions {
  readonly groundworkRoot: string;
  readonly port: number;
  readonly uiDistDir?: string;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function serializeSpace(groundworkRoot: string, wsId: string, projectId?: string) {
  const workspaces = discoverWorkspaces(groundworkRoot);
  const ws = workspaces.find((w) => w.id === wsId || w.id === `workspace:${wsId}`);
  if (!ws) throw new Error(`Workspace not found: ${wsId}`);
  const effectiveProject = projectId ?? (ws.mode === "multi-project" ? ws.projects[0] : undefined);
  const spaceDir = resolveSpaceDir(ws, effectiveProject);
  const space = loadSpace(spaceDir);
  const index = buildIndex(space);
  const completeness = computeCompleteness(space);

  const plans = space.plans.map((p) => {
    const applied = applyPlan(space, p.id);
    const afterIndex = buildIndex(applied.after);
    const drift = checkPlanDrift(p, applied.before);
    const gateReady = evaluatePlanGates(space, p, "ready");
    const gateDraft = evaluatePlanGates(space, p, "draft");
    const reconciliation = reconcilePlanAgainstSpace(space, p);
    return {
      id: p.id,
      slug: p.slug,
      manifest: p.manifest,
      changes: p.changes,
      design: p.design,
      execution: p.execution,
      progress: p.progress,
      proof: p.proof,
      reviews: p.reviews,
      diff: applied.diff,
      apply_errors: applied.errors,
      after_systems: applied.after.systems,
      after_edges: afterIndex.edges,
      drift,
      gate_ready: gateReady,
      gate_draft: gateDraft,
      reconciliation,
    };
  });

  const component_code_info: Record<string, unknown> = {};
  for (const sys of space.systems) {
    for (const comp of sys.components) {
      const resolved = resolveComponentEvidence(space, sys, comp);
      const surfaceCounts = deriveSurfaceCountsByModule(resolved.surfaces, resolved.package_root?.path);
      component_code_info[comp.id] = {
        home_repo: resolved.home_repo,
        home_path: resolved.home_path,
        web_url: resolved.web_url,
        git_ref: resolved.git_ref,
        repo_subpath: resolved.repo_subpath,
        package_root: resolved.package_root,
        submodule: resolved.submodule,
        package_structure: resolved.package_structure,
        workspace_harnesses: resolved.workspace_harnesses,
        surface_counts_by_module: Object.fromEntries(surfaceCounts.entries()),
        matched_surfaces: resolved.surfaces,
      };
    }
  }

  return {
    workspace: ws,
    project_id: effectiveProject ?? null,
    config: space.config,
    domains: space.domains,
    systems: space.systems,
    externals: space.externals,
    unassigned_stores: space.unassigned_stores,
    unassigned_topics: space.unassigned_topics,
    flows: space.flows,
    edges: index.edges,
    gaps: index.gaps,
    roles: Object.fromEntries(index.rolesByComponent.entries()),
    completeness,
    evidence: space.evidence,
    component_code_info,
    problems: space.problems,
    plans,
  };
}

interface CodeTreeNode {
  readonly name: string;
  readonly path: string;
  readonly kind: "dir" | "file";
  readonly children?: readonly CodeTreeNode[];
}

const TREE_SKIP = new Set([
  ".git", "node_modules", "dist", "build", ".next", ".venv", "venv",
  "__pycache__", "vendor", ".dev", ".groundwork", "target", "tmp", ".DS_Store",
]);

function readCodeTree(rootDir: string, maxDepth = 2): CodeTreeNode[] {
  const walk = (dir: string, relBase: string, depth: number): CodeTreeNode[] => {
    if (depth > maxDepth || !fs.existsSync(dir)) return [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const filtered = entries
      .filter((e) => !TREE_SKIP.has(e.name) && !e.name.startsWith("."))
      .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))
      .slice(0, 40);

    return filtered.map((e) => {
      const rel = relBase ? `${relBase}/${e.name}` : e.name;
      if (e.isDirectory()) {
        return {
          name: e.name,
          path: rel,
          kind: "dir",
          children: depth < maxDepth ? walk(path.join(dir, e.name), rel, depth + 1) : [],
        };
      }
      return { name: e.name, path: rel, kind: "file" };
    });
  };
  return walk(rootDir, "", 0);
}

export function startServer(options: ServeOptions): http.Server {
  const { groundworkRoot, port, uiDistDir } = options;
  const sseClients = new Set<http.ServerResponse>();

  // Watch examples/ and workspaces/ for live reload
  const watchers: fs.FSWatcher[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  const broadcastReload = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      for (const client of sseClients) {
        client.write(`data: ${JSON.stringify({ type: "reload", at: Date.now() })}\n\n`);
      }
    }, 150);
  };

  for (const dirName of ["examples", "workspaces"]) {
    const watchPath = path.join(groundworkRoot, dirName);
    if (fs.existsSync(watchPath)) {
      try {
        watchers.push(fs.watch(watchPath, { recursive: true }, broadcastReload));
      } catch {
        // Ignore watch errors on unsupported platforms
      }
    }
  }

  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url ?? "/", `http://localhost:${port}`);
    const pathname = reqUrl.pathname;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    try {
      // SSE live reload stream
      if (pathname === "/api/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });
        res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
        sseClients.add(res);
        req.on("close", () => sseClients.delete(res));
        return;
      }

      if (pathname === "/api/workspaces") {
        const workspaces = discoverWorkspaces(groundworkRoot);
        const enriched = workspaces.map((ws) => {
          if (ws.mode === "single-space") {
            try {
              const space = loadSpace(ws.root_dir);
              return {
                ...ws,
                description: space.config.description ?? "",
                systems_count: space.systems.length,
                components_count: space.systems.reduce((a, s) => a + s.components.length, 0),
                plans_count: space.plans.length,
                repos_count: Object.keys(space.config.repos ?? {}).length,
                project_summaries: [],
              };
            } catch {
              return { ...ws, description: "", systems_count: 0, components_count: 0, plans_count: 0, repos_count: 0, project_summaries: [] };
            }
          }
          const project_summaries = ws.projects.map((pid) => {
            try {
              const pDir = resolveSpaceDir(ws, pid);
              const space = loadSpace(pDir);
              return {
                id: pid,
                name: space.config.name,
                description: space.config.description ?? "",
                systems_count: space.systems.length,
                components_count: space.systems.reduce((a, s) => a + s.components.length, 0),
                plans_count: space.plans.length,
                repos_count: Object.keys(space.config.repos ?? {}).length,
              };
            } catch {
              return { id: pid, name: pid.replace(/^project:/, ""), description: "", systems_count: 0, components_count: 0, plans_count: 0, repos_count: 0 };
            }
          });
          return {
            ...ws,
            description: `${project_summaries.length} independent projects`,
            systems_count: project_summaries.reduce((a, p) => a + p.systems_count, 0),
            components_count: project_summaries.reduce((a, p) => a + p.components_count, 0),
            plans_count: project_summaries.reduce((a, p) => a + p.plans_count, 0),
            repos_count: project_summaries.reduce((a, p) => a + p.repos_count, 0),
            project_summaries,
          };
        });
        sendJson(res, 200, { workspaces: enriched });
        return;
      }

      if (pathname === "/api/space") {
        const wsId = reqUrl.searchParams.get("workspace");
        const projectId = reqUrl.searchParams.get("project") ?? undefined;
        const workspaces = discoverWorkspaces(groundworkRoot);
        const chosenId = wsId ?? workspaces[0]?.id;
        if (!chosenId) {
          sendJson(res, 404, { error: "No workspaces registered" });
          return;
        }
        const payload = serializeSpace(groundworkRoot, chosenId, projectId);
        sendJson(res, 200, payload);
        return;
      }

      if (pathname === "/api/code-tree") {
        const wsId = reqUrl.searchParams.get("workspace") ?? "";
        const projectId = reqUrl.searchParams.get("project") ?? undefined;
        const repoKey = reqUrl.searchParams.get("repo") ?? "";
        const subPath = reqUrl.searchParams.get("subpath") ?? "";
        const workspaces = discoverWorkspaces(groundworkRoot);
        const ws = workspaces.find((w) => w.id === wsId || w.id === `workspace:${wsId}`);
        if (!ws) {
          sendJson(res, 404, { error: "Workspace not found" });
          return;
        }
        const spaceDir = resolveSpaceDir(ws, projectId);
        const space = loadSpace(spaceDir);
        const repoCfg = space.config.repos?.[repoKey];
        if (!repoCfg?.path) {
          sendJson(res, 200, { available: false, root: null, tree: [] });
          return;
        }
        const absRepo = path.isAbsolute(repoCfg.path)
          ? repoCfg.path
          : path.resolve(spaceDir, repoCfg.path);
        const targetDir = subPath ? path.resolve(absRepo, subPath) : absRepo;
        if (!targetDir.startsWith(absRepo) || !fs.existsSync(targetDir)) {
          sendJson(res, 200, { available: false, root: targetDir, tree: [] });
          return;
        }
        sendJson(res, 200, {
          available: true,
          repo: repoKey,
          root: targetDir,
          tree: readCodeTree(targetDir, 2),
        });
        return;
      }

      // Sandboxed prototype HTML endpoint with strict no-network CSP + X-Ray script
      if (pathname === "/api/prototype") {
        const wsId = reqUrl.searchParams.get("workspace") ?? "";
        const projectId = reqUrl.searchParams.get("project") ?? undefined;
        const planSlug = reqUrl.searchParams.get("plan") ?? "";
        const relFile = reqUrl.searchParams.get("file") ?? "";
        const xray = reqUrl.searchParams.get("xray") === "1";
        const state = reqUrl.searchParams.get("state") ?? "default";

        const workspaces = discoverWorkspaces(groundworkRoot);
        const ws = workspaces.find((w) => w.id === wsId || w.id === `workspace:${wsId}`);
        if (!ws) {
          res.writeHead(404);
          res.end("Workspace not found");
          return;
        }
        const spaceDir = resolveSpaceDir(ws, projectId);
        const designRoot = path.resolve(spaceDir, "plans", planSlug, "design");
        const targetPath = path.resolve(designRoot, relFile);
        if (!targetPath.startsWith(designRoot) || !fs.existsSync(targetPath)) {
          res.writeHead(404);
          res.end("Prototype file not found");
          return;
        }

        let html = fs.readFileSync(targetPath, "utf8");
        const stateJson = JSON.stringify(state);
        const stateInjection = `<style>
          [data-gw-state] { display: none !important; }
          [data-gw-state-active="true"] { display: block !important; }
          button[data-gw-state-active="true"], span[data-gw-state-active="true"], a[data-gw-state-active="true"] { display: inline-flex !important; }
          .gw-state-fallback-pill {
            position: fixed;
            top: 10px;
            right: 12px;
            background: #1e293b;
            color: #e2e8f0;
            font: 600 11px/1.4 ui-monospace, monospace;
            padding: 3px 8px;
            border-radius: 999px;
            border: 1px solid #475569;
            z-index: 9999;
          }
        </style>
        <script>
          (function() {
            var state = ${stateJson};
            document.documentElement.dataset.gwState = state;
            function applyState() {
              var nodes = document.querySelectorAll('[data-gw-state]');
              var matched = 0;
              for (var i = 0; i < nodes.length; i++) {
                var allowed = (nodes[i].getAttribute('data-gw-state') || '').split(/\\s+/);
                var isMatch = allowed.indexOf(state) !== -1;
                if (isMatch) {
                  nodes[i].setAttribute('data-gw-state-active', 'true');
                  matched++;
                } else {
                  nodes[i].removeAttribute('data-gw-state-active');
                }
              }
              if (state !== 'default' && matched === 0 && !document.querySelector('.gw-state-fallback-pill')) {
                var pill = document.createElement('div');
                pill.className = 'gw-state-fallback-pill';
                pill.textContent = 'state: ' + state;
                document.body.appendChild(pill);
              }
              window.dispatchEvent(new CustomEvent('gw:state', { detail: { state: state } }));
            }
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', applyState);
            } else {
              applyState();
            }
          })();
        </script>`;
        html = html.includes("</head>") ? html.replace("</head>", `${stateInjection}</head>`) : html + stateInjection;

        if (xray) {
          const xrayInjection = `<style>
            [data-gw-region], [data-gw-endpoint], [data-gw-schema] {
              outline: 2px dashed #6366f1 !important;
              outline-offset: 3px;
              position: relative;
            }
            [data-gw-region]::after, [data-gw-endpoint]::after {
              content: attr(data-gw-endpoint) " " attr(data-gw-schema);
              position: absolute;
              top: -22px;
              left: 0;
              background: #312e81;
              color: #e0e7ff;
              font: 600 10px/1.4 ui-monospace, monospace;
              padding: 2px 6px;
              border-radius: 4px;
              white-space: nowrap;
              pointer-events: none;
              z-index: 9999;
            }
          </style>`;
          html = html.includes("</head>") ? html.replace("</head>", `${xrayInjection}</head>`) : html + xrayInjection;
        }

        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:;",
          "Cache-Control": "no-store",
        });
        res.end(html);
        return;
      }

      // Pin inline review note -> plans/<plan>/reviews/<id>.yaml
      if (pathname === "/api/reviews" && req.method === "POST") {
        const body = JSON.parse(await readRequestBody(req)) as {
          workspace: string;
          project?: string;
          plan_slug: string;
          target_id: string;
          author: string;
          body: string;
        };
        const workspaces = discoverWorkspaces(groundworkRoot);
        const ws = workspaces.find((w) => w.id === body.workspace || w.id === `workspace:${body.workspace}`);
        if (!ws) {
          sendJson(res, 404, { error: "Workspace not found" });
          return;
        }
        const spaceDir = resolveSpaceDir(ws, body.project);
        const reviewsDir = path.join(spaceDir, "plans", body.plan_slug, "reviews");
        fs.mkdirSync(reviewsDir, { recursive: true });
        const stamp = Date.now().toString(36);
        const noteSlug = `note-${stamp}`;
        const note = {
          schema_version: 1,
          id: `review:${body.plan_slug}/${noteSlug}`,
          target_id: body.target_id,
          author: body.author || "Human Reviewer",
          created_at: new Date().toISOString(),
          status: "open",
          body: body.body,
        };
        fs.writeFileSync(path.join(reviewsDir, `${noteSlug}.yaml`), yaml.dump(note), "utf8");
        broadcastReload();
        sendJson(res, 201, { note });
        return;
      }

      // Static UI bundle fallback (for `groundwork serve`)
      if (uiDistDir && fs.existsSync(uiDistDir)) {
        const safePath = pathname === "/" ? "/index.html" : pathname;
        const candidate = path.resolve(uiDistDir, "." + safePath);
        const fileToServe =
          candidate.startsWith(uiDistDir) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
            ? candidate
            : path.join(uiDistDir, "index.html");
        const ext = path.extname(fileToServe).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream" });
        fs.createReadStream(fileToServe).pipe(res);
        return;
      }

      sendJson(res, 404, { error: `Not found: ${pathname}` });
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  server.on("close", () => {
    clearTimeout(debounceTimer);
    for (const w of watchers) w.close();
    for (const client of sseClients) client.end();
    sseClients.clear();
  });

  const shutdown = () => {
    for (const client of sseClients) client.end();
    sseClients.clear();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  server.listen(port, () => {
    console.log(`Groundwork server listening on http://localhost:${port}`);
  });

  return server;
}
