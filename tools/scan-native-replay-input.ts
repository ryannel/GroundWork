import { isDeepStrictEqual } from 'node:util';

interface Trial {
  readonly trial: string;
  readonly scope: string;
  readonly document: string;
}
interface PriorRecord {
  readonly id: string;
}
interface PriorPage {
  readonly records: readonly PriorRecord[];
}
export interface PriorPages {
  readonly pages: readonly PriorPage[];
}
interface RosterEntry {
  readonly scope: string;
  readonly probe: string;
}

function object(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}
function trial(input: unknown): input is Trial {
  return (
    object(input) &&
    typeof input.trial === 'string' &&
    typeof input.scope === 'string' &&
    typeof input.document === 'string'
  );
}
function rosterEntry(input: unknown): input is RosterEntry {
  return object(input) && typeof input.scope === 'string' && typeof input.probe === 'string';
}
function priorRecord(input: unknown): input is PriorRecord {
  return object(input) && typeof input.id === 'string';
}
function priorPage(input: unknown): input is PriorPage {
  return object(input) && Array.isArray(input.records) && input.records.every(priorRecord);
}
function mutation(input: unknown): input is { readonly rejected: boolean } {
  return object(input) && typeof input.rejected === 'boolean';
}

export function replayManifest(
  input: unknown,
  pin: { readonly repo: string; readonly commit: string },
): { readonly repo: string; readonly commit: string; readonly trials: readonly Trial[] } {
  if (
    !object(input) ||
    !repositoryFormat(input.format) ||
    input.repo !== pin.repo ||
    input.commit !== pin.commit
  ) {
    throw new Error('Repository manifest is outside the frozen source pin.');
  }
  const trials = input.trials;
  if (!Array.isArray(trials) || !trials.every(trial)) {
    throw new Error('Malformed repository trials.');
  }
  return { ...pin, trials };
}

export function acceptedRoster(input: unknown): readonly RosterEntry[] {
  if (
    !object(input) ||
    input.allSupported !== true ||
    input.q08DefaultSupported !== true ||
    input.q08DefaultMutations !== 8
  ) {
    throw new Error('Native baseline is not accepted.');
  }
  const probes = input.probes;
  if (!Array.isArray(probes) || !probes.every(rosterEntry)) {
    throw new Error('Malformed accepted probe roster.');
  }
  return probes.map(({ scope, probe }) => ({ scope, probe }));
}

export function verifyAcceptedRoster(input: unknown, expected: readonly RosterEntry[]): void {
  if (!isDeepStrictEqual(acceptedRoster(input), expected)) {
    throw new Error('Accepted seven-probe denominator changed.');
  }
}

export function priorChecks(input: unknown): readonly unknown[] {
  if (!object(input) || !object(input.result) || !Array.isArray(input.result.checks)) {
    throw new Error('Missing accepted native checks.');
  }
  return input.result.checks.map((entry: unknown) => {
    if (!object(entry) || !('check' in entry)) throw new Error('Malformed accepted native check.');
    return entry.check;
  });
}

export function priorPages(input: unknown): PriorPages {
  if (!object(input) || !Array.isArray(input.pages) || !input.pages.every(priorPage)) {
    throw new Error('Malformed accepted native pages.');
  }
  return { pages: input.pages };
}

export function defaultResult(input: unknown): {
  readonly supported: boolean;
  readonly mutations: readonly { readonly rejected: boolean }[];
} {
  if (!object(input) || typeof input.supported !== 'boolean') {
    throw new Error('Malformed Q08 default result.');
  }
  const mutations = input.mutations;
  if (!Array.isArray(mutations) || !mutations.every(mutation)) {
    throw new Error('Malformed Q08 mutation results.');
  }
  return { supported: input.supported, mutations };
}

function argument(args: readonly string[], position: number): string {
  const value = args[position];
  if (value === undefined || value === '') throw new Error('Missing replay argument.');
  return value;
}

export function replayArguments(args: readonly string[]): {
  readonly sourceCapture: string;
  readonly baseline: string;
  readonly specifications: string;
  readonly output: string;
  readonly semanticEdgeIdMigration: boolean;
} {
  if (args.length !== 4 && (args.length !== 5 || args[4] !== '--semantic-edge-id-migration')) {
    throw new Error(
      'Usage: scan-native-answerability-replay.ts <repository.json> <accepted-native-directory> <frozen-specifications-directory> <NEW-output> [--semantic-edge-id-migration]',
    );
  }
  return {
    sourceCapture: argument(args, 0),
    baseline: argument(args, 1),
    specifications: argument(args, 2),
    output: argument(args, 3),
    semanticEdgeIdMigration: args.length === 5,
  };
}

function repositoryFormat(value: unknown): boolean {
  return value === 'scan-repository/v1' || value === 'scan-repository/v2';
}
