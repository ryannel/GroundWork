import type { FlowEdge, FlowGraph, FlowNodeSpec } from '@/application/plan-viz-flow-graph';
import { PAD, portY } from '@/application/plan-viz-flow-size';

const VGAP = 28;
const GAP_MIN = 100;
const GAP_MAX = 240;
const SAT_INDENT = 34;

/** A node sits one column right of the first node that hands to it. */
function chainRanks(graph: FlowGraph): Map<string, number> {
  const rank = new Map<string, number>();
  const at = (id: string) => rank.get(id) ?? 0;
  for (const e of graph.edges.values()) {
    if (!rank.has(e.from)) rank.set(e.from, rank.has(e.to) ? at(e.to) - 1 : 0);
    if (!rank.has(e.to)) rank.set(e.to, at(e.from) + 1);
  }
  for (const [id, n] of graph.nodes) if (!rank.has(id) && !n.sat) rank.set(id, 0);
  return rank;
}

export function rankNodes(graph: FlowGraph): Map<string, number> {
  const rank = chainRanks(graph);
  const at = (id: string) => rank.get(id) ?? 0;
  const edges = [...graph.edges.values()];
  // a store that only receives sits right of everything that writes to it
  const receivers = [...graph.nodes.values()].filter(
    (n) => n.kind === 'store' && !n.sat && !edges.some((e) => e.from === n.id),
  );
  for (const { id } of receivers) {
    const writers = edges.filter((e) => e.to === id).map((e) => at(e.from) + 1);
    rank.set(id, Math.max(at(id), ...writers));
  }
  const lowest = Math.min(...rank.values());
  for (const [id, r] of rank) rank.set(id, r - lowest);
  return rank;
}

function columnsOf(graph: FlowGraph, rank: ReadonlyMap<string, number>): FlowNodeSpec[][] {
  const count = Math.max(...rank.values()) + 1;
  const cols: FlowNodeSpec[][] = Array.from({ length: count }, () => []);
  for (const n of graph.nodes.values()) {
    const r = rank.get(n.id);
    if (r !== undefined) cols[r]?.push(n);
  }
  return cols;
}

// The gap before a column is as wide as the widest label that rides into it.
function columnXs(
  graph: FlowGraph,
  cols: readonly FlowNodeSpec[][],
  rank: ReadonlyMap<string, number>,
): { xs: number[]; width: number } {
  const xs: number[] = [];
  let x = PAD;
  for (const [r, col] of cols.entries()) {
    const into = [...graph.edges.values()].filter((e) => !e.back && rank.get(e.to) === r);
    const gap =
      r === 0
        ? 0
        : Math.max(GAP_MIN, Math.min(GAP_MAX, Math.max(0, ...into.map((e) => e.lw)) + 40));
    x += gap;
    xs.push(x);
    x += Math.max(...col.map((n) => n.w), 0);
  }
  return { xs, width: x + PAD };
}

interface Placing {
  graph: FlowGraph;
  placed: Set<string>;
  firstSeen: readonly string[];
}

const placedPreds = (p: Placing, n: FlowNodeSpec): FlowEdge[] =>
  [...p.graph.edges.values()].filter((e) => e.to === n.id && !e.back && p.placed.has(e.from));

function barycentre(p: Placing, n: FlowNodeSpec): number {
  const preds = placedPreds(p, n);
  if (preds.length === 0) return p.firstSeen.indexOf(n.id) * 1e-3;
  return preds.reduce((s, e) => s + (p.graph.nodes.get(e.from)?.y ?? 0), 0) / preds.length;
}

// Satellites: the label, then the store, under the card on a trunk down its left edge.
function hangSatellites(graph: FlowGraph, n: FlowNodeSpec): void {
  let y = n.y + n.h + 10;
  for (const sat of n.sats) {
    const store = graph.nodes.get(sat.id);
    Object.assign(sat.r, { x: n.x + SAT_INDENT, y, w: sat.e.lw, h: sat.e.lh });
    if (store === undefined) continue;
    store.x = n.x + SAT_INDENT;
    store.y = y + sat.e.lh + 4;
    y = store.y + store.h + 12;
  }
  Object.assign(n, { fullH: y - 10 - n.y });
}

function placeNode(p: Placing, n: FlowNodeSpec, at: { x: number; cursor: number }): void {
  const into = [...p.graph.edges.values()].filter((e) => e.to === n.id && !e.back);
  // room above the entry line for the label that rides on it
  const above = Math.max(0, ...into.map((e) => e.lh + 6 - portY(n, e.via)));
  const pred = placedPreds(p, n)[0];
  const from = pred === undefined ? undefined : p.graph.nodes.get(pred.from);
  const want =
    pred === undefined || from === undefined
      ? at.cursor
      : from.y + portY(from, null) - portY(n, pred.via);
  Object.assign(n, { x: at.x, y: Math.max(at.cursor + above, want) });
  hangSatellites(p.graph, n);
  p.placed.add(n.id);
}

function byHeight(p: Placing) {
  return (a: FlowNodeSpec, b: FlowNodeSpec): number => {
    const d = barycentre(p, a) - barycentre(p, b);
    return d === 0 ? p.firstSeen.indexOf(a.id) - p.firstSeen.indexOf(b.id) : d;
  };
}

/**
 * Columns left to right, each ordered by the mean height of its callers and each node level with its first caller.
 * Returns the drawing's size.
 */
export function placeColumns(
  graph: FlowGraph,
  rank: ReadonlyMap<string, number>,
): { w: number; h: number } {
  const cols = columnsOf(graph, rank);
  const { xs, width } = columnXs(graph, cols, rank);
  const p: Placing = { graph, placed: new Set(), firstSeen: [...graph.nodes.keys()] };
  for (const [r, col] of cols.entries()) {
    const widest = Math.max(...col.map((q) => q.w));
    const ordered = r === 0 ? col : col.toSorted(byHeight(p));
    let cursor = PAD;
    for (const n of ordered) {
      placeNode(p, n, { x: (xs[r] ?? 0) + (widest - n.w) / 2, cursor });
      cursor = n.y + n.fullH + VGAP;
    }
  }
  const bottom = Math.max(...[...graph.nodes.values()].map((n) => n.y + n.h));
  return { w: width, h: bottom + PAD };
}
