import { appendChild, isQualifiedId, kindOf, rootId } from '@/domain/ids';
import type { ModelOp } from '@/domain/plan-apply';
import { modelList, modelRecord, modelText, type ModelPlan } from '@/domain/workspace-model';

import type { ModelIndex } from './model-index';
import { modelInspectionRecords } from './model-inspection';
import type { ModelPlanProgress } from './model-progress';
import type { ModelQueryContext } from './model-reader';
import type { BaseInfo } from './plan/plan-base';
import type { PlanBar } from './plan-bar';
import type { AheadStop } from './plan-changes-ahead';
import type { PlanCard } from './plan-footprint';
import {
  pageHref,
  planOutline,
  type ChapterKey,
  type Outline,
  type Page,
  type PlanAddress,
} from './plan-navigation';
import { keyOf } from './plan-pages-key';
import type { ScreenRef } from './plan-pages-screens';

export type { ModelPlanProgress } from './model-progress';

export interface ModelPlanBasis {
  readonly base: BaseInfo;
  readonly readsAfter: readonly PlanCard[];
}

export interface ModelPlanRecord {
  readonly id: string | null;
  readonly title: string;
  readonly data: Readonly<Record<string, unknown>>;
}
export interface ModelPlanBlock {
  readonly title: string;
  readonly records: readonly ModelPlanRecord[];
  readonly summary: boolean;
}
export interface ModelPlanScreen {
  readonly page: Page;
  readonly headline: string;
  readonly recap: readonly string[];
  readonly blocks: readonly ModelPlanBlock[];
  readonly map: boolean;
  readonly flowIds: readonly string[];
  readonly catalogue: readonly {
    readonly id: string;
    readonly label: string;
    readonly kind: string;
  }[];
}
export interface ModelPlanSnapshot {
  readonly version: string;
  readonly plan: ModelPlan;
}
const screen = (key: string, title: string): ScreenRef => ({ key, title });
export function modelPlanOpTarget(op: ModelOp): string {
  if ('add' in op) {
    return isQualifiedId(op.value.id) ? op.value.id : appendChild(op.into ?? '', op.value.id);
  }
  if ('modify' in op) return op.modify;
  return 'remove' in op ? op.remove : op.deprecate;
}
type FlowName = (id: string) => string | null;
const SMALL_PLAN = 3;
const CONTRACT_KINDS: ReadonlySet<string> = new Set([
  'interface',
  'endpoint',
  'schema',
  'message',
  'subscription',
  'operation',
]);
const isContractTarget = (id: string): boolean => CONTRACT_KINDS.has(kindOf(rootId(id)) ?? '');
const isFlowTarget = (id: string): boolean => kindOf(rootId(id)) === 'flow';
function operationTargets(plan: ModelPlan): readonly string[] {
  return plan.changes.flatMap((change) => (change.ops ?? []).map(modelPlanOpTarget));
}
function changedFlowIds(plan: ModelPlan): readonly string[] {
  return [
    ...new Set(
      operationTargets(plan)
        .filter(isFlowTarget)
        .map((id) => rootId(id)),
    ),
  ];
}
function flowNames(plan: ModelPlan, lookup: FlowName): FlowName {
  const added = new Map(
    plan.changes.flatMap((change) =>
      (change.ops ?? []).flatMap((op) =>
        'add' in op && op.add === 'flow' ? [[op.value.id, op.value.name] as const] : [],
      ),
    ),
  );
  return (id) => lookup(id) ?? added.get(id) ?? null;
}
function indexFlowName(index: ModelIndex, id: string): string | null {
  return index.get(id)?.kind === 'flow' ? index.label(id) : null;
}
function knownFlowIds(plan: ModelPlan, label: FlowName): readonly string[] {
  const ids = [
    ...(plan.story?.scope ?? []),
    ...(plan.story?.stages ?? []).flatMap((stage) => stage.flows ?? []),
    ...(plan.problem.scenarios ?? []).flatMap((scenario) => scenario.flows ?? []),
    ...changedFlowIds(plan),
  ];
  return [...new Set(ids)].filter((id) => label(id) !== null);
}
function storyScreens(plan: ModelPlan, label: FlowName): readonly ScreenRef[] {
  const scenarios = (plan.problem.scenarios ?? []).filter(
    (scenario) => (scenario.flows ?? []).length > 0,
  );
  const covered = new Set(scenarios.flatMap((scenario) => scenario.flows ?? []));
  const pages = [
    ...(plan.story === undefined ? [] : [screen('story', 'How it plays out')]),
    ...scenarios.map((scenario) =>
      screen(keyOf(scenario.id), `Planned scenario: ${scenario.title}`),
    ),
    ...knownFlowIds(plan, label)
      .filter((id) => !covered.has(id))
      .map((id) => screen(keyOf(id), label(id) ?? id)),
    ...(plan.story?.stages ?? []).map((stage) => screen(keyOf(stage.id), stage.name)),
    ...(plan.execution === undefined ? [] : [screen('execution', 'How it plays out')]),
  ];
  return pages.length === 0 ? [screen('empty', 'Journey')] : pages;
}
function changeScreens(plan: ModelPlan, label: FlowName): readonly ScreenRef[] {
  const ids = operationTargets(plan);
  const flows = changedFlowIds(plan);
  const small = plan.changes.length <= SMALL_PLAN;
  const flowScreens =
    flows.length > SMALL_PLAN && !small
      ? [screen('flows', 'Flows that change')]
      : flows.map((id) => screen(keyOf(id), label(id) ?? id));
  return [
    screen('system', 'The system with this plan'),
    ...plan.changes.map((change) => screen(keyOf(change.id), change.title)),
    ...flowScreens,
    ...(ids.some(isContractTarget) ? [screen('contracts', 'Contracts that change')] : []),
    ...(small && ids.some((id) => !isFlowTarget(id)) ? [screen('more', 'Also changing')] : []),
    screen('ledger', 'All changes'),
  ];
}
function proveScreens(plan: ModelPlan): readonly ScreenRef[] {
  if (plan.changes.length <= SMALL_PLAN) return [screen('coverage', 'How we prove it')];
  return [
    screen('e2e', 'End-to-end tests over the flows'),
    screen('contracts', 'Contract tests'),
    screen('coverage', 'Coverage'),
  ];
}
const CATALOGUES: readonly (readonly [string, string, readonly string[]])[] = [
  ['all', 'All records', []],
  ['services', 'Components', ['service', 'app', 'library']],
  ['stores', 'Stores and topics', ['store', 'topic']],
  ['apis', 'APIs', ['interface', 'endpoint']],
  ['schemas', 'Schemas', ['schema', 'field']],
  ['events', 'Events', ['message']],
  ['flows', 'Flows', ['flow']],
  ['screens', 'Screens', ['screen', 'region']],
  ['operations', 'Operations', ['operation']],
  ['ledger', 'Changes', ['change']],
  ['tests', 'Tests', ['test']],
  ['work', 'Work items', ['workItem']],
  ['milestones', 'Milestones', ['milestone']],
  ['risks', 'Risks', ['risk']],
  ['teams', 'Teams', ['team']],
  ['decisions', 'Decisions', ['decision']],
  ['boundaries', 'External parties and unmapped systems', ['external', 'system']],
  ['subscriptions', 'Subscriptions and jobs', ['subscription', 'job']],
  ['concepts', 'Concepts', ['concept', 'keyTerm']],
  ['questions', 'Questions and requirements', ['question', 'requirement']],
];
function versionScreens(plan: ModelPlan): readonly ScreenRef[] {
  const entries = plan.meta.revisions ?? [];
  return entries.length === 0
    ? []
    : [
        screen('history', 'Every version'),
        ...entries
          .toReversed()
          .map((entry) => screen(`v${entry.version}`, `${entry.version} · ${entry.status}`)),
      ];
}
function whyScreens(plan: ModelPlan): readonly ScreenRef[] {
  return [
    screen('problem', 'The problem'),
    screen('promise', 'What we promise'),
    ...((plan.problem.scenarios?.length ?? 0) > 0 ? [screen('scenarios', 'Scenarios')] : []),
  ];
}
function screensOf(plan: ModelPlan, chapter: ChapterKey, label: FlowName): readonly ScreenRef[] {
  switch (chapter) {
    case 'cover': {
      return [screen('cover', 'Cover'), screen('part', 'Your part')];
    }
    case 'why': {
      return whyScreens(plan);
    }
    case 'today': {
      return [
        screen('domain', 'The domain'),
        screen('system', 'The system map'),
        screen('graph', 'The graph'),
        screen('screens', 'What people see today'),
      ];
    }
    case 'journey': {
      return storyScreens(plan, label);
    }
    case 'changes': {
      return changeScreens(plan, label);
    }
    case 'prove': {
      return proveScreens(plan);
    }
    case 'build': {
      return [
        screen('build-order', 'Build order'),
        screen('work-by-team', 'Work by team'),
        screen('progress', 'Delivery progress'),
      ];
    }
    case 'commit': {
      return [
        screen('choices', 'The choices'),
        screen('risks', 'Risks'),
        screen('ask', 'Still to settle'),
      ];
    }
    case 'ref': {
      return CATALOGUES.map(([key, title]) => screen(key, title));
    }
    case 'versions': {
      return versionScreens(plan);
    }
  }
}
function outlineFrom(plan: ModelPlan | null, at: PlanAddress, lookup: FlowName): Outline {
  if (plan === null) return planOutline('', at, () => []);
  const label = flowNames(plan, lookup);
  return planOutline(plan.meta.title, at, (chapter) => screensOf(plan, chapter, label));
}
/** The native outline uses actual plan metadata and both supplied model indexes. */
export function modelPlanOutline(context: ModelQueryContext, at: PlanAddress): Outline {
  return outlineFrom(
    context.plan,
    at,
    (id) => indexFlowName(context.afterIndex, id) ?? indexFlowName(context.beforeIndex, id),
  );
}
/** Route proof needs only actual current identities and declared additions, not eight large plan projections. */
export function modelPlanOutlineFromCurrent(
  plan: ModelPlan,
  at: PlanAddress,
  current: ModelIndex,
): Outline {
  return outlineFrom(plan, at, (id) => indexFlowName(current, id));
}
function containsTarget(index: ModelIndex, parent: string, id: string): boolean {
  let node = index.get(id);
  while (node !== null) {
    if (node.id === parent) return true;
    node = node.parent === null ? null : index.get(node.parent);
  }
  return parent === id;
}
/** A pin points to a real change screen only through an explicit operation target. */
export function modelAheadStop(
  context: ModelQueryContext,
  at: PlanAddress,
  id: string,
): AheadStop | null {
  const outline = modelPlanOutline(context, at);
  const pages = outline.pages.filter((page) => page.chapter === 'changes');
  const change = context.plan?.changes.find((entry) =>
    (entry.ops ?? []).some((op) => {
      const target = modelPlanOpTarget(op);
      return (
        containsTarget(context.beforeIndex, target, id) ||
        containsTarget(context.afterIndex, target, id)
      );
    }),
  );
  const page = pages.find(
    (entry) => entry.screen === (change === undefined ? 'ledger' : keyOf(change.id)),
  );
  return page === undefined
    ? null
    : { href: page.href, title: page.title, position: `4.${String(pages.indexOf(page) + 1)}` };
}
function recordOf(value: unknown, title: string): readonly ModelPlanRecord[] {
  const data = modelRecord(value);
  if (data === null) return [];
  return [
    { id: modelText(data.id), title: modelText(data.title) ?? modelText(data.name) ?? title, data },
  ];
}
const block = (title: string, values: readonly unknown[], summary = false): ModelPlanBlock => ({
  title,
  summary,
  records: values.flatMap((value, position) => recordOf(value, `${title} ${String(position + 1)}`)),
});
function modelRecords(
  index: ModelIndex,
  kinds: readonly string[],
  ids?: readonly string[],
): readonly unknown[] {
  return index.entities
    .filter((node) => kinds.includes(node.kind) && (ids === undefined || ids.includes(node.id)))
    .map((node) => node.data);
}
function whyBlocks(plan: ModelPlan, page: Page): readonly ModelPlanBlock[] {
  if (page.screen === 'scenarios') return [block('Scenarios', plan.problem.scenarios ?? [])];
  if (page.screen === 'promise') {
    return [
      block('What we promise', [
        {
          goals: plan.problem.goals ?? [],
          non_goals: plan.problem.non_goals ?? [],
          appetite: plan.meta.appetite ?? null,
          metrics: plan.problem.metrics ?? [],
        },
      ]),
    ];
  }
  return [block('The problem', [plan.problem])];
}
function journeyBlocks(plan: ModelPlan, page: Page): readonly ModelPlanBlock[] {
  if (page.screen === 'empty') {
    return [
      block('Journey evidence', [{ summary: 'No authored journey is recorded for this plan.' }]),
    ];
  }
  const stage = plan.story?.stages?.find((entry) => keyOf(entry.id) === page.screen);
  const scenario = plan.problem.scenarios?.find((entry) => keyOf(entry.id) === page.screen);
  if (stage !== undefined) return [block('Plan-local stage', [stage])];
  if (scenario !== undefined) return [block('Planned scenario', [scenario])];
  if (page.screen === 'execution') {
    return [block('How it plays out', plan.execution === undefined ? [] : [plan.execution])];
  }
  return [
    block('The story', plan.story === undefined ? [] : [plan.story]),
    block('Execution', plan.execution === undefined ? [] : [plan.execution]),
  ];
}
function versionBlocks(
  plan: ModelPlan,
  page: Page,
  snapshots: readonly ModelPlanSnapshot[],
): readonly ModelPlanBlock[] {
  if (page.screen === 'history') {
    return [block('Revision ledger', (plan.meta.revisions ?? []).toReversed())];
  }
  const version = (plan.meta.revisions ?? []).find((entry) => `v${entry.version}` === page.screen);
  const snapshot = snapshots.find((entry) => `v${entry.version}` === page.screen);
  return [
    block('Recorded revision', version === undefined ? [] : [version]),
    block('Saved plan snapshot', snapshot === undefined ? [] : [snapshot.plan]),
  ];
}
const TODAY_KINDS: Readonly<Record<string, readonly string[]>> = {
  domain: ['concept', 'keyTerm'],
  graph: ['graph', 'subgraph'],
  screens: ['screen'],
};
function domainIntroductions(context: ModelQueryContext, index: ModelIndex): readonly unknown[] {
  const domains = new Set(
    modelPlanFocus(context).flatMap((id) => {
      const node = index.get(id);
      if (node?.kind === 'domain') return [node.id];
      const domain = node?.place.domain;
      return domain === null || domain === undefined ? [] : [domain];
    }),
  );
  return index.entities
    .filter((node) => node.kind === 'domain' && domains.has(node.id))
    .map((node) =>
      Object.fromEntries(
        Object.entries(node.data).filter(([key]) =>
          ['id', 'name', 'purpose', 'cites'].includes(key),
        ),
      ),
    );
}
function todayBlocks(
  context: ModelQueryContext,
  index: ModelIndex,
  page: Page,
): readonly ModelPlanBlock[] {
  const records = modelRecords(index, TODAY_KINDS[page.screen] ?? []);
  if (page.screen === 'domain') {
    return [block('Domains', domainIntroductions(context, index)), block('Concepts', records)];
  }
  return [block(page.title, records)];
}
function coverBlocks(plan: ModelPlan): readonly ModelPlanBlock[] {
  return [
    block('Plan metadata', [plan.meta]),
    block('What this plan changes', plan.changes, true),
    block('Dependencies', [{ builds_on: plan.builds_on ?? [] }]),
  ];
}
function scopedChanges(
  plan: ModelPlan,
  index: ModelIndex,
  accept: (id: string) => boolean,
  title: string,
  showFacts: boolean,
): readonly ModelPlanBlock[] {
  const selected = plan.changes.filter((change) =>
    (change.ops ?? []).some((op) => accept(modelPlanOpTarget(op))),
  );
  const ids = [
    ...new Set(
      operationTargets(plan)
        .filter(accept)
        .map((id) => rootId(id)),
    ),
  ];
  const facts = ids.flatMap((id) => {
    const node = index.get(id);
    return node === null ? [] : [node.data];
  });
  return [
    ...(showFacts ? [block(title, facts)] : []),
    block('Full change records', selected, true),
  ];
}
function changeBlocks(plan: ModelPlan, index: ModelIndex, page: Page): readonly ModelPlanBlock[] {
  const change = plan.changes.find((entry) => keyOf(entry.id) === page.screen);
  if (change !== undefined) return [block('Changes', [change])];
  if (page.screen === 'contracts') {
    return scopedChanges(plan, index, isContractTarget, 'Affected contracts', true);
  }
  if (page.screen === 'more') {
    return scopedChanges(plan, index, (id) => !isFlowTarget(id), 'Other affected records', true);
  }
  const flows = changedFlowIds(plan);
  if (page.screen === 'flows') return scopedChanges(plan, index, isFlowTarget, 'Flows', false);
  const flow = flows.find((id) => keyOf(id) === page.screen);
  if (flow !== undefined) {
    return scopedChanges(plan, index, (id) => rootId(id) === flow, 'Flow', false);
  }
  return [block('Changes', plan.changes, true)];
}
function buildBlocks(plan: ModelPlan): readonly ModelPlanBlock[] {
  return [block('Work items', plan.work_items ?? []), block('Milestones', plan.milestones ?? [])];
}
function commitBlocks(plan: ModelPlan, page: Page): readonly ModelPlanBlock[] {
  if (page.screen === 'choices') return [block(page.title, plan.decisions ?? [])];
  if (page.screen === 'risks') return [block(page.title, plan.risks ?? [])];
  return [block(page.title, plan.questions ?? [])];
}
function proveBlocks(plan: ModelPlan, page: Page): readonly ModelPlanBlock[] {
  const tests = plan.tests ?? [];
  if (page.screen === 'e2e') {
    return [
      block(
        'End-to-end tests',
        tests.filter((test) => test.level === 'e2e'),
      ),
    ];
  }
  if (page.screen === 'contracts') {
    return [
      block(
        'Contract tests',
        tests.filter((test) => test.level === 'contract'),
      ),
    ];
  }
  return [block('Tests', tests)];
}
function chapterBlocks(
  context: ModelQueryContext,
  page: Page,
  index: ModelIndex,
  snapshots: readonly ModelPlanSnapshot[],
): readonly ModelPlanBlock[] {
  const plan = context.plan;
  if (plan === null) return [];
  switch (page.chapter) {
    case 'cover': {
      return coverBlocks(plan);
    }
    case 'why': {
      return whyBlocks(plan, page);
    }
    case 'today': {
      return todayBlocks(context, index, page);
    }
    case 'journey': {
      return journeyBlocks(plan, page);
    }
    case 'changes': {
      return changeBlocks(plan, index, page);
    }
    case 'prove': {
      return proveBlocks(plan, page);
    }
    case 'build': {
      return buildBlocks(plan);
    }
    case 'commit': {
      return commitBlocks(plan, page);
    }
    case 'versions': {
      return versionBlocks(plan, page, snapshots);
    }
    case 'ref': {
      return [];
    }
  }
}
const STORY_CHAPTER: Readonly<Partial<Record<ChapterKey, string>>> = {
  why: 'why',
  today: 'today',
  journey: 'runs',
  changes: 'changes',
  prove: 'prove',
  build: 'build',
  commit: 'commit',
};
function chapterWords(
  plan: ModelPlan,
  page: Page,
): { readonly headline: string; readonly recap: readonly string[] } {
  const key = STORY_CHAPTER[page.chapter];
  const chapter = key === undefined ? null : modelRecord(modelRecord(plan.story?.chapters)?.[key]);
  return {
    headline: modelText(chapter?.headline) ?? page.title,
    recap: modelList(chapter?.recap).flatMap((value) => (typeof value === 'string' ? [value] : [])),
  };
}
function flowIdsOn(context: ModelQueryContext, page: Page): readonly string[] {
  const plan = context.plan;
  if (plan === null) return [];
  if (page.chapter === 'changes') {
    const flows = changedFlowIds(plan);
    return page.screen === 'flows' ? flows : flows.filter((id) => keyOf(id) === page.screen);
  }
  if (page.chapter !== 'journey') return [];
  const selected =
    plan.problem.scenarios?.find((entry) => keyOf(entry.id) === page.screen) ??
    plan.story?.stages?.find((entry) => keyOf(entry.id) === page.screen);
  if (selected !== undefined) return selected.flows ?? [];
  const lookup = flowNames(
    plan,
    (id) => indexFlowName(context.afterIndex, id) ?? indexFlowName(context.beforeIndex, id),
  );
  return knownFlowIds(plan, lookup).filter((id) => keyOf(id) === page.screen);
}
/** Only the requested screen's records are materialised; browser models remain on demand. */
export function modelPlanScreen(
  context: ModelQueryContext,
  page: Page,
  options: {
    readonly before?: boolean;
    readonly snapshots?: readonly ModelPlanSnapshot[];
    readonly progress?: ModelPlanProgress;
  } = {},
): ModelPlanScreen {
  const before = options.before ?? page.chapter === 'today';
  const index = before ? context.beforeIndex : context.afterIndex;
  const plan = context.plan;
  const kinds = CATALOGUES.find(([key]) => key === page.screen)?.[2] ?? [];
  const catalogue =
    page.chapter === 'ref'
      ? modelInspectionRecords(context)
          .filter((record) => kinds.length === 0 || kinds.includes(record.kind))
          .filter(
            (record) =>
              page.screen !== 'boundaries' ||
              record.kind !== 'system' ||
              record.data.mapped === false,
          )
          .map(({ id, label, kind }) => ({ id, label, kind }))
      : [];
  return {
    page,
    ...(plan === null ? { headline: page.title, recap: [] } : chapterWords(plan, page)),
    blocks: chapterBlocks(context, page, index, options.snapshots ?? []),
    map: page.screen === 'system' && ['today', 'changes'].includes(page.chapter),
    flowIds: flowIdsOn(context, page),
    catalogue,
  };
}
function barVersions(plan: ModelPlan, outline: Outline): PlanBar['versions'] {
  const revisions = plan.meta.revisions ?? [];
  if (plan.meta.version === undefined && revisions.length === 0) return null;
  const inForce = revisions.findLast((entry) => entry.status === 'approved')?.version;
  const own = plan.meta.version;
  const proposed = revisions.find((entry) => entry.version === own)?.status === 'proposed';
  const suffix = proposed ? ' proposed' : '';
  const label = own === undefined ? 'Versions' : `v${own}${suffix}`;
  return {
    label,
    items: revisions.toReversed().map((entry) => ({
      version: entry.version,
      state: entry.status === 'approved' && entry.version !== inForce ? 'superseded' : entry.status,
      date: entry.date,
      summary: entry.summary ?? '',
      href: pageHref(outline, 'versions', `v${entry.version}`),
    })),
    historyHref: revisions.length === 0 ? null : pageHref(outline, 'versions', 'history'),
  };
}
/** The bar uses explicit lifecycle and revision records; a version number never implies acceptance. */
export function modelPlanBar(context: ModelQueryContext, outline: Outline): PlanBar {
  const plan = context.plan;
  const status = plan?.meta.status ?? 'draft';
  const words = {
    draft: 'Draft',
    review: 'In review',
    approved: 'Approved',
    committed: 'Committed',
  } as const;
  return {
    stage: { word: words[status], tone: status === 'approved' ? 'added' : 'neutral' },
    teams: context.afterIndex.entities
      .filter((node) => node.kind === 'team')
      .map((node) => ({ id: node.id, name: context.afterIndex.label(node.id) })),
    versions: plan === null ? null : barVersions(plan, outline),
  };
}

/** Focus follows recorded containment of changed targets and declared story scope, never ownership. */
export function modelPlanFocus(context: ModelQueryContext): readonly string[] {
  const plan = context.plan;
  if (plan === null) return [];
  const ids = [
    ...(plan.story?.scope ?? []),
    ...plan.changes.flatMap((change) => (change.ops ?? []).map(modelPlanOpTarget)),
  ];
  return [
    ...new Set(
      ids.flatMap((id) => {
        const node = context.afterIndex.get(id) ?? context.beforeIndex.get(id);
        if (node === null) return [];
        if (['domain', 'system', 'external'].includes(node.kind)) return [node.id];
        return node.place.system === null ? [] : [node.place.system];
      }),
    ),
  ];
}
