// Where each screen sits on the screen map, and how the lines between them run. A screen has one position;
// selecting and opening never move it. The lines run at right angles: shared controls, returns, parallel controls
// and skipped ranks go round the outside, in lanes of their own.

export interface FlowBox {
  readonly id: string;
}

export interface FlowLine {
  readonly id: string;
  readonly source: string;
  readonly destination: string;
  /** Several controls on the source screen start it: drawn once from the screen, kept off the main path. */
  readonly shared?: boolean;
}

export interface Size {
  readonly w: number;
  readonly h: number;
}

export interface Placed extends Size {
  readonly id: string;
  readonly rank: number;
  readonly x: number;
  readonly y: number;
}

export interface Routed {
  readonly id: string;
  readonly outside: boolean;
  readonly points: readonly (readonly [number, number])[];
  readonly label: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  };
}

export interface ScreenFlowLayout {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly Placed[];
  readonly edges: readonly Routed[];
}

export interface LayoutSizes {
  readonly node?: ReadonlyMap<string, Size>;
  readonly label?: ReadonlyMap<string, Size>;
}

const NODE: Size = { w: 188, h: 86 };
const LABEL: Size = { w: 132, h: 30 };
const GAP_X = 44;
const PAD = 12;
const LANE = 12;

interface Gap {
  readonly top: number;
  readonly h: number;
  readonly outgoing: readonly FlowLine[];
  readonly incoming: readonly FlowLine[];
}

const get = <T>(map: ReadonlyMap<string, T>, id: string, fallback: T): T => map.get(id) ?? fallback;

interface Ranked {
  readonly ranks: ReadonlyMap<string, number>;
  readonly forward: ReadonlySet<string>;
}

/** The edges that run forward (a depth-first walk from the entrances; a return never forces another box). */
function forwardEdges(nodes: readonly FlowBox[], links: readonly FlowLine[]): Set<string> {
  const colour = new Map<string, 1 | 2>();
  const forward = new Set<string>();
  const visit = (id: string): void => {
    colour.set(id, 1);
    const leads = (edge: FlowLine): boolean =>
      edge.shared !== true && edge.source === id && edge.destination !== id;
    for (const edge of links) {
      if (!leads(edge) || colour.get(edge.destination) === 1) continue;
      forward.add(edge.id);
      if (!colour.has(edge.destination)) visit(edge.destination);
    }
    colour.set(id, 2);
  };
  const entered = (id: string): boolean =>
    links.some((e) => e.shared !== true && e.destination === id && e.source !== id);
  const roots = nodes.filter((n) => !entered(n.id));
  for (const node of [...roots, ...nodes]) if (!colour.has(node.id)) visit(node.id);
  return forward;
}

/** Push each forward edge's target below its source; null once nothing moves. */
function relaxRanks(
  ranks: ReadonlyMap<string, number>,
  links: readonly FlowLine[],
  forward: ReadonlySet<string>,
): ReadonlyMap<string, number> | null {
  const relaxed = new Map(ranks);
  let changed = false;
  for (const edge of links.filter((e) => forward.has(e.id))) {
    const next = get(relaxed, edge.source, 0) + 1;
    if (next > get(relaxed, edge.destination, 0)) {
      relaxed.set(edge.destination, next);
      changed = true;
    }
  }
  return changed ? relaxed : null;
}

function rankNodes(nodes: readonly FlowBox[], links: readonly FlowLine[]): Ranked {
  const forward = forwardEdges(nodes, links);
  let settled: ReadonlyMap<string, number> = new Map(nodes.map((n) => [n.id, 0]));
  for (
    let next = relaxRanks(settled, links, forward);
    next !== null;
    next = relaxRanks(settled, links, forward)
  ) {
    settled = next;
  }
  const ranks = new Map(settled);
  const connected = new Set(
    links
      .filter((e) => e.shared !== true && e.source !== e.destination)
      .flatMap((e) => [e.source, e.destination]),
  );
  const last = Math.max(0, ...ranks.values());
  // A screen reached only through a shared control sits apart from the main path.
  for (const node of nodes) {
    if (!connected.has(node.id) && connected.size > 0) ranks.set(node.id, last + 1);
  }
  return { ranks, forward };
}

