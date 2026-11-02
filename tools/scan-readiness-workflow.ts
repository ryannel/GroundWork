import path from 'node:path';

import type {
  RepositoryReadinessInput,
  WorkflowCapability,
} from '@/domain/scan/repository-readiness-types';

import { readinessArray, readinessObject, readinessString } from './scan-readiness-value';
import { WORKFLOW_CASES } from './scan-readiness-workflow-cases';

const DELTA_TEST = 'tools/scan-repository-delta.test.ts';
const FILES: Readonly<Record<WorkflowCapability, string>> = {
  stop_resume: 'tools/scan-repository-pass.test.ts',
  incremental_add: DELTA_TEST,
  incremental_modify: DELTA_TEST,
  incremental_delete: DELTA_TEST,
  incremental_rename: DELTA_TEST,
  policy_invalidation: 'tools/scan-repository-pass.test.ts',
  source_budget: 'src/infrastructure/scan/source-budget.test.ts',
  edge_identity_stability: 'src/infrastructure/scan/semantic-edge-identity.test.ts',
};

export function readinessWorkflow(
  report: unknown,
  evidence: string,
): RepositoryReadinessInput['workflow'] {
  const data = readinessObject(report);
  const results = readinessArray(data.testResults).map(readinessObject);
  return Object.entries(FILES).map(([capability, file]) => {
    const modules = results.filter(
      (row) => path.resolve(readinessString(row.name)) === path.resolve(file),
    );
    const cases = modules.flatMap((row) =>
      readinessArray(row.assertionResults).map(readinessObject),
    );
    const expected = WORKFLOW_CASES[file] ?? [];
    const names = cases.map((row) => readinessString(row.title));
    const complete =
      expected.length > 0 &&
      names.length === expected.length &&
      new Set(names).size === names.length &&
      expected.every((name) => names.includes(name));
    return {
      capability: capabilityName(capability),
      passed: [
        data.success === true,
        modules.length === 1,
        modules.every((row) => row.status === 'passed'),
        complete,
        cases.every((row) => row.status === 'passed'),
      ].every(Boolean),
      cases: cases.length,
      evidence,
    };
  });
}
function capabilityName(value: string): WorkflowCapability {
  switch (value) {
    case 'stop_resume':
    case 'incremental_add':
    case 'incremental_modify':
    case 'incremental_delete':
    case 'incremental_rename':
    case 'policy_invalidation':
    case 'source_budget':
    case 'edge_identity_stability': {
      return value;
    }
    default: {
      throw new Error('Unknown workflow capability.');
    }
  }
}
