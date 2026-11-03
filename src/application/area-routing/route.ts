import { orthogonalRoute, type RouteBox, type RoutePoint, type RoutePort } from './orthogonal';

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

interface LabelPoint extends Point {
  readonly labelHidden?: boolean;
}

/** Thin line obstacles also protect the clear space between a caption and its own segment. */
export function lineBoxes(points: readonly RoutePoint[]): readonly RouteBox[] {
  return points.slice(1).map((point, index) => {
    const previous = points[index] ?? point;
    return {
      x: Math.min(previous.x, point.x) - 2,
      y: Math.min(previous.y, point.y) - 2,
      width: Math.abs(previous.x - point.x) + 4,
      height: Math.abs(previous.y - point.y) + 4,
    };
  });
}

function overlaps(a: Rectangle, b: Rectangle): boolean {
  return a.x + a.width > b.x && a.x < b.x + b.width && a.y + a.height > b.y && a.y < b.y + b.height;
}

function clearLabel(
  point: Point & { readonly anchor: Point },
  obstacles: readonly Rectangle[],
  size: Rectangle,
  lines: readonly Rectangle[],
): boolean {
  const box = {
    x: point.x - size.width / 2,
    y: point.y - 14,
    width: size.width,
    height: size.height,
  };
  const attached = {
    x: Math.min(box.x, point.anchor.x),
    y: Math.min(box.y, point.anchor.y),
    width: Math.max(box.x + box.width, point.anchor.x) - Math.min(box.x, point.anchor.x),
    height: Math.max(box.y + box.height, point.anchor.y) - Math.min(box.y, point.anchor.y),
  };
  return (
    point.x - size.width / 2 >= size.x &&
    point.y - 14 >= size.y &&
    !obstacles.some((other) => overlaps(box, other)) &&
    !lines.some((other) => overlaps(attached, other))
  );
}

/** Captions stay beside a real segment. Exhausted space is explicit, never an unrelated free boundary. */
export function labelPoint(
  points: readonly Point[],
  obstacles: readonly Rectangle[],
  width: number,
  preferEnd = false,
  options: {
    readonly height?: number;
    readonly bounds?: Rectangle;
    readonly lines?: readonly Rectangle[];
  } = {},
): LabelPoint {
  const height = options.height ?? 18;
  const candidates = points
    .flatMap((point, index) => {
      const next = points[index + 1];
      if (next === undefined) return [];
      const horizontal = point.y === next.y;
      const length = distance(point, next);
      const required = horizontal ? width : height;
      if (length < required + 16) return [];
      return [0.5, 0.25, 0.75].flatMap((fraction) => {
        if (horizontal) {
          const low = Math.min(point.x, next.x) + width / 2 + 8;
          const high = Math.max(point.x, next.x) - width / 2 - 8;
          const x = Math.max(low, Math.min(high, point.x + (next.x - point.x) * fraction));
          return [point.y - height + 6, point.y + 22].map((y) => ({
            x,
            y,
            anchor: { x, y: point.y },
            score: length + 1000 + (preferEnd ? index * 10_000 : 0),
          }));
        }
        const low = Math.min(point.y, next.y) + height / 2 + 8;
        const high = Math.max(point.y, next.y) - height / 2 - 8;
        const y =
          Math.max(low, Math.min(high, point.y + (next.y - point.y) * fraction)) - height / 2 + 14;
        return [-1, 1].map((side) => ({
          x: point.x + side * (width / 2 + 12),
          y,
          anchor: { x: point.x, y: y + height / 2 - 14 },
          score: length,
        }));
      });
    })
    .toSorted((a, b) => b.score - a.score);
  const bounds = options.bounds;
  const size = { x: bounds?.x ?? 12, y: bounds?.y ?? 10, width, height };
  const placed = candidates.find(
    (point) =>
      clearLabel(point, obstacles, size, options.lines ?? []) &&
      (bounds === undefined ||
        (point.x + width / 2 <= bounds.x + bounds.width &&
          point.y - 14 + height <= bounds.y + bounds.height)),
  );
  if (placed !== undefined) return { x: placed.x, y: placed.y };
  const first = points[0] ?? { x: 24, y: 24 };
  return { ...first, labelHidden: true };
}

