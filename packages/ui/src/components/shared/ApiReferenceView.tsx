import { ArrowUpRight, Check, Copy, ExternalLink, Eye, EyeOff, Lock, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { InterfaceDef, ScannedSurface, SchemaDef } from "../../types";
import type { TriageRuleRef } from "./ContractCatalog";

export interface ApiParamSpec {
  readonly name: string;
  readonly in: string; // path | query | header | cookie
  readonly required?: boolean;
  readonly type: string;
  readonly description?: string;
}

export interface ApiFieldSpec {
  readonly id?: string;
  readonly name: string;
  readonly type: string;
  readonly required?: boolean;
  readonly description?: string;
  readonly diffKind?: "added" | "modified" | "removed";
}

export interface ApiResponseSpec {
  readonly status: string;
  readonly description: string;
  readonly contentType?: string;
  readonly schemaId?: string;
  readonly fields: readonly ApiFieldSpec[];
}

export interface RichEndpointSpec {
  readonly key: string;
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly title: string;
  readonly description?: string;
  readonly group: string;
  readonly auth?: string;
  readonly knownFrom: string;
  readonly docUrl?: string;
  readonly source: "authored" | "scanned";
  readonly triageDisposition?: string;
  readonly parameters: readonly ApiParamSpec[];
  readonly requestBody?: {
    readonly contentType: string;
    readonly required?: boolean;
    readonly schemaId?: string;
    readonly fields: readonly ApiFieldSpec[];
  };
  readonly responses: readonly ApiResponseSpec[];
  readonly hasPlanChange: boolean;
}

function matchesGlob(pattern: string, value: string): boolean {
  const regexStr =
    "^" +
    pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "__GLOBSTAR__")
      .replace(/\*/g, "[^/]*")
      .replace(/__GLOBSTAR__/g, ".*") +
    "$";
  try {
    return new RegExp(regexStr).test(value);
  } catch {
    return pattern === value;
  }
}

function matchTriage(surfaceId: string, routePath: string, rules: readonly TriageRuleRef[]): string | undefined {
  for (const r of rules) {
    if (matchesGlob(r.surface, surfaceId) || matchesGlob(r.surface, routePath)) return r.disposition;
  }
  return undefined;
}

function extractGroup(routePath: string, tags?: readonly string[]): string {
  if (tags && tags.length > 0 && tags[0]) return tags[0];
  const clean = routePath.replace(/^\/v\d+\//, "/").replace(/^\//, "");
  const first = clean.split("/")[0] || "root";
  return `/${first}`;
}

function extractPathParams(routePath: string): ApiParamSpec[] {
  const out: ApiParamSpec[] = [];
  const regex = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(routePath)) !== null) {
    out.push({ name: m[1]!, in: "path", required: true, type: "string" });
  }
  return out;
}

function schemaToApiFields(
  schema: SchemaDef | undefined,
  diffByEntity?: ReadonlyMap<string, "added" | "modified" | "removed">,
): ApiFieldSpec[] {
  if (!schema) return [];
  return schema.fields.map((f) => ({
    id: f.id,
    name: f.name,
    type: typeof f.type === "string" ? f.type : JSON.stringify(f.type),
    required: f.required,
    diffKind: diffByEntity?.get(`${schema.id}#${f.id}`),
  }));
}

function cleanOpenApiFields(arr?: readonly ApiFieldSpec[]): ApiFieldSpec[] {
  return (arr ?? []).filter((f) => f.name !== "$schema");
}

