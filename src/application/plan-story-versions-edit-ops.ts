import { prop, strings } from '@/application/plan/ids';
import type { ChangeOps } from '@/application/plan/plan-diff-core';
import { findEntity } from '@/application/plan/revision-view';
import { type EditItem, plainOf } from '@/application/plan-story-versions-edit-item';
import { refText, type View } from '@/application/plan-story-versions-pair';
import { unmark } from '@/application/plan-story-versions-words';

// The edits to the changes in a plan: new, dropped, and what their ops add, remove and alter.

interface Field {
  readonly name: string;
  readonly note: string;
  readonly json: string;
}

function opAt(plan: View['pair']['to'], change: string, index: number): unknown {
  const ops = prop(findEntity(plan, change), 'ops');
  const found: unknown = Array.isArray(ops) ? ops[index] : undefined;
  return found;
}

function fieldsOf(op: unknown): Field[] {
  const list = prop(prop(op, 'value'), 'fields') ?? prop(prop(op, 'set'), 'fields');
  if (!Array.isArray(list)) return [];
  return list.flatMap((f: unknown) => {
    const name = prop(f, 'name');
    if (typeof name !== 'string') return [];
    const note = prop(f, 'note');
    return [{ name, note: typeof note === 'string' ? unmark(note) : '', json: JSON.stringify(f) }];
  });
}

const named = (list: readonly Field[]) => new Map(list.map((f) => [f.name, f]));

/** Fields added, dropped and altered between two ops, by name. */
function fieldMoves(was: unknown, now: unknown) {
  const [a, b] = [fieldsOf(was), fieldsOf(now)];
  const [before, after] = [named(a), named(b)];
  return {
    added: b.filter((f) => !before.has(f.name)),
    removed: a.filter((f) => !after.has(f.name)),
    edited: b.filter((f) => before.has(f.name) && before.get(f.name)?.json !== f.json),
  };
}

const TARGETS = ['id', 'modify', 'deprecate', 'remove', 'into'] as const;

/** The thing an op touches, as a citation when the plan on show has it. */
function targetOf(view: View, op: unknown): string {
  const value = prop(op, 'value');
  const ids = [prop(value, 'id'), ...TARGETS.slice(1).map((k) => prop(op, k))];
  const id = ids.find((x): x is string => typeof x === 'string');
  if (id !== undefined) return refText(view, id.split('#')[0] ?? id);
  const name = prop(value, 'name');
  return `**${typeof name === 'string' ? name : ''}**`;
}

const bare = (text: string): string => text.replace(/^[+~−×-]\s*/u, '');

const fieldItem = (via: string, what: string, f?: Field): EditItem =>
  plainOf(what, { via, detail: f?.note });

function editedItems(view: View, c: ChangeOps, via: string): EditItem[] {
  return c.edited.flatMap((o) => {
    const [was, now] = [
      opAt(view.pair.from, c.change, o.fromIndex),
      opAt(view.pair.to, c.change, o.index),
    ];
    const target = targetOf(view, now);
    const moves = fieldMoves(was, now);
    const items = [
      ...moves.added.map((f) => fieldItem(via, `Adds the field \`${f.name}\` to ${target}`, f)),
      ...moves.removed.map((f) =>
        fieldItem(via, `Removes the field \`${f.name}\` from ${target}`, f),
      ),
      ...moves.edited.map((f) => fieldItem(via, `Changes the field \`${f.name}\` on ${target}`, f)),
    ];
    return items.length === 0 ? [fieldItem(via, `Changes ${target}`)] : items;
  });
}

/** What an op added to a change that already existed, by its kind. */
function addedWhat(view: View, op: unknown, summary: string): string {
  const add = prop(op, 'add');
  if (add === 'field') {
    const into = prop(op, 'into');
    const name = prop(prop(op, 'value'), 'name');
    const where = typeof into === 'string' ? refText(view, into.split('#')[0] ?? into) : '';
    return `Adds the field \`${typeof name === 'string' ? name : ''}\` to ${where}`;
  }
  if (add === 'step') {
    const action = prop(prop(op, 'value'), 'action');
    return `Adds a step: ${typeof action === 'string' ? unmark(action) : bare(summary)}`;
  }
  return typeof add === 'string'
    ? `Adds the ${add} ${targetOf(view, op)}`
    : `Adds ${bare(summary)}`;
}

/** The edits one changed change makes, one per field or op. */
function changedItems(view: View, c: ChangeOps, via: string): EditItem[] {
  return [
    ...editedItems(view, c, via),
    ...c.added.map((o) =>
      plainOf(addedWhat(view, opAt(view.pair.to, c.change, o.index), o.summary), { via }),
    ),
    ...c.removed.map((o) => plainOf(`Removes a step: ${bare(o.summary)}`, { via })),
  ];
}

/** The edits the ops make, and the decisions, tests and work items already told as kin of a new change. */
export function opItems(view: View): {
  readonly items: readonly EditItem[];
  readonly taken: ReadonlySet<string>;
} {
  const taken = new Set<string>();
  const items = view.pair.diff.ops.flatMap((c) => {
    const via = refText(view, c.change);
    if (c.status === 'added') {
      const kin = kinOf(view, { change: c.change, via }, taken);
      for (const id of kin.ids) taken.add(id);
      return [kin.item];
    }
    if (c.status === 'removed') return [plainOf(`Drops the change ${via}`)];
    return changedItems(view, c, via);
  });
  return { items, taken };
}

/** A new change brings its own decision, test and work item: they read as one thing, not four. */
function kinOf(
  view: View,
  c: { readonly change: string; readonly via: string },
  taken: ReadonlySet<string>,
): { readonly item: EditItem; readonly ids: readonly string[] } {
  const { change, via } = c;
  const { diff, to } = view.pair;
  const own = findEntity(to, change);
  const mine = (id: string, key: string, link: string): boolean =>
    strings(prop(findEntity(to, id), key)).includes(link) && !taken.has(id);
  const kin = [
    ...(diff.entities.decisions?.added ?? [])
      .filter((id) => strings(prop(own, 'decisions')).includes(id) && !taken.has(id))
      .map((id) => ['decision', id] as const),
    ...(diff.entities.tests?.added ?? [])
      .filter((id) => mine(id, 'proves', change))
      .map((id) => ['test', id] as const),
    ...diff.workItems.added
      .filter((id) => mine(id, 'implements', change))
      .map((id) => ['work item', id] as const),
  ];
  const detail = kin.map(([word, id]) => `with the ${word} ${refText(view, id)}`).join('; ');
  return { item: plainOf(`Adds a new change: ${via}`, { detail }), ids: kin.map(([, id]) => id) };
}
