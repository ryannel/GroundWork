import 'server-only';

import { fieldExpressions, syntaxIdentity } from './source-expressions';
import type { SourceIndex, SyntaxNode } from './source-index-types';

export function csharpSource(index: SourceIndex, node: SyntaxNode): string {
  return `source:${syntaxIdentity(index, node)}`;
}

export function csharpField(
  index: SourceIndex,
  node: SyntaxNode,
  field: string,
): readonly SyntaxNode[] {
  return (node.fields?.[field] ?? []).flatMap(([start, end]) => {
    const matching = index.nodes.filter(
      (candidate) => candidate.start === start && candidate.end === end,
    );
    const child =
      field === 'annotations'
        ? matching.find((candidate) => candidate.kind === 'ANNOTATION')
        : matching.at(-1);
    return child ? [child] : [];
  });
}

export function csharpOwner(
  index: SourceIndex,
  node: SyntaxNode,
  kinds: readonly string[],
): SyntaxNode | undefined {
  let parent = node.parent;
  while (parent !== null) {
    const owner = index.nodes[parent];
    if (!owner) return undefined;
    if (kinds.includes(owner.kind)) return owner;
    parent = owner.parent;
  }
  return undefined;
}

interface ImportReference {
  readonly index: SourceIndex;
  readonly node: SyntaxNode;
}
export interface CsharpMvcScope {
  readonly globalImports: readonly ImportReference[];
  readonly declarations: ReadonlySet<string>;
}

/** Global imports belong only to the explicitly selected source program. */
export function csharpMvcScope(indexes: readonly SourceIndex[]): CsharpMvcScope {
  return {
    globalImports: indexes.flatMap((index) =>
      index.nodes
        .filter((node) => node.kind === 'IMPORT' && /^global\s+using\b/u.test(node.text))
        .map((node) => ({ index, node })),
    ),
    declarations: new Set(
      indexes.flatMap((index) =>
        index.nodes.flatMap((node) =>
          ['CLASS', 'RECORD'].includes(node.kind) && node.symbol !== undefined ? [node.symbol] : [],
        ),
      ),
    ),
  };
}

/** Attribute lookup requires an explicit framework import and rejects selected-source shadows. */
export function mvcAttribute(
  index: SourceIndex,
  attribute: SyntaxNode,
  scope: CsharpMvcScope = csharpMvcScope([index]),
): string | null {
  const spelling = fieldExpressions(index, attribute, 'annotationName')[0]?.replace(
    /^global::/u,
    '',
  );
  if (spelling === undefined || spelling.length === 0) return null;
  const imports = index.nodes.filter((node) => node.kind === 'IMPORT');
  const short = spelling
    .split('.')
    .at(-1)
    ?.replace(/Attribute$/u, '');
  if (short === undefined || short.length === 0) return null;
  if (scope.declarations.has(short) || scope.declarations.has(`${short}Attribute`)) return null;
  if (spelling.startsWith('Microsoft.AspNetCore.Mvc.')) return short;
  const references = [...imports.map((node) => ({ index, node })), ...scope.globalImports];
  return references.some((imported) =>
    matchesMvcImport(imported.index, imported.node, { spelling, short }),
  )
    ? short
    : null;
}

function matchesMvcImport(
  index: SourceIndex,
  imported: SyntaxNode,
  names: { readonly spelling: string; readonly short: string },
): boolean {
  const name = fieldExpressions(index, imported, 'name')[0];
  const alias = fieldExpressions(index, imported, 'alias')[0];
  const importedName = alias === undefined ? names.short : `${alias}.${names.short}`;
  return (
    (name === 'Microsoft.AspNetCore.Mvc' && names.spelling === importedName) ||
    (alias === names.spelling && name === `Microsoft.AspNetCore.Mvc.${names.short}Attribute`)
  );
}

export function csharpAttributes(index: SourceIndex, node: SyntaxNode): readonly SyntaxNode[] {
  return csharpField(index, node, 'annotations');
}

export function attributeLiteral(index: SourceIndex, node: SyntaxNode): string | null {
  const value = csharpField(index, node, 'arguments')[0]?.literalValue;
  return typeof value === 'string' ? value : null;
}
