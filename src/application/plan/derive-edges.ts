import { type Core, type ElementStatus, modeOf } from '@/application/plan/derive-core';
import { memo } from '@/application/plan/derive-values';
import type { StepNode, SystemGraph } from '@/domain/plan/plan-graph';

export type EdgeKind = 'api' | 'msg' | 'data';
export type Overlay = 'none' | 'all' | EdgeKind;

export interface Edge {
  id: string;
  from: string;
  to: string;
  via: string | null;
  kind: EdgeKind;
  sync: boolean;
  mode: 'read' | 'write' | 'readwrite' | null;
  read: boolean;
  write: boolean;
  fanout?: boolean;
  steps: string[];
  /** Set in diff mode only. */
  status?: ElementStatus;
}

export interface Consumer {
  svc: string;
  steps: string[];
  declared: boolean;
}

export interface StepPoint {
  step: string;
  flow: string | undefined;
  from: string;
  to: string;
}

const isTopic = (kind: string): boolean => kind === 'topic' || kind === 'queue';

/** The services whose steps carry a message to them, with the steps that do. */
function walkedConsumers(
  g: SystemGraph,
  m: { id: string; producer: string },
): Map<string, string[]> {
  const bySvc = new Map<string, string[]>();
  for (const s of g.steps) {
    if (s.via !== m.id || g.get(s.to)?.$type !== 'service' || s.to === m.producer) continue;
    bySvc.set(s.to, [...(bySvc.get(s.to) ?? []), s.id]);
  }
  return bySvc;
}

/** Effective consumers of a message in a graph: walked by a step if any, then declared and not yet walked. */
export function consumersIn(g: SystemGraph, msgId: string): Consumer[] {
  const m = g.get(msgId);
  if (m?.$type !== 'message') return [];
  const bySvc = walkedConsumers(g, m);
  const declared = m.consumers ?? [];
  const out = [...bySvc].map(([svc, steps]) => ({ svc, steps, declared: declared.includes(svc) }));
  for (const svc of declared) {
    if (!bySvc.has(svc) && svc !== m.producer) out.push({ svc, steps: [], declared: true });
  }
  return out;
}

const point = (s: StepNode): StepPoint => ({ step: s.id, flow: s.$parent, from: s.from, to: s.to });

/** Steps where a message is published (the producer sends it, or it reaches the topic). */
function publishIn(g: SystemGraph, msgId: string): StepPoint[] {
  const m = g.get(msgId);
  if (m?.$type !== 'message') return [];
  return g.steps
    .filter((s) => s.via === msgId && (s.from === m.producer || s.to === m.topic))
    .map(point);
}

/** Steps where a service consumes a message (the mirror of publishIn). */
function consumeIn(g: SystemGraph, msgId: string): StepPoint[] {
  const m = g.get(msgId);
  if (m?.$type !== 'message') return [];
  return g.steps
    .filter((s) => s.via === msgId && g.get(s.to)?.$type === 'service' && s.to !== m.producer)
    .map(point);
}

interface Seen {
  from: string;
  to: string;
  via?: string | null;
  kind: EdgeKind;
  fanout?: boolean;
  read?: boolean;
  write?: boolean;
}

type Put = (e: Seen, stepId?: string) => void;

const edgeKey = (e: Seen): string =>
  e.kind === 'data' ? `data|${e.from}|${e.to}` : `${e.kind}|${e.from}|${e.to}|${e.via ?? ''}`;

const dataMode = (e: Edge): Edge['mode'] => {
  if (e.read && e.write) return 'readwrite';
  return e.read ? 'read' : 'write';
};

/** Collects edges, merging those with the same ends (and message or api). */
function edgeSet(): { put: Put; list: () => Edge[] } {
  const map = new Map<string, Edge>();
  const put: Put = (e, stepId) => {
    const key = edgeKey(e);
    const cur = map.get(key) ?? {
      id: key,
      from: e.from,
      to: e.to,
      via: e.via ?? null,
      kind: e.kind,
      sync: e.kind === 'api',
      mode: null,
      read: false,
      write: false,
      steps: [],
    };
    map.set(key, cur);
    if (e.fanout === true) cur.fanout = true;
    if (e.read === true) cur.read = true;
    if (e.write === true) cur.write = true;
    if (stepId !== undefined && !cur.steps.includes(stepId)) cur.steps.push(stepId);
  };
  const list = (): Edge[] =>
    [...map.values()].map((e) => (e.kind === 'data' ? { ...e, mode: dataMode(e) } : e));
  return { put, list };
}

