import { describe, expect, it } from 'vitest';

import { readinessFixture } from '@/../test/scan-readiness-kit';

import { assessRepositoryReadiness } from './repository-readiness';
import type {
  ReadinessBenchmark,
  ReadinessQuery,
  RepositoryReadinessInput,
} from './repository-readiness-types';

function scopeChange(
  input: RepositoryReadinessInput,
  change: (scope: ReadinessBenchmark) => ReadinessBenchmark,
): RepositoryReadinessInput {
  return {
    ...input,
    benchmark: input.benchmark.map((scope, index) => (index === 0 ? change(scope) : scope)),
  };
}
function queryChange(
  input: RepositoryReadinessInput,
  change: (query: ReadinessQuery) => ReadinessQuery,
): RepositoryReadinessInput {
  return {
    ...input,
    catalogue: {
      ...input.catalogue,
      queries: input.catalogue.queries.map((query, index) => (index === 0 ? change(query) : query)),
    },
  };
}
function expectRejected(input: RepositoryReadinessInput): void {
  const result = assessRepositoryReadiness(input);
  expect(result.readiness).toBe('not_ready');
  expect(result.fullscanWorkflowReady).toBe(false);
  expect(result.blockers.length).toBeGreaterThan(0);
  expect(result.wider_scans).toBe('stopped_not_authorised');
}

