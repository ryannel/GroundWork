import 'server-only';

import { indexOf, type ModelIndex } from '@/application/model-index';
import { planStoryProblems } from '@/application/plan-story';
import {
  inheritedPlanOrder,
  plansIndex,
  type IndexedPlan,
  type ProposedEffect,
} from '@/application/plans-index';
import { programmeDeciderProblems } from '@/application/programme-deciders';
import { hasPrefix, rootId } from '@/domain/ids';
import {
  modelText,
  type ModelPlan,
  type ModelDomain,
  type ModelSystem,
  type WorkspaceModel,
} from '@/domain/workspace-model';

import { modelProblems, projectionModelValidator, resolvedModelValidator } from './model-schema';

type Definition =
  | 'WorkspaceFile'
  | 'DomainFile'
  | 'SystemFile'
  | 'ContractsFile'
  | 'ScreensFile'
  | 'HandlersFile'
  | 'NarrativesFile'
  | 'DomainLanguageFile'
  | 'TargetFile'
  | 'LibrariesFile'
  | 'ExternalsFile'
  | 'AliasesFile'
  | 'LanguageFile'
  | 'LandscapeFile'
  | 'GraphFile'
  | 'FlowFile'
  | 'JourneyFile'
  | 'ProgrammeFile';
export interface ModelProblem {
  readonly at: string;
  readonly message: string;
}
interface Fragment {
  readonly definition: Definition;
  readonly value: unknown;
  readonly at: string;
}
const CONTRACTS = [
  'interfaces',
  'messages',
  'subscriptions',
  'jobs',
  'interactions',
  'operations',
  'schemas',
] as const;
function without(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): Readonly<Record<string, unknown>> {
  const omitted = new Set(keys);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.has(key)));
}
function systemFragments(system: ModelSystem): readonly Fragment[] {
  return [
    {
      definition: 'SystemFile',
      value: without(system, [...CONTRACTS, 'screens', 'handlers', 'narratives']),
      at: system.id,
    },
    {
      definition: 'ContractsFile',
      value: Object.fromEntries(CONTRACTS.map((key) => [key, system[key]])),
      at: system.id,
    },
    { definition: 'ScreensFile', value: { screens: system.screens }, at: system.id },
    { definition: 'HandlersFile', value: system.handlers, at: system.id },
    ...(system.narratives === null
      ? []
      : [{ definition: 'NarrativesFile' as const, value: system.narratives, at: system.id }]),
  ];
}
function domainFragments(domain: ModelDomain): readonly Fragment[] {
  return [
    {
      definition: 'DomainFile',
      value: without(domain, ['systems', 'language', 'target']),
      at: domain.id,
    },
    ...(domain.language === null
      ? []
      : [{ definition: 'DomainLanguageFile' as const, value: domain.language, at: domain.id }]),
    ...(domain.target === null
      ? []
      : [{ definition: 'TargetFile' as const, value: domain.target, at: domain.id }]),
    ...domain.systems.flatMap(systemFragments),
  ];
}
function fragments(model: WorkspaceModel): readonly Fragment[] {
  return [
    {
      definition: 'WorkspaceFile',
      value: without(model, [
        'domains',
        'libraries',
        'externals',
        'graphs',
        'flows',
        'journeys',
        'programmes',
        'language',
        'landscape',
        'aliases',
        'evidence',
        'problems',
      ]),
      at: model.id,
    },
    { definition: 'LibrariesFile', value: { libraries: model.libraries }, at: model.id },
    { definition: 'ExternalsFile', value: { externals: model.externals }, at: model.id },
    { definition: 'AliasesFile', value: model.aliases, at: model.id },
    ...(model.language === null
      ? []
      : [{ definition: 'LanguageFile' as const, value: model.language, at: model.id }]),
    ...(model.landscape === null
      ? []
      : [{ definition: 'LandscapeFile' as const, value: model.landscape, at: model.id }]),
    ...model.graphs.map((value): Fragment => ({ definition: 'GraphFile', value, at: value.id })),
    ...model.flows.map((value): Fragment => ({ definition: 'FlowFile', value, at: value.id })),
    ...model.journeys.map((value): Fragment => ({
      definition: 'JourneyFile',
      value,
      at: value.id,
    })),
    ...model.programmes.map((value): Fragment => ({
      definition: 'ProgrammeFile',
      value,
      at: value.id,
    })),
    ...model.domains.flatMap(domainFragments),
  ];
}
function queueProblems(index: ModelIndex): readonly ModelProblem[] {
  return index.entities.flatMap((node) => {
    if (
      node.kind !== 'schema' &&
      (node.kind !== 'step' || index.get(rootId(node.id))?.kind !== 'handler')
    ) {
      return [];
    }
    const keys =
      node.kind === 'schema'
        ? ['store']
        : [
            ...(node.data.read === undefined ? [] : ['from']),
            ...(node.data.write === undefined ? [] : ['to']),
          ];
    return keys.flatMap((key) => {
      const target = modelText(node.data[key]);
      if (target === null || !hasPrefix(target, 'top')) return [];
      const component = index.get(target);
      return component?.kind === 'topic' && component.data.form === 'queue'
        ? []
        : [
            {
              at: `${node.id}/${key}`,
              message: 'Record access requires a declared queue, not a stream or missing topic.',
            },
          ];
    });
  });
}
function interfaceSystemProblems(index: ModelIndex): readonly ModelProblem[] {
  return index.entities.flatMap((node) => {
    const target = node.kind === 'interface' ? modelText(node.data.system) : null;
    if (target === null) return [];
    const system = index.get(target);
    return system?.kind === 'system' && system.data.mapped === false
      ? []
      : [
          {
            at: `${node.id}/system`,
            message:
              'A system-level interface provider must reference a declared unmapped system (mapped: false).',
          },
        ];
  });
}
function operationClientProblems(index: ModelIndex): readonly ModelProblem[] {
  return index.entities.flatMap((node) => {
    const target = node.kind === 'operation' ? modelText(node.data.component) : null;
    if (target === null) return [];
    const component = index.get(target);
    return component !== null && ['service', 'app'].includes(component.kind)
      ? []
      : [
          {
            at: `${node.id}/component`,
            message: 'A supplied operation client must reference a declared executable component.',
          },
        ];
  });
}
/** Recheck an applied model with the original contracts, after citation resolution. */
async function validateFragments(
  model: WorkspaceModel,
  profile: 'current' | 'plan',
): Promise<readonly ModelProblem[]> {
  const checks = await Promise.all(
    fragments(model).map(async ({ definition, value, at }) => {
      const check =
        profile === 'current'
          ? await resolvedModelValidator(definition)
          : await projectionModelValidator(definition);
      return check(value)
        ? []
        : (check.errors ?? []).map((error) => ({
            at: `${at}${error.instancePath}`,
            message: error.message ?? 'Invalid model value.',
          }));
    }),
  );
  const problems = checks.flat();
  if (problems.length > 0) return problems;
  try {
    const index = indexOf(model);
    return [
      ...queueProblems(index),
      ...interfaceSystemProblems(index),
      ...operationClientProblems(index),
      ...model.programmes.flatMap((programme) =>
        programmeDeciderProblems(programme, (id) => index.get(id)?.kind === 'team').map(
          ({ path: segments, message }) => ({
            at: `${programme.id}/${segments.join('/')}`,
            message,
          }),
        ),
      ),
    ];
  } catch (error) {
    return [{ at: model.id, message: error instanceof Error ? error.message : String(error) }];
  }
}

