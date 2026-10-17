import type { MapEdgeIn, MapNodeIn, SystemMapInput } from '@/application/plan-viz-system-map-types';

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

function placed<T extends MapNodeIn>(node: T, places: MapScope['places']): T {
  const place = places[node.id];
  return node.does === '' && place !== undefined ? { ...node, does: place } : node;
}

/** The input narrowed to the scope; the whole input, with each system's place said, when there is no focus. */
export function scopeMapInput(input: SystemMapInput, scope: MapScope): SystemMapInput {
  const systems = input.systems.map((s) => placed(s, scope.places));
  if (scope.focus === null) return { ...input, systems };
  const focus = new Set(scope.focus);
  const edges = keptEdges(input, focus);
  const kept = new Set([...focus, ...edges.flatMap((e) => [e.from, e.to])]);
  const services = input.services.filter((s) => kept.has(s.id));
  const held = new Set(services.map((s) => s.system));
  const shown = new Set(services.map((s) => s.id));
  return {
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
}
