import type { Model } from '@/application/plan/derive';
import { type FlowMode, type FlowStep, flowSteps, isNewLink } from '@/application/plan/flow-steps';
import { prop, typeOf } from '@/application/plan/ids';
import { type Rect, wrapText } from '@/application/plan-viz-flow-geometry';

export type NodeKind = 'service' | 'topic' | 'store';
export type HopKind = 'api' | 'msg' | 'data';

/** What a step does to its piece of the plan: the colour and words of its label. */
export type StepState = '' | 'removed' | 'deprecated' | 'added' | 'modified';

/** One step drawn on an arrow or inside a card. */
export interface FlowItem {
  readonly i: number;
  readonly s: FlowStep;
  readonly text: string;
  /** The gateway's own call to a subgraph on behalf of the step. */
  readonly fan?: boolean;
  readonly letter?: string;
  /** A read or write of a record the step does not name as an end. */
  readonly implicit?: boolean;
  readonly refs?: readonly string[];
  /** Items of the same record access, folded into one label. */
  readonly members?: readonly FlowItem[];
}

/** A line of an arrow's label: the step it says, and whether it opens that step's text. */
export interface LabelLine {
  readonly t: string;
  readonly first: boolean;
  readonly it: FlowItem;
}

export interface FlowEdge {
  readonly key: string;
  readonly from: string;
  readonly to: string;
  readonly kind: HopKind;
  readonly via: string | null;
  readonly items: readonly FlowItem[];
  /** The steps of every arrow between the same two ends, kept on the one that carries their label; the others hold none. */
  readonly all: readonly FlowItem[];
  readonly lines: readonly LabelLine[];
  /** The label's width and height. */
  readonly lw: number;
  readonly lh: number;
  /** A hop back to an earlier column. */
  readonly back: boolean;
}

export interface FlowNodeSpec {
  readonly id: string;
  readonly kind: NodeKind;
  readonly endpoints: readonly { readonly via: string; readonly steps: readonly number[] }[];
  readonly selfs: readonly {
    readonly i: number;
    readonly s: FlowStep;
    readonly lines: readonly string[];
  }[];
  readonly events: readonly string[];
  readonly sats: readonly { readonly id: string; readonly e: FlowEdge; readonly r: Rect }[];
  /** A store only one service uses: it sits under that service. */
  readonly sat: boolean;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** The height with the satellites hung under it. */
  readonly fullH: number;
  /** A topic's pipe height, and its name in lines. */
  readonly ph: number;
  readonly nameLines: readonly string[];
}

export interface FlowGraph {
  readonly nodes: ReadonlyMap<string, FlowNodeSpec>;
  readonly edges: ReadonlyMap<string, FlowEdge>;
  readonly sats: ReadonlyMap<string, FlowEdge>;
}

export interface GraphOptions {
  readonly mode: FlowMode;
  /** Draw just these steps. */
  readonly only?: ReadonlySet<number> | undefined;
}

const SELF_WIDTH = 30;

/** What the step does to its own piece of the plan. */
export function stepState(model: Model, mode: FlowMode, s: FlowStep): StepState {
  if (mode === 'asIs') return '';
  if (s.$removed === true) return 'removed';
  const status = model.status(s.id);
  if (status === 'deprecated') return 'deprecated';
  if (isNewLink(model, s) || status === 'added') return 'added';
  return status === 'modified' ? 'modified' : '';
}

/** The words a deprecated step carries. */
export const stateNote = (state: StepState): string =>
  state === 'deprecated' ? 'Deprecated · still works' : '';

export const actionOf = (s: FlowStep): string => (s.action === '' ? s.id : s.action);

function nodeKind(model: Model, id: string): NodeKind {
  const entity = model.get(id);
  if (entity === undefined) return 'service';
  if (typeOf(id) !== 'store' && !id.startsWith('st:')) return 'service';
  const kind = prop(entity, 'kind');
  return kind === 'topic' || kind === 'queue' ? 'topic' : 'store';
}

const hopKind = (via: string): HopKind => {
  if (/^(?:api|gql):/u.test(via)) return 'api';
  return via.startsWith('msg:') ? 'msg' : 'data';
};

/** The store a record (`sch:order#id`) lives in. */
export function storeOf(model: Model, ref: string): string | null {
  const store = prop(model.get(ref.split('#')[0] ?? ''), 'store');
  return typeof store === 'string' ? store : null;
}

interface Ctx {
  readonly model: Model;
  readonly mode: FlowMode;
}

type Ends = readonly [string, string, HopKind, string | null];
type SelfLine = FlowNodeSpec['selfs'][number];

