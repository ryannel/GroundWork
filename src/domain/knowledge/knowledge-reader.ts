import type { KnowledgeRecord, KnowledgeSnapshot } from './knowledge.generated';

type LookupIndex = keyof {
  readonly kind: unknown;
  readonly owner: unknown;
  readonly from: unknown;
  readonly to: unknown;
  readonly input: unknown;
  readonly effect: unknown;
  readonly operation: unknown;
  readonly implementation: unknown;
  readonly component: unknown;
  readonly entry: unknown;
  readonly resource: unknown;
  readonly handoff: unknown;
};

/** Indexed, immutable snapshot access. Implementations must never mix snapshots. */
export interface KnowledgeReader {
  readonly snapshot: string;
  readonly rules: KnowledgeSnapshot['rules'];
  readonly get: (id: string) => KnowledgeRecord | undefined;
  readonly select: (index: LookupIndex, value: string) => KnowledgeRecord[];
}

/** Indexed columns are a projection of typed records, never independently authored. */
export function recordIndexes(record: KnowledgeRecord): ReadonlyMap<string, string[]> {
  const indexes = new Map<string, string[]>([['kind', [record.kind]]]);
  if ('owner' in record) indexes.set('owner', [record.owner]);
  if ('from' in record) indexes.set('from', [record.from]);
  if ('to' in record) indexes.set('to', [record.to]);
  if (record.kind === 'handoff') {
    indexes.set('from', [record.effect]);
    indexes.set('to', [record.subscription]);
  }
  if (record.kind === 'storage_write' || record.kind === 'handoff') {
    indexes.set('effect', [record.effect]);
  }
  for (const [key, values] of runtimeIndexes(record)) indexes.set(key, [...values]);
  if ('operation' in record) indexes.set('operation', [record.operation]);
  if (record.kind === 'derivation') indexes.set('input', record.inputs);
  return indexes;
}

function runtimeIndexes(record: KnowledgeRecord): ReadonlyMap<string, readonly string[]> {
  const indexes = new Map<string, readonly string[]>();
  if (record.kind === 'interaction' && record.handoff !== null) {
    indexes.set('handoff', [record.handoff]);
  }
  if ('implementation' in record) indexes.set('implementation', [record.implementation]);
  if ('component' in record && record.component !== null) {
    indexes.set('component', [record.component]);
  }
  if (record.kind === 'entry_binding') indexes.set('entry', [record.entry]);
  if (record.kind === 'resource_binding') indexes.set('resource', [record.resource]);
  return indexes;
}
