import type { Model } from '@/application/plan/derive';
import { journeyComparison, type JourneyComparison } from '@/application/plan/journey';
import { numWord } from '@/application/plan-viz-text';
import { plain } from '@/shared/plain-text';

// What a page of the journey chapter says about one flow before the steps begin: what the plan does to it, where it
// starts and what it comes to.

export interface FlowLine {
  readonly label: string;
  readonly text: string;
}

export interface FlowView {
  readonly id: string;
  /** The name in the flow picker, with what the plan does to the flow when it adds or removes it. */
  readonly option: string;
  /** What the plan does to the flow, as the screen's headline. */
  readonly claim: string;
  /** Where the flow starts and what it comes to, as the plan records them. */
  readonly lines: readonly FlowLine[];
}

const SUFFIX: Readonly<Partial<Record<JourneyComparison['presence'], string>>> = {
  added: ' · New',
  removed: ' · Removed with this plan',
};

const nameOf = (model: Model, id: string): string => {
  const flow = model.toBe.get(id) ?? model.asIs.get(id);
  return flow?.$type === 'flow' && flow.name !== '' ? flow.name : id;
};

function say(n: number, one: string, many: string): string {
  if (n === 0) return '';
  return `${numWord(n)} ${n === 1 ? one : many}`;
}

function tally(comparison: JourneyComparison): string {
  const count = (kind: JourneyComparison['rows'][number]['kind']): number =>
    comparison.rows.filter((r) => r.kind === kind).length;
  const parts = [
    say(count('changed'), 'step changes', 'steps change'),
    ...(['added', 'removed', 'deprecated'] as const).map((kind) =>
      say(count(kind), `step is ${kind}`, `steps are ${kind}`),
    ),
  ].filter((part) => part !== '');
  return parts.length === 0 ? 'nothing changes' : parts.join(', ');
}

function claimOf(model: Model, comparison: JourneyComparison): string {
  const name = nameOf(model, comparison.id);
  const steps = numWord(comparison.rows.length);
  switch (comparison.presence) {
    case 'added': {
      return `${name}: new with this plan, ${steps} ${comparison.rows.length === 1 ? 'step' : 'steps'}.`;
    }
    case 'removed': {
      return `${name} goes away with this plan.`;
    }
    case 'existing': {
      return `${name}: ${tally(comparison)}.`;
    }
    case 'unknown': {
      return `${name} is not recorded in this plan.`;
    }
  }
}

const sayAs = (model: Model, text: string | undefined): string =>
  plain(text, (id) => model.label(id));

function linesOf(model: Model, comparison: JourneyComparison, shared: boolean): FlowLine[] {
  const before = comparison.beforeFlow;
  const after = comparison.afterFlow;
  const lines: FlowLine[] = [];
  const pair = (
    key: 'trigger' | 'outcome',
    words: { readonly only: string; readonly was: string; readonly now: string },
  ): void => {
    const was = sayAs(model, before?.[key]);
    const now = sayAs(model, after?.[key]);
    if (was !== '' && now !== '' && was !== now) {
      lines.push({ label: words.was, text: was }, { label: words.now, text: now });
    } else {
      const text = now === '' ? was : now;
      if (text !== '') lines.push({ label: words.only, text });
    }
  };
  pair('trigger', {
    only: shared ? 'Recorded trigger for this shared flow' : 'Starts when',
    was: 'Starts today when',
    now: 'Starts with this plan when',
  });
  pair('outcome', {
    only: 'Recorded outcome',
    was: 'Outcome today',
    now: 'Outcome with this plan',
  });
  return lines;
}

/** How many planned scenarios walk the flow; a flow more than one scenario walks is shared. */
const scenariosOf = (model: Model, flowId: string): number =>
  (model.plan.problem.scenarios ?? []).filter((s) => (s.flows ?? []).includes(flowId)).length;

export function flowView(model: Model, flowId: string): FlowView {
  const comparison = journeyComparison(model, flowId);
  const name = nameOf(model, flowId);
  return {
    id: flowId,
    option: `${name}${SUFFIX[comparison.presence] ?? ''}`,
    claim: claimOf(model, comparison),
    lines: linesOf(model, comparison, scenariosOf(model, flowId) > 1),
  };
}
