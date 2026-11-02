import type { AreaView } from '@/application/workspace-area';
import type { LandscapeValueFlow } from '@/domain/landscape';

import { valueFlowConnections } from './value-flow-connections';
import { routeValueFlows, type ValueFlowRoute } from './value-flow-routing';
import {
  valueFlowSystem,
  type ValueFlowDrawing,
  type ValueFlowGroup,
  type ValueFlowHeading,
  type ValueFlowNode,
} from './value-flow-system';

export type { ValueFlowNode } from './value-flow-system';

/** A collapsed card keeps the other distinct work performed by its system. */
function bandsBySystem(narrative: LandscapeValueFlow, owners: ReadonlyMap<string, string>) {
  const result = new Map<string, LandscapeValueFlow['bands'][number][]>();
  for (const band of narrative.bands) {
    const systems = new Set(band.nodes.map((node) => owners.get(node.component)));
    for (const system of systems) {
      if (system !== undefined) result.set(system, [...(result.get(system) ?? []), band]);
    }
  }
  return result;
}

/** A caption belongs to adjacent cards on one row, never a rectangle spanning other work. */
function overviewHeadings(
  nodes: readonly ValueFlowNode[],
  headings: readonly ValueFlowHeading[],
): ValueFlowHeading[] {
  return [...new Map(headings.map((heading) => [heading.id, heading])).values()].flatMap(
    (heading) => {
      const members = nodes
        .filter((node) => node.collapsed && node.band === heading.id)
        .toSorted((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
      const rows: ValueFlowNode[][] = [];
      for (const node of members) {
        const row = rows.at(-1);
        const previous = row?.at(-1);
        if (previous?.y === node.y && node.x - previous.x - previous.width <= 180) {
          row?.push(node);
        } else {
          rows.push([node]);
        }
      }
      return rows.flatMap((row) => {
        const first = row[0];
        const last = row.at(-1);
        if (first === undefined || last === undefined) return [];
        return [
          {
            ...heading,
            x: first.x,
            y: first.y - 114,
            width: Math.min(1100, last.x + last.width - first.x),
          },
        ];
      });
    },
  );
}

/** Parallel contributions share rows; downstream stages sit alongside their inputs, not beneath them. */
function packOverview(
  nodes: readonly ValueFlowNode[],
  headings: readonly ValueFlowHeading[],
): ValueFlowDrawing {
  const stages = [...new Set(nodes.map((node) => node.rank))].toSorted((a, b) => a - b);
  const rows = Math.min(
    3,
    Math.max(1, ...stages.map((stage) => nodes.filter((node) => node.rank === stage).length)),
  );
  const rowHeight = Math.max(316, ...nodes.map((node) => node.height + 160));
  let left = 80;
  const placed: ValueFlowNode[] = [];
  for (const stage of stages) {
    const members = nodes.filter((node) => node.rank === stage);
    const columns = Math.ceil(members.length / rows);
    placed.push(
      ...members.map((node, index) => ({
        ...node,
        x: left + Math.floor(index / rows) * 460,
        y:
          146 +
          ((index % rows) + Math.floor((rows - Math.min(rows, members.length)) / 2)) * rowHeight,
      })),
    );
    left += columns * 460;
  }
  return {
    nodes: placed,
    headings: overviewHeadings(placed, headings),
    width: Math.max(1200, left - 100),
    height: Math.max(500, ...placed.map((node) => node.y + node.height + 80)),
  };
}

/** Meaning supplies the order. Space, rather than omissions, separates the core work from its support. */
function overviewLayout(view: AreaView, narrative: LandscapeValueFlow): ValueFlowDrawing {
  const all = view.systems.flatMap((system) =>
    system.components.map((component) => ({ component, system: system.name, systemId: system.id })),
  );
  const orderedCore = narrative.bands.flatMap((band) => band.nodes.map((node) => node.component));
  const core = new Set(orderedCore);
  const authoredOrder = new Map(orderedCore.map((id, index) => [id, index]));
  const owner = new Map(all.map((item) => [item.component.id, item.systemId]));
  const responsible = new Map(
    all.map((item) => [item.component.id, item.component.parentComponent ?? item.component.id]),
  );
  const score = (id: string): number =>
    (narrative.overview ?? narrative.connections).filter(
      (edge) =>
        [responsible.get(edge.from), responsible.get(edge.to)].includes(id) &&
        owner.get(edge.from) !== owner.get(edge.to),
    ).length;
  const anchors = new Map(
    view.systems.map((system) => {
      const candidates = all.filter(
        (item) => item.systemId === system.id && core.has(item.component.id),
      );
      return [
        system.id,
        candidates.toSorted((a, b) => {
          const difference = score(b.component.id) - score(a.component.id);
          if (difference === 0) {
            return (
              (authoredOrder.get(a.component.id) ?? 0) - (authoredOrder.get(b.component.id) ?? 0)
            );
          }
          return difference;
        })[0]?.component.id,
      ];
    }),
  );
  const systemBands = bandsBySystem(narrative, owner);
  const headings: ValueFlowHeading[] = [];
  let y = 32;
  const nodes: ValueFlowNode[] = narrative.bands.flatMap((band) => {
    const top = y;
    const groups = new Map<string, typeof band.nodes>();
    for (const node of band.nodes) {
      const item = all.find((candidate) => candidate.component.id === node.component);
      if (item === undefined || anchors.get(item.systemId) !== node.component) {
        continue;
      }
      const key = item.systemId;
      groups.set(key, [...(groups.get(key) ?? []), node]);
    }
    if (groups.size === 0) return [];
    const placed = [...groups].flatMap(([key, members]) => {
      const item = all.find((candidate) => candidate.component.id === members[0]?.component);
      if (item === undefined) return [];
      const column =
        narrative.columns?.find((entry) => entry.system === key)?.column ??
        (groups.size === 1 ? 0 : Math.min(...members.map((node) => node.column)));
      return [
        {
          ...item,
          id: `${band.id}:${key}`,
          column,
          members: all
            .filter((candidate) => candidate.systemId === item.systemId)
            .map((candidate) => candidate.component.id),
          collapsed: true,
          activities: (systemBands.get(key) ?? [])
            .filter((other) => other.id !== band.id)
            .map((other) => other.title),
        },
      ];
    });
    const cardHeight = (node: (typeof placed)[number]) =>
      140 + Math.min(3, node.activities.length) * 24;
    const columnsHeight = placed.map((node) =>
      placed
        .filter((peer) => peer.column === node.column)
        .reduce((sum, peer) => sum + cardHeight(peer) + 40, 0),
    );
    headings.push({
      ...band,
      x: 80 + Math.min(...placed.map((node) => node.column)) * 460,
      y: top,
      width: 280,
      height: 100,
    });
    y += 136 + Math.max(180, ...columnsHeight);
    return placed.map((node, index) => ({
      ...node,
      x: 80 + node.column * 460,
      y:
        top +
        114 +
        placed
          .slice(0, index)
          .filter((peer) => peer.column === node.column)
          .reduce((sum, peer) => sum + cardHeight(peer) + 40, 0),
      width: 280,
      height: cardHeight(node),
      rank: node.column,
      band: band.id,
      supporting: false,
    }));
  });
  const columns = [...new Set(nodes.map((node) => node.rank))].toSorted((a, b) => a - b);
  const shifted: ValueFlowNode[] = nodes.map((node) => ({
    ...node,
    x: 80 + columns.indexOf(node.rank) * 460,
  }));
  for (const [index, heading] of headings.entries()) {
    const column = (heading.x - 80) / 460;
    const members = shifted.filter((node) => node.band === heading.id);
    const x = 80 + columns.indexOf(column) * 460;
    headings[index] = {
      ...heading,
      x,
      width: Math.min(1100, Math.max(...members.map((node) => node.x + node.width)) - x),
    };
  }
  y += 120;
  for (const system of view.systems) {
    const support = system.components.filter((component) => !core.has(component.id));
    if (support.length === 0 || anchors.get(system.id) !== undefined) {
      continue;
    }
    const shown = support.slice(0, 1);
    shifted.push(
      ...shown.map((component) => ({
        component,
        system: system.name,
        id: `support:${system.id}`,
        x: 80,
        y,
        width: 280,
        height: 140,
        rank: narrative.columns?.find((entry) => entry.system === system.id)?.column ?? 0,
        band: `support:${system.id}`,
        supporting: true,
        collapsed: true,
        members: support.map((item) => item.id),
        systemId: system.id,
      })),
    );
    y += 120 + Math.ceil(shown.length / 6) * 170;
  }
  return packOverview(shifted, headings);
}

function drawingSize(opened: ReadonlyMap<string, ValueFlowDrawing>, node: ValueFlowNode) {
  return opened.get(node.systemId) ?? node;
}

/** Opening replaces one overview card with a bounded system; neighbours make room around it. */
export function valueFlowLayout(
  view: AreaView,
  narrative: LandscapeValueFlow,
  expanded: ReadonlySet<string> = new Set(),
  open: ReadonlySet<string> = new Set(),
): ValueFlowDrawing & { readonly groups: readonly ValueFlowGroup[] } {
  const overview = overviewLayout(view, narrative);
  if (expanded.size === 0) return { ...overview, groups: [] };
  const opened = new Map(
    view.systems
      .filter((system) => expanded.has(system.id))
      .map(
        (system) =>
          [
            system.id,
            valueFlowSystem(system, narrative, view.technicalRelationships, open),
          ] as const,
      ),
  );
  const columns = [...new Set(overview.nodes.map((node) => node.x))].toSorted((a, b) => a - b);
  const xs = new Map<number, number>();
  const ys = new Map<string, number>();
  let x = 80;
  let height = 0;
  for (const column of columns) {
    let top = 146;
    for (const node of overview.nodes.filter((item) => item.x === column)) {
      ys.set(node.id, top);
      top += drawingSize(opened, node).height + 176;
    }
    height = Math.max(height, top);
    xs.set(column, x);
    x +=
      Math.max(
        280,
        ...overview.nodes
          .filter((node) => node.x === column)
          .map((node) => drawingSize(opened, node).width),
      ) + 180;
  }
  const groups: ValueFlowGroup[] = [];
  const headings: ValueFlowHeading[] = [];
  const nodes: ValueFlowNode[] = [];
  for (const node of overview.nodes) {
    const left = xs.get(node.x) ?? node.x;
    const top = ys.get(node.id) ?? node.y;
    const local = opened.get(node.systemId);
    if (local === undefined) {
      nodes.push({ ...node, x: left, y: top });
      continue;
    }
    groups.push({
      id: node.systemId,
      name: node.system,
      purpose: `${String(node.members.length)} components · Supporting connections are faint.`,
      x: left,
      y: top,
      width: local.width,
      height: local.height,
      rank: node.rank,
    });
    nodes.push(...local.nodes.map((child) => ({ ...child, x: left + child.x, y: top + child.y })));
    headings.push(
      ...local.headings.map((heading) => ({ ...heading, x: left + heading.x, y: top + heading.y })),
    );
  }
  headings.push(...overviewHeadings(nodes, overview.headings));
  return { nodes, groups, headings, width: Math.max(1200, x), height };
}

/** Project resources and rows before routing; a recorded exchange is never discarded by visual grouping. */
export function valueFlowEdges(
  narrative: LandscapeValueFlow,
  nodes: readonly ValueFlowNode[],
  headings: readonly ValueFlowHeading[] = [],
  technical: AreaView['technicalRelationships'] = [],
  groups: readonly ValueFlowGroup[] = [],
  platform: ReadonlySet<string> = new Set(),
): readonly ValueFlowRoute[] {
  return routeValueFlows(
    valueFlowConnections(narrative, nodes, technical, platform),
    nodes,
    headings,
    groups,
  );
}
