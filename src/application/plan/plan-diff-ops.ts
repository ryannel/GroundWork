// The change ledger of a plan diff: which ops one revision added, removed or edited in place.

import { itemLabel } from '@/application/plan/baseline';
import type { derive } from '@/application/plan/derive';
import { isRecord, prop, type Rec } from '@/application/plan/ids';
import {
  type ChangeOps,
  type Collections,
  canonical,
  differing,
  keysOf,
  list,
  none,
  text,
  textOr,
} from '@/application/plan/plan-diff-core';

export type Derived = ReturnType<typeof derive>;

type Summarise = (changeId: string, index: number, op: unknown) => string;

export interface Summaries {
  from: Summarise;
  to: Summarise;
}

function modifyText(op: Rec): string {
  const parts = ['set', 'append', 'drop']
    .filter((k) => op[k] !== undefined && op[k] !== null)
    .map((k) => `${k} ${keysOf(op[k]).join(', ')}`);
  return `~ ${text(op.modify) ?? ''} (${parts.join('; ')})`;
}

function addText(op: Rec): string {
  const value = prop(op, 'value');
  const what = textOr(prop(value, 'id'), textOr(prop(value, 'name'), ''));
  const into = text(op.into);
  const where = into === null ? '' : ` into ${into}`;
  return `+ ${text(op.add) ?? ''} ${what}${where}`.trim();
}

/** Short text for an op when the model cannot summarise it. */
function rawOp(op: unknown): string {
  if (!isRecord(op)) return canonical(op);
  if ('add' in op) return addText(op);
  if ('modify' in op) return modifyText(op);
  if ('deprecate' in op) {
    const by = text(op.replaced_by);
    const to = by === null ? '' : ` → ${by}`;
    return `− deprecate ${text(op.deprecate) ?? ''}${to}`;
  }
  if ('remove' in op) return `× remove ${text(op.remove) ?? ''}`;
  return canonical(op);
}

/** What a revision's model says an op does; its raw text when the revision cannot be derived. */
export const summariser =
  (m: Derived | null): Summarise =>
  (changeId, index, op) => {
    const s = m?.opSummary(changeId, index) ?? '';
    return s === '' ? rawOp(op) : s;
  };

interface IndexedOp {
  index: number;
  op: unknown;
}

/** Ops in `a` but not `b`, compared as a multiset of canonical forms. */
function opsMinus(a: unknown[], b: unknown[]): IndexedOp[] {
  const pool = new Map<string, number>();
  for (const op of b) pool.set(canonical(op), (pool.get(canonical(op)) ?? 0) + 1);
  const out: IndexedOp[] = [];
  for (const [index, op] of a.entries()) {
    const k = canonical(op);
    const left = pool.get(k) ?? 0;
    if (left > 0) pool.set(k, left - 1);
    else out.push({ index, op });
  }
  return out;
}

interface Edit {
  index: number;
  fromIndex: number;
  op: unknown;
  prev: unknown;
}

/** Pair removed and added ops that target the same thing (same verb and target): an op edited in place. */
function pairEdits(
  plus: IndexedOp[],
  minus: IndexedOp[],
): { added: IndexedOp[]; removed: IndexedOp[]; edited: Edit[] } {
  const byLabel = new Map<string, IndexedOp[]>();
  for (const m of minus) {
    const k = itemLabel(m.op);
    if (k !== null) byLabel.set(k, [...(byLabel.get(k) ?? []), m]);
  }
  const edited: Edit[] = [];
  const added = plus.filter((p) => {
    const k = itemLabel(p.op);
    const m = k === null ? undefined : byLabel.get(k)?.shift();
    if (m === undefined) return true;
    edited.push({ index: p.index, fromIndex: m.index, op: p.op, prev: m.op });
    return false;
  });
  const used = new Set(edited.map((e) => e.prev));
  return { added, removed: minus.filter((m) => !used.has(m.op)), edited };
}

/** Which parts of an op differ: top-level keys, or `value.<key>` inside an add. */
function opFields(a: unknown, b: unknown): string[] {
  const [x, y] = [prop(a, 'value'), prop(b, 'value')];
  return differing(a, b)
    .flatMap((k) =>
      k === 'value' && isRecord(x) && isRecord(y) ? differing(x, y).map((v) => `value.${v}`) : [k],
    )
    .toSorted((p, q) => p.localeCompare(q));
}

interface ChangePair {
  id: string;
  now: Rec;
  before: Rec | undefined;
}

function changeOps({ id, now, before }: ChangePair, sum: Summaries): ChangeOps | null {
  const [oldOps, newOps] = [list(before?.ops), list(now.ops)];
  const p = pairEdits(
    opsMinus(newOps, oldOps),
    before === undefined ? [] : opsMinus(oldOps, newOps),
  );
  const added = p.added.map(({ index, op }) => ({ index, summary: sum.to(id, index, op) }));
  const removed = p.removed.map(({ index, op }) => ({ index, summary: sum.from(id, index, op) }));
  const edited = p.edited.map(({ index, fromIndex, op, prev }) => ({
    index,
    fromIndex,
    summary: sum.to(id, index, op),
    fields: opFields(prev, op),
  }));
  if (added.length + removed.length + edited.length === 0) return null;
  const title = textOr(now.title, id);
  const status = before === undefined ? 'added' : 'changed';
  return { change: id, title, status, added, removed, edited };
}

/** Ops added, removed or edited per change, and whole changes that are new or gone. */
export function opsDiff(a: Collections, b: Collections, sum: Summaries): ChangeOps[] {
  const [CA, CB] = [a.changes ?? none(), b.changes ?? none()];
  const out: ChangeOps[] = [];
  for (const [id, now] of CB) {
    const c = changeOps({ id, now, before: CA.get(id) }, sum);
    if (c !== null) out.push(c);
  }
  for (const [id, ca] of CA) {
    if (CB.has(id)) continue;
    const removed = list(ca.ops).map((op, index) => ({ index, summary: sum.from(id, index, op) }));
    const title = textOr(ca.title, id);
    out.push({ change: id, title, status: 'removed', added: [], removed, edited: [] });
  }
  return out;
}
