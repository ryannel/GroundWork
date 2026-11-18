import type { AreaSystemSize } from '@/application/area-system-layout';

interface Connection {
  readonly from: string;
  readonly to: string;
  readonly weight: number;
}

interface Spacing {
  readonly horizontal: number;
  readonly vertical: number;
  readonly margin: number;
}

interface PlacedCard extends AreaSystemSize {
  readonly x: number;
  readonly y: number;
}

interface Cell {
  readonly column: number;
  readonly row: number;
}

function pairWeights(cards: readonly AreaSystemSize[], connections: readonly Connection[]) {
  const indices = new Map(cards.map(({ id }, index) => [id, index]));
  const weights = new Map<number, number>();
  for (const { from, to, weight } of connections) {
    const a = indices.get(from);
    const b = indices.get(to);
    if (a === undefined || b === undefined || a === b || weight <= 0) continue;
    const key = Math.min(a, b) * cards.length + Math.max(a, b);
    weights.set(key, Math.max(weights.get(key) ?? 0, weight));
  }
  return [...weights]
    .toSorted(([a], [b]) => a - b)
    .map(([key, weight]) => ({
      from: Math.floor(key / cards.length),
      to: key % cards.length,
      weight,
    }));
}

type WeightedPair = ReturnType<typeof pairWeights>[number];

function distance(a: Cell, b: Cell, pitch: Spacing): number {
  return (
    Math.abs(a.column - b.column) * pitch.horizontal + Math.abs(a.row - b.row) * pitch.vertical
  );
}

const ORIGIN = { column: 0, row: 0 };

function improve(
  input: readonly Cell[],
  incident: readonly (readonly WeightedPair[])[],
  pitch: Spacing,
): Cell[] {
  const cells = [...input];
  const move = (index: number, other: number, before: Cell, after: Cell) =>
    (incident[index] ?? []).reduce((delta, pair) => {
      const neighbour = pair.from === index ? pair.to : pair.from;
      if (neighbour === other) return delta;
      const cell = cells[neighbour] ?? ORIGIN;
      return delta + pair.weight * (distance(after, cell, pitch) - distance(before, cell, pitch));
    }, 0);
  for (const [a] of cells.entries()) {
    for (const [offset, next] of cells.slice(a + 1, a + 48).entries()) {
      const b = a + 1 + offset;
      const previous = cells[a] ?? ORIGIN;
      if (move(a, b, previous, next) + move(b, a, next, previous) >= 0) continue;
      cells[a] = next;
      cells[b] = previous;
    }
  }
  return cells;
}

function optimise(input: readonly Cell[], pairs: readonly WeightedPair[], pitch: Spacing) {
  const incident = input.map((_, index) =>
    pairs.filter(({ from, to }) => from === index || to === index),
  );
  let cells = input;
  for (let pass = 0; pass < 5; pass += 1) {
    const improved = improve(cells, incident, pitch);
    if (improved.every((cell, index) => cell === cells[index])) break;
    cells = improved;
  }
  const totalWeight = pairs.reduce((sum, pair) => sum + pair.weight, 0);
  const span =
    pairs.reduce(
      (sum, pair) =>
        sum + pair.weight * distance(cells[pair.from] ?? ORIGIN, cells[pair.to] ?? ORIGIN, pitch),
      0,
    ) / Math.max(1, totalWeight);
  return { cells, span };
}

function offsets(sizes: readonly number[], gap: number, margin: number): readonly number[] {
  let next = margin;
  return sizes.map((size) => {
    const offset = next;
    next += size + gap;
    return offset;
  });
}

function place<T extends AreaSystemSize>(
  cards: readonly T[],
  cells: readonly Cell[],
  spacing: Spacing,
): (T & PlacedCard)[] {
  const widths = Array.from(
    { length: Math.max(-1, ...cells.map(({ column }) => column)) + 1 },
    () => 0,
  );
  const heights = Array.from({ length: Math.max(-1, ...cells.map(({ row }) => row)) + 1 }, () => 0);
  for (const [index, card] of cards.entries()) {
    const { column, row } = cells[index] ?? ORIGIN;
    widths[column] = Math.max(widths[column] ?? 0, card.width);
    heights[row] = Math.max(heights[row] ?? 0, card.height);
  }
  const xs = offsets(widths, spacing.horizontal, spacing.margin);
  const ys = offsets(heights, spacing.vertical, spacing.margin);
  return cards.map((card, index) => {
    const { column, row } = cells[index] ?? ORIGIN;
    return { ...card, x: xs[column] ?? spacing.margin, y: ys[row] ?? spacing.margin };
  });
}

