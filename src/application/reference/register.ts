import type { Model } from '@/application/plan/derive';
import { type Deciding, isDecision, numberOf, titleOf } from '@/application/plan-viz-decision';
import { teamName } from '@/application/plan-viz-teams';
import { countOf } from '@/application/plan-viz-text';
import { workOrdered } from '@/application/plan-viz-work';
import { searchText } from '@/application/reference/model';
import type { Milestone, Test, WorkItem } from '@/domain/plan/plan.generated';

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
    titleOf(e, model),
    e.id,
    numberOf(model, e.id),
    e.status,
    e.decider === undefined ? '' : teamName(model, e.decider),
    own,
  );
}

/** "3 steps · 1 whole flow". */
export function walksText(test: Pick<Test, 'walks'>): string {
  const walks = test.walks ?? [];
  const flows = walks.filter((w) => !w.includes('#')).length;
  const steps = walks.length - flows;
  return [steps > 0 ? countOf(steps, 'step') : '', flows > 0 ? countOf(flows, 'whole flow') : '']
    .filter((x) => x !== '')
    .join(' · ');
}

export const LEVELS_TOP_DOWN = ['e2e', 'integration', 'contract', 'service', 'unit'] as const;

export interface LevelTests {
  readonly level: (typeof LEVELS_TOP_DOWN)[number];
  readonly tests: readonly Test[];
}

/** The plan's tests under their level, the widest level first; a level with none is left out. */
export function testsByLevel(tests: readonly Test[]): LevelTests[] {
  return LEVELS_TOP_DOWN.map((level) => ({
    level,
    tests: tests.filter((t) => t.level === level),
  })).filter((l) => l.tests.length > 0);
}

export interface WorkGroup {
  readonly milestone: Milestone | null;
  readonly items: readonly WorkItem[];
}

/** Work items in build order under their milestones; items with no milestone come last. */
export function workByMilestone(model: Model): WorkGroup[] {
  const items = workOrdered(model);
  const milestones = model.plan.milestones ?? [];
  const known = new Set(milestones.map((m) => m.id));
  const groups: WorkGroup[] = [
    ...milestones.map((milestone) => ({
      milestone,
      items: items.filter((w) => w.milestone === milestone.id),
    })),
    {
      milestone: null,
      items: items.filter((w) => w.milestone === undefined || !known.has(w.milestone)),
    },
  ];
  return groups.filter((g) => g.items.length > 0);
}

/** A milestone's name before the " · ": "M1". */
export const milestoneShort = (m: Milestone): string => m.name.split(' · ')[0] ?? m.name;
