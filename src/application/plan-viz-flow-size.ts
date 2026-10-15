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

/** How big each node is drawn. */
export function sizeNodes(model: Model, graph: FlowGraph): void {
  for (const n of graph.nodes.values()) {
    if (n.kind === 'service') Object.assign(n, sizeCard(model, n));
    else if (n.kind === 'topic') Object.assign(n, sizePipe(model, n));
    else Object.assign(n, { w: STORE_W, h: STORE_H });
  }
}

const accessKey = (it: FlowItem): string | null =>
  it.implicit === true
    ? JSON.stringify([it.text, (it.refs ?? []).toSorted((a, b) => a.localeCompare(b))])
    : null;

// One arrow per access of the same records, however many steps make it.
function labelItems(items: readonly FlowItem[]): FlowItem[] {
  const out: FlowItem[] = [];
  const access = new Map<string, FlowItem>();
  for (const item of items) {
    const key = accessKey(item);
    const same = key === null ? undefined : access.get(key);
    if (same?.members !== undefined) {
      same.members.push(item);
      continue;
    }
    const label = { ...item, members: [item] };
    out.push(label);
    if (key !== null) access.set(key, label);
  }
  return out;
}

function lineOf(model: Model, mode: FlowMode, satellite: boolean) {
  return (it: FlowItem): LabelLine[] => {
    const lines = wrapText(it.text, satellite ? SAT_CH : LABEL_CH, 2);
    const note =
      it.implicit === true || it.fan === true ? '' : stateNote(stepState(model, mode, it.s));
    if (note !== '') lines.push(note);
    return lines.map((t, k) => ({ t, first: k === 0, it }));
  };
}

/** What every arrow says, sized so the gaps between columns fit it. */
export function labelEdges(
  model: Model,
  graph: FlowGraph,
  { mode, rank }: { mode: FlowMode; rank: ReadonlyMap<string, number> },
): void {
  // one caller into several endpoints of the same service: one label, on the top line
  const carrier = new Map<string, FlowEdge>();
  for (const e of graph.edges.values()) {
    const k = `${e.from}>${e.to}`;
    const first = carrier.get(k);
    if (first === undefined) {
      carrier.set(k, e);
      e.all = [...e.items];
    } else {
      first.all.push(...e.items);
      e.all = [];
    }
  }
  const satellites = new Set(graph.sats.values());
  for (const e of [...graph.edges.values(), ...graph.sats.values()]) {
    const satellite = satellites.has(e);
    const items = satellite ? e.items : e.all.toSorted((a, b) => a.i - b.i);
    e.lines = labelItems(items).flatMap(lineOf(model, mode, graph.sats.has(e.to)));
    e.lw = e.lines.length > 0 ? Math.max(...e.lines.map((l) => l.t.length * CHAR)) + 22 : 0;
    e.lh = e.lines.length > 0 ? e.lines.length * LINE + 4 : 0;
    e.back = !graph.sats.has(e.to) && (rank.get(e.to) ?? 0) <= (rank.get(e.from) ?? 0);
  }
}
