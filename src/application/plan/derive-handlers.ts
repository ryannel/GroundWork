import type { Core } from '@/application/plan/derive-core';
import { handlerEdgesIn, type HandlerEdge } from '@/application/plan/derive-handler-edges';
import { memo } from '@/application/plan/derive-values';
import type { HandlerNode, SystemGraph } from '@/domain/plan/plan-graph';

/** Why a call tree stops at a link: the handler is already above it, the depth ran out, or nothing handles it. */
export type CallStop = 'cycle' | 'depth' | 'unhandled' | null;

/** One link under a handler, and the handlers it leads to. */
export interface CallLink extends Omit<HandlerEdge, 'handler' | 'on' | 'from'> {
  /** The callee's handler for an endpoint; each consumer's handler for a message; none for a read or write. */
  readonly next: readonly CallTree[];
  readonly stop: CallStop;
}

/** A handler and everything it sets off, as deep as the limit allows. */
export interface CallTree {
  readonly handler: string;
  readonly on: string;
  readonly component: string;
  readonly summary: string | null;
  readonly links: readonly CallLink[];
}

export interface CallTreeOptions {
  /** How many hops to follow below the entry; 8 when not given. */
  readonly depth?: number;
  readonly mode?: string;
}

const DEFAULT_DEPTH = 8;

interface Grower {
  readonly byOn: ReadonlyMap<string, readonly HandlerNode[]>;
  readonly edges: ReadonlyMap<string, readonly HandlerEdge[]>;
  readonly max: number;
}

function groupBy<T>(list: readonly T[], key: (x: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const x of list) map.set(key(x), [...(map.get(key(x)) ?? []), x]);
  return map;
}

interface Trail {
  readonly above: ReadonlySet<string>;
  readonly depth: number;
}

const factsOf = (e: HandlerEdge): Omit<CallLink, 'next' | 'stop'> => ({
  to: e.to,
  kind: e.kind,
  target: e.target,
  path: e.path,
  guards: e.guards,
  guard: e.guard,
  conditional: e.conditional,
  looped: e.looped,
  async: e.async,
  does: e.does,
});

function linkOf(gr: Grower, e: HandlerEdge, trail: Trail): CallLink {
  const rest = factsOf(e);
  if (e.kind === 'read' || e.kind === 'write') return { ...rest, next: [], stop: null };
  const callees = gr.byOn.get(e.target) ?? [];
  if (callees.length === 0) return { ...rest, next: [], stop: 'unhandled' };
  if (trail.depth >= gr.max) return { ...rest, next: [], stop: 'depth' };
  const fresh = callees.filter((h) => !trail.above.has(h.id));
  const deeper = { depth: trail.depth + 1 };
  return {
    ...rest,
    next: fresh.map((h) => grow(gr, h, { ...deeper, above: new Set([...trail.above, h.id]) })),
    stop: fresh.length < callees.length ? 'cycle' : null,
  };
}

function grow(gr: Grower, h: HandlerNode, trail: Trail): CallTree {
  return {
    handler: h.id,
    on: h.on,
    component: h.component,
    summary: h.summary ?? null,
    links: (gr.edges.get(h.id) ?? []).map((e) => linkOf(gr, e, trail)),
  };
}

/** The handlers an id names: itself (a handler), those started by it (an entrypoint) or those it runs (a component). */
function entryHandlers(g: SystemGraph, entry: string): HandlerNode[] {
  const n = g.get(entry);
  if (n?.$type === 'handler') return [n];
  if (n?.$type === 'service') return g.handlers.filter((h) => h.component === entry);
  return g.handlers.filter((h) => h.on === entry);
}

/** Handler links and call trees: what runs under each entrypoint, and when. */
export interface HandlerQueries {
  readonly handlerEdges: (mode?: string) => HandlerEdge[];
  readonly handlersOf: (id: string, mode?: string) => string[];
  /** The call tree under an entry, no deeper than `options.depth` hops. */
  readonly callTree: (entry: string, options?: CallTreeOptions) => CallTree[];
}

export function createHandlers(core: Core): HandlerQueries {
  const handlerEdges = memo((mode: string | undefined = 'toBe'): HandlerEdge[] =>
    handlerEdgesIn(core.graphOf(mode)),
  );

  const handlersOf = memo((id: string, mode: string | undefined = 'toBe'): string[] =>
    entryHandlers(core.graphOf(mode), id).map((h) => h.id),
  );

  const tree = memo((entry: string, depth: string, mode: string | undefined): CallTree[] => {
    const g = core.graphOf(mode);
    const gr: Grower = {
      byOn: groupBy(g.handlers, (h) => h.on),
      edges: groupBy(handlerEdges(mode), (e) => e.handler),
      max: Number(depth),
    };
    return entryHandlers(g, entry).map((h) => grow(gr, h, { above: new Set([h.id]), depth: 0 }));
  });

  /**
   * The call tree under an entry (a handler, an endpoint, a message, a schedule or a component): each call
   * leads to the callee's handler for that endpoint, each publish to every consumer's handler for that message.
   * A handler already above a link is not entered again, and no tree goes deeper than `depth` hops.
   */
  const callTree = (entry: string, options: CallTreeOptions = {}): CallTree[] =>
    tree(entry, String(Math.max(0, options.depth ?? DEFAULT_DEPTH)), options.mode ?? 'toBe');

  return { handlerEdges, handlersOf, callTree };
}
