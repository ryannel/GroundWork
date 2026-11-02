import type { EvidencePass, EvidenceRecord } from '@/domain/evidence/evidence';

// The one way into a workspace's scan evidence. The site, a command line, an MCP server or a REST route all ask
// through this, so each gets the same answers at the same speed. Every call is synchronous and indexed.

export interface RepositorySummary {
  readonly name: string;
  readonly repo: string;
  readonly commit: string;
  readonly scannedAt: string;
  readonly language: string | null;
  readonly passes: readonly EvidencePass[];
  readonly records: number;
  /** Records per family, e.g. { framework: 3, claims: 5 }. */
  readonly families: Readonly<Record<string, number>>;
}

export interface RepositoryDetail extends RepositorySummary {
  /** What discovery concluded beside its claims (readiness, scopes, gaps), or null when it did not run. */
  readonly discovery: unknown;
}

export interface RecordRow {
  readonly repository: string;
  readonly id: string;
  readonly family: string;
  readonly kind: string;
  readonly label: string;
  readonly path: string | null;
  readonly lineStart: number | null;
  readonly lineEnd: number | null;
}

export interface LinkedRecord {
  readonly field: string;
  readonly record: RecordRow;
}

export interface RecordDetail extends RecordRow {
  readonly record: EvidenceRecord;
  /** The records this one names. */
  readonly linksOut: readonly LinkedRecord[];
  /** The records that name this one. */
  readonly linksIn: readonly LinkedRecord[];
}

export interface RecordFilter {
  readonly family?: string;
  readonly kind?: string;
  /** Records citing this file, in line order. */
  readonly path?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface SearchFilter {
  readonly repository?: string;
  readonly family?: string;
  readonly limit?: number;
}

export interface EvidenceQuery {
  /** When the index was built, and from which evidence. */
  readonly builtAt: string;
  readonly repositories: () => readonly RepositorySummary[];
  readonly repository: (name: string) => RepositoryDetail | null;
  readonly records: (repository: string, filter?: RecordFilter) => readonly RecordRow[];
  readonly record: (repository: string, id: string) => RecordDetail | null;
  /** Records whose label, path or text match every word, best first; a word matches as a prefix. */
  readonly search: (text: string, filter?: SearchFilter) => readonly RecordRow[];
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

export const limitOf = (requested?: number): number =>
  Math.min(Math.max(1, Math.trunc(requested ?? DEFAULT_LIMIT)), MAX_LIMIT);

/** Words as an FTS5 match: each quoted (so punctuation cannot inject syntax) and matched as a prefix. */
export function matchExpression(text: string): string | null {
  const words = text
    .split(/[^\p{L}\p{N}_.]+/u)
    .map((word) => word.replaceAll('"', ''))
    .filter((word) => word.length > 0);
  return words.length === 0 ? null : words.map((word) => `"${word}"*`).join(' ');
}
