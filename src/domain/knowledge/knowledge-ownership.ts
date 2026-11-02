import type { KnowledgeRecord } from './knowledge.generated';

type Records = ReadonlyMap<string, KnowledgeRecord>;

const catalogueOwners: ReadonlySet<KnowledgeRecord['kind']> = new Set([
  'entry',
  'source_revision',
  'artifact',
  'shape',
  'resource',
  'runtime_component',
  'interface_contract',
  'channel_binding',
  'subscription',
]);

function definitionProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind === 'value') {
    const definition = byId.get(record.definition);
    return definition?.kind === 'operation' && definition.owner === record.owner
      ? []
      : [`${record.id}: value definition must belong to owning implementation`];
  }
  if (record.kind === 'implementation') {
    const entry = byId.get(record.entry);
    const parameters = record.parameters.map((id) => byId.get(id));
    if (entry?.kind !== 'operation' || entry.owner !== record.id) {
      return [`${record.id}: entry must belong to implementation`];
    }
    return parameters.every(
      (parameter) =>
        parameter?.kind === 'value' &&
        parameter.owner === record.id &&
        parameter.role === 'parameter',
    )
      ? []
      : [`${record.id}: parameters must belong to implementation`];
  }
  return [];
}

function bindingProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind !== 'operation') return [];
  const values = record.bindings.map((binding) => byId.get(binding.value));
  const wrongOwner = values.some(
    (value) => value?.kind !== 'value' || value.owner !== record.owner,
  );
  return wrongOwner ? [`${record.id}: actual arguments must belong to caller`] : [];
}

export function ownershipProblems(record: KnowledgeRecord, byId: Records): string[] {
  const problems = [...definitionProblems(record, byId), ...bindingProblems(record, byId)];
  if (!('owner' in record)) return problems;
  const owner = byId.get(record.owner);
  const descriptive =
    record.kind === 'gap' || record.kind === 'coverage' || record.kind === 'claim';
  const allowed =
    owner?.kind === 'implementation' ||
    (descriptive && owner !== undefined && catalogueOwners.has(owner.kind));
  if (!allowed) problems.push(`${record.id}: invalid owner kind`);
  return problems;
}
