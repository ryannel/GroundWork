// What a fact is connected to: who calls it, what it calls, and the handler steps (with their conditions)
// that make each link. Answers "what calls what, when and how" for one id.
import type { MapFact, SystemMap } from '@/application/system-map';

export interface MapLink {
  readonly from: string;
  readonly to: string;
  readonly kind: string;
  readonly via: string | null;
  /** The handler that makes the link and the condition it runs under, when handlers are known. */
  readonly handler: string | null;
  readonly when: string | null;
}

export interface Shown {
  readonly fact: MapFact;
  /** Links leaving this fact (or its component). */
  readonly out: readonly MapLink[];
  /** Links arriving at this fact (or naming it as their endpoint, message or store). */
  readonly in: readonly MapLink[];
  readonly handlers: readonly string[];
}

export function shownIn(map: SystemMap, id: string): Shown | undefined {
  const fact = map.facts.get(id);
  if (fact === undefined) return undefined;
  const links = linksOf(map);
  return {
    fact,
    out: links.filter((link) => link.from === id),
    in: links.filter((link) => link.to === id || link.via === id),
    handlers: map.system.model.handlersOf(id, 'asIs'),
  };
}

/** Everything that reaches an id: its callers, and its callers' callers, up to `depth` hops. */
export function callersOf(map: SystemMap, id: string, depth = 3): MapLink[] {
  const links = linksOf(map);
  const seen = new Set<string>([id]);
  const out: MapLink[] = [];
  let frontier = [id];
  for (let hop = 0; hop < depth && frontier.length > 0; hop += 1) {
    const next: string[] = [];
    for (const link of links) {
      if (!frontier.includes(link.to) && (link.via === null || !frontier.includes(link.via)))
        continue;
      out.push(link);
      if (!seen.has(link.from)) next.push(link.from);
      seen.add(link.from);
    }
    frontier = next;
  }
  return out;
}

function linksOf(map: SystemMap): MapLink[] {
  const { model } = map.system;
  const steps: MapLink[] = model.handlerEdges('asIs').map((edge) => ({
    from: edge.from,
    to: edge.to ?? edge.target,
    kind: edge.kind,
    via: edge.target,
    handler: edge.handler,
    when: edge.guard,
  }));
  const drawn = new Set(steps.map((link) => `${link.from}|${link.to}|${link.via ?? ''}`));
  const plain: MapLink[] = model
    .edges('asIs')
    .filter((edge) => !drawn.has(`${edge.from}|${edge.to}|${edge.via ?? ''}`))
    .map((edge) => ({
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      via: edge.via,
      handler: null,
      when: null,
    }));
  return [...steps, ...plain];
}
