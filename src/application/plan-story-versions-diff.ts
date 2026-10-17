export interface DiffRun {
  readonly text: string;
  readonly mark: 'same' | 'ins' | 'del';
}

export interface WordDiff {
  readonly was: readonly DiffRun[];
  readonly now: readonly DiffRun[];
}

const MAX_CELLS = 40_000;
const SPACE = /^\s*$/u;

function merged(items: readonly DiffRun[]): DiffRun[] {
  const runs: DiffRun[] = [];
  for (const item of items) {
    const last = runs.at(-1);
    if (last?.mark === item.mark) {
      runs[runs.length - 1] = { mark: item.mark, text: last.text + item.text };
    } else runs.push(item);
  }
  return runs;
}

/** How long the words run that both texts share from i and j on, as a flat table. */
function shared(a: readonly string[], b: readonly string[]): (i: number, j: number) => number {
  const width = b.length + 1;
  const table = new Uint16Array((a.length + 1) * width);
  const at = (i: number, j: number): number => table[i * width + j] ?? 0;
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  return at;
}

type Move = 'same' | 'ins' | 'del';

/** What the walk does at word i of the old text and word j of the new. */
function moveAt(a: readonly string[], b: readonly string[], at: (i: number, j: number) => number) {
  return (i: number, j: number): Move => {
    if (i < a.length && j < b.length && a[i] === b[j]) return 'same';
    return j < b.length && (i >= a.length || at(i, j + 1) >= at(i + 1, j)) ? 'ins' : 'del';
  };
}

const markOf = (word: string, mark: 'ins' | 'del'): DiffRun['mark'] =>
  SPACE.test(word) ? 'same' : mark;

/** The runs one move adds to the old text and to the new. */
function runsOf(
  how: Move,
  x: string,
  y: string,
): { readonly old: readonly DiffRun[]; readonly fresh: readonly DiffRun[] } {
  if (how === 'same') {
    return { old: [{ mark: 'same', text: x }], fresh: [{ mark: 'same', text: y }] };
  }
  if (how === 'ins') return { old: [], fresh: [{ mark: markOf(y, 'ins'), text: y }] };
  return { old: [{ mark: markOf(x, 'del'), text: x }], fresh: [] };
}

/** Word-level diff: the old text with the removed words marked, the new with the added words marked. */
export function wordDiff(was: string, now: string): WordDiff {
  const a = was.split(/(\s+)/u);
  const b = now.split(/(\s+)/u);
  if (a.length * b.length > MAX_CELLS) {
    return { was: [{ mark: 'del', text: was }], now: [{ mark: 'ins', text: now }] };
  }
  const move = moveAt(a, b, shared(a, b));
  const [old, fresh]: [DiffRun[], DiffRun[]] = [[], []];
  let [i, j] = [0, 0];
  while (i < a.length || j < b.length) {
    const how = move(i, j);
    const runs = runsOf(how, a[i] ?? '', b[j] ?? '');
    old.push(...runs.old);
    fresh.push(...runs.fresh);
    i += how === 'ins' ? 0 : 1;
    j += how === 'del' ? 0 : 1;
  }
  return { was: merged(old), now: merged(fresh) };
}
