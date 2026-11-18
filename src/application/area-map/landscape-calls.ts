import { CARD, cardLayout, type CardRow } from '@/application/area-map/card-geometry';
import type { ValueFlowNode } from '@/application/area-map/value-flow-layout';
import type { ValueFlowGroup } from '@/application/area-map/value-flow-system';
import { areaRoute, labelPoint, lineBoxes } from '@/application/area-routing/route';
import {
  type AreaIntegration,
  type AreaLandscapeView,
  type AreaMapNode,
  landscapeCountCaption,
  relayoutLandscapeCaptions,
} from '@/application/workspace-landscape-areas';
import { diagramCaption } from '@/shared/diagram-caption';
import { plural } from '@/shared/text';

export const AREA_HEADER = 84;
export const AREA_INSET = 16;

type Box = Pick<AreaMapNode, 'x' | 'y' | 'width' | 'height'>;
interface Drawing {
  readonly nodes: readonly ValueFlowNode[];
  readonly groups: readonly ValueFlowGroup[];
}
type Drawings = ReadonlyMap<string, Drawing | null>;

function onCanvas(area: AreaMapNode, box: Box): Box {
  return { ...box, x: area.x + AREA_INSET + box.x, y: area.y + AREA_HEADER + AREA_INSET + box.y };
}

function rowMatches(row: CardRow, port: string): boolean {
  if (row.kind === 'endpoint') return row.endpoint.id === port;
  return row.kind !== 'api' && row.resource.id === port;
}

export function revealTarget(integration: AreaIntegration): {
  readonly area: string;
  readonly system: string;
  readonly component: string;
  readonly row: string;
} {
  if (integration.kind === 'receive') {
    return {
      area: integration.callerArea,
      system: integration.callerSystem,
      component: integration.caller,
      row: integration.caller,
    };
  }
  return {
    area: integration.providerArea,
    system: integration.providerSystem,
    component: integration.provider,
    row: integration.kind === 'call' ? integration.endpoint : integration.provider,
  };
}

function anchorName(node: ValueFlowNode, row: CardRow | undefined): string {
  const name = node.collapsed ? node.system : node.component.name;
  if (row?.kind === 'endpoint') return `${name} · ${row.endpoint.signature}`;
  const contract = row?.kind === 'api' ? row.surface.label : row?.resource.name;
  return contract === undefined ? name : `${name} · ${contract}`;
}

const nodeIndexes = new WeakMap<Drawing, ReadonlyMap<string, ValueFlowNode>>();
const cardRows = new WeakMap<ValueFlowNode['component'], readonly CardRow[]>();

function nodesByMember(drawing: Drawing): ReadonlyMap<string, ValueFlowNode> {
  const entries = drawing.nodes.flatMap((node) =>
    node.members.map((member) => [`${node.systemId}\n${member}`, node] as const),
  );
  // The first card holding a component wins, as a scan of the drawing in order would find it.
  return new Map(entries.toReversed());
}

function nodeHolding(drawing: Drawing, system: string, component: string) {
  const index = nodeIndexes.get(drawing) ?? nodesByMember(drawing);
  nodeIndexes.set(drawing, index);
  return index.get(`${system}\n${component}`);
}

function openRows(node: ValueFlowNode): readonly CardRow[] {
  const known = cardRows.get(node.component);
  if (known !== undefined) return known;
  const rows = cardLayout(node.component, true).sections.flatMap((section) => section.rows);
  cardRows.set(node.component, rows);
  return rows;
}

function anchor(
  area: AreaMapNode,
  drawing: Drawing | null | undefined,
  target: { readonly system: string; readonly component: string; readonly endpoint?: string },
) {
  const node = drawing ? nodeHolding(drawing, target.system, target.component) : undefined;
  if (node !== undefined) {
    const port = target.endpoint;
    const row =
      node.open === true && port !== undefined
        ? openRows(node).find((item) => rowMatches(item, port))
        : undefined;
    const portHeight = node.open === true ? CARD.header : node.height;
    return {
      id: JSON.stringify([area.id, node.id, row === undefined ? null : port]),
      cardId: node.collapsed ? undefined : JSON.stringify([area.id, node.id]),
      box: onCanvas(area, node),
      name: anchorName(node, row),
      port: row?.centre ?? portHeight / 2,
      portHeight,
      exact: row !== undefined,
    };
  }
  const system = drawing?.groups.find(({ id }) => id === target.system);
  return system === undefined
    ? { id: area.id, box: area, name: area.name, port: area.height / 2, exact: false }
    : {
        id: JSON.stringify([area.id, system.id]),
        box: onCanvas(area, system),
        name: system.name,
        port: AREA_HEADER / 2,
        exact: false,
      };
}

