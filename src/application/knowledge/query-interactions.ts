import type { KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import type {
  ExecutionBinding,
  Interaction,
  QueryNode,
  QueryRequest,
  QueryResponse,
} from '@/domain/knowledge/knowledge.generated';

import { emptyResult } from './query-result';
import { contextComponent, entryExecution } from './runtime-context';
import { traceContinuations } from './trace-continuations';

function addNode(reader: KnowledgeReader, result: QueryResponse, id: string): void {
  if (result.nodes.some((node) => node.id === id)) return;
  if (result.nodes.length >= result.request.maxNodes) {
    result.limitsHit.push('maxNodes');
    result.frontiers.push({
      at: id,
      reason: 'query_limit',
      detail: 'Component node budget reached',
      references: [id],
    });
    return;
  }
  const record = reader.get(id);
  if (record === undefined) throw new Error(`Missing runtime record ${id}`);
  const contract = record.kind === 'interaction' ? reader.get(record.contract) : undefined;
  const fallback = contract?.kind === 'interface_contract' ? contract.name : 'Unresolved target';
  const unresolved =
    contract?.kind === 'interface_contract' && contract.protocol === 'source-library'
      ? `${fallback} (library effects unresolved)`
      : `${fallback} (unresolved)`;
  const label = record.kind === 'runtime_component' ? record.label : unresolved;
  result.nodes.push({ id, record: id, context: [], label });
}

function appendInteraction(
  reader: KnowledgeReader,
  result: QueryResponse,
  item: {
    readonly node: QueryNode;
    readonly interaction: Interaction;
    readonly execution: ExecutionBinding;
  },
): void {
  const { node, interaction, execution } = item;
  const library = libraryFinding(reader, result, interaction);
  const target = interaction.target ?? interaction.id;
  addNode(reader, result, execution.component);
  addNode(reader, result, target);
  const incoming = interaction.mode === 'consume';
  result.edges.push({
    from: incoming ? target : execution.component,
    to: incoming ? execution.component : target,
    on: interaction.mode,
    condition: interaction.condition,
    assumption:
      interaction.gaps.length === 0
        ? null
        : 'Source declarations and conditional paths; unresolved facts remain explicit',
    evidence: interaction.evidence,
    record: interaction.id,
    context: node.context,
    operation: node.record,
  });
  if (interaction.targetEntry !== null) {
    result.findings.push({
      statement:
        'The target entry identifies a source address; both interface contracts remain separate.',
      support: [interaction.id, interaction.contract, interaction.targetEntry],
      assumptions: [
        'Address correspondence does not establish payload compatibility or deployed version correspondence',
      ],
    });
  }
  if (interaction.target === null) {
    result.frontiers.push({
      at: target,
      reason: 'binding_unresolved',
      detail: library
        ? 'Imported invocation is visible; possible further effects and runtime destination are unresolved'
        : 'Outbound boundary is visible; destination or transport is unresolved',
      references: [interaction.id, ...interaction.gaps],
    });
  }
}

function libraryFinding(
  reader: KnowledgeReader,
  result: QueryResponse,
  interaction: Interaction,
): boolean {
  const local =
    interaction.mode === 'unknown' &&
    interaction.target === null &&
    interaction.boundary === 'unresolved';
  const contract = reader.get(interaction.contract);
  if (!local || contract?.kind !== 'interface_contract' || contract.protocol !== 'source-library') {
    return false;
  }
  result.findings.push({
    statement:
      'Imported library invocation inside this host. Its placeholder retains unresolved further effects; it is not an established runtime component.',
    support: [interaction.id, interaction.execution, interaction.contract, ...interaction.gaps],
    assumptions: [
      'Unavailable library code does not prove the absence of network or store effects',
    ],
  });
  return true;
}

function visit(
  reader: KnowledgeReader,
  result: QueryResponse,
  item: { readonly node: QueryNode; readonly root: ExecutionBinding },
): void {
  const component = contextComponent(reader, item.root, item.node.context);
  const operation = reader.get(item.node.record);
  if (operation?.kind === 'operation') {
    const matches = reader
      .select('implementation', operation.owner)
      .filter((record) => record.kind === 'execution_binding' && record.component === component);
    if (matches.length !== 1) {
      result.frontiers.push({
        at: item.node.id,
        reason: 'binding_unresolved',
        detail: 'Implementation has no unambiguous execution binding in this invocation host',
        references: [operation.id],
      });
      return;
    }
  }
  for (const record of reader.select('operation', item.node.record)) {
    if (record.kind === 'interaction') {
      const execution = reader.get(record.execution);
      if (execution?.kind === 'execution_binding' && execution.component === component) {
        appendInteraction(reader, result, { node: item.node, interaction: record, execution });
      }
    }
  }
}

function attachBindings(
  reader: KnowledgeReader,
  result: QueryResponse,
  item: { readonly trace: QueryResponse; readonly root: ExecutionBinding },
): void {
  const wanted = new Set(
    item.trace.nodes.flatMap((node) => {
      const record = reader.get(node.record);
      return record?.kind === 'operation'
        ? [`${record.owner}@${contextComponent(reader, item.root, node.context) ?? 'unknown'}`]
        : [];
    }),
  );
  const owners = new Set(
    item.trace.nodes.flatMap((node) => {
      const record = reader.get(node.record);
      return record?.kind === 'operation' ? [record.owner] : [];
    }),
  );
  const bindings = [...owners]
    .flatMap((owner) => reader.select('implementation', owner))
    .filter(
      (record) =>
        record.kind === 'execution_binding' &&
        wanted.has(`${record.implementation}@${record.component}`),
    );
  result.findings.push({
    statement:
      'Components and conditional interactions in this entry trace. Library execution stays inside the host. Drill into an interaction contract or bound implementation for detail.',
    support: bindings.map((record) => record.id),
    assumptions: ['Source declarations do not establish deployed topology or path feasibility'],
  });
}

export function queryInteractions(reader: KnowledgeReader, request: QueryRequest): QueryResponse {
  const result = emptyResult(request);
  const root = entryExecution(reader, request);
  if (root === null) {
    result.frontiers.push({
      at: request.entry,
      reason: 'binding_unresolved',
      detail: 'Entry needs an unambiguous runtime execution binding',
      references: [request.entry],
    });
    return result;
  }
  const trace = traceContinuations(reader, request);
  result.coverage = trace.coverage;
  result.frontiers = trace.frontiers;
  result.limitsHit = trace.limitsHit;
  addNode(reader, result, root.component);
  for (const node of trace.nodes) visit(reader, result, { node, root });
  const visible = new Set(result.nodes.map((node) => node.id));
  result.edges = result.edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to));
  result.findings.push({
    statement: 'The entry interface is separate from its internal implementation.',
    support: reader.select('entry', request.entry).map((record) => record.id),
    assumptions: [],
  });
  attachBindings(reader, result, { trace, root });
  return result;
}
