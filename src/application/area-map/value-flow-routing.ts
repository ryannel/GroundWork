import {
  clearRouteSegment,
  orthogonalRoute,
  type RouteBox,
  type RoutePort,
  type RoutedLine,
} from '@/application/area-routing/orthogonal';
import { labelPoint, lineBoxes, roundedPath } from '@/application/area-routing/route';
import { diagramCaption } from '@/shared/diagram-caption';

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
  readonly labelHidden?: boolean;
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
  const captionCorridors: RouteBox[] = [];
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
    const physical = [
      ...obstacles,
      ...groups.filter((item) => item.id !== from.systemId && item.id !== to.systemId),
    ];
    const boxes = [...physical, ...captionCorridors];
    const validPorts = (node: ValueFlowNode, y: number | undefined): readonly RoutePort[] =>
      ports(node, edge, edges, y).filter((port) => clearRouteSegment(port.point, port.exit, boxes));
    const { width, height } = diagramCaption(edge.label);
    const occupied = [...obstacles, ...labels];
    const otherLines = lines.flatMap((line) => lineBoxes(line.points));
    const place = (points: RoutedLine['points']) =>
      labelPoint(points, occupied, width, true, { height, bounds, lines: otherLines });
    const space = {
      boxes,
      lines,
      bounds,
    };
    const starts = validPorts(from, edge.sourceY);
    const ends = validPorts(to, edge.targetY);
    const labelled = orthogonalRoute(starts, ends, {
      ...space,
      corridorPadding: height + 24,
      accept: (points) => place(points).labelHidden !== true,
    });
    const physicalPorts = (node: ValueFlowNode, y: number | undefined) =>
      ports(node, edge, edges, y).filter((port) =>
        clearRouteSegment(port.point, port.exit, physical),
      );
    const points =
      labelled.length > 0
        ? labelled
        : orthogonalRoute(physicalPorts(from, edge.sourceY), physicalPorts(to, edge.targetY), {
            ...space,
            boxes: physical,
          });
    if (points.length === 0) throw new Error(`No clear route for ${edge.id}`);
    const label = place(points);
    lines.push({ points });
    if (label.labelHidden !== true) {
      labels.push({
        x: label.x - width / 2,
        y: label.y - 14,
        width,
        height,
      });
      captionCorridors.push({
        x: label.x - width / 2 - 12,
        y: label.y - 14 - 12,
        width: width + 24,
        height: height + 24,
      });
    }
    return { ...edge, ...label, path: roundedPath(points), points };
  });
}
