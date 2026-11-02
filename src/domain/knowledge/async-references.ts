import type { KnowledgeRecord } from './knowledge.generated';
import { storageContextReferences } from './storage-context';

export function asyncReferences(record: KnowledgeRecord): string[] {
  switch (record.kind) {
    case 'storage_write': {
      return [
        record.effect,
        record.stagedAt,
        record.acknowledgedAt,
        ...storageContextReferences(record),
        ...record.fields.map((field) => field.value),
      ];
    }
    case 'channel_binding': {
      return [record.resource, record.source];
    }
    case 'delivery_policy': {
      return [record.operation, ...record.deduplicationKeys];
    }
    case 'subscription': {
      return [record.binding, record.payload, record.policy];
    }
    case 'handoff': {
      return [
        record.effect,
        record.binding,
        record.subscription,
        record.wireShape,
        record.policy,
        ...(record.keyValue === null ? [] : [record.keyValue]),
        ...record.bindings.flatMap((binding) => [binding.from, binding.to]),
        ...record.correlation.map((item) => item.value),
      ];
    }
    case 'consistency_boundary': {
      return [...record.effects, ...record.order];
    }
    case 'milestone': {
      return [record.operation, ...(record.resource === null ? [] : [record.resource])];
    }
    default: {
      return [];
    }
  }
}
