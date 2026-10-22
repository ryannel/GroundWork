import type { Point } from '@/application/plan-viz-flow-geometry';
import type { HopKind, NodeKind, StepState } from '@/application/plan-viz-flow-graph';

/** Where a step sits against the one being shown: the walk's colour. */
export type Walk = 'plain' | 'current' | 'walked' | 'tocome';

const LOUDNESS: Record<Walk, number> = { current: 3, walked: 2, tocome: 1, plain: 0 };

export interface Walker {
  /** The walk state of one step. */
  readonly of: (i: number) => Walk;
  /** The loudest state among several steps: an arrow that carries a current step is current. */
  readonly loudest: (steps: readonly number[]) => Walk;
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

/** A sequence row's walk: the shown steps are current, and the steps before the first of them walked. */
export function seqWalk(i: number, shown: ReadonlySet<number>): 'current' | 'walked' | '' {
  if (shown.has(i)) return 'current';
  return shown.size > 0 && i < Math.min(...shown) ? 'walked' : '';
}

/** One step said on an arrow's label. */
export interface DrawnRow {
  readonly text: string;
  /** Opens its step: the number sits beside it. */
  readonly first: boolean;
  readonly implicit: boolean;
  readonly walk: Walk;
  readonly state: StepState;
  /** The step number as drawn (`3`, or `3a` for a gateway fan-out call), or null on a continuation line. */
  readonly number: string | null;
  readonly lettered: boolean;
  readonly description: string;
  /** The step this row goes to, or null for a folded record access that opens the store. */
  readonly step: number | null;
  /** The steps the row says, so its walk can follow whichever stop is shown. */
  readonly steps: readonly number[];
  /** What opens when the row is picked. */
  readonly ref: string;
  readonly mark: string | null;
  /** The baseline of the row's text. */
  readonly y: number;
}

export interface DrawnLabel {
  readonly key: string;
  readonly kind: HopKind;
  readonly from: string;
  readonly to: string;
  readonly steps: readonly number[];
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rows: readonly DrawnRow[];
}

export interface DrawnEdge {
  readonly key: string;
  readonly kind: HopKind;
  readonly from: string;
  readonly to: string;
  readonly walk: Walk;
  readonly implicit: boolean;
  readonly state: '' | 'removed' | 'added';
  readonly steps: readonly number[];
  /** What opens when the arrow is picked: the endpoint or event of its first step, or the step itself. */
  readonly ref: string;
  readonly vias: readonly string[];
  readonly title: string;
  readonly aria: string;
  readonly d: string;
  /** The corners of the route, for the places that take a click along it. */
  readonly pts: readonly Point[];
  readonly head: string;
}

export interface DrawnEndpoint {
  readonly via: string;
  /** How the call travels, "GraphQL" or "REST"; null when the model does not say. */
  readonly protocol: string | null;
  /** The room the protocol tag takes before the signature. */
  readonly tagW: number;
  /** The signature, clipped to the card. */
  readonly text: string;
  readonly title: string;
  readonly aria: string;
  readonly added: boolean;
  readonly cy: number;
}

export interface DrawnSelf {
  readonly step: number;
  readonly id: string;
  readonly lines: readonly string[];
  readonly cy: number;
  readonly walk: Walk;
  readonly state: StepState;
  readonly title: string;
  readonly aria: string;
  readonly mark: string | null;
}

export interface DrawnEvent {
  readonly id: string;
  readonly text: string;
  readonly title: string;
  readonly added: boolean;
  readonly y: number;
  readonly iconX: number;
  readonly textX: number;
}

export interface ServiceBody {
  readonly kind: 'service';
  /** `service`, `ui`, `job` or `external`. */
  readonly what: string;
  readonly glyph: string;
  readonly word: string;
  readonly endpoints: readonly DrawnEndpoint[];
  readonly selfs: readonly DrawnSelf[];
}

export interface TopicBody {
  readonly kind: 'topic';
  readonly ph: number;
  readonly nameLines: readonly string[];
  readonly events: readonly DrawnEvent[];
}

export interface StoreBody {
  readonly kind: 'store';
  readonly word: string;
  readonly name: string;
}

/** What a systems card, a queue or a cylinder is made of. */
export type DrawnBody = ServiceBody | TopicBody | StoreBody;

export interface DrawnNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly state: '' | 'added' | 'modified';
  readonly touched: boolean;
  /** The steps that touch the node, so whether it is touched can follow whichever stop is shown. */
  readonly touchSteps: readonly number[];
  readonly lensOff: boolean;
  /** Which of the team colours the node wears. */
  readonly team: number;
  readonly mark: string | null;
  readonly body: DrawnBody;
}

export interface FlowDiagramData {
  readonly flowId: string;
  readonly name: string;
  readonly w: number;
  readonly h: number;
  readonly nodes: readonly DrawnNode[];
  readonly edges: readonly DrawnEdge[];
  readonly labels: readonly DrawnLabel[];
  /** Where each calling service's arrows leave it. */
  readonly ports: readonly { readonly id: string; readonly x: number; readonly y: number }[];
  /** The teams with no part in the flow, by name. */
  readonly rest: readonly string[];
  /** The step numbers drawn. */
  readonly steps: readonly number[];
}
