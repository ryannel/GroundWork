import 'server-only';

import { createHash } from 'node:crypto';

import { referenceCollector } from '@/application/model-transport';
import type { BaseInfo } from '@/application/plan/plan-base';
import { inheritedPlanOrder, operationTarget, type IndexedPlan } from '@/application/plans-index';
import { modelRecord, type ModelPlan } from '@/domain/workspace-model';

import { readModelPlanBaseMarkers } from './model-plan-base';
import { readSelectedPlanContext } from './model-plan-context';
import { readModelPlanEntries } from './model-plans';
import { NATIVE_PLAN_LOCK_FORMAT, readPlanLock, type PlanLock } from './plan-lock';

/** Every factual field participates; object key order alone never makes a plan stale. */
function modelFingerprint(value: unknown): string {
  if (value === null || value === undefined) return 'absent';
  const json = JSON.stringify(value, (_key, part: unknown): unknown => {
    const record = modelRecord(part);
    return record === null
      ? part
      : Object.fromEntries(Object.entries(record).toSorted(([a], [b]) => a.localeCompare(b)));
  });
  return createHash('sha256').update(json).digest('hex');
}

/** Native ids include children and story references; proposed-only ids remain explicitly absent before. */
export function modelPlanLockOf(
  context: IndexedPlan,
  plans: readonly ModelPlan[],
  landed: ReadonlySet<string>,
  checkedOn: string,
): PlanLock {
  const known = new Map(
    [...context.beforeIndex.entities, ...context.afterIndex.entities]
      .filter((node) => node.kind !== 'workspace')
      .map((node) => [node.id, []]),
  );
  const references: string[] = [];
  referenceCollector(known, (id) => {
    references.push(id);
  })(context.plan);
  const ancestors = inheritedPlanOrder(
    context.plan,
    new Map(plans.map((plan) => [plan.meta.id, plan])),
    landed,
  );
  const targets = ancestors.flatMap((plan) =>
    plan.changes.flatMap((change) => (change.ops ?? []).map((op) => operationTarget(op))),
  );
  const programme = context.plan.meta.programme;
  return {
    format: NATIVE_PLAN_LOCK_FORMAT,
    checkedOn,
    entities: Object.fromEntries(
      references.map((id) => [id, modelFingerprint(context.beforeIndex.get(id))]),
    ),
    bases: Object.fromEntries(ancestors.map((plan) => [plan.meta.id, modelFingerprint(plan)])),
    programme:
      programme === undefined
        ? null
        : { id: programme, hash: modelFingerprint(context.beforeIndex.get(programme)) },
    composed:
      ancestors.length === 0
        ? null
        : modelFingerprint(targets.map((id) => [id, context.beforeIndex.get(id)])),
    plan: modelFingerprint(context.plan),
  };
}

/** A previous-format check is still history, but its hashes cannot describe native edits. */
export function modelPlanCheckOf(
  lock: PlanLock | null,
  plan: ModelPlan,
): Pick<BaseInfo, 'checkedOn' | 'edited' | 'previousCheckedOn'> {
  if (lock === null) return { checkedOn: null, edited: false };
  if (lock.format !== NATIVE_PLAN_LOCK_FORMAT) {
    return { checkedOn: null, edited: false, previousCheckedOn: lock.checkedOn };
  }
  return { checkedOn: lock.checkedOn, edited: lock.plan !== modelFingerprint(plan) };
}

/** A native plan's existing lock metadata, compared with exactly the model its page uses. */
export async function readModelPlanBaseInfo(
  id: string,
  slug: string,
  root?: string,
): Promise<BaseInfo | null> {
  const context = await readSelectedPlanContext(id, slug, root);
  if (context === null) return null;
  const entries = await readModelPlanEntries(id, root);
  const markers = await readModelPlanBaseMarkers(id, root);
  const marker = markers.get(context.plan.meta.id);
  const empty = {
    checkedOn: null,
    edited: false,
    drift: [],
    builtOn: [],
    programme: null,
    stale: false,
  };
  if (marker !== undefined) return { ...empty, mode: 'landed', landedOn: marker.landed_on };
  const lock = await readPlanLock(id, slug, root);
  if (lock?.format !== NATIVE_PLAN_LOCK_FORMAT) {
    return { ...empty, ...modelPlanCheckOf(lock, context.plan), mode: 'live', landedOn: null };
  }
  const fresh = modelPlanLockOf(
    context,
    entries.map((entry) => entry.plan),
    new Set(markers.keys()),
    lock.checkedOn,
  );
  const changed = Object.keys(fresh.bases).filter((key) => lock.bases[key] !== fresh.bases[key]);
  const programme =
    fresh.programme === null
      ? null
      : {
          id: fresh.programme.id,
          changed: lock.programme?.hash !== fresh.programme.hash,
        };
  return {
    mode: 'live',
    landedOn: null,
    checkedOn: lock.checkedOn,
    edited: lock.plan !== fresh.plan,
    drift: Object.keys(lock.entities).filter(
      (key) => lock.entities[key] !== modelFingerprint(context.beforeIndex.get(key)),
    ),
    builtOn: Object.keys(fresh.bases).map((key) => {
      const entry = entries.find((candidate) => candidate.plan.meta.id === key);
      return {
        slug: entry?.slug ?? key,
        title: entry?.plan.meta.title ?? key,
        changed: changed.includes(key),
      };
    }),
    programme,
    stale: changed.length > 0 || programme?.changed === true || lock.composed !== fresh.composed,
  };
}
