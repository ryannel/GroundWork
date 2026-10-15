import type { Model } from '@/application/plan/derive';
import { searchText } from '@/application/plan-story-ref';
import { type Deciding, isDecision, numberOf, titleOf } from '@/application/plan-viz-decision';
import { teamName } from '@/application/plan-viz-teams';

// The decision register as the reference page lists it: a question that a decision answers is shown on that
// decision's card, so each item appears once.

export type RegisterGroupKey = 'decide' | 'decided' | 'deferred' | 'loose' | 'notes' | 'aside';

export interface RegisterGroupView {
  readonly key: RegisterGroupKey;
  readonly label: string;
  readonly note: string;
  readonly ids: readonly string[];
}

const KEYS: readonly RegisterGroupKey[] = [
  'decide',
  'decided',
  'deferred',
  'loose',
  'notes',
  'aside',
];

/** The non-empty groups of the register, each with the ids it lists. */
export function registerGroups(model: Model): RegisterGroupView[] {
  return model.decisionRegister().flatMap((g) => {
    const key = KEYS.find((k) => k === g.key);
    const ids = g.items.filter((e) => e.answers === undefined).map((e) => e.id);
    return key === undefined || ids.length === 0
      ? []
      : [{ key, label: g.label, note: g.note, ids }];
  });
}

/** How many items each group lists, and in all. */
export function registerCounts(model: Model): {
  readonly total: number;
  readonly counts: Readonly<Record<RegisterGroupKey, number>>;
} {
  const groups = registerGroups(model);
  const count = (k: RegisterGroupKey): number => groups.find((g) => g.key === k)?.ids.length ?? 0;
  return {
    total: groups.reduce((n, g) => n + g.ids.length, 0),
    counts: {
      decide: count('decide'),
      decided: count('decided'),
      deferred: count('deferred'),
      loose: count('loose'),
      notes: count('notes'),
      aside: count('aside'),
    },
  };
}

/** The words a decision's or question's row is found by. */
export function decidingSearch(model: Model, e: Deciding): string {
  const own = isDecision(e)
    ? [e.decision, e.context, e.options?.map((o) => o.name)]
    : [e.question, e.answer];
  return searchText(
    titleOf(e),
    e.id,
    numberOf(model, e.id),
    e.status,
    e.decider === undefined ? '' : teamName(model, e.decider),
    own,
  );
}
