import 'server-only';

import { indexOf } from '@/application/model-index';
import type { ModelDomain, ModelSystem, WorkspaceModel } from '@/domain/workspace-model';

import { resolvedModelValidator } from './model-schema';

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
/** Recheck an applied model with the original contracts, after citation resolution. */
export async function validateModel(model: WorkspaceModel): Promise<readonly ModelProblem[]> {
  const checks = await Promise.all(
    fragments(model).map(async ({ definition, value, at }) => {
      const check = await resolvedModelValidator(definition);
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
    indexOf(model);
  } catch (error) {
    return [{ at: model.id, message: error instanceof Error ? error.message : String(error) }];
  }
  return [];
}
