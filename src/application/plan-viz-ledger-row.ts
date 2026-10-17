import type { Model } from '@/application/plan/derive';
import { teamOf } from '@/application/plan-viz-teams';
import { plainLine, countOf } from '@/application/plan-viz-text';
import type { OpKind, OpRecord } from '@/domain/plan/plan-graph';

// The change ledger: one row per change, with what it does, what it touches and how it is proved and built.

export const KIND_WORD = {
  add: 'new',
  modify: 'changed',
  deprecate: 'deprecated',
  remove: 'removed',
} as const;
export const KIND_VERB = {
  add: 'adds',
  modify: 'changes',
  deprecate: 'deprecates',
  remove: 'removes',
} as const;
const KIND_ORDER = ['add', 'modify', 'deprecate', 'remove'] as const satisfies readonly OpKind[];

const MAX_TARGETS = 3;

export interface LedgerRow {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly why: string | null;
  readonly rollout: string | null;
  readonly targets: readonly string[];
  readonly moreTargets: number;
  readonly teams: readonly string[];
  readonly kinds: readonly { readonly kind: OpKind; readonly n: number }[];
  readonly tests: readonly string[];
  readonly items: readonly string[];
  /** Decisions the change cites that its "why" does not already name. */
  readonly decisions: readonly string[];
  readonly ops: readonly { readonly key: string; readonly kind: OpKind; readonly text: string }[];
}

function changeRecords(model: Model, id: string): OpRecord[] {
  return model.records.filter((r) => r.changeId === id);
}

const topOf = (id: string): string => id.split('#')[0] ?? id;

function targetOf(r: OpRecord): string {
  const folds = r.kind === 'add' && (r.type === 'field' || r.type === 'step');
  if (folds && r.parent !== undefined && r.parent !== null) return r.parent;
  return r.target === null ? '' : topOf(r.target);
}

/** Top-level targets of a change: a field or a step collapses to its schema or flow, in order of first appearance. */
export function changeTargets(model: Model, id: string): string[] {
  const all = changeRecords(model, id).map(targetOf);
  return [...new Set(all)].filter((t) => t !== '');
}

/** The service that owns a change: the first op target that has one. */
export function changeService(model: Model, id: string): string | null {
  for (const r of changeRecords(model, id)) {
    const parent = r.parent ?? null;
    const own =
      (r.target === null ? null : model.ownerService(r.target)) ??
      (parent === null ? null : model.ownerService(parent));
    if (own !== null) return own;
  }
  return null;
}

export function changeTeam(model: Model, id: string): string | null {
  const svc = changeService(model, id);
  return (svc === null ? null : teamOf(model, svc)) ?? model.teamsOf(id)[0] ?? null;
}

const testsOf = (model: Model, id: string): string[] =>
  (model.plan.tests ?? []).filter((t) => t.proves.includes(id)).map((t) => t.id);

const itemsOf = (model: Model, id: string): string[] =>
  (model.plan.work_items ?? []).filter((w) => w.implements.includes(id)).map((w) => w.id);

/** "2 tests · 1 work item": spelled out, never abbreviated. */
export function proofLine(tests: number, items: number): string {
  const t = tests > 0 ? countOf(tests, 'test') : 'no test yet';
  const w = items > 0 ? countOf(items, 'work item') : 'no work item yet';
  return `${t} · ${w}`;
}

function kindCounts(model: Model, id: string): LedgerRow['kinds'] {
  const records = changeRecords(model, id);
  return KIND_ORDER.map((kind) => ({
    kind,
    n: records.filter((r) => r.kind === kind).length,
  })).filter((k) => k.n > 0);
}

function opsOf(model: Model, id: string): LedgerRow['ops'] {
  return model.diff(id).map((d, i) => ({
    key: `${String(i)}-${d.summary}`,
    kind: d.kind ?? 'modify',
    // a summary may already carry its sign; the row draws the sign itself
    text: plainLine(d.summary).replace(/^[+~×−-] /u, ''),
  }));
}

/** The kinds of edit these changes make, so the key lists only what is on the page. */
export function kindsUsed(model: Model, ids: readonly string[]): OpKind[] {
  const used = new Set(ids.flatMap((id) => changeRecords(model, id).map((r) => r.kind)));
  return KIND_ORDER.filter((k) => used.has(k));
}

export function ledgerRow(model: Model, id: string, number: number): LedgerRow | null {
  const chg = (model.plan.changes ?? []).find((c) => c.id === id);
  if (chg === undefined) return null;
  const targets = changeTargets(model, id);
  const why = chg.why ?? null;
  return {
    id,
    number,
    title: chg.title,
    why,
    rollout: chg.rollout ?? null,
    targets: targets.slice(0, MAX_TARGETS),
    moreTargets: Math.max(0, targets.length - MAX_TARGETS),
    teams: model.teamsOf(id),
    kinds: kindCounts(model, id),
    tests: testsOf(model, id),
    items: itemsOf(model, id),
    decisions: (chg.decisions ?? []).filter((d) => !(why ?? '').includes(`[[${d}]]`)),
    ops: opsOf(model, id),
  };
}