function obstaclesOf(
  layout: AreaLandscapeView,
  drawings: Drawings,
  call: Pick<AreaIntegration, 'callerArea' | 'providerArea'>,
): Box[] {
  return layout.nodes.flatMap((area) => {
    const drawing = drawings.get(area.id);
    if (!drawing || (area.id !== call.callerArea && area.id !== call.providerArea)) {
      return [area];
    }
    return [
      { ...area, height: AREA_HEADER },
      ...drawing.nodes.map((node) => onCanvas(area, node)),
      ...drawing.groups.map((group) => onCanvas(area, { ...group, height: 70 })),
    ];
  });
}

/** Inspect a member independently of whether the router can draw its line. */
export function landscapeIntegrationDestination(
  layout: AreaLandscapeView,
  drawings: Drawings,
  integration: AreaIntegration,
): Box | null {
  const target = revealTarget(integration);
  const area = layout.nodes.find(({ id }) => id === target.area);
  const drawing = drawings.get(target.area);
  if (area === undefined || !drawing) return null;
  const to = anchor(area, drawing, { ...target, endpoint: target.row });
  if (integration.kind === 'call' && !to.exact) return null;
  return { ...to.box, y: to.box.y + to.port - 60, height: 120 };
}

export interface ConnectionScope {
  readonly area: string;
  readonly system?: string;
  readonly component?: string;
  /** Narrows a component to some of its endpoints: those it serves, or whose handlers make the call. */
  readonly endpoints?: readonly string[];
}

export function scopeContains(scope: ConnectionScope, endpoint: ConnectionScope): boolean {
  if (scope.area !== endpoint.area) return false;
  if (scope.system !== undefined && scope.system !== endpoint.system) return false;
  if (scope.component !== undefined && scope.component !== endpoint.component) return false;
  return (
    scope.endpoints === undefined ||
    scope.endpoints.some((id) => endpoint.endpoints?.includes(id) === true)
  );
}

function callerOf(record: AreaIntegration): ConnectionScope {
  return {
    area: record.callerArea,
    system: record.callerSystem,
    component: record.caller,
    endpoints: record.callerEndpoint === undefined ? [] : [record.callerEndpoint],
  };
}

function providerOf(record: AreaIntegration): ConnectionScope {
  return {
    area: record.providerArea,
    system: record.providerSystem,
    component: record.provider,
    endpoints: record.kind === 'call' ? [record.endpoint] : [],
  };
}

export function landscapeConnectionsInScope(
  records: readonly AreaIntegration[],
  scopes: readonly ConnectionScope[],
): readonly AreaIntegration[] {
  if (scopes.length === 0) return records;
  return records.filter((record) => {
    const caller = callerOf(record);
    const provider = providerOf(record);
    if (scopes.length === 1) {
      return scopes.some((scope) => scopeContains(scope, caller) || scopeContains(scope, provider));
    }
    return scopes.some(
      (source) =>
        scopeContains(source, caller) &&
        scopes.some((target) => target !== source && scopeContains(target, provider)),
    );
  });
}

export function sameConnectionScope(left: ConnectionScope, right: ConnectionScope): boolean {
  return scopeContains(left, right) && scopeContains(right, left);
}

interface IntegrationGroup {
  readonly id: string;
  readonly from: ReturnType<typeof anchor>;
  readonly to: ReturnType<typeof anchor>;
  readonly members: readonly AreaIntegration[];
  readonly caption?: string;
  readonly bidirectional?: boolean;
}

function placedIntegration(
  areas: ReadonlyMap<string, AreaMapNode>,
  drawings: Drawings,
  record: AreaIntegration,
) {
  const caller = areas.get(record.callerArea);
  const provider = areas.get(record.providerArea);
  if (caller === undefined || provider === undefined) return [];
  const entry = record.kind === 'receive' ? record.caller : record.callerEndpoint;
  const from = anchor(caller, drawings.get(caller.id), {
    system: record.callerSystem,
    component: record.caller,
    ...(entry === undefined ? {} : { endpoint: entry }),
  });
  const to = anchor(provider, drawings.get(provider.id), {
    system: record.providerSystem,
    component: record.provider,
    ...(record.kind === 'receive'
      ? {}
      : { endpoint: record.kind === 'call' ? record.endpoint : record.provider }),
  });
  return [{ id: JSON.stringify([from.id, to.id]), from, to, record }];
}

