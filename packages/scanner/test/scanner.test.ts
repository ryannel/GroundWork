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
});
