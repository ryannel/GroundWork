import type { ScanDocument } from '@/domain/scan/scan.generated';
import type { ScanScope } from '@/infrastructure/scan/scan-scope';

import { evaluateBenchmarkDepth } from './scan-benchmark-depth';
import { depthMutation } from './scan-depth-mutation-input';

interface MutationResult {
  readonly check: string;
  readonly applied: boolean;
  readonly baseline: string;
  readonly mutated: string;
  readonly passed: boolean;
  readonly reason: string;
}

/** Each frozen check must pass normally and reject removal/corruption of a required semantic fact. */
export function evaluateDepthMutations(
  scope: ScanScope,
  document: ScanDocument,
): readonly MutationResult[] {
  return evaluateBenchmarkDepth(scope, document).map((baseline) => {
    const mutation = depthMutation(document, baseline.id);
    const after = evaluateBenchmarkDepth(scope, mutation.document).find(
      (result) => result.id === baseline.id,
    );
    return {
      check: baseline.id,
      applied: mutation.changed,
      baseline: baseline.status,
      mutated: after?.status ?? 'missing',
      passed: [
        baseline.status === 'supported',
        mutation.changed,
        after !== undefined && after.status !== 'supported',
      ].every(Boolean),
      reason: after?.reason ?? 'Required check vanished after mutation.',
    };
  });
}
