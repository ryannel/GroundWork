import type { Core } from '@/application/plan/derive-core';
import { memo } from '@/application/plan/derive-values';
import type { PlanNode, SystemGraph } from '@/domain/plan/plan-graph';
import type { Team } from '@/domain/plan/plan.generated';

export interface Lane {
  id: string;
  team: string | null;
  label: string;
}

export interface LayoutNode {
  id: string;
  type: 'service' | 'store';
  lane: number;
  col: number;
  row: number;
  under: string | null;
}

export interface Layout {
  lanes: Lane[];
  nodes: LayoutNode[];
  byId: Map<string, LayoutNode>;
  cols: Record<string, number>;
}

export interface LayoutInput {
  asIs: SystemGraph;
  toBe: SystemGraph;
  sys: (id: string) => PlanNode | undefined;
  unionIds: string[];
  teams: Team[];
}

const isEvent = (n: PlanNode | undefined): boolean =>
  n?.$type === 'store' && (n.kind === 'topic' || n.kind === 'queue');

/** Services and event stores in the order a reader meets them: as-is flows, then added flows, then the rest. */
function firstAppearance({ asIs, toBe, sys, unionIds }: LayoutInput) {
  const services: string[] = [];
  const topics: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string | undefined): void => {
    if (id === undefined || id === '' || seen.has(id)) return;
    const n = sys(id);
    if (n?.$type === 'service') services.push(id);
    else if (isEvent(n)) topics.push(id);
    else return;
    seen.add(id);
  };
  const flows = [...asIs.flows, ...toBe.flows.filter((f) => !asIs.has(f.id))];
  for (const f of flows) {
    for (const s of f.steps) {
      visit(s.from);
      visit(s.to);
    }
  }
  for (const id of unionIds) visit(id);
  return { services, topics };
}

const teamOf = (sys: LayoutInput['sys'], id: string | undefined): string | null => {
  const n = sys(id ?? '');
  return n?.$type === 'service' ? n.team : null;
};

function laneTeamsOf(input: LayoutInput, services: string[]): string[] {
  const teams: string[] = [];
  for (const svc of services) {
    const t = teamOf(input.sys, svc);
    if (t !== null && !teams.includes(t)) teams.push(t);
  }
  // teams not yet seen keep their authored order, but only if they own services
  for (const t of input.teams) {
    if (!teams.includes(t.id) && services.some((s) => teamOf(input.sys, s) === t.id)) {
      teams.push(t.id);
    }
  }
  return teams;
}

function lanesOf(input: LayoutInput, services: string[], topics: string[]): Lane[] {
  const lanes: Lane[] = laneTeamsOf(input, services).map((t) => ({
    id: t,
    team: t,
    label: input.teams.find((x) => x.id === t)?.name ?? t,
  }));
  const first = topics[0];
  if (first !== undefined) {
    const owner = input.sys(first);
    const host = owner?.$type === 'store' ? teamOf(input.sys, owner.owner) : null;
    const at = lanes.findIndex((l) => l.team === host);
    lanes.splice(at === -1 ? lanes.length : at + 1, 0, {
      id: 'events',
      team: null,
      label: 'Events',
    });
  }
  return lanes;
}

/** Services on row 0 of their team's lane, one column each. */
function placeServices(input: LayoutInput, services: string[], grid: Grid): void {
  for (const svc of services) {
    const lane = grid.laneIndex.get(teamOf(input.sys, svc) ?? '');
    if (lane === undefined) continue;
    grid.put({ id: svc, type: 'service', lane, col: grid.nextCol(lane), row: 0, under: null });
  }
}

/** Stores that are not events sit under their owning service, one row each. */
function placeStores(input: LayoutInput, grid: Grid): void {
  const rowsUnder = new Map<string, number>();
  for (const id of input.unionIds) {
    const n = input.sys(id);
    if (n?.$type !== 'store' || isEvent(n)) continue;
    const owner = grid.positions.get(n.owner);
    if (owner === undefined) continue;
    const row = (rowsUnder.get(n.owner) ?? 0) + 1;
    rowsUnder.set(n.owner, row);
    grid.put({ id, type: 'store', lane: owner.lane, col: owner.col, row, under: n.owner });
  }
}

interface Grid {
  laneIndex: Map<string, number>;
  positions: Map<string, LayoutNode>;
  nodes: LayoutNode[];
  columns: Map<number, number>;
  nextCol: (lane: number) => number;
  put: (node: LayoutNode) => void;
}

function newGrid(lanes: Lane[]): Grid {
  const columns = new Map<number, number>();
  const nodes: LayoutNode[] = [];
  const positions = new Map<string, LayoutNode>();
  return {
    laneIndex: new Map(lanes.map((l, i) => [l.id, i])),
    positions,
    nodes,
    columns,
    nextCol: (lane) => {
      const c = columns.get(lane) ?? 0;
      columns.set(lane, c + 1);
      return c;
    },
    put: (node) => {
      if (node.type === 'service') positions.set(node.id, node);
      nodes.push(node);
    },
  };
}

/**
 * Map layout on a grid: lanes and columns only; pixel geometry is the chart's job. It is computed over as-is ∪
 * to-be so positions stay put across modes.
 *
 * Lanes are teams in first-appearance order, with an `events` lane for topics and queues right after the lane of
 * the team owning the first topic. Services sit on row 0 of their team's lane, one column each; other stores sit
 * under their owner; topics and queues fill the events lane.
 */
export function layoutOf(input: LayoutInput): Layout {
  const { services, topics } = firstAppearance(input);
  const lanes = lanesOf(input, services, topics);
  const grid = newGrid(lanes);
  placeServices(input, services, grid);
  placeStores(input, grid);
  const events = grid.laneIndex.get('events');
  if (events !== undefined) {
    for (const id of topics) {
      grid.put({ id, type: 'store', lane: events, col: grid.nextCol(events), row: 0, under: null });
    }
  }
  return {
    lanes,
    nodes: grid.nodes,
    byId: new Map(grid.nodes.map((n) => [n.id, n])),
    cols: Object.fromEntries([...grid.columns].map(([lane, count]) => [String(lane), count])),
  };
}

/** The grid layout of the whole system, worked out once. */
export function createLayout(core: Core) {
  const layout = memo((): Layout =>
    layoutOf({
      asIs: core.asIs,
      toBe: core.toBe,
      sys: core.sys,
      unionIds: core.unionIds,
      teams: core.plan.teams,
    }),
  );
  return { layout };
}
