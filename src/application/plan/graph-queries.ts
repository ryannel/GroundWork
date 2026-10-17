import { isRecord, parentOf } from '@/application/plan/ids';
import type { Fanout, OpKind, StepNode, StoreNode, SystemGraph } from '@/domain/plan/plan-graph';
import type { Stage } from '@/domain/plan/plan.generated';

const isTopic = (st: StoreNode): boolean => st.kind === 'topic' || st.kind === 'queue';

/** The record store a read or write names (through its schema); a topic or queue is not one. */
function storeOfRef(g: SystemGraph, ref: string): string | null {
  const schema = g.get(parentOf(ref) ?? ref);
  const store =
    schema?.$type === 'schema' && schema.store !== undefined && schema.store !== ''
      ? g.get(schema.store)
      : undefined;
  return store?.$type === 'store' && !isTopic(store) ? store.id : null;
}

function callKind(via: string): 'api' | 'msg' | 'internal' {
  if (via.startsWith('msg:')) return 'msg';
  return via.startsWith('api:') ? 'api' : 'internal';
}

/**
 * What a step reaches once its `via` is expanded. This is the step itself: its call, its reads and writes by
 * the acting service and its purges. A step on an operation (`gql:`) reaches no further until the
 * federation port supplies a fan-out that expands it.
 */
export const baseFanout: Fanout = (g, step) => {
  const op = g.get(step.via);
  const isOperation = op?.$type === 'operation';
  const actor = actingService(g, step);
  const kind = isOperation ? 'api' : callKind(step.via);
  const reach = (list: readonly string[] | undefined, rw: 'read' | 'write') =>
    (list ?? []).map((ref) => ({ svc: actor, ref, store: storeOfRef(g, ref), rw }));
  return {
    calls: [
      {
        from: step.from,
        to: step.to,
        via: step.via,
        kind,
        fanout: false,
      },
    ],
    data: isOperation ? [] : [...reach(step.reads, 'read'), ...reach(step.writes, 'write')],
    purges: (step.purges ?? []).map((store) => ({ svc: actor, store })),
    refs: isOperation ? [op.id] : [],
    services: [step.from, step.to].filter((id) => g.get(id)?.$type === 'service'),
    subgraphs: [],
    operation: isOperation ? op.id : null,
  };
};

/** The acting service of a step is `to` when it is a service, else `from`. */
export function actingService(g: SystemGraph, step: Pick<StepNode, 'from' | 'to'>): string | null {
  if (g.get(step.to)?.$type === 'service') return step.to;
  return g.get(step.from)?.$type === 'service' ? step.from : null;
}

/** Owner, or an access entry granting `need` (read or write). */
export function canAccess(store: StoreNode, svc: string, need: 'read' | 'write'): boolean {
  return (
    store.owner === svc ||
    (store.access ?? []).some((a) => a.svc === svc && (a.mode === need || a.mode === 'readwrite'))
  );
}

const OP_KINDS: readonly OpKind[] = ['add', 'modify', 'deprecate', 'remove'];

/** Which of add, modify, deprecate or remove an op is. */
export function opKind(op: unknown): OpKind | null {
  if (!isRecord(op)) return null;
  return OP_KINDS.find((k) => k in op) ?? null;
}

export type LinkKind = 'api' | 'msg' | 'data';

export interface ServiceLink {
  readonly from: string;
  readonly to: string;
  readonly kind: LinkKind;
  readonly via: string | null;
}

const writersOf = (st: StoreNode): string[] => [
  ...new Set([
    st.owner,
    ...(st.access ?? []).filter((a) => a.mode.includes('write')).map((a) => a.svc),
  ]),
];

const readersOf = (st: StoreNode): string[] =>
  (st.access ?? []).filter((a) => a.mode.includes('read')).map((a) => a.svc);

/** How a link is drawn: its kind, and what carries it (an api, a topic, a store). */
interface Via {
  readonly kind: LinkKind;
  readonly via?: string | null;
}

type Put = (from: string | null | undefined, to: string | null | undefined, how: Via) => void;

function stepLinks(g: SystemGraph, put: Put, fanout: Fanout): void {
  for (const s of g.steps) {
    if (s.via.startsWith('api:')) put(s.to, s.from, { kind: 'api', via: s.via });
    else if (s.via.startsWith('gql:')) {
      for (const c of fanout(g, s).calls) put(c.to, c.from, { kind: 'api', via: c.via });
    } else if (!s.via.startsWith('msg:')) put(s.to, s.from, { kind: 'api' });
  }
}

function messageLinks(g: SystemGraph, put: Put): void {
  for (const m of g.messages) {
    const how: Via = { kind: 'msg', via: m.id };
    for (const c of m.consumers ?? []) put(m.producer, c, how);
    for (const s of g.steps) if (s.via === m.id) put(m.producer, actingService(g, s), how);
  }
}

function topicLinks(st: StoreNode, put: Put): void {
  const readers = readersOf(st);
  for (const w of writersOf(st)) {
    for (const r of readers) put(w, r, { kind: 'msg', via: st.id });
  }
}

function storeLinks(g: SystemGraph, put: Put): void {
  for (const st of g.stores) {
    if (isTopic(st)) topicLinks(st, put);
    else for (const a of st.access ?? []) put(st.owner, a.svc, { kind: 'data', via: st.id });
  }
}

/** The services a stage's `from:` entry reads from, as provider → the stage's service. */
function fromLinks(g: SystemGraph, put: Put, [svc, src]: readonly [string, string]): void {
  const n = g.get(src);
  switch (n?.$type) {
    case 'service': {
      put(src, svc, { kind: 'api' });
      break;
    }
    case 'interface': {
      put(n.service, svc, { kind: 'api', via: src });
      break;
    }
    case 'endpoint': {
      put(n.$service, svc, { kind: 'api', via: src });
      break;
    }
    case 'store': {
      const topic = isTopic(n);
      for (const w of topic ? writersOf(n) : [n.owner]) {
        put(w, svc, { kind: topic ? 'msg' : 'data', via: src });
      }
      break;
    }
    default:
  }
}

function stageLinks(g: SystemGraph, put: Put, stages: readonly Stage[]): void {
  for (const stage of stages) {
    for (const x of stage.services ?? []) {
      for (const src of x.from ?? []) fromLinks(g, put, [x.svc, src]);
    }
  }
}

/**
 * Service-to-service links the system map draws: calls walked by steps, events from producer (or
 * topic writer) to consumer (or topic reader), another service's store read or written, and a
 * stage's authored `from:`. Each link runs provider → user. A step on an operation links through
 * its derived fan-out.
 */
export function serviceLinks(
  g: SystemGraph,
  stages: readonly Stage[] = [],
  fanout: Fanout = baseFanout,
): ServiceLink[] {
  const out = new Map<string, ServiceLink>();
  const isSvc = (id: string | null | undefined): id is string => g.get(id)?.$type === 'service';
  const put: Put = (from, to, { kind, via = null }) => {
    if (!isSvc(from) || !isSvc(to) || from === to) return;
    const key = `${from}|${to}|${kind}`;
    if (!out.has(key)) out.set(key, { from, to, kind, via });
  };
  stepLinks(g, put, fanout);
  messageLinks(g, put);
  storeLinks(g, put);
  stageLinks(g, put, stages);
  return [...out.values()];
}
