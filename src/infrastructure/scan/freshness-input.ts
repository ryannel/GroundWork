import 'server-only';

import { readFile } from 'node:fs/promises';

import { z } from 'zod';

import type { SourceBaseline } from '@/domain/scan/scan.generated';

import type { CurrentProvenance } from './freshness-status';

const digests = z.object({
  environmentDigest: z.string().min(1),
  ruleDigest: z.string().min(1),
  toolchainDigest: z.string().min(1),
  configDigest: z.string().min(1),
});
const baseline = digests
  .extend({
    repo: z.string().min(1),
    ref: z.string().min(1),
    commit: z.string().regex(/^[a-f\d]{40,64}$/u),
    tree: z.string().regex(/^[a-f\d]{40,64}$/u),
  })
  .strict();

export async function readFreshnessBaseline(filename: string): Promise<SourceBaseline> {
  const value: unknown = JSON.parse(await readFile(filename, 'utf8'));
  return baseline.parse(value);
}

export async function readFreshnessProvenance(filename: string): Promise<CurrentProvenance> {
  const value: unknown = JSON.parse(await readFile(filename, 'utf8'));
  return digests.strict().parse(value);
}