export function landscapeIntegrationGroups(
  layout: AreaLandscapeView,
  drawings: Drawings,
  records: readonly AreaIntegration[],
): readonly IntegrationGroup[] {
  const areas = new Map(layout.nodes.map((area) => [area.id, area]));
  const placed = records.flatMap((record) => placedIntegration(areas, drawings, record));
  return [...Map.groupBy(placed, ({ id }) => id).values()]
    .flatMap((members) => {
      const first = members[0];
      return first === undefined
        ? []
        : [{ id: first.id, from: first.from, to: first.to, members: members.map((m) => m.record) }];
    })
    .filter(({ from, to }) => from.cardId === undefined || from.cardId !== to.cardId);
}

/** One connection for each visible pair, irrespective of which direction was recorded first. */
export function focusedLandscapeGroups(
  groups: readonly IntegrationGroup[],
  scope?: ConnectionScope,
): readonly IntegrationGroup[] {
  const pairs = new Map<string, IntegrationGroup[]>();
  for (const group of groups) {
    if (group.from.id === group.to.id) continue;
    const key = JSON.stringify([group.from.id, group.to.id].toSorted((a, b) => a.localeCompare(b)));
    const pair = pairs.get(key) ?? [];
    pair.push(group);
    pairs.set(key, pair);
  }
  return [...pairs.entries()].flatMap(([id, pair]) => {
    const callsFromFocus = ({ members }: IntegrationGroup): boolean =>
      scope !== undefined && members.some((record) => scopeContains(scope, callerOf(record)));
    const first = pair.find(callsFromFocus) ?? pair[0];
    if (first === undefined) return [];
    const members = pair.flatMap((group) => group.members);
    const touchesFocus =
      scope !== undefined &&
      members.some(
        (record) =>
          scopeContains(scope, callerOf(record)) !== scopeContains(scope, providerOf(record)),
      );
    const outgoing = touchesFocus
      ? members.filter((record) => scopeContains(scope, callerOf(record))).length
      : first.members.length;
    return [
      {
        ...first,
        id,
        members,
        caption: landscapeCountCaption(outgoing, members.length),
        bidirectional: pair.length > 1,
      },
    ];
  });
}

/** Reuse authored routes for recorded area roll-ups while either area is collapsed. */
export function mergeLandscapeCaptions(
  layout: AreaLandscapeView,
  groups: readonly IntegrationGroup[],
  area: string | undefined,
  expanded: ReadonlySet<string>,
  onRoutes?: Parameters<typeof relayoutLandscapeCaptions>[2],
): {
  readonly view: AreaLandscapeView;
  readonly merged: ReadonlyMap<string, string>;
  readonly bidirectional: ReadonlySet<string>;
  readonly groups: readonly IntegrationGroup[];
} {
  const byPair = new Map(
    groups
      .filter(({ from, to }) => !expanded.has(from.id) || !expanded.has(to.id))
      .map((group) => [group.id, group]),
  );
  const merged = new Map<string, string>();
  const bidirectional = new Set<string>();
  const captions = new Map<string, string>();
  const edges = layout.edges.flatMap((edge) => {
    const pair = JSON.stringify([edge.from, edge.to].toSorted((a, b) => a.localeCompare(b)));
    const group = byPair.get(pair);
    if (group === undefined) return [];
    byPair.delete(pair);
    merged.set(edge.id, group.id);
    if (group.bidirectional === true) bidirectional.add(edge.id);
    const source = area === edge.to ? edge.to : edge.from;
    const outgoing = group.members.filter(({ callerArea }) => callerArea === source).length;
    captions.set(edge.id, landscapeCountCaption(outgoing, group.members.length));
    return [{ ...edge, label: `${group.from.name} and ${group.to.name}` }];
  });
  return {
    view: relayoutLandscapeCaptions({ ...layout, edges }, captions, onRoutes),
    merged,
    bidirectional,
    groups: [...byPair.values()],
  };
}

export type IntegrationArrow = NonNullable<ReturnType<typeof areaRoute>> & {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly kind: 'api' | 'message' | 'data';
  readonly bidirectional?: boolean;
};

const integrationLineKind = {
  call: 'api',
  publish: 'message',
  receive: 'message',
  read: 'data',
  write: 'data',
} as const;

function routeBoxId({ box }: IntegrationGroup['from']): string {
  return JSON.stringify([box.x, box.y, box.width, box.height]);
}

// The SVG path takes a 16-unit hit stroke. Leave a gutter between adjacent lanes.
const LANE_PITCH = 24;
const PORT_MARGIN = 12;

