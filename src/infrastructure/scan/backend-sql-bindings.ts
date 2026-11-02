import 'server-only';

import type { SemanticNode } from '@/domain/scan/scan.generated';

import type { BackendGraph } from './backend-semantics';
import { fieldExpressions } from './source-expressions';
import type { SyntaxNode } from './source-index-types';

interface SqlContext {
  readonly graph: BackendGraph;
  readonly syntax: SyntaxNode;
  readonly node: SemanticNode;
  readonly sqlPosition: number;
  readonly sql: SemanticNode;
}

function appendColumn(...args: readonly [SqlContext, string, string, number]) {
  const [context, column, slot, position] = args;
  if (!/^\$\d+$/u.test(slot)) return;
  const ordinal = Number(slot.slice(1));
  const { graph, syntax, node, sqlPosition, sql } = context;
  const span = syntax.fields?.arguments?.[sqlPosition + ordinal];
  if (!span) return;
  const operand = [...graph.nodes].find(
    ([candidate]) => candidate.start === span[0] && candidate.end === span[1],
  )?.[1];
  if (!operand) return;
  const field = graph.extra(
    node,
    'sql_column',
    column,
    `column:${String(sqlPosition)}:${String(position)}`,
  );
  graph.edge(sql, field, 'property', position);
  graph.edge(field, operand, 'column_binding', ordinal, slot);
}

function appendLiteral(context: Omit<SqlContext, 'sql'>, argument: string) {
  if (!argument.startsWith('`') && !argument.startsWith('"')) return;
  const match = /^\s*INSERT\s+INTO\s+([\w.]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/iu.exec(
    argument.slice(1, -1),
  );
  if (!match) return;
  const columns = match[2]?.split(',').map((column) => column.trim()) ?? [];
  const slots = match[3]?.split(',').map((slot) => slot.trim()) ?? [];
  if (columns.length !== slots.length) return;
  const { graph, node, sqlPosition } = context;
  const sql = graph.extra(node, 'sql', match[1] ?? '', `sql:${String(sqlPosition)}`);
  graph.edge(node, sql, 'resource');
  for (const [position, column] of columns.entries()) {
    appendColumn({ ...context, sql }, column, slots[position] ?? '', position);
  }
}

/** Only literal INSERT column/placeholder lists are bound; dynamic SQL remains unresolved. */
export function appendSqlBindings(
  graph: BackendGraph,
  syntax: SyntaxNode,
  node: SemanticNode,
): void {
  if (node.nodeKind !== 'call') return;
  const args = fieldExpressions(graph.index, syntax, 'arguments');
  for (const [sqlPosition, argument] of args.entries()) {
    appendLiteral({ graph, syntax, node, sqlPosition }, argument);
  }
}