function parseScannedRoute(s: ScannedSurface, triageRules: readonly TriageRuleRef[]) {
  const method = s.kind === "ws_channel" ? "WS" : String(s.details?.method ?? "ANY").toUpperCase();
  const routePath = String(s.details?.path ?? s.details?.channel ?? s.surface_id);
  const d = (s.details ?? {}) as Record<string, unknown>;
  const disposition = matchTriage(s.surface_id, routePath, triageRules);
  const tags = Array.isArray(d.tags) ? d.tags.map(String) : undefined;
  const security = Array.isArray(d.security) ? d.security.map(String) : undefined;

  const rawParams = Array.isArray(d.parameters) ? (d.parameters as ApiParamSpec[]) : [];
  const params: ApiParamSpec[] = rawParams.length > 0 ? [...rawParams] : extractPathParams(routePath);
  if (security && security.length > 0 && !params.some((p) => p.name.toLowerCase() === "authorization")) {
    params.push({
      name: "Authorization",
      in: "header",
      required: true,
      type: "string",
      description: `Security scheme: ${security.join(", ")}`,
    });
  }

  const rawRb = d.request_body as { content_type?: string; required?: boolean; fields?: ApiFieldSpec[] } | undefined;
  const requestBody = rawRb
    ? {
        contentType: rawRb.content_type ?? "application/json",
        required: rawRb.required,
        fields: cleanOpenApiFields(rawRb.fields),
      }
    : undefined;

  const rawResponses = Array.isArray(d.responses)
    ? (d.responses as Array<{ status: string; description: string; content_type?: string; fields?: ApiFieldSpec[] }>)
    : [];

  const responses: ApiResponseSpec[] =
    rawResponses.length > 0
      ? rawResponses.map((r) => ({
          status: r.status,
          description: r.description || (r.status === "default" ? "Error" : "Response"),
          contentType: r.content_type,
          fields: cleanOpenApiFields(r.fields),
        }))
      : [{ status: method === "POST" ? "201" : "200", description: "Success", contentType: "application/json", fields: [] }];

  return {
    method,
    routePath,
    disposition,
    tags,
    security,
    params,
    requestBody,
    responses,
    hasRichResponses: rawResponses.length > 0,
    summary: typeof d.summary === "string" && d.summary ? d.summary : undefined,
    description: typeof d.description === "string" ? d.description : typeof d.summary === "string" ? d.summary : undefined,
  };
}

