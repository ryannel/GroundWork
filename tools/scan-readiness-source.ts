import path from 'node:path';

import type { RepositoryReadinessInput } from '@/domain/scan/repository-readiness-types';
import {
  passArtifactDigest,
  readRepositoryPass,
  repositoryPassJson,
} from '@/infrastructure/scan/repository-pass-files';

import { readinessNumber, readinessObject, readinessString } from './scan-readiness-value';
import { passAnalysisDigest } from './scan-repository-pass-plan';
import { verifyPassPublications } from './scan-repository-pass-verify';

/** Checkpoints and current analysis, rather than a source_complete string alone, establish source provenance. */
export async function readinessSource(filename: string): Promise<{
  readonly repo: string;
  readonly commit: string;
  readonly usage: RepositoryReadinessInput['sourceUsage'];
}> {
  const directory = path.dirname(path.resolve(filename));
  const { plan, state } = await readRepositoryPass(directory);
  if (
    path.basename(filename) !== 'repository.json' ||
    state.status !== 'source_complete' ||
    state.reportDigest !== (await passArtifactDigest(directory, 'repository.json')) ||
    plan.analysisDigest !== passAnalysisDigest(plan, { cloneRoot: '' })
  ) {
    throw new Error('Source pass is incomplete, changed or stale under current analysis.');
  }
  await verifyPassPublications({
    plan,
    state,
    run: { repo: plan.repo, cloneRoot: '', output: directory, shardSize: plan.shardSize },
  });
  const report = readinessObject(await repositoryPassJson(filename));
  if (
    ![
      report.repo === plan.repo,
      report.runStatus === 'source_complete',
      report.status === 'partial',
      report.semanticAcceptance === 'not_established',
      report.commit === plan.commit,
      report.tree === plan.tree,
      report.modelUsageScope === 'deterministic_source_phase',
      report.widerScans === 'stopped',
    ].every(Boolean)
  ) {
    throw new Error('Source report disagrees with the pinned source checkpoint or phase.');
  }
  return {
    repo: readinessString(report.repo),
    commit: readinessString(report.commit),
    usage: {
      phase: 'deterministic_source',
      calls: readinessNumber(report.modelCalls),
      tokens: readinessNumber(report.modelTokens),
    },
  };
}
