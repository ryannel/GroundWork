import { type Point, type Rect, overlaps, simplify } from '@/application/plan-viz-flow-geometry';
import type { FlowEdge, FlowGraph, FlowNodeSpec } from '@/application/plan-viz-flow-graph';
import { PAD, portY } from '@/application/plan-viz-flow-size';

/** An arrow with the route it takes and the rectangle its label sits in. */
export interface Routed {
  readonly e: FlowEdge;
  readonly pts: readonly Point[];
  readonly r: Rect | null;
  /** A satellite store's short trunk. */
  readonly sat?: boolean;
}

interface Box extends Rect {
  readonly id: string;
}

/** The stretch of a route a label rides above (or, when `under`, below). */
interface Stretch {
  readonly from: number;
  readonly to: number;
  readonly y: number;
  readonly under: boolean;
}

interface Ctx {
  readonly rects: readonly Box[];
  readonly loops: ReadonlyMap<string, number>;
  /** The next free lane under the drawing. */
  readonly below: number;
  readonly labels: readonly Rect[];
  readonly routed: readonly Routed[];
}

const LEAD = 18;
const TRUNKS = 3;
const SPACING = 6;
const LOOP_GAP = 14;
const LANE = 16;

const blocked = (
  ctx: Ctx,
  run: {
    readonly xs: readonly [number, number];
    readonly y: number;
    readonly skip: readonly string[];
  },
) =>
  ctx.rects.some((q) => {
    const across = run.y > q.y - 4 && run.y < q.y + q.h + 4;
    const along = Math.max(...run.xs) > q.x && Math.min(...run.xs) < q.x + q.w;
    return !run.skip.includes(q.id) && across && along;
  });

interface Ends {
  readonly e: FlowEdge;
  readonly a: FlowNodeSpec;
  readonly b: FlowNodeSpec;
  readonly sx: number;
  readonly sy: number;
  readonly tx: number;
  readonly ty: number;
  /** x of the vertical leaving the source, offset by trunk so parallel arrows do not overlap. */
  readonly bx: number;
}

function endsOf(e: FlowEdge, [a, b]: readonly [FlowNodeSpec, FlowNodeSpec], trunk: number): Ends {
  const sx = a.x + a.w;
  const bx = sx + LEAD + trunk * SPACING;
  return { e, a, b, sx, sy: a.y + portY(a, null), tx: b.x, ty: b.y + portY(b, e.via), bx };
}

interface Route {
  readonly pts: readonly Point[];
  readonly seg: Stretch;
  /** The lane the next hop back from the same source takes. */
  readonly loop?: number;
  /** The next free lane under the drawing, once this route has taken one. */
  readonly below?: number;
}

// A hop back to an earlier column: a short loop under the source's row, not a box around the canvas.
function loopRoute(ctx: Ctx, ends: Ends, lane: number | null): Route {
  const { e, a, sx, sy, tx, ty, bx } = ends;
  const ex = tx - LEAD;
  const from = Math.min(bx, ex);
  const to = Math.max(bx, ex);
  const band = ctx.rects.filter((q) => q.x < to && q.x + q.w > from && q.y <= a.y + a.h);
  const y = lane ?? Math.max(a.y + a.fullH, ...band.map((q) => q.y + q.h)) + LOOP_GAP;
  return {
    pts: [
      [sx, sy],
      [bx, sy],
      [bx, y],
      [ex, y],
      [ex, ty],
      [tx, ty],
    ],
    seg: { from, to, y, under: true },
    loop: y + LANE + e.lh,
  };
}

function routeOf(ctx: Ctx, ends: Ends): Route {
  const { e, sx, sy, tx, ty, bx } = ends;
  const skip = [e.from, e.to];
  if (!e.back && !blocked(ctx, { xs: [bx, tx], y: ty, skip })) {
    return {
      pts: [
        [sx, sy],
        [bx, sy],
        [bx, ty],
        [tx, ty],
      ],
      seg: { from: bx, to: tx, y: ty, under: false },
    };
  }
  if (!e.back && !blocked(ctx, { xs: [sx, tx - LEAD], y: sy, skip })) {
    return {
      pts: [
        [sx, sy],
        [tx - LEAD, sy],
        [tx - LEAD, ty],
        [tx, ty],
      ],
      seg: { from: sx + 12, to: tx - LEAD, y: sy, under: false },
    };
  }
  if (e.back) return loopRoute(ctx, ends, ctx.loops.get(e.from) ?? null);
  const lane = ctx.below;
  return { ...loopRoute(ctx, ends, lane), below: lane + LANE };
}