export function buildRichEndpoints(
  interfaces: readonly InterfaceDef[],
  schemas: readonly SchemaDef[] = [],
  scannedRoutes: readonly ScannedSurface[] = [],
  triageRules: readonly TriageRuleRef[] = [],
  diffByEntity?: ReadonlyMap<string, "added" | "modified" | "removed">,
): RichEndpointSpec[] {
  const schemaMap = new Map(schemas.map((s) => [s.id, s]));
  const list: RichEndpointSpec[] = [];
  const seenMethodPath = new Set<string>();

  // Prefer declarative_spec (e.g. OpenAPI) before source_heuristic when deduplicating or enriching authored stubs
  const orderedScanned = [...scannedRoutes]
    .filter((s) => s.kind === "route" || s.kind === "ws_channel")
    .sort((a, b) => {
      const aSpec = a.denominator === "declarative_spec" ? 0 : 1;
      const bSpec = b.denominator === "declarative_spec" ? 0 : 1;
      return aSpec - bSpec;
    });

  const scannedByMethodPath = new Map<string, ScannedSurface>();
  for (const s of orderedScanned) {
    const method = s.kind === "ws_channel" ? "WS" : String(s.details?.method ?? "ANY").toUpperCase();
    const routePath = String(s.details?.path ?? s.details?.channel ?? s.surface_id);
    const key = `${method} ${routePath}`;
    if (!scannedByMethodPath.has(key)) scannedByMethodPath.set(key, s);
  }

  for (const iface of interfaces) {
    for (const ep of iface.entries) {
      const method = (ep.method ?? (iface.kind === "websocket" ? "WS" : "RPC")).toUpperCase();
      const fullPath = `${iface.base_path ?? ""}${ep.path ?? ""}` || ep.id;
      const dedupeKey = `${method} ${fullPath}`;
      seenMethodPath.add(dedupeKey);

      const scannedMatch = scannedByMethodPath.get(dedupeKey);
      const scannedParsed = scannedMatch ? parseScannedRoute(scannedMatch, triageRules) : undefined;

      let docUrl: string | undefined;
      for (const c of ep.cites ?? []) {
        if (c && typeof c === "object" && "doc" in c && typeof (c as { doc?: unknown }).doc === "string") {
          docUrl = (c as { doc: string }).doc;
        }
      }

      const reqSchema = ep.request && ep.request !== "none" ? schemaMap.get(ep.request) : undefined;
      const resSchema = ep.response && ep.response !== "none" ? schemaMap.get(ep.response) : undefined;
      const reqFields = schemaToApiFields(reqSchema, diffByEntity);
      const resFields = schemaToApiFields(resSchema, diffByEntity);

      const authLabel = ep.auth ?? iface.auth ?? scannedParsed?.security?.join(", ");
      const params: ApiParamSpec[] = [...extractPathParams(fullPath)];
      if (authLabel && authLabel !== "none") {
        params.push({
          name: "Authorization",
          in: "header",
          required: true,
          type: "string",
          description: `Bearer token (${authLabel})`,
        });
      }
      if (scannedParsed) {
        const existingParamKeys = new Set(params.map((p) => `${p.in}:${p.name.toLowerCase()}`));
        for (const sp of scannedParsed.params) {
          const pk = `${sp.in}:${sp.name.toLowerCase()}`;
          if (!existingParamKeys.has(pk)) {
            existingParamKeys.add(pk);
            params.push(sp);
          }
        }
      }

      const successStatus = method === "POST" ? "201" : method === "DELETE" ? "204" : "200";
      const authoredResponses: ApiResponseSpec[] = [
        {
          status: successStatus,
          description: successStatus === "201" ? "Created" : successStatus === "204" ? "No Content" : "OK",
          contentType: "application/json",
          schemaId: resSchema?.id ?? (ep.response && ep.response !== "none" ? ep.response : undefined),
          fields: resFields,
        },
        {
          status: "400",
          description: "Validation Error",
          contentType: "application/json",
          fields: [
            { name: "error", type: "string", required: true, description: "Machine-readable error code" },
            { name: "message", type: "string", required: true, description: "Human-readable validation details" },
          ],
        },
      ];
      if (authLabel && authLabel !== "none") {
        authoredResponses.push({
          status: "401",
          description: "Unauthorized",
          contentType: "application/json",
          fields: [{ name: "error", type: "string", required: true, description: "Missing or expired credentials" }],
        });
      }

      // If authored endpoint has no explicit response schema, inherit the rich scanned OpenAPI responses!
      const responses =
        resFields.length > 0 || !scannedParsed?.hasRichResponses
          ? authoredResponses
          : scannedParsed.responses;

      const requestBody =
        reqFields.length > 0
          ? {
              contentType: "application/json",
              required: true,
              schemaId: reqSchema?.id ?? ep.request,
              fields: reqFields,
            }
          : scannedParsed?.requestBody
            ? {
                ...scannedParsed.requestBody,
                schemaId: reqSchema?.id ?? (ep.request && ep.request !== "none" ? ep.request : undefined),
              }
            : reqSchema || (ep.request && ep.request !== "none")
              ? {
                  contentType: "application/json",
                  required: true,
                  schemaId: reqSchema?.id ?? ep.request,
                  fields: reqFields,
                }
              : undefined;

      const hasPlanChange =
        Boolean(diffByEntity?.get(ep.id)) ||
        reqFields.some((f) => Boolean(f.diffKind)) ||
        resFields.some((f) => Boolean(f.diffKind));

      list.push({
        key: ep.id,
        id: ep.id,
        method,
        path: fullPath,
        title: ep.summary ?? scannedParsed?.summary ?? `${method} ${fullPath}`,
        description: ep.summary ?? scannedParsed?.description,
        group: extractGroup(fullPath, scannedParsed?.tags),
        auth: authLabel,
        knownFrom: scannedMatch ? `${iface.known_from} + ${scannedMatch.extractor}` : iface.known_from,
        docUrl,
        source: "authored",
        parameters: params,
        ...(requestBody ? { requestBody } : {}),
        responses,
        hasPlanChange,
      });
    }
  }

  for (const s of orderedScanned) {
    const parsed = parseScannedRoute(s, triageRules);
    const dedupeKey = `${parsed.method} ${parsed.routePath}`;
    if (seenMethodPath.has(dedupeKey)) continue;
    seenMethodPath.add(dedupeKey);

    list.push({
      key: s.surface_id,
      id: s.surface_id,
      method: parsed.method,
      path: parsed.routePath,
      title: parsed.summary ?? `${parsed.method} ${parsed.routePath}`,
      description: parsed.description,
      group: extractGroup(parsed.routePath, parsed.tags),
      auth: parsed.security?.join(", "),
      knownFrom: s.extractor,
      source: "scanned",
      triageDisposition: parsed.disposition,
      parameters: parsed.params,
      requestBody: parsed.requestBody,
      responses: parsed.responses,
      hasPlanChange: false,
    });
  }

  return list.sort((a, b) => {
    const aSlash = a.group.startsWith("/") ? 1 : 0;
    const bSlash = b.group.startsWith("/") ? 1 : 0;
    return aSlash - bSlash || a.group.localeCompare(b.group) || a.path.localeCompare(b.path) || a.method.localeCompare(b.method);
  });
}

