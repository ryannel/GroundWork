import 'server-only';

import type { SemanticNode } from '@/domain/scan/scan.generated';
import { isSemanticOperator } from '@/domain/scan/semantic-operators';

import type { SourceIndex, SyntaxNode } from './source-index-types';
import { syntaxRole } from './syntax-candidates';

const KINDS: Readonly<Record<string, SemanticNode['nodeKind']>> = {
  Identifier: 'identifier',
  PropertyAccessExpression: 'member',
  ElementAccessExpression: 'index',
  CallExpression: 'call',
  NewExpression: 'construct',
  ObjectLiteralExpression: 'object',
  ArrayLiteralExpression: 'array',
  PropertyAssignment: 'property',
  ShorthandPropertyAssignment: 'property',
  BinaryExpression: 'binary',
  PrefixUnaryExpression: 'unary',
  PostfixUnaryExpression: 'unary',
  TypeOfExpression: 'unary',
  ConditionalExpression: 'conditional',
  TemplateExpression: 'template',
  TemplateSpan: 'template',
  VariableDeclaration: 'declaration',
  BindingElement: 'declaration',
  Parameter: 'parameter',
  ReturnStatement: 'return',
  ThrowStatement: 'throw',
  IfStatement: 'if',
  SwitchStatement: 'control',
  CaseClause: 'control',
  TryStatement: 'try',
  CatchClause: 'catch',
  Block: 'block',
  SourceFile: 'block',
  AwaitExpression: 'await',
  JsxElement: 'jsx_element',
  JsxOpeningElement: 'jsx_element',
  JsxSelfClosingElement: 'jsx_element',
  JsxAttribute: 'jsx_attribute',
  ImportDeclaration: 'import',
};

export function semanticNodeDetails(
  index: SourceIndex,
  node: SyntaxNode,
): Pick<
  SemanticNode,
  'nodeKind' | 'syntax' | 'name' | 'operator' | 'value' | 'declaredAsync' | 'optionalAccess'
> {
  const syntax = index.content.slice(node.start, node.end);
  const { value } = literalValue(node);
  const role = syntaxRole(node);
  const operator = operatorDetails(index, node);
  let nodeKind = KINDS[node.kind] ?? 'expression';
  if (role === 'function') nodeKind = 'function';
  if (value !== undefined) nodeKind = 'literal';
  if (
    ['binary', 'unary', 'assignment'].includes(nodeKind) &&
    !isSemanticOperator(operator.operator ?? '')
  ) {
    nodeKind = 'unknown';
  }
  return {
    nodeKind,
    syntax,
    ...(node.optionalAccess === undefined ? {} : { optionalAccess: node.optionalAccess }),
    ...(value === undefined ? {} : { value }),
    ...namedDetails(index, node),
    ...operator,
    ...(role === 'function'
      ? { declaredAsync: children(index, node).some((child) => child.kind === 'AsyncKeyword') }
      : {}),
  };
}

function literalValue(node: SyntaxNode): { readonly value?: string | number | boolean | null } {
  const kind = node.kind;
  if (kind === 'TrueKeyword') return { value: true };
  if (kind === 'FalseKeyword') return { value: false };
  if (kind === 'NullKeyword') return { value: null };
  if (node.literalValue !== undefined) return { value: node.literalValue };
  return {};
}

function namedDetails(index: SourceIndex, node: SyntaxNode): { readonly name?: string } {
  const field = node.fields?.name?.[0] ?? node.fields?.tag?.[0];
  if (field) return { name: index.content.slice(...field) };
  if (node.kind === 'Identifier') return { name: index.content.slice(node.start, node.end) };
  const name = parentName(index, node);
  if (syntaxRole(node) === 'function' && name) return { name: index.content.slice(...name) };
  return {};
}

function operatorDetails(index: SourceIndex, node: SyntaxNode) {
  const span = node.fields?.operator?.[0];
  if (span) return { operator: index.content.slice(...span) };
  const operand = node.fields?.operand?.[0];
  if (!operand) return {};
  const prefix = index.content.slice(node.start, operand[0]).trim();
  const suffix = index.content.slice(operand[1], node.end).trim();
  return { operator: prefix.length > 0 ? prefix : suffix };
}

function children(index: SourceIndex, node: SyntaxNode) {
  const position = index.nodes.indexOf(node);
  return index.nodes.filter((child) => child.parent === position);
}

function parentName(index: SourceIndex, node: SyntaxNode) {
  const parent = node.parent === null ? undefined : index.nodes[node.parent];
  return parent?.fields?.name?.[0];
}
