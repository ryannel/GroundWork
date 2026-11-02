import 'server-only';

import type { FreshnessResult, SourceBaseline } from '@/domain/scan/scan.generated';

import { assessFreshness, observeRef, resolveCommitTree } from './freshness-git';

export type CurrentProvenance = Pick<
  SourceBaseline,
  'environmentDigest' | 'ruleDigest' | 'toolchainDigest' | 'configDigest'
>;

interface FreshnessCheckInput {
  readonly repository: string;
  readonly baseline: SourceBaseline;
  readonly checkedAt: string;
  readonly ref?: string;
  readonly remote?: string;
  readonly provenance?: CurrentProvenance;
}

export interface FreshnessStatus {
  readonly freshness: FreshnessResult;
  readonly currentBaseline: SourceBaseline | null;
  readonly verification: 'source-only' | 'analysis';
  readonly sourceUnchanged: boolean;
  readonly rescanRequired: boolean;
  readonly changedFileListKnown: boolean;
}

/** The caller supplies time and opts in explicitly to remote observation. */
export async function checkFreshness(input: FreshnessCheckInput): Promise<FreshnessStatus> {
  const ref = input.ref ?? input.baseline.ref;
  const observation = await observeRef({
    repository: input.repository,
    ref,
    checkedAt: input.checkedAt,
    ...(input.remote === undefined ? {} : { remote: input.remote }),
  });
  const commit = observation.status === 'observed' ? observation.revision : input.baseline.commit;
  const tree =
    observation.status === 'observed' ? await resolveCommitTree(input.repository, commit) : null;
  const current = { ...input.baseline, ...input.provenance, ref, commit, tree: tree ?? '' };
  const freshness = await assessFreshness({
    repository: input.repository,
    baseline: input.baseline,
    current,
    observation,
    provenanceComplete: input.provenance !== undefined,
  });
  const changedFileListKnown = tree !== null && freshness.state !== 'baseline-unavailable';
  const sourceUnchanged =
    observation.status === 'observed' &&
    commit === input.baseline.commit &&
    ref === input.baseline.ref &&
    tree === input.baseline.tree;
  return {
    freshness,
    currentBaseline: tree === null ? null : current,
    verification: input.provenance === undefined ? 'source-only' : 'analysis',
    sourceUnchanged,
    rescanRequired: !freshness.sourceCurrent,
    changedFileListKnown,
  };
}
