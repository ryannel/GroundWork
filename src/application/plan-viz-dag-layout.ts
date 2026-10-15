import { tie } from '@/application/plan/derive-values';

// The dependency graph's geometry: columns by build order, rows by where the dependencies sit, and the edges between.

export const NODE_W = 164;
export const NODE_H = 110;
export const COL_GAP = 40;
const ROW_GAP = 14;
export const PAD = 16;
const BAND_H = 30;

const NO_MILESTONE = '__none';
const ALL = '__all';
const CORNER = 8;
const LOOP = 12;

export interface DagItem {
  readonly id: string;
  readonly milestone: string | undefined;
  readonly deps: readonly string[];
}

export interface DagBand {
  readonly id: string;
  readonly from: number;
  readonly to: number;
}

export interface Grid {
  readonly col: ReadonlyMap<string, number>;
  readonly row: ReadonlyMap<string, number>;
  readonly bands: readonly DagBand[];
  readonly nCols: number;
  readonly nRows: number;
}

export interface GridOptions {
  readonly milestones: readonly string[];
  readonly byMilestone: boolean;
  readonly critical: ReadonlySet<string>;
}

/** Every item one column right of its latest dependency; dependencies in another milestone band do not push it. */
function layers(items: readonly DagItem[], byMs: boolean): Map<string, number> {
  const layer = new Map<string, number>();
  const msOf = new Map(items.map((item) => [item.id, item.milestone]));
  for (const item of items) {
    let at = 0;
    for (const dep of item.deps) {
      const below = layer.get(dep);
      if (below === undefined || (byMs && msOf.get(dep) !== item.milestone)) continue;
      at = Math.max(at, below + 1);
    }
    layer.set(item.id, at);
  }
  return layer;
}

function groupOf(item: DagItem, opts: GridOptions): string {
  if (!opts.byMilestone) return ALL;
  return opts.milestones.includes(item.milestone ?? '') ? (item.milestone ?? '') : NO_MILESTONE;
}

function columns(items: readonly DagItem[], opts: GridOptions) {
  const layer = layers(items, opts.byMilestone);
  const groups = opts.byMilestone ? [...opts.milestones, NO_MILESTONE] : [ALL];
  const col = new Map<string, number>();
  const bands: DagBand[] = [];
  let base = 0;
  for (const group of groups) {
    const members = items.filter((item) => groupOf(item, opts) === group);
    if (members.length === 0) continue;
    const width = Math.max(...members.map((m) => layer.get(m.id) ?? 0)) + 1;
    for (const m of members) col.set(m.id, base + (layer.get(m.id) ?? 0));
    bands.push({ id: group, from: base, to: base + width - 1 });
    base += width;
  }
  return { col, bands, nCols: base };
}

const NO_DEPS = 1e6;

/** Rows within each column: the critical path on top, the rest by the middle of their dependencies' rows. */
function rowScores(items: readonly DagItem[]) {
  const row = new Map<string, number>();
  const rank = new Map(items.map((item, i) => [item.id, i]));
  const byId = new Map(items.map((item) => [item.id, item]));
  const score = (id: string): number => {
    const placed = (byId.get(id)?.deps ?? []).flatMap((d) => row.get(d) ?? []);
    if (placed.length === 0) return NO_DEPS + (rank.get(id) ?? 0);
    return placed.reduce((sum, r) => sum + r, 0) / placed.length;
  };
  return { row, score, rank };
}

export function gridOf(items: readonly DagItem[], opts: GridOptions): Grid {
  const { col, bands, nCols } = columns(items, opts);
  const { row, score, rank } = rowScores(items);
  let nRows = 0;
  for (let c = 0; c < nCols; c++) {
    const ids = items.filter((item) => col.get(item.id) === c).map((item) => item.id);
    ids.sort((a, b) =>
      tie(
        Number(opts.critical.has(b)) - Number(opts.critical.has(a)),
        score(a) - score(b),
        (rank.get(a) ?? 0) - (rank.get(b) ?? 0),
      ),
    );
    for (const [i, id] of ids.entries()) row.set(id, i);
    nRows = Math.max(nRows, ids.length);
  }
  return { col, row, bands, nCols, nRows };
}

export interface Frame {
  readonly top: number;
  readonly w: number;
  readonly h: number;
  readonly x: (id: string) => number;
  readonly y: (id: string) => number;
}

export function frameOf(grid: Grid, byMs: boolean): Frame {
  const top = PAD + (byMs ? BAND_H : 0);
  const cols = Math.max(grid.nCols, 1);
  const w = PAD * 2 + cols * NODE_W + (cols - 1) * COL_GAP;
  const h = top + grid.nRows * NODE_H + Math.max(grid.nRows - 1, 0) * ROW_GAP + PAD + PAD;
  return {
    top,
    w,
    h,
    x: (id) => PAD + (grid.col.get(id) ?? 0) * (NODE_W + COL_GAP),
    y: (id) => top + (grid.row.get(id) ?? 0) * (NODE_H + ROW_GAP),
  };
}

/** From (x1,y1) to (x2,y2), leaving right and entering left, with rounded corners; backwards edges loop below. */
export function orthogonal(
  from: { x: number; y: number },
  to: { x: number; y: number },
  midX: number,
) {
  const { x: x1, y: y1 } = from;
  const { x: x2, y: y2 } = to;
  if (Math.abs(y2 - y1) < 1) return `M${String(x1)},${String(y1)} H${String(x2)}`;
  if (x2 <= x1 + CORNER) {
    const low = Math.max(y1, y2) + NODE_H / 2 + 10;
    return `M${String(x1)},${String(y1)} H${String(x1 + LOOP)} V${String(low)} H${String(x2 - LOOP)} V${String(y2)} H${String(x2)}`;
  }
  const r = Math.min(CORNER, Math.abs(y2 - y1) / 2, Math.abs(midX - x1), Math.abs(x2 - midX));
  const dy = y2 > y1 ? 1 : -1;
  const n = String;
  return `M${n(x1)},${n(y1)} H${n(midX - r)} Q${n(midX)},${n(y1)} ${n(midX)},${n(y1 + dy * r)} V${n(y2 - dy * r)} Q${n(midX)},${n(y2)} ${n(midX + r)},${n(y2)} H${n(x2)}`;
}
