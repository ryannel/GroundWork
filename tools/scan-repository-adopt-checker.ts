import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type {
  RepositoryPassPlan,
  RepositoryPassState,
} from '@/infrastructure/scan/repository-pass-state';

interface VerificationInput {
  readonly source: string;
  readonly cloneRoot: string;
  readonly checker: string;
  readonly plan: RepositoryPassPlan;
  readonly state: RepositoryPassState;
}
export interface AdoptionVerification {
  readonly checker: string;
  readonly source: string;
  readonly planDigest: string;
  readonly stateDigest: string;
  readonly scopes: number;
}
export function checkpointDigest(directory: string): string {
  return createHash('sha256')
    .update(readFileSync(path.join(directory, 'run-state.json')))
    .digest('hex');
}

/** Run the original immutable analyser in its own resolver context, not the new publisher's aliases. */
export function verifyAdoptionSource(input: VerificationInput): AdoptionVerification {
  const publication = pathToFileURL(
    path.join(input.checker, 'tools/scan-repository-pass-publication.ts'),
  ).href;
  const argumentsModule = pathToFileURL(
    path.join(input.checker, 'tools/scan-repository-pass-args.ts'),
  ).href;
  const args = [
    input.plan.repo,
    input.cloneRoot,
    input.source,
    '--commit',
    input.plan.commit,
    '--resume',
  ];
  const script = `
import { resumeRepositoryPass } from ${JSON.stringify(publication)};
import { repositoryPassArguments } from ${JSON.stringify(argumentsModule)};
const args = JSON.parse(process.argv[1]);
const loaded = await resumeRepositoryPass(repositoryPassArguments(args));
if (loaded.state.completed.length !== loaded.plan.scopes.length) throw new Error('Incomplete checkpoint');
console.log(JSON.stringify({planDigest:loaded.state.planDigest,scopes:loaded.plan.scopes.length}));
`;
  const before = checkpointDigest(input.source);
  const output = execFileSync(
    process.execPath,
    [
      '--import',
      './tools/register.ts',
      '--conditions=react-server',
      '--input-type=module',
      '--eval',
      script,
      JSON.stringify(args),
    ],
    {
      cwd: input.checker,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' },
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      timeout: 15 * 60 * 1000,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const value: unknown = JSON.parse(output.trim());
  if (!matchingVerification(value, input.state.planDigest, input.plan.scopes.length)) {
    throw new Error('Original analyser did not verify the requested complete checkpoint.');
  }
  if (checkpointDigest(input.source) !== before) {
    throw new Error('Source checkpoint changed during verification.');
  }
  return {
    checker: input.checker,
    source: input.source,
    planDigest: input.state.planDigest,
    stateDigest: before,
    scopes: input.plan.scopes.length,
  };
}
function matchingVerification(value: unknown, digest: string, scopes: number): boolean {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'planDigest' in value &&
    'scopes' in value &&
    value.planDigest === digest &&
    value.scopes === scopes
  );
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function retainedAncillaryPaths(value: unknown): readonly RetainedAncillary[] {
  if (!object(value) || !object(value.ancillary) || !Array.isArray(value.ancillary.files)) {
    throw new Error('Missing retained ancillary manifest.');
  }
  return value.ancillary.files.flatMap((entry: unknown) => {
    if (!object(entry)) throw new Error('Malformed ancillary entry.');
    if (entry.evidence === null) return [];
    if (
      typeof entry.evidence !== 'string' ||
      !/^ancillary\/(?:[a-f\d]{40}|[a-f\d]{64})\.txt$/u.test(entry.evidence)
    ) {
      throw new Error('Ancillary evidence must be a declared content-addressed path.');
    }
    if (
      typeof entry.path !== 'string' ||
      typeof entry.blob !== 'string' ||
      typeof entry.bytes !== 'number'
    ) {
      throw new TypeError('Retained ancillary identity and byte count are required.');
    }
    if (entry.evidence !== `ancillary/${entry.blob}.txt` || !Number.isSafeInteger(entry.bytes)) {
      throw new Error('Ancillary evidence does not match its blob identity.');
    }
    return [
      { evidence: entry.evidence, sourcePath: entry.path, blob: entry.blob, bytes: entry.bytes },
    ];
  });
}

export interface RetainedAncillary {
  readonly evidence: string;
  readonly sourcePath: string;
  readonly blob: string;
  readonly bytes: number;
}
