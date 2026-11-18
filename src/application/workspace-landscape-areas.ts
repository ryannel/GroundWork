import { stripPrefix } from '@/domain/ids';
import type { LandscapeRelationshipKind } from '@/domain/landscape';
import { diagramCaption } from '@/shared/diagram-caption';
import { plural } from '@/shared/text';

import { layoutCompactCards, layoutExpandedCards } from './area-map/compact-layout';
import { areaRoute, labelPoint, lineBoxes, orthogonalRouteCost } from './area-routing/route';
import type { ModelEdge, ModelIndex } from './model-index';
import { workspaceHref } from './workspace-paths';

/** Direction follows the request, message delivery or acting component. */
export type IntegrationKind = 'call' | 'publish' | 'receive' | 'read' | 'write';

/** One directed area pair, carrying the recorded integrations behind it. */
interface LandscapeRelationship {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly label: string;
  readonly kind: LandscapeRelationshipKind;
  readonly integrations?: readonly string[];
}

interface LandscapeAreaInput {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly activities?: readonly string[] | undefined;
}

export interface AreaMapNode {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly activities: readonly string[];
  readonly systemCount: number;
  readonly colour: number;
  readonly href: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface AreaMapEdge {
  readonly caption?: string;
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

export interface AreaIntegration {
  readonly id: string;
  readonly kind: IntegrationKind;
  readonly callerArea: string;
  readonly providerArea: string;
  readonly callerSystem: string;
  readonly providerSystem: string;
  readonly caller: string;
  readonly callerEndpoint?: string;
  readonly provider: string;
  readonly endpoint: string;
  readonly signature: string;
  readonly detail: string;
}

interface IntegrationPoint {
  readonly area: string;
  readonly system: string;
  readonly component: string;
  readonly name: string;
}

interface IntegrationIndex {
  readonly points: readonly IntegrationPoint[];
  readonly resources: readonly { readonly id: string; readonly label: string }[];
  readonly callerEndpoints?: Readonly<Record<string, string>>;
  readonly members: readonly (readonly [string, IntegrationKind, number, number, number])[];
}

export interface AreaLandscapeView {
  readonly href: string;
  readonly name: string;
  readonly headline: string;
  readonly facts: readonly string[];
  readonly scope: string;
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly AreaMapNode[];
  readonly edges: readonly AreaMapEdge[];
  readonly exchanges: Readonly<Record<string, readonly string[]>>;
  readonly integrations: IntegrationIndex;
  readonly placementIssues: readonly string[];
}

interface Point {
  readonly x: number;
  readonly y: number;
}

const NODE_WIDTH = 250;
const NODE_HEIGHT = 180;
const MARGIN = 50;
const COMPACT_SPACING = { horizontal: 130, vertical: 95, margin: MARGIN };

function areaHref(workspace: string, area: string): string {
  return `${workspaceHref(workspace)}areas/${encodeURIComponent(stripPrefix(area, 'area'))}/`;
}

function nodeOf(
  area: LandscapeAreaInput,
  workspace: string,
  systemCount: number,
  colour: number,
): AreaMapNode {
  return {
    id: area.id,
    name: area.name,
    purpose: area.purpose,
    activities: (area.activities ?? []).slice(0, 2),
    systemCount,
    colour,
    href: areaHref(workspace, area.id),
    x: 0,
    y: 0,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  };
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

function prefersVertical(from: AreaMapNode, to: AreaMapNode): boolean {
  const horizontalGap = Math.max(to.x - from.x - from.width, from.x - to.x - to.width);
  const verticalGap = Math.max(to.y - from.y - from.height, from.y - to.y - to.height);
  if (horizontalGap < 0) return verticalGap >= 0;
  return verticalGap >= 0 && Math.abs(to.y - from.y) > Math.abs(to.x - from.x);
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
  const vertical = prefersVertical(from, to);
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

type RoutedAreaEdge = AreaMapEdge & Pick<NonNullable<ReturnType<typeof areaRoute>>, 'points'>;

function edgeOf(
  relationship: LandscapeRelationship,
  options: RoutingContext,
  caption?: string,
): RoutedAreaEdge | null {
  const { nodes, labels } = options;
  const from = nodes.get(relationship.from);
  const to = nodes.get(relationship.to);
  if (from === undefined || to === undefined) return null;
  const ports = routePorts(relationship, from, to, options);
  const size = diagramCaption(caption ?? relationship.label);
  const geometry = areaRoute({
    start: ports.start,
    end: ports.end,
    obstacles: [...nodes.values()],
    direction: ports.direction,
    vertical: ports.vertical,
    labelWidth: size.width,
    labelHeight: size.height,
    labelObstacles: labels.map((edge) => {
      const { width, height } = diagramCaption(edge.caption ?? edge.label);
      return { x: edge.x - width / 2, y: edge.y - 14, width, height };
    }),
  });
  if (geometry === null) throw new Error(`Cannot route landscape relationship ${relationship.id}`);
  return {
    id: relationship.id,
    from: relationship.from,
    to: relationship.to,
    label: relationship.label,
    ...(caption === undefined ? {} : { caption }),
    kind: relationship.kind,
    ...geometry,
  };
}

function placeRelationshipLabels(
  nodes: readonly AreaMapNode[],
  edges: readonly RoutedAreaEdge[],
): readonly AreaMapEdge[] {
  const occupied = nodes.map(({ x, y, width, height }) => ({ x, y, width, height }));
  const lines = edges.map(({ points }) => lineBoxes(points));
  return edges.map(({ points, ...edge }, index) => {
    const { width, height } = diagramCaption(edge.caption ?? edge.label);
    const position = labelPoint(points, [...occupied, ...(lines[index] ?? [])], width, false, {
      height,
      lines: lines.flatMap((boxes, other) => (other === index ? [] : boxes)),
    });
    if (position.labelHidden !== true) {
      occupied.push({ x: position.x - width / 2, y: position.y - 14, width, height });
    }
    return { ...edge, ...position, labelHidden: position.labelHidden === true };
  });
}

function routeAreaEdges(
  nodes: readonly AreaMapNode[],
  relationships: readonly LandscapeRelationship[],
  captions: ReadonlyMap<string, string> = new Map(),
): readonly RoutedAreaEdge[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges: RoutedAreaEdge[] = [];
  for (const relationship of relationships) {
    const edge = edgeOf(
      relationship,
      { nodes: byId, relationships, labels: edges },
      captions.get(relationship.id),
    );
    if (edge !== null) edges.push(edge);
  }
  return edges;
}

function routeRelationships(
  nodes: readonly AreaMapNode[],
  relationships: readonly LandscapeRelationship[],
  captions?: ReadonlyMap<string, string>,
): readonly AreaMapEdge[] {
  return placeRelationshipLabels(nodes, routeAreaEdges(nodes, relationships, captions));
}

/** Refit changed captions without recalculating card positions. */
export function relayoutLandscapeCaptions(
  view: AreaLandscapeView,
  captions: ReadonlyMap<string, string>,
  onRoutes?: (routes: readonly RoutedAreaEdge[]) => void,
): AreaLandscapeView {
  if (captions.size === 0) return view;
  const routes = routeAreaEdges(view.nodes, view.edges, captions);
  onRoutes?.(routes);
  return { ...view, edges: placeRelationshipLabels(view.nodes, routes) };
}

function geometryOf(
  nodes: readonly AreaMapNode[],
  relationships: readonly LandscapeRelationship[],
): Pick<AreaLandscapeView, 'nodes' | 'edges' | 'width' | 'height'> {
  const labelled = routeRelationships(nodes, relationships);
  return {
    width: Math.max(
      760,
      ...nodes.map((node) => node.x + node.width + MARGIN),
      ...labelled.map(
        (edge) => edge.x + diagramCaption(edge.caption ?? edge.label).width / 2 + MARGIN,
      ),
    ),
    height: Math.max(
      280,
      ...nodes.map((node) => node.y + node.height + MARGIN),
      ...labelled.map((edge) => edge.y + MARGIN),
    ),
    nodes,
    edges: labelled,
  };
}

/** Area boundaries grow on the landscape while the authored exchanges retain their endpoints. */
export function expandedAreaLandscape(
  view: AreaLandscapeView,
  expanded: ReadonlyMap<string, Pick<AreaMapNode, 'width' | 'height'>>,
  routeCost?: (candidate: AreaLandscapeView) => number,
): AreaLandscapeView {
  if (expanded.size === 0) return view;
  const nodes = view.nodes.map((node) => ({ ...node, ...expanded.get(node.id) }));
  const collapsed = collapsedRelationships(view.edges, view.exchanges);
  const placed = layoutExpandedCards(
    nodes,
    weightedAreaConnections(collapsed, view.exchanges),
    COMPACT_SPACING,
    (cards) =>
      routeCost === undefined
        ? orthogonalRouteCost(routeAreaEdges(cards, collapsed))
        : routeCost({ ...view, ...geometryOf(cards, []), edges: view.edges }),
  ).toSorted((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
  return { ...view, ...geometryOf(placed, view.edges) };
}

function integrationIndex<T>() {
  const list: T[] = [];
  const keys = new Map<string, number>();
  return {
    list,
    add(key: string, value: T): number {
      const existing = keys.get(key);
      if (existing !== undefined) return existing;
      const index = list.length;
      list.push(value);
      keys.set(key, index);
      return index;
    },
  };
}

interface Ownership {
  readonly homes: ReadonlyMap<string, string>;
  readonly index: ModelIndex;
}

function integrationPoint(component: string, { homes, index }: Ownership): IntegrationPoint | null {
  const node = index.get(component);
  if (node === null || node.data.infrastructure === true) return null;
  const system = index.place(component)?.system;
  if (system === undefined || system === null) return null;
  const area = homes.get(system);
  return area === undefined ? null : { area, system, component, name: index.label(component) };
}

const KINDS: Readonly<Record<ModelEdge['kind'], IntegrationKind | null>> = {
  call: 'call',
  publish: 'publish',
  consume: 'receive',
  read: 'read',
  write: 'write',
  causes: null,
};

function recordedIntegrations(ownership: Ownership): IntegrationIndex {
  const { index } = ownership;
  const points = integrationIndex<IntegrationPoint>();
  const resources = integrationIndex<IntegrationIndex['resources'][number]>();
  const callerEndpoints = new Map<string, string>();
  const seen = new Set<string>();
  const members = index.edges().flatMap((edge): IntegrationIndex['members'] => {
    const kind = KINDS[edge.kind];
    if (kind === null) return [];
    const id = `recorded:${edge.kind}|${edge.from}|${edge.to}|${edge.site}|${edge.via}`;
    if (seen.has(id)) return [];
    const from = integrationPoint(edge.from, ownership);
    const to = integrationPoint(edge.to, ownership);
    if (from === null || to === null) return [];
    seen.add(id);
    // Keep a call on its operation row when the recorded handler starts at an endpoint.
    if (kind === 'call' && edge.entry !== null && index.get(edge.entry)?.kind === 'endpoint') {
      callerEndpoints.set(id, edge.entry);
    }
    return [
      [
        id,
        kind,
        points.add(edge.from, from),
        points.add(edge.to, to),
        resources.add(edge.via, { id: edge.via, label: index.label(edge.via) }),
      ],
    ];
  });
  return {
    points: points.list,
    resources: resources.list,
    members,
    callerEndpoints: Object.fromEntries(callerEndpoints),
  };
}

export function landscapeIntegrations(index: IntegrationIndex): readonly AreaIntegration[] {
  return index.members.flatMap(([id, kind, source, destination, contract]) => {
    const from = index.points[source];
    const to = index.points[destination];
    const resource = index.resources[contract];
    const operation = index.callerEndpoints?.[id];
    if (from === undefined || to === undefined || resource === undefined) return [];
    return [
      {
        id,
        kind,
        callerArea: from.area,
        providerArea: to.area,
        callerSystem: from.system,
        providerSystem: to.system,
        caller: from.component,
        ...(operation === undefined ? {} : { callerEndpoint: operation }),
        provider: to.component,
        endpoint: resource.id,
        signature: resource.label,
        detail: `${from.name} → ${to.name}`,
      },
    ];
  });
}

/** The authored landscape as a readable connected canvas. */
function modelRelationships(index: IntegrationIndex): readonly LandscapeRelationship[] {
  const pairs = new Map<string, LandscapeRelationship>();
  for (const [id, , source, destination] of index.members) {
    const from = index.points[source]?.area;
    const to = index.points[destination]?.area;
    if (from === undefined || to === undefined || from === to) continue;
    const key = JSON.stringify([from, to]);
    const existing = pairs.get(key);
    if (existing === undefined) {
      pairs.set(key, {
        id: key,
        from,
        to,
        kind: 'exchange',
        label: '',
        integrations: [id],
      });
    } else {
      pairs.set(key, { ...existing, integrations: [...(existing.integrations ?? []), id] });
    }
  }
  return [...pairs.values()].map((relationship) => {
    const out = relationship.integrations?.length ?? 0;
    const incoming =
      pairs.get(JSON.stringify([relationship.to, relationship.from]))?.integrations?.length ?? 0;
    return { ...relationship, label: landscapeCountCaption(out, out + incoming) };
  });
}

/** The collapsed canvas draws one line per pair, with counts in both directions. */
function weightedAreaConnections(
  edges: readonly LandscapeRelationship[],
  exchanges: AreaLandscapeView['exchanges'],
) {
  return edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    weight:
      1 + Math.min(2, Math.log2(exchanges[edge.id]?.length ?? edge.integrations?.length ?? 1)),
  }));
}

function collapsedRelationships(
  relationships: readonly LandscapeRelationship[],
  exchanges: AreaLandscapeView['exchanges'] = {},
) {
  const pairs = new Map<string, LandscapeRelationship[]>();
  for (const edge of relationships) {
    const key = JSON.stringify([edge.from, edge.to].toSorted((a, b) => a.localeCompare(b)));
    const pair = pairs.get(key) ?? [];
    pair.push(edge);
    pairs.set(key, pair);
  }
  return [...pairs.values()].flatMap(([first, reverse]) => {
    if (first === undefined) return [];
    const out = exchanges[first.id]?.length ?? first.integrations?.length ?? 0;
    const incoming =
      reverse === undefined
        ? 0
        : (exchanges[reverse.id]?.length ?? reverse.integrations?.length ?? 0);
    return [{ ...first, label: landscapeCountCaption(out, out + incoming) }];
  });
}

export function landscapeCountCaption(out: number, total: number): string {
  return `${String(out)} out · ${String(total - out)} in`;
}

function homesOf(index: ModelIndex): ReadonlyMap<string, string> {
  const homes = new Map<string, string>();
  for (const detail of index.model.landscape?.details ?? []) {
    for (const system of detail.systems) if (!homes.has(system)) homes.set(system, detail.area);
  }
  return homes;
}

function placementIssues(index: ModelIndex, homes: ReadonlyMap<string, string>) {
  const homeless = index.model.domains
    .flatMap(({ systems }) => systems)
    .filter(({ id }) => !homes.has(id));
  if (homeless.length === 0) return [];
  return [
    `${plural(homeless.length, 'system has', 'systems have')} no home area: ${homeless
      .map(({ id }) => index.label(id))
      .join(', ')}.`,
  ];
}

/** The model's areas as a connected canvas; lines count the recorded integrations between them. */
export function areaLandscapeOf(index: ModelIndex): AreaLandscapeView | null {
  const landscape = index.model.landscape;
  if (landscape === null) return null;
  const { id, name } = index.model;
  const homes = homesOf(index);
  const counts = new Map<string, number>();
  for (const area of homes.values()) counts.set(area, (counts.get(area) ?? 0) + 1);
  const nodes = landscape.areas.map((area, position) =>
    nodeOf(area, id, counts.get(area.id) ?? 0, (position % 13) + 1),
  );
  const integrations = recordedIntegrations({ homes, index });
  const relationships = modelRelationships(integrations);
  const collapsed = collapsedRelationships(relationships);
  const placed = layoutCompactCards(
    nodes,
    weightedAreaConnections(relationships, {}),
    COMPACT_SPACING,
    (cards) => orthogonalRouteCost(routeAreaEdges(cards, collapsed)),
  ).toSorted((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
  const exchanges = Object.fromEntries(
    relationships.map((relationship) => [relationship.id, relationship.integrations ?? []]),
  );
  return {
    href: workspaceHref(id),
    name,
    headline: `${name} systems support ${plural(nodes.length, 'area of activity', 'areas of activity')}. Expand an area to see what makes it work.`,
    facts: [`${String(nodes.length)} areas`],
    scope: landscape.scope ?? '',
    ...geometryOf(placed, relationships),
    exchanges,
    integrations,
    placementIssues: placementIssues(index, homes),
  };
}
