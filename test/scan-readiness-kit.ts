import type {
  ReadinessBenchmark,
  ReadinessCheck,
  RepositoryReadinessInput,
  WorkflowCapability,
} from '@/domain/scan/repository-readiness-types';

import { scanFixture } from './scan-kit';

function benchmark(scopeId: string, checkIds: readonly string[]): ReadinessBenchmark {
  const phase = (): readonly ReadinessCheck[] =>
    checkIds.map((id) => ({ id, status: 'supported' }));
  return {
    scopeId,
    phases: { cold: phase(), warm: phase(), rulesChanged: phase(), parserChanged: phase() },
    mutations: checkIds.map((checkId) => ({
      checkId,
      applied: true,
      baseline: 'supported',
      mutated: 'failed',
    })),
    integrityPassed: true,
    reusePassed: true,
  };
}
function questionStatus(index: number): RepositoryReadinessInput['questions'][number]['status'] {
  if (index < 13) return 'source-supported';
  return index < 21 ? 'partial' : 'unsupported';
}
export function readinessFixture(): RepositoryReadinessInput {
  const scopeChecks = [7, 6, 6].map((count, scope) => ({
    scopeId: `scope-${String(scope)}`,
    checkIds: Array.from(
      { length: count },
      (_, check) => `check-${String(scope)}-${String(check)}`,
    ),
  }));
  const questionIds = Array.from({ length: 22 }, (_, index) => `question-${String(index)}`);
  const scan = scanFixture();
  scan.sources = scan.sources.map((source) => ({ ...source, commit: 'a'.repeat(40) }));
  const capabilities: readonly WorkflowCapability[] = [
    'stop_resume',
    'incremental_add',
    'incremental_modify',
    'incremental_delete',
    'incremental_rename',
    'policy_invalidation',
    'source_budget',
    'edge_identity_stability',
  ];
  return {
    expectations: { repo: 'fixture/repo', commit: 'a'.repeat(40), scopeChecks, questionIds },
    benchmark: scopeChecks.map((scope) => benchmark(scope.scopeId, scope.checkIds)),
    questions: questionIds.map((id, index) => ({
      id,
      status: questionStatus(index),
    })),
    catalogue: {
      entries: ['entry:a', 'entry:b'].map((id) => ({ id, planEntryId: id })),
      queries: ['entry:a', 'entry:b'].map((entryId) => ({
        entryId,
        artifactVerified: true,
        selectedRecords: 1,
        returnedRecordIds: [`record:${entryId}`],
        pages: 1,
        bytes: 1024,
        limits: {
          maxRecords: 2048,
          maxBytes: 8_388_608,
          maxRecordsPerPage: 4,
          maxPageBytes: 65_536,
          idsPerRequest: 32,
        },
        missing: 0,
        oversized: 0,
        omitted: 0,
      })),
    },
    workflow: capabilities.map((capability) => ({
      capability,
      passed: true,
      cases: 1,
      evidence: `fixture:${capability}`,
    })),
    budgetStatus: 'within_bounds',
    sourceUsage: { phase: 'deterministic_source', calls: 0, tokens: 0 },
    interpretation: {
      snapshots: [
        { kind: 'scan_snapshot', id: 'context:target', sha256: 'd'.repeat(64), document: scan },
      ],
      document: {
        format: 'scan-interpretation/v1',
        id: 'interpretation:fixture',
        state: 'complete',
        contexts: [
          {
            kind: 'scan_snapshot',
            id: 'context:target',
            sha256: 'd'.repeat(64),
            role: 'target',
            scan_id: scan.id,
            repo: 'fixture/repo',
            commit: 'a'.repeat(40),
          },
        ],
        runs: [
          {
            id: 'run:one',
            provider: 'fixture',
            model: { name: null, provenance: 'unknown' },
            started_at: '2026-10-25T10:00:00Z',
            finished_at: '2026-10-25T10:01:00Z',
            method: 'Grounded best-effort interpretation',
            input_context_ids: ['context:target'],
            usage: {
              state: 'unknown',
              calls_lower_bound: 1,
              reason: 'Agent model counters unavailable',
            },
          },
        ],
        claims: [
          {
            kind: 'purpose',
            id: 'purpose:one',
            label: 'inferred',
            statement: 'This component probably supports customer-data processing.',
            reasoning: 'The supplied snapshot contains its handler and source host.',
            confidence: 'low',
            alternatives: [],
            limitations: ['Runtime use is unobserved.'],
            dependencies: [],
            run_id: 'run:one',
            support: [
              {
                kind: 'observed_record',
                context_id: 'context:target',
                record_id: 'host:server',
                source_ids: ['source:handler'],
              },
            ],
            subject: {
              kind: 'observed_record',
              context_id: 'context:target',
              record_id: 'host:server',
            },
          },
        ],
        attempts: [
          {
            area: 'purpose',
            outcome: 'claims_proposed',
            claim_ids: ['purpose:one'],
            reason: 'Grounded probable purpose proposed.',
            run_id: 'run:one',
          },
          ...(['actor', 'action', 'journey', 'relationship'] as const).map((area) => ({
            area,
            outcome: 'insufficient_context' as const,
            claim_ids: [],
            reason: 'Fixture context omits sufficient detail for this area.',
            run_id: 'run:one',
          })),
        ],
      },
    },
  };
}
