import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyPlan,
  buildIndex,
  checkPlanDrift,
  computeBaseLock,
  computeCompleteness,
  discoverWorkspaces,
  evaluatePlanGates,
  IncrementalFileCache,
  loadSpace,
  matchesTriagePattern,
  moveId,
  reconcilePlanAgainstSpace,
  resolveSpaceDir,
} from "../src/index.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

describe("packages/core", () => {
  it("discovers acme-org (single-space) and personal (multi-project with wordloop-platform & thrum)", () => {
    const workspaces = discoverWorkspaces(REPO_ROOT);
    const ids = workspaces.map((w) => w.id);
    expect(ids).toContain("workspace:acme-org");
    expect(ids).toContain("workspace:personal");

    const personal = workspaces.find((w) => w.id === "workspace:personal")!;
    expect(personal.mode).toBe("multi-project");
    expect(personal.projects).toEqual(["project:wordloop-platform", "project:thrum"]);

    const wlDir = resolveSpaceDir(personal, "project:wordloop-platform");
    const thrumDir = resolveSpaceDir(personal, "project:thrum");
    const wlSpace = loadSpace(wlDir);
    const thrumSpace = loadSpace(thrumDir);

    expect(wlSpace.problems).toEqual([]);
    expect(thrumSpace.problems).toEqual([]);
    // WordLoop tracks nested git submodules as distinct repos
    expect(wlSpace.config.repos?.["wordloop-core"]).toBeDefined();
    expect(wlSpace.config.repos?.["wordloop-ml"]).toBeDefined();
    // Thrum maps Rust crates as module-boundary components with real depends edges
    const thrumIdx = buildIndex(thrumSpace);
    expect(thrumIdx.edges.some((e) => e.kind === "depends")).toBe(true);
    expect(thrumIdx.get("module:thrum-render")).toBeDefined();
  });

  it("loads acme-org cleanly, derives edges & explicit gaps, and applies surgical plan ops copy-on-write", () => {
    const acmeDir = path.join(REPO_ROOT, "examples/acme-org");
    const cache = new IncrementalFileCache();
    const space = loadSpace(acmeDir, cache);
    expect(space.problems).toEqual([]);

    const idx = buildIndex(space);
    expect(idx.get("service:orders-api")).toBeDefined();
    expect(idx.get("endpoint:orders-api/create-order")).toBeDefined();
    expect(idx.get("procedure:orders-api/validate-cart")).toBeDefined();
    expect(idx.get("endpoint:stripe/create-payment-intent")).toBeDefined();
    expect(idx.get("endpoint:inventory/reserve-stock")).toBeDefined();

    // Derived edges include call to stub system:inventory, external:stripe, write to store:orders-db, publish to topic:order-events
    const ordersCalls = idx.callsOf("service:orders-api");
    expect(ordersCalls.some((e) => e.to === "system:inventory" && e.kind === "call")).toBe(true);
    expect(ordersCalls.some((e) => e.to === "external:stripe" && e.kind === "call")).toBe(true);
    expect(ordersCalls.some((e) => e.to === "store:orders-db" && e.kind === "write")).toBe(true);
    expect(ordersCalls.some((e) => e.to === "topic:order-events" && e.kind === "publish")).toBe(true);

    // Explicit gaps: unmapped system:inventory and unowned store:legacy-analytics-db
    expect(idx.gaps.some((g) => g.kind === "unmapped_system" && g.entity_id === "system:inventory")).toBe(true);
    expect(idx.gaps.some((g) => g.kind === "unowned_resource" && g.entity_id === "store:legacy-analytics-db")).toBe(true);

    // Surgical plan apply (copy-on-write: untouched system:inventory keeps exact object reference!)
    const applied = applyPlan(space, "plan:stock-reservation");
    expect(applied.errors).toEqual([]);
    expect(applied.diff).toHaveLength(3);
    expect(applied.diff.some((d) => d.entity_id === "handler:orders-api/create-order#save-hold-expiry")).toBe(true);

    const beforeInv = applied.before.systems.find((s) => s.id === "system:inventory");
    const afterInv = applied.after.systems.find((s) => s.id === "system:inventory");
    expect(afterInv).toBe(beforeInv); // Copy-on-write proven!

    // Incremental cache hit on second load
    const missesBefore = cache.misses;
    loadSpace(acmeDir, cache);
    expect(cache.misses).toBe(missesBefore);
    expect(cache.hits).toBeGreaterThan(0);
  });

  it("evaluates all 6 maturity gates, 3-tier drift lock, reconciliation, and triage globs", () => {
    const space = loadSpace(path.join(REPO_ROOT, "examples/acme-org"));
    const plan = space.plans.find((p) => p.id === "plan:stock-reservation")!;

    // Passes --gate ready cleanly
    const gateReport = evaluatePlanGates(space, plan, "ready");
    expect(gateReport.passed).toBe(true);
    expect(gateReport.violations).toEqual([]);

    // Fails --gate ready if signoffs are stripped
    const unsignedPlan = { ...plan, manifest: { ...plan.manifest, signoffs: undefined } };
    const unsignedReport = evaluatePlanGates(space, unsignedPlan, "ready");
    expect(unsignedReport.passed).toBe(false);
    expect(unsignedReport.violations.some((v) => v.gate === "human_signoff")).toBe(true);

    // Base lock & 3-tier drift check
    const applied = applyPlan(space, plan.id);
    const lock = computeBaseLock(plan, applied.before);
    expect(Object.keys(lock.targets)).toContain("handler:orders-api/create-order#has-stock");
    expect(Object.keys(lock.relies_on)).toContain("endpoint:inventory/reserve-stock");

    const cleanDrift = checkPlanDrift({ ...plan, base_lock: lock }, applied.before);
    expect(cleanDrift.status).toBe("clean_apply");

    // Mutate a locked hash -> semantic_drift
    const driftedLock = {
      ...lock,
      relies_on: { "endpoint:inventory/reserve-stock": "sha256:0000000000000000" },
    };
    const semDrift = checkPlanDrift({ ...plan, base_lock: driftedLock }, applied.before);
    expect(semDrift.status).toBe("semantic_drift");

    // Reconciliation before code is scanned -> not_found / landed_differently
    const recon = reconcilePlanAgainstSpace(space, plan);
    expect(recon.changes[0]?.status).toBe("landed_differently");

    // Pattern-rule triage matching
    expect(matchesTriagePattern("route:GET:/healthz", "route:GET:/health*")).toBe(true);
    expect(matchesTriagePattern("route:POST:/actuator/env/refresh", "route:*:/actuator/**")).toBe(true);
    expect(matchesTriagePattern("route:POST:/v1/orders", "route:GET:/health*")).toBe(false);

    // Completeness report
    const comp = computeCompleteness(space);
    expect(comp.unclaimed_repos).toEqual([]);
    expect(comp.summary.stub_systems).toBe(1);
  });

  it("atomically rewrites IDs across YAML and HTML prototypes with moveId", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gw-move-id-"));
    try {
      fs.cpSync(path.join(REPO_ROOT, "examples/acme-org"), tmp, { recursive: true });
      const dry = moveId(tmp, "endpoint:orders-api/create-order", "endpoint:orders-api/submit-order", { dryRun: true });
      expect(dry.total_replacements).toBeGreaterThanOrEqual(3);
      expect(dry.files_changed.some((f) => f.file.endsWith("checkout-summary.html"))).toBe(true);

      const live = moveId(tmp, "endpoint:orders-api/create-order", "endpoint:orders-api/submit-order");
      expect(live.total_replacements).toBe(dry.total_replacements);
      const html = fs.readFileSync(
        path.join(tmp, "plans/stock-reservation/design/prototypes/checkout-summary.html"),
        "utf8",
      );
      expect(html).toContain('data-gw-endpoint="endpoint:orders-api/submit-order"');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
