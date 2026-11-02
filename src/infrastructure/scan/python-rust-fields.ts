import 'server-only';

import type { Support } from '@/domain/scan/scan.generated';

import { syntaxIdentity } from './source-expressions';
import type { SourceIndex, SyntaxNode } from './source-index-types';

export function polyglotSource(index: SourceIndex, node: SyntaxNode): string {
  return `source:${syntaxIdentity(index, node)}`;
}
export function polyglotFields(
  index: SourceIndex,
  node: SyntaxNode,
  field: string,
): readonly SyntaxNode[] {
  return (node.fields?.[field] ?? []).flatMap(([start, end]) => {
    const found = index.nodes.find(
      (candidate) => candidate.start === start && candidate.end === end,
    );
    return found === undefined ? [] : [found];
  });
}
function pythonImports(index: SourceIndex): ReadonlyMap<string, string> {
  const imports = new Map(
    index.nodes
      .filter(
        (node) => node.kind === 'IMPORT_ALIAS' && index.nodes[node.parent ?? -1]?.parent === 0,
      )
      .map((node) => {
        const parent = index.nodes[node.parent ?? -1];
        const name = node.symbol ?? '';
        const importedModule = parent?.symbol;
        return [
          node.modifiers?.[0] ?? name,
          importedModule !== undefined && importedModule !== ''
            ? `${importedModule}.${name}`
            : name,
        ];
      }),
  );
  for (const node of index.nodes.filter((candidate) => candidate.parent === 0)) {
    if (node.kind === 'METHOD' || node.kind === 'CLASS') imports.delete(node.symbol ?? '');
    if (node.kind === 'ASSIGNMENT') {
      for (const target of polyglotFields(index, node, 'targets')) {
        imports.delete(target.symbol ?? '');
      }
    }
  }
  return imports;
}
export function pythonQualified(index: SourceIndex, node: SyntaxNode | undefined): string {
  if (node === undefined) return '';
  if (node.kind === 'IDENTIFIER') {
    return pythonImports(index).get(node.symbol ?? '') ?? node.symbol ?? '';
  }
  if (node.kind === 'MEMBER_SELECT') {
    const receiver = polyglotFields(index, node, 'receiver')[0];
    return `${pythonQualified(index, receiver)}.${node.symbol ?? ''}`;
  }
  return '';
}

/** Includes the declarations used to resolve framework aliases and source annotations. */
export function polyglotSupport(index: SourceIndex, node: SyntaxNode): Support {
  const source = polyglotSource(index, node);
  const declarations = index.nodes.filter(
    (candidate) => candidate.parent === 0 && ['IMPORT', 'ASSIGNMENT'].includes(candidate.kind),
  );
  const annotations = polyglotFields(index, node, 'annotations');
  const owners: SyntaxNode[] = [];
  let parent = node.parent;
  while (parent !== null) {
    const owner = index.nodes[parent];
    if (owner === undefined) break;
    if (['CLASS', 'RustImpl'].includes(owner.kind)) owners.push(owner);
    parent = owner.parent;
  }
  const support = [...declarations, ...annotations, ...owners].map((candidate) =>
    polyglotSource(index, candidate),
  );
  return [source, ...new Set(support)];
}