function corridorLanes(groups: readonly IntegrationGroup[]): ReadonlyMap<string, number> {
  const corridors = new Map<string, IntegrationGroup[]>();
  for (const group of groups) {
    const ends = [routeBoxId(group.from), routeBoxId(group.to)].toSorted((a, b) =>
      a.localeCompare(b),
    );
    const key = JSON.stringify(ends);
    const peers = corridors.get(key);
    if (peers === undefined) corridors.set(key, [group]);
    else peers.push(group);
  }
  const lanes = new Map<string, number>();
  for (const peers of corridors.values()) {
    const ordered = peers.toSorted((left, right) => left.id.localeCompare(right.id));
    for (const [index, { id }] of ordered.entries()) {
      lanes.set(id, (index - (ordered.length - 1) / 2) * LANE_PITCH);
    }
  }
  return lanes;
}

function routePort(endpoint: IntegrationGroup['from'], lane: number): number {
  if (endpoint.exact) return endpoint.box.y + endpoint.port;
  const space = endpoint.portHeight === undefined ? 0 : endpoint.portHeight / 2 - PORT_MARGIN;
  const offset =
    space > 0 && endpoint.portHeight !== endpoint.box.height
      ? lane / (1 + Math.abs(lane) / space)
      : lane;
  const shifted = endpoint.port + offset;
  const fits = shifted >= PORT_MARGIN && shifted <= endpoint.box.height - PORT_MARGIN;
  return endpoint.box.y + (fits ? shifted : endpoint.port);
}

/** Stacked area cards use the gap between their facing edges. Endpoint ports stay on card sides. */
function routeBetweenStackedAreas(
  layout: AreaLandscapeView,
  group: IntegrationGroup,
  obstacles: readonly Box[],
  caption: { readonly width: number; readonly height: number },
  lane: number,
) {
  const { from, to } = group;
  if (
    !layout.nodes.some(({ id }) => id === from.id) ||
    !layout.nodes.some(({ id }) => id === to.id)
  ) {
    return null;
  }
  const left = Math.max(from.box.x, to.box.x) + PORT_MARGIN;
  const right = Math.min(from.box.x + from.box.width, to.box.x + to.box.width) - PORT_MARGIN;
  if (left > right) return null;
  const direction = from.box.y < to.box.y ? 1 : -1;
  const startY = direction === 1 ? from.box.y + from.box.height : from.box.y;
  const endY = direction === 1 ? to.box.y : to.box.y + to.box.height;
  if ((endY - startY) * direction <= 0) return null;
  const x = Math.max(left, Math.min(right, (left + right) / 2 + lane));
  return areaRoute({
    start: { x, y: startY },
    end: { x, y: endY },
    direction,
    vertical: true,
    obstacles,
    labelWidth: caption.width,
    labelHeight: caption.height,
  });
}

function routeBesideCards(
  layout: AreaLandscapeView,
  group: IntegrationGroup,
  obstacles: readonly Box[],
  caption: { readonly width: number; readonly height: number },
  lane: number,
) {
  const { from, to } = group;
  const direction = from.box.x < to.box.x ? 1 : -1;
  const start = {
    x: from.box.x + (direction === 1 ? from.box.width : 0),
    y: routePort(from, lane),
  };
  const end = {
    x: to.box.x + (direction === 1 ? 0 : to.box.width),
    y: routePort(to, lane),
  };
  const options = {
    start,
    end,
    direction,
    obstacles,
    labelWidth: caption.width,
    labelHeight: caption.height,
  } as const;
  if (lane === 0 || start.y !== routePort(from, 0) || end.y !== routePort(to, 0)) {
    return areaRoute(options);
  }

  // Exact ports stay fixed. If neither card has room for this departure lane, try a
  // parallel segment in the free canvas. The list still holds every group.
  const returnLane = (start.y + end.y) / 2 + lane;
  if (returnLane < PORT_MARGIN || returnLane > layout.height - PORT_MARGIN) return null;
  const route = areaRoute({ ...options, returnLane });
  const hasLane = route?.points.some((point, index, points) => {
    const next = points[index + 1];
    return (
      next !== undefined &&
      point.y === returnLane &&
      next.y === returnLane &&
      Math.abs(point.x - next.x) >= LANE_PITCH
    );
  });
  return hasLane === true ? route : null;
}

function routeInCorridor(
  layout: AreaLandscapeView,
  group: IntegrationGroup,
  obstacles: readonly Box[],
  caption: { readonly width: number; readonly height: number },
  lane: number,
) {
  return (
    routeBetweenStackedAreas(layout, group, obstacles, caption, lane) ??
    routeBesideCards(layout, group, obstacles, caption, lane)
  );
}

