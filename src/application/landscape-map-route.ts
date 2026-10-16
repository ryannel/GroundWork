import {
  cornersOf,
  laneLegs,
  pathOf,
  type Leg,
  type Point,
  type Space,
} from './landscape-map-path';
import type { Rolled } from './landscape-map-rollup';
import type { Box, LandLine, LandNode } from './landscape-map-types';

// Lines run square, as in a C4 drawing. A person's line drops into the channel under the people; an outside
// service's rises into the channel over the services. A system in an open domain is reached from the side,
// through the corridor beside its domain, so no line crosses a card. Two domains that sit side by side share
// the corridor between them; any others meet in the channel under the domains.

type Side = 'top' | 'bottom' | 'left' | 'right';

interface Ground {
  readonly top: Space;
  readonly bottom: Space;
  /** Corridor i runs down the left of row box i; the last runs down the right of the last box. */
  readonly corridors: readonly Space[];
  readonly slot: ReadonlyMap<string, number>;
}

/** How one line runs: the side it leaves each box from and the spaces it passes through on the way. */
interface Route {
  readonly a: LandNode;
  readonly b: LandNode;
  readonly sa: Side;
  readonly sb: Side;
  readonly spaces: readonly Space[];
}

const SPREAD = 0.7;
const MARGIN = 14;
const cx = (b: Box): number => b.x + b.w / 2;
const cy = (b: Box): number => b.y + b.h / 2;
const inRow = (n: LandNode): boolean => n.kind === 'domain' || n.kind === 'frame';

function channel(id: string, above: number, below: number): Space {
  return {
    id,
    across: true,
    mid: (above + below) / 2,
    room: Math.max(0, (below - above) / 2 - MARGIN),
  };
}

function corridor(i: number, left: number, right: number): Space {
  return {
    id: `c${String(i)}`,
    across: false,
    mid: (left + right) / 2,
    room: Math.max(0, (right - left) / 2 - 8),
  };
}

function groundOf(nodes: readonly LandNode[], width: number): Ground {
  const row = nodes.filter(inRow).toSorted((p, q) => p.x - q.x);
  const rowTop = Math.min(...row.map((n) => n.y));
  const rowBottom = Math.max(...row.map((n) => n.y + n.h));
  const people = nodes.filter((n) => n.kind === 'actor');
  const outside = nodes.filter((n) => n.kind === 'external');
  const above = people.length === 0 ? 0 : Math.max(...people.map((n) => n.y + n.h));
  const below =
    outside.length === 0 ? rowBottom + rowTop - above : Math.min(...outside.map((n) => n.y));
  const edges = [0, ...row.flatMap((n) => [n.x, n.x + n.w]), width];
  const corridors =
    row.length === 0
      ? []
      : [...row, null].map((_, i) => corridor(i, edges[2 * i] ?? 0, edges[2 * i + 1] ?? 0));
  return {
    top: channel('top', above, rowTop),
    bottom: channel('bottom', rowBottom, below),
    corridors,
    slot: new Map(row.map((n, i) => [n.id, i])),
  };
}

/** The corridors down the left and the right of a box in the row, or of the open domain a system sits in. */
function besideOf(n: LandNode, g: Ground): [Space, Space] | null {
  const i = g.slot.get(n.kind === 'system' ? (n.domain ?? '') : n.id);
  const [l, r] = i === undefined ? [] : [g.corridors[i], g.corridors[i + 1]];
  return l === undefined || r === undefined ? null : [l, r];
}

/** The corridor nearest a point across the canvas. */
function nearest(g: Ground, x: number): Space {
  return g.corridors.toSorted((p, q) => Math.abs(p.mid - x) - Math.abs(q.mid - x))[0] ?? g.bottom;
}

/** A person or outside service to a box in the row. */
function fromBand(band: LandNode, other: LandNode, g: Ground): Route {
  const up = band.kind === 'actor';
  const ch = up ? g.top : g.bottom;
  const sa: Side = up ? 'bottom' : 'top';
  const beside = other.kind === 'system' ? besideOf(other, g) : null;
  if (beside === null) return { a: band, b: other, sa, sb: up ? 'top' : 'bottom', spaces: [ch] };
  const [l, r] = beside;
  const left = cx(band) < (l.mid + r.mid) / 2;
  return { a: band, b: other, sa, sb: left ? 'left' : 'right', spaces: [ch, left ? l : r] };
}

/** How a row box leaves for one that does not share a corridor with it: down to the channel under the row. */
function outOf(n: LandNode, otherX: number, g: Ground): { side: Side; space: Space } {
  const beside = n.kind === 'system' ? besideOf(n, g) : null;
  if (beside === null) return { side: 'bottom', space: g.bottom };
  return otherX < cx(n) ? { side: 'left', space: beside[0] } : { side: 'right', space: beside[1] };
}

function withoutRepeats(spaces: readonly Space[]): Space[] {
  return spaces.filter((s, i) => i === 0 || spaces[i - 1]?.id !== s.id);
}

/** Two boxes in the row. */
function acrossRow(a: LandNode, b: LandNode, g: Ground): Route {
  const [al, ar] = besideOf(a, g) ?? [g.bottom, g.bottom];
  const [bl, br] = besideOf(b, g) ?? [g.bottom, g.bottom];
  if (a.kind === 'system' && b.kind === 'system' && a.domain === b.domain) {
    return { a, b, sa: 'right', sb: 'right', spaces: [ar] };
  }
  if (ar.id === bl.id) return { a, b, sa: 'right', sb: 'left', spaces: [ar] };
  if (al.id === br.id) return { a, b, sa: 'left', sb: 'right', spaces: [al] };
  const oa = outOf(a, cx(b), g);
  const ob = outOf(b, cx(a), g);
  return { a, b, sa: oa.side, sb: ob.side, spaces: withoutRepeats([oa.space, g.bottom, ob.space]) };
}