export function methodColor(method: string): { bg: string; fg: string; badge: string } {
  switch (method.toUpperCase()) {
    case "GET":
      return { bg: "var(--accent-soft)", fg: "var(--accent)", badge: "indigo" };
    case "POST":
      return { bg: "var(--emerald-soft)", fg: "var(--emerald)", badge: "emerald" };
    case "PUT":
    case "PATCH":
      return { bg: "var(--amber-soft)", fg: "var(--amber)", badge: "amber" };
    case "DELETE":
      return { bg: "var(--rose-soft)", fg: "var(--rose)", badge: "rose" };
    default:
      return { bg: "var(--surface-muted)", fg: "var(--text-muted)", badge: "" };
  }
}

function statusPillColor(status: string): string {
  if (status.startsWith("2")) return "emerald";
  if (status.startsWith("4") || status === "default") return "amber";
  if (status.startsWith("5")) return "rose";
  return "";
}

function sampleValueForField(name: string, type: string): unknown {
  const lowerName = name.toLowerCase();
  const lowerType = type.toLowerCase();
  if (lowerType.includes("bool")) return true;
  if (lowerType.includes("int") || lowerType.includes("number") || lowerType.includes("decimal")) {
    return lowerName.includes("status") ? 400 : 1;
  }
  if (lowerType.endsWith("[]") || lowerType.includes("array")) return [];
  if (lowerType.includes("object") || lowerType.includes("json")) return {};
  if (lowerType.includes("uuid") || lowerName === "id" || lowerName.endsWith("_id") || lowerName.endsWith("id")) {
    return "0195b2a0-7f12-7c00-9b34-1a2b3c4d5e6f";
  }
  if (lowerType.includes("date") || lowerType.includes("time") || lowerName.endsWith("_at") || lowerName.includes("until")) {
    return "2026-11-28T14:30:00Z";
  }
  if (lowerName.includes("email")) return "alex@example.com";
  if (lowerName === "status") return "confirmed";
  return "string";
}

function buildSampleJson(fields: readonly ApiFieldSpec[]): string {
  if (fields.length === 0) return "{}";
  const obj: Record<string, unknown> = {};
  for (const f of fields) {
    obj[f.name] = sampleValueForField(f.name, f.type);
  }
  return JSON.stringify(obj, null, 2);
}

function buildCurlExample(ep: RichEndpointSpec): string {
  const lines: string[] = [`curl -X ${ep.method} "https://api.example.com${ep.path}" \\`];
  for (const p of ep.parameters.filter((x) => x.in === "header")) {
    const val = p.name.toLowerCase() === "authorization" ? "Bearer <TOKEN>" : "<VALUE>";
    lines.push(`  -H "${p.name}: ${val}" \\`);
  }
  if (ep.requestBody) {
    lines.push(`  -H "Content-Type: ${ep.requestBody.contentType}" \\`);
    const sample = buildSampleJson(ep.requestBody.fields);
    lines.push(`  -d '${sample}'`);
  } else {
    lines[lines.length - 1] = lines[lines.length - 1]!.replace(/ \\$/, "");
  }
  return lines.join("\n");
}

