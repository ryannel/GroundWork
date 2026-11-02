export interface RoutePoint {
  readonly x: number;
  readonly y: number;
}
export interface RouteBox extends RoutePoint {
  readonly width: number;
  readonly height: number;
}
export interface RoutePort {
  readonly point: RoutePoint;
  readonly exit: RoutePoint;
  readonly direction: number;
}
export interface RoutedLine {
  readonly points: readonly RoutePoint[];
}

const length = (a: RoutePoint, b: RoutePoint): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const same = (a: RoutePoint, b: RoutePoint): boolean => a.x === b.x && a.y === b.y;
const heading = (a: RoutePoint, b: RoutePoint): number => {
  if (a.x !== b.x) return b.x > a.x ? 0 : 2;
  return b.y > a.y ? 1 : 3;
};

function crosses(a: number, b: number, low: number, high: number): boolean {
  return Math.max(a, b) > low && Math.min(a, b) < high;
}

function crossesBox(a: RoutePoint, b: RoutePoint, box: RouteBox): boolean {
  if (a.y === b.y) {
    return a.y > box.y && a.y < box.y + box.height && crosses(a.x, b.x, box.x, box.x + box.width);
  }
  return a.x > box.x && a.x < box.x + box.width && crosses(a.y, b.y, box.y, box.y + box.height);
}

/** Card interiors and header text are obstacles, including the two endpoint cards. */
export function clearRouteSegment(
  a: RoutePoint,
  b: RoutePoint,
  boxes: readonly RouteBox[],
): boolean {
  if (a.x !== b.x && a.y !== b.y) return false;
  return !boxes.some((box) => crossesBox(a, b, box));
}

function between(before: RoutePoint, middle: RoutePoint, after: RoutePoint): boolean {
  const aligned = before.x === after.x || before.y === after.y;
  return aligned && length(before, after) === length(before, middle) + length(middle, after);
}

/** Only remove a point when it lies between its neighbours; never erase a reversal. */
export function simplifyRoute(points: readonly RoutePoint[]): readonly RoutePoint[] {
  const kept: RoutePoint[] = [];
  for (const point of points) {
    const last = kept.at(-1);
    const before = kept.at(-2);
    if (last !== undefined && same(last, point)) continue;
    if (last !== undefined && before !== undefined && between(before, last, point)) {
      kept.pop();
    }
    kept.push(point);
  }
  return kept;
}

function overlap(a: RoutePoint, b: RoutePoint, c: RoutePoint, d: RoutePoint): number {
  if (a.y === b.y && c.y === d.y && a.y === c.y) {
    return Math.max(
      0,
      Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) -
        Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)),
    );
  }
  if (a.x === b.x && c.x === d.x && a.x === c.x) {
    return Math.max(
      0,
      Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) -
        Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)),
    );
  }
  return 0;
}

function traffic(a: RoutePoint, b: RoutePoint, lines: readonly RoutedLine[]): number {
  const shared = lines.reduce(
    (sum, line) =>
      sum +
      line.points
        .slice(1)
        .reduce(
          (total, point, index) => total + overlap(a, b, line.points[index] ?? point, point),
          0,
        ),
    0,
  );
  // Short attachment stubs may share a port before the reserved corridors separate.
  return shared > 24 ? Math.min(240, 36 + (shared - 24) * 0.8) : 0;
}

/** Only collinear reserved segments can contribute congestion to a candidate segment. */
function trafficCost(lines: readonly RoutedLine[]) {
  const horizontal = new Map<number, RoutedLine[]>();
  const vertical = new Map<number, RoutedLine[]>();
  for (const line of lines) {
    for (const [index, point] of line.points.entries()) {
      const next = line.points[index + 1];
      if (next === undefined) continue;
      const rows = point.y === next.y ? horizontal : vertical;
      const at = point.y === next.y ? point.y : point.x;
      rows.set(at, [...(rows.get(at) ?? []), { points: [point, next] }]);
    }
  }
  return (a: RoutePoint, b: RoutePoint): number => {
    const rows = a.y === b.y ? horizontal : vertical;
    const at = a.y === b.y ? a.y : a.x;
    return traffic(a, b, rows.get(at) ?? []);
  };
}

function cost(points: readonly RoutePoint[], penalty: SearchSpace['penalty']): number {
  return points.slice(1).reduce(
    (sum, point, index) => {
      const previous = points[index] ?? point;
      return sum + length(previous, point) + penalty(previous, point);
    },
    Math.max(0, points.length - 2) * 36,
  );
}

