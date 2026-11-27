import fs from "node:fs";
import path from "node:path";
import type { PlanGate } from "@groundwork/schema";
import { buildIndex } from "./index-builder.js";
import type { LoadedPlan, SpaceModel } from "./model.js";
import { applyPlan, checkPlanDrift } from "./plan-apply.js";

export interface GateViolation {
  readonly gate: string;
  readonly severity: "error" | "warning";
  readonly entity_id?: string;
  readonly message: string;
}

export interface PlanGateReport {
  readonly plan_id: string;
  readonly target_gate: PlanGate;
  readonly passed: boolean;
  readonly violations: readonly GateViolation[];
}

export type ReconcileStatus = "landed_as_planned" | "landed_differently" | "not_found";

export interface ChangeReconciliation {
  readonly change_id: string;
  readonly status: ReconcileStatus;
  readonly details: readonly string[];
}

export interface PlanReconciliationReport {
  readonly plan_id: string;
  readonly changes: readonly ChangeReconciliation[];
}

function detectCycles(nodes: readonly string[], edges: ReadonlyMap<string, readonly string[]>): string[] {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: string[] = [];

  const dfs = (n: string, trail: string[]) => {
    if (visited.has(n)) return;
    if (visiting.has(n)) {
      cycles.push([...trail, n].join(" -> "));
      return;
    }
    visiting.add(n);
    for (const next of edges.get(n) ?? []) {
      dfs(next, [...trail, n]);
    }
    visiting.delete(n);
    visited.add(n);
  };

  for (const n of nodes) dfs(n, []);
  return cycles;
}

