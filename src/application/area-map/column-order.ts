interface Link {
  readonly from: string;
  readonly to: string;
}

type Positions = ReadonlyMap<string, number>;

function positionsOf(
  columns: readonly (readonly { readonly id: string }[])[],
): Map<string, number> {
  return new Map(columns.flatMap((column) => column.map((node, index) => [node.id, index])));
}

function barycentre(
  id: string,
  neighbours: ReadonlyMap<string, readonly string[]>,
  positions: Positions,
) {
  const placed = (neighbours.get(id) ?? [])
    .map((other) => positions.get(other))
    .filter((value): value is number => value !== undefined);
  return placed.length === 0
    ? (positions.get(id) ?? 0)
    : placed.reduce((total, value) => total + value, 0) / placed.length;
}

/** Lines between neighbouring columns that cross one another. */
export function crossings(
  columns: readonly (readonly { readonly id: string }[])[],
  links: readonly Link[],
): number {
  const positions = positionsOf(columns);
  const rank = new Map(columns.flatMap((column, index) => column.map((node) => [node.id, index])));
  const spans = links.flatMap((link) => {
    const [a, b] = [rank.get(link.from), rank.get(link.to)];
    if (a === undefined || b === undefined || Math.abs(a - b) !== 1) return [];
    const [left, right] = a < b ? [link.from, link.to] : [link.to, link.from];
    return [
      { gap: Math.min(a, b), left: positions.get(left) ?? 0, right: positions.get(right) ?? 0 },
    ];
  });
  let count = 0;
  for (const [index, one] of spans.entries()) {
    for (const other of spans.slice(index + 1)) {
      if (one.gap === other.gap && (one.left - other.left) * (one.right - other.right) < 0) {
        count += 1;
      }
    }
  }
  return count;
}

function neighbourMap(links: readonly Link[], side: 'from' | 'to'): ReadonlyMap<string, string[]> {
  const map = new Map<string, string[]>();
  for (const link of links) {
    const [own, other] = side === 'to' ? [link.to, link.from] : [link.from, link.to];
    map.set(own, [...(map.get(own) ?? []), other]);
  }
  return map;
}

/**
 * Order each column by the mean position of its neighbours, sweeping right then left so connected
 * cards line up, and keep whichever pass crosses the fewest lines.
 */
export function orderColumns<T extends { readonly id: string }>(
  initial: readonly (readonly T[])[],
  links: readonly Link[],
  passes = 8,
): readonly (readonly T[])[] {
  const callers = neighbourMap(links, 'to');
  const callees = neighbourMap(links, 'from');
  const columns = initial.map((column) => [...column]);
  let best = initial;
  let fewest = crossings(initial, links);
  const sortColumn = (rank: number, neighbours: ReadonlyMap<string, readonly string[]>): void => {
    const positions = positionsOf(columns);
    columns[rank]?.sort(
      (a, b) => barycentre(a.id, neighbours, positions) - barycentre(b.id, neighbours, positions),
    );
  };
  for (let pass = 0; pass < passes && fewest > 0; pass += 1) {
    for (let rank = 1; rank < columns.length; rank += 1) sortColumn(rank, callers);
    for (let rank = columns.length - 2; rank >= 0; rank -= 1) sortColumn(rank, callees);
    const count = crossings(columns, links);
    if (count < fewest) {
      fewest = count;
      best = columns.map((column) => [...column]);
    }
  }
  return best;
}
