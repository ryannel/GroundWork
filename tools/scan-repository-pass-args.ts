import { parseArgs } from 'node:util';

import type { PassInput } from './scan-repository-pass-plan';

const USAGE =
  'scan:pass <organisation/repository> <clone-root> <output> [--commit SHA] [--cache directory] [--previous repository.json] [--resume] [--stop-after tasks] [--shard-size 40] [--max-source-bytes 1048576] [--java executable] [--go executable]';

function required(values: readonly string[], index: number): string {
  const value = values[index];
  if (value === undefined || value === '') throw new Error(USAGE);
  return value;
}

interface PassFlags {
  readonly commit?: string | undefined;
  readonly cache?: string | undefined;
  readonly previous?: string | undefined;
  readonly workspace?: string | undefined;
  readonly 'stop-after'?: string | undefined;
  readonly 'shard-size'?: string | undefined;
  readonly 'max-source-bytes'?: string | undefined;
  readonly java?: string | undefined;
  readonly go?: string | undefined;
  readonly resume?: boolean | undefined;
}
export interface PassArguments {
  readonly run: PassInput;
  readonly values: PassFlags;
  readonly stopAfter: number;
}

function optionalNumber(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}

export function repositoryPassArguments(args: readonly string[]): PassArguments {
  const { positionals, values } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      commit: { type: 'string' },
      cache: { type: 'string' },
      previous: { type: 'string' },
      workspace: { type: 'string' },
      resume: { type: 'boolean' },
      'stop-after': { type: 'string' },
      'shard-size': { type: 'string' },
      'max-source-bytes': { type: 'string' },
      java: { type: 'string' },
      go: { type: 'string' },
    },
  });
  if (positionals.length !== 3) throw new Error(USAGE);
  const repo = required(positionals, 0);
  const cloneRoot = required(positionals, 1);
  const output = required(positionals, 2);
  if (
    !/^[\w.-]+\/[\w.-]+$/u.test(repo) ||
    repo.split('/').some((part) => part === '.' || part === '..')
  ) {
    throw new Error(USAGE);
  }
  if (values.resume === true && values.previous !== undefined) {
    throw new Error('--previous starts a new pass and cannot be combined with --resume.');
  }
  if (values.commit !== undefined && !/^[a-f\d]{40,64}$/u.test(values.commit)) {
    throw new Error('--commit requires a full commit ID.');
  }
  const stopAfter =
    values['stop-after'] === undefined ? Number.MAX_SAFE_INTEGER : Number(values['stop-after']);
  if (!Number.isSafeInteger(stopAfter) || stopAfter < 0) {
    throw new Error('--stop-after must be a non-negative integer.');
  }
  const run: PassInput = {
    repo,
    cloneRoot,
    output,
    commit: values.commit,
    cache: values.cache,
    previous: values.previous,
    workspace: values.workspace,
    java: values.java,
    go: values.go,
    shardSize: Number(values['shard-size'] ?? 40),
    maxSourceBytes: optionalNumber(values['max-source-bytes']),
  };
  return { run, values, stopAfter };
}