/** The edges that cannot run straight down between two neighbouring ranks. */
function outsideEdges(links: readonly FlowLine[], ranked: Ranked): FlowLine[] {
  const usedPair = new Set<string>();
  const usedEntrance = new Set<string>();
  return links.filter((edge) => {
    const pair = `${edge.source}|${edge.destination}`;
    const offRank =
      !ranked.forward.has(edge.id) ||
      get(ranked.ranks, edge.destination, 0) !== get(ranked.ranks, edge.source, 0) + 1;
    const used = usedPair.has(pair) || usedEntrance.has(edge.destination);
    const outside = edge.shared === true || offRank || used;
    usedPair.add(pair);
    if (!outside) usedEntrance.add(edge.destination);
    return outside;
  });
}

interface Grid {
  readonly rects: readonly Placed[];
  readonly gaps: readonly Gap[];
  readonly bodyWidth: number;
  readonly bottom: number;
}

interface Context {
  readonly links: readonly FlowLine[];
  readonly ranked: Ranked;
  readonly external: readonly FlowLine[];
  readonly dims: ReadonlyMap<string, Size>;
  readonly labels: ReadonlyMap<string, Size>;
}

const labelOf = (cx: Context, id: string): Size => get(cx.labels, id, LABEL);
const rankOf = (cx: Context, id: string): number => get(cx.ranked.ranks, id, 0);

const levelsOf = (nodes: readonly FlowBox[], cx: Context): FlowBox[][] => {
  const levels: FlowBox[][] = [];
  for (const node of nodes) {
    const rank = rankOf(cx, node.id);
    levels[rank] = [...(levels[rank] ?? []), node];
  }
  return levels;
};

/** The room under one level for the labels, lanes and entrances that cross it. */
function gapUnder(rank: number, cx: Context): Omit<Gap, 'top'> {
  const externalIds = new Set(cx.external.map((e) => e.id));
  const outgoing = cx.external.filter((e) => rankOf(cx, e.source) === rank);
  const incoming = cx.external.filter((e) => rankOf(cx, e.destination) === rank + 1);
  const local = cx.links.filter((e) => !externalIds.has(e.id) && rankOf(cx, e.source) === rank);
  const direct = local.length > 0 ? Math.max(...local.map((e) => labelOf(cx, e.id).h)) + 34 : 24;
  const side = outgoing.reduce((sum, e) => sum + labelOf(cx, e.id).h + 14, 0);
  return { h: Math.max(direct, side + 12) + incoming.length * 6 + 8, outgoing, incoming };
}

/** Boxes level by level, with the gap under each level sized for what crosses it. */
function placeLevels(nodes: readonly FlowBox[], cx: Context): Grid {
  const levels = levelsOf(nodes, cx);
  const dimOf = (id: string): Size => get(cx.dims, id, NODE);
  const widths = levels.map(
    (l) => l.reduce((sum, n) => sum + dimOf(n.id).w, 0) + GAP_X * (l.length - 1),
  );
  const bodyWidth = Math.max(0, ...widths);
  const rects: Placed[] = [];
  const gaps: Gap[] = [];
  let y = PAD;
  for (const [rank, level] of levels.entries()) {
    let x = PAD + (bodyWidth - (widths[rank] ?? 0)) / 2;
    const height = Math.max(...level.map((n) => dimOf(n.id).h));
    for (const node of level) {
      const { w, h } = dimOf(node.id);
      rects.push({ id: node.id, rank, x, y, w, h });
      x += w + GAP_X;
    }
    const gap = gapUnder(rank, cx);
    gaps[rank] = { top: y + height, ...gap };
    y += height + (rank === levels.length - 1 && gap.outgoing.length === 0 ? 12 : gap.h);
  }
  return { rects, gaps, bodyWidth, bottom: y };
}

interface Route {
  readonly cx: Context;
  readonly grid: Grid;
  readonly firstIncoming: readonly FlowLine[];
  readonly gutter: number;
}

