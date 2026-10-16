// Where each box of a domain's diagram sits and how each line runs between them. People and the systems that only
// call in stand on the left, the domain's own systems in the middle in the order work moves through them, and the
// systems they call out to on the right.

export interface DraftBox {
  readonly id: string;
  readonly name: string;
  /** What it does, or for a system outside the domain, the domain it sits in. */
  readonly does: string;
  readonly href: string | null;
  /** The team's colour, 0 for none. */
  readonly slot: number;
}

interface DraftLink {
  readonly from: string;
  readonly to: string;
  readonly label: string;
}

export interface DiagramDraft {
  readonly here: readonly DraftBox[];
  readonly outside: readonly DraftBox[];
  readonly actors: readonly DraftBox[];
  readonly links: readonly DraftLink[];
}

export interface DiagramBox extends DraftBox {
  readonly kind: 'here' | 'outside' | 'actor';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface DiagramLine extends DraftLink {
  readonly id: string;
  /** The line as an svg path. */
  readonly d: string;
  /** Where its label sits. */
  readonly lx: number;
  readonly ly: number;
}

export interface DomainDiagram {
  readonly boxes: readonly DiagramBox[];
  readonly lines: readonly DiagramLine[];
  readonly w: number;
  readonly h: number;
}

const W = 200;
const H = 76;
const GAP_X = 88;
const GAP_Y = 20;

/** How far along the work each of the domain's systems sits; a loop is cut where it closes. */
function layersOf(ids: readonly string[], links: readonly DraftLink[]): Map<string, number> {
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const l of links) if (out.has(l.to)) out.get(l.from)?.push(l.to);
  const state = new Map<string, 'open' | 'done'>();
  const kept: (readonly [string, string])[] = [];
  const visit = (id: string): void => {
    state.set(id, 'open');
    for (const next of out.get(id) ?? []) {
      if (state.get(next) === 'open') continue;
      kept.push([id, next]);
      if (!state.has(next)) visit(next);
    }
    state.set(id, 'done');
  };
  for (const id of ids) if (!state.has(id)) visit(id);
  const into = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const [a, b] of kept) into.get(b)?.push(a);
  const memo = new Map<string, number>();
  const depth = (id: string): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    const found = Math.max(0, ...(into.get(id) ?? []).map((from) => depth(from) + 1));
    memo.set(id, found);
    return found;
  };
  return new Map(ids.map((id) => [id, depth(id)]));
}

function columnsOf(draft: DiagramDraft): Map<string, number> {
  const ids = draft.here.map((b) => b.id);
  const layer = layersOf(ids, draft.links);
  const last = Math.max(0, ...layer.values()) + 2;
  const callsIn = (id: string): boolean =>
    draft.links.some((l) => l.from === id) && !draft.links.some((l) => l.to === id);
  const column = new Map<string, number>([
    ...draft.actors.map((b) => [b.id, 0] as const),
    ...ids.map((id) => [id, (layer.get(id) ?? 0) + 1] as const),
    ...draft.outside.map((b) => [b.id, callsIn(b.id) ? 0 : last] as const),
  ]);
  const used = [...new Set(column.values())].toSorted((a, b) => a - b);
  return new Map([...column].map(([id, at]) => [id, used.indexOf(at)]));
}

function otherEnd(link: DraftLink, id: string): string[] {
  if (link.to === id) return [link.from];
  if (link.from === id) return [link.to];
  return [];
}

/** Each column's boxes, ordered so a box sits level with the boxes it is joined to on its left. */
function ordered(draft: DiagramDraft, column: ReadonlyMap<string, number>): string[][] {
  const all = [...draft.actors, ...draft.here, ...draft.outside].map((b) => b.id);
  const width = Math.max(0, ...column.values()) + 1;
  const cols: string[][] = Array.from({ length: width }, () => []);
  for (const id of all) cols[column.get(id) ?? 0]?.push(id);
  const row = new Map<string, number>();
  const key = (id: string, at: number, c: number): number => {
    const near = draft.links
      .flatMap((l) => otherEnd(l, id))
      .filter((n) => (column.get(n) ?? 0) < c)
      .map((n) => row.get(n) ?? 0);
    if (near.length === 0) return all.length + at;
    return near.reduce((a, b) => a + b, 0) / near.length;
  };
  return cols.map((ids, c) => {
    const sorted = ids
      .map((id, at) => ({ id, key: key(id, at, c) }))
      .toSorted((a, b) => a.key - b.key)
      .map((e) => e.id);
    for (const [at, id] of sorted.entries()) row.set(id, at);
    return sorted;
  });
}

function lineOf(link: DraftLink, a: DiagramBox, b: DiagramBox): DiagramLine {
  const ay = a.y + a.h / 2;
  const by = b.y + b.h / 2;
  const forward = b.x > a.x;
  const back = b.x < a.x;
  const x1 = back ? a.x : a.x + a.w;
  const x2 = forward ? b.x : b.x + b.w;
  const bend = Math.max(48, Math.abs(x2 - x1) / 2);
  const c1 = back ? x1 - bend : x1 + bend;
  const c2 = forward ? x2 - bend : x2 + bend;
  return {
    ...link,
    id: `${link.from}>${link.to}`,
    d: `M${String(x1)},${String(ay)} C${String(c1)},${String(ay)} ${String(c2)},${String(by)} ${String(x2)},${String(by)}`,
    lx: (x1 + 3 * c1 + 3 * c2 + x2) / 8,
    ly: (ay + by) / 2,
  };
}

/** Places every box and runs every line. */
export function layDiagram(draft: DiagramDraft): DomainDiagram {
  const column = columnsOf(draft);
  const cols = ordered(draft, column);
  const tallest = Math.max(1, ...cols.map((c) => c.length));
  const h = tallest * H + (tallest - 1) * GAP_Y;
  const kinds = [
    ...draft.actors.map((b) => ({ ...b, kind: 'actor' as const })),
    ...draft.here.map((b) => ({ ...b, kind: 'here' as const })),
    ...draft.outside.map((b) => ({ ...b, kind: 'outside' as const })),
  ];
  const boxes = cols.flatMap((ids, c) => {
    const top = (h - (ids.length * H + (ids.length - 1) * GAP_Y)) / 2;
    return ids.flatMap((id, r) => {
      const box = kinds.find((k) => k.id === id);
      if (box === undefined) return [];
      return [{ ...box, x: c * (W + GAP_X), y: top + r * (H + GAP_Y), w: W, h: H }];
    });
  });
  const at = new Map(boxes.map((b) => [b.id, b]));
  const lines = draft.links.flatMap((l) => {
    const a = at.get(l.from);
    const b = at.get(l.to);
    return a === undefined || b === undefined ? [] : [lineOf(l, a, b)];
  });
  return { boxes, lines, w: cols.length * W + (cols.length - 1) * GAP_X, h };
}
