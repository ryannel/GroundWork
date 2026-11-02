import type { ExplorerNode, ExplorerPage } from '@/domain/service-explorer';
import type { ExplorerDrawing, ExplorerDrawingNode } from '@/shared/explorer-drawing';

import { explorerServiceDrawing } from './explorer-service-drawing';

function levels(page: ExplorerPage): ReadonlyMap<string, number> {
  const result = new Map<string, number>();
  const incoming = new Set(page.links.map((link) => link.to));
  const pending = page.nodes.filter((node) => !incoming.has(node.id)).map((node) => node.id);
  if (pending.length === 0 && page.nodes[0]) pending.push(page.nodes[0].id);
  for (const id of pending) {
    if (!result.has(id)) result.set(id, 0);
    for (const edge of page.links.filter((link) => link.from === id)) {
      if (!result.has(edge.to)) {
        result.set(edge.to, Math.min(8, (result.get(id) ?? 0) + 1));
        pending.push(edge.to);
      }
    }
  }
  return result;
}
function words(label: string): readonly string[] {
  const lines: string[] = [];
  let remaining = label.trim();
  while (remaining.length > 32 && lines.length < 2) {
    const split = Math.max(remaining.lastIndexOf(' ', 32), remaining.lastIndexOf('/', 32));
    const at = split > 5 ? split : 32;
    lines.push(remaining.slice(0, at));
    remaining = remaining.slice(at).trim();
  }
  lines.push(remaining.length > 34 ? `${remaining.slice(0, 33)}…` : remaining);
  return lines;
}
function nodeShape(kind: ExplorerNode['kind']): ExplorerDrawingNode['shape'] {
  if (kind === 'branch') return 'diamond';
  if (kind === 'storage') return 'store';
  if (kind === 'entry' || kind === 'return') return 'ellipse';
  return 'box';
}
function nodeTone(kind: ExplorerNode['kind']): ExplorerDrawingNode['tone'] {
  if (kind === 'failure') return 'warning';
  return kind === 'component' ? 'accent' : 'normal';
}
function placed(node: ExplorerNode, x: number, y: number): ExplorerDrawingNode {
  return {
    id: node.id,
    lines: words(node.label),
    note: node.kind,
    detail: node.label,
    shape: nodeShape(node.kind),
    tone: nodeTone(node.kind),
    x,
    y,
    width: 280,
    height: 120,
  };
}
function overviewPositions(page: ExplorerPage): ReadonlyMap<string, readonly [number, number]> {
  const entryColumns = Math.max(
    1,
    Math.ceil(page.nodes.filter((node) => node.kind === 'entry').length / 6),
  );
  const storeColumns = Math.ceil(page.nodes.filter((node) => node.kind === 'storage').length / 6);
  const rows = new Map<string, number>();
  return new Map(
    page.nodes.map((node): readonly [string, readonly [number, number]] => {
      if (node.kind === 'component') return [node.id, [24 + entryColumns * 380, 240]];
      let group = 'dependency';
      if (node.kind === 'entry' || node.kind === 'storage') group = node.kind;
      const row = rows.get(group) ?? 0;
      rows.set(group, row + 1);
      let start = entryColumns + 1 + storeColumns;
      if (group === 'entry') start = 0;
      if (group === 'storage') start = entryColumns + 1;
      return [node.id, [24 + (start + Math.floor(row / 6)) * 380, 24 + (row % 6) * 150]];
    }),
  );
}

function flowLabel(edge: ExplorerPage['links'][number]): string {
  if (edge.kind === 'branch') return 'Condition';
  if (edge.kind === 'async') return 'Async source';
  if (edge.kind === 'data') return edge.label.startsWith('declared') ? 'Declared schema' : 'Value';
  return edge.label.length > 38 ? `${edge.label.slice(0, 37)}…` : edge.label;
}
function edgeLabel(page: ExplorerPage, edge: ExplorerPage['links'][number]): string {
  if (page.kind !== 'overview' && edge.kind === 'control') return '';
  if (page.kind === 'flow') return flowLabel(edge);
  return edge.label.length > 38 ? `${edge.label.slice(0, 37)}…` : edge.label;
}

function connector(from: ExplorerDrawingNode, to: ExplorerDrawingNode): string {
  const left = to.x < from.x;
  const x = left ? from.x : from.x + from.width;
  const y = from.y + from.height / 2;
  const targetX = left ? to.x + to.width : to.x;
  const targetY = to.y + to.height / 2;
  const bend = Math.max(48, Math.abs(targetX - x) / 2) * (left ? -1 : 1);
  return `M${String(x)},${String(y)} C${String(x + bend)},${String(y)} ${String(targetX - bend)},${String(targetY)} ${String(targetX)},${String(targetY)}`;
}

/** Geometry follows the delivered edges; it never invents an execution relationship. */
export function explorerDrawing(page: ExplorerPage): ExplorerDrawing {
  const rank = levels(page);
  const service = explorerServiceDrawing(page);
  const overview =
    page.kind === 'overview'
      ? (service?.positions ?? overviewPositions(page))
      : new Map<string, readonly [number, number]>();
  const rows = new Map<number, number>();
  const nodes = page.nodes.map((node) => {
    const at = overview.get(node.id);
    if (at !== undefined) {
      const drawing = placed(node, at[0], at[1]);
      const shape = service?.shapes.get(node.id) ?? drawing.shape;
      return { ...drawing, shape, height: shape === 'row' ? 100 : drawing.height };
    }
    const column = rank.get(node.id) ?? 0;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    return placed(node, 24 + column * 380, 24 + row * 160);
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const bottom = Math.max(230, ...nodes.map((node) => node.y + node.height)) + 24;
  const edges = page.links.flatMap((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) return [];
    const left = to.x < from.x;
    const x = left ? from.x : from.x + from.width;
    const targetX = left ? to.x + to.width : to.x;
    const y = from.y + from.height / 2;
    const targetY = to.y + to.height / 2;
    const contained = service?.component === edge.from && to.shape === 'row';
    return [
      {
        id: edge.id,
        path: contained
          ? `M${String(from.x)},${String(from.y + from.height / 2)} C${String(from.x - 32)},${String(from.y + from.height / 2)} ${String(to.x - 32)},${String(targetY)} ${String(to.x)},${String(targetY)}`
          : connector(from, to),
        label: contained ? '' : edgeLabel(page, edge),
        detail: edge.label,
        x: (x + targetX) / 2,
        y: (y + targetY) / 2 - 8,
        dashed: edge.kind === 'async' || edge.kind === 'failure',
        contained,
      },
    ];
  });
  return {
    groups: service?.groups ?? [],
    nodes,
    edges,
    width: Math.max(service ? 440 : 800, ...nodes.map((node) => node.x + node.width + 24)),
    height: Math.max(260, bottom + (page.kind === 'overview' ? 24 : 0)),
  };
}
