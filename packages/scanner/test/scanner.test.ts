import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkCiteAnchors, normalizeRouteKey, scanRepository } from "../src/index.js";

describe("packages/scanner", () => {
  it("normalizes path parameters across OpenAPI, Express/Chi, and Flask styles", () => {
    expect(normalizeRouteKey("get", "/v1/orders/{orderId}/")).toBe("GET /v1/orders/{}");
    expect(normalizeRouteKey("GET", "/v1/orders/:id")).toBe("GET /v1/orders/{}");
    expect(normalizeRouteKey("post", "/v1/orders/<int:id>")).toBe("POST /v1/orders/{}");
  });

  it("scans a synthetic polyglot repo, cross-checks OpenAPI vs code, and detects moved/changed cite anchors", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gw-scan-test-"));
    try {
      fs.mkdirSync(path.join(tmp, "services/api"), { recursive: true });
      fs.writeFileSync(
        path.join(tmp, "services/api/go.mod"),
        "module example.com/api\n\ngo 1.24\n\nrequire github.com/go-chi/chi/v5 v5.1.0\n",
      );
      fs.writeFileSync(
        path.join(tmp, "services/api/routes.go"),
        [
          "package main",
          "func register(r Router) {",
          '  r.Get("/v1/orders/{id}", getOrder)',
          '  r.Post("/v1/internal/debug", debugOp)',
          "}",
        ].join("\n"),
      );
      fs.writeFileSync(
        path.join(tmp, "services/api/schema.sql"),
        "CREATE TABLE orders (\n  id uuid PRIMARY KEY,\n  status text NOT NULL\n);\n",
      );
      fs.writeFileSync(
        path.join(tmp, "services/api/openapi.json"),
        JSON.stringify({
          openapi: "3.0.3",
          paths: {
            "/v1/orders/{orderId}": { get: { operationId: "getOrder" } },
            "/v1/orders": { post: { operationId: "createOrder" } },
          },
        }),
      );

      const result = scanRepository(tmp);
      expect(result.repository.package_roots).toHaveLength(1);
      expect(result.repository.package_roots[0]!.language).toBe("go");
      expect(result.repository.package_roots[0]!.capabilities.interfaces).toBe("supported");

      // Cross-check: 1 matched (GET /v1/orders/{}), 1 spec_only (POST /v1/orders), 1 code_only (POST /v1/internal/debug)
      expect(result.inventory.cross_checks).toHaveLength(1);
      const cc = result.inventory.cross_checks[0]!;
      expect(cc.matched).toBe(1);
      expect(cc.spec_only.map((x) => x.normalized_key)).toEqual(["POST /v1/orders"]);
      expect(cc.code_only.map((x) => x.normalized_key)).toEqual(["POST /v1/internal/debug"]);

      // Cite anchor rot detection: insert 2 blank lines at top of routes.go -> moved!
      const routesPath = path.join(tmp, "services/api/routes.go");
      fs.writeFileSync(routesPath, "\n\n" + fs.readFileSync(routesPath, "utf8"));
      const drift = checkCiteAnchors(tmp, result.anchors);
      const routeAnchor = drift.find((d) => d.cite_key.startsWith("services/api/routes.go#L3-3"));
      expect(routeAnchor?.status).toBe("moved");
      expect(routeAnchor?.new_lines).toEqual([5, 5]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("extracts routes and outbound calls across Rust, Go, Java, C#, TypeScript (Orval + dynamic), and Python", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gw-polyglot-"));
    try {
      // 1. Rust (axum + reqwest)
      fs.mkdirSync(path.join(tmp, "rust-svc/src"), { recursive: true });
      fs.writeFileSync(
        path.join(tmp, "rust-svc/Cargo.toml"),
        '[package]\nname = "rust-svc"\nversion = "0.1.0"\n[dependencies]\naxum = "0.7"\nreqwest = "0.12"\n',
      );
      fs.writeFileSync(
        path.join(tmp, "rust-svc/src/main.rs"),
        'fn app() { Router::new().route("/rust/items", get(list)); client.post("https://api/v1/orders").send(); }\n',
      );

      // 2. Java (Spring + Feign)
      fs.mkdirSync(path.join(tmp, "java-svc/src/main/java"), { recursive: true });
      fs.writeFileSync(
        path.join(tmp, "java-svc/pom.xml"),
        "<project><artifactId>java-svc</artifactId><dependencies><dependency><artifactId>spring-boot-starter-web</artifactId></dependency><dependency><artifactId>spring-cloud-starter-openfeign</artifactId></dependency></dependencies></project>",
      );
      fs.writeFileSync(
        path.join(tmp, "java-svc/src/main/java/OrdersController.java"),
        '@RequestMapping("/v1/orders")\nclass OrdersController {\n  @GetMapping("/{id}") String get() { return ""; }\n}\n',
      );
      fs.writeFileSync(
        path.join(tmp, "java-svc/src/main/java/BillingClient.java"),
        '@FeignClient(name="billing")\ninterface BillingClient {\n  @PostMapping("/v1/charges") void charge();\n}\n',
      );

      // 3. C# (ASP.NET Core + HttpClient)
      fs.mkdirSync(path.join(tmp, "dotnet-svc"), { recursive: true });
      fs.writeFileSync(
        path.join(tmp, "dotnet-svc/DotnetSvc.csproj"),
        '<Project Sdk="Microsoft.NET.Sdk.Web"><ItemGroup><PackageReference Include="Refit" Version="7.0.0" /></ItemGroup></Project>',
      );
      fs.writeFileSync(
        path.join(tmp, "dotnet-svc/UsersController.cs"),
        '[Route("api/[controller]")]\nclass UsersController {\n  [HttpGet("{id}")] public void Get() { _http.PostAsJsonAsync("/v1/audit", body); }\n}\n',
      );

      // 4. TypeScript (Orval generated client + actual usage + dynamic fetch)
      fs.mkdirSync(path.join(tmp, "web-app/lib/api"), { recursive: true });
      fs.writeFileSync(
        path.join(tmp, "web-app/package.json"),
        JSON.stringify({ name: "web-app", dependencies: { react: "19.0.0", typescript: "5.8.0", orval: "8.5.0" } }),
      );
      fs.writeFileSync(
        path.join(tmp, "web-app/lib/api/generated.ts"),
        [
          "// Generated by orval v8.5.3",
          "export const getListTasksUrl = () => {\n  return `/tasks`\n}",
          "export const listTasks = async () => {\n  return customFetch(getListTasksUrl(), { method: 'GET' });\n}",
          "export const getUnusedOpUrl = () => {\n  return `/unused`\n}",
          "export const unusedOp = async () => {\n  return customFetch(getUnusedOpUrl(), { method: 'DELETE' });\n}",
        ].join("\n"),
      );
      fs.writeFileSync(
        path.join(tmp, "web-app/lib/useTasks.ts"),
        "import { listTasks } from './api/generated';\nexport function load(url: string) { listTasks(); return fetch(url); }\n",
      );

      // 5. Python (FastAPI + httpx)
      fs.mkdirSync(path.join(tmp, "py-svc"), { recursive: true });
      fs.writeFileSync(
        path.join(tmp, "py-svc/pyproject.toml"),
        '[project]\nname = "py-svc"\ndependencies = ["fastapi>=0.115", "httpx>=0.27"]\n',
      );
      fs.writeFileSync(
        path.join(tmp, "py-svc/main.py"),
        '@app.post("/ml/infer")\ndef infer():\n    httpx.post("https://core/v1/callbacks")\n',
      );

      const res = scanRepository(tmp);
      const langs = new Set(res.repository.package_roots.map((p) => p.language));
      expect(langs).toEqual(new Set(["rust", "java", "csharp", "typescript", "python"]));

      const byId = new Map(res.inventory.surfaces.map((s) => [s.surface_id, s]));
      expect(byId.has("route:GET:/rust/items")).toBe(true);
      expect(byId.has("route:GET:/v1/orders/{id}")).toBe(true);
      expect(byId.has("route:GET:/api/users/{id}")).toBe(true);
      expect(byId.has("route:POST:/ml/infer")).toBe(true);

      // Outbound calls across languages
      const outbounds = res.inventory.surfaces.filter((s) => s.kind === "outbound_call");
      expect(outbounds.some((s) => s.extractor === "rust-reqwest" && s.details?.path === "/v1/orders")).toBe(true);
      expect(outbounds.some((s) => s.extractor === "java-feign" && s.details?.path === "/v1/charges")).toBe(true);
      expect(outbounds.some((s) => s.extractor === "csharp-httpclient" && s.details?.path === "/v1/audit")).toBe(true);
      expect(outbounds.some((s) => s.extractor === "python-http-client" && s.details?.path === "/v1/callbacks")).toBe(true);

      // Orval client traces actual usage vs unused + flags dynamic fetch!
      const listTasksOut = outbounds.find((s) => s.extractor === "ts-openapi-client" && s.details?.path === "/tasks");
      const unusedOut = outbounds.find((s) => s.extractor === "ts-openapi-client" && s.details?.path === "/unused");
      const dynOut = outbounds.find((s) => s.extractor === "ts-fetch" && s.details?.dynamic === true);
      expect(listTasksOut?.details?.usage_count).toBe(1);
      expect(unusedOut?.details?.usage_count).toBe(0);
      expect(dynOut).toBeDefined();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
