import { applyAdd, newRecord } from '@/application/plan/apply-add';
import { applyTargeted } from '@/application/plan/apply-modify';
import { systemOf } from '@/application/plan/graph';
import { indexSystem } from '@/application/plan/ops-index';
import type { AppliedOps, OpRecord, SystemSource } from '@/domain/plan/plan-graph';
import type { PathSegment } from '@/domain/plan/plan-ids';
import type { Change } from '@/domain/plan/plan.generated';

/**
 * Apply the change ledger to an as-is system, in ledger order. Nothing passed in is changed.
 * `system` is the to-be system; `records` has one entry per op (what it did, and any problems or
 * warnings, with `at` relative to the op); `origins` maps an id to its source path (its as-is
 * position, or the last op that added or modified it).
 */
export function applyOps(asIs: Partial<SystemSource>, changes: readonly Change[] = []): AppliedOps {
  const system = systemOf(asIs);
  const ix = indexSystem(system);
  const removedBy = new Map<string, PathSegment[]>();
  const records: OpRecord[] = [];
  for (const [ci, chg] of changes.entries()) {
    for (const [oi, op] of chg.ops.entries()) {
      const rec = newRecord(chg, [ci, oi], op);
      records.push(rec);
      if ('add' in op) applyAdd({ system, ix }, op, rec);
      else applyTargeted({ ix, removedBy }, op, rec);
    }
  }
  return { system, records, origins: ix.origins };
}
