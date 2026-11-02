import 'server-only';

import { readFile } from 'node:fs/promises';

import { z } from 'zod';

const relativePath = z
  .string()
  .min(1)
  .refine(
    (value) => !value.startsWith('/') && !value.includes('\0') && !value.split('/').includes('..'),
    'Expected a repository-relative source path',
  );
const sourceFile = z
  .object({
    path: relativePath,
    language: z.enum(['typescript', 'javascript', 'java', 'go', 'csharp', 'python', 'rust']),
    environment: z.enum(['browser', 'server', 'worker', 'unknown']),
  })
  .strict();
const question = z
  .object({
    id: z.string().min(1),
    profile: z.enum(['endpoint', 'action']),
    path: relativePath,
    symbol: z.string(),
    checks: z.array(z.object({ kind: z.string().min(1), text: z.string().min(1) }).strict()).min(1),
  })
  .strict();
const scopeSchema = z
  .object({
    format: z.literal('scan-scope/v1'),
    workspace: z.string().min(1),
    id: z.string().regex(/^[a-z\d-]+$/u),
    repo: z
      .string()
      .regex(/^[\w.-]+\/[\w.-]+$/u)
      .refine(
        (value) => value.split('/').every((segment) => segment !== '.' && segment !== '..'),
        'Expected an organisation/repository identity',
      ),
    commit: z.string().regex(/^[a-f\d]{40,64}$/u),
    ref: z.string().min(1),
    files: z.array(sourceFile).min(1).max(100),
    questions: z.array(question).min(1),
  })
  .strict();

export interface ScopeFile {
  readonly path: string;
  readonly language: 'typescript' | 'javascript' | 'java' | 'go' | 'csharp' | 'python' | 'rust';
  readonly environment: 'browser' | 'server' | 'worker' | 'unknown';
}
export interface ScopeQuestion {
  readonly id: string;
  readonly profile: 'endpoint' | 'action';
  readonly path: string;
  readonly symbol: string;
  readonly checks: readonly { readonly kind: string; readonly text: string }[];
}
export interface ScanScope {
  readonly format: 'scan-scope/v1';
  readonly workspace: string;
  readonly id: string;
  readonly repo: string;
  readonly commit: string;
  readonly ref: string;
  readonly files: readonly ScopeFile[];
  readonly questions: readonly ScopeQuestion[];
}

export function parseScanScope(value: unknown): ScanScope {
  const scope = scopeSchema.parse(value);
  const paths = new Set(scope.files.map((file) => file.path));
  const questions = new Set(scope.questions.map((item) => item.id));
  if (paths.size !== scope.files.length || questions.size !== scope.questions.length) {
    throw new Error('Duplicate scope source or question');
  }
  if (scope.questions.some((item) => !paths.has(item.path))) {
    throw new Error('A question names source outside the fixed scope');
  }
  return scope;
}

export async function readScanScope(file: string): Promise<ScanScope> {
  const value: unknown = JSON.parse(await readFile(file, 'utf8'));
  return parseScanScope(value);
}
