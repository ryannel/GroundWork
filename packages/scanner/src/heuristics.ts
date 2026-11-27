import fs from "node:fs";
import path from "node:path";
import type { PackageRoot, SurfaceRecord } from "@groundwork/schema";
import { resolvePackageRoot } from "./package-roots.js";

function isTestFile(relFile: string): boolean {
  const lower = relFile.toLowerCase();
  return (
    lower.endsWith("_test.go") ||
    lower.includes(".test.") ||
    lower.includes(".spec.") ||
    lower.startsWith("tests/") ||
    lower.includes("/tests/") ||
    lower.includes("/__tests__/") ||
    path.basename(lower).startsWith("test_")
  );
}

function extractGoSurfaces(absFile: string, relFile: string, pkgRoot: string): SurfaceRecord[] {
  const content = fs.readFileSync(absFile, "utf8");
  const lines = content.split("\n");
  const surfaces: SurfaceRecord[] = [];

  // Go 1.22+ ServeMux: HandleFunc("POST /v1/foo", handler) or Handle("GET /bar", ...)
  const go122Mux = /\.(?:HandleFunc|Handle)\(\s*"(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+([^"]+)"/i;
  // Classic ServeMux: HandleFunc("/api/foo", handler)
  const classicMux = /\.(?:HandleFunc|Handle)\(\s*"(\/[^"]*)"/;
  // Chi / Gin / Echo: r.Get("/path", ...) / r.POST("/path", ...)
  const routerMethod = /\b[a-zA-Z_][a-zA-Z0-9_]*\.(Get|Post|Put|Patch|Delete|GET|POST|PUT|PATCH|DELETE)\(\s*"(\/[^"]*)"/;
  // Outbound HTTP: http.NewRequest*(..., method, url, ...)
  const outboundHttp = /http\.NewRequest(?:WithContext)?\(/;
  // PubSub Topic / Subscription
  const pubsubTopic = /\.Topic\(\s*"([^"]+)"\s*\)/;
  const pubsubSub = /\.Subscription\(\s*"([^"]+)"\s*\)/;

  // Huma v2: huma.Operation{ ... Method: http.MethodGet / "GET", Path: "/..." }
  const humaOpStart = /huma\.Operation\s*\{/;
  // Huma shorthand: huma.Get(api, "/path", ...)
  const humaShorthand = /\bhuma\.(Get|Post|Put|Patch|Delete)\(\s*[^,]+,\s*"(\/[^"]*)"/;

  const goHttpMethodMap: Record<string, string> = {
    "http.MethodGet": "GET",
    "http.MethodPost": "POST",
    "http.MethodPut": "PUT",
    "http.MethodPatch": "PATCH",
    "http.MethodDelete": "DELETE",
    "http.MethodHead": "HEAD",
    "http.MethodOptions": "OPTIONS",
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) continue;

    if (humaOpStart.test(line)) {
      let method: string | undefined;
      let routePath: string | undefined;
      let operationId: string | undefined;
      let endLine = i;
      for (let j = i; j < Math.min(i + 25, lines.length); j++) {
        const l = lines[j]!;
        const mMethod = l.match(/\bMethod:\s*(http\.Method[A-Za-z]+|"([A-Z]+)")/);
        if (mMethod) {
          method = mMethod[2] ?? goHttpMethodMap[mMethod[1]!];
        }
        const mPath = l.match(/\bPath:\s*"([^"]+)"/);
        if (mPath) routePath = mPath[1];
        const mOpId = l.match(/\bOperationID:\s*"([^"]+)"/);
        if (mOpId) operationId = mOpId[1];
        if (j > i && l.includes("}")) {
          endLine = j;
          break;
        }
      }
      if (method && routePath) {
        surfaces.push({
          surface_id: `route:${method}:${routePath}`,
          kind: "route",
          facet: "interfaces",
          package_root: pkgRoot,
          denominator: "source_heuristic",
          extractor: "go-huma",
          file: relFile,
          lines: [i + 1, endLine + 1],
          ...(operationId ? { symbol: operationId } : {}),
          details: { method, path: routePath, ...(operationId ? { operation_id: operationId } : {}) },
        });
      }
      continue;
    }

    const mHumaShort = line.match(humaShorthand);
    if (mHumaShort) {
      const method = mHumaShort[1]!.toUpperCase();
      const routePath = mHumaShort[2]!;
      surfaces.push({
        surface_id: `route:${method}:${routePath}`,
        kind: "route",
        facet: "interfaces",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "go-huma",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, path: routePath },
      });
      continue;
    }

    const m122 = line.match(go122Mux);
    if (m122) {
      const method = m122[1]!.toUpperCase();
      const routePath = m122[2]!;
      surfaces.push({
        surface_id: `route:${method}:${routePath}`,
        kind: "route",
        facet: "interfaces",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "go-http",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, path: routePath },
      });
      continue;
    }

    const mRouter = line.match(routerMethod);
    if (mRouter) {
      const method = mRouter[1]!.toUpperCase();
      const routePath = mRouter[2]!;
      surfaces.push({
        surface_id: `route:${method}:${routePath}`,
        kind: "route",
        facet: "interfaces",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "go-router",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, path: routePath },
      });
      continue;
    }

    const mClassic = line.match(classicMux);
    if (mClassic) {
      const routePath = mClassic[1]!;
      surfaces.push({
        surface_id: `route:ANY:${routePath}`,
        kind: "route",
        facet: "interfaces",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "go-http",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method: "ANY", path: routePath },
      });
    }

    const mTopic = line.match(pubsubTopic);
    if (mTopic) {
      surfaces.push({
        surface_id: `topic:${mTopic[1]!}`,
        kind: "topic",
        facet: "messages_published",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "go-pubsub",
        file: relFile,
        lines: [i + 1, i + 1],
      });
    }

    const mSub = line.match(pubsubSub);
    if (mSub) {
      surfaces.push({
        surface_id: `subscription:${mSub[1]!}`,
        kind: "subscription",
        facet: "messages_consumed",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "go-pubsub",
        file: relFile,
        lines: [i + 1, i + 1],
      });
    }

    if (outboundHttp.test(line)) {
      surfaces.push({
        surface_id: `outbound:${relFile}#L${i + 1}`,
        kind: "outbound_call",
        facet: "outbound_calls",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "go-http-client",
        file: relFile,
        lines: [i + 1, i + 1],
      });
    }
  }

  return surfaces;
}