interface RoutingSpace {
  readonly boxes: readonly RouteBox[];
  readonly lines: readonly RoutedLine[];
  readonly bounds: RouteBox;
}

interface SearchSpace extends RoutingSpace {
  readonly penalty: (a: RoutePoint, b: RoutePoint) => number;
}

function inside(point: RoutePoint, box: RouteBox): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

function reverses(points: readonly RoutePoint[]): boolean {
  return points.some((point, index) => {
    const before = points[index - 1];
    const after = points[index + 1];
    if (before === undefined || after === undefined) return false;
    return heading(point, after) === (heading(before, point) + 2) % 4;
  });
}

function valid(points: readonly RoutePoint[], space: SearchSpace): boolean {
  if (points.length < 2 || reverses(points)) return false;
  return (
    points.every((point) => inside(point, space.bounds)) &&
    points
      .slice(1)
      .every((point, index) => clearRouteSegment(points[index] ?? point, point, space.boxes))
  );
}

/** Try the fewest-turn corridors first. These cover adjacent cards and ordinary fan-out without a maze search. */
function candidates(
  start: RoutePoint,
  end: RoutePoint,
  space: SearchSpace,
): readonly (readonly RoutePoint[])[] {
  const xs = [start.x, end.x, (start.x + end.x) / 2];
  const ys = [start.y, end.y, (start.y + end.y) / 2];
  for (const box of space.boxes) {
    xs.push(box.x - 16, box.x + box.width + 16);
    ys.push(box.y - 16, box.y + box.height + 16);
  }
  // A bounded set of nearby lanes avoids multiplying the grid by every prior route.
  for (const x of [start.x, end.x, (start.x + end.x) / 2]) xs.push(x - 14, x + 14);
  for (const y of [start.y, end.y, (start.y + end.y) / 2]) ys.push(y - 14, y + 14);
  return [
    ...[...new Set(xs)].map((x) => [start, { x, y: start.y }, { x, y: end.y }, end]),
    ...[...new Set(ys)].map((y) => [start, { x: start.x, y }, { x: end.x, y }, end]),
  ];
}

interface Visit {
  readonly point: RoutePoint;
  readonly direction: number;
  readonly cost: number;
  readonly previous: Visit | null;
}
const key = (point: RoutePoint, direction: number): string =>
  `${String(point.x)},${String(point.y)},${String(direction)}`;

function unwind(visit: Visit): readonly RoutePoint[] {
  const points: RoutePoint[] = [];
  let current: Visit | null = visit;
  while (current !== null) {
    points.push(current.point);
    current = current.previous;
  }
  return points.toReversed();
}

function neighbours(
  point: RoutePoint,
  xs: readonly number[],
  ys: readonly number[],
): readonly RoutePoint[] {
  const x = xs.indexOf(point.x);
  const y = ys.indexOf(point.y);
  return [
    { x: xs[x - 1], y: point.y },
    { x: xs[x + 1], y: point.y },
    { x: point.x, y: ys[y - 1] },
    { x: point.x, y: ys[y + 1] },
  ].flatMap((candidate) =>
    candidate.x === undefined || candidate.y === undefined
      ? []
      : [{ x: candidate.x, y: candidate.y }],
  );
}

function advance(current: Visit, next: RoutePoint, space: SearchSpace): Visit | null {
  const direction = heading(current.point, next);
  if (direction === (current.direction + 2) % 4) return null;
  if (!clearRouteSegment(current.point, next, space.boxes)) return null;
  const nextCost =
    current.cost +
    length(current.point, next) +
    (direction === current.direction ? 0 : 36) +
    space.penalty(current.point, next);
  return { point: next, direction, cost: nextCost, previous: current };
}

interface SearchGrid {
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  readonly space: SearchSpace;
}

function nextVisits(
  current: Visit,
  grid: SearchGrid,
  costs: ReadonlyMap<string, number>,
): readonly Visit[] {
  return neighbours(current.point, grid.xs, grid.ys).flatMap((point) => {
    const visit = advance(current, point, grid.space);
    if (visit === null) return [];
    return visit.cost < (costs.get(key(visit.point, visit.direction)) ?? Infinity) ? [visit] : [];
  });
}

