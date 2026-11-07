import { stripPrefix } from '@/domain/ids';
import type { LandscapeArea, LandscapeRelationship } from '@/domain/landscape';
import { diagramCaption } from '@/shared/diagram-caption';
import { plural } from '@/shared/text';

import { areaRoute } from './area-routing/route';
import { layoutAreaSystems } from './area-system-layout';
import { workspaceHref } from './workspace-paths';

/** Only the facts this drawing reads, shared by canonical data and the retained format-1 input. */
export interface AreaLandscapeInput {
  readonly label?: string;
  readonly reviewed?: string;
  readonly scope?: string;
  readonly limitation?: string;
  readonly areas: readonly Pick<LandscapeArea, 'id' | 'name' | 'purpose'>[];
  readonly relationships?: readonly LandscapeRelationship[];
}

export interface AreaMapNode {
  readonly id: string;
  readonly name: string;
  readonly lines: readonly string[];
  readonly purpose: string;
  readonly purposeLines: readonly string[];
  readonly href: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface AreaMapEdge {
  readonly labelHidden?: boolean;
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly path: string;
  readonly label: string;
  readonly kind: 'exchange' | 'transition' | 'support';
  readonly x: number;
  readonly y: number;
}

export interface AreaLandscapeView {
  readonly name: string;
  readonly headline: string;
  readonly facts: readonly string[];
  readonly scope: string;
  readonly limitation: string;
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly AreaMapNode[];
  readonly edges: readonly AreaMapEdge[];
}

interface Point {
  readonly x: number;
  readonly y: number;
}

const NODE_WIDTH = 250;
const NODE_HEIGHT = 166;
const MARGIN = 50;

function areaHref(workspace: string, area: string): string {
  return `${workspaceHref(workspace)}areas/${encodeURIComponent(stripPrefix(area, 'area'))}/`;
}

function titleLines(words: string): readonly string[] {
  const parts = words.split(' ');
  const lines: string[] = [];
  for (const part of parts) {
    const last = lines.at(-1);
    if (last !== undefined && `${last} ${part}`.length <= 23) {
      lines[lines.length - 1] = `${last} ${part}`;
    } else {
      lines.push(part);
    }
  }
  return lines.length <= 2 ? lines : [lines.slice(0, -1).join(' '), lines.at(-1) ?? ''];
}

function nodeOf(
  area: Pick<LandscapeArea, 'id' | 'name' | 'purpose'>,
  workspace: string,
): AreaMapNode {
  const purpose: string[] = [];
  for (const word of area.purpose.split(' ')) {
    const last = purpose.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= 35) {
      purpose[purpose.length - 1] = `${last} ${word}`;
    } else {
      purpose.push(word);
    }
  }
  return {
    id: area.id,
    name: area.name,
    lines: titleLines(area.name),
    purpose: area.purpose,
    purposeLines: purpose.length <= 2 ? purpose : [purpose[0] ?? '', `${purpose[1] ?? ''}…`],
    href: areaHref(workspace, area.id),
    x: 0,
    y: 0,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  };
}

