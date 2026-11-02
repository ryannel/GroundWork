interface Point {
  readonly x: number;
  readonly y: number;
}

interface Rectangle extends Point {
  readonly width: number;
  readonly height: number;
}

interface Grid {
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  readonly obstacles: readonly Rectangle[];
}

const CLEARANCE = 24;
const distance = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const coordinate = (point: Point): string => `${String(point.x)},${String(point.y)}`;

function clearSegment(a: Point, b: Point, obstacles: readonly Rectangle[]): boolean {
  return !obstacles.some((box) => {
    if (a.y === b.y) {
      return (
        a.y > box.y &&
        a.y < box.y + box.height &&
        Math.max(a.x, b.x) > box.x &&
        Math.min(a.x, b.x) < box.x + box.width
      );
    }
    return (
      a.x > box.x &&
      a.x < box.x + box.width &&
      Math.max(a.y, b.y) > box.y &&
      Math.min(a.y, b.y) < box.y + box.height
    );
  });
}

function gridOf(start: Point, end: Point, obstacles: readonly Rectangle[]): Grid {
  const xs = [start.x, end.x];
  const ys = [start.y, end.y];
  for (const box of obstacles) {
    xs.push(Math.max(12, box.x - CLEARANCE), box.x + box.width + CLEARANCE);
    ys.push(Math.max(12, box.y - CLEARANCE), box.y + box.height + CLEARANCE);
  }
  return {
    xs: [...new Set(xs)].toSorted((a, b) => a - b),
    ys: [...new Set(ys)].toSorted((a, b) => a - b),
    obstacles,
  };
}

function neighbours(point: Point, grid: Grid): readonly Point[] {
  const x = grid.xs.indexOf(point.x);
  const y = grid.ys.indexOf(point.y);
  const candidates = [
    { x: grid.xs[x - 1], y: point.y },
    { x: grid.xs[x + 1], y: point.y },
    { x: point.x, y: grid.ys[y - 1] },
    { x: point.x, y: grid.ys[y + 1] },
  ];
  return candidates.flatMap((candidate): readonly Point[] => {
    if (candidate.x === undefined || candidate.y === undefined) return [];
    const next = { x: candidate.x, y: candidate.y };
    return clearSegment(point, next, grid.obstacles) ? [next] : [];
  });
}

interface Visit {
  readonly point: Point;
  readonly cost: number;
  readonly previous: Visit | null;
}

function unwind(visit: Visit): readonly Point[] {
  const points: Point[] = [];
  let current: Visit | null = visit;
  while (current !== null) {
    points.push(current.point);
    current = current.previous;
  }
  return points.toReversed();
}

/** Search the free horizontal/vertical corridors rather than drawing through intervening nodes. */
function route(start: Point, end: Point, obstacles: readonly Rectangle[]): readonly Point[] {
  const grid = gridOf(start, end, obstacles);
  const pending: Visit[] = [{ point: start, cost: 0, previous: null }];
  const costs = new Map([[coordinate(start), 0]]);
  while (pending.length > 0) {
    pending.sort((a, b) => a.cost + distance(a.point, end) - b.cost - distance(b.point, end));
    const current = pending.shift();
    if (current === undefined) return [];
    if (current.cost !== costs.get(coordinate(current.point))) continue;
    if (distance(current.point, end) === 0) return unwind(current);
    for (const next of neighbours(current.point, grid)) {
      const cost = current.cost + distance(current.point, next);
      if (cost >= (costs.get(coordinate(next)) ?? Number.POSITIVE_INFINITY)) continue;
      costs.set(coordinate(next), cost);
      pending.push({ point: next, cost, previous: current });
    }
  }
  return [];
}

function simplify(points: readonly Point[]): readonly Point[] {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    const next = points[index + 1];
    if (previous === undefined || next === undefined) return true;
    if (distance(previous, point) === 0) return false;
    const vertical = previous.x === point.x && point.x === next.x;
    const horizontal = previous.y === point.y && point.y === next.y;
    const between = distance(previous, next) === distance(previous, point) + distance(point, next);
    return !(between && (vertical || horizontal));
  });
}

function towards(from: Point, to: Point, amount: number): Point {
  const ratio = amount / distance(from, to);
  return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
}

export function roundedPath(points: readonly Point[]): string {
  const first = points[0];
  if (first === undefined) return '';
  const commands = points.slice(1).flatMap((point, index): readonly string[] => {
    const previous = points[index];
    const next = points[index + 2];
    if (previous === undefined) return [];
    if (next === undefined) return [`L ${coordinate(point)}`];
    const radius = Math.min(10, distance(previous, point) / 2, distance(point, next) / 2);
    return [
      `L ${coordinate(towards(point, previous, radius))}`,
      `Q ${coordinate(point)} ${coordinate(towards(point, next, radius))}`,
    ];
  });
  return [`M ${coordinate(first)}`, ...commands].join(' ');
}

