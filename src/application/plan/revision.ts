// The revision ledger as a reader sees it: which revision the file is, which is approved, and what the proposal
// changes. Pure: the caller reads the snapshots (readRevision / listRevisions) and passes the plans in.

import { planDiff } from '@/application/plan/plan-diff';
import type { PlanDiff } from '@/application/plan/plan-diff-core';
import {
  approvedRevision,
  currentRevision,
  ledgerOf,
  proposedRevision,
  type RevisionEntry,
} from '@/application/plan/revision-ledger';
import type {
  ApprovedRevision,
  HeadRevision,
  HeadStatus,
  HistoryRow,
  OlderRevision,
  Revision,
  RevisionOptions,
  RevisionStep,
} from '@/application/plan/revision-types';
import type { Plan } from '@/domain/plan/plan.generated';

function statusOf(plan: Plan, cur: RevisionEntry | null): HeadStatus {
  if (proposedRevision(plan) !== null) return 'proposed';
  return cur?.status === 'approved' ? 'approved' : 'none';
}

function headOf(plan: Plan): HeadRevision {
  const cur = currentRevision(plan);
  return {
    version: cur?.version ?? plan.meta.version ?? null,
    status: statusOf(plan, cur),
    entry: cur,
    plan,
  };
}

function approvedOf(
  plan: Plan,
  snapshot: Plan | null,
  head: HeadRevision,
): ApprovedRevision | null {
  const entry = approvedRevision(plan);
  if (entry === null) return null;
  return {
    version: entry.version,
    entry,
    plan: snapshot ?? (head.status === 'approved' ? plan : null),
  };
}

interface View {
  on: string;
  /** The approved ↔ proposed pair is on show. */
  pair: boolean;
  past: OlderRevision | null;
}

/** The approved ↔ proposed pair keeps its diff; any other earlier version is read as it was, without one. */
function viewOf(want: Wanted, head: HeadRevision, approved: ApprovedRevision | null): View {
  const { viewing: v, older } = want;
  const pair =
    approved?.plan !== undefined &&
    approved.plan !== null &&
    head.status === 'proposed' &&
    v === approved.version;
  const past = !pair && v !== head.version && older?.version === v ? older : null;
  return { on: pair || past !== null ? v : 'head', pair, past };
}

function historyOf(
  ledger: RevisionEntry[],
  available: Set<string>,
  shown: string | null,
): HistoryRow[] {
  return ledger
    .map((entry) => ({
      version: entry.version,
      entry,
      current: entry.version === shown,
      available: available.has(entry.version),
    }))
    .toReversed();
}

/** Each revision against the one it was proposed on: the newest approved revision before it in the ledger. */
function stepsOf(ledger: RevisionEntry[], plans: Map<string, Plan>): RevisionStep[] {
  return ledger
    .map((entry, i) => {
      const base = ledger.slice(0, i).findLast((x) => x.status === 'approved')?.version ?? null;
      return {
        version: entry.version,
        entry,
        base,
        available: plans.has(entry.version),
        baseAvailable: base !== null && plans.has(base),
      };
    })
    .toReversed();
}

/** Every revision readable here, by version; later entries win. */
function readable(entries: [string, Plan | null | undefined][]): Map<string, Plan> {
  const byVersion = new Map<string, Plan>();
  for (const [version, plan] of entries)
    if (plan !== null && plan !== undefined) byVersion.set(version, plan);
  return byVersion;
}

function viewedOf(
  view: View,
  ctx: { head: HeadRevision; ledger: RevisionEntry[]; approved: ApprovedRevision | null },
) {
  const plan = view.pair ? ctx.approved?.plan : view.past?.plan;
  if (view.on === 'head' || plan === null || plan === undefined) {
    return { version: ctx.head.version, entry: ctx.head.entry, plan: ctx.head.plan };
  }
  return { version: view.on, entry: ctx.ledger.find((r) => r.version === view.on) ?? null, plan };
}

function memoDiffs(
  steps: RevisionStep[],
  plans: Map<string, Plan>,
): (version: string) => PlanDiff | null {
  const done = new Map<string, PlanDiff | null>();
  return (version) => {
    const cached = done.get(version);
    if (cached !== undefined) return cached;
    const step = steps.find((s) => s.version === version);
    const from = plans.get(step?.base ?? '');
    const to = plans.get(version);
    const d = step?.baseAvailable === true && from && to ? planDiff(from, to) : null;
    done.set(version, d);
    return d;
  };
}

interface Wanted {
  viewing: string;
  older: OlderRevision | null;
  snapshots: readonly string[];
  plans: [string, Plan | null | undefined][];
}

const wanted = (opts: RevisionOptions): Wanted => ({
  viewing: opts.viewing ?? 'head',
  older: opts.older ?? null,
  snapshots: opts.snapshots ?? [],
  plans: Object.entries(opts.plans ?? {}),
});

const diffFor = (head: Plan, approved: Plan | null, past: OlderRevision | null): PlanDiff | null =>
  proposedRevision(head) !== null && approved !== null && past === null
    ? planDiff(approved, head)
    : null;

/**
 * The revision structure of a plan file.
 * @param headPlan plans/<slug>/plan.yaml as parsed: the newest revision, proposed or approved
 * @param approvedPlan the approved snapshot as parsed, or null (none, or it failed to load)
 */
export function buildRevision(
  headPlan: Plan,
  approvedPlan: Plan | null = null,
  opts: RevisionOptions = {},
): Revision {
  const want = wanted(opts);
  const ledger = ledgerOf(headPlan);
  const head = headOf(headPlan);
  const approved = approvedOf(headPlan, approvedPlan, head);
  const { on, pair, past } = viewOf(want, head, approved);
  const plans = readable([
    ...want.plans,
    [head.version ?? '', headPlan],
    [approved?.version ?? '', approved?.plan],
    [want.older?.version ?? '', want.older?.plan],
  ]);
  plans.delete('');
  const viewed = viewedOf({ on, pair, past }, { head, ledger, approved });
  const steps = stepsOf(ledger, plans);
  return {
    viewing: on,
    viewed,
    head,
    approved,
    ledger,
    history: historyOf(ledger, new Set([...plans.keys(), ...want.snapshots]), viewed.version),
    diff: diffFor(headPlan, approved?.plan ?? null, past),
    steps,
    plans,
    diffOf: memoDiffs(steps, plans),
  };
}
