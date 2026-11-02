import type { LandscapeSystemRelationship } from '@/domain/landscape';

import { orderColumns } from './area-map/column-order';
import { areaRoute } from './area-routing/route';

export interface AreaSystemSize {
  readonly id: string;
  readonly width: number;
  readonly height: number;
}

export interface AreaSystemBox extends AreaSystemSize {
  readonly x: number;
  readonly y: number;
  readonly rank: number;
}

const HORIZONTAL_GAP = 150;
const VERTICAL_GAP = 80;
const MARGIN = 50;

type LayoutRelationship = Pick<LandscapeSystemRelationship, 'id' | 'from' | 'to'>;

function reaches(
  adjacency: ReadonlyMap<string, readonly string[]>,
  from: string,
  target: string,
): boolean {
  const seen = new Set<string>();
  const pending = [from];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || seen.has(current)) continue;
    if (current === target) return true;
    seen.add(current);
    pending.push(...(adjacency.get(current) ?? []));
  }
  return false;
}

/** Keep authored direction where possible, setting aside only edges that would close a cycle. */
function acyclicEdges(
  ids: ReadonlySet<string>,
  relationships: readonly LayoutRelationship[],
): readonly LayoutRelationship[] {
  const adjacency = new Map<string, string[]>();
  const kept: LayoutRelationship[] = [];
  for (const edge of relationships) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || reaches(adjacency, edge.to, edge.from)) {
      continue;
    }
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
    kept.push(edge);
  }
  return kept;
}

function ranksOf(
  nodes: readonly AreaSystemSize[],
  edges: readonly LayoutRelationship[],
): ReadonlyMap<string, number> {
  const ranks = new Map(nodes.map((node) => [node.id, 0]));
  let remaining = nodes.length;
  while (remaining > 0) {
    for (const edge of edges) {
      ranks.set(edge.to, Math.max(ranks.get(edge.to) ?? 0, (ranks.get(edge.from) ?? 0) + 1));
    }
    remaining -= 1;
  }
  return ranks;
}

/** Shorten total edge span; on equal spans, keep a branch close to its downstream join. */
function compactRanks(
  ranks: ReadonlyMap<string, number>,
  edges: readonly LayoutRelationship[],
): ReadonlyMap<string, number> {
  const compact = new Map(ranks);
  const maximum = Math.max(0, ...ranks.values());
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, current] of compact) {
      const incoming = edges.filter((edge) => edge.to === id);
      const outgoing = edges.filter((edge) => edge.from === id);
      const earliest = Math.max(0, ...incoming.map((edge) => (compact.get(edge.from) ?? 0) + 1));
      const latest = Math.min(maximum, ...outgoing.map((edge) => (compact.get(edge.to) ?? 0) - 1));
      const next = outgoing.length >= incoming.length ? latest : earliest;
      if (incoming.length + outgoing.length === 0 || next === current) continue;
      compact.set(id, next);
      changed = true;
    }
  }
  return compact;
}

function orderedColumns(
  nodes: readonly AreaSystemSize[],
  ranks: ReadonlyMap<string, number>,
  edges: readonly LayoutRelationship[],
): readonly (readonly AreaSystemSize[])[] {
  const maximum = Math.max(0, ...ranks.values());
  const columns = Array.from({ length: maximum + 1 }, (_, rank) =>
    nodes.filter((node) => ranks.get(node.id) === rank),
  );
  return orderColumns(columns, edges);
}

/** A stable left-to-right information-flow layout with cycle edges left available for return paths. */
export function layoutAreaSystems(
  nodes: readonly AreaSystemSize[],
  relationships: readonly LayoutRelationship[],
  options: {
    readonly maxPerColumn?: number;
    readonly compact?: boolean;
    readonly gap?: number;
  } = {},
): readonly AreaSystemBox[] {
  const { maxPerColumn = Number.POSITIVE_INFINITY, gap = HORIZONTAL_GAP } = options;
  const ids = new Set(nodes.map((node) => node.id));
  const forward = acyclicEdges(ids, relationships);
  const initial = ranksOf(nodes, forward);
  const ranks = options.compact === true ? compactRanks(initial, forward) : initial;
  const columns = orderedColumns(nodes, ranks, forward).flatMap((column) =>
    column.flatMap((_, index) =>
      index % maxPerColumn === 0 ? [column.slice(index, index + maxPerColumn)] : [],
    ),
  );
  const columnHeights = columns.map(
    (column) =>
      column.reduce((total, node) => total + node.height, 0) +
      Math.max(0, column.length - 1) * VERTICAL_GAP,
  );
  const contentHeight = Math.max(0, ...columnHeights);
  const boxes: AreaSystemBox[] = [];
  let x = MARGIN;
  for (const [rank, column] of columns.entries()) {
    const width = Math.max(0, ...column.map((node) => node.width));
    let y = MARGIN + (contentHeight - (columnHeights[rank] ?? 0)) / 2;
    for (const node of column) {
      boxes.push({ ...node, x, y, rank });
      y += node.height + VERTICAL_GAP;
    }
    x += width + gap;
  }
  return boxes;
}

