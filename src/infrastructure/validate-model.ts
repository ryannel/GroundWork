import 'server-only';

import { indexOf, type ModelIndex } from '@/application/model-index';
import { plansIndex, type IndexedPlan } from '@/application/plans-index';
import { hasPrefix } from '@/domain/ids';
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
    const keys = node.kind === 'schema' ? ['store'] : ['from', 'to'];
    if (!['schema', 'step'].includes(node.kind)) return [];
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
    return queueProblems(indexOf(model));
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
  try {
    const projection = plansIndex([plan], before).plans[0];
    if (projection === undefined) throw new Error('The selected plan projection is missing.');
    const problems = await validateFragments(projection.after, 'plan');
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
