import 'server-only';

import type { SemanticNode } from '@/domain/scan/scan.generated';
import { isSemanticOperator } from '@/domain/scan/semantic-operators';

import { fieldExpressions } from './source-expressions';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import { spanKey } from './source-node-lookups';
import { syntaxRole } from './syntax-candidates';

const KINDS: Readonly<Record<string, SemanticNode['nodeKind']>> = {
  CLASS: 'declaration',
  INTERFACE: 'declaration',
  ENUM: 'declaration',
  RECORD: 'declaration',
  ANNOTATION_TYPE: 'declaration',
  THROW: 'throw',
  AwaitExpression: 'await',
  CsharpDeconstructionAssignment: 'unknown',
  CsharpCallbackAssignment: 'unknown',
  SWITCH_EXPRESSION: 'control',
  CASE: 'control',
  YIELD: 'control',
  INSTANCE_OF: 'expression',
  DECONSTRUCTION_PATTERN: 'expression',
  BINDING_PATTERN: 'declaration',
  ANY_PATTERN: 'unknown',
  PATTERN_CASE_LABEL: 'expression',
  CONSTANT_CASE_LABEL: 'expression',
  DEFAULT_CASE_LABEL: 'expression',
  IDENTIFIER: 'identifier',
  Ident: 'identifier',
  MEMBER_SELECT: 'member',
  SelectorExpr: 'member',
  CONDITIONAL_EXPRESSION: 'conditional',
  IF: 'if',
  IfStmt: 'if',
  IndexExpr: 'index',
  ARRAY_ACCESS: 'index',
  IndexListExpr: 'index',
  ImplicitElementAccess: 'index',
  ASSIGNMENT: 'assignment',
  AssignStmt: 'assignment',
  VARIABLE: 'declaration',
  ValueSpec: 'declaration',
  BLOCK: 'block',
  BlockStmt: 'block',
  TRY: 'try',
  CATCH: 'catch',
  DeferStmt: 'defer',
  ANNOTATION: 'annotation',
  TYPE_ANNOTATION: 'annotation',
  NEW_CLASS: 'construct',
  CompositeLit: 'object',
  KeyValueExpr: 'property',
  BinaryExpr: 'binary',
  UnaryExpr: 'unary',
  StarExpr: 'unary',
  BasicLit: 'literal',
  TypeAssertExpr: 'expression',
};

function backendNodeKind(node: SyntaxNode): SemanticNode['nodeKind'] {
  const mapped = KINDS[node.kind];
  if (mapped !== undefined) return mapped;
  if (node.kind.endsWith('_LITERAL')) return 'literal';
  if (node.fields?.left) return 'binary';
  if (node.fields?.operand) return 'unary';
  const role = syntaxRole(node);
  if (role === 'branch') return 'control';
  if (role === 'function' || role === 'call' || role === 'return' || role === 'loop') return role;
  return 'expression';
}

function literalValue(text: string): { readonly value?: string | number | boolean | null } {
  if (text === 'null' || text === 'nil') return { value: null };
  if (text === 'true' || text === 'false') return { value: text === 'true' };
  if (/^\d+(?:\.\d+)?$/u.test(text)) return { value: Number(text) };
  if (text.startsWith('`')) return { value: text.slice(1, -1) };
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === 'string') return { value };
  } catch {
    /* Source spelling remains available. */
  }
  return {};
}

export function backendAttributes(
  index: SourceIndex,
  node: SyntaxNode,
  roles?: ReadonlyMap<string, SemanticNode['nodeKind']>,
): Pick<
  SemanticNode,
  'nodeKind' | 'syntax' | 'name' | 'operator' | 'value' | 'returnType' | 'declaredAsync'
> {
  let nodeKind = fieldRole(index, node, roles) ?? backendNodeKind(node);
  const text = index.content.slice(node.start, node.end);
  const operator = operatorOf(index, node);
  if (['binary', 'unary', 'assignment'].includes(nodeKind) && !isSemanticOperator(operator)) {
    nodeKind = 'unknown';
  }
  const literal = parsedLiteral(node, text);
  if (nodeKind === 'literal' && literal.value === undefined) nodeKind = 'unknown';
  const returnType = fieldExpressions(index, node, 'returnType').join(', ');
  return {
    nodeKind,
    syntax: text,
    name: node.symbol !== undefined && node.symbol !== '' ? node.symbol : text,
    ...(['binary', 'unary', 'assignment'].includes(nodeKind) ? { operator } : {}),
    ...(nodeKind === 'literal' ? literal : {}),
    ...(nodeKind === 'function'
      ? {
          ...(returnType.length > 0 ? { returnType } : {}),
          declaredAsync: isDeclaredAsync(index, node),
        }
      : {}),
  };
}

