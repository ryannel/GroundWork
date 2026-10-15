import type { LineKind, MapShow, SystemMapInput } from '@/application/plan-viz-system-map-types';

// Every call, event and data access between the systems, gathered into one line per pair of things drawn.

export interface Link {
  readonly key: string;
  readonly kind: LineKind;
  readonly a: string;
  readonly b: string;
  readonly row: string | null;
  readonly vias: Set<string>;
  readonly flows: Set<string>;
  /** read, write; hand (a stage says so), walked (a flow does). */
  readonly flags: Set<'read' | 'write' | 'hand' | 'walked'>;
}

export interface RowCount {
  readonly id: string;
  readonly eps: Set<string>;
  n: number;
}

export interface Aggregate {
  readonly links: Link[];
  /** For each service, the interfaces someone calls on it. */
  readonly rowsOf: Map<string, Map<string, RowCount>>;
  readonly kinds: Map<string, Set<LineKind>>;
  /** The card each topic and store hangs under. */
  readonly hostOfSat: ReadonlyMap<string, string>;
  readonly isTopic: (id: string) => boolean;
}

interface Spec {
  readonly kind: LineKind;
  readonly a: string;
  readonly b: string;
  readonly row?: string | null;
  readonly via?: string | null;
  readonly steps?: readonly string[];
  readonly rw?: { readonly read?: boolean; readonly write?: boolean };
  readonly hand?: boolean;
}

const flowOf = (stepId: string): string => stepId.split('#')[0] ?? stepId;

/** Which service card each topic and store hangs under: its owner, else the first thing that uses it. */
function hostsOf(input: SystemMapInput): Map<string, string> {
  const svcIds = new Set(input.services.map((s) => s.id));
  const hosts = new Map<string, string>();
  for (const store of input.stores) {
    let host = store.owner !== null && svcIds.has(store.owner) ? store.owner : null;
    if (host === null) {
      const into = input.edges.find((e) => e.to === store.id && svcIds.has(e.from))?.from;
      const outOf = input.edges.find((e) => e.from === store.id && svcIds.has(e.to))?.to;
      host = into ?? outOf ?? null;
    }
    if (host !== null) hosts.set(store.id, host);
  }
  return hosts;
}

interface Acc extends Aggregate {
  readonly svcIds: ReadonlySet<string>;
  readonly byKey: Map<string, Link>;
  readonly show: MapShow;
  readonly input: SystemMapInput;
}

const shownSat = (acc: Acc, id: string): boolean =>
  acc.isTopic(id) ? acc.show.topics : acc.show.stores;

/** A hidden topic or store is represented by the card it hangs under. */
function visible(acc: Acc, id: string): string {
  const host = acc.hostOfSat.get(id);
  return host !== undefined && !shownSat(acc, id) ? host : id;
}

function note(acc: Acc, id: string, kind: LineKind): void {
  const seen = acc.kinds.get(id) ?? new Set<LineKind>();
  seen.add(kind);
  acc.kinds.set(id, seen);
}

function viaOf(acc: Acc, spec: Spec): string | null {
  if (spec.via !== undefined && spec.via !== null) return spec.via;
  if (spec.kind === 'api') return null;
  return (
    [spec.a, spec.b].find((end) => acc.hostOfSat.has(end) && end !== visible(acc, end)) ?? null
  );
}

function linkFor(acc: Acc, spec: Spec): Link {
  const key = `${spec.kind}|${spec.a}|${spec.b}|${spec.row ?? ''}`;
  const known = acc.byKey.get(key);
  if (known !== undefined) return known;
  const link: Link = {
    key,
    kind: spec.kind,
    a: spec.a,
    b: spec.b,
    row: spec.row ?? null,
    vias: new Set(),
    flows: new Set(),
    flags: new Set(),
  };
  acc.byKey.set(key, link);
  acc.links.push(link);
  return link;
}

function merge(link: Link, spec: Spec, via: string | null): void {
  link.flags.add(spec.hand === true ? 'hand' : 'walked');
  if (via !== null) link.vias.add(via);
  for (const s of spec.steps ?? []) link.flows.add(flowOf(s));
  if (spec.rw?.read === true) link.flags.add('read');
  if (spec.rw?.write === true) link.flags.add('write');
}

function addLink(acc: Acc, spec: Spec): void {
  const via = viaOf(acc, spec);
  const a = visible(acc, spec.a);
  const b = visible(acc, spec.b);
  if (a === b) return;
  merge(linkFor(acc, { ...spec, a, b }), spec, via);
  for (const id of [a, b, acc.hostOfSat.get(a) ?? a, acc.hostOfSat.get(b) ?? b])
    note(acc, id, spec.kind);
}

function addRow(
  acc: Acc,
  on: { readonly svc: string; readonly row: string; readonly endpoint: string | null },
): void {
  const rows = acc.rowsOf.get(on.svc) ?? new Map<string, RowCount>();
  const current = rows.get(on.row) ?? { id: on.row, eps: new Set<string>(), n: 0 };
  if (on.endpoint !== null) current.eps.add(on.endpoint);
  current.n += 1;
  rows.set(on.row, current);
  acc.rowsOf.set(on.svc, rows);
}

type Edge = SystemMapInput['edges'][number];

