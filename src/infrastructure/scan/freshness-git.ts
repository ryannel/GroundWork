import 'server-only';

import { execFile } from 'node:child_process';

import type {
  FreshnessResult,
  GitFileChange,
  RefObservation,
  SourceBaseline,
} from '@/domain/scan/scan.generated';

const BASELINE_UNAVAILABLE = 'baseline-unavailable';

interface RefInput {
  readonly repository: string;
  readonly ref: string;
  readonly checkedAt: string;
  /** Explicit opt-in to a read-only remote observation. Never fetches objects. */
  readonly remote?: string;
}

interface FreshnessInput {
  readonly repository: string;
  readonly baseline: SourceBaseline;
  readonly current: SourceBaseline;
  readonly observation: RefObservation;
  readonly provenanceComplete: boolean;
}

async function git(repository: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      '/usr/bin/git',
      ['--no-optional-locks', '-C', repository, ...args],
      {
        encoding: 'utf8',
        env: { NODE_ENV: 'production', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' },
        maxBuffer: 32 * 1024 * 1024,
        timeout: 30_000,
      },
      (error: Error | null, stdout: string) => {
        if (error !== null) {
          reject(error);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

export async function observeRef(input: RefInput): Promise<RefObservation> {
  const source = input.remote === undefined ? 'local' : 'remote';
  try {
    const output =
      input.remote === undefined
        ? await git(input.repository, [
            'rev-parse',
            '--verify',
            '--end-of-options',
            `${input.ref}^{commit}`,
          ])
        : await git(input.repository, [
            'ls-remote',
            '--exit-code',
            '--refs',
            '--',
            input.remote,
            input.ref,
          ]);
    const revision = output.trim().split(/\s+/u)[0];
    if (revision === undefined || !/^[a-f\d]{40,64}$/u.test(revision)) {
      throw new Error('Ref did not resolve to a commit.');
    }
    return { checkedAt: input.checkedAt, ref: input.ref, source, status: 'observed', revision };
  } catch {
    return {
      checkedAt: input.checkedAt,
      ref: input.ref,
      source,
      status: 'unavailable',
      error: 'Ref could not be observed.',
    };
  }
}

function changeStatus(status: string): GitFileChange['status'] {
  switch (status[0]) {
    case 'A': {
      return 'added';
    }
    case 'D': {
      return 'deleted';
    }
    case 'R': {
      return 'renamed';
    }
    case 'T': {
      return 'type-changed';
    }
    case 'M': {
      return 'modified';
    }
    default: {
      throw new Error(`Unsupported Git change status: ${status}`);
    }
  }
}

function rawHeader(
  header: string,
): Pick<GitFileChange, 'status' | 'oldBlob' | 'newBlob' | 'gitlink'> {
  const [oldMode, newMode, oldBlob, newBlob, rawStatus] = header.slice(1).split(' ');
  if (
    !header.startsWith(':') ||
    oldBlob === undefined ||
    newBlob === undefined ||
    rawStatus === undefined
  ) {
    throw new Error('Invalid Git diff record.');
  }
  return {
    status: changeStatus(rawStatus),
    oldBlob,
    newBlob,
    gitlink: oldMode === '160000' || newMode === '160000',
  };
}

function ensureDiffTerminated(output: string): void {
  if (output !== '' && !output.endsWith('\0')) throw new Error('Incomplete Git diff record.');
}

/** Raw records preserve arbitrary filenames and report blob ids without opening source blobs. */
export function parseRawDiff(output: string): readonly GitFileChange[] {
  ensureDiffTerminated(output);
  const records = output.split('\0');
  const changes: GitFileChange[] = [];
  let index = 0;
  while (index < records.length - 1) {
    const header = records[index];
    const firstPath = records[index + 1];
    if (header === undefined || firstPath === undefined) {
      throw new Error('Incomplete Git diff record.');
    }
    const fields = rawHeader(header);
    const path = fields.status === 'renamed' ? records[index + 2] : firstPath;
    if (path === undefined || path === '') throw new Error('Incomplete rename record.');
    changes.push({
      ...fields,
      path,
      ...(fields.status === 'renamed' ? { previousPath: firstPath } : {}),
    });
    index += fields.status === 'renamed' ? 3 : 2;
  }
  return changes;
}

function digestState(input: FreshnessInput): FreshnessResult['state'] | undefined {
  if (input.baseline.ruleDigest !== input.current.ruleDigest) return 'rules-changed';
  if (
    input.baseline.environmentDigest !== input.current.environmentDigest ||
    input.baseline.toolchainDigest !== input.current.toolchainDigest ||
    input.baseline.configDigest !== input.current.configDigest
  ) {
    return 'configuration-changed';
  }
  return undefined;
}

async function sourceDelta(
  input: FreshnessInput,
): Promise<Pick<FreshnessResult, 'state' | 'changedFiles'>> {
  try {
    if (
      ![input.baseline.commit, input.current.commit].every((commit) =>
        /^[a-f\d]{40,64}$/u.test(commit),
      )
    ) {
      return { state: BASELINE_UNAVAILABLE, changedFiles: [] };
    }
    const baselineTree = await git(input.repository, [
      'rev-parse',
      '--verify',
      `${input.baseline.commit}^{tree}`,
    ]);
    const currentTree = await git(input.repository, [
      'rev-parse',
      '--verify',
      `${input.current.commit}^{tree}`,
    ]);
    if (baselineTree.trim() !== input.baseline.tree || currentTree.trim() !== input.current.tree) {
      return { state: BASELINE_UNAVAILABLE, changedFiles: [] };
    }
    const output = await git(input.repository, [
      'diff',
      '--raw',
      '--no-abbrev',
      '--no-ext-diff',
      '--no-textconv',
      '--find-renames=100%',
      '-z',
      input.baseline.commit,
      input.current.commit,
      '--',
    ]);
    const changedFiles = [...parseRawDiff(output)];
    try {
      await git(input.repository, [
        'merge-base',
        '--is-ancestor',
        input.baseline.commit,
        input.current.commit,
      ]);
    } catch {
      return { state: 'ref-rewritten', changedFiles };
    }
    return {
      state: digestState(input) ?? (changedFiles.length > 0 ? 'changed' : 'unchanged'),
      changedFiles,
    };
  } catch {
    return { state: BASELINE_UNAVAILABLE, changedFiles: [] };
  }
}

/** Source freshness says nothing about which revision has been deployed. */
export async function assessFreshness(input: FreshnessInput): Promise<FreshnessResult> {
  const delta = await sourceDelta(input);
  let state = delta.state;
  if (
    (!input.provenanceComplete ||
      input.baseline.repo !== input.current.repo ||
      input.baseline.ref !== input.current.ref) &&
    state === 'unchanged'
  ) {
    state = 'unknown-provenance';
  }
  if (
    input.observation.status === 'observed' &&
    input.observation.revision !== input.current.commit &&
    state === 'unchanged'
  ) {
    state = 'unknown-provenance';
  }
  if (input.observation.status === 'unavailable') state = 'observation-unavailable';
  return {
    ...delta,
    state,
    baseline: input.baseline,
    observation: input.observation,
    sourceCurrent:
      state === 'unchanged' &&
      input.observation.status === 'observed' &&
      input.observation.revision === input.current.commit &&
      input.observation.ref === input.current.ref,
    deploymentCurrent: 'unknown',
  };
}

/** Resolves only commit/tree objects; never opens a source blob or fetches. */
export async function resolveCommitTree(
  repository: string,
  commit: string,
): Promise<string | null> {
  if (!/^[a-f\d]{40,64}$/u.test(commit)) return null;
  try {
    const tree = await git(repository, ['rev-parse', '--verify', `${commit}^{tree}`]);
    await git(repository, ['cat-file', '-e', `${tree.trim()}^{tree}`]);
    return tree.trim();
  } catch {
    return null;
  }
}
