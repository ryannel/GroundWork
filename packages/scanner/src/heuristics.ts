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
    lower.endsWith("test.java") ||
    lower.endsWith("tests.java") ||
    lower.endsWith("test.kt") ||
    lower.endsWith("tests.cs") ||
    lower.startsWith("tests/") ||
    lower.includes("/tests/") ||
    lower.includes("/__tests__/") ||
    path.basename(lower).startsWith("test_")
  );
}

/** Normalize URLs/templates into a clean route path like `/meetings/{id}/tasks`. */
function normalizeRouteTarget(raw: string): string | undefined {
  let s = raw.trim().replace(/^["'`]|["'`]$/g, "");
  if (!s) return undefined;
  // Strip scheme+host or leading template base URL (e.g. `${BASE_URL}/meetings/${id}`)
  s = s.replace(/^https?:\/\/[^/]+/i, "");
  s = s.replace(/^\$\{[^}]+\}/, "");
  s = s.replace(/^\{[^}]+\}(?=\/)/, "");
  // Strip query string
  const qIdx = s.indexOf("?");
  if (qIdx >= 0) s = s.slice(0, qIdx);
  // Normalize JS `${id}` -> `{id}`, Go `%s`/`%d`/`%v` -> `{param}`
  s = s.replace(/\$\{([^}]+)\}/g, (_m, expr: string) => {
    const cleaned = expr.split(".").pop()?.replace(/[^a-zA-Z0-9_]/g, "") || "param";
    return `{${cleaned}}`;
  });
  s = s.replace(/%[sdvf]/g, "{param}");
  if (!s.startsWith("/")) return undefined;
  return s.replace(/\/+/g, "/");
}

function joinPaths(prefix: string, sub: string): string {
  const p = prefix.replace(/\/+$/, "");
  const s = sub.startsWith("/") ? sub : `/${sub}`;
  const combined = `${p}${s}`.replace(/\/+/g, "/");
  return combined.startsWith("/") ? combined : `/${combined}`;
}

// ── 1. Go ────────────────────────────────────────────────────────────────────

const GO_HTTP_METHOD_MAP: Record<string, string> = {
  "http.MethodGet": "GET",
  "http.MethodPost": "POST",
  "http.MethodPut": "PUT",
  "http.MethodPatch": "PATCH",
  "http.MethodDelete": "DELETE",
  "http.MethodHead": "HEAD",
  "http.MethodOptions": "OPTIONS",
};

