import type { DomainMap, MapDomain, MapLink } from './landscape-domains';
import { linesOf, type MapBox, type MapLine } from './landscape-domains-lines';

export type { MapBox, MapLine } from './landscape-domains-lines';

// The map as one picture, read left to right: the customer, then the domains they use, then the domains those
// rely on, and so on. Each domain is a box with the people who work in it as chips inside; a line between two boxes
// stands for everything that runs between them.

export interface MapDrawing {
  readonly width: number;
  readonly height: number;
  readonly boxes: readonly MapBox[];
  readonly lines: readonly MapLine[];
}

const SIZE = {
  pad: 32,
  domain: 288,
  customer: 200,
  head: 104,
  chip: 26,
  chipGap: 6,
  inner: 16,
  stack: 24,
  gap: 136,
  /** Room on the right for a line that loops between two domains in the last column. */
  loop: 72,
} as const;

/** How wide a person's chip is drawn, from the length of their name. */
const chipWidth = (name: string): number => 20 + name.length * 7;

/** How many rows a domain's chips take, wrapped to the box's width. */
export function chipRows(names: readonly string[]): number {
  const room = SIZE.domain - 2 * SIZE.inner;
  let rows = 0;
  let used = room;
  for (const name of names) {
    const w = Math.min(room, chipWidth(name));
    if (used + SIZE.chipGap + w > room) {
      rows += 1;
      used = w;
    } else used += SIZE.chipGap + w;
  }
  return rows;
}

function domainHeight(domain: MapDomain, names: ReadonlyMap<string, string>): number {
  const rows = chipRows(domain.people.map((id) => names.get(id) ?? id));
  return SIZE.head + (rows === 0 ? 0 : rows * (SIZE.chip + SIZE.chipGap) + SIZE.chipGap);
}

/** Who relies on whom, among the domains: the edges from the leaning end to the other. */
function leaningEdges(links: readonly MapLink[], domains: ReadonlySet<string>): [string, string][] {
  return links.flatMap((l): [string, string][] => {
    if (!domains.has(l.a) || !domains.has(l.b) || l.leans === 'both') return [];
    return [l.leans === 'a' ? [l.a, l.b] : [l.b, l.a]];
  });
}

/** Each domain's column: the longest chain of reliance that reaches it, with loops broken where first met. */
export function columnsOf(map: DomainMap): ReadonlyMap<string, number> {
  const ids = map.domains.map((d) => d.id);
  const edges = leaningEdges(map.links, new Set(ids));
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const [from, to] of edges) out.get(from)?.push(to);
  const used = new Set(map.people.filter((p) => p.customer).flatMap((p) => p.domains));
  const order = [...ids.filter((id) => used.has(id)), ...ids.filter((id) => !used.has(id))];
  const state = new Map<string, 'open' | 'done'>();
  const finished: string[] = [];
  const kept: [string, string][] = [];
  const visit = (id: string): void => {
    state.set(id, 'open');
    for (const next of out.get(id) ?? []) {
      if (state.get(next) === 'open') continue;
      kept.push([id, next]);
      if (state.get(next) !== 'done') visit(next);
    }
    state.set(id, 'done');
    finished.push(id);
  };
  for (const id of order) if (!state.has(id)) visit(id);
  const column = new Map(ids.map((id) => [id, 0]));
  for (const id of finished.toReversed()) {
    for (const [from, to] of kept) {
      if (from === id) column.set(to, Math.max(column.get(to) ?? 0, (column.get(id) ?? 0) + 1));
    }
  }
  return column;
}

/** The domains in each column, each column ordered by where its neighbours to the left sit. */
function stacked(map: DomainMap, column: ReadonlyMap<string, number>): MapDomain[][] {
  const count = Math.max(0, ...column.values()) + 1;
  const cols: MapDomain[][] = Array.from({ length: count }, () => []);
  for (const d of map.domains) cols[column.get(d.id) ?? 0]?.push(d);
  const rank = new Map<string, number>();
  for (const [i, person] of map.people.filter((p) => p.customer).entries()) rank.set(person.id, i);
  return cols.map((col) => {
    const scored = col.map((d, at) => {
      const near = map.links
        .filter((l) => l.a === d.id || l.b === d.id)
        .flatMap((l) => rank.get(l.a === d.id ? l.b : l.a) ?? []);
      const score = near.length === 0 ? Infinity : near.reduce((x, y) => x + y, 0) / near.length;
      return { d, at, score };
    });
    const ordered = scored
      .toSorted((p, q) => (p.score === q.score ? p.at - q.at : p.score - q.score))
      .map((s) => s.d);
    for (const [i, d] of ordered.entries()) rank.set(d.id, i);
    return ordered;
  });
}

function placeDomains(
  map: DomainMap,
  left: number,
): { readonly boxes: readonly MapBox[]; readonly right: number; readonly bottom: number } {
  const names = new Map(map.people.map((p) => [p.id, p.name]));
  const cols = stacked(map, columnsOf(map));
  const heights = cols.map((col) =>
    col.reduce((sum, d, i) => sum + domainHeight(d, names) + (i === 0 ? 0 : SIZE.stack), 0),
  );
  const tallest = Math.max(0, ...heights);
  const boxes = cols.flatMap((col, c) => {
    const x = left + c * (SIZE.domain + SIZE.gap);
    let y = SIZE.pad + (tallest - (heights[c] ?? 0)) / 2;
    return col.map((d): MapBox => {
      const h = domainHeight(d, names);
      const box = { id: d.id, kind: 'domain' as const, x, y, w: SIZE.domain, h };
      y += h + SIZE.stack;
      return box;
    });
  });
  const right = left + Math.max(0, cols.length) * (SIZE.domain + SIZE.gap) - SIZE.gap;
  return { boxes, right, bottom: SIZE.pad + tallest };
}

/** The customers down the left, each level with the middle of the domains they use. */
function placeCustomers(map: DomainMap, domains: readonly MapBox[]): MapBox[] {
  const at = new Map(domains.map((b) => [b.id, b.y + b.h / 2]));
  const h = SIZE.head;
  let floor = SIZE.pad;
  return map.people
    .filter((p) => p.customer)
    .map((p) => {
      const ys = p.domains.flatMap((d) => at.get(d) ?? []);
      const want = ys.length === 0 ? floor : ys.reduce((a, b) => a + b, 0) / ys.length - h / 2;
      const y = Math.max(floor, want);
      floor = y + h + SIZE.stack;
      return { id: p.id, kind: 'customer' as const, x: SIZE.pad, y, w: SIZE.customer, h };
    });
}

/** The whole map: where every box sits and the line between each pair that work runs between. */
export function drawDomainMap(map: DomainMap): MapDrawing {
  const customers = map.people.some((p) => p.customer);
  const left = SIZE.pad + (customers ? SIZE.customer + SIZE.gap : 0);
  const placed = placeDomains(map, left);
  const people = placeCustomers(map, placed.boxes);
  const boxes = [...people, ...placed.boxes];
  const bottom = Math.max(placed.bottom, ...people.map((b) => b.y + b.h));
  return {
    width: Math.max(placed.right, SIZE.pad + SIZE.customer) + SIZE.pad + SIZE.loop,
    height: bottom + SIZE.pad,
    boxes,
    lines: linesOf(map.links, boxes),
  };
}