function extractPythonSurfaces(absFile: string, relFile: string, pkgRoot: string): SurfaceRecord[] {
  const content = fs.readFileSync(absFile, "utf8");
  const lines = content.split("\n");
  const surfaces: SurfaceRecord[] = [];

  // Detect optional APIRouter(prefix="/...") in the file
  const prefixMatch = content.match(/APIRouter\([^)]*prefix\s*=\s*["']([^"']+)["']/);
  const routerPrefix = prefixMatch?.[1]?.replace(/\/$/, "") ?? "";

  const fastApiDecorator = /^\s*@[a-zA-Z_][a-zA-Z0-9_]*\.(get|post|put|patch|delete|websocket)\(\s*["']([^"']+)["']/i;
  const outboundPy = /\b(?:httpx|requests)\.(?:get|post|put|patch|delete|request)\(/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const mDec = line.match(fastApiDecorator);
    if (mDec) {
      const verb = mDec[1]!.toLowerCase();
      const rawPath = mDec[2]!;
      const fullPath = routerPrefix && !rawPath.startsWith(routerPrefix) ? `${routerPrefix}${rawPath}` : rawPath;
      // Peek next non-decorator def line for symbol
      let symbol: string | undefined;
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const defMatch = lines[j]!.match(/^\s*(?:async\s+)?def\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (defMatch) {
          symbol = defMatch[1];
          break;
        }
      }

      if (verb === "websocket") {
        surfaces.push({
          surface_id: `ws:${fullPath}`,
          kind: "ws_channel",
          facet: "interfaces",
          package_root: pkgRoot,
          denominator: "source_heuristic",
          extractor: "fastapi",
          file: relFile,
          lines: [i + 1, i + 1],
          ...(symbol ? { symbol } : {}),
          details: { path: fullPath },
        });
      } else {
        const method = verb.toUpperCase();
        surfaces.push({
          surface_id: `route:${method}:${fullPath}`,
          kind: "route",
          facet: "interfaces",
          package_root: pkgRoot,
          denominator: "source_heuristic",
          extractor: "fastapi",
          file: relFile,
          lines: [i + 1, i + 1],
          ...(symbol ? { symbol } : {}),
          details: { method, path: fullPath },
        });
      }
      continue;
    }

    if (outboundPy.test(line)) {
      surfaces.push({
        surface_id: `outbound:${relFile}#L${i + 1}`,
        kind: "outbound_call",
        facet: "outbound_calls",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "python-http-client",
        file: relFile,
        lines: [i + 1, i + 1],
      });
    }
  }

  return surfaces;
}

function extractTsJsSurfaces(absFile: string, relFile: string, pkgRoot: string): SurfaceRecord[] {
  const content = fs.readFileSync(absFile, "utf8");
  const lines = content.split("\n");
  const surfaces: SurfaceRecord[] = [];

  const reactRoute = /<Route\b[^>]*\bpath\s*=\s*["']([^"']+)["']/;
  const fetchCall = /\bfetch\(\s*[`"']([^`"'\n]+)[`"']/;
  const wsCall = /\bnew\s+WebSocket\(/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

    const mRoute = line.match(reactRoute);
    if (mRoute) {
      surfaces.push({
        surface_id: `screen:${mRoute[1]!}`,
        kind: "screen",
        facet: "screens",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "react-router",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { route: mRoute[1]! },
      });
    }

    const mFetch = line.match(fetchCall);
    if (mFetch) {
      surfaces.push({
        surface_id: `outbound:fetch:${mFetch[1]!}@${relFile}#L${i + 1}`,
        kind: "outbound_call",
        facet: "outbound_calls",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "ts-fetch",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { target: mFetch[1]! },
      });
    }

    if (wsCall.test(line)) {
      surfaces.push({
        surface_id: `outbound:ws:${relFile}#L${i + 1}`,
        kind: "outbound_call",
        facet: "outbound_calls",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "ts-websocket",
        file: relFile,
        lines: [i + 1, i + 1],
      });
    }
  }

  return surfaces;
}

function extractRustLibExports(absFile: string, relFile: string, pkgRoot: string, crateName: string): SurfaceRecord[] {
  if (!relFile.endsWith("/src/lib.rs") && relFile !== "src/lib.rs") return [];
  const content = fs.readFileSync(absFile, "utf8");
  const lines = content.split("\n");
  const surfaces: SurfaceRecord[] = [];
  const pubModRx = /^\s*pub\s+mod\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;/;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(pubModRx);
    if (m) {
      surfaces.push({
        surface_id: `module_export:${crateName}::${m[1]!}`,
        kind: "module_export",
        facet: "interfaces",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "rust-lib-exports",
        file: relFile,
        lines: [i + 1, i + 1],
        symbol: m[1]!,
        details: { crate: crateName, module: m[1]! },
      });
    }
  }
  return surfaces;
}

export function extractHeuristicSurfaces(
  repoDir: string,
  allFiles: readonly string[],
  packageRoots: readonly PackageRoot[],
): SurfaceRecord[] {
  const surfaces: SurfaceRecord[] = [];
  const pkgByPath = new Map(packageRoots.map((p) => [p.path, p]));

  for (const absFile of allFiles) {
    const relFile = path.relative(repoDir, absFile);
    if (isTestFile(relFile)) continue;

    const ext = path.extname(absFile).toLowerCase();
    const pkgRoot = resolvePackageRoot(relFile, packageRoots);

    if (ext === ".go") {
      surfaces.push(...extractGoSurfaces(absFile, relFile, pkgRoot));
    } else if (ext === ".py") {
      surfaces.push(...extractPythonSurfaces(absFile, relFile, pkgRoot));
    } else if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx") {
      surfaces.push(...extractTsJsSurfaces(absFile, relFile, pkgRoot));
    } else if (ext === ".rs") {
      const crateName = pkgByPath.get(pkgRoot)?.name ?? path.basename(pkgRoot);
      surfaces.push(...extractRustLibExports(absFile, relFile, pkgRoot, crateName));
    }
  }

  return surfaces;
}
