import type { Model } from '@/application/plan/derive';
import type { FlowMode } from '@/application/plan/flow-steps';
import { prop } from '@/application/plan/ids';
import { shortTopic, wrapText } from '@/application/plan-viz-flow-geometry';
import {
  type FlowEdge,
  type FlowGraph,
  type FlowItem,
  type FlowNodeSpec,
  type LabelLine,
  stateNote,
  stepState,
} from '@/application/plan-viz-flow-graph';

const CARD_W = 212;
export const HEAD = 46;
export const ROW = 22;
const STORE_W = 168;
const STORE_H = 62;
export const CAP = 7;
const PIPE_W = 212;
export const PIPE_CAP = 9;
export const PIPE_IN = PIPE_CAP + 36;
export const PAD = 24;
export const LINE = 15;
export const MONO = 6.6;
const LABEL_CH = 24;
const SAT_CH = 24;
const CHAR = 6.3;
const CARD_MAX = 300;
const SELF_LINE = 14;
const EVENT_LINE = 16;

/** How an endpoint reads on its row: its signature, else its name. */
export function sigOf(model: Model, via: string): string {
  const sig = prop(model.get(via), 'sig');
  return typeof sig === 'string' ? sig : model.label(via);
}

/** The height of a port on a node's left edge: an endpoint row of a card, or the middle of a pipe or cylinder. */
export function portY(n: FlowNodeSpec, via: string | null): number {
  if (n.kind === 'topic') return n.ph / 2;
  if (n.kind === 'store') return CAP + (STORE_H - CAP) / 2;
  const k = via === null ? -1 : n.endpoints.findIndex((e) => e.via === via);
  return k >= 0 ? HEAD + k * ROW + ROW / 2 : HEAD / 2;
}

type Size = Pick<FlowNodeSpec, 'w' | 'h'> & Partial<Pick<FlowNodeSpec, 'ph' | 'nameLines'>>;

function sizeCard(model: Model, n: FlowNodeSpec): Size {
  // a card widens (to 300) before an endpoint signature is clipped
  const need = Math.max(
    0,
    ...n.endpoints.map((ep) => 30 + sigOf(model, ep.via).length * MONO + ep.steps.length * 17),
  );
  const selfH = n.selfs.reduce((t, sf) => t + ROW + (sf.lines.length - 1) * SELF_LINE, 0);
  const busy = n.endpoints.length > 0 || n.selfs.length > 0;
  return {
    w: Math.min(CARD_MAX, Math.max(CARD_W, Math.ceil(need))),
    h: HEAD + n.endpoints.length * ROW + selfH + (busy ? 8 : 0),
  };
}

function sizePipe(model: Model, n: FlowNodeSpec): Size {
  const room = Math.floor((PIPE_W - PIPE_IN - 2 * PIPE_CAP - 8) / 6.9);
  const name = shortTopic(model.label(n.id))
    .split('/')
    .map((part) => part.trim())
    .join(' / ');
  const nameLines = wrapText(name, room, 2);
  const ph = 18 + nameLines.length * SELF_LINE;
  const events = n.events.length > 0 ? 8 + n.events.length * EVENT_LINE : 0;
  return { w: PIPE_W, h: ph + events, ph, nameLines };
}

const sizeOf = (model: Model, n: FlowNodeSpec): Size => {
  if (n.kind === 'service') return sizeCard(model, n);
  return n.kind === 'topic' ? sizePipe(model, n) : { w: STORE_W, h: STORE_H };
};

/** How big each node is drawn. */
export function sizeNodes(model: Model, graph: FlowGraph): FlowGraph {
  const nodes = [...graph.nodes].map(([id, n]): readonly [string, FlowNodeSpec] => [
    id,
    { ...n, ...sizeOf(model, n) },
  ]);
  return { ...graph, nodes: new Map(nodes) };
}

const accessKey = (it: FlowItem): string | null =>
  it.implicit === true
    ? JSON.stringify([it.text, (it.refs ?? []).toSorted((a, b) => a.localeCompare(b))])
    : null;

// One arrow per access of the same records, however many steps make it.
function labelItems(items: readonly FlowItem[]): readonly FlowItem[] {
  const members = new Map<string, readonly FlowItem[]>();
  for (const item of items) {
    const key = accessKey(item);
    if (key !== null) members.set(key, [...(members.get(key) ?? []), item]);
  }
  return items.flatMap((item) => {
    const key = accessKey(item);
    const group = key === null ? [item] : (members.get(key) ?? [item]);
    return group[0] === item ? [{ ...item, members: group }] : [];
  });
}

function lineOf(model: Model, mode: FlowMode, satellite: boolean) {
  return (it: FlowItem): readonly LabelLine[] => {
    const note =
      it.implicit === true || it.fan === true ? '' : stateNote(stepState(model, mode, it.s));
    const lines = [
      ...wrapText(it.text, satellite ? SAT_CH : LABEL_CH, 2),
      ...(note === '' ? [] : [note]),
    ];
    return lines.map((t, k) => ({ t, first: k === 0, it }));
  };
}

// One caller into several endpoints of the same service: one label, on the top line.
function carriedItems(
  edges: ReadonlyMap<string, FlowEdge>,
): ReadonlyMap<string, readonly FlowItem[]> {
  const carrier = new Map<string, string>();
  const all = new Map<string, readonly FlowItem[]>();
  for (const e of edges.values()) {
    const k = `${e.from}>${e.to}`;
    const first = carrier.get(k);
    if (first === undefined) {
      carrier.set(k, e.key);
      all.set(e.key, e.items);
    } else {
      all.set(first, [...(all.get(first) ?? []), ...e.items]);
      all.set(e.key, []);
    }
  }
  return all;
}

interface Labelling {
  readonly mode: FlowMode;
  readonly rank: ReadonlyMap<string, number>;
}

/** What every arrow says, sized so the gaps between columns fit it. */
export function labelEdges(model: Model, graph: FlowGraph, { mode, rank }: Labelling): FlowGraph {
  const carried = carriedItems(graph.edges);
  const label = (e: FlowEdge, satellite: boolean): FlowEdge => {
    const all = carried.get(e.key) ?? e.all;
    const items = satellite ? e.items : all.toSorted((a, b) => a.i - b.i);
    const lines = labelItems(items).flatMap(lineOf(model, mode, graph.sats.has(e.to)));
    const lw = lines.length > 0 ? Math.max(...lines.map((l) => l.t.length * CHAR)) + 22 : 0;
    const lh = lines.length > 0 ? lines.length * LINE + 4 : 0;
    const back = !graph.sats.has(e.to) && (rank.get(e.to) ?? 0) <= (rank.get(e.from) ?? 0);
    return { ...e, all, lines, lw, lh, back };
  };
  const edges = new Map([...graph.edges].map(([key, e]) => [key, label(e, false)]));
  const sats = new Map([...graph.sats].map(([id, e]) => [id, label(e, true)]));
  const nodes = [...graph.nodes].map(([id, n]): readonly [string, FlowNodeSpec] => [
    id,
    { ...n, sats: n.sats.map((sat) => ({ ...sat, e: sats.get(sat.id) ?? sat.e })) },
  ]);
  return { nodes: new Map(nodes), edges, sats };
}
