import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { PackageRoot, SurfaceRecord } from "@groundwork/schema";
import { resolvePackageRoot } from "./package-roots.js";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);

function parseStructuredDoc(absFile: string): Record<string, unknown> | undefined {
  const ext = path.extname(absFile).toLowerCase();
  try {
    const raw = fs.readFileSync(absFile, "utf8");
    const parsed = ext === ".json" ? JSON.parse(raw) : yaml.load(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

interface ExtractedField {
  readonly name: string;
  readonly type: string;
  readonly required?: boolean;
  readonly description?: string;
}

function resolveRef(doc: Record<string, unknown>, schema: unknown, depth = 0): Record<string, unknown> | undefined {
  if (!schema || typeof schema !== "object" || depth > 6) return undefined;
  const obj = schema as Record<string, unknown>;
  if (typeof obj.$ref === "string" && obj.$ref.startsWith("#/")) {
    const parts = obj.$ref.slice(2).split("/");
    let cur: unknown = doc;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        return undefined;
      }
    }
    return resolveRef(doc, cur, depth + 1);
  }
  return obj;
}

function describeSchemaType(doc: Record<string, unknown>, raw: unknown): string {
  const s = resolveRef(doc, raw);
  if (!s) return "any";
  if (Array.isArray(s.type)) return s.type.join(" | ");
  if (s.type === "array") {
    return `${describeSchemaType(doc, s.items)}[]`;
  }
  if (typeof s.format === "string" && typeof s.type === "string") {
    return `${s.type} (${s.format})`;
  }
  if (Array.isArray(s.enum)) {
    return `enum(${s.enum.slice(0, 4).map(String).join(" | ")}${s.enum.length > 4 ? " | …" : ""})`;
  }
  if (typeof s.type === "string") return s.type;
  if (s.properties) return "object";
  if (Array.isArray(s.anyOf)) return s.anyOf.slice(0, 3).map((x) => describeSchemaType(doc, x)).join(" | ");
  if (Array.isArray(s.oneOf)) return s.oneOf.slice(0, 3).map((x) => describeSchemaType(doc, x)).join(" | ");
  return "object";
}

function extractSchemaFields(doc: Record<string, unknown>, raw: unknown): ExtractedField[] {
  const s = resolveRef(doc, raw);
  if (!s) return [];
  if (s.type === "array" && s.items) {
    return extractSchemaFields(doc, s.items);
  }
  const props = s.properties;
  if (!props || typeof props !== "object") return [];
  const reqSet = new Set(Array.isArray(s.required) ? s.required.map(String) : []);
  const fields: ExtractedField[] = [];
  for (const [name, propSchema] of Object.entries(props as Record<string, unknown>).slice(0, 24)) {
    const resolved = resolveRef(doc, propSchema);
    fields.push({
      name,
      type: describeSchemaType(doc, propSchema),
      required: reqSet.has(name),
      ...(typeof resolved?.description === "string" ? { description: resolved.description.slice(0, 140) } : {}),
    });
  }
  return fields;
}

function extractOpenApiSurfaces(
  doc: Record<string, unknown>,
  relFile: string,
  pkgRoot: string,
): SurfaceRecord[] {
  const version =
    typeof doc.openapi === "string"
      ? `openapi-${doc.openapi}`
      : typeof doc.swagger === "string"
        ? `swagger-${doc.swagger}`
        : undefined;
  if (!version) return [];

  const pathsObj = doc.paths;
  if (!pathsObj || typeof pathsObj !== "object") return [];

  const surfaces: SurfaceRecord[] = [];
  for (const [routePath, methodsObj] of Object.entries(pathsObj as Record<string, unknown>)) {
    if (!methodsObj || typeof methodsObj !== "object") continue;
    const pathParams = Array.isArray((methodsObj as Record<string, unknown>).parameters)
      ? ((methodsObj as Record<string, unknown>).parameters as unknown[])
      : [];

    for (const [method, opObj] of Object.entries(methodsObj as Record<string, unknown>)) {
      const m = method.toLowerCase();
      if (!HTTP_METHODS.has(m)) continue;
      const op = (opObj && typeof opObj === "object" ? opObj : {}) as Record<string, unknown>;
      const upper = m.toUpperCase();

      // Parameters (path, query, header)
      const rawParams = [...pathParams, ...(Array.isArray(op.parameters) ? (op.parameters as unknown[]) : [])];
      const parameters = rawParams
        .map((p) => resolveRef(doc, p))
        .filter((p): p is Record<string, unknown> => Boolean(p && typeof p.name === "string"))
        .map((p) => ({
          name: String(p.name),
          in: String(p.in ?? "query"),
          required: Boolean(p.required || p.in === "path"),
          type: describeSchemaType(doc, p.schema),
          ...(typeof p.description === "string" ? { description: p.description.slice(0, 140) } : {}),
        }));

      // Request body
      let requestBody: { content_type: string; required: boolean; fields: ExtractedField[] } | undefined;
      const rb = resolveRef(doc, op.requestBody);
      if (rb && rb.content && typeof rb.content === "object") {
        const contentEntries = Object.entries(rb.content as Record<string, unknown>);
        const jsonEntry =
          contentEntries.find(([ct]) => ct.includes("json")) ?? contentEntries[0];
        if (jsonEntry) {
          const [ct, mediaObj] = jsonEntry;
          const schema = mediaObj && typeof mediaObj === "object" ? (mediaObj as Record<string, unknown>).schema : undefined;
          requestBody = {
            content_type: ct,
            required: Boolean(rb.required),
            fields: extractSchemaFields(doc, schema),
          };
        }
      }

      // Responses
      const responses: Array<{ status: string; description: string; content_type?: string; fields?: ExtractedField[] }> = [];
      if (op.responses && typeof op.responses === "object") {
        for (const [status, respRaw] of Object.entries(op.responses as Record<string, unknown>).slice(0, 8)) {
          const resp = resolveRef(doc, respRaw);
          if (!resp) continue;
          let ct: string | undefined;
          let fields: ExtractedField[] | undefined;
          if (resp.content && typeof resp.content === "object") {
            const entries = Object.entries(resp.content as Record<string, unknown>);
            const jsonEntry = entries.find(([k]) => k.includes("json")) ?? entries[0];
            if (jsonEntry) {
              ct = jsonEntry[0];
              const schema =
                jsonEntry[1] && typeof jsonEntry[1] === "object"
                  ? (jsonEntry[1] as Record<string, unknown>).schema
                  : undefined;
              const extracted = extractSchemaFields(doc, schema);
              if (extracted.length > 0) fields = extracted;
            }
          }
          responses.push({
            status,
            description: typeof resp.description === "string" ? resp.description.slice(0, 140) : "",
            ...(ct ? { content_type: ct } : {}),
            ...(fields ? { fields } : {}),
          });
        }
      }

      const tags = Array.isArray(op.tags) ? op.tags.map(String) : undefined;
      const security = Array.isArray(op.security)
        ? op.security.flatMap((s) => (s && typeof s === "object" ? Object.keys(s as Record<string, unknown>) : []))
        : undefined;

      surfaces.push({
        surface_id: `route:${upper}:${routePath}`,
        kind: "route",
        facet: "interfaces",
        package_root: pkgRoot,
        denominator: "declarative_spec",
        extractor: version,
        file: relFile,
        details: {
          method: upper,
          path: routePath,
          ...(typeof op.operationId === "string" ? { operation_id: op.operationId } : {}),
          ...(typeof op.summary === "string" ? { summary: op.summary } : {}),
          ...(typeof op.description === "string" ? { description: op.description.slice(0, 300) } : {}),
          ...(tags && tags.length > 0 ? { tags } : {}),
          ...(security && security.length > 0 ? { security } : {}),
          ...(parameters.length > 0 ? { parameters } : {}),
          ...(requestBody ? { request_body: requestBody } : {}),
          ...(responses.length > 0 ? { responses } : {}),
        },
      });
    }
  }
  return surfaces;
}

function extractAsyncApiSurfaces(
  doc: Record<string, unknown>,
  relFile: string,
  pkgRoot: string,
): SurfaceRecord[] {
  if (typeof doc.asyncapi !== "string") return [];
  const extractor = `asyncapi-${doc.asyncapi}`;
  const channels = doc.channels;
  if (!channels || typeof channels !== "object") return [];

  const isWs =
    relFile.toLowerCase().includes("ws") ||
    JSON.stringify(doc.servers ?? {}).toLowerCase().includes("ws");

  const surfaces: SurfaceRecord[] = [];
  for (const [channelName, chObj] of Object.entries(channels as Record<string, unknown>)) {
    const ch = (chObj && typeof chObj === "object" ? chObj : {}) as Record<string, unknown>;
    if (isWs) {
      surfaces.push({
        surface_id: `ws:${channelName}`,
        kind: "ws_channel",
        facet: "interfaces",
        package_root: pkgRoot,
        denominator: "declarative_spec",
        extractor,
        file: relFile,
        details: {
          channel: channelName,
          has_publish: Boolean(ch.publish),
          has_subscribe: Boolean(ch.subscribe),
        },
      });
    } else {
      if (ch.publish || (!ch.publish && !ch.subscribe)) {
        surfaces.push({
          surface_id: `topic:${channelName}`,
          kind: "topic",
          facet: "messages_published",
          package_root: pkgRoot,
          denominator: "declarative_spec",
          extractor,
          file: relFile,
          details: { channel: channelName },
        });
      }
      if (ch.subscribe) {
        surfaces.push({
          surface_id: `subscription:${channelName}`,
          kind: "subscription",
          facet: "messages_consumed",
          package_root: pkgRoot,
          denominator: "declarative_spec",
          extractor,
          file: relFile,
          details: { channel: channelName },
        });
      }
    }
  }
  return surfaces;
}

function extractSqlTableSurfaces(
  absFile: string,
  relFile: string,
  pkgRoot: string,
): SurfaceRecord[] {
  let content: string;
  try {
    content = fs.readFileSync(absFile, "utf8");
  } catch {
    return [];
  }

  const lines = content.split("\n");
  const surfaces: SurfaceRecord[] = [];
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`]?[a-zA-Z0-9_]+["`]?\.)?["`]?([a-zA-Z0-9_]+)["`]?/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const match = line.match(createTableRegex);
    if (!match) continue;
    const tableName = match[1]!;

    // Find end of CREATE TABLE statement
    let endLine = i;
    while (endLine < lines.length && !lines[endLine]!.includes(";")) {
      endLine++;
    }
    const block = lines.slice(i, Math.min(endLine + 1, lines.length)).join("\n");
    const colLines = block
      .split("\n")
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("--") && !l.startsWith(")") && !/^(PRIMARY|FOREIGN|UNIQUE|CONSTRAINT|CHECK|INDEX|KEY)\b/i.test(l));

    const columnDefs: Array<{
      name: string;
      type: string;
      required: boolean;
      primary_key?: boolean;
      references?: string;
      notes?: string;
    }> = [];

    for (const rawLine of colLines) {
      const commentIdx = rawLine.indexOf("--");
      const comment = commentIdx >= 0 ? rawLine.slice(commentIdx + 2).trim() : undefined;
      const code = (commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine).replace(/,\s*$/, "").trim();
      if (!code || code.startsWith(")")) continue;

      const nameMatch = code.match(/^["`]?([a-zA-Z0-9_]+)["`]?\s+(.+)$/);
      if (!nameMatch) continue;
      const colName = nameMatch[1]!;
      const rest = nameMatch[2]!.trim();

      // Match SQL type before constraints (NOT NULL, PRIMARY KEY, DEFAULT, REFERENCES, UNIQUE, CHECK, GENERATED, NULL)
      const typeMatch = rest.match(
        /^((?:double\s+precision|character\s+varying(?:\s*\([^)]+\))?|timestamp(?:\s*\([^)]+\))?\s+(?:with|without)\s+time\s+zone|time(?:\s*\([^)]+\))?\s+(?:with|without)\s+time\s+zone|[a-zA-Z0-9_."]+(?:\s*\([^)]+\))?(?:\[\])*))/i,
      );
      const colType = typeMatch ? typeMatch[1]!.replace(/\s+/g, " ") : "sql";
      const isPk = /\bPRIMARY\s+KEY\b/i.test(rest);
      const isNotNull = isPk || /\bNOT\s+NULL\b/i.test(rest);
      const refMatch = rest.match(/\bREFERENCES\s+([a-zA-Z0-9_."]+(?:\s*\([^)]+\))?)/i);
      const notesParts: string[] = [];
      if (isPk) notesParts.push("PRIMARY KEY");
      if (/\bUNIQUE\b/i.test(rest)) notesParts.push("UNIQUE");
      if (refMatch) notesParts.push(`FK → ${refMatch[1]!.replace(/\s+/g, "")}`);
      if (comment) notesParts.push(comment);

      columnDefs.push({
        name: colName,
        type: colType,
        required: isNotNull,
        ...(isPk ? { primary_key: true } : {}),
        ...(refMatch ? { references: refMatch[1]!.replace(/\s+/g, "") } : {}),
        ...(notesParts.length > 0 ? { notes: notesParts.join(" · ") } : {}),
      });
    }

    const columns = columnDefs.map((c) => c.name);

    surfaces.push({
      surface_id: `table:${tableName}`,
      kind: "table",
      facet: "stores",
      package_root: pkgRoot,
      denominator: "declarative_spec",
      extractor: "sql-ddl",
      file: relFile,
      lines: [i + 1, Math.min(endLine + 1, lines.length)],
      symbol: tableName,
      details: { table: tableName, columns, column_defs: columnDefs },
    });
  }

  return surfaces;
}

export function extractDeclarativeSurfaces(
  repoDir: string,
  allFiles: readonly string[],
  packageRoots: readonly PackageRoot[],
): SurfaceRecord[] {
  const surfaces: SurfaceRecord[] = [];
  const seenSpecHashes = new Set<string>();

  // 1. Emit workspace-internal module dependency surfaces from Cargo.toml (declarative!)
  for (const pkg of packageRoots) {
    if (pkg.language === "rust" && pkg.workspace_dependencies) {
      for (const dep of pkg.workspace_dependencies) {
        surfaces.push({
          surface_id: `module_dep:${pkg.name}->${dep}`,
          kind: "module_dep",
          facet: "outbound_calls",
          package_root: pkg.path,
          ...(pkg.repo_name ? { repo_name: pkg.repo_name } : {}),
          denominator: "declarative_spec",
          extractor: "cargo-toml",
          file: pkg.manifest,
          details: { from: pkg.name, to: dep },
        });
      }
    }
  }

  // Prefer canonical specs/ files before generated docs copies when deduplicating by SHA-256
  const sortedFiles = [...allFiles].sort((a, b) => {
    const aIsDocs = a.includes("docs/") ? 1 : 0;
    const bIsDocs = b.includes("docs/") ? 1 : 0;
    return aIsDocs - bIsDocs || a.localeCompare(b);
  });

  for (const absFile of sortedFiles) {
    const relFile = path.relative(repoDir, absFile);
    const ext = path.extname(absFile).toLowerCase();
    const base = path.basename(absFile).toLowerCase();
    const pkgRoot = resolvePackageRoot(relFile, packageRoots);

    if (ext === ".sql") {
      surfaces.push(...extractSqlTableSurfaces(absFile, relFile, pkgRoot));
      continue;
    }

    if (
      (ext === ".json" || ext === ".yaml" || ext === ".yml") &&
      (base.includes("openapi") || base.includes("swagger") || base.includes("asyncapi"))
    ) {
      const rawBytes = fs.readFileSync(absFile);
      const hash = crypto.createHash("sha256").update(rawBytes).digest("hex");
      if (seenSpecHashes.has(hash)) continue; // Deduplicate identical generated doc copies!
      seenSpecHashes.add(hash);

      const doc = parseStructuredDoc(absFile);
      if (!doc) continue;
      surfaces.push(...extractOpenApiSurfaces(doc, relFile, pkgRoot));
      surfaces.push(...extractAsyncApiSurfaces(doc, relFile, pkgRoot));
    }
  }

  return surfaces;
}