function extractGoSurfaces(absFile: string, relFile: string, pkgRoot: string): SurfaceRecord[] {
  const content = fs.readFileSync(absFile, "utf8");
  const lines = content.split("\n");
  const surfaces: SurfaceRecord[] = [];

  const go122Mux = /\.(?:HandleFunc|Handle)\(\s*"(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+([^"]+)"/i;
  const classicMux = /\.(?:HandleFunc|Handle)\(\s*"(\/[^"]*)"/;
  const routerMethod = /\b[a-zA-Z_][a-zA-Z0-9_]*\.(Get|Post|Put|Patch|Delete|GET|POST|PUT|PATCH|DELETE)\(\s*"(\/[^"]*)"/;
  const outboundHttp = /http\.NewRequest(?:WithContext)?\(\s*(?:[^,]+,\s*)?(http\.Method[A-Za-z]+|"([A-Z]+)")\s*,\s*([^,)]+)/;
  const goDirectHttp = /\bhttp\.(Get|Post|Head)\(\s*([^,)]+)/;
  const restyCall = /\.\s*(Get|Post|Put|Patch|Delete)\(\s*"([^"]+)"/;
  const pubsubTopic = /\.Topic\(\s*"([^"]+)"\s*\)/;
  const pubsubSub = /\.Subscription\(\s*"([^"]+)"\s*\)/;
  const humaOpStart = /huma\.Operation\s*\{/;
  const humaShorthand = /\bhuma\.(Get|Post|Put|Patch|Delete)\(\s*[^,]+,\s*"(\/[^"]*)"/;

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
        if (mMethod) method = mMethod[2] ?? GO_HTTP_METHOD_MAP[mMethod[1]!];
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

    const mOut = line.match(outboundHttp);
    if (mOut) {
      const method = mOut[2] ?? GO_HTTP_METHOD_MAP[mOut[1]!] ?? "ANY";
      const urlArg = mOut[3]!.trim();
      let resolvedPath = normalizeRouteTarget(urlArg);
      // Look up to 16 lines above for `operationPath := fmt.Sprintf("/...")` (oapi-codegen & standard Go clients)
      if (!resolvedPath) {
        for (let k = Math.max(0, i - 16); k < i; k++) {
          const prev = lines[k]!;
          const mOp = prev.match(/(?:operationPath|path|endpoint|url)\s*:?=\s*(?:fmt\.Sprintf\(\s*)?"([^"]+)"/);
          if (mOp) {
            resolvedPath = normalizeRouteTarget(mOp[1]!);
            if (resolvedPath) break;
          }
        }
      }
      surfaces.push({
        surface_id: resolvedPath
          ? `outbound:${method}:${resolvedPath}@${relFile}#L${i + 1}`
          : `outbound:${relFile}#L${i + 1}`,
        kind: "outbound_call",
        facet: "outbound_calls",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "go-http-client",
        file: relFile,
        lines: [i + 1, i + 1],
        details: {
          method,
          ...(resolvedPath ? { path: resolvedPath } : { dynamic: true }),
        },
      });
      continue;
    }

    const mGoDirect = line.match(goDirectHttp);
    if (mGoDirect) {
      const method = mGoDirect[1]!.toUpperCase();
      const resolvedPath = normalizeRouteTarget(mGoDirect[2]!);
      surfaces.push({
        surface_id: resolvedPath
          ? `outbound:${method}:${resolvedPath}@${relFile}#L${i + 1}`
          : `outbound:${relFile}#L${i + 1}`,
        kind: "outbound_call",
        facet: "outbound_calls",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "go-http-client",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, ...(resolvedPath ? { path: resolvedPath } : { dynamic: true }) },
      });
    } else if (content.includes("resty") && restyCall.test(line) && !mRouter) {
      const mResty = line.match(restyCall);
      if (mResty) {
        const method = mResty[1]!.toUpperCase();
        const resolvedPath = normalizeRouteTarget(mResty[2]!);
        surfaces.push({
          surface_id: resolvedPath
            ? `outbound:${method}:${resolvedPath}@${relFile}#L${i + 1}`
            : `outbound:${relFile}#L${i + 1}`,
          kind: "outbound_call",
          facet: "outbound_calls",
          package_root: pkgRoot,
          denominator: "source_heuristic",
          extractor: "go-resty",
          file: relFile,
          lines: [i + 1, i + 1],
          details: { method, ...(resolvedPath ? { path: resolvedPath } : { dynamic: true }) },
        });
      }
    }
  }

  return surfaces;
}

// ── 2. Python ────────────────────────────────────────────────────────────────

