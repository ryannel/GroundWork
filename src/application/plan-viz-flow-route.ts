import { type Point, type Rect, overlaps, simplify } from '@/application/plan-viz-flow-geometry';
import type { FlowEdge, FlowGraph, FlowNodeSpec } from '@/application/plan-viz-flow-graph';
import { PAD, portY } from '@/application/plan-viz-flow-size';

/** An arrow with the route it takes and the rectangle its label sits in. */
export interface Routed {
  e: FlowEdge;
  pts: Point[];
  r: Rect | null;
  /** A satellite store's short trunk. */
  sat?: boolean;
}

interface Box extends Rect {
  id: string;
}

/** The stretch of a route a label rides above (or, when `under`, below). */
interface Stretch {
  from: number;
  to: number;
  y: number;
  under: boolean;
}

interface Ctx {
  graph: FlowGraph;
  rects: Box[];
  trunks: Map<string, number>;
  loops: Map<string, number>;
  below: { y: number };
  labels: Rect[];
  routed: Routed[];
}

const LEAD = 18;
const TRUNKS = 3;
const SPACING = 6;
const LOOP_GAP = 14;
const LANE = 16;

const blocked = (ctx: Ctx, run: { xs: readonly [number, number]; y: number; skip: string[] }) =>
  ctx.rects.some(
    (q) =>
      !run.skip.includes(q.id) &&
      run.y > q.y - 4 &&
      run.y < q.y + q.h + 4 &&
      Math.max(...run.xs) > q.x &&
      Math.min(...run.xs) < q.x + q.w,
  );

interface Ends {
  e: FlowEdge;
  a: FlowNodeSpec;
  b: FlowNodeSpec;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  /** x of the vertical leaving the source, offset by trunk so parallel arrows do not overlap. */
  bx: number;
}

function endsOf(ctx: Ctx, e: FlowEdge): Ends | null {
  const a = ctx.graph.nodes.get(e.from);
  const b = ctx.graph.nodes.get(e.to);
  if (a === undefined || b === undefined) return null;
  if (!ctx.trunks.has(e.from)) ctx.trunks.set(e.from, ctx.trunks.size % TRUNKS);
  const sx = a.x + a.w;
  const bx = sx + LEAD + (ctx.trunks.get(e.from) ?? 0) * SPACING;
  return { e, a, b, sx, sy: a.y + portY(a, null), tx: b.x, ty: b.y + portY(b, e.via), bx };
}

interface Route {
  pts: Point[];
  seg: Stretch;
}

// A hop back to an earlier column: a short loop under the source's row, not a box around the canvas.
function loopRoute(ctx: Ctx, ends: Ends, lane: number | null): Route {
  const { e, a, sx, sy, tx, ty, bx } = ends;
  const ex = tx - LEAD;
  const from = Math.min(bx, ex);
  const to = Math.max(bx, ex);
  let y = lane;
  if (y === null) {
    const band = ctx.rects.filter((q) => q.x < to && q.x + q.w > from && q.y <= a.y + a.h);
    y = Math.max(a.y + a.fullH, ...band.map((q) => q.y + q.h)) + LOOP_GAP;
    ctx.loops.set(e.from, y + LANE + e.lh);
  } else ctx.loops.set(e.from, y + LANE + e.lh);
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
  const lane = ctx.below.y;
  Object.assign(ctx.below, { y: lane + LANE });
  return loopRoute(ctx, ends, lane);
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

function clashes(ctx: Ctx, q: Rect, edge: { e: FlowEdge; skipTarget: boolean }): boolean {
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

function routeEdge(ctx: Ctx, e: FlowEdge): void {
  const ends = endsOf(ctx, e);
  if (ends === null) return;
  const route = routeOf(ctx, ends);
  const pts = simplify(route.pts);
  if (e.lines.length === 0) {
    ctx.routed.push({ e, pts, r: null });
    return;
  }
  const r = labelRect(ctx, e, route.seg);
  ctx.labels.push(r);
  ctx.routed.push({ e, pts, r });
}

function routeSatellites(ctx: Ctx): void {
  for (const n of ctx.graph.nodes.values()) {
    for (const sat of n.sats) {
      const store = ctx.graph.nodes.get(sat.id);
      if (store === undefined) continue;
      const x = n.x + 16;
      const y = store.y + portY(store, null);
      const pts: Point[] = [
        [x, n.y + n.h],
        [x, y],
        [store.x, y],
      ];
      ctx.routed.push({ e: sat.e, pts, r: sat.r, sat: true });
    }
  }
}

/** Every arrow's route and label, and the drawing's height once the loops under the cards are in. */
export function routeEdges(graph: FlowGraph, height: number): { routed: Routed[]; h: number } {
  const rects = [...graph.nodes.values()]
    .filter((n) => !n.sat)
    .map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.fullH, id: n.id }));
  const ctx: Ctx = {
    graph,
    rects,
    trunks: new Map(),
    loops: new Map(),
    below: { y: height - PAD + 12 },
    labels: [],
    routed: [],
  };
  for (const e of graph.edges.values()) routeEdge(ctx, e);
  routeSatellites(ctx);
  const h = Math.max(height, ctx.below.y + 8, ...ctx.labels.map((r) => r.y + r.h + PAD));
  return { routed: ctx.routed, h };
}
