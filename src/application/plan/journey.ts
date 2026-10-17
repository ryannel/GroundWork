import type { Model } from '@/application/plan/derive';
import type { DiffEntry } from '@/application/plan/derive-diff';
import { type Evidence, ids, rec, stepEvidence } from '@/application/plan/journey-evidence';
import type { FlowNode, StepNode } from '@/domain/plan/plan-graph';

/** What a journey reads from a model. */
export type JourneyModel = Pick<Model, 'asIs' | 'toBe' | 'diff' | 'status'>;

export type RowKind = 'same' | 'changed' | 'added' | 'removed' | 'deprecated';

export interface JourneyRow {
  readonly id: string;
  readonly before: StepNode | null;
  readonly after: StepNode | null;
  readonly kind: RowKind;
  readonly evidence: readonly Evidence[];
  /** The changes that explain the evidence. */
  readonly changes: readonly string[];
}

export interface JourneyComparison {
  readonly id: string;
  readonly beforeFlow: FlowNode | null;
  readonly afterFlow: FlowNode | null;
  readonly presence: 'existing' | 'removed' | 'added' | 'unknown';
  readonly rows: readonly JourneyRow[];
}

const flowIn = (graph: JourneyModel['asIs'], id: string): FlowNode | null => {
  const node = graph.get(id);
  return node?.$type === 'flow' ? node : null;
};

const isToday = (mode: string): boolean => ['asIs', 'today', 'before'].includes(mode);

/** Where a run of removed steps goes: after its surviving predecessor, else before its successor. */
function insertionPoint(
  out: readonly string[],
  neighbours: { readonly previous: string | undefined; readonly next: string | undefined },
): number {
  const { previous, next } = neighbours;
  if (previous !== undefined && out.includes(previous)) return out.indexOf(previous) + 1;
  return next === undefined ? 0 : out.indexOf(next);
}

/** After order is authoritative; removed runs stay beside a surviving baseline neighbour. */
function unionOrder(before: readonly StepNode[], after: readonly StepNode[]): string[] {
  const out = after.map((step) => step.id);
  const remaining = new Set(out);
  for (let i = 0; i < before.length;) {
    if (remaining.has(before[i]?.id ?? '')) {
      i += 1;
      continue;
    }
    const start = i;
    while (i < before.length && !remaining.has(before[i]?.id ?? '')) i += 1;
    const run = before.slice(start, i).map((step) => step.id);
    const at = insertionPoint(out, { previous: before[start - 1]?.id, next: before[i]?.id });
    out.splice(at, 0, ...run);
  }
  return out;
}

/** The changes whose ops touch exactly what the evidence points at. */
function changesFor(model: JourneyModel, evidence: readonly Evidence[], id: string): string[] {
  const out: (string | undefined)[] = [];
  for (const target of ids([id, ...evidence.map((item) => item.target)])) {
    const relevant = evidence.filter((item) => item.target === target);
    const entries: DiffEntry[] = model.diff(target);
    for (const entry of entries) {
      // Container queries include child ops. Keep only exact evidence, or children of an indirect record.
      const child =
        entry.target !== target &&
        !relevant.some(
          (item) =>
            item.kind === 'record' ||
            (item.property === null && (entry.kind === 'add' || entry.kind === 'remove')),
        );
      const otherProp =
        entry.target === target &&
        entry.prop !== null &&
        !relevant.some((item) => item.property === entry.prop || item.property === null);
      if (!child && !otherProp) out.push(entry.changeId);
    }
  }
  return ids(out);
}

interface Pair {
  readonly before: StepNode | null;
  readonly after: StepNode | null;
}

function orderEvidence(
  id: string,
  pair: Pair,
  shared: { readonly before: readonly string[]; readonly after: readonly string[] },
): Evidence[] {
  if (pair.before === null || pair.after === null) return [];
  const before = shared.before.indexOf(id);
  const after = shared.after.indexOf(id);
  return before === after
    ? []
    : [{ kind: 'order', target: id, property: 'order', before, after, indirect: false }];
}