function callEdge(acc: Acc, e: Edge): void {
  if (!acc.svcIds.has(e.from) || !acc.svcIds.has(e.to)) return;
  const row = e.via === null ? '' : (acc.input.interfaceOf[e.via] ?? e.via);
  addRow(acc, { svc: e.to, row, endpoint: e.via });
  addLink(acc, { kind: 'api', a: e.from, b: e.to, via: e.via, steps: e.steps, row });
}

/** An event line runs between a service and a topic, or straight between services. */
function eventEdge(acc: Acc, e: Edge): void {
  const toHost = acc.hostOfSat.get(e.to);
  const fromHost = acc.hostOfSat.get(e.from);
  const other = toHost ?? fromHost;
  const direct = acc.svcIds.has(e.from) && acc.svcIds.has(e.to) && e.from !== e.to;
  const viaTopic =
    other !== undefined &&
    other !== e.from &&
    other !== e.to &&
    (acc.svcIds.has(e.from) || acc.svcIds.has(e.to));
  if (direct || viaTopic)
    addLink(acc, { kind: 'msg', a: e.from, b: e.to, via: e.via, steps: e.steps });
}

function dataEdge(acc: Acc, e: Edge): void {
  if (
    !acc.svcIds.has(e.from) ||
    acc.hostOfSat.get(e.to) === undefined ||
    acc.hostOfSat.get(e.to) === e.from
  )
    return;
  addLink(acc, {
    kind: 'data',
    a: e.from,
    b: e.to,
    steps: e.steps,
    rw: { read: e.read, write: e.write },
  });
}

function fromEdges(acc: Acc): void {
  for (const e of acc.input.edges) {
    if (e.kind === 'api') callEdge(acc, e);
    else if (e.kind === 'msg') eventEdge(acc, e);
    else dataEdge(acc, e);
  }
}

// A step from one service straight to another with no modelled interface or message (via: internal, a library
// call over HTTP) is still a call.
function fromSteps(acc: Acc): void {
  for (const step of acc.input.steps) {
    const modelled = step.via.startsWith('api:') || step.via.startsWith('msg:');
    if (
      acc.svcIds.has(step.from) &&
      acc.svcIds.has(step.to) &&
      step.from !== step.to &&
      !modelled
    ) {
      addLink(acc, { kind: 'api', a: step.from, b: step.to, steps: [step.id] });
    }
  }
}

/** The service and interface a stage's `from:` points at, when it points at one. */
function calleeOf(
  acc: Acc,
  src: string,
): { readonly svc: string; readonly row: string; readonly ep: string | null } | null {
  const ref = acc.input.refs[src];
  if (ref === undefined) return null;
  if (ref.type === 'service') return { svc: src, row: '', ep: null };
  if (ref.type === 'interface' && ref.service !== null)
    return { svc: ref.service, row: src, ep: null };
  const parent = ref.parent === null ? undefined : acc.input.refs[ref.parent];
  if (
    ref.type === 'endpoint' &&
    ref.parent !== null &&
    parent?.service !== null &&
    parent?.service !== undefined
  ) {
    return { svc: parent.service, row: ref.parent, ep: src };
  }
  return null;
}

function readsCall(acc: Acc, me: string, src: string): void {
  const callee = calleeOf(acc, src);
  if (callee === null || !acc.svcIds.has(callee.svc) || callee.svc === me) return;
  if (callee.row !== '') addRow(acc, { svc: callee.svc, row: callee.row, endpoint: callee.ep });
  addLink(acc, {
    hand: true,
    kind: 'api',
    a: me,
    b: callee.svc,
    row: callee.row === '' ? null : callee.row,
  });
}

function readsStore(acc: Acc, me: string, src: string): void {
  const ref = acc.input.refs[src];
  if (
    ref?.type !== 'store' ||
    acc.hostOfSat.get(src) === undefined ||
    acc.hostOfSat.get(src) === me
  )
    return;
  if (ref.topic) addLink(acc, { hand: true, kind: 'msg', a: src, b: me });
  else addLink(acc, { hand: true, kind: 'data', a: me, b: src, rw: { read: true } });
}

// A stage's `from:` (what a service reads from when no flow says so yet) is a line too.
function fromStages(acc: Acc): void {
  for (const stage of acc.input.stages) {
    for (const entry of stage.entries.filter((x) => acc.svcIds.has(x.svc))) {
      for (const src of entry.reads.filter((r) => r !== entry.svc)) {
        readsCall(acc, entry.svc, src);
        readsStore(acc, entry.svc, src);
      }
    }
  }
}

/** The lines for what is shown: a hidden layer's lines land on the card that keeps it. */
export function aggregate(input: SystemMapInput, show: MapShow): Aggregate {
  const hostOfSat = hostsOf(input);
  const topics = new Set(input.stores.filter((s) => s.topic).map((s) => s.id));
  const acc: Acc = {
    links: [],
    rowsOf: new Map(),
    kinds: new Map(input.services.map((s) => [s.id, new Set<LineKind>()])),
    hostOfSat,
    isTopic: (id) => topics.has(id),
    svcIds: new Set(input.services.map((s) => s.id)),
    byKey: new Map(),
    show,
    input,
  };
  fromEdges(acc);
  fromSteps(acc);
  fromStages(acc);
  for (const [sat, host] of hostOfSat) {
    const kind = acc.isTopic(sat) ? 'msg' : 'data';
    note(acc, sat, kind);
    note(acc, host, kind);
  }
  for (const svc of acc.rowsOf.keys()) note(acc, svc, 'api');
  return acc;
}
