import { interactionBindingProblems } from './check-interaction-bindings';
import { interactionHandoffProblems } from './check-interaction-handoff';
import { interactionModeProblems } from './check-interaction-mode';
import { interactionTargetProblems } from './check-interaction-target';
import type { Interaction, KnowledgeRecord } from './knowledge.generated';

type Records = ReadonlyMap<string, KnowledgeRecord>;
function ownedValues(record: Interaction, byId: Records): string[] {
  return [...record.requestBindings, ...record.responseBindings].flatMap((binding) => {
    const value = byId.get(binding.value);
    return value?.kind === 'value' && value.owner === record.owner
      ? []
      : [`${record.id}: transferred values must belong to caller or consumer implementation`];
  });
}
function localProblems(record: Interaction, component: string): string[] {
  if (record.boundary !== 'in_process') return [];
  return record.target === component
    ? []
    : [`${record.id}: in-process target must be its execution component`];
}
function effectProblems(record: Interaction, byId: Records): string[] {
  if (record.effect === null) return [];
  const effect = byId.get(record.effect);
  const contract = byId.get(record.contract);
  if (effect?.kind !== 'effect' || contract?.kind !== 'interface_contract') return [];
  if (effect.owner !== record.owner || effect.operation !== record.operation) {
    return [`${record.id}: interaction effect must belong to its call site`];
  }
  if (record.target === null) return [];
  const roles = {
    read: 'storage',
    write: 'storage',
    publish: 'transport',
    request_response: 'remote_interface',
    unknown: null,
    consume: 'transport',
  };
  const role = roles[record.mode];
  const local = record.boundary === 'in_process';
  const matched = [...byId.values()].some((item) => {
    if (item.kind !== 'resource_binding') return false;
    if ((item.scope === 'in_process') !== local) return false;
    return (
      item.resource === effect.resource &&
      item.component === record.target &&
      (role === null || item.role === role)
    );
  });
  return matched ? [] : [`${record.id}: effect resource requires matching runtime binding`];
}
export function interactionProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind !== 'interaction') return [];
  const execution = byId.get(record.execution);
  const operation = byId.get(record.operation);
  if (execution?.kind !== 'execution_binding' || operation?.kind !== 'operation') return [];
  const errors =
    execution.implementation === record.owner && operation.owner === record.owner
      ? []
      : [`${record.id}: interaction call site and runtime execution must share implementation`];
  return [
    ...errors,
    ...ownedValues(record, byId),
    ...interactionTargetProblems(record, byId),
    ...localProblems(record, execution.component),
    ...effectProblems(record, byId),
    ...interactionHandoffProblems(record, byId),
    ...interactionModeProblems(record, byId),
    ...interactionBindingProblems(record, byId),
  ];
}