describe('repository readiness acceptance', () => {
  it('accepts bounded source readiness with honest partial answers and unmetered inference', () => {
    expect(assessRepositoryReadiness(readinessFixture())).toEqual({
      readiness: 'ready_for_bounded_repository_pass',
      fullscanWorkflowReady: true,
      blockers: [],
      counts: { supported: 13, partial: 8, unsupported: 1 },
      wider_scans: 'stopped_not_authorised',
      modelBudget: 'unmetered',
    });
  });
  it('rejects vacuous green flags and a caller trying to lower the frozen denominators', () => {
    const input = readinessFixture();
    expectRejected({ ...input, benchmark: [] });
    expectRejected({ ...input, questions: [] });
    expectRejected({
      ...input,
      expectations: { ...input.expectations, scopeChecks: [], questionIds: [] },
    });
    expectRejected({
      ...input,
      expectations: {
        ...input.expectations,
        scopeChecks: input.expectations.scopeChecks.slice(0, 2),
      },
    });
    expectRejected({ ...input, questions: input.questions.slice(1) });
    expectRejected({
      ...input,
      questions: input.questions.map((question, index) =>
        index === 0 ? { ...question, id: input.questions[1]?.id ?? '' } : question,
      ),
    });
  });
  it('requires every frozen phase and applied destructive mutation rather than green gate flags', () => {
    const input = readinessFixture();
    expectRejected(
      scopeChange(input, (scope) => ({ ...scope, phases: { ...scope.phases, warm: [] } })),
    );
    expectRejected(
      scopeChange(input, (scope) => ({
        ...scope,
        phases: {
          ...scope.phases,
          parserChanged: scope.phases.parserChanged.map((check) => ({
            ...check,
            status: 'unresolved',
          })),
        },
      })),
    );
    expectRejected(scopeChange(input, (scope) => ({ ...scope, mutations: [] })));
    expectRejected(
      scopeChange(input, (scope) => ({
        ...scope,
        mutations: scope.mutations.map((mutation) => ({ ...mutation, applied: false })),
      })),
    );
    expectRejected(
      scopeChange(input, (scope) => ({
        ...scope,
        mutations: scope.mutations.map((mutation) => ({ ...mutation, baseline: 'unresolved' })),
      })),
    );
    expectRejected(
      scopeChange(input, (scope) => ({
        ...scope,
        mutations: scope.mutations.map((mutation) => ({ ...mutation, mutated: 'supported' })),
      })),
    );
    expectRejected(scopeChange(input, (scope) => ({ ...scope, reusePassed: false })));
  });
  it('rejects empty, missing-plan and single-entry query catalogues', () => {
    const input = readinessFixture();
    expectRejected({ ...input, catalogue: { entries: [], queries: [] } });
    expectRejected({
      ...input,
      catalogue: {
        ...input.catalogue,
        entries: input.catalogue.entries.map((entry) => ({ ...entry, planEntryId: '' })),
      },
    });
    expectRejected({
      ...input,
      catalogue: {
        ...input.catalogue,
        queries: input.catalogue.queries.map((query) => ({ ...query, entryId: 'entry:a' })),
      },
    });
    expectRejected(queryChange(input, (query) => ({ ...query, artifactVerified: false })));
  });
  it('rejects omitted evidence, duplicate return IDs and enlarged caps used to hide overrun', () => {
    const input = readinessFixture();
    expectRejected(queryChange(input, (query) => ({ ...query, returnedRecordIds: [] })));
    expectRejected(
      queryChange(input, (query) => ({
        ...query,
        selectedRecords: 2,
        returnedRecordIds: ['same', 'same'],
      })),
    );
    expectRejected(queryChange(input, (query) => ({ ...query, omitted: 1 })));
    expectRejected(queryChange(input, (query) => ({ ...query, oversized: 1 })));
    expectRejected(queryChange(input, (query) => ({ ...query, missing: 1 })));
    expectRejected(
      queryChange(input, (query) => ({
        ...query,
        limits: { ...query.limits, maxRecordsPerPage: 5 },
      })),
    );
    expectRejected(
      queryChange(input, (query) => ({
        ...query,
        limits: { ...query.limits, maxPageBytes: 65_537 },
      })),
    );
    expectRejected(
      queryChange(input, (query) => ({ ...query, limits: { ...query.limits, idsPerRequest: 33 } })),
    );
    expectRejected(queryChange(input, (query) => ({ ...query, bytes: query.limits.maxBytes + 1 })));
  });
  it('requires positive capability evidence and known enforced resource bounds', () => {
    const input = readinessFixture();
    expectRejected({ ...input, workflow: [] });
    expectRejected({ ...input, workflow: input.workflow.map((entry) => ({ ...entry, cases: 0 })) });
    expectRejected({
      ...input,
      workflow: input.workflow.map((entry) => ({ ...entry, evidence: '' })),
    });
    expectRejected({ ...input, budgetStatus: 'unknown' });
    expectRejected({ ...input, budgetStatus: 'exceeded' });
    expectRejected({ ...input, sourceUsage: { ...input.sourceUsage, calls: 1 } });
  });
  it('requires completed interpretation for the actual target without copying source zero usage', () => {
    const input = readinessFixture();
    const document = input.interpretation.document;
    expectRejected({
      ...input,
      interpretation: {
        ...input.interpretation,
        document: { ...document, state: 'pending', claims: [], runs: [], attempts: [] },
      },
    });
    expectRejected({ ...input, expectations: { ...input.expectations, repo: 'other/repo' } });
    expectRejected({
      ...input,
      interpretation: {
        ...input.interpretation,
        document: {
          ...document,
          attempts: document.attempts.filter((attempt) => attempt.area !== 'journey'),
        },
      },
    });
    expectRejected({
      ...input,
      interpretation: {
        ...input.interpretation,
        document: {
          ...document,
          runs: document.runs.map((run) => ({
            ...run,
            usage: { state: 'measured', calls: 0, input_tokens: 0, output_tokens: 0 },
          })),
        },
      },
    });
  });
  it('does not accept unused target context when interpretation only examined surrounding context', () => {
    const input = readinessFixture();
    const document = input.interpretation.document;
    const surrounding = {
      ...document.contexts[0],
      id: 'context:surround',
      role: 'surrounding' as const,
    };
    const snapshots = [
      ...input.interpretation.snapshots,
      ...input.interpretation.snapshots.map((snapshot) => ({
        ...snapshot,
        id: 'context:surround',
      })),
    ];
    expectRejected({
      ...input,
      interpretation: {
        snapshots,
        document: {
          ...document,
          contexts: [document.contexts[0], surrounding],
          claims: [],
          runs: document.runs.map((run) => ({ ...run, input_context_ids: ['context:surround'] })),
          attempts: document.attempts.map((attempt) => ({
            ...attempt,
            outcome: 'insufficient_context' as const,
            claim_ids: [],
          })),
        },
      },
    });
  });
  it('accepts explicit insufficient-context attempts without forcing fabricated actor or journey claims', () => {
    const input = readinessFixture();
    const document = input.interpretation.document;
    const honest = {
      ...input,
      interpretation: {
        ...input.interpretation,
        document: {
          ...document,
          claims: [],
          attempts: document.attempts.map((attempt) => ({
            ...attempt,
            outcome: 'insufficient_context' as const,
            claim_ids: [],
            reason: 'After examining the supplied input, no useful grounded guess was possible.',
          })),
        },
      },
    };
    expect(assessRepositoryReadiness(honest).fullscanWorkflowReady).toBe(true);
  });
});
