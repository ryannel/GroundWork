import type { KnowledgeRecord, Operation } from './knowledge.generated';

type Records = ReadonlyMap<string, KnowledgeRecord>;

function isVoid(record: KnowledgeRecord | undefined): boolean {
  return record?.kind === 'implementation' && record.returnKind === 'void';
}

function invocationProblems(record: Operation, byId: Records): string[] {
  if (record.resolution === null) return [];
  const resolution = byId.get(record.resolution);
  if (resolution?.kind !== 'resolution' || resolution.target === null) return [];
  const target = byId.get(resolution.target);
  return isVoid(target) ? [`${record.id}: bound void invocation cannot define a result`] : [];
}

/** Immediate source returns differ from asynchronous completion and object allocation. */
export function returnKindProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind !== 'operation' || record.result === null) return [];
  if (record.action === 'return') {
    return isVoid(byId.get(record.owner))
      ? [`${record.id}: void implementation cannot return a value`]
      : [];
  }
  return record.action === 'call' ? invocationProblems(record, byId) : [];
}
