import { roundPath, type Point } from '@/application/plan-viz-flow-geometry';
import { CW, type Box } from '@/application/plan-viz-system-map-boxes';
import type { Columns } from '@/application/plan-viz-system-map-columns';
import { colX, type Placed } from '@/application/plan-viz-system-map-geometry';
import type { Aggregate, Link } from '@/application/plan-viz-system-map-links';
import type { LineKind } from '@/application/plan-viz-system-map-types';

// The line between two cards: where it leaves and lands, and the gaps it passes through on the way.

/** What several lines between the same two drawn things have in common. */
export interface Merged {
  readonly key: string;
  readonly kind: LineKind;
  readonly a: string;
  readonly b: string;
  readonly shownA: string;
  readonly shownB: string;
  readonly hostA: string;
  readonly hostB: string;
  readonly row: string | null;
  readonly vias: Set<string>;
  readonly flows: Set<string>;
  readonly parts: Set<string>;
  readonly read: boolean;
  readonly write: boolean;
  /** Only a stage says so: no flow walks it yet. */
  readonly noted: boolean;
}

export interface Route {
  readonly line: Merged;
  readonly from: Box;
  readonly to: Box;
  /** The side of the far card the line lands on. */
  readonly into: 1 | -1;
  readonly d: string;
  readonly tx: number;
  readonly ty: number;
}

const OFFS = [0, -5, 5, -10, 10];
const round = (n: number): number => Math.round(n * 100) / 100;

interface Seen {
  readonly agg: Aggregate;
  readonly nodes: ReadonlyMap<string, Box>;
}

function startOf(seen: Seen, l: Link, row: string | null): Merged {
  const shown = (id: string): string => seen.nodes.get(id)?.id ?? id;
  const host = (id: string): string => seen.agg.hostOfSat.get(id) ?? id;
  return {
    key: `${l.kind}|${shown(l.a)}|${shown(l.b)}|${row ?? ''}`,
    kind: l.kind,
    a: l.a,
    b: l.b,
    shownA: shown(l.a),
    shownB: shown(l.b),
    hostA: shown(host(l.a)),
    hostB: shown(host(l.b)),
    row,
    vias: new Set(),
    flows: new Set(),
    parts: new Set(),
    read: false,
    write: false,
    noted: l.flags.has('hand') && !l.flags.has('walked'),
  };
}

function joined(prev: Merged, l: Link): Merged {
  for (const v of l.vias) prev.vias.add(v);
  for (const f of l.flows) prev.flows.add(f);
  prev.parts.add(`${l.a}|${l.b}`);
  return {
    ...prev,
    read: prev.read || l.flags.has('read'),
    write: prev.write || l.flags.has('write'),
    noted: prev.noted && l.flags.has('hand') && !l.flags.has('walked'),
  };
}

/** Lines are drawn between what is on screen: a folded system's parts share its card, so their lines merge. */
export function mergeLinks(
  agg: Aggregate,
  cols: Columns,
  nodes: ReadonlyMap<string, Box>,
): { readonly live: Merged[]; readonly inner: Link[] } {
  const inner: Link[] = [];
  const merged = new Map<string, Merged>();
  for (const l of agg.links.filter((x) => nodes.has(x.a) && nodes.has(x.b))) {
    if (cols.isInternal(l)) {
      inner.push(l);
      continue;
    }
    const row =
      l.row !== null && nodes.get(l.b)?.rows.some((r) => r.id === l.row) === true ? l.row : null;
    const start = startOf({ agg, nodes }, l, row);
    const next = joined(merged.get(start.key) ?? start, l);
    merged.set(start.key, next);
  }
  return { live: [...merged.values()], inner };
}

interface Pre {
  readonly line: Merged;
  readonly from: Box;
  readonly to: Box;
  readonly sa: 'L' | 'R';
  readonly sb: 'L' | 'R';
  readonly rowCy: number | null;
}

const mid = (n: Box): number => n.y + n.h / 2;

function sides(from: Box, to: Box): Pick<Pre, 'sa' | 'sb'> {
  return { sa: from.col > to.col ? 'L' : 'R', sb: from.col < to.col ? 'L' : 'R' };
}

function pre(line: Merged, nodes: ReadonlyMap<string, Box>): Pre | null {
  const from = nodes.get(line.a);
  const to = nodes.get(line.b);
  if (from === undefined || to === undefined) return null;
  const row = line.row === null ? undefined : to.rows.find((r) => r.id === line.row);
  return { line, from, to, ...sides(from, to), rowCy: row?.cy ?? null };
}

function reach(n: Box): readonly [number, number] {
  if (n.kind === 'service') return [n.y + 12, n.y + n.head - 10];
  if (n.kind === 'system') return [n.y + 12, n.y + n.h - 10];
  return [n.y + 6, n.y + n.h - 6];
}

function lone(n: Box): number {
  return n.kind === 'service' ? n.y + 23 : n.y + n.h / 2;
}

interface End {
  readonly i: number;
  readonly out: boolean;
  readonly oy: number;
}

/** Where each end on one card side sits: spread over the card's reach, in the order of the far ends. */
function spread(node: Box, list: readonly End[]): Map<number, number> {
  const [lo, hi] = reach(node);
  const sorted = list.toSorted((a, b) => a.oy - b.oy);
  return new Map(
    sorted.map((e, k) => [
      e.i,
      list.length === 1 ? lone(node) : round(lo + ((k + 0.5) * (hi - lo)) / list.length),
    ]),
  );
}

