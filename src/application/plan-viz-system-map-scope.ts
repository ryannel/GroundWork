import { bySystem } from '@/application/plan-viz-system-map-columns';
import type {
  MapEdgeIn,
  MapNodeIn,
  MapSystemIn,
  SystemMapInput,
} from '@/application/plan-viz-system-map-types';

// A map of part of the landscape: the components in view, and one hop out the ones they call, are called by,
// message or keep data with. Everything further away is left out, so the layout stays as small as the scope.

export interface MapScope {
  /** Component ids in view, and the ids of the systems in view; null for the whole landscape. */
  readonly focus: readonly string[] | null;
  /** Where each system lives, by system id, said on its card: "Website domain". */
  readonly places: Readonly<Record<string, string>>;
}

interface Senders {
  readonly from: ReadonlyMap<string, ReadonlySet<string>>;
  readonly to: ReadonlyMap<string, ReadonlySet<string>>;
}

const withValue = (
  map: ReadonlyMap<string, ReadonlySet<string>>,
  key: string,
  value: string,
): ReadonlySet<string> => new Set([...(map.get(key) ?? []), value]);

/** Who sends and who receives each message, through whatever topic carries it. */
function sendersOf(edges: readonly MapEdgeIn[], topics: ReadonlySet<string>): Senders {
  const from = new Map<string, ReadonlySet<string>>();
  const to = new Map<string, ReadonlySet<string>>();
  for (const e of edges) {
    if (e.kind !== 'msg' || e.via === null) continue;
    if (topics.has(e.to)) from.set(e.via, withValue(from, e.via, e.from));
    if (topics.has(e.from)) to.set(e.via, withValue(to, e.via, e.to));
  }
  return { from, to };
}

const meets = (ids: ReadonlySet<string> | undefined, focus: ReadonlySet<string>): boolean =>
  [...(ids ?? [])].some((id) => focus.has(id));

/** Whether an edge says something about the focus: one end is in it, or it carries a message from the focus to
 * someone outside, or from someone outside to the focus. Others who get the same message are not neighbours. */
function touches(e: MapEdgeIn, focus: ReadonlySet<string>, senders: Senders): boolean {
  if (focus.has(e.from) || focus.has(e.to)) return true;
  if (e.kind !== 'msg' || e.via === null) return false;
  return senders.to.get(e.via)?.has(e.to) === true
    ? meets(senders.from.get(e.via), focus)
    : meets(senders.to.get(e.via), focus);
}

function keptEdges(input: SystemMapInput, focus: ReadonlySet<string>): MapEdgeIn[] {
  const topics = new Set(input.stores.filter((s) => s.topic).map((s) => s.id));
  const senders = sendersOf(input.edges, topics);
  return input.edges.filter((e) => touches(e, focus, senders));
}

/** Calls and events between two neighbours already on the map, each in a different system: without them a
 * neighbour such as a graph router looks as if it reached nothing it does reach. Adds no new system. */
function between(input: SystemMapInput, kept: readonly MapEdgeIn[]): MapEdgeIn[] {
  const systemOf = new Map(input.services.map((s) => [s.id, s.system ?? '']));
  const sys = (id: string): string => systemOf.get(id) ?? '';
  const shown = new Set(kept.flatMap((e) => [sys(e.from), sys(e.to)]).filter((id) => id !== ''));
  const taken = new Set(kept);
  const across = (e: MapEdgeIn): boolean =>
    sys(e.from) !== sys(e.to) && shown.has(sys(e.from)) && shown.has(sys(e.to));
  return input.edges.filter((e) => !taken.has(e) && e.kind !== 'data' && across(e));
}

type Where = 'everywhere' | 'in' | 'out';

/** Where a system lives, said only where the page does not: on the landscape when it says nothing of itself, and
 * on every card outside the focus ("Shopping · shows the price breakdown"). */
function placed<T extends MapNodeIn>(node: T, places: MapScope['places'], where: Where): T {
  const place = places[node.id];
  if (place === undefined || where === 'in') return node;
  if (node.does === '') return { ...node, does: place };
  return where === 'out' ? { ...node, does: `${place} · ${node.does}` } : node;
}

function whereOf(scope: MapScope, focus: ReadonlySet<string>, id: string): Where {
  if (scope.focus === null) return 'everywhere';
  return focus.has(id) ? 'in' : 'out';
}

/** The input narrowed to the scope; the whole input, with each system's place said, when there is no focus. */
export function scopeMapInput(input: SystemMapInput, scope: MapScope): SystemMapInput {
  const focus = new Set(scope.focus);
  const systems = input.systems.map((s) => placed(s, scope.places, whereOf(scope, focus, s.id)));
  if (scope.focus === null) return { ...input, systems };
  const near = keptEdges(input, focus);
  const edges = [...near, ...between(input, near)];
  const kept = new Set([...focus, ...edges.flatMap((e) => [e.from, e.to])]);
  const services = input.services.filter((s) => kept.has(s.id));
  const held = new Set(services.map((s) => s.system));
  const shown = new Set(services.map((s) => s.id));
  const scoped = {
    ...input,
    services,
    systems: systems.filter((s) => focus.has(s.id) || held.has(s.id)),
    stores: input.stores.filter((s) => kept.has(s.id)),
    edges,
    steps: input.steps.filter((s) => shown.has(s.from) && shown.has(s.to)),
    stages: input.stages.map((stage) => ({
      ...stage,
      entries: stage.entries.filter((x) => shown.has(x.svc)),
    })),
    stageOf: Object.fromEntries(Object.entries(input.stageOf).filter(([id]) => shown.has(id))),
    focus: [...focus],
  };
  return bySystem(scoped)
    ? { ...scoped, systems: scoped.systems.map((s) => homed(s, input, scope)) }
    : scoped;
}

/** On a map read system by system, another domain's system says its domain once, over its band, not on its card. */
function homed(node: MapSystemIn, input: SystemMapInput, scope: MapScope): MapSystemIn {
  const place = scope.places[node.id];
  const own = input.systems.find((s) => s.id === node.id);
  return place === undefined || own === undefined ? node : { ...node, does: own.does, place };
}