/** Current facts always retain the strict implementation-evidence requirement. */
export async function validateModel(model: WorkspaceModel): Promise<readonly ModelProblem[]> {
  const proposals = model.problems.filter((gap) => gap.kind === 'proposed_effect');
  if (proposals.length > 0) {
    return proposals.map((gap) => ({
      at: gap.id,
      message:
        'Proposed behaviour requires implementation evidence before it can become current facts.',
    }));
  }
  return validateFragments(model, 'current');
}
export interface PlanProjectionCheck {
  readonly projection: IndexedPlan | null;
  readonly problems: readonly ModelProblem[];
}
/** Validate the strict base and compute the projection here; callers cannot submit an arbitrary after model. */
export async function validatePlanProjection(
  plan: ModelPlan,
  before: WorkspaceModel,
): Promise<PlanProjectionCheck> {
  const baseProblems = await validateModel(before);
  if (baseProblems.length > 0) return { projection: null, problems: baseProblems };
  const planProblems = await modelProblems('plan', 'document', plan);
  if (planProblems.length > 0) {
    return {
      projection: null,
      problems: planProblems.map((error) => ({
        at: `${plan.meta.id}${error.path}`,
        message: error.message,
      })),
    };
  }
  return projectedPlan(plan, before);
}

/** Used only after the public boundary has checked the strict current base and the plan schema. */
async function projectedPlan(
  plan: ModelPlan,
  before: WorkspaceModel,
): Promise<PlanProjectionCheck> {
  try {
    const projection = plansIndex([plan], before).plans[0];
    if (projection === undefined) throw new Error('The selected plan projection is missing.');
    const problems = [
      ...(await validateFragments(projection.after, 'plan')),
      ...planStoryProblems(plan, projection.beforeIndex, projection.afterIndex),
    ];
    return { projection: problems.length === 0 ? projection : null, problems };
  } catch (error) {
    return {
      projection: null,
      problems: [
        { at: plan.meta.id, message: error instanceof Error ? error.message : String(error) },
      ],
    };
  }
}

