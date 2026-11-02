import 'server-only';

import path from 'node:path';

import { z } from 'zod';

import { parseScanScope } from './scan-scope';

const digest = z.string().regex(/^[a-f\d]{64}$/u);
const scopeId = z.string().regex(/^repository-\d+$/u);
const relativeFile = z
  .string()
  .refine(
    (value) => !path.isAbsolute(value) && !value.includes('\\') && !value.split('/').includes('..'),
  );
const completed = z
  .object({
    scope: scopeId,
    attempt: z.string().regex(/^attempt-[a-f\d-]+$/u),
    generation: digest,
    metrics: relativeFile,
    artifacts: z.array(z.object({ path: relativeFile, digest }).strict()).length(6),
  })
  .strict();

const plan = z
  .object({
    format: z.literal('scan-pass-plan/v1'),
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/u),
    workspace: z.string().min(1),
    commit: z.string().regex(/^[a-f\d]{40,64}$/u),
    tree: z.string().regex(/^[a-f\d]{40,64}$/u),
    cacheDirectory: z.string().refine((value) => path.isAbsolute(value)),
    maxSourceBytes: z.number().int().positive(),
    shardSize: z.number().int().min(1).max(100),
    inventoryDigest: digest,
    analysisDigest: digest,
    scopes: z.array(z.unknown()).transform((values) => values.map(parseScanScope)),
    changes: z
      .object({
        added: z.array(z.string()),
        modified: z.array(z.string()),
        deleted: z.array(z.string()),
        unchanged: z.array(z.string()),
        renamed: z.array(z.object({ previousPath: z.string(), path: z.string() }).strict()),
      })
      .strict(),
    retiredScopeIds: z.array(scopeId),
  })
  .strict();

const state = z
  .object({
    format: z.literal('scan-pass-state/v1'),
    planDigest: digest,
    status: z.enum(['prepared', 'running', 'stopped', 'failed', 'source_complete']),
    completed: z.array(completed),
    failure: z
      .object({ scope: z.string(), message: z.string(), code: z.string().nullable() })
      .strict()
      .nullable(),
    reportDigest: digest.nullable(),
  })
  .strict();

export type RepositoryPassPlan = z.infer<typeof plan>;
export type RepositoryPassState = z.infer<typeof state>;
export type RepositoryPassTask = z.infer<typeof completed>;

export function parseRepositoryPassPlan(value: unknown): RepositoryPassPlan {
  return plan.parse(value);
}

export function parseRepositoryPassState(value: unknown): RepositoryPassState {
  return state.parse(value);
}
