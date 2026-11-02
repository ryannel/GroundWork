import type { KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import type {
  ExecutionBinding,
  QueryNode,
  QueryResponse,
} from '@/domain/knowledge/knowledge.generated';

import { contextComponent, entryExecution } from './runtime-context';

function nodeExecution(
  reader: KnowledgeReader,
  node: QueryNode,
  root: ExecutionBinding,
): ExecutionBinding | null {
  const record = reader.get(node.record);
  if (record?.kind !== 'operation' && record?.kind !== 'value') return null;
  const component = contextComponent(reader, root, node.context);
  const matches = reader
    .select('implementation', record.owner)
    .filter((item) => item.kind === 'execution_binding' && item.component === component);
  const binding = matches.length === 1 ? matches[0] : undefined;
  return binding?.kind === 'execution_binding' ? binding : null;
}
function bindNode(
  reader: KnowledgeReader,
  node: QueryNode,
  root: ExecutionBinding | null,
): QueryNode {
  const record = reader.get(node.record);
  if (record?.kind === 'runtime_component') {
    return { ...node, component: record.id, execution: null };
  }
  const binding = root === null ? null : nodeExecution(reader, node, root);
  return { ...node, component: binding?.component ?? null, execution: binding?.id ?? null };
}
export function bindQueryRuntime(reader: KnowledgeReader, result: QueryResponse): QueryResponse {
  if (result.request.format !== 'groundwork-query/v3') return result;
  const root = entryExecution(reader, result.request);

  const nodes = result.nodes.map((node) => bindNode(reader, node, root));
  const unbound =
    result.request.query === 'impact'
      ? []
      : nodes.flatMap((node): QueryResponse['frontiers'] => {
          const record = reader.get(node.record);
          return record?.kind === 'operation' && node.execution === null
            ? [
                {
                  at: node.id,
                  reason: 'binding_unresolved',
                  detail: 'Runtime execution binding is unresolved in this invocation',
                  references: [record.id],
                },
              ]
            : [];
        });
  return { ...result, nodes, frontiers: [...result.frontiers, ...unbound] };
}
