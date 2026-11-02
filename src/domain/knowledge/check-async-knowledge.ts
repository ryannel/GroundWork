import { asyncOwnershipProblems, wireShapeProblems } from './async-ownership';
import { shapeConstraintProblems } from './check-shape-constraints';
import { subscriptionProblems } from './check-subscription';
import { handoffMatch } from './handoff-match';
import type { Handoff, KnowledgeRecord } from './knowledge.generated';
import { storageContextReferences } from './storage-context';

type Records = ReadonlyMap<string, KnowledgeRecord>;
type Expected = readonly [string, KnowledgeRecord['kind']];

function typedReferences(record: KnowledgeRecord): Expected[] {
  switch (record.kind) {
    case 'storage_write': {
      return [
        [record.effect, 'effect'],
        [record.stagedAt, 'operation'],
        [record.acknowledgedAt, 'operation'],
        ...record.fields.map((field): Expected => [field.value, 'value']),
        ...storageContextReferences(record).map((id): Expected => [id, 'operation']),
      ];
    }
    case 'channel_binding': {
      return [
        [record.resource, 'resource'],
        [record.source, 'source_revision'],
      ];
    }
    case 'delivery_policy': {
      return [
        [record.operation, 'operation'],
        ...record.deduplicationKeys.map((id): Expected => [id, 'value']),
      ];
    }
    case 'subscription': {
      return [
        [record.binding, 'channel_binding'],
        [record.payload, 'value'],
        [record.policy, 'delivery_policy'],
      ];
    }
    case 'handoff': {
      return [
        [record.effect, 'effect'],
        [record.binding, 'channel_binding'],
        [record.subscription, 'subscription'],
        [record.wireShape, 'shape'],
        [record.policy, 'delivery_policy'],
      ];
    }
    case 'consistency_boundary': {
      return [
        ...record.effects.map((id): Expected => [id, 'effect']),
        ...record.order.map((id): Expected => [id, 'operation']),
      ];
    }
    case 'milestone': {
      return [
        [record.operation, 'operation'],
        ...(record.resource === null ? [] : [[record.resource, 'resource'] satisfies Expected]),
      ];
    }
    default: {
      return [];
    }
  }
}

function handoffProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind !== 'handoff') return [];
  const effect = byId.get(record.effect);
  const subscription = byId.get(record.subscription);
  if (effect?.kind !== 'effect' || effect.effect !== 'publish' || effect.owner !== record.owner) {
    return [`${record.id}: handoff requires its producer's publication effect`];
  }
  if (subscription?.kind !== 'subscription') return [];
  if (invalidHandoffBindings(record, byId, subscription.owner)) {
    return [`${record.id}: handoff values must bind producer to subscriber`];
  }
  return matchedSourceProblems(record, byId);
}

function matchedSourceProblems(record: Handoff, byId: Records): string[] {
  const binding = byId.get(record.binding);
  const environment = binding?.kind === 'channel_binding' ? binding.environment : '';
  if (record.status !== 'source_matched') return [];
  const mismatch = handoffMatch((id) => byId.get(id), record, environment);
  return mismatch === null && record.compatibility === 'source_schema_match'
    ? []
    : [`${record.id}: ${mismatch ?? 'unresolved wire compatibility'}`];
}

export function checkAsyncKnowledge(record: KnowledgeRecord, byId: Records): string[] {
  const errors = typedReferences(record).flatMap(([id, kind]) =>
    byId.get(id)?.kind === kind ? [] : [`${record.id}: ${id} must reference ${kind}`],
  );
  if (record.kind === 'storage_write') {
    const effect = byId.get(record.effect);
    if (effect?.kind !== 'effect' || effect.effect !== 'write') {
      errors.push(`${record.id}: storage acknowledgement requires a write effect`);
    }
  }
  return [
    ...errors,
    ...handoffProblems(record, byId),
    ...asyncOwnershipProblems(record, byId),
    ...wireShapeProblems(record),
    ...shapeConstraintProblems(record),
    ...subscriptionProblems(record),
  ];
}

function invalidHandoffBindings(record: Handoff, byId: Records, subscriber: string): boolean {
  return record.bindings.some((binding) => {
    const from = byId.get(binding.from);
    const to = byId.get(binding.to);
    if (from?.kind !== 'value' || to?.kind !== 'value') return true;
    return from.owner !== record.owner || to.owner !== subscriber;
  });
}
