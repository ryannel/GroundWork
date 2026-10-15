import { prop } from '@/application/plan/ids';
import { findEntity } from '@/application/plan/revision-view';
import { type EditItem, plainOf } from '@/application/plan-story-versions-edit-item';
import { opItems } from '@/application/plan-story-versions-edit-ops';
import { refText, type View } from '@/application/plan-story-versions-pair';
import { unmark } from '@/application/plan-story-versions-words';

// Everything that differs between two versions of a plan, one plain sentence each.

const kindOf = (key: string): string =>
  key.replaceAll('_', ' ').replace(/ies$/, 'y').replace(/s$/, '');

const isScalar = (x: unknown): boolean =>
  x === null || x === undefined || ['string', 'number', 'boolean'].includes(typeof x);

const short = (x: unknown): string =>
  typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean'
    ? String(x).replaceAll(/\s+/g, ' ').trim()
    : '';

/** What one changed key of one entity says, and the before and after when both are plain values. */
function keyItem(view: View, at: { key: string; id: string }, k: string): EditItem {
  const { key, id } = at;
  const [was, now] = [findEntity(view.pair.from, id), findEntity(view.pair.to, id)];
  const [a, b] = [prop(was, k), prop(now, k)];
  const scalar = isScalar(a) && isScalar(b);
  if ((k === 'title' || k === 'name') && scalar) {
    return plainOf(`Renames a ${kindOf(key)}`, { was: unmark(short(a)), now: refText(view, id) });
  }
  const what = `Changes the ${k.replaceAll('_', ' ')} of the ${kindOf(key)} ${refText(view, id)}`;
  return scalar
    ? plainOf(what, {
        was: short(a) === '' ? 'none' : short(a),
        now: short(b) === '' ? 'none' : short(b),
      })
    : plainOf(what);
}

function entityItems(view: View, taken: ReadonlySet<string>): EditItem[] {
  return Object.entries(view.pair.diff.entities).flatMap(([key, e]) => {
    const kind = kindOf(key);
    const listed = !['changes', 'work_items', 'questions'].includes(key);
    return [
      ...(listed ? e.added.filter((id) => !taken.has(id)) : []).map((id) =>
        plainOf(`Adds the ${kind} ${refText(view, id)}`),
      ),
      ...(listed ? e.removed : []).map((id) => plainOf(`Removes the ${kind} ${refText(view, id)}`)),
      ...e.changed.flatMap((c) => c.keys.map((k) => keyItem(view, { key, id: c.id }, k))),
    ];
  });
}

function workItems(view: View, taken: ReadonlySet<string>): EditItem[] {
  const w = view.pair.diff.workItems;
  const none = (id: string | null): string => (id === null ? 'none' : refText(view, id));
  return [
    ...w.added
      .filter((id) => !taken.has(id))
      .map((id) => plainOf(`Adds the work item ${refText(view, id)}`)),
    ...w.removed.map((id) => plainOf(`Drops the work item ${refText(view, id)}`)),
    ...w.remilestoned.map((r) =>
      plainOf(`Moves the work item ${refText(view, r.id)} to another milestone`, {
        detail: `${none(r.from)} → ${none(r.to)}`,
      }),
    ),
  ];
}

function questionItems(view: View): EditItem[] {
  const q = view.pair.diff.questions;
  const verbs = [
    ['Opens', q.opened],
    ['Resolves', q.resolved],
    ['Reopens', q.reopened],
  ] as const;
  return verbs.flatMap(([verb, ids]) =>
    ids.map((id) => plainOf(`${verb} the question ${refText(view, id)}`)),
  );
}

function milestoneItems(view: View): EditItem[] {
  return view.pair.diff.milestones.moved.map((m) => {
    const what = `Moves the milestone ${refText(view, m.id)}`;
    if (m.fromDue === m.toDue) {
      return plainOf(what, {
        detail: `position ${String(m.fromIndex + 1)} → ${String(m.toIndex + 1)}`,
      });
    }
    return plainOf(what, { was: m.fromDue ?? 'none', now: m.toDue ?? 'none' });
  });
}

/** Every edit between the two versions, in plain sentences. */
export function editItems(view: View): EditItem[] {
  const taken = new Set<string>();
  const ops = opItems(view, taken);
  return [
    ...ops,
    ...entityItems(view, taken),
    ...workItems(view, taken),
    ...questionItems(view),
    ...milestoneItems(view),
  ];
}