function routeOutside(
  edge: FlowLine,
  ends: { readonly source: Placed; readonly target: Placed },
  route: Route,
): Routed {
  const { cx, grid } = route;
  const { source, target } = ends;
  const { w, h } = labelOf(cx, edge.id);
  const gap = grid.gaps[source.rank];
  const outgoing = gap?.outgoing ?? [];
  const before = outgoing.slice(0, outgoing.indexOf(edge));
  const slotY =
    (gap?.top ?? 0) + 12 + before.reduce((s, e) => s + labelOf(cx, e.id).h + 14, 0) + h / 2;
  const lane = PAD + grid.bodyWidth + route.gutter + cx.external.indexOf(edge) * LANE;
  const incoming =
    target.rank > 0 ? (grid.gaps[target.rank - 1]?.incoming ?? []) : route.firstIncoming;
  const approach = target.y - 8 - incoming.indexOf(edge) * 6;
  const tx = target.x + target.w / 2;
  // A distinct source port keeps a loop's source and destination legs apart.
  const port = source.x + source.w - 8;
  const sy = source.y + source.h;
  return {
    id: edge.id,
    outside: true,
    points: [
      [port, sy],
      [port, slotY],
      [lane, slotY],
      [lane, approach],
      [tx, approach],
      [tx, target.y],
    ],
    label: { x: PAD + grid.bodyWidth + 14, y: slotY - h / 2, w, h },
  };
}

function routeDirect(
  edge: FlowLine,
  ends: { readonly source: Placed; readonly target: Placed },
  route: Route,
): Routed {
  const { cx, grid } = route;
  const { source, target } = ends;
  const { w, h } = labelOf(cx, edge.id);
  const externalIds = new Set(cx.external.map((e) => e.id));
  const siblings = cx.links.filter(
    (e) => !externalIds.has(e.id) && rankOf(cx, e.source) === source.rank,
  );
  const top = grid.gaps[source.rank]?.top ?? 0;
  const turn = top + 12 + siblings.indexOf(edge) * 5;
  const slotY = top + 18 + h / 2;
  const sx = source.x + source.w / 2;
  const tx = target.x + target.w / 2;
  return {
    id: edge.id,
    outside: false,
    points: [
      [sx, source.y + source.h],
      [sx, turn],
      [tx, turn],
      [tx, target.y],
    ],
    label: { x: tx - w / 2, y: slotY - h / 2, w, h },
  };
}

function routeAll(rects: readonly Placed[], route: Route): Routed[] {
  const byId = new Map(rects.map((r) => [r.id, r]));
  const externalIds = new Set(route.cx.external.map((e) => e.id));
  const routed: Routed[] = [];
  for (const edge of route.cx.links) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.destination);
    if (source === undefined || target === undefined) continue;
    const ends = { source, target };
    routed.push(
      externalIds.has(edge.id) ? routeOutside(edge, ends, route) : routeDirect(edge, ends, route),
    );
  }
  return routed;
}

/** Place the screens and route every line between them. Coordinates are drawing pixels. */
export function layoutScreenFlow(
  nodes: readonly FlowBox[],
  edges: readonly FlowLine[],
  sizes: LayoutSizes = {},
): ScreenFlowLayout {
  const ids = new Set(nodes.map((n) => n.id));
  const links = edges.filter((e) => ids.has(e.source) && ids.has(e.destination));
  const ranked = rankNodes(nodes, links);
  const external = outsideEdges(links, ranked);
  const cx: Context = {
    links,
    ranked,
    external,
    dims: sizes.node ?? new Map(),
    labels: sizes.label ?? new Map(),
  };
  const grid = placeLevels(nodes, cx);
  const firstIncoming = external.filter((e) => rankOf(cx, e.destination) === 0);
  // Returns to the first rank enter from a dedicated band above it.
  const band = firstIncoming.length * 6 + (firstIncoming.length > 0 ? 8 : 0);
  const rects = grid.rects.map((r) => ({ ...r, y: r.y + band }));
  const gaps = grid.gaps.map((g) => ({ ...g, top: g.top + band }));
  const gutter =
    external.length > 0 ? Math.max(0, ...external.map((e) => labelOf(cx, e.id).w)) + 28 : 0;
  const route: Route = { cx, grid: { ...grid, rects, gaps }, firstIncoming, gutter };
  return {
    width: PAD * 2 + grid.bodyWidth + gutter + Math.max(0, external.length - 1) * LANE,
    height: grid.bottom + band + PAD,
    nodes: rects,
    edges: routeAll(rects, route),
  };
}