function FieldTable({ fields, emptyText }: { fields: readonly ApiFieldSpec[]; emptyText: string }) {
  if (fields.length === 0) {
    return <div style={{ fontSize: 12.5, color: "var(--text-faint)", padding: "12px 14px", lineHeight: 1.45 }}>{emptyText}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {fields.map((f) => (
        <div
          key={f.name}
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid var(--border)",
            background:
              f.diffKind === "added"
                ? "var(--emerald-soft)"
                : f.diffKind === "modified"
                  ? "var(--amber-soft)"
                  : "transparent",
            borderLeft:
              f.diffKind === "added"
                ? "3px solid var(--emerald)"
                : f.diffKind === "modified"
                  ? "3px solid var(--amber)"
                  : "3px solid transparent",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="mono" style={{ fontWeight: 700, fontSize: 12.5, color: "var(--text)" }}>
              {f.name}
            </span>
            <span className="mono" style={{ fontSize: 11.5, color: "var(--accent)", background: "var(--accent-soft)", padding: "1px 6px", borderRadius: 4 }}>
              {f.type}
            </span>
            {f.required && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                required
              </span>
            )}
            {f.diffKind && (
              <span className={`badge ${f.diffKind === "added" ? "emerald" : f.diffKind === "modified" ? "amber" : "rose"}`}>
                {f.diffKind === "added" ? "+ Added in Plan" : f.diffKind}
              </span>
            )}
          </div>
          {f.description && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.45 }}>{f.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Compact single-endpoint specification reused inside InspectorDrawer & QuickPeekDrawer! */
export function EndpointSpecCard({
  endpoint,
  onOpenFullEndpoint,
}: {
  endpoint: RichEndpointSpec;
  onOpenFullEndpoint?: () => void;
}) {
  const mc = methodColor(endpoint.method);
  const [statusIdx, setStatusIdx] = useState(0);
  const activeResp = endpoint.responses[statusIdx] ?? endpoint.responses[0];

  return (
    <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "10px 12px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
            <span className="mono" style={{ fontWeight: 700, fontSize: 11, padding: "2px 7px", borderRadius: 5, background: mc.bg, color: mc.fg, flexShrink: 0 }}>
              {endpoint.method}
            </span>
            <span className="mono" style={{ fontWeight: 700, fontSize: 12.5, wordBreak: "break-all" }}>{endpoint.path}</span>
          </div>
          {onOpenFullEndpoint && (
            <button
              type="button"
              className="entity-link"
              style={{ flexShrink: 0, padding: "2px 7px", fontSize: 11 }}
              onClick={onOpenFullEndpoint}
              title={`Open ${endpoint.method} ${endpoint.path} in full API Reference`}
            >
              Spec <ArrowUpRight size={11} />
            </button>
          )}
        </div>
        {endpoint.description && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 5 }}>{endpoint.description}</div>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {endpoint.auth && (
            <span className="badge"><Lock size={10} /> {endpoint.auth}</span>
          )}
          <span className="badge">{endpoint.knownFrom}</span>
        </div>
      </div>

      {endpoint.parameters.length > 0 && (
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
          <div className="section-title" style={{ marginBottom: 4 }}>Parameters &amp; Headers</div>
          {endpoint.parameters.map((p) => (
            <div key={`${p.in}:${p.name}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "4px 0", fontSize: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="mono" style={{ fontWeight: 600 }}>{p.name}</span>
                <span className="badge" style={{ fontSize: 10 }}>{p.in}</span>
              </div>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.type}</span>
            </div>
          ))}
        </div>
      )}

      {endpoint.requestBody && (
        <div style={{ borderBottom: "1px solid var(--border)" }}>
          <div style={{ padding: "8px 12px 4px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="section-title" style={{ margin: 0 }}>Request Body</span>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{endpoint.requestBody.contentType}</span>
          </div>
          <FieldTable fields={endpoint.requestBody.fields} emptyText="No request fields documented." />
        </div>
      )}

      {endpoint.responses.length > 0 && (
        <div>
          <div style={{ padding: "8px 12px 6px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
            <span className="section-title" style={{ margin: 0 }}>Responses</span>
            <div style={{ display: "flex", gap: 4 }}>
              {endpoint.responses.map((r, i) => (
                <button
                  key={r.status}
                  onClick={() => setStatusIdx(i)}
                  className={`badge ${i === statusIdx ? statusPillColor(r.status) : ""}`}
                  style={{
                    cursor: "pointer",
                    border: i === statusIdx ? "1px solid currentColor" : "1px solid var(--border)",
                  }}
                >
                  {r.status}
                </button>
              ))}
            </div>
          </div>
          {activeResp && (
            <FieldTable
              fields={activeResp.fields}
              emptyText={`${activeResp.status} ${activeResp.description}`}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  interfaces: readonly InterfaceDef[];
  schemas?: readonly SchemaDef[];
  scannedRoutes?: readonly ScannedSurface[];
  triageRules?: readonly TriageRuleRef[];
  diffByEntity?: ReadonlyMap<string, "added" | "modified" | "removed">;
  selectedEndpointKey?: string;
  onSelectEndpoint?: (endpointKey: string) => void;
}

/**
 * Modern 2026 3-Pane API Reference (Scalar / Mintlify / Stripe Docs pattern):
 *  - Left sticky grouped endpoint sidebar with search, method pills, and triage toggle
 *  - Center detailed specification (URL bar, Auth, Parameters/Headers, Request Body, Status-tabbed Responses)
 *  - Right sticky dark code panel (Copyable curl + Request JSON + Response JSON)
 */
export function ApiReferenceView({
  interfaces,
  schemas = [],
  scannedRoutes = [],
  triageRules = [],
  diffByEntity,
  selectedEndpointKey,
  onSelectEndpoint,
}: Props) {
  const [query, setQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [showTriaged, setShowTriaged] = useState(false);
  const [localSelectedKey, setLocalSelectedKey] = useState<string | undefined>(selectedEndpointKey);
  const [respTab, setRespTab] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (selectedEndpointKey) setLocalSelectedKey(selectedEndpointKey);
  }, [selectedEndpointKey]);

  const endpoints = useMemo(
    () => buildRichEndpoints(interfaces, schemas, scannedRoutes, triageRules, diffByEntity),
    [interfaces, schemas, scannedRoutes, triageRules, diffByEntity],
  );

  // If deep-linked straight to a triaged route (e.g. from Cmd+K or Inspector), auto-reveal triaged routes
  useEffect(() => {
    if (!localSelectedKey) return;
    const match = endpoints.find((e) => e.key === localSelectedKey || e.id === localSelectedKey);
    if (match?.triageDisposition) setShowTriaged(true);
  }, [localSelectedKey, endpoints]);

  const triagedCount = useMemo(() => endpoints.filter((e) => Boolean(e.triageDisposition)).length, [endpoints]);
  const businessCount = endpoints.length - triagedCount;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return endpoints.filter((e) => {
      if (!showTriaged && businessCount > 0 && e.triageDisposition) return false;
      if (methodFilter !== "ALL" && e.method !== methodFilter) return false;
      if (!q) return true;
      return (
        e.path.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.group.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q)
      );
    });
  }, [endpoints, query, methodFilter, showTriaged, businessCount]);

  const grouped = useMemo(() => {
    const map = new Map<string, RichEndpointSpec[]>();
    for (const ep of filtered) {
      const arr = map.get(ep.group) ?? [];
      arr.push(ep);
      map.set(ep.group, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  const activeEndpoint =
    filtered.find((e) => e.key === localSelectedKey || e.id === localSelectedKey) ??
    filtered[0] ??
    endpoints[0];

  useEffect(() => {
    setRespTab(0);
    // Scroll ONLY the left endpoint rail so we never shift the outer page or clip the top bar!
    const rail = railRef.current;
    const item = activeItemRef.current;
    if (rail && item) {
      const railRect = rail.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      if (itemRect.top < railRect.top + 8 || itemRect.bottom > railRect.bottom - 8) {
        const delta = itemRect.top - railRect.top - railRect.height / 2 + itemRect.height / 2;
        rail.scrollTop = Math.max(0, rail.scrollTop + delta);
      }
    }
  }, [activeEndpoint?.key]);

  if (endpoints.length === 0) {
    return (
      <div className="section-card" style={{ color: "var(--text-faint)", fontSize: 13 }}>
        No API endpoints recorded for this entity.
      </div>
    );
  }

  const copyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const selectEndpoint = (ep: RichEndpointSpec) => {
    setLocalSelectedKey(ep.key);
    onSelectEndpoint?.(ep.key);
  };

  const activeResp = activeEndpoint?.responses[respTab] ?? activeEndpoint?.responses[0];
  const mc = activeEndpoint ? methodColor(activeEndpoint.method) : methodColor("GET");
  const visibleTotal = showTriaged || businessCount === 0 ? endpoints.length : businessCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Top Filter Bar (only shown when > 2 endpoints) */}
      {endpoints.length > 2 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-faint)" }} />
            <input
              className="search-input"
              style={{ width: "100%", paddingLeft: 32 }}
              placeholder={`Filter ${visibleTotal} endpoints by path, tag, or summary…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="pill-group">
            {["ALL", "GET", "POST", "PUT", "PATCH", "DELETE", "WS"].map((m) => (
              <button
                key={m}
                className={`icon-btn ${methodFilter === m ? "active" : ""}`}
                onClick={() => setMethodFilter(m)}
              >
                {m}
              </button>
            ))}
          </div>
          {triagedCount > 0 && businessCount > 0 && (
            <button
              className={`secondary-btn ${showTriaged ? "active" : ""}`}
              style={{ fontSize: 11.5, padding: "6px 10px" }}
              onClick={() => setShowTriaged((v) => !v)}
            >
              {showTriaged ? <EyeOff size={13} /> : <Eye size={13} />}
              {showTriaged ? `Hide triaged (${triagedCount})` : `Show triaged (${triagedCount})`}
            </button>
          )}
        </div>
      )}

      {/* 3-Pane Modern API Reference Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: endpoints.length > 1 ? "256px minmax(0, 1fr) 360px" : "minmax(0, 1fr) 380px",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Pane 1: Left Sticky Endpoint Navigation Rail */}
        {endpoints.length > 1 && (
          <div
            ref={railRef}
            className="section-card"
            style={{
              padding: 10,
              maxHeight: "calc(100vh - 280px)",
              overflowY: "auto",
              position: "sticky",
              top: 12,
            }}
          >
            {grouped.map(([group, items]) => (
              <div key={group} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--text-faint)",
                    padding: "4px 8px",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{group}</span>
                  <span>{items.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {items.map((ep) => {
                    const isSel = activeEndpoint?.key === ep.key;
                    const emc = methodColor(ep.method);
                    return (
                      <button
                        key={ep.key}
                        ref={isSel ? activeItemRef : undefined}
                        onClick={() => selectEndpoint(ep)}
                        style={{
                          textAlign: "left",
                          padding: "7px 8px",
                          borderRadius: 7,
                          border: isSel ? "1px solid var(--accent-border)" : "1px solid transparent",
                          background: isSel ? "var(--accent-soft)" : "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                        }}
                      >
                        <span
                          className="mono"
                          style={{
                            fontSize: 9.5,
                            fontWeight: 800,
                            padding: "1px 5px",
                            borderRadius: 4,
                            minWidth: 40,
                            textAlign: "center",
                            background: emc.bg,
                            color: emc.fg,
                          }}
                        >
                          {ep.method}
                        </span>
                        <span
                          className="mono"
                          style={{
                            fontSize: 11.5,
                            fontWeight: isSel ? 700 : 500,
                            color: isSel ? "var(--accent)" : "var(--text)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            flex: 1,
                          }}
                          title={ep.path}
                        >
                          {ep.path}
                        </span>
                        {ep.hasPlanChange && (
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#059669", flexShrink: 0 }} title="Modified in Plan" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pane 2: Center Endpoint Specification */}
        {activeEndpoint && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <div className="section-card" style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <span className="badge">{activeEndpoint.group}</span>
                {activeEndpoint.auth && (
                  <span className="badge indigo"><Lock size={11} /> {activeEndpoint.auth}</span>
                )}
                <span className="badge">{activeEndpoint.knownFrom}</span>
                {activeEndpoint.triageDisposition && (
                  <span className="badge amber">{activeEndpoint.triageDisposition}</span>
                )}
                {activeEndpoint.docUrl && (
                  <a href={activeEndpoint.docUrl} target="_blank" rel="noreferrer" className="entity-link neutral">
                    External Docs <ExternalLink size={11} />
                  </a>
                )}
              </div>

              <h2 style={{ margin: "0 0 8px 0", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
                {activeEndpoint.title}
              </h2>

              {/* Copyable URL Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  background: "var(--bg)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginBottom: activeEndpoint.description ? 12 : 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span
                    className="mono"
                    style={{
                      fontWeight: 800,
                      fontSize: 11.5,
                      padding: "3px 8px",
                      borderRadius: 5,
                      background: mc.bg,
                      color: mc.fg,
                    }}
                  >
                    {activeEndpoint.method}
                  </span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflowWrap: "anywhere" }}>
                    {activeEndpoint.path}
                  </span>
                </div>
                <button
                  className="icon-btn"
                  onClick={() => copyText("url", `${activeEndpoint.method} ${activeEndpoint.path}`)}
                  title="Copy method & path"
                >
                  {copiedKey === "url" ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                </button>
              </div>

              {activeEndpoint.description && activeEndpoint.description !== activeEndpoint.title && (
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
                  {activeEndpoint.description}
                </p>
              )}
            </div>

            {/* Parameters & Headers */}
            {activeEndpoint.parameters.length > 0 && (
              <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                  <span className="section-title" style={{ margin: 0 }}>
                    Parameters &amp; Headers ({activeEndpoint.parameters.length})
                  </span>
                </div>
                {activeEndpoint.parameters.map((p) => (
                  <div key={`${p.in}:${p.name}`} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="mono" style={{ fontWeight: 700, fontSize: 12.5 }}>{p.name}</span>
                      <span className="badge">{p.in}</span>
                      <span className="mono" style={{ fontSize: 11.5, color: "var(--accent)", background: "var(--accent-soft)", padding: "1px 6px", borderRadius: 4 }}>
                        {p.type}
                      </span>
                      {p.required && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--rose)", textTransform: "uppercase" }}>required</span>
                      )}
                    </div>
                    {p.description && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{p.description}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Request Body */}
            {activeEndpoint.requestBody && (
              <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
                <div
                  style={{
                    padding: "10px 14px",
                    background: "var(--bg)",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="section-title" style={{ margin: 0 }}>Request Body</span>
                    {activeEndpoint.requestBody.required && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#be123c", textTransform: "uppercase" }}>required</span>
                    )}
                  </div>
                  <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                    {activeEndpoint.requestBody.contentType}
                  </span>
                </div>
                <FieldTable fields={activeEndpoint.requestBody.fields} emptyText="JSON payload (no top-level properties documented)." />
              </div>
            )}

            {/* Responses (Status-Code Tabs) */}
            <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
              <div
                style={{
                  padding: "10px 14px",
                  background: "var(--bg)",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <span className="section-title" style={{ margin: 0 }}>Responses</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {activeEndpoint.responses.map((r, idx) => (
                    <button
                      key={`${r.status}-${idx}`}
                      onClick={() => setRespTab(idx)}
                      className={`badge ${idx === respTab ? statusPillColor(r.status) : ""}`}
                      style={{
                        cursor: "pointer",
                        border: idx === respTab ? "1.5px solid currentColor" : "1px solid var(--border)",
                        padding: "3px 9px",
                      }}
                    >
                      {r.status} · {r.description}
                    </button>
                  ))}
                </div>
              </div>
              {activeResp && (
                <>
                  {activeResp.contentType && (
                    <div style={{ padding: "6px 14px", fontSize: 11, color: "var(--text-faint)", borderBottom: "1px solid var(--border)" }} className="mono">
                      Content-Type: {activeResp.contentType}
                      {activeResp.schemaId ? ` · ${activeResp.schemaId}` : ""}
                    </div>
                  )}
                  <FieldTable
                    fields={activeResp.fields}
                    emptyText={`Returns HTTP ${activeResp.status} (${activeResp.description}) with no body fields documented.`}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Pane 3: Right Sticky Dark Code & Payload Examples (Stripe / Scalar signature!) */}
        {activeEndpoint && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 12 }}>
            {/* cURL Request */}
            <div style={{ background: "#0f172a", color: "#e2e8f0", borderRadius: 10, overflow: "hidden", border: "1px solid #1e293b" }}>
              <div
                style={{
                  padding: "8px 12px",
                  background: "#1e293b",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#94a3b8",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                <span>cURL Request</span>
                <button
                  onClick={() => copyText("curl", buildCurlExample(activeEndpoint))}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#cbd5e1",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                  }}
                >
                  {copiedKey === "curl" ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                  {copiedKey === "curl" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="mono" style={{ margin: 0, padding: 12, fontSize: 11.5, lineHeight: 1.55, overflowX: "auto", color: "#e2e8f0" }}>
                {buildCurlExample(activeEndpoint)}
              </pre>
            </div>

            {/* Sample JSON Response */}
            {activeResp && (
              <div style={{ background: "#0f172a", color: "#e2e8f0", borderRadius: 10, overflow: "hidden", border: "1px solid #1e293b" }}>
                <div
                  style={{
                    padding: "8px 12px",
                    background: "#1e293b",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#94a3b8",
                  }}
                >
                  <span>
                    RESPONSE EXAMPLE ·{" "}
                    <span style={{ color: activeResp.status.startsWith("2") ? "#34d399" : "#fbbf24" }}>
                      {activeResp.status} {activeResp.description}
                    </span>
                  </span>
                  <button
                    onClick={() => copyText("resp", buildSampleJson(activeResp.fields))}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#cbd5e1",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                    }}
                  >
                    {copiedKey === "resp" ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                    {copiedKey === "resp" ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="mono" style={{ margin: 0, padding: 12, fontSize: 11.5, lineHeight: 1.55, overflowX: "auto", color: "#a5f3fc" }}>
                  {buildSampleJson(activeResp.fields)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
