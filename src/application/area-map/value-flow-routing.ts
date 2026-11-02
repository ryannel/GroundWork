import {
  clearRouteSegment,
  orthogonalRoute,
  type RouteBox,
  type RoutePort,
  type RoutedLine,
} from '@/application/area-routing/orthogonal';
import { labelPoint, roundedPath } from '@/application/area-routing/route';

import type { ValueFlowConnection } from './value-flow-connections';
import type { ValueFlowGroup, ValueFlowHeading, ValueFlowNode } from './value-flow-system';

function ports(
  node: ValueFlowNode,
  edge: ValueFlowConnection,
  edges: readonly ValueFlowConnection[],
  y: number | undefined,
): readonly RoutePort[] {
  const incident = edges
    .filter((item) => item.from === node.id || item.to === node.id)
    .toSorted((a, b) => a.id.localeCompare(b.id));
  const fraction = (incident.findIndex((item) => item.id === edge.id) + 1) / (incident.length + 1);
  const x = node.x + 24 + fraction * (node.width - 48);
  const portHeight = node.open === true ? 84 : node.height;
  const row = y ?? node.y + 24 + fraction * (portHeight - 48);
  const sides: RoutePort[] = [
    {
      point: { x: node.x + node.width, y: row },
      exit: { x: node.x + node.width + 24, y: row },
      direction: 0,
    },
    { point: { x: node.x, y: row }, exit: { x: node.x - 24, y: row }, direction: 2 },
  ];
  if (y !== undefined || node.open === true) return sides;
  return [
    ...sides,
    {
      point: { x, y: node.y + node.height },
      exit: { x, y: node.y + node.height + 24 },
      direction: 1,
    },
    { point: { x, y: node.y }, exit: { x, y: node.y - 24 }, direction: 3 },
  ];
}

export interface ValueFlowRoute extends ValueFlowConnection {
  readonly path: string;
  readonly x: number;
  readonly y: number;
  readonly points: RoutedLine['points'];
}

/** Node ports, obstacles and reserved corridors are solved together; there is no later lane shifting. */
export function routeValueFlows(
  edges: readonly ValueFlowConnection[],
  nodes: readonly ValueFlowNode[],
  headings: readonly ValueFlowHeading[],
  groups: readonly ValueFlowGroup[],
): readonly ValueFlowRoute[] {
  const obstacles: RouteBox[] = [
    ...nodes,
    ...headings,
    ...groups.map((group) => ({ ...group, height: 80 })),
  ];
  const lines: RoutedLine[] = [];
  const labels: RouteBox[] = [];
  const canvas = {
    x: 0,
    y: 0,
    width: Math.max(1200, ...nodes.map((node) => node.x + node.width + 80)),
    height: Math.max(800, ...nodes.map((node) => node.y + node.height + 80)),
  };
  return edges.map((edge) => {
    const from = nodes.find((node) => node.id === edge.from);
    const to = nodes.find((node) => node.id === edge.to);
    if (from === undefined || to === undefined) throw new Error(`Missing endpoints for ${edge.id}`);
    const group =
      from.systemId === to.systemId ? groups.find((item) => item.id === from.systemId) : undefined;
    const bounds =
      group === undefined
        ? canvas
        : { x: group.x + 8, y: group.y + 88, width: group.width - 16, height: group.height - 96 };
    const boxes = [
      ...obstacles,
      ...groups.filter((item) => item.id !== from.systemId && item.id !== to.systemId),
    ];
    const validPorts = (node: ValueFlowNode, y: number | undefined): readonly RoutePort[] =>
      ports(node, edge, edges, y).filter((port) => clearRouteSegment(port.point, port.exit, boxes));
    const points = orthogonalRoute(validPorts(from, edge.sourceY), validPorts(to, edge.targetY), {
      boxes,
      lines,
      bounds,
    });
    if (points.length === 0) throw new Error(`No clear route for ${edge.id}`);
    lines.push({ points });
    const width = Math.min(240, edge.label.length * 6.5 + 16);
    const label = labelPoint(points, [...obstacles, ...labels], width, true);
    labels.push({ x: label.x - width / 2, y: label.y - 14, width, height: 18 });
    return { ...edge, ...label, path: roundedPath(points), points };
  });
}
