// Lanes and corners for the landscape's lines. A line runs through a list of spaces: the channels between the
// bands, which it crosses sideways, and the corridors between domains, which it runs up and down. Each line
// gets its own lane in every space it uses, so lines that share a space run side by side and do not overlap.

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A channel runs across the canvas; a corridor runs down it. */
export interface Space {
  readonly id: string;
  readonly across: boolean;
  /** Its middle: a y for a channel, an x for a corridor. */
  readonly mid: number;
  /** How far a lane may sit from the middle. */
  readonly room: number;
}

/** One stretch of a line in one space, from where it comes in to where it goes out. */
export interface Leg {
  readonly line: number;
  readonly space: Space;
  readonly lo: number;
  readonly hi: number;
}

const LANE = 10;
const CLEAR = 6;
const CORNER = 10;

/** Lane 0 in the middle, then one either side, then two either side, and so on, kept inside the room. */
function offsetOf(lane: number, room: number): number {
  const step = Math.ceil(lane / 2) * LANE;
  const signed = lane % 2 === 1 ? step : -step;
  return Math.max(-room, Math.min(room, signed));
}

/** A lane for every leg, so that legs in the same space that overlap do not share one, and how many lanes
 * each space needed. */
export function laneLegs(legs: readonly Leg[]): {
  at: Map<Leg, number>;
  needs: Map<string, number>;
} {
  const out = new Map<Leg, number>();
  const needs = new Map<string, number>();
  const bySpace = Map.groupBy(legs, (leg) => leg.space.id);
  for (const group of bySpace.values()) {
    const ends: number[] = [];
    const sorted = group.toSorted((p, q) => (p.lo === q.lo ? p.hi - q.hi : p.lo - q.lo));
    for (const leg of sorted) {
      const free = ends.findIndex((end) => end + CLEAR < leg.lo);
      const lane = free === -1 ? ends.length : free;
      ends[lane] = leg.hi;
      out.set(leg, leg.space.mid + offsetOf(lane, leg.space.room));
    }
    needs.set(group[0]?.space.id ?? '', ends.length);
  }
  return { at: out, needs };
}

/** How wide a space must be for this many lanes side by side. */
export const roomFor = (lanes: number): number => (lanes + 1) * LANE + 2 * CLEAR;

/** The corners of a line from one port to the other through its lanes. */
export function cornersOf(
  from: Point,
  to: Point,
  lanes: readonly { across: boolean; at: number }[],
): Point[] {
  const points: Point[] = [from];
  let cur = from;
  for (const lane of lanes) {
    cur = lane.across ? { x: cur.x, y: lane.at } : { x: lane.at, y: cur.y };
    points.push(cur);
  }
  const last = lanes.at(-1);
  if (last !== undefined)
    points.push(last.across ? { x: to.x, y: last.at } : { x: last.at, y: to.y });
  points.push(to);
  return tidy(points);
}

const same = (a: Point, b: Point): boolean => Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1;
const inLine = (a: Point, b: Point, c: Point): boolean =>
  (Math.abs(a.x - b.x) < 1 && Math.abs(b.x - c.x) < 1) ||
  (Math.abs(a.y - b.y) < 1 && Math.abs(b.y - c.y) < 1);

/** Drop repeated points and the ones in the middle of a straight run. */
function tidy(points: readonly Point[]): Point[] {
  const kept: Point[] = [];
  for (const p of points) {
    const prev = kept.at(-1);
    if (prev !== undefined && same(prev, p)) continue;
    const before = kept.at(-2);
    if (before !== undefined && prev !== undefined && inLine(before, prev, p)) kept.pop();
    kept.push(p);
  }
  return kept;
}

const round = (n: number): number => Math.round(n * 10) / 10;
const xy = (p: Point): string => `${String(round(p.x))} ${String(round(p.y))}`;
const span = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** A point `by` along the way from one point to another. */
function toward(from: Point, to: Point, by: number): Point {
  const len = span(from, to);
  return len === 0
    ? from
    : { x: from.x + ((to.x - from.x) * by) / len, y: from.y + ((to.y - from.y) * by) / len };
}

/** The middle of the longest level stretch, where a label reads along the line, and how long it is. */
function labelAt(points: readonly Point[]): { mid: Point; room: number } {
  const stretches = points.slice(1).map((b, i) => ({ a: points[i] ?? b, b }));
  const level = stretches.filter(({ a, b }) => Math.abs(a.y - b.y) < 1);
  const best = level.toSorted((p, q) => span(q.a, q.b) - span(p.a, p.b))[0];
  if (best === undefined) return { mid: points[0] ?? { x: 0, y: 0 }, room: 0 };
  const mid = { x: round((best.a.x + best.b.x) / 2), y: round((best.a.y + best.b.y) / 2) };
  return { mid, room: Math.max(0, span(best.a, best.b) - 2 * CORNER) };
}

/** The path through the corners, rounded at each turn, and where its label goes. */
export function pathOf(points: readonly Point[]): { d: string; mid: Point; room: number } {
  const first = points[0] ?? { x: 0, y: 0 };
  let d = `M${xy(first)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [before, at, after] = [
      points[i - 1] ?? first,
      points[i] ?? first,
      points[i + 1] ?? first,
    ];
    const r = Math.min(CORNER, span(before, at) / 2, span(at, after) / 2);
    d += ` L${xy(toward(at, before, r))} Q${xy(at)} ${xy(toward(at, after, r))}`;
  }
  d += ` L${xy(points.at(-1) ?? first)}`;
  return { d, ...labelAt(points) };
}
