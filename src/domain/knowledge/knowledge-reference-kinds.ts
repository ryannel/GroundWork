import type { KnowledgeRecord } from './knowledge.generated';

type Expected = readonly [string, KnowledgeRecord['kind']];

function executionKinds(record: KnowledgeRecord): Expected[] {
  if (record.kind === 'implementation') {
    return [
      [record.scope, 'source_revision'],
      [record.entry, 'operation'],
      ...record.parameters.map((id): Expected => [id, 'value']),
      ...(record.captures ?? []).map((id): Expected => [id, 'value']),
      ...optional(record.receiver ?? null, 'value'),
    ];
  }
  if (record.kind === 'operation') {
    return [
      ...record.bindings.map((binding): Expected => [binding.value, 'value']),
      ...(record.captureBindings ?? []).flatMap((binding): Expected[] => [
        [binding.capture, 'value'],
        [binding.value, 'value'],
      ]),
      ...optional(record.resolution, 'resolution'),
      ...optional(record.result, 'value'),
      ...optional(record.receiver ?? null, 'value'),
    ];
  }
  if (record.kind === 'resolution') {
    return [
      ...optional(record.requestedArtifact, 'artifact'),
      ...optional(record.target, 'implementation'),
      ...optional(record.binding, 'artifact_source_binding'),
      ...record.candidates.map((id): Expected => [id, 'implementation']),
    ];
  }
  if (record.kind === 'value') {
    return [[record.definition, 'operation'], ...optional(record.shape, 'shape')];
  }
  return [];
}

function optional(id: string | null, kind: KnowledgeRecord['kind']): Expected[] {
  return id === null ? [] : [[id, kind]];
}

function descriptiveKinds(record: KnowledgeRecord): Expected[] {
  if (record.kind === 'entry') return [[record.implementation, 'implementation']];
  if (record.kind === 'artifact_source_binding') {
    return [
      [record.artifact, 'artifact'],
      [record.source, 'source_revision'],
    ];
  }
  if (record.kind === 'effect') {
    return [
      [record.operation, 'operation'],
      [record.resource, 'resource'],
      ...record.selection.map((id): Expected => [id, 'value']),
      ...record.payload.map((id): Expected => [id, 'value']),
    ];
  }
  if (record.kind === 'shape') {
    return [
      ...(record.items === undefined ? [] : [[record.items, 'shape'] satisfies Expected]),
      ...record.fields.flatMap((field): Expected[] => [
        ...(field.shape === undefined ? [] : [[field.shape, 'shape'] satisfies Expected]),
        ...(field.evidence ?? []).map((id): Expected => [id, 'evidence']),
      ]),
    ];
  }
  if (record.kind === 'resource') return record.shapes.map((id) => [id, 'shape']);
  return [];
}

export function referenceKindProblems(
  record: KnowledgeRecord,
  byId: ReadonlyMap<string, KnowledgeRecord>,
): string[] {
  const expected = [...executionKinds(record), ...descriptiveKinds(record)];
  if ('evidence' in record) {
    expected.push(...record.evidence.map((id): Expected => [id, 'evidence']));
  }
  if ('gaps' in record) expected.push(...record.gaps.map((id): Expected => [id, 'gap']));
  return expected.flatMap(([id, kind]) =>
    byId.get(id)?.kind === kind ? [] : [`${record.id}: ${id} must reference ${kind}`],
  );
}
