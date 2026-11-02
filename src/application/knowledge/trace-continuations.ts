import { handoffMatch } from '@/domain/knowledge/handoff-match';
import type { KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import type {
  Handoff,
  QueryNode,
  QueryRequest,
  QueryResponse,
} from '@/domain/knowledge/knowledge.generated';

import { traceControl } from './trace-control';

function handoffs(reader: KnowledgeReader, node: QueryNode): Handoff[] {
  return reader
    .select('operation', node.record)
    .flatMap((effect) => reader.select('effect', effect.id))
    .filter((record) => record.kind === 'handoff');
}

function expand(reader: KnowledgeReader, result: QueryResponse, node: QueryNode): void {
  for (const handoff of handoffs(reader, node)) expandHandoff(reader, result, { node, handoff });
}

function expandHandoff(
  reader: KnowledgeReader,
  result: QueryResponse,
  link: { readonly node: QueryNode; readonly handoff: Handoff },
): void {
  const { node, handoff } = link;
  const mismatch = handoffMatch((id) => reader.get(id), handoff, result.request.environment ?? '');
  if (handoff.status !== 'source_matched' || mismatch !== null) {
    result.frontiers.push({
      at: node.id,
      reason: 'binding_unresolved',
      detail: mismatch ?? 'Handoff is unresolved',
      references: [handoff.id],
    });
    return;
  }
  if (node.context.includes(handoff.id)) {
    result.frontiers.push({
      at: node.id,
      reason: 'cycle',
      detail: 'Repeated asynchronous handoff is not expanded',
      references: [handoff.id],
    });
    return;
  }
  appendConsumer(reader, result, link);
}

function appendConsumer(
  reader: KnowledgeReader,
  result: QueryResponse,
  link: { readonly node: QueryNode; readonly handoff: Handoff },
): void {
  const budget = result.request.maxNodes - result.nodes.length;
  if (budget < 1) {
    result.limitsHit.push('maxNodes');
    result.frontiers.push({
      at: link.node.id,
      reason: 'query_limit',
      detail: 'Consumer node budget reached',
      references: [link.handoff.id],
    });
    return;
  }
  const consumer = traceControl(
    reader,
    { ...result.request, entry: link.handoff.subscription, maxNodes: budget },
    [...link.node.context, link.handoff.id],
  );
  result.nodes.push(...consumer.nodes);
  result.edges.push(...consumer.edges);
  result.frontiers.push(...consumer.frontiers);
  result.limitsHit.push(...consumer.limitsHit);
  result.coverage.push(...consumer.coverage);
  const first = consumer.nodes[0];
  if (first !== undefined) {
    result.edges.push({
      from: link.node.id,
      to: first.id,
      on: 'possible_delivery',
      condition: 'Published bytes are delivered to this committed configuration and consumer',
      assumption:
        'Source-matched profiles and schemas; deployment, persistence, delivery and consumer success are not established',
      evidence: link.handoff.evidence,
      record: link.handoff.id,
    });
  }
}

export function traceContinuations(reader: KnowledgeReader, request: QueryRequest): QueryResponse {
  const result = traceControl(reader, request);
  let cursor = 0;
  while (cursor < result.nodes.length && result.limitsHit.length === 0) {
    const node = result.nodes[cursor];
    if (node !== undefined) expand(reader, result, node);
    cursor += 1;
  }
  return result;
}

export function consistencySlice(reader: KnowledgeReader, request: QueryRequest): QueryResponse {
  const result = traceContinuations(reader, request);
  const owners = new Set(
    result.nodes.flatMap((node) => {
      const operation = reader.get(node.record);
      return operation?.kind === 'operation' ? [operation.owner] : [];
    }),
  );
  const records = [...owners]
    .flatMap((owner) => reader.select('owner', owner))
    .filter(
      (record) =>
        record.kind === 'storage_write' ||
        record.kind === 'consistency_boundary' ||
        record.kind === 'milestone' ||
        record.kind === 'delivery_policy',
    );
  result.findings.push({
    statement:
      'Write acknowledgements, conditional milestones and failure windows are separate. Source paths do not establish delivery or a shared transaction.',
    support: records.map((record) => record.id),
    assumptions: ['Conditions are preserved; path feasibility is not checked'],
  });
  return result;
}
