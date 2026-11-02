import 'server-only';

import type { JavaBindingContext } from './java-call-binding-types';
import { declarationChildren, declarationSource, declarationText } from './java-declaration-parts';
import type { SourceIndex, SyntaxNode } from './source-index-types';

export function javaAncestors(index: SourceIndex, node: SyntaxNode): SyntaxNode[] {
  const result: SyntaxNode[] = [];
  let parent = node.parent;
  while (parent !== null) {
    const next = index.nodes[parent];
    if (!next) break;
    result.push(next);
    parent = next.parent;
  }
  return result;
}
export function javaOwner(index: SourceIndex, node: SyntaxNode): SyntaxNode | undefined {
  return javaAncestors(index, node).find((entry) =>
    ['CLASS', 'INTERFACE', 'ENUM', 'RECORD'].includes(entry.kind),
  );
}
export function javaMethod(index: SourceIndex, node: SyntaxNode): SyntaxNode | undefined {
  return javaAncestors(index, node).find((entry) => entry.kind === 'METHOD');
}
export function javaField(index: SourceIndex, node: SyntaxNode, field: string): SyntaxNode | null {
  return declarationChildren(index, node, field)[0] ?? null;
}
export function javaGuards(index: SourceIndex, node: SyntaxNode): string[] {
  return javaAncestors(index, node)
    .filter((entry) =>
      ['IF', 'CONDITIONAL_EXPRESSION', 'CASE', 'WHILE_LOOP', 'FOR_LOOP'].includes(entry.kind),
    )
    .map((entry) => declarationSource(index, entry));
}
function patternVisible(index: SourceIndex, scope: SyntaxNode, node: SyntaxNode): boolean {
  const ancestors = javaAncestors(index, scope);
  const branch = ancestors.find((entry) => entry.kind === 'IF');
  if (!branch) return false;
  const condition = javaField(index, branch, 'condition');
  const consequent = javaField(index, branch, 'consequent');
  if (condition?.kind !== 'INSTANCE_OF' || !ancestors.includes(condition) || !consequent) {
    return false;
  }
  return node.start >= consequent.start && node.end <= consequent.end;
}
function visible(index: SourceIndex, declaration: SyntaxNode, node: SyntaxNode): boolean {
  if (declaration.start > node.start) return false;
  const scope = declaration.parent === null ? undefined : index.nodes[declaration.parent];
  if (scope?.kind === 'BINDING_PATTERN') return patternVisible(index, scope, node);
  return scope !== undefined && javaAncestors(index, node).includes(scope);
}
export function javaVariable(context: JavaBindingContext, node: SyntaxNode): SyntaxNode | null {
  const { index } = context;
  const receiver = javaField(index, node, 'receiver');
  if (receiver && !['this', 'super'].includes(receiver.text)) return null;
  const name = node.symbol === '' ? node.text : (node.symbol ?? node.text);
  const owner = javaOwner(index, node);
  const method = javaMethod(index, node);
  const candidates = index.nodes.filter(
    (entry) => entry.kind === 'VARIABLE' && entry.symbol === name,
  );
  const locals = receiver
    ? []
    : candidates.filter(
        (entry) => javaMethod(index, entry) === method && visible(index, entry, node),
      );
  const field = candidates.find(
    (entry) => javaOwner(index, entry) === owner && javaMethod(index, entry) === undefined,
  );
  return locals.toSorted((a, b) => b.start - a.start)[0] ?? field ?? null;
}
export function javaDeclaredType(context: JavaBindingContext, node: SyntaxNode): string | null {
  const variable = javaVariable(context, node);
  return variable ? (declarationText(context.index, variable, 'type')[0] ?? null) : null;
}