function integrationCaption(group: IntegrationGroup): string {
  const [first] = group.members;
  if (first === undefined) return '';
  if (group.members.every(({ kind }) => kind === 'read' || kind === 'write')) {
    return plural(group.members.length, 'data access', 'data accesses');
  }
  if (group.members.length === 1) return first.signature;
  if (group.members.every(({ kind }) => kind === 'call') && group.bidirectional !== true) {
    return plural(group.members.length, 'call');
  }
  return group.caption ?? plural(group.members.length, 'integration');
}

function landscapeIntegrationArrow(
  layout: AreaLandscapeView,
  drawings: Drawings,
  group: IntegrationGroup,
  options: {
    readonly lane: number;
    readonly selected?: AreaIntegration;
  },
): IntegrationArrow | null {
  const { from, to, members } = group;
  const { lane, selected } = options;
  const member = members[0];
  if (member === undefined || from.id === to.id) return null;
  const firstKind = integrationLineKind[member.kind];
  const kind = members.every((item) => integrationLineKind[item.kind] === firstKind)
    ? firstKind
    : 'api';
  const label = selected?.signature ?? integrationCaption(group);
  const caption = diagramCaption(label);
  const obstacles = obstaclesOf(layout, drawings, member);
  const route = routeInCorridor(layout, group, obstacles, caption, lane);
  if (route === null) return null;
  return {
    ...route,
    id: selected?.id ?? group.id,
    label,
    detail:
      group.bidirectional === true
        ? `${from.name} ↔ ${to.name} · ${label}`
        : `${from.name} → ${to.name} · ${label}`,
    ...(group.bidirectional === true ? { bidirectional: true } : {}),
    kind,
  };
}

function captionBox(edge: { readonly x: number; readonly y: number }, label: string): Box {
  const { width, height } = diagramCaption(label);
  return { x: edge.x - width / 2, y: edge.y - 14, width, height };
}

function labelIntegrationArrows(
  layout: AreaLandscapeView,
  drawings: Drawings,
  entries: readonly { readonly edge: IntegrationArrow; readonly member: AreaIntegration }[],
): readonly IntegrationArrow[] {
  const reserved = layout.edges.flatMap((edge) =>
    edge.labelHidden === true ? [] : [captionBox(edge, edge.caption ?? edge.label)],
  );
  const routes = entries.map(({ edge }) => lineBoxes(edge.points));
  return entries.map(({ edge, member }, index) => {
    const obstacles = obstaclesOf(layout, drawings, member);
    const caption = diagramCaption(edge.label);
    const position = labelPoint(edge.points, [...obstacles, ...reserved], caption.width, false, {
      height: caption.height,
      bounds: { x: 0, y: 0, width: layout.width, height: layout.height },
      lines: routes.flatMap((boxes, other) => (other === index ? [] : boxes)),
    });
    if (position.labelHidden !== true) reserved.push(captionBox(position, edge.label));
    return { ...edge, ...position, labelHidden: position.labelHidden === true };
  });
}

/** A visible caption reserves space before later technical captions are routed. */
export function landscapeIntegrationArrows(
  layout: AreaLandscapeView,
  drawings: Drawings,
  groups: readonly IntegrationGroup[],
  active?: { readonly group: IntegrationGroup; readonly member: AreaIntegration },
): { readonly arrows: readonly IntegrationArrow[]; readonly selected: IntegrationArrow | null } {
  const lanes = corridorLanes(groups);
  const selected =
    active === undefined
      ? null
      : landscapeIntegrationArrow(layout, drawings, active.group, {
          lane: lanes.get(active.group.id) ?? 0,
          selected: active.member,
        });
  const entries =
    selected === null || active === undefined ? [] : [{ edge: selected, member: active.member }];
  const specificity = ({ from, to }: IntegrationGroup): number =>
    Number(from.exact) + Number(to.exact);
  const ordered = groups.toSorted((left, right) => specificity(right) - specificity(left));
  for (const group of ordered) {
    const edge = group.members.some(({ id }) => id === active?.member.id)
      ? null
      : landscapeIntegrationArrow(layout, drawings, group, {
          lane: lanes.get(group.id) ?? 0,
        });
    const [member] = group.members;
    if (edge !== null && member !== undefined) entries.push({ edge, member });
  }
  const labelled = labelIntegrationArrows(layout, drawings, entries);
  if (selected === null) return { arrows: labelled, selected: null };
  return { arrows: labelled.slice(1), selected: labelled[0] ?? null };
}
