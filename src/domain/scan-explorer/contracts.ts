import type { KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import type {
  EntryBinding,
  Interaction,
  InterfaceContract,
  KnowledgeRecord,
  RuntimeComponent,
} from '@/domain/knowledge/knowledge.generated';

/** Disposable views of selected canonical snapshots, never a second system model. */
export interface ExplorerSelection {
  readonly reader: KnowledgeReader;
  readonly scope: string;
  readonly completeness: 'partial' | 'scoped';
  readonly limitations: readonly string[];
}

export interface Located<T> {
  readonly snapshot: string;
  readonly record: Readonly<T>;
}

export interface ExplorerIndex {
  readonly selections: readonly ExplorerSelection[];
  readonly components: readonly Located<RuntimeComponent>[];
  readonly entries: readonly Located<EntryBinding>[];
  readonly interactions: readonly Located<Interaction>[];
}

export interface PageRequest {
  readonly limit: number;
  readonly offset?: number;
}

export interface SourceLink {
  readonly snapshot: string;
  readonly evidence: string;
  readonly url: string;
}

export interface ExplorerPage<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly nextOffset: number | null;
  readonly truncated: boolean;
  readonly sourceLinks: readonly SourceLink[];
  readonly coverage: readonly Omit<ExplorerSelection, 'reader'>[];
  readonly exhaustive: false;
  readonly deployment: 'not_verified';
}

export interface Correspondence {
  readonly interaction: Located<Interaction>;
  readonly callerContract: Located<InterfaceContract> | null;
  readonly provider: Located<EntryBinding> | null;
  readonly providerContract: Located<InterfaceContract> | null;
  readonly status: 'confirmed' | 'candidate' | 'ambiguous' | 'unresolved';
  readonly reasons: readonly string[];
  readonly payloadCompatibility: 'not_checked';
}

export type ExplorerRecord = Located<KnowledgeRecord>;
