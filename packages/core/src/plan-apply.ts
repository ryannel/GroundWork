import crypto from "node:crypto";
import type {
  HandlerDef,
  HandlerStep,
  PlanBaseLockFile,
  PlanOp,
  ProcedureDef,
  SchemaField,
  StepBranch,
} from "@groundwork/schema";
import { buildIndex, type SpaceIndex } from "./index-builder.js";
import type { LoadedComponent, LoadedPlan, LoadedSystem, SpaceModel } from "./model.js";

export interface DiffEntry {
  readonly entity_id: string;
  readonly change_id: string;
  readonly kind: "added" | "modified" | "removed";
  readonly detail?: string;
}

export interface PlanApplyResult {
  readonly before: SpaceModel;
  readonly after: SpaceModel;
  readonly diff: readonly DiffEntry[];
  readonly errors: readonly string[];
}

export type DriftSeverity = "clean_apply" | "semantic_drift" | "hard_conflict";

export interface DriftItem {
  readonly target_id: string;
  readonly role: "modified_target" | "relies_on";
  readonly status: DriftSeverity;
  readonly detail: string;
}

export interface PlanDriftReport {
  readonly plan_id: string;
  readonly status: DriftSeverity;
  readonly items: readonly DriftItem[];
}

function stableHash(value: unknown): string {
  return "sha256:" + crypto.createHash("sha256").update(JSON.stringify(value) ?? "").digest("hex").slice(0, 16);
}

function findStepById(steps: readonly HandlerStep[], stepId: string): HandlerStep | undefined {
  for (const s of steps) {
    if (s.id === stepId) return s;
    const subArrays = [s.then, s.else, s.steps, s.try, s.catch, s.finally, s.retry?.exhausted];
    for (const arr of subArrays) {
      if (arr) {
        const found = findStepById(arr, stepId);
        if (found) return found;
      }
    }
    if (s.parallel) {
      for (const lane of s.parallel) {
        const found = findStepById(lane.steps, stepId);
        if (found) return found;
      }
    }
  }
  return undefined;
}

function insertIntoStepList(
  list: readonly HandlerStep[],
  newStep: HandlerStep,
  beforeId?: string,
  afterId?: string,
): HandlerStep[] {
  const copy = [...list];
  if (beforeId) {
    const idx = copy.findIndex((s) => s.id === beforeId);
    if (idx !== -1) {
      copy.splice(idx, 0, newStep);
      return copy;
    }
  }
  if (afterId) {
    const idx = copy.findIndex((s) => s.id === afterId);
    if (idx !== -1) {
      copy.splice(idx + 1, 0, newStep);
      return copy;
    }
  }
  copy.push(newStep);
  return copy;
}

function mapStepTree(
  steps: readonly HandlerStep[],
  transform: (step: HandlerStep) => HandlerStep | null,
): HandlerStep[] {
  const out: HandlerStep[] = [];
  for (const step of steps) {
    const updated: HandlerStep = {
      ...step,
      ...(step.then ? { then: mapStepTree(step.then, transform) } : {}),
      ...(step.else ? { else: mapStepTree(step.else, transform) } : {}),
      ...(step.steps ? { steps: mapStepTree(step.steps, transform) } : {}),
      ...(step.try ? { try: mapStepTree(step.try, transform) } : {}),
      ...(step.catch ? { catch: mapStepTree(step.catch, transform) } : {}),
      ...(step.finally ? { finally: mapStepTree(step.finally, transform) } : {}),
      ...(step.retry?.exhausted
        ? { retry: { ...step.retry, exhausted: mapStepTree(step.retry.exhausted, transform) } }
        : {}),
      ...(step.parallel
        ? { parallel: step.parallel.map((l) => ({ ...l, steps: mapStepTree(l.steps, transform) })) }
        : {}),
    };
    const res = transform(updated);
    if (res !== null) out.push(res);
  }
  return out;
}

function updateHandlerOrProcedure(
  systems: readonly LoadedSystem[],
  flowId: string,
  updater: (flow: HandlerDef | ProcedureDef) => HandlerDef | ProcedureDef,
): { systems: LoadedSystem[]; found: boolean } {
  let found = false;
  const nextSystems = systems.map((sys) => {
    let sysChanged = false;
    const nextComponents = sys.components.map((comp) => {
      const hIdx = comp.handlers.handlers.findIndex((h) => h.id === flowId);
      if (hIdx !== -1) {
        found = true;
        sysChanged = true;
        const nextHandlers = [...comp.handlers.handlers];
        nextHandlers[hIdx] = updater(nextHandlers[hIdx]!) as HandlerDef;
        return { ...comp, handlers: { ...comp.handlers, handlers: nextHandlers } };
      }
      const pIdx = (comp.handlers.procedures ?? []).findIndex((p) => p.id === flowId);
      if (pIdx !== -1) {
        found = true;
        sysChanged = true;
        const nextProcs = [...(comp.handlers.procedures ?? [])];
        nextProcs[pIdx] = updater(nextProcs[pIdx]!) as ProcedureDef;
        return { ...comp, handlers: { ...comp.handlers, procedures: nextProcs } };
      }
      return comp;
    });
    return sysChanged ? { ...sys, components: nextComponents } : sys;
  });
  return { systems: nextSystems, found };
}