function placedNodes(landscape: AreaLandscapeInput, workspace: string): AreaMapNode[] {
  const nodes = landscape.areas.map((area) => nodeOf(area, workspace));
  const flow = (landscape.relationships ?? [])
    .filter((edge) => edge.kind !== 'support')
    .toSorted((a, b) => Number(b.kind === 'transition') - Number(a.kind === 'transition'));
  const connected = new Set(flow.flatMap((edge) => [edge.from, edge.to]));
  // Read creation through use from left to right, with parallel branches sharing the canvas.
  const positions = layoutAreaSystems(
    nodes
      .filter((node) => connected.has(node.id))
      .map((node) => ({ id: node.id, width: node.width, height: node.height })),
    flow,
    { maxPerColumn: 3, compact: true },
  );
  const byId = new Map(positions.map((box) => [box.id, box]));
  const bottom = Math.max(0, ...positions.map((box) => box.y + box.height + 150));
  const independent = nodes.filter((node) => !connected.has(node.id));
  return nodes
    .map((node) => {
      const position = byId.get(node.id);
      if (position !== undefined) return { ...node, x: position.x, y: position.y };
      const index = independent.findIndex((other) => other.id === node.id);
      return {
        ...node,
        x: MARGIN + (index % 3) * (NODE_WIDTH + 80),
        y: bottom + MARGIN + Math.floor(index / 3) * (NODE_HEIGHT + 150),
      };
    })
    .toSorted((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
}

interface RoutingContext {
  readonly nodes: ReadonlyMap<string, AreaMapNode>;
  readonly relationships: readonly LandscapeRelationship[];
  readonly labels: readonly AreaMapEdge[];
}

function portY(
  node: AreaMapNode,
  edge: LandscapeRelationship,
  options: RoutingContext & { readonly outgoing: boolean },
): number {
  const { nodes, relationships, outgoing } = options;
  const peers = relationships
    .filter((candidate) => (outgoing ? candidate.from === node.id : candidate.to === node.id))
    .toSorted(
      (a, b) =>
        (nodes.get(outgoing ? a.to : a.from)?.y ?? 0) -
        (nodes.get(outgoing ? b.to : b.from)?.y ?? 0),
    );
  const index = peers.findIndex((candidate) => candidate.id === edge.id);
  return node.y + 24 + ((node.height - 48) * (index + 1)) / (peers.length + 1);
}

function portX(
  node: AreaMapNode,
  edge: LandscapeRelationship,
  options: RoutingContext & { readonly outgoing: boolean },
): number {
  const { nodes, relationships, outgoing } = options;
  const peers = relationships
    .filter((candidate) => (outgoing ? candidate.from === node.id : candidate.to === node.id))
    .toSorted(
      (a, b) =>
        (nodes.get(outgoing ? a.to : a.from)?.x ?? 0) -
        (nodes.get(outgoing ? b.to : b.from)?.x ?? 0),
    );
  const index = peers.findIndex((candidate) => candidate.id === edge.id);
  return node.x + 24 + ((node.width - 48) * (index + 1)) / (peers.length + 1);
}

function routePorts(
  relationship: LandscapeRelationship,
  from: AreaMapNode,
  to: AreaMapNode,
  options: RoutingContext,
): {
  readonly start: Point;
  readonly end: Point;
  readonly direction: 1 | -1;
  readonly vertical: boolean;
} {
  const vertical = Math.abs(to.y - from.y) > Math.abs(to.x - from.x);
  const forward = vertical ? to.y > from.y : to.x > from.x;
  if (vertical) {
    return {
      start: {
        x: portX(from, relationship, { ...options, outgoing: true }),
        y: forward ? from.y + from.height : from.y,
      },
      end: {
        x: portX(to, relationship, { ...options, outgoing: false }),
        y: forward ? to.y : to.y + to.height,
      },
      direction: forward ? 1 : -1,
      vertical: true,
    };
  }
  return {
    start: {
      x: forward ? from.x + from.width : from.x,
      y: portY(from, relationship, { ...options, outgoing: true }),
    },
    end: {
      x: forward ? to.x : to.x + to.width,
      y: portY(to, relationship, { ...options, outgoing: false }),
    },
    direction: forward ? 1 : -1,
    vertical: false,
  };
}

function edgeOf(relationship: LandscapeRelationship, options: RoutingContext): AreaMapEdge | null {
  const { nodes, labels } = options;
  const from = nodes.get(relationship.from);
  const to = nodes.get(relationship.to);
  if (from === undefined || to === undefined) return null;
  const ports = routePorts(relationship, from, to, options);
  const geometry = areaRoute({
    start: ports.start,
    end: ports.end,
    obstacles: [...nodes.values()],
    direction: ports.direction,
    vertical: ports.vertical,
    labelWidth: diagramCaption(relationship.label).width,
    labelHeight: diagramCaption(relationship.label).height,
    labelObstacles: labels.map((edge) => {
      const { width, height } = diagramCaption(edge.label);
      return { x: edge.x - width / 2, y: edge.y - 14, width, height };
    }),
  });
  if (geometry === null) throw new Error(`Cannot route landscape relationship ${relationship.id}`);
  return {
    id: relationship.id,
    from: relationship.from,
    to: relationship.to,
    label: relationship.label,
    kind: relationship.kind,
    ...geometry,
  };
}

/** The authored landscape as a readable connected canvas. */
export function areaLandscapeOf(
  workspace: { readonly id: string; readonly name: string },
  landscape: AreaLandscapeInput,
): AreaLandscapeView {
  const nodes = placedNodes(landscape, workspace.id);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges: AreaMapEdge[] = [];
  for (const relationship of landscape.relationships ?? []) {
    const edge = edgeOf(relationship, {
      nodes: byId,
      relationships: landscape.relationships ?? [],
      labels: edges,
    });
    if (edge !== null) edges.push(edge);
  }
  return {
    name: workspace.name,
    headline: `${workspace.name} systems support ${plural(nodes.length, 'area of activity', 'areas of activity')}. Open one to see the systems and information that make it work.`,
    facts: [
      `${String(nodes.length)} areas`,
      landscape.label ?? 'Interpretation not labelled',
      landscape.reviewed === undefined
        ? 'Review date not recorded'
        : `Reviewed ${landscape.reviewed}`,
    ],
    scope: landscape.scope ?? 'Scope not recorded.',
    limitation: landscape.limitation ?? 'Limitations not recorded.',
    width: Math.max(
      760,
      ...nodes.map((node) => node.x + node.width + MARGIN),
      ...edges.map((edge) => edge.x + edge.label.length * 3.5 + MARGIN),
    ),
    height: Math.max(
      280,
      ...nodes.map((node) => node.y + node.height + MARGIN),
      ...edges.map((edge) => edge.y + MARGIN),
    ),
    nodes,
    edges,
  };
}
