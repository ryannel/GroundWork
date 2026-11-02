import type { ScanRecords } from './scan-records';
import type { SemanticEdge, SemanticNode } from './scan.generated';

export interface SemanticLineage {
  readonly nodes: ReadonlyMap<string, SemanticNode>;
  readonly records: ScanRecords;
  readonly outgoing: ReadonlyMap<string, readonly SemanticEdge[]>;
  readonly incoming: ReadonlyMap<string, readonly SemanticEdge[]>;
}

const structural = new Set<SemanticEdge['relation']>([
  'contains',
  'ast_child',
  'body',
  'statement',
  'consequent',
  'otherwise',
  'try_body',
  'catch',
  'catches',
  'finally',
  'value',
  'operand',
  'left',
  'right',
  'argument',
  'callee',
  'receiver',
  'property',
  'initialiser',
  'initializer',
  'assigned_value',
  'condition',
  'assigns',
  'target',
]);

function contexts(id: string, graph: SemanticLineage): ReadonlySet<string> {
  const result = new Set<string>();
  const pending = [id];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const child = pending.pop();
    if (child === undefined || seen.has(child)) continue;
    seen.add(child);
    for (const edge of graph.incoming.get(child) ?? []) {
      if (!structural.has(edge.relation)) continue;
      if (['consequent', 'otherwise', 'catch', 'catches'].includes(edge.relation)) {
        result.add(`${edge.from}:${edge.relation}`);
      }
      pending.push(edge.from);
    }
  }
  return result;
}

export function semanticLineageErrors(edge: SemanticEdge, graph: SemanticLineage): string[] {
  if (!['reaching_definition', 'reaching_value'].includes(edge.relation)) return [];
  const read = graph.nodes.get(edge.from);
  const definition = graph.nodes.get(edge.to);
  if (!read || !definition) return [];
  const errors = valueBindingErrors(edge, graph);
  if (read.nodeKind !== 'identifier' || read.name !== definition.name) {
    errors.push(`${edge.id}: reaching definition must bind the same identifier`);
  }
  errors.push(...orderErrors(read, definition, graph));
  const available = contexts(read.id, graph);
  if ([...contexts(definition.id, graph)].some((context) => !available.has(context))) {
    errors.push(`${edge.id}: reaching definition escapes its branch context`);
  }
  return errors;
}

function orderErrors(
  read: SemanticNode,
  definition: SemanticNode,
  graph: SemanticLineage,
): string[] {
  const origin = graph.records.get(read.source);
  const target = graph.records.get(definition.source);
  if (origin?.kind !== 'source' || target?.kind !== 'source') return [];
  return origin.path === target.path && target.lines[0] > origin.lines[1]
    ? [`${read.id}: reaching definition occurs after its read`]
    : [];
}

function valueBindingErrors(edge: SemanticEdge, graph: SemanticLineage): string[] {
  if (edge.relation !== 'reaching_value') return [];
  const target = graph.nodes.get(edge.to);
  const values = (graph.outgoing.get(edge.to) ?? []).filter(
    (binding) => binding.relation === 'assigned_value',
  );
  return target?.nodeKind === 'identifier' && values.length === 1
    ? []
    : [`${edge.id}: reaching value must reference one assigned identifier value`];
}
