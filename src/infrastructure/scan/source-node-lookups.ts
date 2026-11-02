import 'server-only';

import type { SemanticNode } from '@/domain/scan/scan.generated';

import type { SourceIndex, SyntaxNode } from './source-index-types';

export function spanKey(start: number, end: number): string {
  return `${String(start)}:${String(end)}`;
}

/** Buckets preserve every equal-span entry and its original compiler traversal order. */
export function syntaxLookups(index: SourceIndex): {
  readonly spans: ReadonlyMap<string, readonly SyntaxNode[]>;
  readonly positions: ReadonlyMap<SyntaxNode, number>;
} {
  const spans = new Map<string, SyntaxNode[]>();
  const positions = new Map<SyntaxNode, number>();
  for (const [position, node] of index.nodes.entries()) {
    const key = spanKey(node.start, node.end);
    const entries = spans.get(key) ?? [];
    entries.push(node);
    spans.set(key, entries);
    if (!positions.has(node)) positions.set(node, position);
  }
  return { spans, positions };
}

/** Preserve Array.indexOf semantics even when a node object appears more than once. */
export function syntaxPositions(index: SourceIndex): ReadonlyMap<SyntaxNode, number> {
  const positions = new Map<SyntaxNode, number>();
  for (const [position, node] of index.nodes.entries()) {
    if (!positions.has(node)) positions.set(node, position);
  }
  return positions;
}

/** Owner order takes priority over field name; each owner's return/type/parameter order is fixed. */
export function backendFieldRoles(
  index: SourceIndex,
): ReadonlyMap<string, SemanticNode['nodeKind']> {
  const roles = new Map<string, SemanticNode['nodeKind']>();
  for (const owner of index.nodes) {
    for (const [key, role] of fieldRoleEntries(owner)) {
      if (!roles.has(key)) roles.set(key, role);
    }
  }
  return roles;
}

function fieldRoleEntries(
  owner: SyntaxNode,
): readonly (readonly [string, SemanticNode['nodeKind']])[] {
  return ['returnType', 'type', 'parameters'].flatMap((name) =>
    (owner.fields?.[name] ?? []).map(
      ([start, end]): readonly [string, SemanticNode['nodeKind']] => [
        spanKey(start, end),
        name === 'parameters' ? 'parameter' : 'type',
      ],
    ),
  );
}

/** The first surviving semantic node wins, as in the original Map iteration plus find. */
export function semanticSpanLookup(
  nodes: ReadonlyMap<SyntaxNode, SemanticNode>,
): ReadonlyMap<string, SemanticNode> {
  const spans = new Map<string, SemanticNode>();
  for (const [syntax, node] of nodes) {
    const key = spanKey(syntax.start, syntax.end);
    if (!spans.has(key)) spans.set(key, node);
  }
  return spans;
}
