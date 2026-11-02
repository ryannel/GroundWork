import type { Implementation, KnowledgeRecord, Operation } from './knowledge.generated';

type Records = ReadonlyMap<string, KnowledgeRecord>;

function validCapture(record: Implementation, value: KnowledgeRecord | undefined): boolean {
  if (value?.kind !== 'value' || value.role !== 'capture') return false;
  if (value.owner !== record.id || value.definition !== record.entry) return false;
  return !record.parameters.includes(value.id);
}

function declarationProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind !== 'implementation') return [];
  const captures = record.captures ?? [];
  const invalid = captures.some((id) => !validCapture(record, byId.get(id)));
  return invalid || new Set(captures).size !== captures.length
    ? [`${record.id}: captures must be unique lexical values defined at this implementation entry`]
    : [];
}

function valueProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind !== 'value' || record.role !== 'capture') return [];
  const owner = byId.get(record.owner);
  return owner?.kind === 'implementation' && owner.captures?.includes(record.id) === true
    ? []
    : [`${record.id}: lexical value must be declared in its implementation captures`];
}

function targetOf(record: KnowledgeRecord, byId: Records): KnowledgeRecord | undefined {
  if (record.kind !== 'operation' || record.resolution === null) return undefined;
  const resolution = byId.get(record.resolution);
  return resolution?.kind === 'resolution' && resolution.target !== null
    ? byId.get(resolution.target)
    : undefined;
}

function completeBindings(record: Operation, expected: readonly string[]): boolean {
  const supplied = (record.captureBindings ?? []).map((binding) => binding.capture);
  return (
    new Set(supplied).size === supplied.length &&
    supplied.length === expected.length &&
    expected.every((id) => supplied.includes(id))
  );
}

function invocationProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind !== 'operation') return [];
  const bindings = record.captureBindings ?? [];
  const target = targetOf(record, byId);
  const expected = target?.kind === 'implementation' ? (target.captures ?? []) : [];
  if (bindings.length === 0 && expected.length === 0) return [];
  if (record.action !== 'call' || target?.kind !== 'implementation') {
    return [`${record.id}: lexical bindings require a bound call target`];
  }
  if (!completeBindings(record, expected)) {
    return [`${record.id}: lexical bindings must be complete and unique`];
  }
  return bindings.flatMap((binding) => {
    const value = byId.get(binding.value);
    return value?.kind === 'value' && value.owner === record.owner
      ? []
      : [`${record.id}: lexical origins must belong to caller`];
  });
}

/** Capturing a value does not establish when, how often or where a delegate is invoked. */
export function captureBindingProblems(record: KnowledgeRecord, byId: Records): string[] {
  return [
    ...declarationProblems(record, byId),
    ...valueProblems(record, byId),
    ...invocationProblems(record, byId),
  ];
}
