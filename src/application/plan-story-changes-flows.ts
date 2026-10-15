import type { Model } from '@/application/plan/derive';
import type { ElementStatus } from '@/application/plan/derive-core';
import { numWord } from '@/application/plan-viz-text';
import type { StepNode } from '@/domain/plan/plan-graph';

import { changesOf } from './plan-story-changes-touched';

// What happens to a flow or a screen the plan changes, counted and said as one line.

const uniq = <T>(xs: readonly T[]): T[] => [...new Set(xs)];
const capital = (s: string): string => (s === '' ? s : s.charAt(0).toUpperCase() + s.slice(1));
const stripStop = (s: string): string => {
  let end = s.length;
  while (end > 0 && (s[end - 1] === '.' || s[end - 1] === ' ')) end -= 1;
  return s.slice(0, end);
};

export interface UnionStep {
  readonly step: StepNode;
  readonly status: ElementStatus | null;
}

function stepsIn(model: Model, mode: 'asIs' | 'toBe', flowId: string): StepNode[] {
  const flow = model[mode].get(flowId);
  return flow?.$type === 'flow' ? flow.steps : [];
}

/** To-be steps in reading order, with the steps the plan removes kept where they were. */
function unionSteps(model: Model, flowId: string): UnionStep[] {
  const before = stepsIn(model, 'asIs', flowId);
  const after = stepsIn(model, 'toBe', flowId);
  const out: UnionStep[] = after.map((step) => ({ step, status: model.status(step.id) }));
  for (const [i, s] of before.entries()) {
    if (after.some((x) => x.id === s.id)) continue;
    const prev = before
      .slice(0, i)
      .toReversed()
      .find((p) => out.some((o) => o.step.id === p.id));
    const at = prev === undefined ? 0 : out.findIndex((o) => o.step.id === prev.id) + 1;
    out.splice(at, 0, { step: s, status: 'removed' });
  }
  return out;
}

/** Ids of the steps of a flow that the plan touches. */
export const changedStepIds = (model: Model, flowId: string): string[] =>
  unionSteps(model, flowId)
    .filter((x) => x.status !== 'existing')
    .map((x) => x.step.id);

/** Diff entries that edit the flow itself (trigger, outcome …), not one of its steps. */
function flowProps(model: Model, flowId: string): string[] {
  return model
    .diff(flowId)
    .filter((d) => d.target === flowId && d.prop !== null)
    .map((d) => d.prop ?? '');
}

function viaSwitches(model: Model, steps: readonly UnionStep[]): UnionStep[] {
  return steps.filter((x) => {
    if (x.status !== 'modified') return false;
    const own = model.diff(x.step.id).filter((e) => e.target === x.step.id);
    return own.length > 0 && own.every((e) => e.prop === 'via');
  });
}

const plural = (n: number, one: string, many: string): string =>
  `${numWord(n)} ${n === 1 ? one : many}`;

function modifiedWords(
  model: Model,
  mod: readonly UnionStep[],
  steps: readonly UnionStep[],
): string[] {
  const via = viaSwitches(model, steps);
  const targets = uniq(
    via.map((x) => model.toBe.get(x.step.id)).map((n) => (n?.$type === 'step' ? n.via : undefined)),
  );
  const [target] = targets;
  if (via.length > 1 && targets.length === 1 && target !== undefined) {
    const node = model.get(target);
    const version = node !== undefined && 'version' in node ? node.version : undefined;
    const rest = mod.length - via.length;
    return [
      `${numWord(via.length)} steps switch to ${typeof version === 'string' ? version : model.label(target)}`,
      ...(rest > 0 ? [plural(rest, 'changes', 'change')] : []),
    ];
  }
  return mod.length > 0 ? [plural(mod.length, 'step changes', 'steps change')] : [];
}

function verbWords(parts: string[], n: number, verb: string): string[] {
  if (n === 0) return [];
  const noun = n === 1 ? 'step ' : 'steps ';
  const lead = parts.length > 0 ? '' : noun;
  return [`${numWord(n)} ${lead}${n === 1 ? 'is' : 'are'} ${verb}`];
}

/** "two steps change, one is added": what happens to the steps of a flow, counted. */
function flowTally(model: Model, flowId: string): string {
  const steps = unionSteps(model, flowId);
  const count = (s: ElementStatus) => steps.filter((x) => x.status === s).length;
  const mod = steps.filter((x) => x.status === 'modified');
  const parts = modifiedWords(model, mod, steps);
  // a deprecated step still runs until it is removed: it is never counted as removed
  for (const status of ['added', 'removed', 'deprecated'] as const)
    parts.push(...verbWords(parts, count(status), status));
  if (parts.length === 0) {
    const props = uniq(flowProps(model, flowId));
    if (props.length > 0)
      parts.push(`its ${props.join(' and ')} ${props.length === 1 ? 'changes' : 'change'}`);
  }
  return parts.join(', ');
}

/** How much of each change lands on a flow's changed steps: a `via` switch counts for less than a rewrite. */
function weights(model: Model, flowId: string): Map<string, number> {
  const out = new Map<string, number>();
  const add = (id: string, only: (prop: string | null) => boolean) => {
    const own = model.diff(id).filter((d) => d.target === id);
    const light = own.length > 0 && own.every((d) => only(d.prop));
    for (const d of own) {
      if (d.changeId !== undefined)
        out.set(d.changeId, (out.get(d.changeId) ?? 0) + (light ? 0.5 : 1));
    }
  };
  for (const id of changedStepIds(model, flowId)) add(id, (p) => p === 'via');
  add(flowId, () => false);
  return out;
}

/**
 * What the reader takes away from a flow: the claim of the change that touches most of its steps. The tally of
 * steps goes to the lede. A flow no change titles reads "<flow>: <tally>".
 */
export function flowHead(model: Model, flowId: string): { head: string; lede: string } {
  const tally = flowTally(model, flowId);
  const weight = weights(model, flowId);
  const lead = changesOf(model, flowId).toSorted(
    (a, b) => (weight.get(b) ?? 0) - (weight.get(a) ?? 0),
  )[0];
  const change = model.plan.changes?.find((c) => c.id === lead);
  const title = change === undefined ? '' : stripStop(change.title);
  if (title !== '') return { head: title, lede: tally === '' ? '' : `${capital(tally)}.` };
  const node = model.get(flowId);
  const name =
    node !== undefined && 'name' in node && typeof node.name === 'string'
      ? node.name
      : model.label(flowId);
  return { head: `${name}: ${tally === '' ? 'nothing changes' : tally}`, lede: '' };
}

/** "Checkout · address gets a new look: one new region, one region changes." */
export function screenClaim(model: Model, id: string): string {
  const d = model.screenDiff(id);
  const regions = d.regions.filter((r) => r.status !== 'existing');
  const n = (s: ElementStatus) => regions.filter((r) => r.status === s).length;
  const [added, modified, removed] = [n('added'), n('modified'), n('removed')];
  const bits = [
    added > 0 ? plural(added, 'new region', 'new regions') : '',
    modified > 0 ? plural(modified, 'region changes', 'regions change') : '',
    removed > 0 ? plural(removed, 'region goes', 'regions go') : '',
  ].filter((b) => b !== '');
  const label = model.label(id);
  if (model.status(id) === 'removed') return `${label} goes away.`;
  const list = bits.join(', ');
  const listed = list === '' ? '' : `: ${list}`;
  if (d.pictureChanges) return `${label} gets a new look${listed}.`;
  return list === '' ? `${label} changes.` : `${label}: ${list}.`;
}
