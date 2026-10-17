import type { Model } from '@/application/plan/derive';
import { prop } from '@/application/plan/ids';
import type { JourneyComparison, JourneyRow } from '@/application/plan/journey';
import type { Evidence } from '@/application/plan/journey-evidence';
import { decisionsOf } from '@/application/plan-viz-flow-changes';
import {
  focusedEvidence,
  type Side,
  type SideContent,
  sideContent,
} from '@/application/plan-viz-journey-sides';
import {
  evidenceRank,
  type JourneyMode,
  rowTitle,
  stepIn,
} from '@/application/plan-viz-journey-words';

// What the plan changes at one step, as data the panel draws: the principal difference, the rest, and why.

export type Cells =
  | { readonly kind: 'pair'; readonly before: SideContent; readonly after: SideContent }
  /** The view already shows one side's words above; only the other side is added. */
  | {
      readonly kind: 'counterpart';
      readonly shown: JourneyMode;
      readonly property: string;
      readonly other: SideContent;
    };

export type Lead =
  | { readonly kind: 'none' }
  | { readonly kind: 'deprecated'; readonly reasons: readonly string[] }
  /** The step is not in this view; what the other view has. */
  | { readonly kind: 'absent'; readonly mode: JourneyMode; readonly content: SideContent }
  | { readonly kind: 'cells'; readonly cells: Cells };

export interface DetailView {
  readonly target: string;
  readonly property: string | null;
  readonly indirect: boolean;
  readonly cells: Cells;
}

export interface ComparisonView {
  readonly kind: JourneyRow['kind'];
  /** What the step is called, for the panel's label. */
  readonly name: string;
  /** The step runs as today and nothing else is recorded. */
  readonly unchanged: boolean;
  /** The entity the principal difference is about, when it is not the step itself. */
  readonly heading: string | null;
  readonly note: string | null;
  readonly lead: Lead;
  readonly details: readonly DetailView[];
  readonly changes: readonly string[];
  readonly decisions: readonly string[];
}

interface Ctx {
  readonly model: Model;
  readonly comparison: JourneyComparison;
  readonly row: JourneyRow;
  readonly mode: JourneyMode;
}

const STEP_PROPS = new Set(['logic', 'action', 'fails']);
const sideOf = (mode: JourneyMode): Side => (mode === 'asIs' ? 'before' : 'after');
const otherMode = (mode: JourneyMode): JourneyMode => (mode === 'asIs' ? 'toBe' : 'asIs');

function cellsOf(ctx: Ctx, item: Evidence | null): Cells {
  const { row, mode } = ctx;
  const side = sideOf(mode);
  const here = item === null ? undefined : item[side];
  const property = item?.property ?? null;
  const stepProperty = item?.kind === 'step' && property !== null && STEP_PROPS.has(property);
  const written = typeof here === 'string' && here !== '';
  const shown = stepProperty && written && here === prop(stepIn(row, mode), property);
  if (shown) {
    const other = sideContent(ctx, item, sideOf(otherMode(mode)));
    return { kind: 'counterpart', shown: mode, property, other };
  }
  return {
    kind: 'pair',
    before: sideContent(ctx, item, 'before'),
    after: sideContent(ctx, item, 'after'),
  };
}

function deprecationReasons(model: Model, id: string): string[] {
  const why = (model.plan.changes ?? [])
    .filter((c) => c.ops.some((op) => 'deprecate' in op && op.deprecate === id))
    .map((c) => c.why)
    .filter((w): w is string => w !== undefined && w !== '');
  return [...new Set(why)];
}

const lengthOf = (value: unknown): number => (Array.isArray(value) ? value.length : 0);

/** A single related field changed: say so beside the step rather than behind a fold. */
const isCompactRelated = (principal: Evidence | null): boolean => {
  if (principal?.kind !== 'record' || principal.property !== 'fields') return false;
  const lists = Array.isArray(principal.before) && Array.isArray(principal.after);
  return lists && Math.max(lengthOf(principal.before), lengthOf(principal.after)) === 1;
};

function leadOf(
  ctx: Ctx,
  flags: { readonly deprecated: boolean; readonly hidden: boolean },
  principal: Evidence | null,
): Lead {
  const { model, row, mode } = ctx;
  if (flags.deprecated) return { kind: 'deprecated', reasons: deprecationReasons(model, row.id) };
  if (flags.hidden) return { kind: 'none' };
  if (row.before === null || row.after === null) {
    if (stepIn(row, mode) !== null) return { kind: 'none' };
    const content = sideContent(ctx, null, sideOf(otherMode(mode)));
    return { kind: 'absent', mode: otherMode(mode), content };
  }
  return { kind: 'cells', cells: cellsOf(ctx, principal) };
}

function noteOf(evidence: readonly Evidence[]): string {
  return evidence.every((e) => e.kind === 'screen-context')
    ? 'The linked screen changes. No different behaviour is recorded for this action.'
    : 'Impact inferred from the data this step references. No different behaviour is recorded for this step.';
}

interface Shape {
  readonly evidence: readonly Evidence[];
  readonly deprecated: boolean;
  readonly indirectOnly: boolean;
  /** The difference that says most, narrowed to what changed; none when the step is on one side only. */
  readonly principal: Evidence | null;
  readonly hidden: boolean;
}

function shapeOf(row: JourneyRow): Shape {
  const evidence = row.evidence
    .filter((e) => e.kind !== 'deprecation')
    .toSorted((a, b) => evidenceRank(a) - evidenceRank(b));
  const deprecated = row.kind === 'deprecated';
  const indirectOnly = row.kind === 'same' && evidence.every((e) => e.indirect);
  const first = evidence[0];
  const both = row.before !== null && row.after !== null && !deprecated;
  const principal = both && first !== undefined ? focusedEvidence(first) : null;
  return {
    evidence,
    deprecated,
    indirectOnly,
    principal,
    hidden: indirectOnly && !isCompactRelated(principal),
  };
}

function detailsOf(ctx: Ctx, shape: Shape): DetailView[] {
  const keepAll = shape.deprecated || shape.hidden || shape.principal === null;
  return shape.evidence
    .filter((e, i) => (keepAll || i > 0) && e.property !== null)
    .map(focusedEvidence)
    .map((e) => ({
      target: e.target,
      property: e.property,
      indirect: e.indirect,
      cells: cellsOf(ctx, e),
    }));
}

/** The comparison for one step in the chosen view, ready to draw. */
export function comparisonOf(
  model: Model,
  comparison: JourneyComparison,
  at: {
    readonly row: JourneyRow;
    readonly mode: JourneyMode;
    /** A change the page already gives as its headline. */
    readonly omitChange?: string | undefined;
  },
): ComparisonView {
  const { row, mode } = at;
  const ctx: Ctx = { model, comparison, row, mode };
  const shape = shapeOf(row);
  const { principal } = shape;
  return {
    kind: row.kind,
    name: rowTitle(row, mode),
    unchanged: row.kind === 'same' && shape.evidence.length === 0,
    heading: principal !== null && principal.target !== row.id ? principal.target : null,
    note: shape.indirectOnly ? noteOf(shape.evidence) : null,
    lead: leadOf(ctx, shape, principal),
    details: detailsOf(ctx, shape),
    changes: row.changes.filter((id) => id !== at.omitChange),
    decisions: decisionsOf(model, row.changes),
  };
}