const dedupe = (evidence: readonly Evidence[]): Evidence[] => {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = `${item.kind}|${item.target}|${String(item.property)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

function kindOf(pair: Pair, deprecated: boolean, evidence: readonly Evidence[]): RowKind {
  if (pair.before === null) return 'added';
  if (pair.after === null) return 'removed';
  if (deprecated) return 'deprecated';
  return evidence.some((item) => !item.indirect) ? 'changed' : 'same';
}

function rowOf(
  model: JourneyModel,
  at: { readonly id: string; readonly pair: Pair; readonly order: readonly Evidence[] },
): JourneyRow {
  const { id, pair, order } = at;
  const deprecated = pair.after !== null && model.status(id) === 'deprecated';
  const own: Evidence[] = deprecated
    ? [
        {
          kind: 'deprecation',
          target: id,
          property: null,
          before: rec(pair.before),
          after: rec(pair.after),
          indirect: false,
        },
      ]
    : [];
  const evidence = dedupe([...stepEvidence(model, pair, order), ...own]);
  return {
    id,
    ...pair,
    kind: kindOf(pair, deprecated, evidence),
    evidence,
    changes: changesFor(model, evidence, id),
  };
}

/**
 * Rows form an ordered union for explanations, not a third executable flow.
 * Evidence says what changed; indirect evidence never asserts behaviour.
 */
export function journeyComparison(model: JourneyModel, flowId: string): JourneyComparison {
  const beforeFlow = flowIn(model.asIs, flowId);
  const afterFlow = flowIn(model.toBe, flowId);
  const before = beforeFlow?.steps ?? [];
  const after = afterFlow?.steps ?? [];
  const a = new Map(before.map((step) => [step.id, step]));
  const b = new Map(after.map((step) => [step.id, step]));
  const shared = {
    before: before.filter((step) => b.has(step.id)).map((step) => step.id),
    after: after.filter((step) => a.has(step.id)).map((step) => step.id),
  };
  const rows = unionOrder(before, after).map((id) => {
    const pair = { before: a.get(id) ?? null, after: b.get(id) ?? null };
    return rowOf(model, { id, pair, order: orderEvidence(id, pair, shared) });
  });
  let presence: JourneyComparison['presence'] = 'unknown';
  if (beforeFlow !== null) presence = afterFlow === null ? 'removed' : 'existing';
  else if (afterFlow !== null) presence = 'added';
  return { id: flowId, beforeFlow, afterFlow, presence, rows };
}

export interface JourneyFocus {
  readonly comparison: JourneyComparison;
  readonly row: JourneyRow | null;
  readonly step: StepNode | null;
  readonly exists: boolean;
  readonly flowExists: boolean;
  readonly presence: JourneyComparison['presence'];
  /** The nearest steps either side that the selected graph also has. */
  readonly neighbours: { readonly before: string | null; readonly after: string | null };
}

function neighboursOf(source: readonly StepNode[], stepId: string, available: ReadonlySet<string>) {
  const at = source.findIndex((item) => item.id === stepId);
  if (at === -1) return { before: null, after: null };
  const previous = source.slice(0, at).findLast((item) => available.has(item.id));
  const next = source.slice(at + 1).find((item) => available.has(item.id));
  return { before: previous?.id ?? null, after: next?.id ?? null };
}

/** The flow, step and neighbour source for one side of the comparison. */
function sideOf(comparison: JourneyComparison, row: JourneyRow | null, today: boolean) {
  const flow = today ? comparison.beforeFlow : comparison.afterFlow;
  const other = today ? comparison.afterFlow : comparison.beforeFlow;
  const step = (today ? row?.before : row?.after) ?? null;
  return { flow, step, source: (step === null ? other : flow)?.steps ?? [] };
}

/** Resolve focus without silently substituting another step or an absent flow's other graph. */
export function journeyStep(
  model: JourneyModel,
  flowId: string,
  focus: { readonly stepId: string; readonly mode?: string },
): JourneyFocus {
  const comparison = journeyComparison(model, flowId);
  const row = comparison.rows.find((item) => item.id === focus.stepId) ?? null;
  const { flow, step, source } = sideOf(comparison, row, isToday(focus.mode ?? 'asIs'));
  const available = new Set((flow?.steps ?? []).map((item) => item.id));
  return {
    comparison,
    row,
    step,
    exists: step !== null,
    flowExists: flow !== null,
    presence: comparison.presence,
    neighbours: neighboursOf(source, focus.stepId, available),
  };
}