/** Each edge of the later graph with its status against the earlier one, then those that were dropped. */
function diffEdges(core: Core, before: readonly Edge[], after: readonly Edge[]): Edge[] {
  const was = new Map(before.map((e) => [e.id, e]));
  const now = new Map(after.map((e) => [e.id, e]));
  const out: Edge[] = [];
  for (const [k, e] of now) {
    const retired =
      e.via !== null && core.sys(e.via) !== undefined && core.status(e.via) === 'deprecated';
    const kept = retired ? 'deprecated' : 'existing';
    out.push({ ...e, status: was.has(k) ? kept : 'added' });
  }
  for (const [k, e] of was) if (!now.has(k)) out.push({ ...e, status: 'removed' });
  return out;
}

type StoreGraph = ReturnType<Core['graphOf']>;

/** One cell per service that reads or writes a store: who owns it, how it may access it, which steps touch it. */
function storeCells(g: StoreGraph, edges: readonly Edge[]) {
  return edges
    .filter((e) => e.kind === 'data')
    .map((e) => {
      const st = g.get(e.to);
      const access =
        st?.$type === 'store' ? st.access?.find((a) => a.svc === e.from)?.mode : undefined;
      return {
        svc: e.from,
        store: e.to,
        read: e.read,
        write: e.write,
        mode: e.mode,
        owner: st?.$type === 'store' && st.owner === e.from,
        access: access ?? null,
        steps: e.steps,
      };
    });
}

/** Talks-to edges, the services × stores matrix and the call and publish points of apis and messages. */
export function createEdges(core: Core) {
  const { graphOf } = core;

  const edgesOfGraph = memo((mode: string | undefined): Edge[] => {
    const g = graphOf(mode);
    const set = edgeSet();
    apiEdges(core, g, set.put);
    messageEdges(g, set.put);
    dataEdges(core, g, set.put);
    return set.list();
  });

  /**
   * Talks-to edges for a mode (asIs, toBe or diff) and an overlay. In diff mode each edge carries a status:
   * existing, added, removed or deprecated.
   */
  const edges = memo(
    (mode: string | undefined = 'toBe', overlay: Overlay | undefined = 'all'): Edge[] => {
      const keep = (e: Edge) => overlay === 'all' || e.kind === overlay;
      if (overlay === 'none') return [];
      if (modeOf(mode) !== 'diff') return edgesOfGraph(modeOf(mode)).filter(keep);
      return diffEdges(core, edgesOfGraph('asIs'), edgesOfGraph('toBe')).filter(keep);
    },
  );

  /** Services × stores read/write matrix (owner + access + step reads/writes). Topics excluded. */
  const storeGrid = memo((mode: string | undefined = 'toBe') => {
    const g = graphOf(mode);
    const stores = g.stores.filter((s) => !isTopic(s.kind)).map((s) => s.id);
    const cells = storeCells(g, edgesOfGraph(modeOf(mode) === 'asIs' ? 'asIs' : 'toBe'));
    const index = new Map(cells.map((c) => [`${c.svc}|${c.store}`, c]));
    return {
      services: g.services.map((s) => s.id).filter((id) => cells.some((c) => c.svc === id)),
      stores,
      cells,
      shared: stores.filter(
        (st) => new Set(cells.filter((c) => c.store === st).map((c) => c.svc)).size > 1,
      ),
      cell: (svc: string, st: string) => index.get(`${svc}|${st}`) ?? null,
    };
  });

  const callers = memo((apiId: string, mode: string | undefined = 'toBe') =>
    graphOf(mode)
      .steps.filter((s) => s.via === apiId)
      .map((s) => ({ step: s.id, flow: s.$parent, from: s.from })),
  );
  const publishPoints = memo((msgId: string, mode: string | undefined = 'toBe') =>
    publishIn(graphOf(mode), msgId),
  );
  const consumePoints = memo((msgId: string, mode: string | undefined = 'toBe') =>
    consumeIn(graphOf(mode), msgId),
  );
  const consumersEffective = memo((msgId: string, mode: string | undefined = 'toBe') =>
    consumersIn(graphOf(mode), msgId),
  );

  return {
    edges,
    storeGrid,
    callers,
    publishPoints,
    consumePoints,
    consumersEffective,
    edgesOfGraph,
  };
}

