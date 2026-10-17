import type { Plan } from '@/domain/plan/plan.generated';

/** One entry of `meta.revisions`. */
export type RevisionEntry = NonNullable<Plan['meta']['revisions']>[number];

/** Anything with a ledger: a whole plan, or just its meta. */
type Ledgered =
  | { readonly meta?: { readonly revisions?: readonly RevisionEntry[] | undefined } | undefined }
  | null
  | undefined;

export const ledgerOf = (plan: Ledgered): readonly RevisionEntry[] => plan?.meta?.revisions ?? [];

function partsOf(v: unknown): number[] {
  const text = typeof v === 'string' || typeof v === 'number' ? String(v) : '';
  return text.split('.').map((x) => {
    const n = Number.parseInt(x, 10);
    return Number.isNaN(n) ? 0 : n;
  });
}

/** Compare two dotted version strings numerically ("1.10" > "1.9"); a part that is not a number counts as 0. */
export function compareVersions(a: unknown, b: unknown): -1 | 0 | 1 {
  const [pa, pb] = [partsOf(a), partsOf(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** The revision entry the plan file currently is: the last one not rejected (null without a ledger). */
export function currentRevision(plan: Ledgered): RevisionEntry | null {
  return ledgerOf(plan).findLast((r) => r.status !== 'rejected') ?? null;
}

/** The newest approved revision: the canonical plan (null when nothing has been approved yet). */
export function approvedRevision(plan: Ledgered): RevisionEntry | null {
  return ledgerOf(plan).findLast((r) => r.status === 'approved') ?? null;
}

/** The proposed head, if the ledger ends in one. */
export function proposedRevision(plan: Ledgered): RevisionEntry | null {
  const last = ledgerOf(plan).at(-1);
  return last?.status === 'proposed' ? last : null;
}
