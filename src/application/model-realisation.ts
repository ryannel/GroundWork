import { kindOf } from '@/domain/ids';
import type { ModelOp } from '@/domain/plan-apply';
import { modelList, modelRecord, type ModelPlan } from '@/domain/workspace-model';

import type { ModelIndex } from './model-index';
import { modelPlanOpTarget } from './model-plan-pages';

export type ModelRealisationState = 'missing' | 'partial' | 'matches' | 'differs' | 'unverified';
export interface ModelOpRealisation {
  readonly op: number;
  readonly target: string;
  readonly state: ModelRealisationState;
  readonly detail: string;
}
export interface ModelChangeRealisation {
  readonly change: string;
  readonly state: ModelRealisationState;
  readonly ops: readonly ModelOpRealisation[];
}
type Comparison = 'same' | 'different' | 'unverified';
function compareCite(current: unknown, wanted: unknown): Comparison | null {
  const cite = modelRecord(current);
  if (typeof wanted !== 'string' || !['code', 'evidence'].includes(String(cite?.kind))) return null;
  if (cite?.kind === 'evidence' && kindOf(wanted) === 'evidence') {
    return cite.id === wanted ? 'same' : 'different';
  }
  return 'unverified';
}
function compared(checks: readonly Comparison[]): Comparison {
  if (checks.includes('different')) return 'different';
  return checks.includes('unverified') ? 'unverified' : 'same';
}
/** Object key order is representation; array order and null versus absence remain facts. */
function compareValue(current: unknown, wanted: unknown): Comparison {
  if (current === wanted) return 'same';
  const citation = compareCite(current, wanted);
  if (citation !== null) return citation;
  if (Array.isArray(current) && Array.isArray(wanted)) {
    return current.length === wanted.length
      ? compared(wanted.map((value, position) => compareValue(current[position], value)))
      : 'different';
  }
  const actual = modelRecord(current),
    expected = modelRecord(wanted);
  if (
    actual === null ||
    expected === null ||
    Object.keys(actual).length !== Object.keys(expected).length
  ) {
    return 'different';
  }
  return compared(
    Object.entries(expected).map(([key, value]) =>
      Object.hasOwn(actual, key) ? compareValue(actual[key], value) : 'different',
    ),
  );
}
function checksFor(
  op: Extract<ModelOp, { readonly modify: string }>,
  node: Readonly<Record<string, unknown>>,
): readonly Comparison[] {
  const set = Object.entries(modelRecord(op.set) ?? {}).map(([key, value]) =>
    compareValue(node[key], value),
  );
  const append = Object.entries(modelRecord(op.append) ?? {}).flatMap(([key, values]) =>
    modelList(values).map((value) => membership(node[key], value, false)),
  );
  const drop = Object.entries(modelRecord(op.drop) ?? {}).flatMap(([key, values]) =>
    modelList(values).map((value) => membership(node[key], value, true)),
  );
  return [...set, ...append, ...drop];
}
function membership(list: unknown, value: unknown, absent: boolean): Comparison {
  const checks = new Set(modelList(list).map((item) => compareValue(item, value)));
  if (checks.has('same')) return absent ? 'different' : 'same';
  if (checks.has('unverified')) return 'unverified';
  return absent ? 'same' : 'different';
}
function checkState(checks: readonly Comparison[]): Pick<ModelOpRealisation, 'state' | 'detail'> {
  const same = checks.filter((value) => value === 'same').length;
  if (checks.length === 0) {
    return { state: 'unverified', detail: 'No requested fact is available to check.' };
  }
  if (checks.includes('unverified')) {
    return {
      state: 'unverified',
      detail: `${String(same)} of ${String(checks.length)} requested facts agree; ${String(checks.filter((value) => value === 'different').length)} disagree and ${String(checks.filter((value) => value === 'unverified').length)} citation comparisons remain unverified.`,
    };
  }
  if (same === checks.length) {
    return {
      state: 'matches',
      detail: `The current model agrees with all ${String(checks.length)} requested facts.`,
    };
  }
  return {
    state: same === 0 ? 'missing' : 'partial',
    detail: `The current model agrees with ${String(same)} of ${String(checks.length)} requested facts.`,
  };
}
function gone(
  op: Extract<ModelOp, { readonly remove: string } | { readonly deprecate: string }>,
  index: ModelIndex,
): Pick<ModelOpRealisation, 'state' | 'detail'> {
  const target = modelPlanOpTarget(op);
  const node = index.get(target);
  if (node === null) {
    return {
      state: 'matches',
      detail:
        'The current model does not record this target; this does not establish deployed removal.',
    };
  }
  if ('deprecate' in op && (node.data.deprecated === true || node.data.status === 'deprecated')) {
    return {
      state: 'matches',
      detail: 'The current model explicitly marks this target deprecated.',
    };
  }
  return { state: 'missing', detail: 'The current model still records this target.' };
}
function realise(op: ModelOp, index: ModelIndex): Pick<ModelOpRealisation, 'state' | 'detail'> {
  const target = modelPlanOpTarget(op);
  if (
    index
      .gaps(target)
      .some((gap) => ['proposed_effect', 'unresolved_cite', 'no_cites'].includes(gap.kind))
  ) {
    return {
      state: 'unverified',
      detail:
        'The supplied target has proposed or unresolved implementation evidence; it cannot establish current agreement.',
    };
  }
  if ('remove' in op || 'deprecate' in op) return gone(op, index);
  const current = index.get(target);
  if (current === null) {
    return { state: 'missing', detail: 'The current model has no such target.' };
  }
  if ('modify' in op) return checkState(checksFor(op, current.data));
  const checks = Object.entries(modelRecord(op.value) ?? {}).map(([key, value]) =>
    compareValue(current.data[key], value),
  );
  const result = checkState(checks);
  return checks.includes('different') ? { ...result, state: 'differs' } : result;
}
function rollUp(states: readonly ModelRealisationState[]): ModelRealisationState {
  if (states.length === 0 || states.includes('unverified')) return 'unverified';
  if (states.every((state) => state === 'matches')) return 'matches';
  if (states.every((state) => state === 'missing')) return 'missing';
  return states.includes('differs') ? 'differs' : 'partial';
}
/** Model agreement is checked against strict current facts, independently of any selected plan projection. */
export function modelRealisationOf(
  plan: ModelPlan,
  index: ModelIndex,
): readonly ModelChangeRealisation[] {
  return plan.changes.map((change) => {
    const ops = (change.ops ?? []).map((op, position) => ({
      op: position,
      target: modelPlanOpTarget(op),
      ...realise(op, index),
    }));
    return { change: change.id, state: rollUp(ops.map((op) => op.state)), ops };
  });
}