/** api: the sync calls steps make; a step on an operation also fans out to the subgraph services. */
function apiEdges(core: Core, g: SystemGraph, put: Put): void {
  for (const s of g.steps) {
    for (const c of core.fanout(g, s).calls) {
      if (c.kind === 'api' && /^(api|gql):/.test(c.via ?? '')) {
        put({ from: c.from, to: c.to, via: c.via, kind: 'api', fanout: c.fanout }, s.id);
      }
    }
  }
}

/** msg: producer → topic, topic → each effective consumer. */
function messageEdges(g: SystemGraph, put: Put): void {
  for (const m of g.messages) {
    const hub = g.has(m.topic) ? m.topic : null;
    const to = hub ?? m.producer;
    if (hub !== null) publishEdges(g, m, put);
    for (const c of consumersIn(g, m.id)) {
      put({ from: to, to: c.svc, via: m.id, kind: 'msg' });
      for (const st of c.steps) put({ from: to, to: c.svc, via: m.id, kind: 'msg' }, st);
    }
  }
}

function publishEdges(
  g: SystemGraph,
  m: { id: string; producer: string; topic: string },
  put: Put,
) {
  const edge = { from: m.producer, to: m.topic, via: m.id, kind: 'msg' as const };
  put(edge);
  for (const p of publishIn(g, m.id)) put(edge, p.step);
}

/** A store's owner reads and writes it; so may the services its access list names. */
function storeAccessEdges(g: SystemGraph, put: Put): void {
  for (const st of g.stores) {
    if (isTopic(st.kind)) continue;
    put({ from: st.owner, to: st.id, kind: 'data', read: true, write: true });
    for (const a of st.access ?? []) {
      put({
        from: a.svc,
        to: st.id,
        kind: 'data',
        read: a.mode !== 'write',
        write: a.mode !== 'read',
      });
    }
  }
}

type Fanned = ReturnType<Core['fanout']>;

/** What a step reads, writes and purges, through the services it fans out to. */
function fannedEdges(g: SystemGraph, fo: Fanned, [put, stepId]: [Put, string]): void {
  for (const d of fo.data) {
    const store = g.get(d.store);
    if (typeof d.svc === 'string' && store?.$type === 'store' && !isTopic(store.kind)) {
      const edge = { from: d.svc, to: store.id, kind: 'data' as const };
      put({ ...edge, read: d.rw === 'read', write: d.rw === 'write' }, stepId);
    }
  }
  for (const pg of fo.purges) {
    if (typeof pg.svc === 'string' && g.get(pg.store)?.$type === 'store') {
      put({ from: pg.svc, to: pg.store, kind: 'data', write: true }, stepId);
    }
  }
}

function stepDataEdges(core: Core, g: SystemGraph, put: Put): void {
  for (const s of g.steps) {
    fannedEdges(g, core.fanout(g, s), [put, s.id]);
    if (s.via === 'internal') internalEdge(g, s, put);
  }
}

/** data: store ownership and access, then step reads and writes and direct store steps. */
function dataEdges(core: Core, g: SystemGraph, put: Put): void {
  storeAccessEdges(g, put);
  stepDataEdges(core, g, put);
}

function internalEdge(g: SystemGraph, s: StepNode, put: Put): void {
  const to = g.get(s.to);
  const from = g.get(s.from);
  if (to?.$type === 'store' && from?.$type === 'service' && !isTopic(to.kind)) {
    put({ from: s.from, to: s.to, kind: 'data', write: true }, s.id);
  }
  if (from?.$type === 'store' && to?.$type === 'service' && !isTopic(from.kind)) {
    put({ from: s.to, to: s.from, kind: 'data', read: true }, s.id);
  }
}
