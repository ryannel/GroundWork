import { asyncReferences } from './async-references';
import type { KnowledgeRecord } from './knowledge.generated';
import { runtimeReferences } from './runtime-references';

function nullable(value: string | null): string[] {
  return value === null ? [] : [value];
}

function executionReferences(record: KnowledgeRecord): string[] {
  switch (record.kind) {
    case 'resolution': {
      return [
        ...record.candidates,
        ...nullable(record.target),
        ...nullable(record.requestedArtifact),
        ...nullable(record.binding),
      ];
    }
    case 'implementation': {
      return [
        record.scope,
        record.entry,
        ...record.parameters,
        ...(record.captures ?? []),
        ...nullable(record.receiver ?? null),
      ];
    }
    case 'operation': {
      return [
        ...nullable(record.resolution),
        ...nullable(record.result),
        ...nullable(record.receiver ?? null),
        ...record.bindings.map((binding) => binding.value),
        ...(record.captureBindings ?? []).flatMap((binding) => [binding.capture, binding.value]),
      ];
    }
    case 'transition': {
      return [record.from, record.to, ...record.values];
    }
    case 'value': {
      return [record.definition, ...nullable(record.shape)];
    }
    case 'flow': {
      return [record.from, record.to, record.at, ...record.gaps];
    }
    case 'effect': {
      return [record.operation, record.resource, ...record.selection, ...record.payload];
    }
    default: {
      return [];
    }
  }
}

function descriptiveReferences(record: KnowledgeRecord): string[] {
  switch (record.kind) {
    case 'entry': {
      return [record.implementation];
    }
    case 'artifact_source_binding': {
      return [record.artifact, record.source];
    }
    case 'shape': {
      return [
        ...record.gaps,
        ...(record.items === undefined ? [] : [record.items]),
        ...record.fields.flatMap((field) => [
          ...(field.shape === undefined ? [] : [field.shape]),
          ...(field.evidence ?? []),
        ]),
      ];
    }
    case 'resource': {
      return [...record.shapes, ...record.gaps];
    }
    case 'coverage': {
      return record.gaps;
    }
    case 'claim': {
      return record.inputs;
    }
    case 'derivation': {
      return [record.output, ...record.inputs];
    }
    default: {
      return [];
    }
  }
}

/** References select records in an immutable bundle selection; labels are never references. */
export function recordReferences(record: KnowledgeRecord): string[] {
  const references = 'evidence' in record ? [...record.evidence] : [];
  if ('owner' in record) references.push(record.owner);
  return [
    ...references,
    ...executionReferences(record),
    ...descriptiveReferences(record),
    ...asyncReferences(record),
    ...runtimeReferences(record).map(([id]) => id),
  ];
}
