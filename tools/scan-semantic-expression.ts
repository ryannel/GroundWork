import type { SemanticEdge, SemanticNode } from '@/domain/scan/scan.generated';

import type { SemanticGraph } from './scan-semantic-query';

interface RenderContext {
  readonly graph: SemanticGraph;
  readonly seen: ReadonlySet<string>;
}

/** Canonical expression text assembled only from parsed atoms and typed operand roles. */
export function expressionSpelling(graph: SemanticGraph, node: SemanticNode | undefined): string {
  return render(node, { graph, seen: new Set() });
}

function children(context: RenderContext, node: SemanticNode, relation: SemanticEdge['relation']) {
  return (context.graph.outgoing.get(node.id) ?? [])
    .filter((edge) => edge.relation === relation)
    .toSorted((left, right) => (left.position ?? 0) - (right.position ?? 0))
    .flatMap((edge) => {
      const target = context.graph.byId.get(edge.to);
      return target ? [target] : [];
    });
}

const renderers: Partial<
  Record<SemanticNode['nodeKind'], (node: SemanticNode, context: RenderContext) => string>
> = {
  member,
  call: invocation,
  invocation,
  construct: invocation,
  binary,
  unary,
  index: indexed,
  object,
  array: arrayExpression,
  template,
  type: typeExpression,
  property,
};

function render(node: SemanticNode | undefined, context: RenderContext): string {
  if (!node || context.seen.has(node.id)) return '';
  const next = { graph: context.graph, seen: new Set([...context.seen, node.id]) };
  if (node.nodeKind === 'identifier') return node.name ?? '';
  if (node.nodeKind === 'literal') {
    return node.value === undefined ? '' : JSON.stringify(node.value);
  }
  const renderer = renderers[node.nodeKind];
  return renderer ? renderer(node, next) : wrapper(node, next);
}

function arrayExpression(node: SemanticNode, context: RenderContext): string {
  return `[${children(context, node, 'value')
    .map((child) => render(child, context))
    .join(',')}]`;
}

function member(node: SemanticNode, context: RenderContext): string {
  const receiver = render(children(context, node, 'receiver')[0], context);
  if (receiver === '' || node.name === undefined) return '';
  return `${receiver}${node.optionalAccess === true ? '?.' : '.'}${node.name}`;
}

function invocation(node: SemanticNode, context: RenderContext): string {
  const callee = render(children(context, node, 'callee')[0], context);
  if (callee === '') return '';
  const args = children(context, node, 'argument').map((argument) => render(argument, context));
  if (args.includes('')) return '';
  return `${node.nodeKind === 'construct' ? 'new' : ''}${callee}${node.optionalAccess === true ? '?.' : ''}(${args.join(',')})`;
}

const precedence: Readonly<Record<string, number>> = {
  '??': 1,
  '||': 1,
  '&&': 2,
  '|': 3,
  '^': 4,
  '&': 5,
  '==': 6,
  '!=': 6,
  '===': 6,
  '!==': 6,
  '<': 7,
  '>': 7,
  '<=': 7,
  '>=': 7,
  in: 7,
  instanceof: 7,
  '<<': 8,
  '>>': 8,
  '>>>': 8,
  '+': 9,
  '-': 9,
  '*': 10,
  '/': 10,
  '%': 10,
  '**': 11,
};

function binary(node: SemanticNode, context: RenderContext): string {
  const left = children(context, node, 'left')[0];
  const right = children(context, node, 'right')[0];
  if (!left || !right || node.operator === undefined) return '';
  const lhs = render(left, context);
  const rhs = render(right, context);
  if (lhs === '' || rhs === '') return '';
  return (
    operandText(context, { parent: node, child: left, right: false }) +
    node.operator +
    operandText(context, { parent: node, child: right, right: true })
  );
}

