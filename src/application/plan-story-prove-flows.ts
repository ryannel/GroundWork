import type { Model } from '@/application/plan/derive';
import { flowSteps } from '@/application/plan/flow-steps';
import { refLabel } from '@/application/plan/ref-label';
import { andList } from '@/application/plan-viz-ladder-order';
import { numWord } from '@/application/plan-viz-text';
import type { FlowNode } from '@/domain/plan/plan-graph';
import type { Test } from '@/domain/plan/plan.generated';
import { plainTitle } from '@/shared/plain-text';

// Which journeys the end-to-end tests walk, and how much of each. Chapter 6 says what they reach of the flows the plan
// changes, so a flow is "changed" when it is new or one of its steps is.

type Bracket = ReturnType<Model['spans']>[number];

export const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export const flowName = (f: Pick<FlowNode, 'id' | 'name'>): string =>
  plainTitle(f.name === '' ? f.id : f.name, refLabel);

/** A flow's name inside a sentence: its title is an imperative (“Issue the invoice”), so it is quoted. */
export const quoted = (f: Pick<FlowNode, 'id' | 'name'>): string => `“${flowName(f)}”`;

export interface WalkedFlow {
  readonly flow: FlowNode;
  /** The end-to-end brackets over it. */
  readonly spans: readonly Bracket[];
}

/** Flows (to-be) that end-to-end tests walk, each with the brackets over it. */
export function e2eFlows(model: Model): WalkedFlow[] {
  return model.toBe.flows
    .map((flow) => ({ flow, spans: model.spans(flow.id).filter((s) => s.level === 'e2e') }))
    .filter((x) => x.spans.length > 0);
}

/** A test covers the flow whole when it names it or its bracket runs from the first step to the last. */
export function coversWhole(model: Model, flowId: string, spans: readonly Bracket[]): boolean {
  const n = flowSteps(model, flowId, 'toBe').length;
  return spans.some((s) => s.whole || (s.fromIndex === 0 && s.toIndex === n - 1));
}

/** Flows the plan adds or changes: new, or with a step that is new or works differently. */
function changedFlows(model: Model): FlowNode[] {
  return model.toBe.flows.filter(
    (f) =>
      (model.status(f.id) ?? 'existing') !== 'existing' ||
      flowSteps(model, f.id, 'toBe').some((s) => (model.status(s.id) ?? 'existing') !== 'existing'),
  );
}

export interface E2eReach {
  readonly changed: readonly FlowNode[];
  readonly walkedIds: readonly string[];
  /** Changed flows no end-to-end test walks. */
  readonly none: readonly FlowNode[];
  /** Changed flows a test walks only in part. */
  readonly partial: readonly FlowNode[];
}

/** What the end-to-end tests reach of the journeys the plan changes. */
export function e2eReach(model: Model): E2eReach {
  const walked = new Map(e2eFlows(model).map((x) => [x.flow.id, x.spans]));
  const changed = changedFlows(model);
  return {
    changed,
    walkedIds: [...walked.keys()],
    none: changed.filter((f) => !walked.has(f.id)),
    partial: changed.filter((f) => {
      const spans = walked.get(f.id);
      return spans !== undefined && !coversWhole(model, f.id, spans);
    }),
  };
}

/** "A", "A and B", "A, B and three more": names for a headline, never more than two of them. */
export function namesOf(list: readonly string[], max = 2): string {
  const shown = list.slice(0, max);
  const more = list.length - shown.length;
  return more > 0 ? `${shown.join(', ')} and ${numWord(more)} more` : andList(shown);
}

/** The tests that walk a whole flow end to end. */
export const e2eTests = (model: Model): Test[] =>
  (model.plan.tests ?? []).filter((t) => t.level === 'e2e');
