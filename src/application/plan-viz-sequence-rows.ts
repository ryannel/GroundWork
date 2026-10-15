import type { SequenceRow } from '@/application/plan/flow-sequence';

// Pass 1 of a sequence drawing: the model's rows (steps, replies, frames) as a list of cells, and the cells as a
// tree, a frame holding the cells and frames it encloses.

export type Draft =
  | { type: 'group'; tab: string }
  | { type: 'else'; text: string }
  | { type: 'enter'; to: string; label: string }
  | { type: 'trigger'; text: string }
  | { type: 'reply'; from: string; to: string; label: string; ref: string }
  | { type: 'step'; i: number; row: Extract<SequenceRow, { kind: 'step' }>; see: string | null };

export type Entry =
  { t: 'open'; frame: 'fails' | 'group' } | { t: 'close' } | { t: 'cell'; draft: Draft };

const groupTab = (beat: string | null, shared: string | null): string =>
  [beat, shared === null ? '' : 'from the same event source']
    .filter((x) => x !== '' && x !== null)
    .join(' · ');

/** The screen the person sees after each step, by step index. */
function screensSeen(rows: readonly SequenceRow[]): Map<number, string> {
  const seen = new Map<number, string>();
  for (const r of rows) if (r.kind === 'note' && r.on === 'person') seen.set(r.at, r.screen);
  return seen;
}

function entriesFor(r: SequenceRow, seen: ReadonlyMap<number, string>): Entry[] {
  switch (r.kind) {
    case 'note': {
      return r.on === 'first' ? [{ t: 'cell', draft: { type: 'trigger', text: r.text } }] : [];
    }
    case 'open': {
      return r.frame === 'group'
        ? [
            { t: 'open', frame: 'group' },
            { t: 'cell', draft: { type: 'group', tab: groupTab(r.beat, r.sharedSource) } },
          ]
        : [{ t: 'open', frame: 'fails' }];
    }
    case 'close': {
      return r.frame === 'fails'
        ? [{ t: 'cell', draft: { type: 'else', text: r.text } }, { t: 'close' }]
        : [{ t: 'close' }];
    }
    case 'enter': {
      return [{ t: 'cell', draft: { type: 'enter', to: r.to, label: r.label } }];
    }
    case 'reply': {
      return [{ t: 'cell', draft: { ...r, type: 'reply' } }];
    }
    case 'step': {
      return [{ t: 'cell', draft: { type: 'step', i: r.i, row: r, see: seen.get(r.i) ?? null } }];
    }
  }
}

/** The rows as an ordered list of cells, with a frame's opening and closing between them. */
export function entriesOf(rows: readonly SequenceRow[]): Entry[] {
  const seen = screensSeen(rows);
  return rows.flatMap((r) => entriesFor(r, seen));
}

/** The cells of the list, numbered from 0 in the order they are drawn. */
export const cellsOf = (entries: readonly Entry[]): Draft[] =>
  entries.flatMap((e) => (e.t === 'cell' ? [e.draft] : []));

export interface FrameOf<C> {
  readonly kind: 'frame';
  readonly frame: 'fails' | 'group';
  readonly items: readonly Item<C>[];
}

export type Item<C> = C | FrameOf<C>;

interface Open<C> {
  frame: 'fails' | 'group';
  items: Item<C>[];
}

/** The list as a tree: each cell drawn by `draw` (given its number), each frame holding what it encloses. */
export function treeOf<C>(
  entries: readonly Entry[],
  draw: (draft: Draft, k: number) => C,
): Item<C>[] {
  const root: Open<C> = { frame: 'group', items: [] };
  const stack: Open<C>[] = [root];
  const top = (): Open<C> => stack.at(-1) ?? root;
  let k = 0;
  for (const e of entries) {
    if (e.t === 'open') {
      stack.push({ frame: e.frame, items: [] });
    } else if (e.t === 'close') {
      const done = stack.length > 1 ? stack.pop() : undefined;
      if (done !== undefined)
        top().items.push({ kind: 'frame', frame: done.frame, items: done.items });
    } else {
      top().items.push(draw(e.draft, k));
      k += 1;
    }
  }
  return root.items;
}
