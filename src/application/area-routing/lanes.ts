export interface LanePoint {
  readonly x: number;
  readonly y: number;
}

export interface LaneObstacle extends LanePoint {
  readonly width: number;
  readonly height: number;
}

const LANE = 14;
const PADDING = 12;

interface Segment {
  readonly route: number;
  readonly index: number;
  /** The coordinate shared by both ends: x for a vertical run, y for a horizontal one. */
  readonly at: number;
  readonly from: number;
  readonly to: number;
}

type Axis = 'vertical' | 'horizontal';

function across(point: LanePoint, axis: Axis): number {
  return axis === 'vertical' ? point.x : point.y;
}

function along(point: LanePoint, axis: Axis): number {
  return axis === 'vertical' ? point.y : point.x;
}

/** Interior runs only: the first and last runs leave and enter a port, so they cannot move. */
function segmentsOf(routes: readonly (readonly LanePoint[])[], axis: Axis): Segment[] {
  return routes.flatMap((points, route) =>
    points.flatMap((point, index): readonly Segment[] => {
      const next = points[index + 1];
      if (next === undefined || index === 0 || index + 2 >= points.length) return [];
      if (across(point, axis) !== across(next, axis) || along(point, axis) === along(next, axis)) {
        return [];
      }
      const ends = [along(point, axis), along(next, axis)];
      return [
        {
          route,
          index,
          at: across(point, axis),
          from: Math.min(...ends),
          to: Math.max(...ends),
        },
      ];
    }),
  );
}

function overlaps(a: Segment, b: Segment): boolean {
  return a.at === b.at && a.from < b.to && b.from < a.to;
}

/** Gather every segment reachable from the first through a chain of overlaps. */
function chainFrom(first: Segment, segments: readonly Segment[]): readonly Segment[] {
  const group = [first];
  for (const current of group) {
    group.push(...segments.filter((other) => !group.includes(other) && overlaps(current, other)));
  }
  return group;
}

/** Segments that share a track and overlap, directly or through a chain of others. */
function bundles(segments: readonly Segment[]): readonly (readonly Segment[])[] {
  return segments.reduce<readonly (readonly Segment[])[]>((groups, segment) => {
    if (groups.some((group) => group.includes(segment))) return groups;
    const group = chainFrom(segment, segments);
    return group.length > 1 ? [...groups, group] : groups;
  }, []);
}

interface Extent {
  readonly start: number;
  readonly end: number;
}

/** A box as two extents: across the track, and along it. */
function extents(box: LaneObstacle, axis: Axis): { readonly cross: Extent; readonly span: Extent } {
  const horizontal = { start: box.x, end: box.x + box.width };
  const vertical = { start: box.y, end: box.y + box.height };
  return axis === 'vertical'
    ? { cross: horizontal, span: vertical }
    : { cross: vertical, span: horizontal };
}

/** The free space either side of a track, between the nearest boxes that its span passes. */
function freeSpace(
  group: readonly Segment[],
  obstacles: readonly LaneObstacle[],
  axis: Axis,
): { readonly low: number; readonly high: number } {
  const at = group[0]?.at ?? 0;
  const from = Math.min(...group.map((segment) => segment.from));
  const to = Math.max(...group.map((segment) => segment.to));
  const beside = obstacles
    .map((box) => extents(box, axis))
    .filter(({ span }) => span.start < to && span.end > from)
    .map(({ cross }) => cross)
    .filter((cross) => cross.end <= at || cross.start >= at);
  return {
    low: Math.max(
      Number.NEGATIVE_INFINITY,
      ...beside.filter((cross) => cross.end <= at).map((cross) => cross.end + PADDING),
    ),
    high: Math.min(
      Number.POSITIVE_INFINITY,
      ...beside.filter((cross) => cross.start >= at).map((cross) => cross.start - PADDING),
    ),
  };
}

function middle(segment: Segment): number {
  return segment.from + segment.to;
}

function spread(group: readonly Segment[], space: { readonly low: number; readonly high: number }) {
  const at = group[0]?.at ?? 0;
  const room = Number.isFinite(space.high - space.low)
    ? space.high - space.low
    : LANE * group.length;
  const step = Math.min(LANE, room / Math.max(1, group.length - 1));
  const width = step * (group.length - 1);
  const first = Math.min(Math.max(at - width / 2, space.low), space.high - width);
  return group
    .toSorted((a, b) => (middle(a) === middle(b) ? a.route - b.route : middle(a) - middle(b)))
    .map((segment, order) => ({ segment, at: first + order * step }));
}

function moved(
  routes: readonly (readonly LanePoint[])[],
  obstacles: readonly LaneObstacle[],
  axis: Axis,
): readonly (readonly LanePoint[])[] {
  const tracks = new Map<string, number>();
  for (const group of bundles(segmentsOf(routes, axis))) {
    const space = freeSpace(group, obstacles, axis);
    if (space.high - space.low < PADDING) continue;
    for (const { segment, at } of spread(group, space)) {
      tracks.set(`${String(segment.route)}:${String(segment.index)}`, at);
      tracks.set(`${String(segment.route)}:${String(segment.index + 1)}`, at);
    }
  }
  return routes.map((points, route) =>
    points.map((point, index) => {
      const at = tracks.get(`${String(route)}:${String(index)}`);
      if (at === undefined) return point;
      return axis === 'vertical' ? { x: at, y: point.y } : { x: point.x, y: at };
    }),
  );
}

/**
 * Give lines that share a corridor a track each, so every line can be followed on its own.
 * The router finds a free corridor; this spreads the lines across its width without entering a box.
 */
export function separateLanes(
  routes: readonly (readonly LanePoint[])[],
  obstacles: readonly LaneObstacle[],
): readonly (readonly LanePoint[])[] {
  return moved(moved(routes, obstacles, 'vertical'), obstacles, 'horizontal');
}
