// The words and orders the plan model reads with: how an entity type is said aloud, how heavy a work item is,
// which test levels there are and the chapters of a plan's story.
import type { EntityType } from '@/domain/plan/plan-ids';

export const TYPE_WORDS: Readonly<Record<EntityType, string>> = {
  team: 'team',
  system: 'system',
  service: 'service',
  store: 'store',
  schema: 'schema',
  field: 'field',
  interface: 'interface',
  endpoint: 'endpoint',
  message: 'message',
  flow: 'flow',
  step: 'step',
  change: 'change',
  test: 'test',
  workItem: 'work item',
  milestone: 'milestone',
  decision: 'decision',
  risk: 'risk',
  question: 'question',
  scenario: 'scenario',
  concept: 'concept',
  stage: 'stage',
  screen: 'screen',
  region: 'region',
  graph: 'graph',
  subgraph: 'subgraph',
  operation: 'operation',
  interaction: 'interaction',
  userJourney: 'user journey',
  handler: 'handler',
};

export const SIZE_WEIGHT = { XS: 1, S: 2, M: 3, L: 4, XL: 5 } as const;

/** Test levels in matrix column order. */
export const TEST_LEVELS = ['unit', 'service', 'contract', 'integration', 'e2e'] as const;

/** Story chapter keys in reading order. */
export const CHAPTERS = [
  'why',
  'today',
  'runs',
  'new',
  'changes',
  'prove',
  'build',
  'commit',
] as const;
export type Chapter = (typeof CHAPTERS)[number];
