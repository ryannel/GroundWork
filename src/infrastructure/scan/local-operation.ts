import 'server-only';

import type { Answer, Gap, Operation, ReturnValue } from '@/domain/scan/scan.generated';

import { branchOperations, fieldExpressions, syntaxIdentity } from './source-expressions';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import { childrenOf, syntaxRole } from './syntax-candidates';

export interface OperationContext {
  readonly index: SourceIndex;
  readonly position: number;
  readonly id: string;
  readonly source: string;
  readonly gap: string;
}

function returnValue(context: OperationContext): ReturnValue {
  const node = context.index.nodes[context.position];
  if (!node) return { kind: 'unresolved', gap: context.gap };
  if (node.fields?.values === undefined) return { kind: 'unresolved', gap: context.gap };
  const expressions = fieldExpressions(context.index, node, 'values');
  const first = expressions[0];
  if (first === undefined) return { kind: 'void' };
  const values: [string, ...string[]] = [first, ...expressions.slice(1)];
  if (values.length > 1) return { kind: 'tuple', values };
  return { kind: 'value', values };
}

function waiting(index: SourceIndex, node: SyntaxNode) {
  const parent = node.parent === null ? undefined : index.nodes[node.parent];
  if (parent?.kind === 'AwaitExpression') return 'awaited' as const;
  if (parent?.kind === 'GoStmt') return 'detached' as const;
  if (parent && syntaxRole(parent) === 'return') return 'returned' as const;
  return 'sync' as const;
}

export function operationOf(context: OperationContext): Operation | undefined {
  const node = context.index.nodes[context.position];
  if (!node) return undefined;
  const base = { id: context.id, source: context.source };
  switch (syntaxRole(node)) {
    case 'return': {
      return { ...base, kind: 'return', value: returnValue(context) };
    }
    case 'await': {
      return unaryOperation(context, node, 'await');
    }
    case 'throw': {
      return unaryOperation(context, node, 'throw');
    }
    case 'call': {
      return callOperation(context, node);
    }
    case 'branch': {
      if (!node.fields?.condition) {
        return {
          ...base,
          kind: 'opaque',
          frontier: `frontier:${context.id.slice('operation:'.length)}`,
        };
      }
      return {
        ...base,
        kind: 'control',
        predicate: {
          expression: fieldExpressions(context.index, node, 'condition')[0] ?? node.text,
          polarity: true,
          inputs: [],
        },
        consequent: branchOperations(context.index, node, 'consequent'),
        otherwise: branchOperations(context.index, node, 'otherwise'),
      };
    }
    default: {
      return undefined;
    }
  }
}

export function unresolvedCallGap(id: string, source: string): Gap {
  return {
    kind: 'gap',
    id,
    reason: 'missing_dependency',
    source,
    description:
      'Parse-only call spelling does not establish receiver, dispatch target or effects.',
  };
}

function unaryOperation(
  context: OperationContext,
  node: SyntaxNode,
  kind: 'await' | 'throw',
): Operation {
  const expression = exactExpression(context, node, 'task');
  if (expression === undefined) {
    return {
      kind: 'opaque',
      id: context.id,
      source: context.source,
      frontier: `frontier:${context.id.slice('operation:'.length)}`,
    };
  }
  const base = { id: context.id, source: context.source };
  return kind === 'await'
    ? { ...base, kind, task: expression }
    : { ...base, kind, value: expression };
}

function targetOf(context: OperationContext, node: SyntaxNode): Answer {
  const declaration = context.index.nodes.find(
    (entry) => entry.start === node.binding && syntaxRole(entry) === 'function',
  );
  if (!declaration) return { state: 'unresolved', reason: 'missing_dependency', gap: context.gap };
  const key = syntaxIdentity(context.index, declaration);
  return { state: 'supported', value: [`summary:${key}`], support: [`source:${key}`] };
}

function callOperation(context: OperationContext, node: SyntaxNode): Operation {
  const base = { id: context.id, source: context.source };
  const callee = exactExpression(context, node, 'callee');
  if (callee === undefined || node.fields?.arguments === undefined) {
    return {
      ...base,
      kind: 'opaque',
      frontier: `frontier:${context.id.slice('operation:'.length)}`,
    };
  }
  return {
    ...base,
    kind: 'call',
    callee,
    target: targetOf(context, node),
    arguments: [...fieldExpressions(context.index, node, 'arguments')],
    waiting: waiting(context.index, node),
  };
}

function exactExpression(
  context: OperationContext,
  node: SyntaxNode,
  field: string,
): string | undefined {
  const span = node.fields?.[field]?.[0] ?? firstChildSpan(context);
  if (!span) return undefined;
  const [start, end] = span;
  if (start < node.start || end > node.end) return undefined;
  if (end <= start) return undefined;
  return context.index.content.slice(start, end);
}

function firstChildSpan(context: OperationContext): readonly [number, number] | undefined {
  const child = childrenOf(context.index, context.position)[0];
  return child ? [child.start, child.end] : undefined;
}