/** A local binary heap keeps fallback search logarithmic in its open frontier. */
function frontier(target: RoutePoint) {
  const heap: Visit[] = [];
  const score = (visit: Visit): number => visit.cost + length(visit.point, target);
  const push = (visit: Visit): void => {
    heap.push(visit);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      const item = heap[parent];
      if (item === undefined || score(item) <= score(visit)) break;
      heap[index] = item;
      index = parent;
    }
    heap[index] = visit;
  };
  const pop = (): Visit | undefined => {
    const first = heap[0];
    const tail = heap.pop();
    if (tail === undefined || heap.length === 0) return first;
    let index = 0;
    while (index * 2 + 1 < heap.length) {
      const left = index * 2 + 1;
      const right = left + 1;
      const rightItem = heap[right];
      const leftItem = heap[left];
      const child =
        rightItem !== undefined && leftItem !== undefined && score(rightItem) < score(leftItem)
          ? right
          : left;
      const item = heap[child];
      if (item === undefined || score(tail) <= score(item)) break;
      heap[index] = item;
      index = child;
    }
    heap[index] = tail;
    return first;
  };
  return { push, pop, empty: () => heap.length === 0 };
}

/** The incoming direction belongs to the search state: arriving cheaply from the wrong side is not equivalent. */
function search(start: RoutePort, end: RoutePort, space: SearchSpace): readonly RoutePoint[] {
  const points = candidates(start.exit, end.exit, space)
    .flat()
    .filter((point) => inside(point, space.bounds));
  const grid: SearchGrid = {
    xs: [...new Set(points.map((point) => point.x))].toSorted((a, b) => a - b),
    ys: [...new Set(points.map((point) => point.y))].toSorted((a, b) => a - b),
    space,
  };
  const pending = frontier(end.exit);
  pending.push({ point: start.exit, direction: start.direction, cost: 0, previous: null });
  const costs = new Map([[key(start.exit, start.direction), 0]]);
  while (!pending.empty()) {
    const current = pending.pop();
    if (
      current === undefined ||
      current.cost !== costs.get(key(current.point, current.direction))
    ) {
      continue;
    }
    if (same(current.point, end.exit) && current.direction !== end.direction) {
      return unwind(current);
    }
    for (const visit of nextVisits(current, grid, costs)) {
      costs.set(key(visit.point, visit.direction), visit.cost);
      pending.push(visit);
    }
  }
  return [];
}

function attached(
  start: RoutePort,
  end: RoutePort,
  middle: readonly RoutePoint[],
): readonly RoutePoint[] {
  const points = simplifyRoute([start.point, ...middle, end.point]);
  const second = points[1];
  const before = points.at(-2);
  if (second === undefined || before === undefined) return [];
  if (
    heading(start.point, second) !== start.direction ||
    heading(end.point, before) !== end.direction
  ) {
    return [];
  }
  return points;
}

interface PortPair {
  readonly start: RoutePort;
  readonly end: RoutePort;
  readonly distance: number;
}

function directRoutes(pair: PortPair, space: SearchSpace): readonly (readonly RoutePoint[])[] {
  return candidates(pair.start.exit, pair.end.exit, space)
    .map((middle) => attached(pair.start, pair.end, middle))
    .filter((points) => valid(points, space));
}

function directRoute(pairs: readonly PortPair[], space: SearchSpace): readonly RoutePoint[] {
  let best: readonly RoutePoint[] = [];
  let bestCost = Infinity;
  for (const pair of pairs) {
    if (pair.distance > bestCost) continue;
    for (const points of directRoutes(pair, space)) {
      const score = cost(points, space.penalty);
      if (score < bestCost) {
        best = points;
        bestCost = score;
      }
    }
  }
  return best;
}

/** Choose ports and route together. No global return lane, and no path shifting after collision checks. */
export function orthogonalRoute(
  starts: readonly RoutePort[],
  ends: readonly RoutePort[],
  space: RoutingSpace,
): readonly RoutePoint[] {
  const pairs = starts
    .flatMap((start) =>
      ends.map((end) => ({ start, end, distance: length(start.point, end.point) })),
    )
    .toSorted((a, b) => a.distance - b.distance);
  const prepared = { ...space, penalty: trafficCost(space.lines) };
  const direct = directRoute(pairs, prepared);
  if (direct.length > 0) return direct;
  for (const { start, end } of pairs) {
    const middle = search(start, end, prepared);
    if (middle.length === 0) continue;
    const points = attached(start, end, middle);
    if (valid(points, prepared)) return points;
  }
  return [];
}
