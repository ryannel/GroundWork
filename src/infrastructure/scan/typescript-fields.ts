import 'server-only';

import ts from 'typescript';

import type { SyntaxFields } from './source-index-types';
import { typescriptSemanticFields } from './typescript-semantic-fields';

export function typescriptFields(node: ts.Node, file: ts.SourceFile): SyntaxFields {
  const fields: Record<string, (readonly [number, number])[]> = {};
  function add(name: string, children: readonly ts.Node[]) {
    fields[name] = children.map((child) => [child.getStart(file), child.getEnd()]);
  }
  if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
    add('callee', [node.expression]);
    add('arguments', node.arguments ?? []);
  }
  if (ts.isIfStatement(node)) {
    add('condition', [node.expression]);
    add('consequent', [node.thenStatement]);
    add('otherwise', node.elseStatement ? [node.elseStatement] : []);
  }
  if (ts.isConditionalExpression(node)) {
    add('condition', [node.condition]);
    add('consequent', [node.whenTrue]);
    add('otherwise', [node.whenFalse]);
  }
  if (ts.isReturnStatement(node)) add('values', node.expression ? [node.expression] : []);
  if (ts.isAwaitExpression(node)) add('task', [node.expression]);
  return {
    ...fields,
    ...valueFields(node, file),
    ...functionFields(node, file),
    ...typescriptSemanticFields(node, file),
  };
}

function valueFields(node: ts.Node, file: ts.SourceFile): SyntaxFields {
  if (!ts.isVariableDeclaration(node) || !node.initializer) return {};
  return { values: [[node.initializer.getStart(file), node.initializer.getEnd()]] };
}

function functionFields(node: ts.Node, file: ts.SourceFile): SyntaxFields {
  if (!ts.isFunctionLike(node)) return {};
  const fields: Record<string, (readonly [number, number])[]> = {
    parameters: node.parameters.map((parameter) => [parameter.getStart(file), parameter.getEnd()]),
  };
  if (node.name) fields.name = [[node.name.getStart(file), node.name.getEnd()]];
  if (node.type) fields.returnType = [[node.type.getStart(file), node.type.getEnd()]];
  return fields;
}
