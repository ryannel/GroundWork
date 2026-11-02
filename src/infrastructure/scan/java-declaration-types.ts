import 'server-only';

import {
  declarationAnnotations,
  declarationChildren,
  declarationParameter,
  declarationSource,
  declarationText,
} from './java-declaration-parts';
import type { JavaField, JavaInvocation, JavaMethod, JavaType } from './java-declarations';
import { syntaxIdentity } from './source-expressions';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import { enclosingFunction, syntaxRole } from './syntax-candidates';

const TYPES = new Set(['CLASS', 'INTERFACE', 'ENUM', 'RECORD']);

function parents(index: SourceIndex, node: SyntaxNode): SyntaxNode[] {
  const result: SyntaxNode[] = [];
  let parent = node.parent;
  while (parent !== null) {
    const ancestor = index.nodes[parent];
    if (!ancestor) break;
    result.unshift(ancestor);
    parent = ancestor.parent;
  }
  return result;
}

function calls(index: SourceIndex, method: SyntaxNode): JavaInvocation[] {
  const owner = index.nodes.indexOf(method);
  return index.nodes
    .filter((node) => node.kind === 'METHOD_INVOCATION' && enclosingFunction(index, node) === owner)
    .map((node) => ({
      callee: declarationText(index, node, 'callee')[0] ?? '',
      arguments: declarationText(index, node, 'arguments'),
      source: declarationSource(index, node),
      conditional: parents(index, node).some((ancestor) =>
        ['branch', 'loop'].includes(syntaxRole(ancestor)),
      ),
    }));
}

function methodOf(index: SourceIndex, node: SyntaxNode): JavaMethod {
  return {
    name: node.symbol ?? '',
    parameters: declarationChildren(index, node, 'parameters').map((entry) =>
      declarationParameter(index, entry),
    ),
    returnType: declarationText(index, node, 'returnType')[0] ?? 'void',
    annotations: declarationAnnotations(index, node),
    source: declarationSource(index, node),
    summary: `summary:${syntaxIdentity(index, node)}`,
    body: declarationText(index, node, 'body')[0] ?? null,
    calls: calls(index, node),
    typeParameters: declarationChildren(index, node, 'typeParameters').map(
      (entry) => entry.symbol ?? '',
    ),
    boundedTypeParameters: declarationChildren(index, node, 'typeParameters')
      .filter((entry) => (entry.fields?.bounds ?? []).length > 0)
      .map((entry) => entry.symbol ?? ''),
  };
}

function fieldOf(index: SourceIndex, node: SyntaxNode): JavaField {
  return {
    ...declarationParameter(index, node),
    initializer: declarationText(index, node, 'values')[0] ?? null,
    modifiers: node.modifiers ?? [],
  };
}

function typeOf(index: SourceIndex, node: SyntaxNode, packageName: string): JavaType {
  const children = declarationChildren(index, node, 'members');
  const fields = children
    .filter((child) => child.kind === 'VARIABLE')
    .map((child) => fieldOf(index, child));
  const ancestors = parents(index, node).filter((entry) => TYPES.has(entry.kind));
  const name = node.symbol ?? '';
  return {
    name,
    qualifiedName: [packageName, ...ancestors.map((entry) => entry.symbol), name]
      .filter(Boolean)
      .join('.'),
    extends: declarationText(index, node, node.kind === 'INTERFACE' ? 'interfaces' : 'superType'),
    implements: declarationText(index, node, 'interfaces'),
    annotations: declarationAnnotations(index, node),
    methods: children
      .filter((child) => child.kind === 'METHOD')
      .map((child) => methodOf(index, child)),
    fields,
    source: declarationSource(index, node),
    kind: typeKind(node),
    enumValues:
      node.kind === 'ENUM'
        ? fields
            .filter(
              (field) => field.modifiers.includes('static') && field.modifiers.includes('final'),
            )
            .map((field) => field.name)
        : [],
    typeParameters: declarationChildren(index, node, 'typeParameters').map(
      (entry) => entry.symbol ?? '',
    ),
  };
}

export function javaTypes(index: SourceIndex, packageName: string): JavaType[] {
  return index.nodes
    .filter((node) => TYPES.has(node.kind) && node.symbol !== '')
    .map((node) => typeOf(index, node, packageName));
}

function typeKind(node: SyntaxNode): JavaType['kind'] {
  if (node.kind === 'INTERFACE') return 'interface';
  if (node.kind === 'ENUM') return 'enum';
  if (node.kind === 'RECORD') return 'record';
  return 'class';
}
