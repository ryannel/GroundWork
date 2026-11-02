import type { KnowledgeRecord } from './knowledge.generated';

type Expected = readonly [string, KnowledgeRecord['kind']];
function optional(id: string | null, kind: KnowledgeRecord['kind']): Expected[] {
  return id === null ? [] : [[id, kind]];
}

export function runtimeReferences(record: KnowledgeRecord): Expected[] {
  switch (record.kind) {
    case 'runtime_component': {
      return record.sources.map((id) => [id, 'source_revision']);
    }
    case 'execution_binding': {
      return [
        [record.implementation, 'implementation'],
        [record.component, 'runtime_component'],
        ...optional(record.artifactBinding, 'artifact_source_binding'),
      ];
    }
    case 'resource_binding': {
      return [
        [record.resource, 'resource'],
        [record.component, 'runtime_component'],
      ];
    }
    case 'entry_binding': {
      return [
        [record.entry, 'entry'],
        [record.execution, 'execution_binding'],
        [record.contract, 'interface_contract'],
      ];
    }
    case 'interface_contract': {
      return [
        ...optional(record.component, 'runtime_component'),
        ...(record.candidates ?? []).map((id): Expected => [id, 'interface_contract']),
        ...contractReferences(record),
      ];
    }
    case 'interaction': {
      return [
        [record.execution, 'execution_binding'],
        [record.operation, 'operation'],
        [record.contract, 'interface_contract'],
        ...optional(record.target, 'runtime_component'),
        ...optional(record.targetEntry, 'entry'),
        ...optional(record.effect, 'effect'),
        ...optional(record.handoff, 'handoff'),
        ...[...record.requestBindings, ...record.responseBindings].map((item): Expected => [
          item.value,
          'value',
        ]),
      ];
    }
    default: {
      return [];
    }
  }
}

function contractReferences(
  record: Extract<KnowledgeRecord, { readonly kind: 'interface_contract' }>,
): Expected[] {
  const parts = [...record.request, ...record.responses.map((response) => response.body)];
  return [
    ...parts.flatMap((part) => [
      ...optional(part.shape, 'shape'),
      ...optional(part.sourceShape ?? null, 'shape'),
      ...part.gaps.map((id): Expected => [id, 'gap']),
      ...part.evidence.map((id): Expected => [id, 'evidence']),
    ]),
    ...record.responses.flatMap((response) =>
      response.evidence.map((id): Expected => [id, 'evidence']),
    ),
  ];
}
