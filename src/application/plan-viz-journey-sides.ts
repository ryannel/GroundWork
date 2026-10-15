import { isRecord } from '@/application/plan/ids';
import type { JourneyComparison, JourneyRow } from '@/application/plan/journey';
import type { Evidence } from '@/application/plan/journey-evidence';

// What one side of a comparison says: a sentence, a recorded value, or the step's own prose.

export type Side = 'before' | 'after';

export type SideContent =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'value'; readonly value: unknown }
  | { readonly kind: 'prose'; readonly text: string };

const text = (words: string): SideContent => ({ kind: 'text', text: words });

function orderText(row: JourneyRow, side: Side, comparison: JourneyComparison): string {
  const flow = side === 'before' ? comparison.beforeFlow : comparison.afterFlow;
  const steps = flow?.steps ?? [];
  const at = steps.findIndex((s) => s.id === row.id);
  const previous = steps[at - 1];
  if (at <= 0 || previous === undefined) return 'First in this flow.';
  return `After ${previous.action === '' ? previous.id : previous.action}.`;
}

function placeText(evidence: Evidence, side: Side): string | null {
  if (evidence.property === 'image') {
    return side === 'before'
      ? 'The recorded screen picture.'
      : 'The plan changes the screen picture.';
  }
  if (evidence.kind === 'screen-layout') {
    return side === 'before'
      ? 'The region’s recorded position.'
      : 'The region moves on the screen.';
  }
  return null;
}

/** The step being compared, and the flows it is compared in. */
export interface At {
  readonly row: JourneyRow;
  readonly comparison: JourneyComparison;
}

/** One side of the comparison for a piece of evidence; the step's own words when there is none. */
export function sideContent(at: At, evidence: Evidence | null, side: Side): SideContent {
  const { row, comparison } = at;
  const step = side === 'before' ? row.before : row.after;
  if (step === null) return text('This step does not exist in this view.');
  if (evidence === null) {
    const words = [step.logic, step.action, step.id].find((w) => w !== undefined && w !== '');
    return { kind: 'prose', text: words ?? step.id };
  }
  if (evidence.kind === 'order') return text(orderText(row, side, comparison));
  const place = placeText(evidence, side);
  if (place !== null) return text(place);
  const value = evidence[side];
  if (evidence.property === null && (value === null || value === undefined)) {
    return text('Not present.');
  }
  return { kind: 'value', value };
}

const clean = (value: unknown): string =>
  JSON.stringify(value, (key, v: unknown) =>
    key.startsWith('$') || key === 'sources' ? undefined : v,
  );

const keyOf = (value: unknown): string => {
  if (!isRecord(value)) return clean(value);
  const id = value.id ?? value.name;
  return typeof id === 'string' ? id : clean(value);
};

/** Only the properties of a record that differ from its counterpart, with its identity. */
function changedPart(value: unknown, other: unknown): unknown {
  if (!isRecord(value) || !isRecord(other)) return value;
  return Object.fromEntries(
    Object.entries(value).filter(
      ([property, v]) =>
        property === 'id' || property === 'name' || clean(v) !== clean(other[property]),
    ),
  );
}

function withoutSame(own: readonly unknown[], other: readonly unknown[]): unknown[] {
  const byKey = new Map<string, unknown>(other.map((v) => [keyOf(v), v]));
  return own
    .filter((v) => clean(v) !== clean(byKey.get(keyOf(v))))
    .map((v) => changedPart(v, byKey.get(keyOf(v))));
}

/** Keeps a comparison of field lists to the fields that differ; whole records stay behind their links. */
export function focusedEvidence(item: Evidence): Evidence {
  const { before, after } = item;
  if (!Array.isArray(before) || !Array.isArray(after)) return item;
  return { ...item, before: withoutSame(before, after), after: withoutSame(after, before) };
}