const stretches = (pts: readonly Point[]): Rect[] =>
  pts.slice(1).map((p, k) => {
    const q = pts[k] ?? p;
    return {
      x: Math.min(p[0], q[0]),
      y: Math.min(p[1], q[1]),
      w: Math.abs(p[0] - q[0]),
      h: Math.abs(p[1] - q[1]),
    };
  });

function clashes(
  ctx: Ctx,
  q: Rect,
  edge: { readonly e: FlowEdge; readonly skipTarget: boolean },
): boolean {
  const { e, skipTarget } = edge;
  if (ctx.rects.some((n) => (!skipTarget || n.id !== e.to) && overlaps(q, n, 2))) return true;
  if (ctx.labels.some((n) => overlaps(q, n, 2))) return true;
  return ctx.routed.some(
    (o) => o.e.from !== e.from && stretches(o.pts).some((s) => overlaps(q, s, 1)),
  );
}

// The label rides above the entry line, centred in it; below the line when it would sit on something else.
function labelRect(ctx: Ctx, e: FlowEdge, seg: Stretch): Rect {
  const x = Math.max(seg.from + 8, (seg.from + seg.to) / 2 - e.lw / 2);
  const r = { x, y: seg.under ? seg.y + 6 : seg.y - e.lh - 4, w: e.lw, h: e.lh };
  if (!clashes(ctx, r, { e, skipTarget: true })) return r;
  const lower = { ...r, y: seg.y + 6 };
  return clashes(ctx, lower, { e, skipTarget: false }) ? r : lower;
}

function routeEdge(ctx: Ctx, ends: Ends): { readonly route: Route; readonly routed: Routed } {
  const { e } = ends;
  const route = routeOf(ctx, ends);
  const pts = simplify(route.pts);
  const r = e.lines.length === 0 ? null : labelRect(ctx, e, route.seg);
  return { route, routed: { e, pts, r } };
}

function satelliteRoutes(graph: FlowGraph): readonly Routed[] {
  return [...graph.nodes.values()].flatMap((n) =>
    n.sats.flatMap((sat): readonly Routed[] => {
      const store = graph.nodes.get(sat.id);
      if (store === undefined) return [];
      const x = n.x + 16;
      const y = store.y + portY(store, null);
      const pts: readonly Point[] = [
        [x, n.y + n.h],
        [x, y],
        [store.x, y],
      ];
      return [{ e: sat.e, pts, r: sat.r, sat: true }];
    }),
  );
}

const endNodes = (graph: FlowGraph, e: FlowEdge): readonly [FlowNodeSpec, FlowNodeSpec] | null => {
  const a = graph.nodes.get(e.from);
  const b = graph.nodes.get(e.to);
  return a === undefined || b === undefined ? null : [a, b];
};

/** Every arrow's route and label, and the drawing's height once the loops under the cards are in. */
export function routeEdges(
  graph: FlowGraph,
  height: number,
): { readonly routed: readonly Routed[]; readonly h: number } {
  const rects = [...graph.nodes.values()]
    .filter((n) => !n.sat)
    .map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.fullH, id: n.id }));
  const trunks = new Map<string, number>();
  const loops = new Map<string, number>();
  const labels: Rect[] = [];
  const routed: Routed[] = [];
  let below = height - PAD + 12;
  for (const e of graph.edges.values()) {
    const pair = endNodes(graph, e);
    if (pair === null) continue;
    const trunk = trunks.get(e.from) ?? trunks.size % TRUNKS;
    trunks.set(e.from, trunk);
    const done = routeEdge({ rects, loops, below, labels, routed }, endsOf(e, pair, trunk));
    if (done.route.loop !== undefined) loops.set(e.from, done.route.loop);
    below = done.route.below ?? below;
    if (done.routed.r !== null) labels.push(done.routed.r);
    routed.push(done.routed);
  }
  const h = Math.max(height, below + 8, ...labels.map((r) => r.y + r.h + PAD));
  return { routed: [...routed, ...satelliteRoutes(graph)], h };
}