/** One thing a step adds to the graph, in the order it adds them. */
type Touch =
  | { readonly t: 'node'; readonly id: string }
  | { readonly t: 'edge'; readonly ends: Ends; readonly item: FlowItem }
  | { readonly t: 'endpoint'; readonly id: string; readonly via: string; readonly i: number }
  | { readonly t: 'event'; readonly id: string; readonly via: string }
  | { readonly t: 'self'; readonly id: string; readonly self: SelfLine };

type EdgeTouch = Extract<Touch, { readonly t: 'edge' }>;

function blankNode(model: Model, id: string): FlowNodeSpec {
  return {
    id,
    kind: nodeKind(model, id),
    endpoints: [],
    selfs: [],
    events: [],
    sats: [],
    sat: false,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    fullH: 0,
    ph: 0,
    nameLines: [],
  };
}

function touchNode(n: FlowNodeSpec, touch: Exclude<Touch, EdgeTouch>): FlowNodeSpec {
  switch (touch.t) {
    case 'endpoint': {
      const row = n.endpoints.find((e) => e.via === touch.via);
      const endpoints =
        row === undefined
          ? [...n.endpoints, { via: touch.via, steps: [touch.i] }]
          : n.endpoints.map((e) => (e === row ? { ...e, steps: [...e.steps, touch.i] } : e));
      return { ...n, endpoints };
    }
    case 'event': {
      return n.events.includes(touch.via) ? n : { ...n, events: [...n.events, touch.via] };
    }
    case 'self': {
      return { ...n, selfs: [...n.selfs, touch.self] };
    }
    default: {
      return n;
    }
  }
}

const edgeKey = ([from, to, , via]: Ends): string => `${from}>${to}|${via ?? ''}`;

function edgeWith(known: FlowEdge | undefined, { ends, item }: EdgeTouch): FlowEdge {
  if (known !== undefined) return { ...known, items: [...known.items, item] };
  const [from, to, kind, via] = ends;
  return {
    key: edgeKey(ends),
    from,
    to,
    kind,
    via,
    items: [item],
    all: [],
    lines: [],
    lw: 0,
    lh: 0,
    back: false,
  };
}

// A step that calls an operation stays one step; the gateway's fan-out to the subgraphs is lettered (4a, 4b …).
function fanTouches(ctx: Ctx, s: FlowStep, i: number): readonly Touch[] {
  const fan = ctx.model.fanoutOf(s.id, ctx.mode === 'asIs' ? 'asIs' : 'toBe');
  const seen = new Set<string>();
  const out: Touch[] = [];
  for (const call of fan?.calls ?? []) {
    if (!call.fanout || call.from !== s.to || call.to === s.to || seen.has(call.to)) continue;
    const name = ctx.model.label(call.subgraph ?? call.to).replace(/ subgraph$/iu, '');
    const letter = String.fromCodePoint(97 + seen.size);
    seen.add(call.to);
    out.push(
      { t: 'node', id: call.to },
      {
        t: 'edge',
        ends: [s.to, call.to, 'api', null],
        item: { i, s, text: name, fan: true, letter },
      },
    );
  }
  return out;
}

interface Hop {
  readonly s: FlowStep;
  readonly i: number;
  readonly kind: HopKind;
}

function hopTouches(ctx: Ctx, { s, i, kind }: Hop): readonly Touch[] {
  // API hops land on an endpoint row of the provider; event hops name the event under the queue
  const queue = [s.from, s.to].find((x) => nodeKind(ctx.model, x) === 'topic');
  const endpoint: readonly Touch[] =
    kind === 'api' ? [{ t: 'endpoint', id: s.to, via: s.via, i }] : [];
  const event: readonly Touch[] =
    kind === 'msg' && queue !== undefined ? [{ t: 'event', id: queue, via: s.via }] : [];
  const ends: Ends = [s.from, s.to, kind, kind === 'api' ? s.via : null];
  return [
    ...endpoint,
    ...event,
    { t: 'edge', ends, item: { i, s, text: actionOf(s) } },
    ...(s.via.startsWith('gql:') ? fanTouches(ctx, s, i) : []),
  ];
}

type Access = ReadonlyMap<string, readonly string[]>;

function accesses(model: Model, s: FlowStep): { readonly writes: Access; readonly reads: Access } {
  const writes = new Map<string, readonly string[]>();
  const reads = new Map<string, readonly string[]>();
  const outside = (store: string | null): store is string =>
    store !== null && store !== s.to && store !== s.from;
  for (const ref of s.writes ?? []) {
    const store = storeOf(model, ref);
    if (outside(store)) writes.set(store, [...(writes.get(store) ?? []), ref]);
  }
  for (const ref of s.reads ?? []) {
    const store = storeOf(model, ref);
    if (outside(store) && !writes.has(store)) reads.set(store, [...(reads.get(store) ?? []), ref]);
  }
  return { writes, reads };
}

