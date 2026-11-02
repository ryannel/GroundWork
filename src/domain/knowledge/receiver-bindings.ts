import type { KnowledgeRecord, Operation } from './knowledge.generated';

type Records = ReadonlyMap<string, KnowledgeRecord>;

function declarationProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind !== 'implementation') return [];
  const receiver = record.receiver ?? null;
  if (receiver === null) return [];
  const value = byId.get(receiver);
  if (value?.kind !== 'value' || value.role !== 'receiver') {
    return [`${record.id}: instance receiver must reference a receiver value`];
  }
  const owned = value.owner === record.id && value.definition === record.entry;
  const distinct =
    !record.parameters.includes(value.id) && record.captures?.includes(value.id) !== true;
  return owned && distinct
    ? []
    : [`${record.id}: receiver must be distinct and defined at this implementation entry`];
}

function valueProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind !== 'value' || record.role !== 'receiver') return [];
  const owner = byId.get(record.owner);
  return owner?.kind === 'implementation' && owner.receiver === record.id
    ? []
    : [`${record.id}: receiver value must be declared by its implementation`];
}

function targetOf(record: KnowledgeRecord, byId: Records): KnowledgeRecord | undefined {
  if (record.kind !== 'operation' || record.resolution === null) return undefined;
  const resolution = byId.get(record.resolution);
  return resolution?.kind === 'resolution' && resolution.target !== null
    ? byId.get(resolution.target)
    : undefined;
}

function originProblems(record: Operation, byId: Records): string[] {
  const receiver = record.receiver ?? null;
  if (receiver === null) return [];
  const value = byId.get(receiver);
  return value?.kind === 'value' && value.owner === record.owner
    ? []
    : [`${record.id}: actual receiver must belong to caller`];
}

function invocationProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind !== 'operation') return [];
  const target = targetOf(record, byId);
  const expected = target?.kind === 'implementation' && (target.receiver ?? null) !== null;
  const supplied = (record.receiver ?? null) !== null;
  if (!expected && !supplied) return [];
  if (record.action !== 'call') return [`${record.id}: receiver binding requires a call`];
  const errors =
    target?.kind === 'implementation' && expected !== supplied
      ? [`${record.id}: actual receiver must match the bound target declaration`]
      : [];
  return [...errors, ...originProblems(record, byId)];
}

export function receiverBindingProblems(record: KnowledgeRecord, byId: Records): string[] {
  return [
    ...declarationProblems(record, byId),
    ...valueProblems(record, byId),
    ...invocationProblems(record, byId),
  ];
}
