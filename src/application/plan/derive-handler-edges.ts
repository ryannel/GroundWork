import {
  guardText,
  linkOf,
  walkHandler,
  type HandlerLinkKind,
} from '@/application/plan/handler-walk';
import type { HandlerNode, SystemGraph } from '@/domain/plan/plan-graph';
import type { PathSegment } from '@/domain/plan/plan-ids';

/** One call, publish, read or write a handler makes, with the forks and loops around it. */
export interface HandlerEdge {
  handler: string;
  /** What starts the handler: an endpoint, a message, a schedule or an interaction. */
  on: string;
  /** The component the handler runs in. */
  from: string;
  /** The component at the other end: the endpoint's service, the message's topic, the store; null if unknown. */
  to: string | null;
  kind: HandlerLinkKind;
  /** The endpoint, message or schema the step names. */
  target: string;
  /** Where the step sits in the handler (`['steps', 1, 'else', 0]`). */
  path: PathSegment[];
  /** The guards around the step, outermost first: "when …", "unless …", "for each …". */
  guards: string[];
  /** The guards as one line, or null when the step always runs. */
  guard: string | null;
  conditional: boolean;
  looped: boolean;
  async: boolean;
  does: string | null;
}

/** The component a link reaches, by its kind. */
function farEnd(
  g: SystemGraph,
  link: { kind: HandlerLinkKind; target: string; store: string | null },
) {
  if (link.store !== null) return link.store;
  const n = g.get(link.target);
  if (n?.$type === 'endpoint') return n.$service ?? null;
  return n?.$type === 'message' ? n.topic : null;
}

function edgesOfHandler(g: SystemGraph, h: HandlerNode): HandlerEdge[] {
  return walkHandler(h).flatMap((w) => {
    const link = linkOf(w.step);
    if (link === null) return [];
    return [
      {
        handler: h.id,
        on: h.on,
        from: h.component,
        to: farEnd(g, link),
        kind: link.kind,
        target: link.target,
        path: w.path,
        guards: w.guards,
        guard: guardText(w.guards),
        conditional: w.conditional,
        looped: w.looped,
        async: w.async,
        does: w.step.does ?? null,
      },
    ];
  });
}

/** Every link every handler of a graph makes, in handler and step order. */
export function handlerEdgesIn(g: SystemGraph): HandlerEdge[] {
  return g.handlers.flatMap((h) => edgesOfHandler(g, h));
}

/** The shape of a talks-to edge, as derive-edges collects them. */
interface TalksTo {
  from: string;
  to: string;
  via?: string | null;
  kind: 'api' | 'msg' | 'data';
  read?: boolean;
  write?: boolean;
  handler?: string;
}

const isTopic = (g: SystemGraph, id: string): boolean => {
  const n = g.get(id);
  return n?.$type === 'store' && (n.kind === 'topic' || n.kind === 'queue');
};

function talksTo(g: SystemGraph, e: HandlerEdge): TalksTo[] {
  const base = { from: e.from, handler: e.handler };
  if (e.kind === 'call') {
    return e.to === null ? [] : [{ ...base, to: e.to, via: e.target, kind: 'api' }];
  }
  if (e.kind === 'publish') {
    if (e.to !== null && g.has(e.to)) return [{ ...base, to: e.to, via: e.target, kind: 'msg' }];
    const m = g.get(e.target);
    const consumers = m?.$type === 'message' ? (m.consumers ?? []) : [];
    return consumers.map((c) => ({ ...base, to: c, via: e.target, kind: 'msg' }));
  }
  if (e.to === null || !g.has(e.to) || isTopic(g, e.to)) return [];
  return [{ ...base, to: e.to, kind: 'data', read: e.kind === 'read', write: e.kind === 'write' }];
}

/**
 * Feed the handlers' links into the talks-to edges. An edge a flow already drew gains the handler; one only
 * a handler knows is added.
 */
export function putHandlerEdges(g: SystemGraph, put: (e: TalksTo) => void): void {
  for (const e of handlerEdgesIn(g)) for (const t of talksTo(g, e)) put(t);
}