const JAVA_OPERATORS: Readonly<Record<string, string>> = {
  CONDITIONAL_AND: '&&',
  CONDITIONAL_OR: '||',
  EQUAL_TO: '==',
  NOT_EQUAL_TO: '!=',
  LESS_THAN: '<',
  GREATER_THAN: '>',
  LESS_THAN_EQUAL: '<=',
  GREATER_THAN_EQUAL: '>=',
  PLUS: '+',
  MINUS: '-',
  MULTIPLY: '*',
  DIVIDE: '/',
  REMAINDER: '%',
  AND: '&',
  OR: '|',
  XOR: '^',
  LEFT_SHIFT: '<<',
  RIGHT_SHIFT: '>>',
  UNSIGNED_RIGHT_SHIFT: '>>>',
  LOGICAL_COMPLEMENT: '!',
  BITWISE_COMPLEMENT: '~',
  UNARY_MINUS: '-',
  UNARY_PLUS: '+',
  PREFIX_INCREMENT: '++',
  POSTFIX_INCREMENT: '++',
  PREFIX_DECREMENT: '--',
  POSTFIX_DECREMENT: '--',
};

function parsedOperator(index: SourceIndex, node: SyntaxNode): string | undefined {
  return node.operator ?? fieldExpressions(index, node, 'operator')[0];
}
function operatorOf(index: SourceIndex, node: SyntaxNode): string {
  const operatorText = parsedOperator(index, node);
  if (operatorText !== undefined) return operatorText;
  const javaOperator = JAVA_OPERATORS[node.kind];
  if (index.language === 'java' && javaOperator !== undefined) return javaOperator;
  const left = node.fields?.left?.[0];
  const right = node.fields?.right?.[0];
  if (left && right) return index.content.slice(left[1], right[0]).trim();
  const target = node.fields?.targets?.at(-1);
  return assignmentOperator(index, node, target);
}

function assignmentOperator(
  index: SourceIndex,
  node: SyntaxNode,
  target: readonly [number, number] | undefined,
): string {
  const value = node.fields?.values?.[0];
  if (target && value) return index.content.slice(target[1], value[0]).trim();
  const operand = node.fields?.operand?.[0];
  if (!operand) return '';
  const prefix = index.content.slice(node.start, operand[0]).trim();
  return prefix.length > 0 ? prefix : index.content.slice(operand[1], node.end).trim();
}

function fieldRole(
  index: SourceIndex,
  node: SyntaxNode,
  roles?: ReadonlyMap<string, SemanticNode['nodeKind']>,
): SemanticNode['nodeKind'] | undefined {
  if (index.language === 'java' && node.kind === 'VARIABLE' && node.symbol === '_') {
    return 'unknown';
  }
  if (roles !== undefined) return roles.get(spanKey(node.start, node.end));
  return scannedFieldRole(index, node);
}

function scannedFieldRole(
  index: SourceIndex,
  node: SyntaxNode,
): SemanticNode['nodeKind'] | undefined {
  for (const owner of index.nodes) {
    for (const name of ['returnType', 'type', 'parameters']) {
      const matches =
        owner.fields?.[name]?.some(([start, end]) => start === node.start && end === node.end) ===
        true;
      if (matches) return name === 'parameters' ? 'parameter' : 'type';
    }
  }
  return undefined;
}

function isDeclaredAsync(index: SourceIndex, node: SyntaxNode): boolean {
  return (
    fieldExpressions(index, node, 'annotations').includes('@Async') ||
    node.modifiers?.includes('async') === true
  );
}

function parsedLiteral(
  node: SyntaxNode,
  text: string,
): { readonly value?: string | number | boolean | null } {
  if (node.kind === 'BOOLEAN_LITERAL') {
    const value = node.literalValue ?? text;
    if (typeof value === 'boolean') return { value };
    if (value === 'true' || value === 'false') return { value: value === 'true' };
    return {};
  }
  return node.literalValue === undefined ? literalValue(text) : { value: node.literalValue };
}