export function evaluatePlanGates(
  space: SpaceModel,
  plan: LoadedPlan,
  targetGate: PlanGate = "ready",
): PlanGateReport {
  const violations: GateViolation[] = [];
  const applied = applyPlan(space, plan.id);
  for (const err of applied.errors) {
    violations.push({ gate: "architecture_apply", severity: "error", message: err });
  }

  const afterIndex = buildIndex(applied.after);
  const drift = checkPlanDrift(plan, applied.before);
  if (drift.status === "hard_conflict") {
    for (const item of drift.items.filter((i) => i.status === "hard_conflict")) {
      violations.push({ gate: "drift", severity: "error", entity_id: item.target_id, message: item.detail });
    }
  } else if (drift.status === "semantic_drift") {
    for (const item of drift.items.filter((i) => i.status === "semantic_drift")) {
      violations.push({
        gate: "drift",
        severity: targetGate === "ready" ? "error" : "warning",
        entity_id: item.target_id,
        message: item.detail,
      });
    }
  }

  // Gate 1: Design applicability vs touched screens
  const touchedScreens = new Set<string>();
  for (const d of applied.diff) {
    if (d.entity_id.startsWith("screen:")) touchedScreens.add(d.entity_id);
  }
  for (const addedSys of plan.additions_systems) {
    for (const c of addedSys.components) {
      for (const s of c.screens.screens) touchedScreens.add(s.id);
    }
  }
  if (!plan.manifest.pillars.design.applicable && touchedScreens.size > 0) {
    violations.push({
      gate: "design_pillar",
      severity: "error",
      message: `Design pillar is marked applicable: false, but plan adds/modifies screens: ${[...touchedScreens].join(", ")}`,
    });
  }

  // Gate 2: Design prototype & architecture bindings check
  if (plan.manifest.pillars.design.applicable && plan.design) {
    const coveredScreens = new Set(plan.design.screens.map((s) => s.screen));
    for (const scrId of touchedScreens) {
      if (!coveredScreens.has(scrId)) {
        violations.push({
          gate: "design_binding",
          severity: targetGate === "ready" ? "error" : "warning",
          entity_id: scrId,
          message: `Touched screen ${scrId} has no prototype spec in design/design.yaml`,
        });
      }
    }
    const designDir = path.dirname(path.resolve(plan.dir, plan.manifest.pillars.design.file));
    for (const scrSpec of plan.design.screens) {
      const protoPath = path.resolve(designDir, scrSpec.prototype);
      if (!fs.existsSync(protoPath)) {
        violations.push({
          gate: "design_binding",
          severity: "error",
          entity_id: scrSpec.screen,
          message: `Prototype file does not exist: ${scrSpec.prototype}`,
        });
      }
      const stateIds = new Set(scrSpec.states.map((st) => st.id));
      if (!stateIds.has("default")) {
        violations.push({
          gate: "design_binding",
          severity: targetGate === "ready" ? "error" : "warning",
          entity_id: scrSpec.screen,
          message: `Screen ${scrSpec.screen} prototype is missing a 'default' state`,
        });
      }
      for (const b of scrSpec.bindings ?? []) {
        if (b.calls && !afterIndex.get(b.calls)) {
          violations.push({
            gate: "design_binding",
            severity: "error",
            entity_id: b.calls,
            message: `Design binding calls unknown endpoint in afterModel: ${b.calls}`,
          });
        }
        for (const r of b.reads ?? []) {
          const baseSchema = r.split("#")[0]!;
          if (!afterIndex.get(baseSchema)) {
            violations.push({
              gate: "design_binding",
              severity: "error",
              entity_id: r,
              message: `Design binding reads unknown schema in afterModel: ${r}`,
            });
          }
        }
      }
    }
  }

  // Gate 3: Execution coverage + DAG acyclicity + valid targets
  const changeIds = new Set(plan.changes.changes.map((c) => c.id));
  const implementedChanges = new Set<string>();
  const wiIds = plan.execution.work_items.map((w) => w.id);
  const wiIdSet = new Set(wiIds);
  const wiEdges = new Map<string, string[]>();
  const milestoneIds = new Set(plan.execution.milestones.map((m) => m.id));
  const declaredRepos = new Set(Object.keys(space.config.repos ?? {}));
  const declaredOrgs = new Set((space.config.organisations ?? []).map((o) => o.id));

  for (const wi of plan.execution.work_items) {
    if (!milestoneIds.has(wi.milestone)) {
      violations.push({
        gate: "execution_coverage",
        severity: "error",
        entity_id: wi.id,
        message: `Work item ${wi.id} references unknown milestone ${wi.milestone}`,
      });
    }
    if ((wi.implements?.length ?? 0) === 0) {
      violations.push({
        gate: "execution_coverage",
        severity: targetGate === "ready" ? "error" : "warning",
        entity_id: wi.id,
        message: `Orphan work item ${wi.id} does not implement any change`,
      });
    }
    for (const chgId of wi.implements ?? []) {
      implementedChanges.add(chgId);
      if (!changeIds.has(chgId)) {
        violations.push({
          gate: "execution_coverage",
          severity: "error",
          entity_id: wi.id,
          message: `Work item ${wi.id} implements unknown change ${chgId}`,
        });
      }
    }
    if ("repo" in wi.target && declaredRepos.size > 0 && !declaredRepos.has(wi.target.repo)) {
      violations.push({
        gate: "execution_coverage",
        severity: "error",
        entity_id: wi.id,
        message: `Work item ${wi.id} targets undeclared repo '${wi.target.repo}'`,
      });
    }
    if ("external" in wi.target && declaredOrgs.size > 0 && !declaredOrgs.has(wi.target.external)) {
      violations.push({
        gate: "execution_coverage",
        severity: "warning",
        entity_id: wi.id,
        message: `Work item ${wi.id} targets undeclared external organisation '${wi.target.external}'`,
      });
    }
    const localDeps = (wi.depends_on ?? []).filter((d) => wiIdSet.has(d));
    wiEdges.set(wi.id, localDeps);
  }

  for (const chg of plan.changes.changes) {
    if (!implementedChanges.has(chg.id)) {
      violations.push({
        gate: "execution_coverage",
        severity: targetGate === "ready" ? "error" : "warning",
        entity_id: chg.id,
        message: `Change ${chg.id} is not implemented by any work item`,
      });
    }
  }

  for (const cycle of detectCycles(wiIds, wiEdges)) {
    violations.push({
      gate: "execution_dag",
      severity: "error",
      message: `Circular work_item dependency detected: ${cycle}`,
    });
  }

  // Gate 4: Proof coverage (every change & requirement proven by >=1 test)
  const provenTargets = new Set<string>();
  const testById = new Map(plan.proof.tests.map((t) => [t.id, t]));
  for (const t of plan.proof.tests) {
    for (const target of t.proves) provenTargets.add(target);
  }

  for (const chg of plan.changes.changes) {
    if (!provenTargets.has(chg.id)) {
      violations.push({
        gate: "proof_coverage",
        severity: targetGate === "ready" ? "error" : "warning",
        entity_id: chg.id,
        message: `Change ${chg.id} has no proving test in proof/proof.yaml`,
      });
    }
    for (const req of chg.requires ?? []) {
      if (!provenTargets.has(req.id)) {
        violations.push({
          gate: "proof_coverage",
          severity: targetGate === "ready" ? "error" : "warning",
          entity_id: req.id,
          message: `Requirement ${req.id} has no proving test in proof/proof.yaml`,
        });
      }
    }
  }

  for (const wi of plan.execution.work_items) {
    if ((wi.verified_by?.length ?? 0) === 0 && !wi.verification_none_reason) {
      violations.push({
        gate: "proof_coverage",
        severity: targetGate === "ready" ? "error" : "warning",
        entity_id: wi.id,
        message: `Work item ${wi.id} has no verified_by test (and no verification_none_reason)`,
      });
    }
    for (const tid of wi.verified_by ?? []) {
      if (!testById.has(tid)) {
        violations.push({
          gate: "proof_coverage",
          severity: "error",
          entity_id: wi.id,
          message: `Work item ${wi.id} references unknown test ${tid}`,
        });
      }
    }
  }

  // Gate 5: Open blocking questions at ready gate
  if (targetGate === "ready" || targetGate === "executing") {
    for (const q of plan.manifest.questions ?? []) {
      if (q.status === "open" && (q.blocks?.length ?? 0) > 0) {
        violations.push({
          gate: "open_questions",
          severity: "error",
          entity_id: q.id,
          message: `Open blocking question ${q.id} blocks: ${q.blocks!.join(", ")}`,
        });
      }
    }
  }

  // Gate 6: Named human sign-off per pillar required for ready/executing
  if (targetGate === "ready" || targetGate === "executing") {
    const signoffs = plan.manifest.signoffs ?? {};
    const requiredPillars: Array<keyof NonNullable<typeof plan.manifest.signoffs>> = [
      "architecture",
      "execution",
      "proof",
    ];
    if (plan.manifest.pillars.design.applicable) {
      requiredPillars.push("design");
    }
    for (const pillar of requiredPillars) {
      if (!signoffs[pillar]?.by) {
        violations.push({
          gate: "human_signoff",
          severity: "error",
          message: `Missing named human sign-off for '${pillar}' pillar (required for gate: ${targetGate})`,
        });
      }
    }
  }

  const hasError = violations.some((v) => v.severity === "error");
  return {
    plan_id: plan.id,
    target_gate: targetGate,
    passed: !hasError,
    violations,
  };
}

