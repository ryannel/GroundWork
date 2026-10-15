import type { Point } from '@/application/plan-viz-flow-geometry';
import type { HopKind, NodeKind, StepState } from '@/application/plan-viz-flow-graph';

/** Where a step sits against the one being shown: the walk's colour. */
export type Walk = 'plain' | 'current' | 'walked' | 'tocome';

const LOUDNESS: Record<Walk, number> = { current: 3, walked: 2, tocome: 1, plain: 0 };

export interface Walker {
  /** The walk state of one step. */
  of: (i: number) => Walk;
  /** The loudest state among several steps: an arrow that carries a current step is current. */
  loudest: (steps: readonly number[]) => Walk;
}

/** Steps before the shown ones are walked, steps after are still to come, and with none shown all are plain. */
export function walker(shown: ReadonlySet<number>): Walker {
  const hi = Math.max(...shown);
  const of = (i: number): Walk => {
    if (shown.size === 0) return 'plain';
    if (shown.has(i)) return 'current';
    return i > hi ? 'tocome' : 'walked';
  };
  const loudest = (steps: readonly number[]): Walk =>
    steps.map(of).toSorted((a, b) => LOUDNESS[b] - LOUDNESS[a])[0] ?? 'plain';
  return { of, loudest };
}

/** One step said on an arrow's label. */
export interface DrawnRow {
  text: string;
  /** Opens its step: the number sits beside it. */
  first: boolean;
  implicit: boolean;
  walk: Walk;
  state: StepState;
  /** The step number as drawn (`3`, or `3a` for a gateway fan-out call), or null on a continuation line. */
  num: string | null;
  lettered: boolean;
  description: string;
  /** The step this row goes to, or null for a folded record access that opens the store. */
  step: number | null;
  /** What opens when the row is picked. */
  ref: string;
  mark: string | null;
  /** The baseline of the row's text. */
  y: number;
}

export interface DrawnLabel {
  key: string;
  kind: HopKind;
  from: string;
  to: string;
  steps: number[];
  x: number;
  y: number;
  w: number;
  h: number;
  rows: DrawnRow[];
}

export interface DrawnEdge {
  key: string;
  kind: HopKind;
  from: string;
  to: string;
  walk: Walk;
  implicit: boolean;
  state: '' | 'removed' | 'added';
  steps: number[];
  /** What opens when the arrow is picked: the endpoint or event of its first step, or the step itself. */
  ref: string;
  vias: string[];
  title: string;
  aria: string;
  d: string;
  /** The corners of the route, for the places that take a click along it. */
  pts: Point[];
  head: string;
}

export interface DrawnEndpoint {
  via: string;
  /** The signature, clipped to the card. */
  text: string;
  title: string;
  aria: string;
  added: boolean;
  cy: number;
}

export interface DrawnSelf {
  step: number;
  id: string;
  lines: string[];
  cy: number;
  walk: Walk;
  state: StepState;
  title: string;
  aria: string;
  mark: string | null;
}

export interface DrawnEvent {
  id: string;
  text: string;
  title: string;
  added: boolean;
  y: number;
  iconX: number;
  textX: number;
}

export interface ServiceBody {
  kind: 'service';
  /** `service`, `ui`, `job` or `external`. */
  what: string;
  glyph: string;
  word: string;
  endpoints: DrawnEndpoint[];
  selfs: DrawnSelf[];
}

export interface TopicBody {
  kind: 'topic';
  ph: number;
  nameLines: string[];
  events: DrawnEvent[];
}

export interface StoreBody {
  kind: 'store';
  word: string;
  name: string;
}

/** What a systems card, a queue or a cylinder is made of. */
export type DrawnBody = ServiceBody | TopicBody | StoreBody;

export interface DrawnNode {
  id: string;
  kind: NodeKind;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  state: '' | 'added' | 'modified';
  touched: boolean;
  lensOff: boolean;
  /** Which of the team colours the node wears. */
  team: number;
  mark: string | null;
  body: DrawnBody;
}

export interface FlowDiagramData {
  flowId: string;
  name: string;
  w: number;
  h: number;
  nodes: DrawnNode[];
  edges: DrawnEdge[];
  labels: DrawnLabel[];
  /** Where each calling service's arrows leave it. */
  ports: { id: string; x: number; y: number }[];
  /** The teams with no part in the flow, by name. */
  rest: string[];
  /** The step numbers drawn. */
  steps: number[];
}