/** A receiver label sits just outside its port, so a long line remains easy to trace. */
function receiverLabels(points: readonly Point[], width: number): readonly Point[] {
  const end = points.at(-1);
  const previous = points.at(-2);
  if (end === undefined || end.y !== previous?.y) return [];
  const x = end.x + Math.sign(previous.x - end.x) * (width / 2 + 16);
  return [-10, 18, -28, 36].map((offset) => ({ x, y: end.y + offset }));
}

function clearLabel(point: Point, obstacles: readonly Rectangle[], width: number): boolean {
  return (
    point.x - width / 2 >= 12 &&
    point.y >= 24 &&
    !obstacles.some(
      (box) =>
        point.x + width / 2 > box.x &&
        point.x - width / 2 < box.x + box.width &&
        point.y + 4 > box.y &&
        point.y - 14 < box.y + box.height,
    )
  );
}

export function labelPoint(
  points: readonly Point[],
  obstacles: readonly Rectangle[],
  width: number,
  preferEnd = false,
): Point {
  const candidates = points
    .flatMap((point, index) => {
      const next = points[index + 1];
      if (next === undefined) return [];
      const length = distance(point, next);
      const score =
        length +
        (point.y === next.y ? 1000 : 0) +
        (preferEnd && length >= width ? index * 10_000 : 0);
      return [0.5, 0.25, 0.75].flatMap((fraction) =>
        [-10, 18, -28, 36, -54, 62, -78, 86, -102, 110].map((offset) => ({
          x: point.x + (next.x - point.x) * fraction,
          y: point.y + (next.y - point.y) * fraction + offset,
          score,
        })),
      );
    })
    .toSorted((a, b) => b.score - a.score);
  const preferred = preferEnd ? [...receiverLabels(points, width), ...candidates] : candidates;
  const clear = preferred.find((point) => clearLabel(point, obstacles, width));
  if (clear !== undefined) return clear;
  // Tall expanded cards can exhaust the nearby offsets. Search their free boundaries rather than
  // falling back to the first candidate, which can paint a label across an API row or card title.
  const first = preferred[0] ?? { x: width / 2 + 12, y: 24 };
  const origin = { x: Math.max(width / 2 + 12, first.x), y: Math.max(24, first.y) };
  const boundaries = obstacles
    .flatMap((box) => [
      { x: box.x - width / 2 - 12, y: origin.y },
      { x: box.x + box.width + width / 2 + 12, y: origin.y },
      { x: origin.x, y: box.y - 8 },
      { x: origin.x, y: box.y + box.height + 20 },
    ])
    .toSorted((a, b) => distance(origin, a) - distance(origin, b));
  return boundaries.find((point) => clearLabel(point, obstacles, width)) ?? origin;
}

export interface AreaRouteOptions {
  readonly start: Point;
  readonly end: Point;
  readonly obstacles: readonly Rectangle[];
  readonly returnLane?: number;
  readonly direction: 1 | -1;
  readonly labelWidth: number;
  readonly vertical?: boolean;
  readonly labelObstacles?: readonly Rectangle[];
}

/** Rounded orthogonal paths keep every bend and label in the free routing gutters. */
export function areaRoute(options: AreaRouteOptions): {
  readonly path: string;
  readonly x: number;
  readonly y: number;
  readonly points: readonly Point[];
} | null {
  const { returnLane, direction, labelWidth, vertical = false } = options;
  const orient = (point: Point): Point => (vertical ? { x: point.y, y: point.x } : point);
  const start = orient(options.start);
  const end = orient(options.end);
  const obstacles = options.obstacles.map((box) =>
    vertical ? { x: box.y, y: box.x, width: box.height, height: box.width } : box,
  );
  const clearance =
    returnLane === undefined ? Math.min(CLEARANCE, Math.abs(end.x - start.x) / 3) : CLEARANCE;
  const exit = { x: start.x + direction * clearance, y: start.y };
  const entry = { x: end.x - direction * clearance, y: end.y };
  const stops =
    returnLane === undefined
      ? [exit, entry]
      : [exit, { x: exit.x, y: returnLane }, { x: entry.x, y: returnLane }, entry];
  const points: Point[] = [start];
  for (const [index, stop] of stops.entries()) {
    const next = stops[index + 1];
    if (next === undefined) continue;
    const section = route(stop, next, obstacles);
    if (section.length === 0) return null;
    points.push(...section.slice(index === 0 ? 0 : 1));
  }
  points.push(end);
  const simplified = simplify(points).map(orient);
  const label = labelPoint(
    simplified,
    [...options.obstacles, ...(options.labelObstacles ?? [])],
    labelWidth,
  );
  return { path: roundedPath(simplified), ...label, points: simplified };
}
