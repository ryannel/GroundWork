import path from 'node:path';

import { readFreshnessBaseline } from '@/infrastructure/scan/freshness-input';
import { repositoryPassJson } from '@/infrastructure/scan/repository-pass-files';
import type {
  RepositoryPassPlan,
  RepositoryPassState,
} from '@/infrastructure/scan/repository-pass-state';
import { scanValidator } from '@/infrastructure/scan/scan-format';
import { parseScanScope } from '@/infrastructure/scan/scan-scope';
import { assertScopeCoverage } from '@/infrastructure/scan/scope-coverage';
import { currentScopedGeneration } from '@/infrastructure/scan/scoped-selection';
import { scopedProvenance } from '@/infrastructure/scan/scoped-source-provenance';

import { passOptions, type PassInput } from './scan-repository-pass-plan';

/** Completed checkpoints are verified against the actual public publication, not trusted metrics. */
export async function verifyPassPublications(input: {
  readonly run: PassInput;
  readonly plan: RepositoryPassPlan;
  readonly state: RepositoryPassState;
}): Promise<void> {
  const parse = await scanValidator();
  for (const task of input.state.completed) {
    const scope = input.plan.scopes.find((candidate) => candidate.id === task.scope);
    if (!scope) throw new Error('Checkpoint references an unplanned scope.');
    const attempt = path.join(input.run.output, task.scope, task.attempt);
    const directory = path.join(attempt, task.generation);
    const storedScope = parseScanScope(
      await repositoryPassJson(path.join(directory, 'scope.json')),
    );
    const baseline = await readFreshnessBaseline(path.join(directory, 'baseline.json'));
    const expected = {
      repo: scope.repo,
      commit: scope.commit,
      tree: input.plan.tree,
      ref: scope.ref,
      ...scopedProvenance(scope, passOptions(input.plan, input.run)),
    };
    const matching = Object.entries(expected).every(([key, value]) =>
      Object.entries(baseline).some(
        ([name, observed]: readonly [string, unknown]) => name === key && observed === value,
      ),
    );
    if (!matching || JSON.stringify(storedScope) !== JSON.stringify(scope)) {
      throw new Error('Checkpoint publication pin, scope or analysis does not match its plan.');
    }
    if ((await currentScopedGeneration(attempt, { scope, baseline })) !== task.generation) {
      throw new Error('Checkpoint generation or selected artifacts changed.');
    }
    const document = parse(await repositoryPassJson(path.join(directory, 'document.json')));
    assertScopeCoverage(scope, document);
  }
}
