import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyPlan, buildIndex, IncrementalFileCache, loadSpace } from "../src/index.js";

function generate100SystemFixture(rootDir: string): void {
  fs.writeFileSync(
    path.join(rootDir, "workspace.yaml"),
    `schema_version: 1\nid: workspace:bench-100\nname: Benchmark 100 Systems\nrepos: {}\n`,
  );

  for (let i = 0; i < 100; i++) {
    const sysSlug = `sys-${String(i).padStart(3, "0")}`;
    const compSlug = `svc-${String(i).padStart(3, "0")}`;
    const nextComp = `svc-${String((i + 1) % 100).padStart(3, "0")}`;
    const sysDir = path.join(rootDir, "systems", sysSlug);
    const compDir = path.join(sysDir, "components", compSlug);
    fs.mkdirSync(compDir, { recursive: true });
    fs.mkdirSync(path.join(sysDir, "stores"), { recursive: true });

    fs.writeFileSync(
      path.join(sysDir, "system.yaml"),
      `id: ${sysSlug}\nname: System ${i}\npurpose: Benchmark system ${i}\nmapped: true\n`,
    );
    fs.writeFileSync(
      path.join(compDir, "component.yaml"),
      `id: ${compSlug}\nname: Service ${i}\nkind: service\ndepth: full\n`,
    );
    fs.writeFileSync(
      path.join(compDir, "contracts.yaml"),
      `interfaces:\n  - id: rest-v1\n    kind: rest\n    known_from: implementation\n    entries:\n      - id: run\n        method: POST\n        path: /run\n        response: none\n`,
    );
    fs.writeFileSync(
      path.join(compDir, "handlers.yaml"),
      `handlers:\n  - id: run\n    on: endpoint:${compSlug}/run\n    summary: Handle run\n    steps:\n      - id: store-write\n        write: schema:${sysSlug}-db/row\n        to: store:${sysSlug}-db\n      - id: next-call\n        call: endpoint:${nextComp}/run\n`,
    );
    fs.writeFileSync(
      path.join(sysDir, "stores", `${sysSlug}-db.yaml`),
      `id: ${sysSlug}-db\nname: DB ${i}\nform: database\nowner: service:${compSlug}\nrecords:\n  - id: row\n    kind: record\n    table: rows\n    fields:\n      - { id: id, name: id, type: uuid, required: true }\n`,
    );
  }

  // Add one plan touching sys-000 only
  const planDir = path.join(rootDir, "plans", "bench-plan");
  fs.mkdirSync(path.join(planDir, "architecture"), { recursive: true });
  fs.mkdirSync(path.join(planDir, "execution"), { recursive: true });
  fs.mkdirSync(path.join(planDir, "proof"), { recursive: true });
  fs.writeFileSync(
    path.join(planDir, "plan.yaml"),
    `schema_version: 1\nid: plan:bench-plan\ntitle: Bench\nstatus: draft\nproblem: { summary: Bench }\npillars:\n  architecture: { file: ./architecture/changes.yaml }\n  design: { applicable: false, reason: Backend only }\n  execution: { file: ./execution/execution.yaml }\n  proof: { file: ./proof/proof.yaml }\n`,
  );
  fs.writeFileSync(
    path.join(planDir, "architecture", "changes.yaml"),
    `schema_version: 1\nchanges:\n  - id: change:bench-plan/add-step\n    title: Add step\n    ops:\n      - insert_step:\n          into: handler:svc-000/run\n          after: store-write\n          value: { id: extra-step, wait: 1s }\n`,
  );
  fs.writeFileSync(path.join(planDir, "execution", "execution.yaml"), `schema_version: 1\nmilestones: []\nwork_items: []\n`);
  fs.writeFileSync(path.join(planDir, "proof", "proof.yaml"), `schema_version: 1\ntests: []\n`);
}

describe("100-system performance benchmark", () => {
  it("loads, caches, indexes, and copy-on-write applies plans on 100 systems within budget", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gw-bench-100-"));
    try {
      generate100SystemFixture(tmp);
      const cache = new IncrementalFileCache();

      const t0 = performance.now();
      const space = loadSpace(tmp, cache);
      const coldLoadMs = performance.now() - t0;

      expect(space.problems).toEqual([]);
      expect(space.systems).toHaveLength(100);

      const t1 = performance.now();
      loadSpace(tmp, cache);
      const warmLoadMs = performance.now() - t1;

      const t2 = performance.now();
      const idx = buildIndex(space);
      const indexMs = performance.now() - t2;

      const t3 = performance.now();
      const applied = applyPlan(space, "plan:bench-plan");
      const applyMs = performance.now() - t3;

      expect(idx.edges.length).toBe(200);
      expect(applied.errors).toEqual([]);
      // 99 of 100 systems share exact object identity (copy-on-write!)
      let sharedRefs = 0;
      for (let i = 0; i < 100; i++) {
        if (applied.before.systems[i] === applied.after.systems[i]) sharedRefs++;
      }
      expect(sharedRefs).toBe(99);

      // Performance budgets
      expect(coldLoadMs).toBeLessThan(2000);
      expect(warmLoadMs).toBeLessThan(200);
      expect(indexMs).toBeLessThan(200);
      expect(applyMs).toBeLessThan(50);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
