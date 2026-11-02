import type { ReadinessBenchmark, RepositoryReadinessInput } from './repository-readiness-types';

export function sameReadinessRoster(
  observed: readonly string[],
  expected: readonly string[],
): boolean {
  return [
    expected.length > 0,
    new Set(expected).size === expected.length,
    new Set(observed).size === observed.length,
    observed.length === expected.length,
    observed.every((id) => id.trim().length > 0 && expected.includes(id)),
  ].every(Boolean);
}
function benchmarkScope(scope: ReadinessBenchmark, expected: readonly string[]): boolean {
  const phases = [
    scope.phases.cold,
    scope.phases.warm,
    scope.phases.rulesChanged,
    scope.phases.parserChanged,
  ];
  return [
    scope.integrityPassed,
    scope.reusePassed,
    phases.every(
      (phase) =>
        sameReadinessRoster(
          phase.map((check) => check.id),
          expected,
        ) && phase.every((check) => check.status === 'supported'),
    ),
    sameReadinessRoster(
      scope.mutations.map((mutation) => mutation.checkId),
      expected,
    ),
    scope.mutations.every((mutation) =>
      [
        mutation.applied,
        mutation.baseline === 'supported',
        ['failed', 'unresolved'].includes(mutation.mutated),
      ].every(Boolean),
    ),
  ].every(Boolean);
}
function frozenExpectations(input: RepositoryReadinessInput): boolean {
  const scopes = input.expectations.scopeChecks.map((scope) => scope.scopeId);
  const checks = input.expectations.scopeChecks.flatMap((scope) => scope.checkIds);
  return [
    scopes.length === 3,
    checks.length === 19,
    new Set(checks).size === 19,
    sameReadinessRoster(scopes, scopes),
    checks.every((id) => id.trim().length > 0),
  ].every(Boolean);
}
export function readinessRosterErrors(input: RepositoryReadinessInput): readonly string[] {
  const expected = input.expectations;
  const scopes = expected.scopeChecks.map((scope) => scope.scopeId);
  const errors: string[] = [];
  if (!frozenExpectations(input)) {
    errors.push(
      'Frozen benchmark expectations must contain three unique scopes and nineteen unique checks.',
    );
  }
  if (
    !sameReadinessRoster(
      input.benchmark.map((scope) => scope.scopeId),
      scopes,
    )
  ) {
    errors.push('Benchmark scope roster is incomplete or duplicated.');
  }
  for (const scope of expected.scopeChecks) {
    const observed = input.benchmark.find((candidate) => candidate.scopeId === scope.scopeId);
    if (!observed || !benchmarkScope(observed, scope.checkIds)) {
      errors.push(
        `${scope.scopeId}: benchmark phases, mutations, integrity or reuse are incomplete.`,
      );
    }
  }
  if (
    expected.questionIds.length !== 22 ||
    !sameReadinessRoster(expected.questionIds, expected.questionIds) ||
    !sameReadinessRoster(
      input.questions.map((question) => question.id),
      expected.questionIds,
    )
  ) {
    errors.push('Frozen question roster must contain exactly twenty-two unique questions.');
  }
  if (
    input.questions.some(
      (question) => !['source-supported', 'partial', 'unsupported'].includes(question.status),
    )
  ) {
    errors.push('Unknown source question status cannot count as an answer.');
  }
  return errors;
}
