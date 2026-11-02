import type { KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import { queryRules } from '@/domain/knowledge/knowledge-versions';
import type { QueryRequest, QueryResponse } from '@/domain/knowledge/knowledge.generated';

import { bindQueryRuntime } from './bind-query-runtime';
import { queryInteractions } from './query-interactions';
import { completeResult, emptyResult } from './query-result';
import { consistencySlice, traceContinuations } from './trace-continuations';
import { outcomeSlice, traceControl } from './trace-control';
import { traceValue } from './trace-value';

function invalidate(reader: KnowledgeReader, id: string, result: QueryResponse): string[] {
  if (result.nodes.length >= result.request.maxNodes) {
    result.limitsHit.push('maxNodes');
    result.frontiers.push({
      at: id,
      reason: 'query_limit',
      detail: 'Invalidation node budget reached.',
      references: [id],
    });
    return [];
  }
  if (reader.get(id) === undefined) throw new Error(`Unknown changed input ${id}`);
  result.nodes.push({ id, record: id, context: [], label: id });
  return reader.select('input', id).flatMap((record) => {
    if (record.kind !== 'derivation') return [];
    result.edges.push({
      from: id,
      to: record.output,
      on: 'invalidates',
      condition: record.rule,
      assumption: null,
      evidence: [],
      record: record.id,
    });
    return [record.output];
  });
}

function impact(reader: KnowledgeReader, request: QueryRequest): QueryResponse {
  const result = emptyResult(request);
  const pending = [...request.changed];
  const seen = new Set<string>();
  while (pending.length > 0 && result.limitsHit.length === 0) {
    const id = pending.shift();
    if (id !== undefined && !seen.has(id)) {
      seen.add(id);
      pending.push(...invalidate(reader, id, result));
    }
  }
  const visible = new Set(result.nodes.map((node) => node.id));
  result.edges = result.edges.filter((edge) => visible.has(edge.to));
  result.findings.push({
    statement:
      'Dependent explanations require recomputation. This does not demonstrate runtime incompatibility.',
    support: result.edges.flatMap((edge) => (edge.record === null ? [] : [edge.record])),
    assumptions: [],
  });
  return result;
}

function effects(reader: KnowledgeReader, request: QueryRequest): QueryResponse {
  const result = traceControl(reader, request);
  const operations = new Set(result.nodes.map((node) => node.record));
  const discovered = reader
    .select('kind', 'effect')
    .filter((record) => record.kind === 'effect' && operations.has(record.operation));
  const writes = discovered.filter(
    (effect) => effect.kind === 'effect' && effect.effect === 'write',
  );
  result.findings.push({
    statement:
      writes.length === 0
        ? 'No explicit write in the examined local operations. Unresolved calls have unknown effects; a global no-write claim is not established.'
        : 'Explicit writes occur in the examined operations.',
    support: discovered.map((effect) => effect.id),
    assumptions: ['Scope is source inspection, not runtime observation'],
  });
  return result;
}

export function queryKnowledge(reader: KnowledgeReader, request: QueryRequest): QueryResponse {
  if (request.snapshot !== reader.snapshot) throw new Error('Query snapshot does not match reader');
  if (request.maxNodes < 1 || request.maxNodes > 2000) throw new Error('Invalid node budget');
  if (request.query === 'outcome' && request.outcome === null) {
    throw new Error('Outcome query requires a status');
  }
  if (reader.rules !== queryRules(request)) throw new Error('Query rules do not match snapshot');
  const result = executeQuery(reader, request);
  const visible = new Set(result.nodes.map((node) => node.record));
  result.claims = reader
    .select('owner', request.entry)
    .filter((record) => record.kind === 'claim' && record.inputs.every((id) => visible.has(id)))
    .map((record) => record.id);
  return completeResult(reader, bindQueryRuntime(reader, result));
}

function executeQuery(reader: KnowledgeReader, request: QueryRequest): QueryResponse {
  switch (request.query) {
    case 'interactions': {
      return queryInteractions(reader, request);
    }
    case 'continuations': {
      return traceContinuations(reader, request);
    }
    case 'consistency': {
      return consistencySlice(reader, request);
    }
    case 'records': {
      return emptyResult(request);
    }
    case 'trace': {
      return traceControl(reader, request);
    }
    case 'outcome': {
      return outcomeSlice(reader, traceControl(reader, request));
    }
    case 'value': {
      return traceValue(reader, request);
    }
    case 'effects': {
      return effects(reader, request);
    }
    case 'impact': {
      return impact(reader, request);
    }
  }
}