/** Choose compact positions from the complete graph, using a deterministic search over card swaps. */
function compactCardLayouts<T extends AreaSystemSize>(
  input: readonly T[],
  connections: readonly Connection[],
  spacing: Spacing,
): readonly { readonly cards: readonly (T & PlacedCard)[]; readonly score: number }[] {
  if (input.length === 0) return [{ cards: [], score: 0 }];
  const cards = input.toSorted((a, b) => a.id.localeCompare(b.id));
  const pairs = pairWeights(cards, connections);
  const width = Math.max(...cards.map((card) => card.width));
  const height = Math.max(...cards.map((card) => card.height));
  const pitch = {
    ...spacing,
    horizontal: width + spacing.horizontal,
    vertical: height + spacing.vertical,
  };
  const aspect = 1.8;
  const target = Math.round(Math.sqrt((cards.length * aspect * pitch.vertical) / pitch.horizontal));
  const options = new Set(
    [-1, 0, 1].map((delta) => Math.max(1, Math.min(cards.length, target + delta))),
  );
  return [...options]
    .flatMap((columns) =>
      [0, 1, 2, 3].map((seed) => {
        const rows = Math.ceil(cards.length / columns);
        const cells = cards.map((_, index) => ({
          column: index % columns,
          row: Math.floor(index / columns),
        }));
        const boxWidth = columns * pitch.horizontal - spacing.horizontal + spacing.margin * 2;
        const boxHeight = rows * pitch.vertical - spacing.vertical + spacing.margin * 2;
        const fit = Math.max(boxWidth / aspect, boxHeight);
        const columnMajor = cells.toSorted((a, b) =>
          a.column === b.column ? a.row - b.row : a.column - b.column,
        );
        const order = seed % 2 === 0 ? cells : columnMajor;
        const offset = seed < 2 ? 0 : Math.floor(order.length / 3);
        const optimised = optimise(
          [...order.slice(offset), ...order.slice(0, offset)],
          pairs,
          pitch,
        );
        return { cards: place(cards, optimised.cells, spacing), score: fit + optimised.span * 0.5 };
      }),
    )
    .toSorted((a, b) => a.score - b.score);
}