const horizontalDirection = (sign: number): number => (sign > 0 ? 0 : 2);
const verticalDirection = (sign: number): number => (sign > 0 ? 1 : 3);

function port(point: RoutePoint, neighbour: RoutePoint): RoutePort {
  const horizontal = point.y === neighbour.y;
  const sign = Math.sign(horizontal ? neighbour.x - point.x : neighbour.y - point.y);
  const stubLength = Math.min(
    24,
    (Math.abs(point.x - neighbour.x) + Math.abs(point.y - neighbour.y)) / 2,
  );
  return {
    point,
    exit: {
      x: point.x + (horizontal ? sign * stubLength : 0),
      y: point.y + (horizontal ? 0 : sign * stubLength),
    },
    direction: horizontal ? horizontalDirection(sign) : verticalDirection(sign),
  };
}

/** Try a bounded alternative path before declaring that an attached caption has no legal space. */
export function captionRoute(
  points: readonly RoutePoint[],
  obstacles: readonly RouteBox[],
  caption: {
    readonly width: number;
    readonly height: number;
    readonly bounds?: RouteBox;
    readonly preferEnd?: boolean;
    readonly lines?: readonly RouteBox[];
  },
): {
  readonly points: readonly RoutePoint[];
  readonly path: string;
  readonly x: number;
  readonly y: number;
  readonly labelHidden?: boolean;
} {
  const bounds = caption.bounds ?? {
    x: 0,
    y: 0,
    width: Math.max(
      1000,
      ...obstacles.map((box) => box.x + box.width + caption.width + 64),
      ...points.map((point) => point.x + caption.width + 64),
    ),
    height: Math.max(
      800,
      ...obstacles.map((box) => box.y + box.height + caption.height + 64),
      ...points.map((point) => point.y + caption.height + 64),
    ),
  };
  const place = (candidate: readonly RoutePoint[]) =>
    labelPoint(candidate, obstacles, caption.width, caption.preferEnd, {
      height: caption.height,
      bounds,
      lines: caption.lines ?? [],
    });
  const label = place(points);
  const first = points[0],
    second = points[1],
    last = points.at(-1),
    before = points.at(-2);
  if (label.labelHidden !== true) return { points, path: roundedPath(points), ...label };
  if (first === undefined || second === undefined || last === undefined || before === undefined) {
    return { points, path: roundedPath(points), ...label };
  }
  const repaired = orthogonalRoute([port(first, second)], [port(last, before)], {
    boxes: obstacles,
    bounds,
    lines: [],
    corridorPadding: caption.height + 32,
    accept: (candidate) => place(candidate).labelHidden !== true,
  });
  return repaired.length === 0
    ? { points, path: roundedPath(points), ...label }
    : { points: repaired, path: roundedPath(repaired), ...place(repaired) };
}

export interface AreaRouteOptions {
  readonly start: Point;
  readonly end: Point;
  readonly obstacles: readonly Rectangle[];
  readonly returnLane?: number;
  readonly direction: 1 | -1;
  readonly labelWidth: number;
  readonly labelHeight?: number;
  readonly vertical?: boolean;
  readonly labelObstacles?: readonly Rectangle[];
}

/** Rounded orthogonal paths keep every bend and label in the free routing gutters. */
export function areaRoute(options: AreaRouteOptions): {
  readonly path: string;
  readonly x: number;
  readonly y: number;
  readonly points: readonly Point[];
  readonly labelHidden?: boolean;
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
  return captionRoute(simplified, [...options.obstacles, ...(options.labelObstacles ?? [])], {
    width: labelWidth,
    height: options.labelHeight ?? 18,
  });
}