interface CheckedModelPlan {
  readonly id: string;
  readonly problems: readonly ModelProblem[];
  readonly proposals: readonly ProposedEffect[];
}
interface PlanBatchCheck {
  readonly plans: readonly CheckedModelPlan[];
  readonly problems: readonly ModelProblem[];
}
/** A stored before model is strict historical current, never inherited proposed context. */
async function frozenPlanCheck(
  plan: ModelPlan,
  frozen: WorkspaceModel,
): Promise<Pick<CheckedModelPlan, 'problems' | 'proposals'>> {
  const problems = await validateModel(frozen);
  if (problems.length > 0) return { problems, proposals: [] };
  const result = await projectedPlan(plan, frozen);
  return { problems: result.problems, proposals: result.projection?.proposals ?? [] };
}

export interface PlanValidationOptions {
  readonly frozenBases?: ReadonlyMap<string, WorkspaceModel>;
  readonly selected?: readonly string[];
}
/** Check current once, then validate each explicit proposed stack without retaining every large model. */
export async function validatePlanProjections(
  plans: readonly ModelPlan[],
  current: WorkspaceModel,
  options: PlanValidationOptions = {},
): Promise<PlanBatchCheck> {
  const currentProblems = await validateModel(current);
  if (currentProblems.length > 0) return { plans: [], problems: currentProblems };
  const registry = new Map(plans.map((plan) => [plan.meta.id, plan]));
  if (registry.size !== plans.length) {
    return { plans: [], problems: [{ at: current.id, message: 'Duplicate plan identity.' }] };
  }
  const checked = new Map<string, CheckedModelPlan>();
  const landed =
    options.frozenBases === undefined ? undefined : new Set(options.frozenBases.keys());
  const inspect = async (plan: ModelPlan): Promise<CheckedModelPlan> => {
    const existing = checked.get(plan.meta.id);
    if (existing !== undefined) return existing;
    const record = (
      problems: readonly ModelProblem[],
      proposals: readonly ProposedEffect[] = [],
    ): CheckedModelPlan => {
      const result = { id: plan.meta.id, problems, proposals };
      checked.set(plan.meta.id, result);
      return result;
    };
    try {
      const schema = await modelProblems('plan', 'document', plan);
      if (schema.length > 0) {
        return record(
          schema.map((error) => ({ at: `${plan.meta.id}${error.path}`, message: error.message })),
        );
      }
      const frozen = options.frozenBases?.get(plan.meta.id);
      if (frozen !== undefined) {
        const result = await frozenPlanCheck(plan, frozen);
        return record(result.problems, result.proposals);
      }
      const ancestors = inheritedPlanOrder(plan, registry, landed);
      const failed = await ancestors.reduce<Promise<CheckedModelPlan | null>>(
        async (previous, ancestor) => {
          const failure = await previous;
          if (failure !== null) return failure;
          const result = await inspect(ancestor);
          return result.problems.length > 0 ? result : null;
        },
        Promise.resolve(null),
      );
      if (failed !== null) {
        return record([
          { at: plan.meta.id, message: `Plan dependency ${failed.id} failed validation.` },
        ]);
      }
      let before = current;
      const proposals: ProposedEffect[] = [];
      for (const ancestor of ancestors) {
        const inherited = plansIndex([ancestor], before).plans[0];
        if (inherited === undefined) {
          throw new Error(`Missing ancestor projection: ${ancestor.meta.id}.`);
        }
        before = inherited.after;
        proposals.push(...inherited.proposals);
      }
      const result = await projectedPlan(plan, before);
      return record(result.problems, [...proposals, ...(result.projection?.proposals ?? [])]);
    } catch (error) {
      return record([
        { at: plan.meta.id, message: error instanceof Error ? error.message : String(error) },
      ]);
    }
  };
  const selected =
    options.selected === undefined
      ? plans
      : plans.filter((plan) => options.selected?.includes(plan.meta.id) === true);
  await selected.reduce(async (previous, plan) => {
    await previous;
    await inspect(plan);
  }, Promise.resolve());
  const results = plans.flatMap((plan) => checked.get(plan.meta.id) ?? []);
  return { plans: results, problems: results.flatMap((result) => result.problems) };
}
