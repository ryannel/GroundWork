import type { AreaSystemBox } from '@/application/area-system-layout';
import type { AreaComponentView, AreaSystemView, AreaView } from '@/application/workspace-area';
import type { LandscapeValueFlow } from '@/domain/landscape';

import { cardLayout, CARD } from './card-geometry';
import { diagramSpacing } from './diagram-spacing';
import { componentBands, componentOwners, valueFlowComponents } from './value-flow-components';

export interface ValueFlowNode extends AreaSystemBox {
  readonly component: AreaComponentView;
  readonly system: string;
  readonly band: string;
  readonly supporting: boolean;
  readonly collapsed: boolean;
  readonly members: readonly string[];
  readonly systemId: string;
  readonly open?: boolean;
  /** Other authored work retained on the one collapsed system card. */
  readonly activities?: readonly string[];
}

export interface ValueFlowHeading {
  readonly width: number;
  readonly height: number;
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly x: number;
  readonly y: number;
}

export interface ValueFlowGroup extends AreaSystemBox {
  readonly name: string;
  readonly purpose: string;
}

export interface ValueFlowDrawing {
  readonly nodes: readonly ValueFlowNode[];
  readonly headings: readonly ValueFlowHeading[];
  readonly width: number;
  readonly height: number;
}

/** Recorded adjacency places support; it does not invent a business flow or reverse an arrow. */
function supportAnchors(
  system: AreaSystemView,
  core: ReadonlySet<string>,
  relationships: AreaView['technicalRelationships'],
): ReadonlyMap<string, string> {
  const ids = new Set(system.components.map((component) => component.id));
  const owners = componentOwners(system.components);
  const pairs = [
    ...relationships.map((edge) => [edge.from, edge.to] as const),
    ...system.components.flatMap((component) =>
      component.parentComponent === undefined
        ? []
        : [[component.id, component.parentComponent] as const],
    ),
  ]
    .map(([from, to]) => [owners.get(from) ?? from, owners.get(to) ?? to] as const)
    .filter(([from, to]) => ids.has(from) && ids.has(to));
  const neighbours = new Map<string, string[]>();
  for (const [from, to] of pairs) {
    neighbours.set(from, [...(neighbours.get(from) ?? []), to]);
    neighbours.set(to, [...(neighbours.get(to) ?? []), from]);
  }
  const anchors = new Map([...core].map((id) => [id, id]));
  let frontier = [...core];
  while (frontier.length > 0) {
    frontier = frontier.flatMap((id) => {
      const next = (neighbours.get(id) ?? []).filter((peer) => !anchors.has(peer));
      for (const peer of next) {
        anchors.set(peer, anchors.get(id) ?? id);
      }
      return next;
    });
  }
  return anchors;
}

/** Core columns never grow merely because one component has more supporting neighbours. */
function columnPositions(
  bands: LandscapeValueFlow['bands'],
  gap: number,
): ReadonlyMap<number, number> {
  const columns = [
    ...new Set(bands.flatMap((band) => band.nodes.map((node) => node.column))),
  ].toSorted((a, b) => a - b);
  return new Map(columns.map((column, index) => [column, 48 + index * (CARD.width + gap)]));
}

function componentNode(
  component: AreaComponentView,
  system: AreaSystemView,
  placement: {
    readonly band: string;
    readonly rank: number;
    readonly x: number;
    readonly y: number;
    readonly supporting: boolean;
  },
  open: ReadonlySet<string>,
): ValueFlowNode {
  return {
    ...placement,
    id: component.id,
    component,
    system: system.name,
    systemId: system.id,
    collapsed: false,
    members: [component.id, ...(component.attachments ?? []).map((resource) => resource.id)],
    open: open.has(component.id),
    width: CARD.width,
    height: cardLayout(component, open.has(component.id)).height,
  };
}

