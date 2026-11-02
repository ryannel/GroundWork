import type { Interaction, KnowledgeRecord } from './knowledge.generated';

type Records = ReadonlyMap<string, KnowledgeRecord>;

function consumptionProblems(record: Interaction, byId: Records): string[] {
  const target = record.target === null ? undefined : byId.get(record.target);
  const errors = consumptionEntryProblems(record, byId);
  if (record.effect !== null) {
    errors.push(`${record.id}: consumption cannot assert an outbound effect`);
  }
  const local = record.boundary === 'in_process';
  if (target?.kind === 'runtime_component' && target.category !== 'topic' && !local) {
    errors.push(`${record.id}: consumption requires a topic component`);
  }
  if (record.handoff === null && record.gaps.length === 0) {
    errors.push(`${record.id}: unmatched consumption requires an explicit handoff gap`);
  }
  return errors;
}

function consumptionEntryProblems(record: Interaction, byId: Records): string[] {
  const operation = byId.get(record.operation);
  const owner = byId.get(record.owner);
  if (operation?.kind !== 'operation' || owner?.kind !== 'implementation') return [];
  return operation.action === 'entry' && owner.entry === operation.id
    ? []
    : [`${record.id}: consumption must run at its implementation entry`];
}

export function interactionModeProblems(record: Interaction, byId: Records): string[] {
  if (record.mode === 'consume') return consumptionProblems(record, byId);
  const effect = record.effect === null ? undefined : byId.get(record.effect);
  const operation = byId.get(record.operation);
  const expected = {
    request_response: 'call',
    publish: 'publish',
    read: 'read',
    write: 'write',
    unknown: null,
  };
  const errors: string[] = [];
  if (
    effect?.kind === 'effect' &&
    expected[record.mode] !== null &&
    effect.effect !== expected[record.mode]
  ) {
    errors.push(`${record.id}: interaction mode must agree with its effect kind`);
  }
  if (operation?.kind !== 'operation') return errors;
  if (['entry', 'return', 'throw'].includes(operation.action)) {
    errors.push(`${record.id}: outbound interaction requires an executing call site`);
  }
  if (
    ['publish', 'request_response'].includes(record.mode) &&
    !['call', 'opaque'].includes(operation.action)
  ) {
    errors.push(`${record.id}: network call or publication requires a call or opaque operation`);
  }
  return errors;
}