// Records a step reads or writes in a store that is not one of its ends: a dotted hop from the acting service
// (an API's provider does the reading and writing; on an event hop, the service end does).
function recordTouches(ctx: Ctx, { s, i, kind }: Hop): readonly Touch[] {
  const isSvc = (id: string) => nodeKind(ctx.model, id) === 'service';
  const actor = kind === 'api' || (isSvc(s.to) && !isSvc(s.from)) ? s.to : s.from;
  const { writes, reads } = accesses(ctx.model, s);
  return [...writes, ...reads].flatMap(([store, refs]): readonly Touch[] => {
    const names = [...new Set(refs.map((r) => ctx.model.label(r.split('#')[0] ?? r)))];
    const text = `${writes.has(store) ? 'writes' : 'reads'} ${names.join(', ')}`;
    return [
      { t: 'node', id: store },
      { t: 'edge', ends: [actor, store, 'data', null], item: { i, s, text, refs, implicit: true } },
    ];
  });
}

function selfLines(ctx: Ctx, s: FlowStep): readonly string[] {
  const note = stateNote(stepState(ctx.model, ctx.mode, s));
  return [...wrapText(actionOf(s), SELF_WIDTH, 2), ...(note === '' ? [] : [note])];
}

function stepTouches(ctx: Ctx, s: FlowStep, i: number): readonly Touch[] {
  const kind = s.via !== '' && s.via !== 'internal' ? hopKind(s.via) : 'data';
  const own: readonly Touch[] =
    s.from === s.to
      ? [{ t: 'self', id: s.from, self: { i, s, lines: selfLines(ctx, s) } }]
      : hopTouches(ctx, { s, i, kind });
  return [
    { t: 'node', id: s.from },
    { t: 'node', id: s.to },
    ...own,
    ...recordTouches(ctx, { s, i, kind }),
  ];
}

// A store only one service touches (and never as a step's end) sits right under that service.
function satelliteEdge(graph: FlowGraph, n: FlowNodeSpec): FlowEdge | undefined {
  if (n.kind !== 'store') return undefined;
  const touching = [...graph.edges.values()].filter((e) => e.from === n.id || e.to === n.id);
  const only = touching[0];
  const from = only === undefined ? undefined : graph.nodes.get(only.from);
  return touching.length === 1 && only?.to === n.id && from?.kind === 'service' ? only : undefined;
}

function seatSatellites(
  nodes: ReadonlyMap<string, FlowNodeSpec>,
  edges: ReadonlyMap<string, FlowEdge>,
): FlowGraph {
  const whole: FlowGraph = { nodes, edges, sats: new Map() };
  const sats = new Map<string, FlowEdge>();
  for (const n of nodes.values()) {
    const e = satelliteEdge(whole, n);
    if (e !== undefined) sats.set(n.id, e);
  }
  const hung = [...sats].map(([id, e]) => ({ id, e, r: { x: 0, y: 0, w: 0, h: 0 } }));
  const seated = [...nodes].map(([id, n]): readonly [string, FlowNodeSpec] => [
    id,
    { ...n, sat: n.sat || sats.has(id), sats: [...n.sats, ...hung.filter((h) => h.e.from === id)] },
  ]);
  const satKeys = new Set([...sats.values()].map((e) => e.key));
  return {
    nodes: new Map(seated),
    edges: new Map([...edges].filter(([key]) => !satKeys.has(key))),
    sats,
  };
}

/** The systems a flow touches and the hops between them, before anything is placed. */
export function buildGraph(model: Model, flowId: string, opts: GraphOptions): FlowGraph | null {
  const steps = flowSteps(model, flowId, opts.mode);
  if (steps.length === 0) return null;
  const ctx: Ctx = { model, mode: opts.mode };
  const touches = [...steps.entries()]
    .filter(([i]) => opts.only === undefined || opts.only.has(i))
    .flatMap(([i, s]) => stepTouches(ctx, s, i));
  const nodes = new Map<string, FlowNodeSpec>();
  const edges = new Map<string, FlowEdge>();
  for (const touch of touches) {
    if (touch.t === 'edge') {
      const key = edgeKey(touch.ends);
      edges.set(key, edgeWith(edges.get(key), touch));
    } else nodes.set(touch.id, touchNode(nodes.get(touch.id) ?? blankNode(model, touch.id), touch));
  }
  return seatSatellites(nodes, edges);
}
