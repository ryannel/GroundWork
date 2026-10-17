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
  readonly vias: ReadonlySet<string>;
  readonly flows: ReadonlySet<string>;
  readonly parts: ReadonlySet<string>;
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
  return {
    ...prev,
    vias: new Set([...prev.vias, ...l.vias]),
    flows: new Set([...prev.flows, ...l.flows]),
    parts: new Set([...prev.parts, `${l.a}|${l.b}`]),
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
): { readonly live: readonly Merged[]; readonly inner: readonly Link[] } {
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
function ports(all: readonly Pre[]): {
  readonly sy: readonly number[];
  readonly ty: readonly number[];
} {
  const ends = new Map<string, { readonly node: Box; readonly list: readonly End[] }>();
  const add = (node: Box, side: string, end: End): void => {
    const key = `${node.id}|${side}`;
    const known = ends.get(key) ?? { node, list: [] };
    ends.set(key, { node: known.node, list: [...known.list, end] });
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
}

function gapsOf(placed: Placed): Gap[][] {
  return placed.blocks.map((bl) => {
    const gs: Gap[] = [{ y: placed.top - 10 }];
    for (const [i, b] of bl.slice(0, -1).entries()) {
      gs.push({ y: (b.bottom + (bl[i + 1]?.top ?? b.bottom)) / 2 });
    }
    const last = bl.at(-1);
    if (last !== undefined) gs.push({ y: last.bottom + 14 });
    return gs;
  });
}

/** Hands out the gaps between cards and the brackets beside a column, spreading the lines that share one. */
interface Pass {
  /** The height to cross a column at, near the height the line wants. */
  readonly cross: (col: number, want: number) => number;
  /** How many brackets already sit beside the column. */
  readonly bracket: (col: number) => number;
}

const at = (x: number, y: number): string => `${String(round(x))} ${String(round(y))}`;

function passOver(placed: Placed): Pass {
  const gaps = gapsOf(placed);
  const used = new Map<Gap, number>();
  const brackets = new Map<number, number>();
  return {
    cross: (col, want) => {
      const [first, ...rest] = gaps[col] ?? [];
      if (first === undefined) return want;
      const cost = (g: Gap): number => Math.abs(g.y - want) + (used.get(g) ?? 0) * 8;
      const best = rest.reduce((pick, g) => (cost(g) < cost(pick) ? g : pick), first);
      const n = used.get(best) ?? 0;
      used.set(best, n + 1);
      return best.y + (OFFS[n % OFFS.length] ?? 0);
    },
    bracket: (col) => {
      const n = brackets.get(col) ?? 0;
      brackets.set(col, n + 1);
      return n;
    },
  };
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
  pass: Pass,
): { readonly pts: readonly Point[]; readonly lowest: number } {
  const dir = r.to.col > r.from.col ? 1 : -1;
  const pts: Point[] = [[e.sx, e.sy]];
  let lowest = 0;
  const between = Array.from(
    { length: Math.max(Math.abs(r.to.col - r.from.col) - 1, 0) },
    (_, k) => r.from.col + dir * (k + 1),
  );
  for (const c of between) {
    const x0 = colX(c);
    const gy = pass.cross(c, e.sy + (e.ty - e.sy) * ((x0 + CW / 2 - e.sx) / (e.tx - e.sx)));
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
): { readonly d: string; readonly tx: number; readonly lowest: number } {
  const sx = r.sa === 'R' ? r.from.x + r.from.w : r.from.x;
  const tx = r.sb === 'L' ? r.to.x : r.to.x + r.to.w;
  if (r.from.col !== r.to.col) {
    const { pts, lowest } = threaded(r, { sx, tx, ...y }, pass);
    return { d: curved(pts), tx, lowest };
  }
  const n = pass.bracket(r.from.col);
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
): { readonly routes: readonly Route[]; readonly h: number } {
  const all = live.map((l) => pre(l, nodes)).filter((r): r is Pre => r !== null);
  const { sy, ty } = ports(all);
  const pass = passOver(placed);
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
