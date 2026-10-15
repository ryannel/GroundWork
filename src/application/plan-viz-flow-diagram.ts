import type { Model } from '@/application/plan/derive';
import { type FlowMode, flowSteps } from '@/application/plan/flow-steps';
import { type DrawCtx, drawEdges } from '@/application/plan-viz-flow-draw-edges';
import { drawNodes, touchedBy } from '@/application/plan-viz-flow-draw-nodes';
import { type FlowDiagramData, walker } from '@/application/plan-viz-flow-drawn';
import { type FlowGraph, buildGraph } from '@/application/plan-viz-flow-graph';
import { placeColumns, rankNodes } from '@/application/plan-viz-flow-place';
import { type Routed, routeEdges } from '@/application/plan-viz-flow-route';
import { labelEdges, sizeNodes } from '@/application/plan-viz-flow-size';
import type { Bounds } from '@/application/plan-viz-zoompane';

export interface FlowDiagramOptions {
  /** Today's systems, the plan's, or the plan on top of today's with removed steps kept. */
  readonly mode?: FlowMode;
  /** The step or steps being shown; the others read as walked or still to come. */
  readonly step?: number | readonly number[];
  /** A short mark on a step or system, by id. */
  readonly markers?: Readonly<Record<string, string>>;
  /** The team whose systems stay lit; the others fade. */
  readonly lens?: string;
  /** Draw just these steps, numbered as in the whole flow. */
  readonly only?: ReadonlySet<number>;
}

const shownOf = (step: FlowDiagramOptions['step']): Set<number> => {
  if (step === undefined) return new Set();
  return new Set(typeof step === 'number' ? [step] : step);
};

/** The teams with no part in the flow, by name. */
function idleTeams(model: Model, inFlow: Iterable<string>): string[] {
  const used = new Set<string>();
  for (const id of inFlow) {
    const team = model.ownerTeam(id);
    if (team !== null) used.add(team);
  }
  return model
    .layout()
    .lanes.filter((l) => l.team !== null && !used.has(l.team))
    .map((l) => l.label);
}

function portsOf(graph: FlowGraph, routed: readonly Routed[]): FlowDiagramData['ports'] {
  const seen = new Set<string>();
  const out: FlowDiagramData['ports'] = [];
  for (const { e, pts } of routed) {
    const start = pts[0];
    if (start === undefined || seen.has(e.from) || graph.nodes.get(e.from)?.kind !== 'service') {
      continue;
    }
    seen.add(e.from);
    out.push({ id: e.from, x: start[0], y: start[1] });
  }
  return out;
}

/**
 * Only the systems a flow touches, laid out left to right in the order they act, with every arrow's route and the
 * words on it. Null when the flow has no steps.
 */
export function flowDiagram(
  model: Model,
  flowId: string,
  opts: FlowDiagramOptions = {},
): FlowDiagramData | null {
  const mode = opts.mode ?? 'asIs';
  const graph = buildGraph(model, flowId, { mode, only: opts.only });
  if (graph === null) return null;
  const steps = flowSteps(model, flowId, mode);
  const rank = rankNodes(graph);
  sizeNodes(model, graph);
  labelEdges(model, graph, { mode, rank });
  const size = placeColumns(graph, rank);
  const { routed, h } = routeEdges(graph, size.h);
  const shown = shownOf(opts.step);
  const ctx: DrawCtx = { model, mode, walk: walker(shown), markers: opts.markers ?? {} };
  const touched = touchedBy(
    model,
    [...shown].map((i) => steps[i]),
  );
  const inFlow =
    opts.only === undefined ? graph.nodes.keys() : steps.flatMap((s) => [s.from, s.to]);
  return {
    flowId,
    name: model.label(flowId),
    w: size.w,
    h,
    nodes: drawNodes(ctx, graph.nodes.values(), { touched, lens: opts.lens }),
    ...drawEdges(ctx, routed),
    ports: portsOf(graph, routed),
    rest: idleTeams(model, inFlow),
    steps: [...steps.keys()].filter((i) => opts.only === undefined || opts.only.has(i)),
  };
}

const NODE_MARGIN = 8;

/** What the shown steps take up: their systems and the words on their arrows. Null when none is shown. */
export function diagramFocus(data: FlowDiagramData): Bounds | null {
  const boxes: Bounds[] = [
    ...data.nodes.filter((n) => n.touched),
    ...data.labels.filter((l) => l.rows.some((r) => r.walk === 'current')),
  ];
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((b) => b.x)) - NODE_MARGIN;
  const y = Math.min(...boxes.map((b) => b.y)) - NODE_MARGIN;
  const right = Math.max(...boxes.map((b) => b.x + b.w)) + NODE_MARGIN;
  const bottom = Math.max(...boxes.map((b) => b.y + b.h)) + NODE_MARGIN;
  return { x, y, w: right - x, h: bottom - y };
}
