import { readinessEntryErrors } from './readiness-entries';
import { readinessInterpretationErrors } from './readiness-interpretation';
import { readinessRosterErrors, sameReadinessRoster } from './readiness-rosters';
import type {
  RepositoryReadiness,
  RepositoryReadinessInput,
  WorkflowCapability,
} from './repository-readiness-types';

export type { RepositoryReadiness, RepositoryReadinessInput } from './repository-readiness-types';
const CAPABILITIES: readonly WorkflowCapability[] = [
  'stop_resume',
  'incremental_add',
  'incremental_modify',
  'incremental_delete',
  'incremental_rename',
  'policy_invalidation',
  'source_budget',
  'edge_identity_stability',
];
function workflowErrors(input: RepositoryReadinessInput): readonly string[] {
  const errors: string[] = [];
  if (
    !sameReadinessRoster(
      input.workflow.map((entry) => entry.capability),
      CAPABILITIES,
    ) ||
    input.workflow.some(
      (entry) =>
        !entry.passed ||
        !Number.isSafeInteger(entry.cases) ||
        entry.cases < 1 ||
        entry.evidence.trim().length === 0,
    )
  ) {
    errors.push(
      'Positive verified workflow evidence is required for every stop, delta, policy, budget and identity capability.',
    );
  }
  if (input.budgetStatus !== 'within_bounds') {
    errors.push(
      'Unknown or exceeded enforced source/query/materialisation budget cannot establish readiness.',
    );
  }
  if (
    ![input.sourceUsage.phase].includes('deterministic_source') ||
    input.sourceUsage.calls !== 0 ||
    input.sourceUsage.tokens !== 0
  ) {
    errors.push('Source usage must describe only the deterministic zero-model extraction phase.');
  }
  return errors;
}
/** Pure acceptance only. It never starts a scan or changes the wider queue's authorisation. */
export function assessRepositoryReadiness(input: RepositoryReadinessInput): RepositoryReadiness {
  const blockers = [
    ...readinessRosterErrors(input),
    ...readinessEntryErrors(input),
    ...workflowErrors(input),
    ...readinessInterpretationErrors(input),
  ];
  const ready = blockers.length === 0;
  return {
    readiness: ready ? 'ready_for_bounded_repository_pass' : 'not_ready',
    fullscanWorkflowReady: ready,
    blockers,
    counts: {
      supported: input.questions.filter((question) => question.status === 'source-supported')
        .length,
      partial: input.questions.filter((question) => question.status === 'partial').length,
      unsupported: input.questions.filter((question) => question.status === 'unsupported').length,
    },
    wider_scans: 'stopped_not_authorised',
    modelBudget:
      input.interpretation.document.runs.length > 0 &&
      input.interpretation.document.runs.every((run) => run.usage.state === 'measured')
        ? 'measured'
        : 'unmetered',
  };
}