function applySingleOp(
  systems: readonly LoadedSystem[],
  op: PlanOp,
  changeId: string,
  diff: DiffEntry[],
  errors: string[],
): LoadedSystem[] {
  // 1. insert_step (tree-aware surgical step insertion)
  if ("insert_step" in op) {
    const spec = op.insert_step;
    const [flowId, parentStepId] = spec.into.split("#");
    const branch: StepBranch = spec.branch ?? "steps";
    const beforeSlug = spec.before?.includes("#") ? spec.before.split("#")[1] : spec.before;
    const afterSlug = spec.after?.includes("#") ? spec.after.split("#")[1] : spec.after;

    const { systems: nextSystems, found } = updateHandlerOrProcedure(systems, flowId!, (flow) => {
      if (!parentStepId) {
        return { ...flow, steps: insertIntoStepList(flow.steps, spec.value, beforeSlug, afterSlug) };
      }
      let inserted = false;
      const nextSteps = mapStepTree(flow.steps, (s) => {
        if (s.id !== parentStepId) return s;
        inserted = true;
        if (branch === "exhausted" && s.retry) {
          return { ...s, retry: { ...s.retry, exhausted: insertIntoStepList(s.retry.exhausted ?? [], spec.value, beforeSlug, afterSlug) } };
        }
        const existing = (s[branch as keyof HandlerStep] as readonly HandlerStep[] | undefined) ?? [];
        return { ...s, [branch]: insertIntoStepList(existing, spec.value, beforeSlug, afterSlug) };
      });
      if (!inserted) {
        errors.push(`insert_step target step not found: ${spec.into}`);
      }
      return { ...flow, steps: nextSteps };
    });

    if (!found) {
      errors.push(`insert_step target handler/procedure not found: ${flowId}`);
      return [...systems];
    }
    diff.push({ entity_id: `${flowId}#${spec.value.id}`, change_id: changeId, kind: "added", detail: `Inserted step into ${spec.into} (${branch})` });
    return nextSystems;
  }

  // 2. wrap_step
  if ("wrap_step" in op) {
    const [flowId, stepId] = op.wrap_step.target.split("#");
    if (!flowId || !stepId) {
      errors.push(`wrap_step requires handler:...#step target: ${op.wrap_step.target}`);
      return [...systems];
    }
    const { branch = "steps", ...wrapperFields } = op.wrap_step.wrapper;
    const { systems: nextSystems, found } = updateHandlerOrProcedure(systems, flowId, (flow) => ({
      ...flow,
      steps: mapStepTree(flow.steps, (s) => {
        if (s.id !== stepId) return s;
        return { ...(wrapperFields as HandlerStep), [branch]: [s] };
      }),
    }));
    if (!found) errors.push(`wrap_step target not found: ${op.wrap_step.target}`);
    else diff.push({ entity_id: op.wrap_step.target, change_id: changeId, kind: "modified", detail: `Wrapped step in ${wrapperFields.id}` });
    return nextSystems;
  }

  // 3. modify
  if ("modify" in op) {
    const target = op.modify;
    if (target.startsWith("handler:") || target.startsWith("procedure:")) {
      const [flowId, stepId] = target.split("#");
      if (!stepId && "steps" in op.set && !op.replace_all) {
        errors.push(`Full-array set.steps on ${target} is banned; use surgical insert_step/modify on #step or set replace_all: true with reason`);
        return [...systems];
      }
      const { systems: nextSystems, found } = updateHandlerOrProcedure(systems, flowId!, (flow) => {
        if (!stepId) return { ...flow, ...op.set } as HandlerDef;
        return {
          ...flow,
          steps: mapStepTree(flow.steps, (s) => (s.id === stepId ? ({ ...s, ...op.set } as HandlerStep) : s)),
        };
      });
      if (!found) errors.push(`modify target not found: ${target}`);
      else diff.push({ entity_id: target, change_id: changeId, kind: "modified" });
      return nextSystems;
    }
    diff.push({ entity_id: target, change_id: changeId, kind: "modified" });
    return [...systems];
  }

  // 4. remove
  if ("remove" in op) {
    const target = op.remove;
    if ((target.startsWith("handler:") || target.startsWith("procedure:")) && target.includes("#")) {
      const [flowId, stepId] = target.split("#");
      const { systems: nextSystems, found } = updateHandlerOrProcedure(systems, flowId!, (flow) => ({
        ...flow,
        steps: mapStepTree(flow.steps, (s) => (s.id === stepId ? null : s)),
      }));
      if (!found) errors.push(`remove target not found: ${target}`);
      else diff.push({ entity_id: target, change_id: changeId, kind: "removed" });
      return nextSystems;
    }
    diff.push({ entity_id: target, change_id: changeId, kind: "removed" });
    return [...systems];
  }

  // 5. add
  if ("add" in op) {
    if (op.add === "field") {
      const schemaId = op.into;
      const field = op.value as unknown as SchemaField;
      let found = false;
      const nextSystems = systems.map((sys) => {
        let changed = false;
        const nextStores = sys.stores.map((st) => {
          const recIdx = (st.records ?? []).findIndex((r) => r.id === schemaId);
          if (recIdx === -1) return st;
          found = true;
          changed = true;
          const nextRecords = [...(st.records ?? [])];
          const rec = nextRecords[recIdx]!;
          nextRecords[recIdx] = { ...rec, fields: [...rec.fields, field] };
          return { ...st, records: nextRecords };
        });
        const nextComps = sys.components.map((comp) => {
          const sIdx = (comp.contracts.schemas ?? []).findIndex((s) => s.id === schemaId);
          if (sIdx === -1) return comp;
          found = true;
          changed = true;
          const nextSchemas = [...(comp.contracts.schemas ?? [])];
          const sch = nextSchemas[sIdx]!;
          nextSchemas[sIdx] = { ...sch, fields: [...sch.fields, field] };
          return { ...comp, contracts: { ...comp.contracts, schemas: nextSchemas } };
        });
        return changed ? { ...sys, stores: nextStores, components: nextComps } : sys;
      });
      if (!found) errors.push(`add field target schema not found: ${schemaId}`);
      else diff.push({ entity_id: `${schemaId}#${field.id}`, change_id: changeId, kind: "added" });
      return nextSystems;
    }

    if (op.add === "handler" || op.add === "subscription") {
      const compId = op.into;
      let found = false;
      const nextSystems = systems.map((sys) => {
        const cIdx = sys.components.findIndex((c) => c.id === compId);
        if (cIdx === -1) return sys;
        found = true;
        const nextComps = [...sys.components];
        const comp: LoadedComponent = nextComps[cIdx]!;
        if (op.add === "handler") {
          nextComps[cIdx] = {
            ...comp,
            handlers: { ...comp.handlers, handlers: [...comp.handlers.handlers, op.value as unknown as HandlerDef] },
          };
        } else {
          nextComps[cIdx] = {
            ...comp,
            contracts: { ...comp.contracts, subscriptions: [...(comp.contracts.subscriptions ?? []), op.value as never] },
          };
        }
        return { ...sys, components: nextComps };
      });
      if (!found) errors.push(`add ${op.add} target component not found: ${compId}`);
      else diff.push({ entity_id: String(op.value.id ?? op.into), change_id: changeId, kind: "added" });
      return nextSystems;
    }

    diff.push({ entity_id: String(op.value.id ?? op.into), change_id: changeId, kind: "added" });
    return [...systems];
  }

  return [...systems];
}

