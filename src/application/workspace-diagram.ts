import type { ConnectionKind } from '@/domain/workspace';
import { cutAtWord } from '@/shared/plain-text';

// Lays out a diagram as columns of boxes with arrows between them. The numbers are SVG user units. Arrows between
// neighbouring columns curve across the gap; arrows that would cross a column run in a lane under the columns.
const NODE_W = 176;
const NODE_H = 44;
const GAP = 12;
const HEADER = 36;
const PAD = 16;
const COLUMN_GAP = 72;
const MARGIN = 8;
const LOOP = 40;
const COLUMN_W = NODE_W + 2 * PAD;
const LANE = 10;
const GUTTER = 12;
const STAGGER = 6;
const LABEL_MAX = 24;
const DETAIL_MAX = 28;

export interface DiagramNodeInput {
  readonly id: string;
  readonly label: string;
  readonly detail: string | null;
  readonly href: string | null;
  /** A team hue, 1 to 13, for the stripe. */
  readonly team: number | null;
  /** Drawn quiet: outside what the page is about. */
  readonly quiet: boolean;
}

export interface DiagramColumnInput {
  readonly id: string;
  readonly label: string;
  readonly href: string | null;
  readonly quiet: boolean;
  readonly nodes: readonly DiagramNodeInput[];
}

export interface DiagramEdgeInput {
  readonly from: string;
  readonly to: string;
  readonly via: readonly ConnectionKind[];
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type DiagramGroup = Omit<DiagramColumnInput, 'nodes'> & Box;
export type DiagramNode = DiagramNodeInput &
  Box & {
    /** The full name; the label may be shortened to fit the box. */
    readonly title: string;
  };

export interface DiagramEdge {
  readonly id: string;
  readonly path: string;
  readonly via: readonly ConnectionKind[];
  readonly quiet: boolean;
  readonly description: string;
}

export interface Diagram {
  readonly width: number;
  readonly height: number;
  readonly groups: readonly DiagramGroup[];
  readonly nodes: readonly DiagramNode[];
  readonly edges: readonly DiagramEdge[];
}

interface Placed extends DiagramNode {
  readonly column: number;
}

export function layoutDiagram(
  columns: readonly DiagramColumnInput[],
  edges: readonly DiagramEdgeInput[],
): Diagram {
  const tallest = Math.max(1, ...columns.map((column) => column.nodes.length));
  const groupHeight = HEADER + tallest * (NODE_H + GAP) - GAP + PAD;
  const placed = columns.flatMap((column, index) =>
    column.nodes.map((node, row) => place(node, index, row)),
  );
  const byId = new Map(placed.map((node) => [node.id, node]));
  const pairs = edges.flatMap((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    return from === undefined || to === undefined || from === to ? [] : [{ edge, from, to }];
  });
  const lanes = laneIndex(pairs);
  const laneTop = MARGIN + groupHeight;
  return {
    width: columns.length === 0 ? 0 : columnX(columns.length) - COLUMN_GAP + LOOP + MARGIN,
    height: laneTop + MARGIN + lanes.size * LANE,
    groups: columns.map(({ nodes: _nodes, ...column }, index) => ({
      ...column,
      x: columnX(index),
      y: MARGIN,
      width: COLUMN_W,
      height: groupHeight,
    })),
    nodes: placed.map(({ column: _column, ...node }) => node),
    edges: pairs.map(({ edge, from, to }) => ({
      id: `${edge.from}>${edge.to}`,
      path: skips(from, to)
        ? lane(from, to, { index: lanes.get(laneKey(from, to)) ?? 0, top: laneTop })
        : curve(from, to),
      via: edge.via,
      quiet: from.quiet || to.quiet,
      description: `${from.title} to ${to.title} (${edge.via.join(', ')})`,
    })),
  };
}

function place(node: DiagramNodeInput, column: number, row: number): Placed {
  return {
    ...node,
    label: cutAtWord(node.label, LABEL_MAX),
    detail:
      node.detail === null || node.detail === node.label
        ? null
        : cutAtWord(node.detail, DETAIL_MAX),
    title: node.label,
    column,
    x: columnX(column) + PAD,
    y: MARGIN + HEADER + row * (NODE_H + GAP),
    width: NODE_W,
    height: NODE_H,
  };
}

function columnX(index: number): number {
  return MARGIN + index * (COLUMN_W + COLUMN_GAP);
}

function skips(from: Placed, to: Placed): boolean {
  return Math.abs(to.column - from.column) > 1;
}

function laneKey(from: Placed, to: Placed): string {
  return `${String(from.column)}>${String(to.column)}`;
}

// Arrows from one column to the same other column share a lane, so they read as one bundle.
function laneIndex(
  pairs: readonly { readonly from: Placed; readonly to: Placed }[],
): Map<string, number> {
  const lanes = new Map<string, number>();
  for (const { from, to } of pairs) {
    const key = laneKey(from, to);
    if (skips(from, to) && !lanes.has(key)) lanes.set(key, lanes.size);
  }
  return lanes;
}

// Out into the gap beside the start, down to the lane under the columns, along, and up the gap beside the end.
function lane(
  from: Placed,
  to: Placed,
  slot: { readonly index: number; readonly top: number },
): string {
  const { index, top } = slot;
  const forward = to.column > from.column;
  const step = GUTTER + (index % 5) * STAGGER;
  const startX = forward ? from.x + NODE_W : from.x;
  const endX = forward ? to.x : to.x + NODE_W;
  const outX = forward ? columnX(from.column) + COLUMN_W + step : columnX(from.column) - step;
  const inX = forward ? columnX(to.column) - step : columnX(to.column) + COLUMN_W + step;
  const laneY = top + (index + 1) * LANE;
  return [
    `M ${num(startX)} ${num(from.y + NODE_H / 2)}`,
    `H ${num(outX)} V ${num(laneY)} H ${num(inX)}`,
    `V ${num(to.y + NODE_H / 2)} H ${num(endX)}`,
  ].join(' ');
}

function curve(from: Placed, to: Placed): string {
  const fromY = from.y + NODE_H / 2;
  const toY = to.y + NODE_H / 2;
  if (from.column === to.column) {
    const x = from.x + NODE_W;
    return `M ${num(x)} ${num(fromY)} C ${num(x + LOOP)} ${num(fromY)}, ${num(x + LOOP)} ${num(toY)}, ${num(x)} ${num(toY)}`;
  }
  const forward = to.column > from.column;
  const startX = forward ? from.x + NODE_W : from.x;
  const endX = forward ? to.x : to.x + NODE_W;
  const middle = (startX + endX) / 2;
  return `M ${num(startX)} ${num(fromY)} C ${num(middle)} ${num(fromY)}, ${num(middle)} ${num(toY)}, ${num(endX)} ${num(toY)}`;
}

function num(value: number): string {
  return String(Math.round(value * 10) / 10);
}