/** Spread the ends that share a card side, ordered by where the other end is. */
function ports(all: readonly Pre[]): { readonly sy: number[]; readonly ty: number[] } {
  const ends = new Map<string, { node: Box; list: End[] }>();
  const add = (node: Box, side: string, end: End): void => {
    const key = `${node.id}|${side}`;
    const known = ends.get(key) ?? { node, list: [] };
    known.list.push(end);
    ends.set(key, known);
  };
  for (const [i, r] of all.entries()) {
    add(r.from, r.sa, { i, out: true, oy: mid(r.to) });
    if (r.rowCy === null) add(r.to, r.sb, { i, out: false, oy: mid(r.from) });
  }
  const sy: number[] = all.map(() => 0);
  const ty: number[] = all.map((r) => r.rowCy ?? 0);
  for (const { node, list } of ends.values()) {
    const where = spread(node, list);
    for (const e of list) (e.out ? sy : ty)[e.i] = where.get(e.i) ?? 0;
  }
  return { sy, ty };
}

interface Gap {
  readonly y: number;
  n: number;
}

function gapsOf(placed: Placed): Gap[][] {
  return placed.blocks.map((bl) => {
    const gs: Gap[] = [{ y: placed.top - 10, n: 0 }];
    for (const [i, b] of bl.slice(0, -1).entries())
      gs.push({ y: (b.bottom + (bl[i + 1]?.top ?? b.bottom)) / 2, n: 0 });
    const last = bl.at(-1);
    if (last !== undefined) gs.push({ y: last.bottom + 14, n: 0 });
    return gs;
  });
}

interface Pass {
  readonly gaps: Gap[][];
  readonly brackets: Map<number, number>;
}

const at = (x: number, y: number): string => `${String(round(x))} ${String(round(y))}`;

/** The gap in a column closest to the height the line wants, spreading lines that share one. */
function nearestGap(gaps: readonly Gap[], want: number): Gap {
  const cost = (g: Gap): number => Math.abs(g.y - want) + g.n * 8;
  return gaps.reduce((best, g) => (cost(g) < cost(best) ? g : best), gaps[0] ?? { y: want, n: 0 });
}

interface Ends {
  readonly sx: number;
  readonly tx: number;
  readonly sy: number;
  readonly ty: number;
}

function threaded(
  r: Pre,
  e: Ends,
  gaps: readonly (readonly Gap[])[],
): { pts: Point[]; lowest: number } {
  const dir = r.to.col > r.from.col ? 1 : -1;
  const pts: Point[] = [[e.sx, e.sy]];
  let lowest = 0;
  const between = Array.from(
    { length: Math.max(Math.abs(r.to.col - r.from.col) - 1, 0) },
    (_, k) => r.from.col + dir * (k + 1),
  );
  for (const c of between) {
    const x0 = colX(c);
    const g = nearestGap(
      gaps[c] ?? [],
      e.sy + (e.ty - e.sy) * ((x0 + CW / 2 - e.sx) / (e.tx - e.sx)),
    );
    const gy = g.y + (OFFS[g.n % OFFS.length] ?? 0);
    g.n += 1;
    lowest = Math.max(lowest, gy);
    const [near, far] = dir > 0 ? [x0 - 6, x0 + CW + 6] : [x0 + CW + 6, x0 - 6];
    pts.push([near, gy], [far, gy]);
  }
  pts.push([e.tx, e.ty]);
  return { pts, lowest };
}

/** Straight through each gap, curved between columns. */
function curved(pts: readonly Point[]): string {
  const first = pts[0] ?? [0, 0];
  const steps = pts.slice(1).map(([qx, qy], k) => {
    const [px, py] = pts[k] ?? [qx, qy];
    const flat = (k + 1) % 2 === 0 && k + 2 < pts.length;
    const h = (qx - px) / 2;
    return flat || py === qy
      ? ` L${at(qx, qy)}`
      : ` C${at(px + h, py)} ${at(qx - h, qy)} ${at(qx, qy)}`;
  });
  return `M${at(first[0], first[1])}${steps.join('')}`;
}

function pathFor(
  r: Pre,
  y: { readonly sy: number; readonly ty: number },
  pass: Pass,
): { d: string; tx: number; lowest: number } {
  const sx = r.sa === 'R' ? r.from.x + r.from.w : r.from.x;
  const tx = r.sb === 'L' ? r.to.x : r.to.x + r.to.w;
  if (r.from.col !== r.to.col) {
    const { pts, lowest } = threaded(r, { sx, tx, ...y }, pass.gaps);
    return { d: curved(pts), tx, lowest };
  }
  const n = pass.brackets.get(r.from.col) ?? 0;
  pass.brackets.set(r.from.col, n + 1);
  const bx = colX(r.from.col) + CW + 12 + (n % 5) * 6;
  return {
    d: roundPath(
      [
        [sx, y.sy],
        [bx, y.sy],
        [bx, y.ty],
        [tx, y.ty],
      ],
      6,
    ),
    tx,
    lowest: 0,
  };
}

export function routeAll(
  live: readonly Merged[],
  nodes: ReadonlyMap<string, Box>,
  placed: Placed,
): { readonly routes: Route[]; readonly h: number } {
  const all = live.map((l) => pre(l, nodes)).filter((r): r is Pre => r !== null);
  const { sy, ty } = ports(all);
  const pass: Pass = { gaps: gapsOf(placed), brackets: new Map() };
  const paths = all.map((r, i) => pathFor(r, { sy: sy[i] ?? 0, ty: ty[i] ?? 0 }, pass));
  const routes = all.map((r, i): Route => ({
    line: r.line,
    from: r.from,
    to: r.to,
    into: r.sb === 'L' ? 1 : -1,
    d: paths[i]?.d ?? '',
    tx: paths[i]?.tx ?? 0,
    ty: ty[i] ?? 0,
  }));
  return { routes, h: Math.max(placed.h, ...paths.map((p) => p.lowest)) };
}