/**
 * Copy-on-write plan overlay application:
 * - Resolves builds_on ancestors in topological order (skipping already-landed plans).
 * - Merges architecture/additions/ (new systems & flows for greenfield or hybrid builds).
 * - Applies surgical tree-aware ops from architecture/changes.yaml without deep-cloning untouched systems.
 */
export function applyPlan(space: SpaceModel, planId: string): PlanApplyResult {
  const planById = new Map(space.plans.map((p) => [p.id, p]));
  const targetPlan = planById.get(planId);
  if (!targetPlan) {
    return { before: space, after: space, diff: [], errors: [`Plan not found: ${planId}`] };
  }

  // Topological sort of builds_on ancestors (ignore landed ancestors!)
  const ordered: LoadedPlan[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const errors: string[] = [];

  const visit = (p: LoadedPlan) => {
    if (visited.has(p.id)) return;
    if (visiting.has(p.id)) {
      errors.push(`Circular builds_on dependency involving ${p.id}`);
      return;
    }
    visiting.add(p.id);
    for (const parentId of p.manifest.builds_on ?? []) {
      const parent = planById.get(parentId);
      if (!parent) {
        errors.push(`Plan ${p.id} builds_on missing plan ${parentId}`);
        continue;
      }
      if (parent.manifest.status === "landed") continue; // Ignore landed parents at apply time
      visit(parent);
    }
    visiting.delete(p.id);
    visited.add(p.id);
    ordered.push(p);
  };

  visit(targetPlan);

  let currentSystems = [...space.systems];
  let currentFlows = [...space.flows];
  let beforeModel: SpaceModel = space;
  const diff: DiffEntry[] = [];

  for (const p of ordered) {
    const isTarget = p.id === targetPlan.id;
    if (isTarget) {
      beforeModel = { ...space, systems: currentSystems, flows: currentFlows };
    }

    // Merge additions/systems and additions/flows
    for (const addedSys of p.additions_systems) {
      currentSystems = [...currentSystems, addedSys];
      if (isTarget) {
        diff.push({ entity_id: addedSys.id, change_id: "additions", kind: "added", detail: `New system ${addedSys.id}` });
        for (const c of addedSys.components) {
          diff.push({ entity_id: c.id, change_id: "additions", kind: "added", detail: `New component ${c.id}` });
        }
      }
    }
    for (const addedFlow of p.additions_flows) {
      currentFlows = [...currentFlows, addedFlow];
      if (isTarget) {
        diff.push({ entity_id: addedFlow.id, change_id: "additions", kind: "added", detail: `New flow ${addedFlow.id}` });
      }
    }

    // Apply surgical ops
    for (const chg of p.changes.changes) {
      for (const op of chg.ops ?? []) {
        currentSystems = applySingleOp(
          currentSystems,
          op,
          chg.id,
          isTarget ? diff : [],
          errors,
        );
      }
    }
  }

  const afterModel: SpaceModel = {
    ...space,
    systems: currentSystems,
    flows: currentFlows,
  };

  return { before: beforeModel, after: afterModel, diff, errors };
}

function resolveTargetSnapshot(index: SpaceIndex, targetId: string): unknown | undefined {
  if (targetId.includes("#")) {
    const [baseId, childId] = targetId.split("#");
    const base = index.get(baseId!);
    if (!base) return undefined;
    if (base.kind === "handler" || base.kind === "procedure") {
      const flow = base.data as HandlerDef | ProcedureDef;
      return findStepById(flow.steps, childId!);
    }
    return base.data;
  }
  return index.get(targetId)?.data;
}

export function computeBaseLock(plan: LoadedPlan, beforeModel: SpaceModel): PlanBaseLockFile {
  const idx = buildIndex(beforeModel);
  const targets: Record<string, string> = {};
  const relies_on: Record<string, string> = {};

  for (const chg of plan.changes.changes) {
    for (const op of chg.ops ?? []) {
      const targetId =
        "modify" in op
          ? op.modify
          : "remove" in op
            ? op.remove
            : "insert_step" in op
              ? op.insert_step.into
              : "wrap_step" in op
                ? op.wrap_step.target
                : op.into;
      const snap = resolveTargetSnapshot(idx, targetId);
      if (snap !== undefined) {
        targets[targetId] = stableHash(snap);
      }
    }
  }

  for (const relId of plan.changes.relies_on ?? []) {
    const snap = resolveTargetSnapshot(idx, relId);
    if (snap !== undefined) {
      relies_on[relId] = stableHash(snap);
    }
  }

  return {
    schema_version: 1,
    locked_at: new Date().toISOString(),
    targets,
    relies_on,
  };
}

export function checkPlanDrift(plan: LoadedPlan, beforeModel: SpaceModel): PlanDriftReport {
  if (!plan.base_lock) {
    return { plan_id: plan.id, status: "clean_apply", items: [] };
  }

  const idx = buildIndex(beforeModel);
  const items: DriftItem[] = [];
  let worst: DriftSeverity = "clean_apply";
  const elevate = (next: DriftSeverity) => {
    const rank: Record<DriftSeverity, number> = { clean_apply: 0, semantic_drift: 1, hard_conflict: 2 };
    if (rank[next] > rank[worst]) worst = next;
  };

  const checkGroup = (group: Readonly<Record<string, string>>, role: DriftItem["role"]) => {
    for (const [id, lockedHash] of Object.entries(group)) {
      const snap = resolveTargetSnapshot(idx, id);
      if (snap === undefined) {
        elevate("hard_conflict");
        items.push({ target_id: id, role, status: "hard_conflict", detail: `Target ${id} was deleted or moved since base lock` });
      } else {
        const currentHash = stableHash(snap);
        if (currentHash !== lockedHash) {
          elevate("semantic_drift");
          items.push({ target_id: id, role, status: "semantic_drift", detail: `Target ${id} changed since base lock (${lockedHash} -> ${currentHash})` });
        }
      }
    }
  };

  checkGroup(plan.base_lock.targets, "modified_target");
  checkGroup(plan.base_lock.relies_on ?? {}, "relies_on");

  return { plan_id: plan.id, status: worst, items };
}