/**
 * Reconciliation-based landing: compares each planned change against the CURRENT SpaceModel
 * (populated by a fresh scan) rather than blindly overwriting the System Map with uncited ops.
 */
export function reconcilePlanAgainstSpace(
  currentSpace: SpaceModel,
  plan: LoadedPlan,
): PlanReconciliationReport {
  const currentIdx = buildIndex(currentSpace);
  const changes: ChangeReconciliation[] = [];

  for (const chg of plan.changes.changes) {
    const details: string[] = [];
    let foundCount = 0;
    let totalChecks = 0;

    for (const op of chg.ops ?? []) {
      if ("add" in op) {
        totalChecks++;
        const expectedId =
          op.add === "field" ? `${op.into}#${String(op.value.id ?? "")}` : String(op.value.id ?? "");
        const baseId = expectedId.split("#")[0]!;
        if (currentIdx.get(baseId)) {
          foundCount++;
          details.push(`Found ${expectedId} in current model`);
        } else {
          details.push(`Not found in current model: ${expectedId}`);
        }
      } else if ("insert_step" in op) {
        totalChecks++;
        const flowId = op.insert_step.into.split("#")[0]!;
        const flow = currentIdx.get(flowId);
        if (flow && JSON.stringify(flow.data).includes(`"id":"${op.insert_step.value.id}"`)) {
          foundCount++;
          details.push(`Found step ${flowId}#${op.insert_step.value.id} in current model`);
        } else {
          details.push(`Step ${flowId}#${op.insert_step.value.id} not yet present in current model`);
        }
      } else if ("modify" in op) {
        totalChecks++;
        const baseId = op.modify.split("#")[0]!;
        if (currentIdx.get(baseId)) {
          foundCount++;
          details.push(`Target ${op.modify} exists in current model (verify field diff against fresh scan)`);
        } else {
          details.push(`Target ${op.modify} missing in current model`);
        }
      }
    }

    let status: ReconcileStatus = "not_found";
    if (totalChecks === 0) {
      status = "landed_as_planned";
      details.push("No structural ops; verify via proof tests.");
    } else if (foundCount === totalChecks) {
      status = "landed_as_planned";
    } else if (foundCount > 0) {
      status = "landed_differently";
    }

    changes.push({ change_id: chg.id, status, details });
  }

  return { plan_id: plan.id, changes };
}