function extractPythonSurfaces(absFile: string, relFile: string, pkgRoot: string): SurfaceRecord[] {
  const content = fs.readFileSync(absFile, "utf8");
  const lines = content.split("\n");
  const surfaces: SurfaceRecord[] = [];

  const prefixMatch = content.match(/APIRouter\([^)]*prefix\s*=\s*["']([^"']+)["']/);
  const routerPrefix = prefixMatch?.[1]?.replace(/\/$/, "") ?? "";

  const fastApiDecorator = /^\s*@[a-zA-Z_][a-zA-Z0-9_]*\.(get|post|put|patch|delete|websocket)\(\s*["']([^"']+)["']/i;
  const flaskDecorator = /^\s*@[a-zA-Z_][a-zA-Z0-9_]*\.route\(\s*["']([^"']+)["']([^)]*)\)/;
  const outboundPy = /\b(?:httpx|requests|client|session)\.(get|post|put|patch|delete)\(\s*([^,)]+)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim().startsWith("#")) continue;

    const mDec = line.match(fastApiDecorator);
    if (mDec) {
      const verb = mDec[1]!.toLowerCase();
      const rawPath = mDec[2]!;
      const fullPath = routerPrefix && !rawPath.startsWith(routerPrefix) ? `${routerPrefix}${rawPath}` : rawPath;
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

    const mFlask = line.match(flaskDecorator);
    if (mFlask) {
      const routePath = mFlask[1]!;
      const methodsMatch = mFlask[2]?.match(/methods\s*=\s*\[([^\]]+)\]/i);
      const methods = methodsMatch
        ? methodsMatch[1]!.split(",").map((x) => x.replace(/["'\s]/g, "").toUpperCase()).filter(Boolean)
        : ["GET"];
      for (const method of methods) {
        surfaces.push({
          surface_id: `route:${method}:${routePath}`,
          kind: "route",
          facet: "interfaces",
          package_root: pkgRoot,
          denominator: "source_heuristic",
          extractor: "flask",
          file: relFile,
          lines: [i + 1, i + 1],
          details: { method, path: routePath },
        });
      }
      continue;
    }

    const mOut = line.match(outboundPy);
    if (mOut) {
      const method = mOut[1]!.toUpperCase();
      const rawUrl = mOut[2]!.replace(/^f(?=["'])/, "");
      const resolvedPath = normalizeRouteTarget(rawUrl);
      surfaces.push({
        surface_id: resolvedPath
          ? `outbound:${method}:${resolvedPath}@${relFile}#L${i + 1}`
          : `outbound:${relFile}#L${i + 1}`,
        kind: "outbound_call",
        facet: "outbound_calls",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "python-http-client",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, ...(resolvedPath ? { path: resolvedPath } : { dynamic: true }) },
      });
    }
  }

  return surfaces;
}

// ── 3. TypeScript / JavaScript (including OpenAPI / Orval codegen tracing!) ──

interface GeneratedClientOp {
  readonly fnName: string;
  readonly method: string;
  readonly path: string;
  readonly file: string;
  readonly line: number;
  readonly pkgRoot: string;
}

function extractOrvalGeneratedClientOps(
  absFile: string,
  relFile: string,
  pkgRoot: string,
): GeneratedClientOp[] {
  const content = fs.readFileSync(absFile, "utf8");
  if (!content.includes("Generated by orval") && !content.includes("export const get") && !content.includes("customFetch")) {
    return [];
  }

  // 1. Collect URL helper functions: `export const getCreateAIThreadUrl = (...) => { ... return `/ai/threads` }`
  const urlByHelper = new Map<string, string>();
  const urlFnRx = /export\s+const\s+(get[A-Za-z0-9_]+Url)\s*=\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = urlFnRx.exec(content)) !== null) {
    const helperName = m[1]!;
    const body = m[2]!;
    const retMatch = body.match(/return\s+[`"']([^`"'\n]+)[`"']/);
    if (retMatch) {
      const norm = normalizeRouteTarget(retMatch[1]!);
      if (norm) urlByHelper.set(helperName, norm);
    }
  }

  if (urlByHelper.size === 0) return [];

  // 2. Match exported endpoint functions calling those URL helpers + HTTP method
  const ops: GeneratedClientOp[] = [];
  const fnRx = /export\s+const\s+([a-zA-Z0-9_]+)\s*=\s*async\s*\(/g;
  while ((m = fnRx.exec(content)) !== null) {
    const fnName = m[1]!;
    const startIdx = m.index;
    const snippet = content.slice(startIdx, startIdx + 900);
    const helperMatch = snippet.match(/\b(get[A-Za-z0-9_]+Url)\s*\(/);
    if (!helperMatch) continue;
    const routePath = urlByHelper.get(helperMatch[1]!);
    if (!routePath) continue;
    const methodMatch = snippet.match(/method:\s*['"]([A-Z]+)['"]/i);
    const method = (methodMatch?.[1] ?? "GET").toUpperCase();
    const lineNum = content.slice(0, startIdx).split("\n").length;
    ops.push({ fnName, method, path: routePath, file: relFile, line: lineNum, pkgRoot });
  }

  return ops;
}

function extractTsJsSurfaces(
  absFile: string,
  relFile: string,
  pkgRoot: string,
  generatedFiles: ReadonlySet<string>,
): SurfaceRecord[] {
  if (generatedFiles.has(relFile)) return [];
  const content = fs.readFileSync(absFile, "utf8");
  const lines = content.split("\n");
  const surfaces: SurfaceRecord[] = [];

  // Next.js App Router API routes: app/api/**/route.ts exporting GET/POST/PUT/PATCH/DELETE
  const normRel = relFile.replace(/\\/g, "/");
  const nextApiMatch = normRel.match(/(?:^|\/)app(\/api\/.+)\/route\.(?:ts|js)$/);
  if (nextApiMatch) {
    const apiPath = nextApiMatch[1]!.replace(/\[([^\]]+)\]/g, "{$1}");
    const exportedVerbs = [...content.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)];
    for (const ev of exportedVerbs) {
      const method = ev[1]!;
      surfaces.push({
        surface_id: `route:${method}:${apiPath}`,
        kind: "route",
        facet: "interfaces",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "nextjs-app-router",
        file: relFile,
        lines: [1, 1],
        details: { method, path: apiPath },
      });
    }
  }

  // NestJS @Controller("prefix") + @Get/@Post...
  const ctrlMatch = content.match(/@Controller\(\s*["']([^"']*)["']\s*\)/);
  const nestPrefix = ctrlMatch?.[1] ? (ctrlMatch[1].startsWith("/") ? ctrlMatch[1] : `/${ctrlMatch[1]}`) : "";
  const nestRouteRx = /^\s*@(Get|Post|Put|Patch|Delete)\(\s*(?:["']([^"']*)["'])?\s*\)/;

  const reactRoute = /<Route\b[^>]*\bpath\s*=\s*["']([^"']+)["']/;
  const expressRoute = /\b(?:app|router|fastify|server)\.(get|post|put|patch|delete)\(\s*["'](\/[^"']*)["']/i;
  const fetchLiteral = /\bfetch\(\s*[`"']([^`"'\n]+)[`"']/;
  const fetchDynamic = /\bfetch\(\s*([a-zA-Z_][a-zA-Z0-9_.?()]*)\s*(?:,|\))/;
  const axiosKyCall = /\b(?:axios|ky|apiClient|httpClient)\.(get|post|put|patch|delete)\(\s*([`"'][^`"'\n]+[`"']|[a-zA-Z_][a-zA-Z0-9_.]*)/i;
  const wsCall = /\bnew\s+WebSocket\(/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

    if (ctrlMatch) {
      const mNest = line.match(nestRouteRx);
      if (mNest) {
        const method = mNest[1]!.toUpperCase();
        const routePath = joinPaths(nestPrefix, mNest[2] ?? "");
        surfaces.push({
          surface_id: `route:${method}:${routePath}`,
          kind: "route",
          facet: "interfaces",
          package_root: pkgRoot,
          denominator: "source_heuristic",
          extractor: "nestjs",
          file: relFile,
          lines: [i + 1, i + 1],
          details: { method, path: routePath },
        });
        continue;
      }
    }

    const mExpr = line.match(expressRoute);
    if (mExpr) {
      const method = mExpr[1]!.toUpperCase();
      const routePath = mExpr[2]!;
      surfaces.push({
        surface_id: `route:${method}:${routePath}`,
        kind: "route",
        facet: "interfaces",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "ts-router",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, path: routePath },
      });
      continue;
    }

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

    const mFetch = line.match(fetchLiteral);
    if (mFetch) {
      const snippet = lines.slice(i, Math.min(lines.length, i + 5)).join(" ");
      const mMethod = snippet.match(/method:\s*["']([A-Z]+)["']/i);
      const method = (mMethod?.[1] ?? "GET").toUpperCase();
      const normPath = normalizeRouteTarget(mFetch[1]!);
      surfaces.push({
        surface_id: normPath
          ? `outbound:${method}:${normPath}@${relFile}#L${i + 1}`
          : `outbound:fetch:${mFetch[1]!}@${relFile}#L${i + 1}`,
        kind: "outbound_call",
        facet: "outbound_calls",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "ts-fetch",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, target: mFetch[1]!, ...(normPath ? { path: normPath } : {}) },
      });
    } else if (fetchDynamic.test(line) && !relFile.endsWith("fetcher.ts")) {
      surfaces.push({
        surface_id: `outbound:fetch-dynamic:${relFile}#L${i + 1}`,
        kind: "outbound_call",
        facet: "outbound_calls",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "ts-fetch",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { dynamic: true },
      });
    }

    const mAxios = line.match(axiosKyCall);
    if (mAxios) {
      const method = mAxios[1]!.toUpperCase();
      const rawArg = mAxios[2]!;
      const normPath = /^[`"']/.test(rawArg) ? normalizeRouteTarget(rawArg) : undefined;
      surfaces.push({
        surface_id: normPath
          ? `outbound:${method}:${normPath}@${relFile}#L${i + 1}`
          : `outbound:http-client:${relFile}#L${i + 1}`,
        kind: "outbound_call",
        facet: "outbound_calls",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "ts-http-client",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, ...(normPath ? { path: normPath } : { dynamic: true }) },
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

// ── 4. Rust ──────────────────────────────────────────────────────────────────

function extractRustSurfaces(absFile: string, relFile: string, pkgRoot: string, crateName: string): SurfaceRecord[] {
  const content = fs.readFileSync(absFile, "utf8");
  const lines = content.split("\n");
  const surfaces: SurfaceRecord[] = [];

  const isLibRs = relFile.endsWith("/src/lib.rs") || relFile === "src/lib.rs";
  const pubModRx = /^\s*pub\s+mod\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;/;
  const actixRocketAttr = /^\s*#\[(get|post|put|patch|delete)\(\s*"([^"]+)"/i;
  const axumRoute = /\.route\(\s*"([^"]+)"\s*,\s*(get|post|put|patch|delete)\(/i;
  const reqwestCall = /\b(?:reqwest|client|http_client)\.(get|post|put|patch|delete)\(\s*([^)]+)\)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim().startsWith("//")) continue;

    if (isLibRs) {
      const m = line.match(pubModRx);
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

    const mAttr = line.match(actixRocketAttr);
    if (mAttr) {
      const method = mAttr[1]!.toUpperCase();
      const routePath = mAttr[2]!;
      surfaces.push({
        surface_id: `route:${method}:${routePath}`,
        kind: "route",
        facet: "interfaces",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "rust-http",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, path: routePath },
      });
      continue;
    }

    const mAxum = line.match(axumRoute);
    if (mAxum) {
      const routePath = mAxum[1]!;
      const method = mAxum[2]!.toUpperCase();
      surfaces.push({
        surface_id: `route:${method}:${routePath}`,
        kind: "route",
        facet: "interfaces",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "rust-axum",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, path: routePath },
      });
    }

    const mReq = line.match(reqwestCall);
    if (mReq) {
      const method = mReq[1]!.toUpperCase();
      const rawUrl = mReq[2]!.trim();
      const litMatch = rawUrl.match(/"([^"]+)"/);
      const normPath = litMatch ? normalizeRouteTarget(litMatch[1]!) : undefined;
      surfaces.push({
        surface_id: normPath
          ? `outbound:${method}:${normPath}@${relFile}#L${i + 1}`
          : `outbound:reqwest:${relFile}#L${i + 1}`,
        kind: "outbound_call",
        facet: "outbound_calls",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "rust-reqwest",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, ...(normPath ? { path: normPath } : { dynamic: true }) },
      });
    }
  }
  return surfaces;
}

// ── 5. Java & Kotlin ─────────────────────────────────────────────────────────

function extractJavaKotlinSurfaces(absFile: string, relFile: string, pkgRoot: string): SurfaceRecord[] {
  const content = fs.readFileSync(absFile, "utf8");
  const lines = content.split("\n");
  const surfaces: SurfaceRecord[] = [];

  const isFeignClient = /@FeignClient\b/.test(content);
  const classPrefixMatch =
    content.match(/@RequestMapping\(\s*(?:value\s*=\s*|path\s*=\s*)?["']([^"']+)["']/) ??
    content.match(/@Path\(\s*["']([^"']+)["']\s*\)/);
  const classPrefix = classPrefixMatch?.[1] ?? "";

  const springMapping = /@(Get|Post|Put|Patch|Delete)Mapping\(\s*(?:(?:value|path)\s*=\s*)?(?:["']([^"']*)["'])?/;
  const retrofitAnnot = /@(GET|POST|PUT|PATCH|DELETE)\(\s*["']([^"']+)["']\s*\)/;
  const webClientCall = /\.(get|post|put|patch|delete)\(\)\s*\.uri\(\s*["']([^"']+)["']/i;
  const restTemplateCall = /restTemplate\.(getForObject|getForEntity|postForObject|postForEntity|put|delete)\(\s*["']([^"']+)["']/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim().startsWith("//")) continue;

    const mSpring = line.match(springMapping);
    if (mSpring) {
      const method = mSpring[1]!.toUpperCase();
      const routePath = joinPaths(classPrefix, mSpring[2] ?? "");
      if (isFeignClient) {
        surfaces.push({
          surface_id: `outbound:${method}:${routePath}@${relFile}#L${i + 1}`,
          kind: "outbound_call",
          facet: "outbound_calls",
          package_root: pkgRoot,
          denominator: "source_heuristic",
          extractor: "java-feign",
          file: relFile,
          lines: [i + 1, i + 1],
          details: { method, path: routePath, client_kind: "feign" },
        });
      } else {
        surfaces.push({
          surface_id: `route:${method}:${routePath}`,
          kind: "route",
          facet: "interfaces",
          package_root: pkgRoot,
          denominator: "source_heuristic",
          extractor: "spring-web",
          file: relFile,
          lines: [i + 1, i + 1],
          details: { method, path: routePath },
        });
      }
      continue;
    }

    const mRetro = line.match(retrofitAnnot);
    if (mRetro) {
      const method = mRetro[1]!.toUpperCase();
      const routePath = normalizeRouteTarget(mRetro[2]!) ?? `/${mRetro[2]!.replace(/^\/+/, "")}`;
      surfaces.push({
        surface_id: `outbound:${method}:${routePath}@${relFile}#L${i + 1}`,
        kind: "outbound_call",
        facet: "outbound_calls",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "java-retrofit",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, path: routePath, client_kind: "retrofit" },
      });
      continue;
    }

    const mWc = line.match(webClientCall);
    if (mWc) {
      const method = mWc[1]!.toUpperCase();
      const normPath = normalizeRouteTarget(mWc[2]!);
      surfaces.push({
        surface_id: normPath ? `outbound:${method}:${normPath}@${relFile}#L${i + 1}` : `outbound:webclient:${relFile}#L${i + 1}`,
        kind: "outbound_call",
        facet: "outbound_calls",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "spring-webclient",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, ...(normPath ? { path: normPath } : { dynamic: true }) },
      });
      continue;
    }

    const mRt = line.match(restTemplateCall);
    if (mRt) {
      const fn = mRt[1]!.toLowerCase();
      const method = fn.startsWith("post") ? "POST" : fn.startsWith("put") ? "PUT" : fn.startsWith("delete") ? "DELETE" : "GET";
      const normPath = normalizeRouteTarget(mRt[2]!);
      surfaces.push({
        surface_id: normPath ? `outbound:${method}:${normPath}@${relFile}#L${i + 1}` : `outbound:resttemplate:${relFile}#L${i + 1}`,
        kind: "outbound_call",
        facet: "outbound_calls",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "spring-resttemplate",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, ...(normPath ? { path: normPath } : { dynamic: true }) },
      });
    }
  }

  return surfaces;
}

// ── 6. C# (.NET) ─────────────────────────────────────────────────────────────

function extractCSharpSurfaces(absFile: string, relFile: string, pkgRoot: string): SurfaceRecord[] {
  const content = fs.readFileSync(absFile, "utf8");
  const lines = content.split("\n");
  const surfaces: SurfaceRecord[] = [];

  const routeAttrMatch = content.match(/\[Route\(\s*"([^"]+)"\s*\)\]/);
  const ctrlNameMatch = content.match(/class\s+([A-Za-z0-9_]+)Controller\b/);
  const ctrlPrefix = routeAttrMatch?.[1]
    ? routeAttrMatch[1].replace(/\[controller\]/i, (ctrlNameMatch?.[1] ?? "").toLowerCase())
    : "";

  const aspNetAttr = /\[Http(Get|Post|Put|Patch|Delete)(?:\(\s*"([^"]*)"\s*\))?\]/i;
  const minimalApi = /\.(MapGet|MapPost|MapPut|MapPatch|MapDelete)\(\s*"([^"]+)"/i;
  const refitAttr = /\[(Get|Post|Put|Patch|Delete)\(\s*"([^"]+)"\s*\)\]/i;
  const httpClientCall = /\.(GetAsync|GetFromJsonAsync|PostAsync|PostAsJsonAsync|PutAsync|PutAsJsonAsync|PatchAsync|DeleteAsync)\(\s*(\$?"[^"]+"|[a-zA-Z_][a-zA-Z0-9_.]*)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim().startsWith("//")) continue;

    const mAsp = line.match(aspNetAttr);
    if (mAsp) {
      const method = mAsp[1]!.toUpperCase();
      const routePath = joinPaths(ctrlPrefix, mAsp[2] ?? "");
      surfaces.push({
        surface_id: `route:${method}:${routePath}`,
        kind: "route",
        facet: "interfaces",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "aspnetcore",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, path: routePath },
      });
    }

    const mMin = line.match(minimalApi);
    if (mMin) {
      const method = mMin[1]!.replace(/^Map/i, "").toUpperCase();
      const routePath = mMin[2]!;
      surfaces.push({
        surface_id: `route:${method}:${routePath}`,
        kind: "route",
        facet: "interfaces",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "aspnetcore-minimal",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, path: routePath },
      });
      continue;
    }

    const mRefit = line.match(refitAttr);
    if (mRefit && /\binterface\b/.test(content)) {
      const method = mRefit[1]!.toUpperCase();
      const routePath = normalizeRouteTarget(mRefit[2]!) ?? `/${mRefit[2]!.replace(/^\/+/, "")}`;
      surfaces.push({
        surface_id: `outbound:${method}:${routePath}@${relFile}#L${i + 1}`,
        kind: "outbound_call",
        facet: "outbound_calls",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "csharp-refit",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, path: routePath, client_kind: "refit" },
      });
      continue;
    }

    const mHc = line.match(httpClientCall);
    if (mHc) {
      const fn = mHc[1]!.toLowerCase();
      const method = fn.startsWith("post")
        ? "POST"
        : fn.startsWith("put")
          ? "PUT"
          : fn.startsWith("patch")
            ? "PATCH"
            : fn.startsWith("delete")
              ? "DELETE"
              : "GET";
      const rawArg = mHc[2]!.replace(/^\$/, "");
      const normPath = rawArg.startsWith('"') ? normalizeRouteTarget(rawArg) : undefined;
      surfaces.push({
        surface_id: normPath ? `outbound:${method}:${normPath}@${relFile}#L${i + 1}` : `outbound:httpclient:${relFile}#L${i + 1}`,
        kind: "outbound_call",
        facet: "outbound_calls",
        package_root: pkgRoot,
        denominator: "source_heuristic",
        extractor: "csharp-httpclient",
        file: relFile,
        lines: [i + 1, i + 1],
        details: { method, ...(normPath ? { path: normPath } : { dynamic: true }) },
      });
    }
  }

  return surfaces;
}

// ── Main Entrypoint ──────────────────────────────────────────────────────────

export function extractHeuristicSurfaces(
  repoDir: string,
  allFiles: readonly string[],
  packageRoots: readonly PackageRoot[],
): SurfaceRecord[] {
  const surfaces: SurfaceRecord[] = [];
  const pkgByPath = new Map(packageRoots.map((p) => [p.path, p]));

  // Pre-pass: detect Orval / OpenAPI generated TS clients and trace real call-site usage across the same package!
  const generatedClientOps: GeneratedClientOp[] = [];
  const generatedFileSet = new Set<string>();
  const tsFilesByPkg = new Map<string, Array<{ abs: string; rel: string }>>();

  for (const absFile of allFiles) {
    const relFile = path.relative(repoDir, absFile);
    if (isTestFile(relFile)) continue;
    const ext = path.extname(absFile).toLowerCase();
    if (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx") {
      const pkgRoot = resolvePackageRoot(relFile, packageRoots);
      const arr = tsFilesByPkg.get(pkgRoot) ?? [];
      arr.push({ abs: absFile, rel: relFile });
      tsFilesByPkg.set(pkgRoot, arr);

      if (relFile.toLowerCase().includes("generated")) {
        const ops = extractOrvalGeneratedClientOps(absFile, relFile, pkgRoot);
        if (ops.length > 0) {
          generatedFileSet.add(relFile);
          generatedClientOps.push(...ops);
        }
      }
    }
  }

  // Trace which generated client functions are actually imported/called in non-generated package files!
  if (generatedClientOps.length > 0) {
    const opsByPkg = new Map<string, GeneratedClientOp[]>();
    for (const op of generatedClientOps) {
      const arr = opsByPkg.get(op.pkgRoot) ?? [];
      arr.push(op);
      opsByPkg.set(op.pkgRoot, arr);
    }

    for (const [pkgRoot, ops] of opsByPkg.entries()) {
      const pkgFiles = (tsFilesByPkg.get(pkgRoot) ?? []).filter((f) => !generatedFileSet.has(f.rel));
      const fileContents = pkgFiles.map((f) => ({ rel: f.rel, text: fs.readFileSync(f.abs, "utf8") }));

      for (const op of ops) {
        const callRx = new RegExp(`\\b${op.fnName}\\b`);
        const usedIn: string[] = [];
        for (const fc of fileContents) {
          if (callRx.test(fc.text)) usedIn.push(fc.rel);
        }
        surfaces.push({
          surface_id: `outbound:${op.method}:${op.path}`,
          kind: "outbound_call",
          facet: "outbound_calls",
          package_root: op.pkgRoot,
          denominator: "source_heuristic",
          extractor: "ts-openapi-client",
          file: op.file,
          lines: [op.line, op.line],
          symbol: op.fnName,
          details: {
            method: op.method,
            path: op.path,
            function: op.fnName,
            client_kind: "openapi-codegen",
            usage_count: usedIn.length,
            used_in_files: usedIn.slice(0, 10),
          },
        });
      }
    }
  }

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
      surfaces.push(...extractTsJsSurfaces(absFile, relFile, pkgRoot, generatedFileSet));
    } else if (ext === ".rs") {
      const crateName = pkgByPath.get(pkgRoot)?.name ?? path.basename(pkgRoot);
      surfaces.push(...extractRustSurfaces(absFile, relFile, pkgRoot, crateName));
    } else if (ext === ".java" || ext === ".kt") {
      surfaces.push(...extractJavaKotlinSurfaces(absFile, relFile, pkgRoot));
    } else if (ext === ".cs") {
      surfaces.push(...extractCSharpSurfaces(absFile, relFile, pkgRoot));
    }
  }

  return surfaces;
}
