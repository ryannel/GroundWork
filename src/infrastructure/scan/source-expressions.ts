import 'server-only';

import { sourceDigest } from './source-index';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import { enclosingFunction, syntaxRole } from './syntax-candidates';

export function syntaxIdentity(index: SourceIndex, node: SyntaxNode): string {
  return sourceDigest(
    `${index.path}:${index.digest}:${String(node.start)}:${String(node.end)}:${node.kind}`,
  ).slice(0, 24);
}

export function fieldExpressions(
  index: SourceIndex,
  node: SyntaxNode,
  field: string,
): readonly string[] {
  return (node.fields?.[field] ?? []).map(([start, end]) => index.content.slice(start, end));
}

export function branchOperations(index: SourceIndex, node: SyntaxNode, field: string): string[] {
  const spans = node.fields?.[field] ?? [];
  const owner = enclosingFunction(index, node);
  return index.nodes
    .filter((child) => {
      const inside = spans.some(([start, end]) => child.start >= start && child.end <= end);
      const role = syntaxRole(child);
      if (!inside || !['call', 'return', 'await', 'branch', 'throw'].includes(role)) return false;
      return enclosingFunction(index, child) === owner;
    })
    .map((child) => `operation:${syntaxIdentity(index, child)}`);
}
