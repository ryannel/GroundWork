import 'server-only';

import { z } from 'zod';

import { repositoryFreshnessFormat } from './repository-freshness-format';
import type { RepositoryPassTask } from './repository-pass-state';

const extraction = z
  .object({
    elapsedMs: z.number().nonnegative(),
    cpuMs: z.number().nonnegative(),
    stats: z
      .object({
        blobReads: z.number().int().nonnegative(),
        parsedFiles: z.number().int().nonnegative(),
        indexHits: z.number().int().nonnegative(),
        reusedFiles: z.number().int().nonnegative(),
        sourceBytes: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

const metrics = z
  .object({
    trial: z.literal('first'),
    scope: z.string().min(1),
    generation: z.string().regex(/^[a-f\d]{64}$/u),
    document: z.string().min(1),
    coverage: z.string().min(1),
    publicValidation: z.literal('passed'),
    extraction,
    freshness: repositoryFreshnessFormat,
  })
  .loose();

export interface RepositoryTrialReference {
  readonly trial: 'first';
  readonly scope: string;
  readonly generation: string;
  readonly document: string;
  readonly coverage: string;
  readonly metrics: string;
  readonly metricsDigest: string;
  readonly extraction: z.infer<typeof extraction>;
}

/** Full metrics stay in their committed bounded artefact, including all freshness observations. */
export function repositoryTrialReference(
  task: RepositoryPassTask,
  input: unknown,
  digest: string,
): RepositoryTrialReference {
  const value = metrics.parse(input);
  const prefix = `${task.scope}/${task.attempt}/${task.generation}`;
  const committed = task.artifacts.find((artifact) => artifact.path === task.metrics);
  const identityMatches = value.scope === task.scope && value.generation === task.generation;
  const pathsMatch =
    value.document === `${prefix}/document.json` &&
    value.coverage === `${prefix}/coverage.json` &&
    task.metrics === `${task.scope}/${task.attempt}/completion.json`;
  const digestMatches = committed?.digest === digest && /^[a-f\d]{64}$/u.test(digest);
  if (![identityMatches, pathsMatch, digestMatches].every(Boolean)) {
    throw new Error('Trial metrics do not match their committed checkpoint.');
  }

  return {
    trial: value.trial,
    scope: value.scope,
    generation: value.generation,
    document: value.document,
    coverage: value.coverage,
    metrics: task.metrics,
    metricsDigest: digest,
    extraction: value.extraction,
  };
}