/** Keep secondary work close to its recorded core neighbour, balancing the space beneath the band. */
function supportingNodes(
  components: readonly AreaComponentView[],
  system: AreaSystemView,
  band: LandscapeValueFlow['bands'][number],
  anchors: ReadonlyMap<string, string>,
  positions: ReadonlyMap<number, number>,
  placement: { readonly top: number; readonly gap: number },
  open: ReadonlySet<string>,
): readonly ValueFlowNode[] {
  const { top, gap } = placement;
  const bottoms = new Map([...positions].map(([column]) => [column, top]));
  return components
    .toSorted((a, b) => a.id.localeCompare(b.id))
    .map((component) => {
      const preferred =
        band.nodes.find((node) => node.component === anchors.get(component.id))?.column ?? 0;
      const lowest = Math.min(...bottoms.values());
      const candidates = [...positions.keys()].filter(
        (column) => (bottoms.get(column) ?? top) <= lowest + 100,
      );
      const column =
        candidates.toSorted((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred))[0] ??
        preferred;
      const node = componentNode(
        component,
        system,
        {
          band: band.id,
          rank: column,
          x: positions.get(column) ?? 48,
          y: bottoms.get(column) ?? top,
          supporting: true,
        },
        open,
      );
      bottoms.set(column, node.y + node.height + gap);
      return node;
    });
}

/** Each opened system owns one local drawing, including all its supporting components. */
export function valueFlowSystem(
  source: AreaSystemView,
  narrative: LandscapeValueFlow,
  relationships: AreaView['technicalRelationships'],
  open: ReadonlySet<string> = new Set(),
): ValueFlowDrawing {
  const system = { ...source, components: valueFlowComponents(source) };
  const bands = componentBands(system.components, narrative);
  const core = new Set(bands.flatMap((band) => band.nodes.map((node) => node.component)));
  const anchors = supportAnchors(system, core, relationships);
  const ids = new Set(system.components.map((component) => component.id));
  const spacing = diagramSpacing(
    narrative.connections.filter((edge) => ids.has(edge.from) && ids.has(edge.to)),
  );
  const positions = columnPositions(bands, spacing.horizontal);
  const nodes: ValueFlowNode[] = [];
  const headings: ValueFlowHeading[] = [];
  let y = 100;
  for (const band of bands) {
    const bottoms = new Map<number, number>();
    const placed = band.nodes.flatMap((entry) => {
      const component = system.components.find((item) => item.id === entry.component);
      if (component === undefined) return [];
      const node = componentNode(
        component,
        system,
        {
          band: band.id,
          rank: entry.column,
          x: positions.get(entry.column) ?? 48,
          y: bottoms.get(entry.column) ?? y + 116,
          supporting: false,
        },
        open,
      );
      bottoms.set(entry.column, node.y + node.height + spacing.vertical);
      return [node];
    });
    const members = new Set(band.nodes.map((node) => node.component));
    const support = system.components.filter(
      (component) => !core.has(component.id) && members.has(anchors.get(component.id) ?? ''),
    );
    const secondary = supportingNodes(
      support,
      system,
      band,
      anchors,
      positions,
      {
        top: Math.max(...placed.map((node) => node.y + node.height)) + spacing.vertical,
        gap: spacing.vertical,
      },
      open,
    );
    headings.push({
      ...band,
      x: Math.min(...placed.map((node) => node.x)),
      y,
      width: Math.min(
        1100,
        Math.max(...placed.map((node) => node.x + node.width)) -
          Math.min(...placed.map((node) => node.x)),
      ),
      height: 100,
    });
    nodes.push(...placed, ...secondary);
    y =
      Math.max(
        ...placed.map((node) => node.y + node.height),
        ...secondary.map((node) => node.y + node.height),
      ) + 96;
  }
  const remaining = system.components.filter((component) => !anchors.has(component.id));
  if (remaining.length > 0) {
    headings.push({
      id: `support:${system.id}`,
      title: 'Other components',
      summary: 'Supporting work outside the main flow. Some connections are not mapped yet.',
      x: 40,
      y,
      width: Math.min(1100, Math.min(4, remaining.length) * 480 - 160),
      height: 64,
    });
    nodes.push(
      ...remaining.map((component, index) => ({
        id: component.id,
        component,
        system: system.name,
        systemId: system.id,
        band: `support:${system.id}`,
        supporting: true,
        collapsed: false,
        members: [component.id, ...(component.attachments ?? []).map((resource) => resource.id)],
        open: open.has(component.id),
        rank: index % 4,
        x: 48 + (index % 4) * 480,
        y:
          y +
          80 +
          Math.floor(index / 4) *
            (Math.max(...remaining.map((item) => cardLayout(item, open.has(item.id)).height)) +
              100),
        width: CARD.width,
        height: cardLayout(component, open.has(component.id)).height,
      })),
    );
  }
  return {
    nodes,
    headings,
    width: Math.max(640, ...nodes.map((node) => node.x + node.width + 64)),
    height: Math.max(240, ...nodes.map((node) => node.y + node.height + 64)),
  };
}
