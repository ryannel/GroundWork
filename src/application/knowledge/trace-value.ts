import type { KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import type { QueryRequest, QueryResponse, Value } from '@/domain/knowledge/knowledge.generated';

import { invocationOrigins } from './invocation-origins';
import { attachCoverage, emptyResult } from './query-result';
import { checkValueContext } from './value-context';

interface ValuePosition {
  readonly value: string;
  readonly context: readonly string[];
}
interface Origin {
  readonly position: ValuePosition;
  readonly record: string;
  readonly label: string;
}
interface Walk {
  readonly reader: KnowledgeReader;
  readonly result: QueryResponse;
  readonly enqueue: (position: ValuePosition) => void;
  readonly markSeen: (id: string) => void;
}

function key(position: ValuePosition): string {
  return `${position.context.length === 0 ? 'root' : position.context.join('>')}::${position.value}`;
}

function origins(reader: KnowledgeReader, position: ValuePosition, value: Value): Origin[] {
  const flows: Origin[] = reader
    .select('to', value.id)
    .filter((record) => record.kind === 'flow')
    .map((flow) => ({
      position: { value: flow.from, context: position.context },
      record: flow.id,
      label: flow.transform,
    }));
  if (position.context.length === 0) return flows;
  const context = [...position.context];
  const callId = context.pop();
  const call = callId === undefined ? undefined : reader.get(callId);
  if (call?.kind === 'handoff') {
    return [
      ...flows,
      ...call.bindings
        .filter((binding) => binding.to === value.id)
        .map((binding) => ({
          position: { value: binding.from, context },
          record: call.id,
          label: binding.transform,
        })),
    ];
  }
  if (value.role !== 'parameter') return flows;
  const binding =
    call?.kind === 'operation'
      ? call.bindings.find((item) => item.parameter === value.id)
      : undefined;
  if (binding !== undefined && call !== undefined) {
    flows.push({
      position: { value: binding.value, context },
      record: call.id,
      label: 'actual-to-formal argument binding',
    });
  }
  return flows;
}

function callResultOrigins(walk: Walk, position: ValuePosition, value: Value): Origin[] {
  const operation = walk.reader.get(value.definition);
  if (
    operation?.kind !== 'operation' ||
    operation.action !== 'call' ||
    operation.result !== value.id
  ) {
    return [];
  }
  if (operation.waitsFor === 'none') {
    walk.result.frontiers.push({
      at: key(position),
      reason: 'binding_unresolved',
      detail:
        'Non-awaited call result is a task or handle; no mapping from the eventual callee result is established.',
      references: [operation.id],
    });
    return [];
  }
  const resolution =
    operation.resolution === null ? undefined : walk.reader.get(operation.resolution);
  if (resolution?.kind !== 'resolution' || resolution.target === null) {
    walk.result.frontiers.push({
      at: key(position),
      reason: 'version_unresolved',
      detail: 'Origin depends on unresolved callee result.',
      references: [operation.id],
    });
    return [];
  }
  if (position.context.includes(operation.id)) {
    walk.result.frontiers.push({
      at: key(position),
      reason: 'cycle',
      detail: 'Recursive return origin is not expanded.',
      references: [operation.id],
    });
    return [];
  }
  return walk.reader.select('owner', resolution.target).flatMap((record) =>
    record.kind !== 'operation' || record.action !== 'return' || record.result === null
      ? []
      : [
          {
            position: { value: record.result, context: [...position.context, operation.id] },
            record: record.id,
            label: 'callee return-to-result binding',
          },
        ],
  );
}

function connect(walk: Walk, position: ValuePosition, origin: Origin): void {
  const record = walk.reader.get(origin.record);
  const assumption =
    record?.kind === 'flow' && record.assumptions.length > 0 ? record.assumptions.join('; ') : null;
  if (record?.kind === 'flow') {
    for (const gap of record.gaps) {
      walk.result.frontiers.push({
        at: key(position),
        reason: 'version_unresolved',
        detail:
          'Mapping instruction is known; effective imported implementation remains unresolved.',
        references: [gap],
      });
    }
  }
  walk.result.edges.push({
    from: key(origin.position),
    to: key(position),
    on: 'value',
    condition: origin.label,
    assumption,
    evidence: [],
    record: origin.record,
  });
  walk.enqueue(origin.position);
}

function visit(walk: Walk, position: ValuePosition): void {
  if (walk.result.nodes.length >= walk.result.request.maxNodes) {
    walk.result.limitsHit.push('maxNodes');
    walk.result.frontiers.push({
      at: key(position),
      reason: 'query_limit',
      detail: 'Value node budget reached.',
      references: [position.value],
    });
    return;
  }
  const value = walk.reader.get(position.value);
  if (value?.kind !== 'value') throw new Error(`Missing value ${position.value}`);
  walk.markSeen(key(position));
  walk.result.nodes.push({
    id: key(position),
    record: value.id,
    context: [...position.context],
    label: value.label,
  });
  for (const origin of [
    ...origins(walk.reader, position, value),
    ...invocationOrigins(walk, position, value),
    ...callResultOrigins(walk, position, value),
  ]) {
    connect(walk, position, origin);
  }
}

export function traceValue(reader: KnowledgeReader, request: QueryRequest): QueryResponse {
  checkValueContext(reader, request);
  if (request.value === null) throw new Error('Value query requires a value');
  const result = attachCoverage(reader, emptyResult(request));
  const pending: ValuePosition[] = [{ value: request.value, context: request.context }];
  const seen = new Set<string>();
  const walk: Walk = {
    reader,
    result,
    enqueue: (position) => {
      pending.push(position);
    },
    markSeen: (id) => {
      seen.add(id);
    },
  };
  while (pending.length > 0 && result.limitsHit.length === 0) {
    const position = pending.shift();
    if (position !== undefined && !seen.has(key(position))) visit(walk, position);
  }
  const selected = new Set(result.nodes.map((node) => node.id));
  result.edges = result.edges.filter((edge) => selected.has(edge.from) && selected.has(edge.to));
  const anchor = reader.get(request.value);
  if (anchor?.kind === 'value' && anchor.representation !== request.representation) {
    result.frontiers.push({
      at: request.value,
      reason: 'representation_unresolved',
      detail: `Origins are shown for ${anchor.representation}; no established mapping to requested ${request.representation} representation.`,
      references: [anchor.id],
    });
  }
  return result;
}
