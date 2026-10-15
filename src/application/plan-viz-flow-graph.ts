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
  i: number;
  s: FlowStep;
  text: string;
  /** The gateway's own call to a subgraph on behalf of the step. */
  fan?: boolean;
  letter?: string;
  /** A read or write of a record the step does not name as an end. */
  implicit?: boolean;
  refs?: string[];
  /** Items of the same record access, folded into one label. */
  members?: FlowItem[];
}

/** A line of an arrow's label: the step it says, and whether it opens that step's text. */
export interface LabelLine {
  t: string;
  first: boolean;
  it: FlowItem;
}

export interface FlowEdge {
  key: string;
  from: string;
  to: string;
  kind: HopKind;
  via: string | null;
  items: FlowItem[];
  /** The steps of every arrow between the same two ends, kept on the one that carries their label; the others hold none. */
  all: FlowItem[];
  lines: LabelLine[];
  /** The label's width and height. */
  lw: number;
  lh: number;
  /** A hop back to an earlier column. */
  back: boolean;
}

export interface FlowNodeSpec {
  id: string;
  kind: NodeKind;
  endpoints: { via: string; steps: number[] }[];
  selfs: { i: number; s: FlowStep; lines: string[] }[];
  events: string[];
  sats: { id: string; e: FlowEdge; r: Rect }[];
  /** A store only one service uses: it sits under that service. */
  sat: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The height with the satellites hung under it. */
  fullH: number;
  /** A topic's pipe height, and its name in lines. */
  ph: number;
  nameLines: string[];
}

export interface FlowGraph {
  nodes: Map<string, FlowNodeSpec>;
  edges: Map<string, FlowEdge>;
  sats: Map<string, FlowEdge>;
}

export interface GraphOptions {
  mode: FlowMode;
  /** Draw just these steps. */
  only?: ReadonlySet<number> | undefined;
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
  if (/^(api|gql):/.test(via)) return 'api';
  return via.startsWith('msg:') ? 'msg' : 'data';
};

/** The store a record (`sch:order#id`) lives in. */
export function storeOf(model: Model, ref: string): string | null {
  const store = prop(model.get(ref.split('#')[0] ?? ''), 'store');
  return typeof store === 'string' ? store : null;
}

interface Ctx {
  model: Model;
  mode: FlowMode;
  graph: FlowGraph;
}