function operandText(
  context: RenderContext,
  input: {
    readonly parent: SemanticNode;
    readonly child: SemanticNode;
    readonly right: boolean;
  },
): string {
  const text = render(input.child, context);
  const effective = unwrapped(context, input.child);
  if (effective.nodeKind !== 'binary') return text;
  const parentLevel = precedence[input.parent.operator ?? ''] ?? 0;
  const childLevel = precedence[effective.operator ?? ''] ?? 0;
  return parenthesised(text, input.right ? childLevel <= parentLevel : childLevel < parentLevel);
}

function unwrapped(context: RenderContext, node: SemanticNode): SemanticNode {
  if (node.nodeKind !== 'expression') return node;
  const values = children(context, node, 'value');
  return values.length === 1 && values[0] ? unwrapped(context, values[0]) : node;
}

function parenthesised(value: string, required: boolean): string {
  return required ? `(${value})` : value;
}

function unary(node: SemanticNode, context: RenderContext): string {
  if (['++', '--'].includes(node.operator ?? '')) return '';
  const operand = children(context, node, 'operand')[0];
  const value = render(operand, context);
  if (value === '' || node.operator === undefined) return '';
  return node.operator + parenthesised(value, operand?.nodeKind === 'binary');
}

function indexed(node: SemanticNode, context: RenderContext): string {
  const receiver = render(children(context, node, 'receiver')[0], context);
  const keys = [...children(context, node, 'key'), ...children(context, node, 'argument')].map(
    (key) => render(key, context),
  );
  if (receiver === '' || keys.length === 0 || keys.includes('')) return '';
  return `${receiver}${node.optionalAccess === true ? '?.' : ''}[${keys.join(',')}]`;
}

function property(node: SemanticNode, context: RenderContext): string {
  const rendered = render(children(context, node, 'key')[0], context);
  const key = rendered === '' ? node.name : rendered;
  const value = children(context, node, 'initializer')[0] ?? children(context, node, 'value')[0];
  const expression = render(value, context);
  return key !== undefined && expression !== '' ? `${key}:${expression}` : '';
}

function object(node: SemanticNode, context: RenderContext): string {
  const type = render(children(context, node, 'declared_type')[0], context);
  const properties = children(context, node, 'property').map((field) => render(field, context));
  if (properties.includes('')) return '';
  return `${type}{${properties.join(',')}}`;
}

function typeExpression(node: SemanticNode, context: RenderContext): string {
  const receiver = children(context, node, 'receiver')[0];
  if (receiver) {
    const type = render(children(context, node, 'declared_type')[0], context);
    return type === '' ? indexed(node, context) : `${render(receiver, context)}.(${type})`;
  }
  return node.name ?? '';
}

function wrapper(node: SemanticNode, context: RenderContext): string {
  const values = children(context, node, 'value');
  if (values.length === 1) return render(values[0], context);
  if (node.nodeKind === 'await') return render(children(context, node, 'awaited')[0], context);
  const receiver = children(context, node, 'receiver')[0];
  const type = children(context, node, 'declared_type')[0];
  if (receiver && type) return `${render(receiver, context)}.(${render(type, context)})`;
  return '';
}

function template(node: SemanticNode, context: RenderContext): string {
  const spans = (context.graph.outgoing.get(node.id) ?? [])
    .filter((edge) => edge.label === 'spans')
    .toSorted((left, right) => (left.position ?? 0) - (right.position ?? 0));
  if (spans.length === 0) return '';
  const parts: string[] = [];
  for (const edge of spans) {
    const text = templatePart(context.graph.byId.get(edge.to), context);
    if (text === undefined) return '';
    parts.push(text);
  }
  return `\`${parts.join('')}\``;
}

function templatePart(child: SemanticNode | undefined, context: RenderContext): string | undefined {
  if (child?.nodeKind === 'literal' && typeof child.value === 'string') {
    return escapeChunk(child.value);
  }
  if (child?.nodeKind !== 'template') return undefined;
  const values = children(context, child, 'value');
  const expression = render(values[0], context);
  const tail = values[1];
  if (expression === '' || tail?.nodeKind !== 'literal' || typeof tail.value !== 'string') {
    return undefined;
  }
  return `\${${expression}}${escapeChunk(tail.value)}`;
}

function escapeChunk(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
}
