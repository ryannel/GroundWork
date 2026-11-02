import type { Handoff, KnowledgeRecord } from './knowledge.generated';
import { storageContextProblems } from './storage-context';

type Records = ReadonlyMap<string, KnowledgeRecord>;

function ownedReferences(record: KnowledgeRecord): string[] {
  switch (record.kind) {
    case 'delivery_policy': {
      return [record.operation, ...record.deduplicationKeys];
    }
    case 'milestone': {
      return [record.operation];
    }
    case 'subscription': {
      return [record.payload, record.policy];
    }
    default: {
      return [];
    }
  }
}

function handoffBindings(record: Handoff, byId: Records): string[] {
  const owner = byId.get(record.owner);
  const binding = byId.get(record.binding);
  const effect = byId.get(record.effect);
  if (
    owner?.kind !== 'implementation' ||
    binding?.kind !== 'channel_binding' ||
    effect?.kind !== 'effect'
  ) {
    return [];
  }
  const errors: string[] = [];
  if (owner.scope !== binding.source || effect.resource !== binding.resource) {
    errors.push(`${record.id}: producer source and resource must match channel binding`);
  }
  errors.push(...producerValues(record, byId));
  const subscription = byId.get(record.subscription);
  if (subscription?.kind === 'subscription') errors.push(...subscriberSource(subscription, byId));
  return errors;
}

function subscriberSource(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind !== 'subscription') return [];
  const owner = byId.get(record.owner);
  const binding = byId.get(record.binding);
  if (owner?.kind !== 'implementation' || binding?.kind !== 'channel_binding') return [];
  return owner.scope === binding.source
    ? []
    : [`${record.id}: subscriber source must match channel binding`];
}

export function asyncOwnershipProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind === 'storage_write') return storageContextProblems(record, byId);
  if (!('owner' in record)) return [];
  const errors = ownedReferences(record).flatMap((id) => {
    const target = byId.get(id);
    return target !== undefined && 'owner' in target && target.owner === record.owner
      ? []
      : [`${record.id}: ${id} must share owning implementation`];
  });
  if (record.kind === 'handoff') errors.push(...handoffBindings(record, byId));
  if (record.kind === 'subscription') errors.push(...subscriberSource(record, byId));
  return errors;
}

export function wireShapeProblems(record: KnowledgeRecord): string[] {
  if (record.kind !== 'shape') return [];
  if (record.container === 'array' && (record.items === undefined || record.fields.length > 0)) {
    return [`${record.id}: array shape requires items and no object fields`];
  }
  if (record.container !== 'array' && record.items !== undefined) {
    return [`${record.id}: only array shapes have items`];
  }
  if (record.encoding !== 'protobuf') return [];
  const tags = record.fields.map((field) => field.wireTag);
  const invalid = tags.some(
    (tag) => tag === undefined || record.reservedTags?.includes(tag) === true,
  );
  return invalid || new Set(tags).size !== tags.length
    ? [`${record.id}: protobuf tags must be present, unique and not reserved`]
    : [];
}

function producerValues(record: Handoff, byId: Records): string[] {
  const errors: string[] = [];
  if ((record.partitionKey === 'value') !== (record.keyValue !== null)) {
    errors.push(`${record.id}: partition key value must match key mode`);
  }
  const values = [
    ...(record.keyValue === null ? [] : [record.keyValue]),
    ...record.correlation.map((item) => item.value),
  ];
  if (
    values.some((id) => {
      const value = byId.get(id);
      return value?.kind !== 'value' || value.owner !== record.owner;
    })
  ) {
    errors.push(`${record.id}: key and correlation values must belong to producer`);
  }
  return errors;
}