function node(ctx: Ctx, id: string): FlowNodeSpec {
  const known = ctx.graph.nodes.get(id);
  if (known !== undefined) return known;
  const made: FlowNodeSpec = {
    id,
    kind: nodeKind(ctx.model, id),
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
  ctx.graph.nodes.set(id, made);
  return made;
}

function addEdge(
  ctx: Ctx,
  [from, to, kind, via]: readonly [string, string, HopKind, string | null],
  item: FlowItem,
): void {
  const key = `${from}>${to}|${via ?? ''}`;
  const known = ctx.graph.edges.get(key);
  if (known === undefined) {
    const made: FlowEdge = {
      key,
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
    ctx.graph.edges.set(key, made);
  } else known.items.push(item);
}

// A step that calls an operation stays one step; the gateway's fan-out to the subgraphs is lettered (4a, 4b …).
function addFan(ctx: Ctx, s: FlowStep, i: number): void {
  const fan = ctx.model.fanoutOf(s.id, ctx.mode === 'asIs' ? 'asIs' : 'toBe');
  const seen = new Set<string>();
  for (const call of fan?.calls ?? []) {
    if (!call.fanout || call.from !== s.to || call.to === s.to || seen.has(call.to)) continue;
    node(ctx, call.to);
    const name = ctx.model.label(call.subgraph ?? call.to).replace(/ subgraph$/i, '');
    const letter = String.fromCodePoint(97 + seen.size);
    seen.add(call.to);
    addEdge(ctx, [s.to, call.to, 'api', null], { i, s, text: name, fan: true, letter });
  }
}

interface Hop {
  s: FlowStep;
  i: number;
  kind: HopKind;
}

function addHop(ctx: Ctx, { s, i, kind }: Hop): void {
  // API hops land on an endpoint row of the provider; event hops name the event under the queue
  if (kind === 'api') {
    const { endpoints } = node(ctx, s.to);
    const row = endpoints.find((e) => e.via === s.via);
    if (row === undefined) endpoints.push({ via: s.via, steps: [i] });
    else row.steps.push(i);
  }
  if (kind === 'msg') {
    const queue = [s.from, s.to].find((x) => nodeKind(ctx.model, x) === 'topic');
    const events = queue === undefined ? [] : node(ctx, queue).events;
    if (!events.includes(s.via)) events.push(s.via);
  }
  addEdge(ctx, [s.from, s.to, kind, kind === 'api' ? s.via : null], { i, s, text: actionOf(s) });
  if (s.via.startsWith('gql:')) addFan(ctx, s, i);
}

type Access = Map<string, string[]>;

function accesses(model: Model, s: FlowStep): { writes: Access; reads: Access } {
  const writes: Access = new Map();
  const reads: Access = new Map();
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
function addRecords(ctx: Ctx, { s, i, kind }: Hop): void {
  const isSvc = (id: string) => nodeKind(ctx.model, id) === 'service';
  const actor = kind === 'api' || (isSvc(s.to) && !isSvc(s.from)) ? s.to : s.from;
  const { writes, reads } = accesses(ctx.model, s);
  for (const [store, refs] of [...writes, ...reads]) {
    node(ctx, store);
    const names = [...new Set(refs.map((r) => ctx.model.label(r.split('#')[0] ?? r)))];
    const text = `${writes.has(store) ? 'writes' : 'reads'} ${names.join(', ')}`;
    addEdge(ctx, [actor, store, 'data', null], { i, s, text, refs, implicit: true });
  }
}

// A store only one service touches (and never as a step's end) sits right under that service.
function satelliteEdge(graph: FlowGraph, n: FlowNodeSpec): FlowEdge | undefined {
  if (n.kind !== 'store') return undefined;
  const touching = [...graph.edges.values()].filter((e) => e.from === n.id || e.to === n.id);
  const only = touching[0];
  const from = only === undefined ? undefined : graph.nodes.get(only.from);
  return touching.length === 1 && only?.to === n.id && from?.kind === 'service' ? only : undefined;
}

function seatSatellites(graph: FlowGraph): void {
  for (const n of graph.nodes.values()) {
    const e = satelliteEdge(graph, n);
    if (e !== undefined) graph.sats.set(n.id, e);
  }
  for (const [id, e] of graph.sats) {
    graph.edges.delete(e.key);
    const store = graph.nodes.get(id);
    if (store !== undefined) store.sat = true;
    graph.nodes.get(e.from)?.sats.push({ id, e, r: { x: 0, y: 0, w: 0, h: 0 } });
  }
}

function addStep(ctx: Ctx, s: FlowStep, i: number): void {
  node(ctx, s.from);
  node(ctx, s.to);
  const kind = s.via !== '' && s.via !== 'internal' ? hopKind(s.via) : 'data';
  if (s.from === s.to) node(ctx, s.from).selfs.push({ i, s, lines: [] });
  else addHop(ctx, { s, i, kind });
  addRecords(ctx, { s, i, kind });
}

/** The systems a flow touches and the hops between them, before anything is placed. */
export function buildGraph(model: Model, flowId: string, opts: GraphOptions): FlowGraph | null {
  const steps = flowSteps(model, flowId, opts.mode);
  if (steps.length === 0) return null;
  const graph: FlowGraph = { nodes: new Map(), edges: new Map(), sats: new Map() };
  const ctx: Ctx = { model, mode: opts.mode, graph };
  for (const [i, s] of steps.entries()) {
    if (opts.only === undefined || opts.only.has(i)) addStep(ctx, s, i);
  }
  seatSatellites(graph);
  for (const n of graph.nodes.values()) {
    for (const self of n.selfs) {
      const note = stateNote(stepState(model, opts.mode, self.s));
      self.lines = [...wrapText(actionOf(self.s), SELF_WIDTH, 2), ...(note === '' ? [] : [note])];
    }
  }
  return graph;
}
