// A repository's current scan evidence, committed in <workspace>/evidence/<name>/. It is what the last scan found,
// at one commit: a rescan overwrites it, and git holds the scans before.

export const EVIDENCE_FORMAT = 'groundwork-evidence/v1';

/** The passes a repository's evidence came from: the scripted source pass, the LLM discovery pass, or both. */
export type EvidencePass = 'source' | 'discovery';

export interface EvidenceRepository {
  readonly format: typeof EVIDENCE_FORMAT;
  readonly repo: string;
  readonly commit: string;
  readonly scannedAt: string;
  readonly language: string | null;
  readonly trackedFiles: number;
  readonly selectedFiles: number;
  readonly passes: readonly EvidencePass[];
}

/** One fact, in the scan's own record shape (`scan/v1`), less the repository and commit it shares. */
export interface EvidenceRecord {
  readonly kind: string;
  readonly id: string;
  readonly [field: string]: unknown;
}

/** A JSON object read from evidence, before its fields are checked. */
export type EvidenceFields = Readonly<Record<string, unknown>>;

const isFields = (value: unknown): value is EvidenceFields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isEvidenceRecord = (value: unknown): value is EvidenceRecord =>
  isFields(value) && typeof value.id === 'string' && typeof value.kind === 'string';

export const fieldsOf = (value: unknown): EvidenceFields => (isFields(value) ? value : {});

export const listOf = (value: unknown): readonly EvidenceFields[] =>
  Array.isArray(value) ? value.filter(isFields) : [];

export const textOf = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

/** Every string a value holds, at any depth: how records name the records they rest on. */
export function stringsIn(value: unknown): Set<string> {
  const found = new Set<string>();
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const next = pending.pop();
    if (typeof next === 'string') found.add(next);
    else if (Array.isArray(next)) for (const item of next) pending.push(item);
    else if (isFields(next)) for (const item of Object.values(next)) pending.push(item);
  }
  return found;
}

/** Record files committed beside repository.json, one record per line, in id order. */
export const EVIDENCE_FAMILIES = [
  'files',
  'hosts',
  'framework',
  'contracts',
  'bindings',
  'summaries',
  'gaps',
  'sources',
  'rules',
  'derivations',
  'effects',
  'actors',
  'surfaces',
  'controls',
  'actions',
  'outcomes',
  'executions',
  'journeys',
  'dependencies',
  'closures',
  'claims',
  'schemas',
] as const;
export type EvidenceFamily = (typeof EVIDENCE_FAMILIES)[number];

/**
 * Call-level analysis: a record per call site, binding and unresolved call. It follows mechanically from the code at
 * the commit, like the syntax graph, and is too large for git, so it lives in the git-ignored
 * .groundwork/analysis/ cache and the index reads it from there.
 */
export const ANALYSIS_FAMILIES: ReadonlySet<string> = new Set(['bindings', 'summaries', 'gaps']);

/** Scan record families that record how a scan ran rather than what it found. They are not kept. */
export const PROCESS_FAMILIES: readonly string[] = ['obligations', 'receipts'];