export function layoutCompactCards<T extends AreaSystemSize>(
  input: readonly T[],
  connections: readonly Connection[],
  spacing: Spacing,
  routingCost?: (cards: readonly (T & PlacedCard)[]) => number,
): readonly (T & PlacedCard)[] {
  const candidates = compactCardLayouts(input, connections, spacing);
  if (routingCost === undefined) return candidates[0]?.cards ?? [];
  const seen = new Set<string>();
  const distinct = candidates.filter(({ cards }) => {
    const key = JSON.stringify(cards.map(({ x, y }) => [x, y]));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return (
    distinct
      .slice(0, 8)
      .map(({ cards, score }) => ({ cards, score: score + routingCost(cards) }))
      .toSorted((a, b) => a.score - b.score)[0]?.cards ?? []
  );
}

/** Resize rows and columns while preserving the previously chosen cells. */
function resizeCompactCards<T extends PlacedCard>(cards: readonly T[], spacing: Spacing): T[] {
  const xs = [...new Set(cards.map(({ x }) => x))].toSorted((a, b) => a - b);
  const ys = [...new Set(cards.map(({ y }) => y))].toSorted((a, b) => a - b);
  return place(
    cards,
    cards.map(({ x, y }) => ({ column: xs.indexOf(x), row: ys.indexOf(y) })),
    spacing,
  );
}

function rectangleDistance(a: PlacedCard, b: PlacedCard): number {
  const horizontal = Math.max(0, a.x - b.x - b.width, b.x - a.x - a.width);
  const vertical = Math.max(0, a.y - b.y - b.height, b.y - a.y - a.height);
  return horizontal + vertical;
}

function fitsBeside(a: PlacedCard, b: PlacedCard, spacing: Spacing): boolean {
  const horizontal = Math.max(a.x - b.x - b.width, b.x - a.x - a.width);
  const vertical = Math.max(a.y - b.y - b.height, b.y - a.y - a.height);
  return horizontal >= spacing.horizontal || vertical >= spacing.vertical;
}

function frameSize(cards: readonly PlacedCard[]): number {
  const right = Math.max(0, ...cards.map(({ x, width }) => x + width));
  const bottom = Math.max(0, ...cards.map(({ y, height }) => y + height));
  return Math.max(right / 1.8, bottom);
}

function besideCandidates<T extends PlacedCard>(
  card: T,
  placed: readonly PlacedCard[],
  spacing: Spacing,
): readonly T[] {
  const xs = new Set([spacing.margin, card.x]);
  const ys = new Set([spacing.margin, card.y]);
  for (const box of placed) {
    xs.add(box.x);
    xs.add(box.x + box.width + spacing.horizontal);
    xs.add(box.x - card.width - spacing.horizontal);
    ys.add(box.y);
    ys.add(box.y + box.height + spacing.vertical);
    ys.add(box.y - card.height - spacing.vertical);
  }
  return [...xs].flatMap((x) =>
    [...ys].flatMap((y) => {
      if (x < spacing.margin || y < spacing.margin) return [];
      const candidate = { ...card, x, y };
      return placed.every((other) => fitsBeside(candidate, other, spacing)) ? [candidate] : [];
    }),
  );
}

function packBeside<T extends PlacedCard>(
  first: T,
  rest: readonly T[],
  connections: readonly Connection[],
  spacing: Spacing,
): readonly T[] {
  const placed = [first];
  for (const card of rest) {
    const linked = connections.flatMap(({ from, to, weight }) => {
      const peer = from === card.id ? to : from;
      if (from !== card.id && to !== card.id) return [];
      const box = placed.find(({ id }) => id === peer);
      return box === undefined ? [] : [{ box, weight }];
    });
    const weight = linked.reduce((sum, connection) => sum + connection.weight, 0);
    const cost = (candidate: T) =>
      frameSize([...placed, candidate]) * 0.6 +
      linked.reduce((sum, edge) => sum + rectangleDistance(candidate, edge.box) * edge.weight, 0) /
        Math.max(1, weight) +
      (Math.abs(candidate.x - card.x) + Math.abs(candidate.y - card.y)) * 0.08;
    const candidates = besideCandidates(card, placed, spacing);
    const next = candidates
      .map((box) => ({ box, cost: cost(box) }))
      .toSorted((a, b) => a.cost - b.cost)[0];
    if (next !== undefined) placed.push(next.box);
  }
  const positions = new Map(placed.map((card) => [card.id, card]));
  return [first, ...rest].map((card) => positions.get(card.id) ?? card);
}

function compactAxis<T extends PlacedCard>(
  cards: readonly T[],
  anchor: string,
  spacing: Spacing,
  axis: 'x' | 'y',
): readonly T[] {
  const placed = cards.toSorted((a, b) => a[axis] - b[axis]);
  const extent = axis === 'x' ? 'width' : 'height';
  const gap = axis === 'x' ? spacing.horizontal : spacing.vertical;
  for (const [index, card] of placed.entries()) {
    if (card.id === anchor) continue;
    const obstacles = placed.filter(({ id }) => id !== card.id);
    const positions = [spacing.margin, ...obstacles.map((box) => box[axis] + box[extent] + gap)];
    const next = positions
      .toSorted((a, b) => a - b)
      .find(
        (position) =>
          position < card[axis] &&
          obstacles.every((other) => fitsBeside({ ...card, [axis]: position }, other, spacing)),
      );
    if (next !== undefined) placed[index] = { ...card, [axis]: next };
  }
  return placed;
}

function connectionSpan(cards: readonly PlacedCard[], connections: readonly Connection[]): number {
  const byId = new Map(cards.map((card) => [card.id, card]));
  let span = 0;
  let weight = 0;
  for (const edge of connections) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (from === undefined || to === undefined) continue;
    span += rectangleDistance(from, to) * edge.weight;
    weight += edge.weight;
  }
  return span / Math.max(1, weight);
}

/** Pack around the actual size of expanded cards instead of widening complete rows and columns. */
export function layoutExpandedCards<T extends PlacedCard>(
  cards: readonly T[],
  connections: readonly Connection[],
  spacing: Spacing,
  routingCost: (cards: readonly T[]) => number = (layout) => connectionSpan(layout, connections),
): readonly T[] {
  const ordered = cards.toSorted((a, b) => b.width * b.height - a.width * a.height);
  const [largest, ...rest] = ordered;
  if (largest === undefined) return [];
  const proximity = new Map(
    rest.map(({ id }) => [
      id,
      connections
        .filter(
          ({ from, to }) =>
            (from === id && to === largest.id) || (to === id && from === largest.id),
        )
        .reduce((sum, edge) => sum + edge.weight, 0),
    ]),
  );
  const nearest = rest.toSorted((a, b) => (proximity.get(b.id) ?? 0) - (proximity.get(a.id) ?? 0));
  const anchors = [largest, { ...largest, x: spacing.margin }, { ...largest, y: spacing.margin }];
  const packed = anchors.flatMap((anchor) =>
    [nearest, rest].map((order) => packBeside(anchor, order, connections, spacing)),
  );
  const stretched = resizeCompactCards(cards, spacing);
  const left = compactAxis(stretched, largest.id, spacing, 'x');
  const top = compactAxis(stretched, largest.id, spacing, 'y');
  const candidates = [
    ...packed,
    left,
    top,
    compactAxis(left, largest.id, spacing, 'y'),
    compactAxis(top, largest.id, spacing, 'x'),
  ];
  return (
    candidates
      .map((layout) => ({ layout, cost: frameSize(layout) * 0.5 + routingCost(layout) }))
      .toSorted((a, b) => a.cost - b.cost)[0]?.layout ?? cards
  );
}
