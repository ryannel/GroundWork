import 'server-only';

import { z } from 'zod';

import type { GitFileChange } from '@/domain/scan/scan.generated';

import type { FreshnessStatus } from './freshness-status';

const hash = z.string().regex(/^(?:[a-f\d]{40}|[a-f\d]{64})$/u);
const baseline = z
  .object({
    repo: z.string().min(1),
    commit: hash,
    tree: hash,
    ref: z.string().min(1),
    environmentDigest: z.string().min(1),
    ruleDigest: z.string().min(1),
    toolchainDigest: z.string().min(1),
    configDigest: z.string().min(1),
  })
  .strict();
const commonObservation = {
  checkedAt: z.string().min(1),
  ref: z.string().min(1),
  source: z.enum(['local', 'remote']),
};
const observation = z.discriminatedUnion('status', [
  z.object({ ...commonObservation, status: z.literal('observed'), revision: hash }).strict(),
  z
    .object({ ...commonObservation, status: z.literal('unavailable'), error: z.string().min(1) })
    .strict(),
]);
const change = z
  .object({
    status: z.enum(['added', 'modified', 'deleted', 'renamed', 'type-changed']),
    path: z.string().min(1),
    previousPath: z.string().optional(),
    oldBlob: z.string().optional(),
    newBlob: z.string().optional(),
    binary: z.boolean().optional(),
    gitlink: z.boolean().optional(),
  })
  .strict()
  .transform((value): GitFileChange => ({
    status: value.status,
    path: value.path,
    ...(value.previousPath === undefined ? {} : { previousPath: value.previousPath }),
    ...(value.oldBlob === undefined ? {} : { oldBlob: value.oldBlob }),
    ...(value.newBlob === undefined ? {} : { newBlob: value.newBlob }),
    ...(value.binary === undefined ? {} : { binary: value.binary }),
    ...(value.gitlink === undefined ? {} : { gitlink: value.gitlink }),
  }));

/** References must preserve an explicit observation, including unavailable and unknown states. */
export const repositoryFreshnessFormat = z
  .object({
    elapsedMs: z.number().nonnegative(),
    freshness: z
      .object({
        state: z.enum([
          'unchanged',
          'changed',
          'configuration-changed',
          'rules-changed',
          'ref-rewritten',
          'baseline-unavailable',
          'observation-unavailable',
          'unknown-provenance',
        ]),
        baseline,
        observation,
        sourceCurrent: z.boolean(),
        deploymentCurrent: z.literal('unknown'),
        changedFiles: z.array(change),
      })
      .strict(),
    currentBaseline: baseline.nullable(),
    verification: z.enum(['source-only', 'analysis']),
    sourceUnchanged: z.boolean(),
    rescanRequired: z.boolean(),
    changedFileListKnown: z.boolean(),
  })
  .strict()
  .refine(
    (value) => value.rescanRequired === !value.freshness.sourceCurrent,
    'Inconsistent freshness rescan flag',
  ) satisfies z.ZodType<FreshnessStatus & { readonly elapsedMs: number }>;
