// Validator warnings a plan revision adds over a baseline revision.
// Warning paths and messages use list positions (`changes[7].ops[0]`), which shift when a PR inserts
// an item earlier in a list. Matching rewrites each position into the item's id, or for a change op
// into what it targets (`changes[chg:x].ops[add flow:y]`), so only genuinely new warnings count as new.

import type { Issue } from '@/application/plan/check-context';
import { isRecord, prop } from '@/application/plan/ids';

const SEGMENT = /([^.[\]]+)|\[(\d+)\]/g;
const PATH_IN_TEXT = /\b[a-z_]+\[\d+\](?:\.[A-Za-z_]+|\[\d+\])*/g;
const OP_VERBS = ['modify', 'deprecate', 'remove'];

function addLabel(node: Record<string, unknown>): string | null {
  const v = isRecord(node.value) ? node.value : {};
  const id = prop(v, 'id');
  const what =
    typeof id === 'string' ? id : [node.into, prop(v, 'name') ?? id].filter(Boolean).join('.');
  return what === '' ? null : `add ${what}`;
}

/** A position-free label for a list item: its id, or for a change op what it targets. */
export function itemLabel(node: unknown): string | null {
  if (!isRecord(node)) return null;
  if (typeof node.id === 'string') return node.id;
  if (typeof node.add === 'string') return addLabel(node);
  const verb = OP_VERBS.find((x) => typeof node[x] === 'string');
  return verb === undefined ? null : `${verb} ${String(node[verb])}`;
}

function itemAt(list: unknown, at: number): unknown {
  if (!Array.isArray(list)) return undefined;
  const items: unknown[] = list;
  return items[at];
}

/** `changes[7].ops[0].into` → `changes[chg:x].ops[add flow:y].into`, resolving positions against `plan`. */
export function stablePath(plan: unknown, path: string): string {
  let node: unknown = plan;
  let out = '';
  for (const m of path.matchAll(SEGMENT)) {
    if (m[1] === undefined) {
      node = itemAt(node, Number(m[2]));
      out += `[${itemLabel(node) ?? String(m[2])}]`;
    } else {
      out += `${out === '' ? '' : '.'}${m[1]}`;
      node = prop(node, m[1]);
    }
  }
  return out;
}

/** Stable key for a warning: its path and message with positions replaced by ids. */
function warningKey(plan: unknown, w: Issue): string {
  const message = w.message.replaceAll(PATH_IN_TEXT, (p) => stablePath(plan, p));
  return `${stablePath(plan, w.path)}\u0000${message}`;
}

export interface Baseline<W extends Issue = Issue> {
  plan: unknown;
  warnings: readonly W[];
}

/**
 * Warnings in `head` that `base` does not have. Counted as a multiset, so a second copy of a
 * known warning is new, and fixing one warning while adding another still reports the added one.
 */
export function newWarnings<W extends Issue>(base: Baseline, head: Baseline<W>): W[] {
  const left = new Map<string, number>();
  for (const w of base.warnings) {
    const k = warningKey(base.plan, w);
    left.set(k, (left.get(k) ?? 0) + 1);
  }
  return head.warnings.filter((w) => {
    const k = warningKey(head.plan, w);
    const n = left.get(k) ?? 0;
    if (n > 0) left.set(k, n - 1);
    return n === 0;
  });
}
