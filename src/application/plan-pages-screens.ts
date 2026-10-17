import type { Model } from '@/application/plan/derive';
import { changeScreens } from '@/application/plan-pages-screens-changes';
import { journeyScreens } from '@/application/plan-pages-screens-journey';
import { versionScreens } from '@/application/plan-pages-screens-versions';

// The screens of each chapter, worked out from the plan: a plan with less in it tells a shorter story. This is the
// one place that says which screens exist; the chapter content later plugs in by key (see src/features/plan).

export interface ScreenRef {
  /** Stable within the chapter and safe in a URL. */
  readonly key: string;
  readonly title: string;
}

export type ChapterKey =
  | 'cover'
  | 'why'
  | 'today'
  | 'journey'
  | 'changes'
  | 'prove'
  | 'build'
  | 'commit'
  | 'ref'
  | 'versions';

const screen = (key: string, title: string): ScreenRef => ({ key, title });

export { keyOf } from '@/application/plan-pages-key';

const some = (list: readonly unknown[] | undefined): boolean => (list ?? []).length > 0;

function whyScreens(model: Model): ScreenRef[] {
  const { problem, meta } = model.plan;
  const promised = some(problem.goals) || some(problem.non_goals) || meta.appetite !== undefined;
  return [
    screen('problem', 'The problem'),
    ...(promised ? [screen('promise', 'What we promise')] : []),
    ...(some(problem.scenarios) ? [screen('scenarios', 'Scenarios')] : []),
  ];
}

function todayScreens(model: Model): ScreenRef[] {
  const concepts = (model.plan.domain?.concepts ?? []).filter(
    (c) => model.status(c.id) !== 'added',
  );
  return [
    ...(concepts.length > 0 ? [screen('domain', 'The domain')] : []),
    screen('system', 'The system map'),
    ...(some(model.asIs.graphs) ? [screen('graph', 'The graph')] : []),
    ...(some(model.asIs.screens) ? [screen('screens', 'What people see today')] : []),
  ];
}

const SMALL_PLAN = 3;

function proveScreens(model: Model): ScreenRef[] {
  if ((model.plan.changes ?? []).length <= SMALL_PLAN) {
    return [screen('coverage', 'How we prove it')];
  }
  return [
    screen('e2e', 'End-to-end tests over the flows'),
    screen('contracts', 'Contract tests'),
    screen('coverage', 'Coverage'),
  ];
}

const REST_GROUPS = new Set(['deferred', 'loose', 'notes', 'aside']);
const REST_MIN = 3;

function commitScreens(model: Model): ScreenRef[] {
  const rest = model
    .decisionRegister()
    .filter((group) => REST_GROUPS.has(group.key))
    .reduce((total, group) => total + group.items.length, 0);
  return [
    screen('choices', 'The choices'),
    screen('risks', 'Risks'),
    ...(rest >= REST_MIN ? [screen('register', 'The rest')] : []),
    screen('ask', 'Still to settle'),
  ];
}

const CATALOGUES: readonly (readonly [string, string])[] = [
  ['services', 'Components'],
  ['stores', 'Stores'],
  ['apis', 'APIs'],
  ['schemas', 'Schemas'],
  ['events', 'Events'],
  ['flows', 'Flows'],
  ['screens', 'Screens'],
];
const CATALOGUES_AFTER: readonly (readonly [string, string])[] = [
  ['ledger', 'Changes'],
  ['tests', 'Tests'],
  ['work', 'Work items'],
  ['milestones', 'Milestones'],
  ['risks', 'Risks'],
  ['teams', 'Teams'],
  ['decisions', 'Decisions'],
];

function referenceScreens(model: Model): ScreenRef[] {
  const operations = some(model.toBe.operations) || some(model.asIs.operations);
  return [
    ...CATALOGUES,
    ...(operations ? [['operations', 'Operations'] as const] : []),
    ...CATALOGUES_AFTER,
  ].map(([key, title]) => screen(key, title));
}

const BUILDERS: Record<ChapterKey, (model: Model) => ScreenRef[]> = {
  cover: () => [screen('cover', 'Cover'), screen('part', 'Your part')],
  why: whyScreens,
  today: todayScreens,
  journey: journeyScreens,
  changes: changeScreens,
  prove: proveScreens,
  build: () => [screen('build-order', 'Build order'), screen('work-by-team', 'Work by team')],
  commit: commitScreens,
  ref: referenceScreens,
  versions: versionScreens,
};

export function screensFor(model: Model, chapter: ChapterKey): ScreenRef[] {
  return BUILDERS[chapter](model);
}
