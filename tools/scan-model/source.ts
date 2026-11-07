import { createHash } from 'node:crypto';

import { repositoryGit, repositoryInventory } from '@/../tools/scan-repository-inventory';
import { buildId } from '@/domain/ids';
import type { ContractData } from '@/domain/model/contracts.generated';
import type { ModelCite } from '@/domain/workspace-model';
import { readPinnedSource } from '@/infrastructure/scan/scoped-source-git';

type Code = Extract<ModelCite, { readonly kind: 'code' }>;
type Source = ContractData<'evidence', 'Source'>;
type EvidenceFile = ContractData<'evidence', 'EvidenceFile'>;
type ScopeEntry = ReturnType<typeof repositoryInventory>['files'][number];
type GapReason =
  'missing_file' | 'changed_blob' | 'unavailable_pin' | 'missing_span' | 'ambiguous_span';

interface PinnedScan {
  readonly tree: string;
  readonly trackedFiles: number;
  readonly selectedFiles: number;
  readonly evidence: ReadonlyMap<string, Source>;
  readonly unavailable: readonly (Code & { readonly reason: GapReason })[];
  readonly checkedFiles: number;
  readonly checkedBlobs: number;
}

interface SourceInput {
  readonly repo: string;
  readonly repository: string;
  readonly commit: string;
  readonly host: string;
  readonly files: ReadonlyMap<string, EvidenceFile>;
  readonly sources: readonly Source[];
  readonly references: readonly Code[];
}

const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function blobsAt(repository: string, commit: string): ReadonlyMap<string, string> {
  if (!/^[a-f\d]{40,64}$/u.test(commit)) throw new Error('A source citation needs a full commit.');
  const tree = repositoryGit(repository, ['ls-tree', '-rz', '--full-tree', commit]);
  return new Map(
    tree
      .toString('utf8')
      .split('\0')
      .filter(Boolean)
      .flatMap((line) => {
        const separator = line.indexOf('\t');
        const [mode, kind, blob] = line.slice(0, separator).split(' ');
        if (kind !== 'blob' || blob === undefined) return [];
        if (mode !== '100644' && mode !== '100755') return [];
        return [[line.slice(separator + 1), blob] as const];
      }),
  );
}

export function sourceKey(source: Code): string {
  return JSON.stringify([source.repo, source.commit, source.path, source.lines, source.symbol]);
}

function spanKey(source: Pick<Source, 'file' | 'lines' | 'symbol'>): string {
  return JSON.stringify([source.file, source.lines, source.symbol]);
}

export function stepSpanOf(source: Pick<Source, 'file' | 'lines'>): string {
  return JSON.stringify([source.file, source.lines]);
}

function existingSpans(sources: readonly Source[]): ReadonlyMap<string, readonly Source[]> {
  const result = new Map<string, Source[]>();
  for (const source of sources) {
    const key = spanKey(source);
    const previous = result.get(key) ?? [];
    previous.push(source);
    result.set(key, previous);
  }
  return result;
}

function observationState(input: SourceInput, files: readonly ScopeEntry[]) {
  return {
    current: new Map(files.map((entry) => [entry.path, entry])),
    historic: new Map<string, ReadonlyMap<string, string> | null>(),
    text: new Map<string, readonly string[]>(),
    checked: new Set<string>(),
    previous: existingSpans(input.sources),
  };
}

type ObservedSource = ReturnType<typeof observationState>;
type Observation = { readonly record: Source } | { readonly reason: GapReason };

function verifyHistory(
  source: Code,
  entry: ScopeEntry,
  input: SourceInput,
  state: ObservedSource,
): GapReason | null {
  if (source.commit === input.commit) return null;
  if (!state.historic.has(source.commit)) {
    try {
      state.historic.set(source.commit, blobsAt(input.repository, source.commit));
    } catch {
      state.historic.set(source.commit, null);
    }
  }
  const history = state.historic.get(source.commit);
  if (history === null || history === undefined) return 'unavailable_pin';
  return history.get(source.path) === entry.blob ? null : 'changed_blob';
}

function readObservation(source: Code, input: SourceInput, state: ObservedSource): Observation {
  const file = input.files.get(source.path);
  const entry = state.current.get(source.path);
  if (file === undefined || entry === undefined) return { reason: 'missing_file' };
  if (file.blob !== entry.blob) return { reason: 'changed_blob' };
  const history = verifyHistory(source, entry, input, state);
  if (history !== null) return { reason: history };
  if (source.lines === undefined) return { reason: 'missing_span' };
  return recordSpan(source, source.lines, file, input, state);
}

function recordSpan(
  source: Code,
  lines: readonly [number, number],
  file: EvidenceFile,
  input: SourceInput,
  state: ObservedSource,
): Observation {
  const sourceLines =
    state.text.get(file.blob) ?? readPinnedSource(input.repository, file.blob).split(/\r?\n/u);
  state.text.set(file.blob, sourceLines);
  state.checked.add(file.path);
  if (lines[0] < 1 || lines[1] < lines[0] || lines[1] > sourceLines.length) {
    return { reason: 'missing_span' };
  }
  const span = {
    file: file.id,
    lines,
    ...(source.symbol === undefined ? {} : { symbol: source.symbol }),
  };
  const anchors = state.previous.get(spanKey(span)) ?? [];
  if (anchors.length > 1) return { reason: 'ambiguous_span' };
  if (anchors[0] !== undefined) return { record: anchors[0] };
  const content = sourceLines.slice(lines[0] - 1, lines[1]);
  const signature = fingerprint([source.path, source.symbol, content]);
  return {
    record: {
      kind: 'source',
      id: buildId('ev', `scan-source-${fingerprint([input.repo, signature, lines]).slice(0, 32)}`),
      host: input.host,
      authority: 'declared',
      signature,
      ...span,
    },
  };
}

/** Read the pinned tree and re-observe model spans whose Git blobs still agree. */
export function scanSource(input: SourceInput): PinnedScan {
  const inventory = repositoryInventory(input.repository, input.commit);
  if (inventory.commit !== input.commit) throw new Error('The requested source pin changed.');
  const state = observationState(input, inventory.files);
  const evidence = new Map<string, Source>();
  const unavailable: (Code & { readonly reason: GapReason })[] = [];
  const candidates = new Map(
    input.references
      .filter((source) => source.repo === input.repo)
      .map((source) => [sourceKey(source), source]),
  );
  for (const [key, source] of candidates) {
    const observed = readObservation(source, input, state);
    if ('reason' in observed) unavailable.push({ ...source, reason: observed.reason });
    else evidence.set(key, observed.record);
  }
  return {
    tree: inventory.tree,
    trackedFiles: inventory.files.length,
    selectedFiles: inventory.files.filter((file) => file.selectedForParsing).length,
    evidence,
    unavailable,
    checkedFiles: state.checked.size,
    checkedBlobs: state.text.size,
  };
}
