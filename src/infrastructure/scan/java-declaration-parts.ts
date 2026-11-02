import 'server-only';

import { javaAnnotationName } from './java-annotation-names';
import type { JavaAnnotation, JavaParameter } from './java-declarations';
import { syntaxIdentity } from './source-expressions';
import type { SourceIndex, SyntaxNode } from './source-index-types';

export function declarationSource(index: SourceIndex, node: SyntaxNode): string {
  return `source:${syntaxIdentity(index, node)}`;
}

export function declarationChildren(
  index: SourceIndex,
  node: SyntaxNode,
  field: string,
): SyntaxNode[] {
  const position = index.nodes.indexOf(node);
  return (node.fields?.[field] ?? []).flatMap(([start, end]) => {
    const matches = index.nodes.filter(
      (child) =>
        child.start === start &&
        child.end === end &&
        (field !== 'annotations' || child.kind === 'ANNOTATION'),
    );
    const child = matches.find((item) => item.parent === position) ?? matches[0];
    return child ? [child] : [];
  });
}

export function declarationText(index: SourceIndex, node: SyntaxNode, field: string): string[] {
  return (node.fields?.[field] ?? []).map(([start, end]) => index.content.slice(start, end));
}

export function declarationAnnotations(index: SourceIndex, node: SyntaxNode): JavaAnnotation[] {
  return declarationChildren(index, node, 'annotations').map((annotation) => {
    const entries = declarationChildren(index, annotation, 'arguments').map(
      (argument): [string, string] => {
        if (argument.kind !== 'ASSIGNMENT') {
          return ['value', index.content.slice(argument.start, argument.end)];
        }
        return [
          declarationText(index, argument, 'targets')[0] ?? 'value',
          declarationText(index, argument, 'values')[0] ?? '',
        ];
      },
    );
    return {
      name: javaAnnotationName(
        index,
        declarationText(index, annotation, 'annotationType')[0] ?? '',
      ),
      arguments: Object.fromEntries(entries),
      source: declarationSource(index, annotation),
    };
  });
}

export function declarationParameter(index: SourceIndex, node: SyntaxNode): JavaParameter {
  return {
    name: node.symbol ?? '',
    type: declarationText(index, node, 'type')[0] ?? '',
    annotations: declarationAnnotations(index, node),
    source: declarationSource(index, node),
  };
}
