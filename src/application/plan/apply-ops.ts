import { applyAdd, newRecord } from '@/application/plan/apply-add';
import { applyTargeted } from '@/application/plan/apply-modify';
import { systemOf } from '@/application/plan/graph';
import { indexSystem } from '@/application/plan/ops-index';
import type { AppliedOps, OpRecord, SystemSource } from '@/domain/plan/plan-graph';
import type { PathSegment } from '@/domain/plan/plan-ids';
import type { Change, Op } from '@/domain/plan/plan.generated';

/**
 * Apply the change ledger to an as-is system, in ledger order. Nothing passed in is changed.
 * `system` is the to-be system; `records` has one entry per op (what it did, and any problems or
 * warnings, with `at` relative to the op); `origins` maps an id to its source path (its as-is
 * position, or the last op that added or modified it).
 */
export function applyOps(asIs: Partial<SystemSource>, changes: readonly Change[] = []): AppliedOps {
  const system = systemOf(asIs);
  const ix = indexSystem(system);
  const removedBy = new Map<string, readonly PathSegment[]>();
  const applyOne = (chg: Change, at: readonly [number, number], op: Op): OpRecord => {
    const rec = newRecord(chg, at, op);
    if ('add' in op) applyAdd({ system, ix }, op, rec);
    else applyTargeted({ ix, removedBy }, op, rec);
    const removed = 'remove' in op && rec.removed !== undefined;
    for (const id of removed ? rec.ids : []) removedBy.set(id, rec.path);
    return rec;
  };
  const records = changes.flatMap((chg, ci) =>
    chg.ops.map((op, oi) => applyOne(chg, [ci, oi], op)),
  );
  return { system, records, origins: ix.origins };
}