export function areaSystemBounds(nodes: readonly AreaSystemBox[]): {
  readonly width: number;
  readonly height: number;
} {
  return {
    width: Math.max(1480, ...nodes.map((node) => node.x + node.width + MARGIN)),
    height: Math.max(780, ...nodes.map((node) => node.y + node.height + MARGIN)),
  };
}

interface EdgeGeometryOptions {
  readonly edge: LandscapeSystemRelationship;
  readonly boxes: readonly AreaSystemBox[];
  readonly relationships: readonly LandscapeSystemRelationship[];
  readonly labels?: readonly { readonly x: number; readonly y: number; readonly label: string }[];
}

type EdgeGeometry = NonNullable<ReturnType<typeof areaRoute>>;

interface PortOptions {
  readonly edge: LandscapeSystemRelationship;
  readonly geometry: EdgeGeometryOptions;
  readonly side: 'incoming' | 'outgoing';
}

function portY(node: AreaSystemBox, port: PortOptions): number {
  const { edge, geometry: options, side } = port;
  const byId = new Map(options.boxes.map((box) => [box.id, box]));
  const peers = options.relationships
    .filter((candidate) =>
      side === 'incoming' ? candidate.to === node.id : candidate.from === node.id,
    )
    .toSorted((a, b) => {
      const aPeer = byId.get(side === 'incoming' ? a.from : a.to);
      const bPeer = byId.get(side === 'incoming' ? b.from : b.to);
      return (aPeer?.y ?? 0) - (bPeer?.y ?? 0);
    });
  const index = Math.max(
    0,
    peers.findIndex((candidate) => candidate.id === edge.id),
  );
  return node.y + (node.height * (index + 1)) / (peers.length + 1);
}

function contains(outer: AreaSystemBox, inner: AreaSystemBox): boolean {
  const coversOrigin = outer.x <= inner.x && outer.y <= inner.y;
  const coversEnd =
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height;
  return outer.id !== inner.id && coversOrigin && coversEnd;
}

function needsReturn(edge: LandscapeSystemRelationship, options: EdgeGeometryOptions): boolean {
  const from = options.boxes.find((box) => box.id === edge.from);
  const to = options.boxes.find((box) => box.id === edge.to);
  if (from === undefined || to === undefined || from.x + from.width <= to.x) return false;
  const overlaps = to.x + to.width > from.x;
  const reciprocal = options.relationships.some(
    (other) => other.from === edge.to && other.to === edge.from,
  );
  return overlaps || reciprocal;
}

function returnLane(options: EdgeGeometryOptions): number {
  const returns = options.relationships
    .filter((edge) => needsReturn(edge, options))
    .toSorted((a, b) => a.id.localeCompare(b.id));
  const index = Math.max(
    0,
    returns.findIndex((edge) => edge.id === options.edge.id),
  );
  const endpoints = options.boxes.filter(
    (box) => box.id === options.edge.from || box.id === options.edge.to,
  );
  return Math.max(...endpoints.map((box) => box.y + box.height)) + 36 + index * 28;
}

function blocksPort(box: AreaSystemBox, port: AreaSystemBox, boxes: readonly AreaSystemBox[]) {
  if (!contains(box, port)) return true;
  return (
    port.height === 0 &&
    !boxes.some((inner) => inner.height > 0 && contains(box, inner) && contains(inner, port))
  );
}

/** Anchors share canvas coordinates, even when their local system/component ranks differ. */
export function areaEdgeGeometry(options: EdgeGeometryOptions): EdgeGeometry | null {
  const { edge, boxes } = options;
  const from = boxes.find((box) => box.id === edge.from);
  const to = boxes.find((box) => box.id === edge.to);
  if (from === undefined || to === undefined) return null;
  const forward = from.x + from.width <= to.x;
  const obstacles = boxes.filter(
    (box) => box.height > 0 && blocksPort(box, from, boxes) && blocksPort(box, to, boxes),
  );
  const start = {
    x: forward ? from.x + from.width : from.x,
    y: portY(from, { edge, geometry: options, side: 'outgoing' }),
  };
  const end = {
    x: forward ? to.x : to.x + to.width,
    y: portY(to, { edge, geometry: options, side: 'incoming' }),
  };
  return areaRoute({
    start,
    end,
    obstacles,
    direction: forward ? 1 : -1,
    labelWidth: Math.min(240, edge.label.length * 6.5 + 16),
    labelObstacles: (options.labels ?? []).map((label) => {
      const width = Math.min(240, label.label.length * 6.5 + 16);
      return { x: label.x - width / 2, y: label.y - 18, width, height: 26 };
    }),
    ...(needsReturn(edge, options) ? { returnLane: returnLane(options) } : {}),
  });
}