function reversed(r: Route): Route {
  return { a: r.b, b: r.a, sa: r.sb, sb: r.sa, spaces: r.spaces.toReversed() };
}

function routeOf(a: LandNode, b: LandNode, g: Ground): Route {
  const banded = (n: LandNode): boolean => n.kind === 'actor' || n.kind === 'external';
  if (banded(a) && banded(b)) {
    const [p, q] = a.kind === 'actor' ? [a, b] : [b, a];
    const r: Route = {
      a: p,
      b: q,
      sa: 'bottom',
      sb: 'top',
      spaces: [g.top, nearest(g, (cx(p) + cx(q)) / 2), g.bottom],
    };
    return p === a ? r : reversed(r);
  }
  if (banded(a)) return fromBand(a, b, g);
  if (banded(b)) return reversed(fromBand(b, a, g));
  return acrossRow(a, b, g);
}

const flat = (side: Side): boolean => side === 'top' || side === 'bottom';

/** The point at fraction `t` of the spread along one side of a box. */
function pointOn(n: Box, side: Side, t: number): Point {
  const along = (len: number): number => (0.5 - SPREAD / 2 + SPREAD * t) * len;
  if (side === 'top') return { x: n.x + along(n.w), y: n.y };
  if (side === 'bottom') return { x: n.x + along(n.w), y: n.y + n.h };
  return { x: side === 'left' ? n.x : n.x + n.w, y: n.y + along(n.h) };
}

interface End {
  readonly key: string;
  readonly node: LandNode;
  readonly side: Side;
  /** Where the line turns next, read along the side it leaves from. */
  readonly toward: number;
}

/** Where a line leaving this side turns next: at the second space it uses, or level with the other box. */
function towardOf(side: Side, spaces: readonly Space[], other: LandNode): number {
  const next = spaces[1];
  if (next !== undefined) return next.mid;
  return flat(side) ? cx(other) : cy(other);
}

function endsOf(routes: readonly Route[]): End[] {
  return routes.flatMap((r, i): End[] => [
    { key: `${String(i)}:a`, node: r.a, side: r.sa, toward: towardOf(r.sa, r.spaces, r.b) },
    {
      key: `${String(i)}:b`,
      node: r.b,
      side: r.sb,
      toward: towardOf(r.sb, r.spaces.toReversed(), r.a),
    },
  ]);
}

/** Where each end lands, spread along its side in the order of where the lines go. */
function ports(ends: readonly End[]): Map<string, Point> {
  const out = new Map<string, Point>();
  for (const group of Map.groupBy(ends, (e) => `${e.node.id}:${e.side}`).values()) {
    const sorted = group.toSorted((p, q) => p.toward - q.toward);
    for (const [i, end] of sorted.entries())
      out.set(end.key, pointOn(end.node, end.side, (i + 1) / (sorted.length + 1)));
  }
  return out;
}

/** Each space a line uses, from where it comes in to where it goes out, read along the space. */
function legsOf(
  line: number,
  spaces: readonly Space[],
  [from, to]: readonly [Point, Point],
): Leg[] {
  return spaces.map((space, i) => {
    const along = (p: Point): number => (space.across ? p.x : p.y);
    const start = i === 0 ? along(from) : (spaces[i - 1]?.mid ?? 0);
    const end = i === spaces.length - 1 ? along(to) : (spaces[i + 1]?.mid ?? 0);
    return { line, space, lo: Math.min(start, end), hi: Math.max(start, end) };
  });
}

/** The rolled-up connections drawn as square lines between the boxes, and how many lanes each space needed:
 * `top` and `bottom` for the channels, `c0`, `c1` and on for the corridors from the left. */
export function routeLines(
  rolled: readonly Rolled[],
  nodes: readonly LandNode[],
  width: number,
): { lines: LandLine[]; needs: ReadonlyMap<string, number> } {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const g = groundOf(nodes, width);
  const placed = rolled.flatMap((line) => {
    const a = byId.get(line.a);
    const b = byId.get(line.b);
    return a === undefined || b === undefined ? [] : [{ line, route: routeOf(a, b, g) }];
  });
  const ends = ports(endsOf(placed.map((p) => p.route)));
  const ported = placed.map(({ line, route }, i) => {
    const from = ends.get(`${String(i)}:a`) ?? { x: cx(route.a), y: cy(route.a) };
    const to = ends.get(`${String(i)}:b`) ?? { x: cx(route.b), y: cy(route.b) };
    return { line, route, from, to, legs: legsOf(i, route.spaces, [from, to]) };
  });
  const { at: lanes, needs } = laneLegs(ported.flatMap((p) => p.legs));
  const lines = ported.map(({ line, from, to, legs }) => {
    const corners = cornersOf(
      from,
      to,
      legs.map((leg) => ({ across: leg.space.across, at: lanes.get(leg) ?? leg.space.mid })),
    );
    const { d, mid, room } = pathOf(corners);
    return { ...line, d, mx: mid.x, my: mid.y, room };
  });
  return { lines, needs };
}
