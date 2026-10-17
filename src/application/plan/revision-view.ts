// Small readers over a Revision: which snapshots a reader needs, the version pill's text, and where an id
// changed in a diff.

import { isRecord, prop, type Rec } from '@/application/plan/ids';
import type { PlanDiff } from '@/application/plan/plan-diff-core';
import {
  approvedRevision,
  currentRevision,
  ledgerOf,
  proposedRevision,
} from '@/application/plan/revision-ledger';
import type { Revision } from '@/application/plan/revision-types';
import type { Plan } from '@/domain/plan/plan.generated';

export interface SnapshotsWanted {
  readonly approved: string | null;
  readonly older: string | null;
}

/** Which snapshots ?rev=<version> needs read: the approved one (for the proposal's diff), and an older one to read. */
export function snapshotsWanted(headPlan: Plan, rev?: string | null): SnapshotsWanted {
  const ap = approvedRevision(headPlan);
  const cur = currentRevision(headPlan);
  const r = rev === undefined || rev === null || rev === 'head' ? null : rev;
  const needsApproved = ap !== null && (proposedRevision(headPlan) !== null || r === ap.version);
  const approved = needsApproved ? ap.version : null;
  const known = r !== null && ledgerOf(headPlan).some((x) => x.version === r);
  const older = known && r !== approved && r !== cur?.version ? r : null;
  return { approved, older };
}

/** Does the reader's ?rev=<version> ask for the approved snapshot, so the caller must read it? */
export const wantsApproved = (headPlan: Plan, rev?: string | null): boolean =>
  snapshotsWanted(headPlan, rev).approved !== null;

function shownPill(revision: Revision): string {
  const { version, entry } = revision.viewed;
  if (version === null) return '';
  const status = revision.viewing === 'head' ? revision.head.status : (entry?.status ?? '');
  return status === 'proposed' || status === 'rejected' ? `${version} ${status}` : version;
}

/** The version pill's text: "1.0" or "1.1 proposed" ('' when the plan has no ledger). */
export function pillText(plan: Plan, revision?: Revision | null): string {
  if (revision) return shownPill(revision);
  const cur = currentRevision(plan);
  if (cur === null) return '';
  return cur.status === 'proposed' ? `${cur.version} proposed` : cur.version;
}

const hasId = (x: unknown, id: string): x is Rec => isRecord(x) && x.id === id;

/** An entity (by id) in a parsed plan: top-level collections, scenarios, concepts and stages. */
export function findEntity(plan: Plan | null | undefined, id: string): Rec | null {
  if (!plan || id === '') return null;
  const pools: unknown[] = [
    ...Object.entries(plan).map(([, v]: readonly [string, unknown]) => v),
    prop(plan.problem, 'scenarios'),
    prop(plan.domain, 'concepts'),
    prop(plan.domain, 'stages'),
  ];
  for (const pool of pools) {
    const found = Array.isArray(pool) ? pool.find((x) => hasId(x, id)) : undefined;
    if (hasId(found, id)) return found;
  }
  return null;
}

export type DiffEntry =
  | { readonly key: string; readonly kind: 'added' | 'removed' }
  | { readonly key: string; readonly kind: 'changed'; readonly keys: readonly string[] };

/** Which diff collection (services, changes…) lists an id as added, removed or changed. */
export function diffEntry(diff: PlanDiff | null | undefined, id: string): DiffEntry | null {
  for (const [key, e] of Object.entries(diff?.entities ?? {})) {
    if (e.added.includes(id)) return { key, kind: 'added' };
    if (e.removed.includes(id)) return { key, kind: 'removed' };
    const changed = e.changed.find((x) => x.id === id);
    if (changed) return { key, kind: 'changed', keys: changed.keys };
  }
  return null;
}
